import { Client, Message } from "@stomp/stompjs";
import { toast } from "@/components/ui/use-toast";
import { ingestInboxNotification } from "@/store/notificationInboxStore";
import { normalizeUserActionsQueuePayload, normalizeUserStatusPayload } from "@/lib/normalizeInboxNotification";
import { resolvePublicWsUrl } from "@/lib/publicEnv";

function resolveStompBrokerUrl(): string | null {
  // Runtime override (Docker env.js) then build-time NEXT_PUBLIC_WS_URL.
  const runtime =
    typeof window !== "undefined" && typeof window.__ENV__?.WS_URL === "string"
      ? window.__ENV__.WS_URL.trim()
      : "";
  const explicit = (runtime || resolvePublicWsUrl() || "").replace(/\/$/, "");
  if (!explicit) {
    // Do not invent wss://api.../ws — that is the Express JWT socket, not RabbitMQ STOMP.
    return null;
  }
  if (/\/ws$/i.test(explicit)) return explicit;
  return `${explicit}/ws`;
}

class WebSocketService {
  private client: Client | null = null;
  private isConnecting: boolean = false;
  private intentionalDisconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private errorToastShown: boolean = false;
  private subscribers: Map<string, ((data: any) => void)[]> = new Map();
  private disabledReason: string | null = null;

  private initializeClient() {
    if (typeof window === "undefined") return;
    if (this.client) return;

    const wsUrl = resolveStompBrokerUrl();
    if (!wsUrl) {
      this.disabledReason = "NEXT_PUBLIC_WS_URL / __ENV__.WS_URL not set";
      console.warn(`STOMP notifications disabled: ${this.disabledReason}`);
      return;
    }

    console.log("Initializing STOMP client with URL:", wsUrl);

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        login: "guest",
        passcode: "guest",
      },
      debug: (str) => {
        if (process.env.NODE_ENV === "development") {
          console.log("STOMP: " + str);
        }
      },
      reconnectDelay: this.reconnectDelay,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.client.onConnect = () => {
      console.log("STOMP: Connected successfully");
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.errorToastShown = false;
      this.subscribeToTopics();
    };

    this.client.onStompError = (frame) => {
      console.error("STOMP: Error", frame);
      this.handleConnectionError();
    };

    this.client.onWebSocketError = (event) => {
      console.error("STOMP: WebSocket Error", event);
      this.handleConnectionError();
    };

    this.client.onWebSocketClose = () => {
      if (this.intentionalDisconnect) return;
      console.log("STOMP: Connection closed");
      this.handleConnectionError();
    };
  }

  private handleConnectionError() {
    if (this.intentionalDisconnect) return;
    this.isConnecting = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`STOMP: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
      return;
    }

    if (!this.errorToastShown) {
      this.errorToastShown = true;
      console.error("STOMP: Max reconnection attempts reached");
      toast({
        title: "Connection Error",
        description: "Unable to establish WebSocket connection. Please refresh the page.",
        variant: "destructive",
      });
    }
  }

  private subscribeToTopics() {
    if (!this.client?.connected) {
      console.error("Cannot subscribe: WebSocket client is not connected");
      return;
    }

    try {
      this.client.subscribe("/queue/user_actions_queue", (message: Message) => {
        try {
          const data = JSON.parse(message.body);
          const inboxItem = normalizeUserActionsQueuePayload(data);
          if (inboxItem) ingestInboxNotification(inboxItem);
          this.notifySubscribers("INVOICE_MODIFICATION", data);
          this.notifySubscribers("EXTERNAL_INVOICE_PAID", data);

          const toastTitle = typeof data.title === "string" ? data.title : "Notification";
          const toastDesc =
            typeof data.message === "string"
              ? data.message
              : typeof data.description === "string"
                ? data.description
                : undefined;
          toast({ title: toastTitle, description: toastDesc });
        } catch (error) {
          console.error("STOMP: Error parsing message", error);
        }
      });

      this.client.subscribe("/topic/user-status", (message: Message) => {
        try {
          const data = JSON.parse(message.body);
          const payload =
            data && typeof data === "object" && data.type == null
              ? { ...data, type: "USER_STATUS_CHANGE" }
              : data;
          const inboxItem = normalizeUserStatusPayload(payload);
          if (inboxItem) ingestInboxNotification(inboxItem);
          this.notifySubscribers("USER_STATUS_CHANGE", payload);
        } catch (error) {
          console.error("STOMP: Error parsing message", error);
        }
      });
    } catch (error) {
      console.error("Error subscribing to topics:", error);
    }
  }

  public connect() {
    if (typeof window === "undefined") return;
    this.intentionalDisconnect = false;

    if (this.isConnecting || this.client?.connected) return;

    this.isConnecting = true;
    this.initializeClient();

    if (!this.client) {
      this.isConnecting = false;
      return;
    }

    try {
      this.client.activate();
    } catch (error) {
      console.error("STOMP: Connection error", error);
      this.handleConnectionError();
    }
  }

  public disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        this.client.deactivate();
      } catch {
        /* ignore */
      }
    }
    this.client = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  public onNotification(callback: (data: any) => void, topic: string = "INVOICE_MODIFICATION") {
    if (!this.subscribers.has(topic)) this.subscribers.set(topic, []);
    this.subscribers.get(topic)?.push(callback);
    return () => {
      const callbacks = this.subscribers.get(topic);
      if (!callbacks) return;
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  private notifySubscribers(topic: string, data: any) {
    this.subscribers.get(topic)?.forEach((callback) => callback(data));
  }
}

export const websocketService = new WebSocketService();
