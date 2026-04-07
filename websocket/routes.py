"""Endpoint WebSocket para agenda em tempo real."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from websocket.manager import ws_manager

router = APIRouter()

@router.websocket("/ws/agenda")
async def websocket_agenda(
    websocket: WebSocket,
    professional_id: int | None = Query(None),
    role: str = Query("professional"),
):
    """
    WebSocket para receber atualizações da agenda em tempo real.

    Uso:
      ws://localhost:8000/ws/agenda?professional_id=1&role=professional
      ws://localhost:8000/ws/agenda?role=admin

    Eventos recebidos:
      {"event": "new", "professional_id": 1, "data": {...}}
      {"event": "cancelled", "professional_id": 1, "data": {...}}
      {"event": "completed", "professional_id": 1, "data": {...}}
    """
    is_admin = role == "admin"

    await ws_manager.connect(websocket, professional_id=professional_id, is_admin=is_admin)
    
    try:
        while True:
            # Mantém conexão aberta (espera mensagens do client, se houver)
            data = await websocket.receive_text()  # Pode ser usado para receber mensagens do cliente, se necessário
            if data == "ping":
                await websocket.send_text("pong")  # Responde a pings para manter a conexão ativa   
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, professional_id=professional_id, is_admin=is_admin)