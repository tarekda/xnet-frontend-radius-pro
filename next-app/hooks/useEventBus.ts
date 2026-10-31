import { useCallback, useEffect, useRef } from 'react';
import { DEFAULT_PUBLIC_API_URL, resolveBrowserApiUrl } from "@/lib/publicEnv";

type MessageHandler = (message: any) => void;

export const useEventBus = () => {
  const ws = useRef<WebSocket | null>(null);
  const handlers = useRef<Map<string, Set<MessageHandler>>>(new Map());

  useEffect(() => {
    // Connect to WebSocket server
    const apiUrl =
      resolveBrowserApiUrl().replace(/\/api\/?$/, "") ||
      DEFAULT_PUBLIC_API_URL.replace(/\/api\/?$/, "");
    const wsUrl = apiUrl.replace(/^http/, "ws");
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const queueHandlers = handlers.current.get(message.queue);
        if (queueHandlers) {
          queueHandlers.forEach(handler => handler(message));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const subscribe = useCallback((queue: string, handler: MessageHandler) => {
    if (!handlers.current.has(queue)) {
      handlers.current.set(queue, new Set());
    }
    handlers.current.get(queue)?.add(handler);
  }, []);

  const unsubscribe = useCallback((queue: string, handler: MessageHandler) => {
    handlers.current.get(queue)?.delete(handler);
  }, []);

  return { subscribe, unsubscribe };
}; 