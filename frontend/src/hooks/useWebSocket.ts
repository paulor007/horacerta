import { useEffect, useRef, useState } from "react";
import type { WebSocketEvent } from "../types";

export function useWebSocket(professionalId?: number, role?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    function connect() {
      const params = new URLSearchParams();
      if (professionalId) params.set("professional_id", String(professionalId));
      if (role) params.set("role", role);

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws/agenda?${params}`);

      ws.onopen = () => {
        setConnected(true);
        console.log("[WS] Conectado");
      };

      ws.onmessage = (e) => {
        try {
          const event: WebSocketEvent = JSON.parse(e.data);
          setLastEvent(event);
        } catch {
          console.log("[WS] Mensagem:", e.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();

      wsRef.current = ws;
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [professionalId, role]);

  return { lastEvent, connected };
}
