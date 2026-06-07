"""
IPFS client — uploads content via Pinata, falls back to a deterministic stub.

Priority:
  1. PINATA_JWT  (preferred — single token, works with new Pinata API v3)
  2. PINATA_API_KEY + PINATA_SECRET_KEY  (legacy)
  3. Offline stub — returns a fake CID based on SHA256 so the rest of the
     pipeline keeps running without external connectivity.
"""
import hashlib
import json
import logging

import aiohttp

from .config import settings

logger = logging.getLogger("orchestrator.ipfs")

PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"


def _stub_cid(content: str) -> str:
    """Produce a deterministic fake CID for offline mode."""
    digest = hashlib.sha256(content.encode()).hexdigest()
    return f"bafybeif{digest[:46]}"


def _headers() -> dict:
    if settings.PINATA_JWT:
        return {"Authorization": f"Bearer {settings.PINATA_JWT}"}
    return {
        "pinata_api_key": settings.PINATA_API_KEY,
        "pinata_secret_api_key": settings.PINATA_SECRET_KEY,
    }


async def upload_json(data: dict, name: str = "mindmesh-report") -> str:
    """
    Upload a JSON object to IPFS via Pinata.
    Returns the IPFS CID (v1 base32 string).
    Falls back to deterministic stub if Pinata is unavailable.
    """
    if not settings.ipfs_available:
        cid = _stub_cid(json.dumps(data, sort_keys=True))
        logger.info(f"[IPFS] Offline stub CID: {cid}")
        return cid

    payload = {
        "pinataContent": data,
        "pinataMetadata": {"name": name},
        "pinataOptions": {"cidVersion": 1},
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                PINATA_PIN_JSON_URL,
                json=payload,
                headers=_headers(),
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    cid = body.get("IpfsHash", "")
                    logger.info(f"[IPFS] Uploaded JSON → {cid}")
                    return cid
                else:
                    text = await resp.text()
                    logger.warning(f"[IPFS] Pinata error {resp.status}: {text[:200]}")
    except Exception as e:
        logger.warning(f"[IPFS] Upload failed: {e}")

    # Fallback to stub
    cid = _stub_cid(json.dumps(data, sort_keys=True))
    logger.info(f"[IPFS] Fallback stub CID: {cid}")
    return cid


async def upload_text(content: str, name: str = "mindmesh-report.md") -> str:
    """
    Upload a text/Markdown file to IPFS via Pinata.
    Returns the IPFS CID.
    """
    if not settings.ipfs_available:
        cid = _stub_cid(content)
        logger.info(f"[IPFS] Offline stub CID: {cid}")
        return cid

    try:
        form = aiohttp.FormData()
        form.add_field(
            "file",
            content.encode("utf-8"),
            filename=name,
            content_type="text/markdown",
        )
        form.add_field(
            "pinataMetadata",
            json.dumps({"name": name}),
            content_type="application/json",
        )
        form.add_field(
            "pinataOptions",
            json.dumps({"cidVersion": 1}),
            content_type="application/json",
        )

        async with aiohttp.ClientSession() as session:
            async with session.post(
                PINATA_PIN_FILE_URL,
                data=form,
                headers=_headers(),
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    cid = body.get("IpfsHash", "")
                    logger.info(f"[IPFS] Uploaded text → {cid}")
                    return cid
                else:
                    text = await resp.text()
                    logger.warning(f"[IPFS] Pinata error {resp.status}: {text[:200]}")
    except Exception as e:
        logger.warning(f"[IPFS] Upload failed: {e}")

    cid = _stub_cid(content)
    logger.info(f"[IPFS] Fallback stub CID: {cid}")
    return cid


def ipfs_url(cid: str) -> str:
    """Return a public IPFS gateway URL for a CID."""
    return f"https://gateway.pinata.cloud/ipfs/{cid}"
