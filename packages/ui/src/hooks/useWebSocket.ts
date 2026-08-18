import { useEffect, useRef, useState, useCallback } from 'react';
import { ServerMessage } from '../types';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:3000/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, message]);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2 seconds
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { connected, messages, clearMessages };
}
