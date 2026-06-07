"""WebSocket route — real-time event stream for CLI and frontend."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


def _get_ws_manager():
    """Lazy import to break circular dependency with main.py."""
    from ..main import get_ws_manager
    return get_ws_manager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    manager = _get_ws_manager()
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; manager.broadcast() pushes events
            data = await ws.receive_text()
            # Echo ping back
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws)
