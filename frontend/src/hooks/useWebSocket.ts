import { useEffect, useRef, useState } from "react";
import type { WebSocketEvent } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Constrói a URL do WebSocket.
 * - Em DEV (sem VITE_API_URL): usa o host atual (proxy do Vite)
 * - Em PROD: deriva ws/wss da URL do backend
 */
function buildWsUrl(path: string): string {
  if (API_BASE) {
    // Ex: https://api.up.railway.app -> wss://api.up.railway.app
    const url = new URL(API_BASE);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}${path}`;
  }
  // Dev: usa o host do navegador (proxy)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export function useWebSocket(professionalId?: number, role?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    function connect() {
      const params = new URLSearchParams();
      if (professionalId) params.set("professional_id", String(professionalId));
      if (role) params.set("role", role);

      const ws = new WebSocket(buildWsUrl(`/ws/agenda?${params}`));

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
