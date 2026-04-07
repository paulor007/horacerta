"""
WebSocket Manager — gerencia conexões e broadcast.

Como funciona:
1. Profissional abre a página de agenda → conecta via WebSocket
2. Cliente agenda/cancela → sistema faz broadcast
3. Profissional recebe atualização sem refresh

Cada profissional se conecta identificando seu ID.
O broadcast é filtrado: só profissionais afetados recebem a mensagem.
"""

from fastapi import WebSocket

class ConnectioManager:
    """Gerencia conexões WebSocket ativas."""
    def __init__(self):
        # Mapa: professional_id → lista de conexões
        self.active_connections: dict[int, list[WebSocket]] = {}
        # Conexões de admin
        self.admin_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket, professional_id: int | None = None, is_admin: bool = False):
        """Aceita nova conexão WebSocket."""
        await websocket.accept()

        if is_admin:
            self.admin_connections.append(websocket)
        elif professional_id:
            if professional_id not in self.active_connections:
                self.active_connections[professional_id] = []
            self.active_connections[professional_id].append(websocket)
            print(f" [WS] Profissional {professional_id} conectado. Total conexões: {len(self.active_connections[professional_id])}")

    def disconnect(self, websocket: WebSocket, professional_id: int | None = None, is_admin: bool = False):
        """Remove conexão ao desconectar."""
        if is_admin and websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
            print("  [WS] Admin desconectado.")
        elif professional_id and professional_id in self.active_connections:
            if websocket in self.active_connections[professional_id]:
                self.active_connections[professional_id].remove(websocket)
            if not self.active_connections[professional_id]:
                del self.active_connections[professional_id]
            print(f"  [WS] Profissional {professional_id} desconectado.")

    async def broadcast_to_professional(self, professional_id: int, message: dict):
        """Envia mensagem para um profissional específico."""
        connections = self.active_connections.get(professional_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        # Limpar conexões mortas
        for ws in dead:
            connections.remove(ws)

    async def broadcast_to_admins(self, message: dict):
        """Envia mensagem para todos os admins conectados."""
        dead = []
        for ws in self.admin_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.admin_connections.remove(ws)

    async def broadcast_appointment_event(self, event_type: str, professional_id: int, data: dict):
        """
        Broadcast de evento de agendamento.

        event_type: "new", "cancelled", "completed", "no_show", "rescheduled"
        """
        message = {
            "event": event_type,
            "professional_id": professional_id,
            "data": data,
        }

        # Enviar para o profissional afetado
        await self.broadcast_to_professional(professional_id, message)

        # Enviar para todos os admins
        await self.broadcast_to_admins(message)

        print(f"  [WS] Broadcast: {event_type} para profissional {professional_id}")

    @property
    def total_connections(self) -> int:
        total = sum(len(conns) for conns in self.active_connections.values())
        return total + len(self.admin_connections)

# Instância global (singleton)
ws_manager = ConnectioManager()