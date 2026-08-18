import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { ServerMessage } from '../types.js';

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });
  });

  return wss;
}

export function broadcast(message: ServerMessage): void {
  if (!wss) return;

  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function broadcastActivity(message: string, details?: string): void {
  broadcast({
    type: 'activity',
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}
