"""
Multi-node discovery for MindMesh.

Supports three modes (all composable):
  1. LOCAL  — Redis pubsub only (single machine, default for dev)
  2. BOOTSTRAP — static list of peer HTTP endpoints (env BOOTSTRAP_NODES)
  3. MDNS  — mDNS/Zeroconf automatic discovery on the local WiFi subnet

When NODE_MODE=network, this module maintains a live registry of known peer
nodes and forwards proposal/query broadcasts to them via HTTP POST.

Peers are stored as: {endpoint: str, last_seen: float}
Endpoint format: "http://192.168.1.5:8000"
"""
import asyncio
import json
import logging
import socket
import time
from typing import Optional

import aiohttp

from .config import settings

logger = logging.getLogger("orchestrator.discovery")

_peers: dict[str, float] = {}  # endpoint → last_seen timestamp
_mdns_service: Optional[object] = None


def get_peers() -> list[str]:
    """Return list of currently known peer endpoints (excluding self)."""
    now = time.time()
    self_ep = settings.NODE_ENDPOINT.rstrip("/")
    # Remove peers not seen in 5 minutes
    stale = [ep for ep, ts in _peers.items() if now - ts > 300]
    for ep in stale:
        del _peers[ep]
    return [ep for ep in _peers if ep != self_ep]


def register_peer(endpoint: str) -> None:
    ep = endpoint.rstrip("/")
    if ep and ep != settings.NODE_ENDPOINT.rstrip("/"):
        _peers[ep] = time.time()
        logger.info(f"[DISCOVERY] Peer registered: {ep} (total: {len(_peers)})")


# ── Bootstrap ─────────────────────────────────────────────────────────────────

async def load_bootstrap_peers() -> None:
    """Load peers from BOOTSTRAP_NODES env var and verify they are alive."""
    for ep in settings.bootstrap_node_list:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{ep.rstrip('/')}/health",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status == 200:
                        register_peer(ep)
                        logger.info(f"[DISCOVERY] Bootstrap peer alive: {ep}")
                    else:
                        logger.warning(f"[DISCOVERY] Bootstrap peer unhealthy: {ep} ({resp.status})")
        except Exception as e:
            logger.warning(f"[DISCOVERY] Bootstrap peer unreachable: {ep} — {e}")


# ── mDNS ─────────────────────────────────────────────────────────────────────

SERVICE_TYPE = "_mindmesh._tcp.local."


async def start_mdns() -> None:
    """Start mDNS advertisement and discovery (requires zeroconf package)."""
    if not settings.MDNS_ENABLED or settings.NODE_MODE == "local":
        return

    try:
        from zeroconf.asyncio import AsyncZeroconf, AsyncServiceBrowser
        from zeroconf import ServiceInfo
    except ImportError:
        logger.info("[DISCOVERY] zeroconf not installed — mDNS disabled")
        return

    port = settings.ORCHESTRATOR_PORT
    hostname = socket.gethostname()
    local_ip = _get_local_ip()

    if not local_ip:
        logger.warning("[DISCOVERY] Could not determine local IP — mDNS disabled")
        return

    info = ServiceInfo(
        SERVICE_TYPE,
        f"mindmesh-{hostname}.{SERVICE_TYPE}",
        addresses=[socket.inet_aton(local_ip)],
        port=port,
        properties={"endpoint": f"http://{local_ip}:{port}"},
    )

    zc = AsyncZeroconf()
    await zc.async_register_service(info)
    logger.info(f"[DISCOVERY] mDNS advertising: {local_ip}:{port}")

    class Listener:
        def add_service(self, zc_, type_, name):
            asyncio.create_task(_on_mdns_service_found(zc_, type_, name))

        def remove_service(self, zc_, type_, name):
            pass

        def update_service(self, zc_, type_, name):
            pass

    AsyncServiceBrowser(zc.zeroconf, SERVICE_TYPE, Listener())
    global _mdns_service
    _mdns_service = (zc, info)


async def _on_mdns_service_found(zc, type_, name) -> None:
    try:
        from zeroconf import ServiceInfo
        info = ServiceInfo(type_, name)
        await asyncio.get_event_loop().run_in_executor(None, zc.get_service_info, type_, name)
        props = info.properties or {}
        endpoint = props.get(b"endpoint", b"").decode("utf-8")
        if endpoint:
            register_peer(endpoint)
    except Exception as e:
        logger.debug(f"[DISCOVERY] mDNS service parse error: {e}")


async def stop_mdns() -> None:
    global _mdns_service
    if _mdns_service:
        zc, info = _mdns_service
        try:
            await zc.async_unregister_service(info)
            await zc.async_close()
        except Exception:
            pass
        _mdns_service = None


# ── Peer heartbeat ────────────────────────────────────────────────────────────

async def heartbeat_loop() -> None:
    """
    Every 60s: announce ourselves to all known peers and prune stale ones.
    Runs as a background asyncio task when NODE_MODE=network.
    """
    if settings.NODE_MODE == "local":
        return

    self_ep = settings.NODE_ENDPOINT.rstrip("/")
    if not self_ep:
        logger.warning("[DISCOVERY] NODE_ENDPOINT not set — heartbeat disabled")
        return

    while True:
        await asyncio.sleep(60)
        peers = get_peers()
        for ep in peers:
            try:
                async with aiohttp.ClientSession() as session:
                    await session.post(
                        f"{ep}/api/nodes/announce",
                        json={"endpoint": self_ep},
                        timeout=aiohttp.ClientTimeout(total=5),
                    )
            except Exception:
                pass  # stale peer — will be pruned next cycle


# ── Broadcast helpers ─────────────────────────────────────────────────────────

async def broadcast_to_peers(path: str, payload: dict) -> None:
    """
    POST payload to all known peer nodes at the given path.
    Used to forward proposal/query broadcasts to network nodes.
    """
    peers = get_peers()
    if not peers:
        return

    async def _post(ep: str) -> None:
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(
                    f"{ep}{path}",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10),
                )
        except Exception as e:
            logger.debug(f"[DISCOVERY] Broadcast to {ep} failed: {e}")

    await asyncio.gather(*[_post(ep) for ep in peers], return_exceptions=True)


# ── Startup ───────────────────────────────────────────────────────────────────

async def start(redis_client=None) -> None:
    """Initialize node discovery based on NODE_MODE setting."""
    logger.info(f"[DISCOVERY] Mode: {settings.NODE_MODE}")

    if settings.NODE_MODE == "local":
        logger.info("[DISCOVERY] Local mode — using Redis pubsub only")
        return

    # Network mode
    await load_bootstrap_peers()
    await start_mdns()
    asyncio.create_task(heartbeat_loop())
    logger.info(f"[DISCOVERY] Network mode ready — {len(_peers)} bootstrap peers")


async def stop() -> None:
    await stop_mdns()


# ── Utilities ─────────────────────────────────────────────────────────────────

def _get_local_ip() -> Optional[str]:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return None


def node_info() -> dict:
    return {
        "mode": settings.NODE_MODE,
        "endpoint": settings.NODE_ENDPOINT,
        "peers": get_peers(),
        "peer_count": len(get_peers()),
        "mdns_enabled": settings.MDNS_ENABLED,
    }
