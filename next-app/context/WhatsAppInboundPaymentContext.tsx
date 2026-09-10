"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { websocketService } from "@/services/websocket";
import { notify } from "@/lib/notify";
import { DEFAULT_PUBLIC_API_URL, resolveBrowserApiUrl } from "@/lib/publicEnv";

export interface WhatsAppInboundPaymentItem {
  id: string;
  invoiceId: number;
  fullName: string;
  username: string;
  amount: number;
  matchedName?: string;
  from?: string;
  timestamp: string;
}

interface WhatsAppInboundPaymentContextType {
  items: WhatsAppInboundPaymentItem[];
  isDockOpen: boolean;
  setIsDockOpen: (open: boolean) => void;
  clearItems: () => void;
  removeItem: (id: string) => void;
  addPaymentItem: (item: Omit<WhatsAppInboundPaymentItem, "id" | "timestamp">) => void;
}

const STORAGE_KEY = "xnet_whatsapp_inbound_payments";

const WhatsAppInboundPaymentContext = createContext<WhatsAppInboundPaymentContextType | undefined>(undefined);

export const WhatsAppInboundPaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WhatsAppInboundPaymentItem[]>([]);
  const [isDockOpen, setIsDockOpen] = useState(false);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Restore from sessionStorage on initial mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setIsDockOpen(true);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const addPaymentItem = useCallback(
    (rawItem: Omit<WhatsAppInboundPaymentItem, "id" | "timestamp">) => {
      const item: WhatsAppInboundPaymentItem = {
        id: `wa-paid-${rawItem.invoiceId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        invoiceId: Number(rawItem.invoiceId || 0),
        fullName: String(rawItem.fullName || rawItem.username || "Subscriber"),
        username: String(rawItem.username || ""),
        amount: Number(rawItem.amount || 0),
        matchedName: rawItem.matchedName ? String(rawItem.matchedName) : undefined,
        from: rawItem.from ? String(rawItem.from) : undefined,
        timestamp: new Date().toISOString(),
      };

      setItems((prev) => {
        // Prevent immediate duplicate entries
        if (prev.some((p) => p.invoiceId === item.invoiceId && item.invoiceId > 0)) {
          return prev;
        }
        const updated = [item, ...prev].slice(0, 30);
        try {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          }
        } catch {
          /* ignore */
        }
        return updated;
      });

      setIsDockOpen(true);

      notify.success(
        "WhatsApp Auto-Payment Received",
        `${item.fullName} paid $${item.amount > 0 ? item.amount.toFixed(2) : "—"} (Invoice #${item.invoiceId})`
      );
    },
    []
  );

  useEffect(() => {
    let isSubscribed = true;
    let ws: WebSocket | null = null;

    const handleInvoicePaid = (data: any) => {
      if (!data) return;

      const inner = data?.data && typeof data.data === "object" ? data.data : data;
      const changes = inner?.changes || data?.changes || {};
      const source = data?.source || inner?.source || changes?.source;
      const matchedName = data?.matchedName || inner?.matchedName || changes?.matchedName;

      const isWa =
        source === "whatsapp_inbound" ||
        source === "whatsapp" ||
        changes?.source === "whatsapp_inbound" ||
        Boolean(matchedName) ||
        data?.type === "EXTERNAL_INVOICE_PAID" ||
        inner?.type === "EXTERNAL_INVOICE_PAID";

      if (!isWa) return;

      const invoiceId = Number(data.invoiceId || inner.invoiceId || inner.id || 0);
      const fullName = String(
        data.fullName || inner.fullName || inner.data?.fullName || inner.username || "Subscriber"
      );
      const username = String(data.username || inner.username || inner.data?.username || "");
      const amount = Number(
        data.amount ??
          data.paidAmount ??
          inner.amountPaid ??
          inner.paidAmount ??
          inner.totalAmount ??
          inner.amount ??
          0
      );

      addPaymentItem({
        invoiceId,
        fullName,
        username,
        amount,
        matchedName: matchedName ? String(matchedName) : undefined,
        from: data.from || inner.from || changes?.from ? String(data.from || inner.from || changes?.from) : undefined,
      });
    };

    // 1. Subscribe to STOMP WebSocket
    const unsubStomp = websocketService.onNotification(handleInvoicePaid, "EXTERNAL_INVOICE_PAID");

    // 2. Resilient Auto-Reconnecting native WebSocket
    const connectNativeWs = () => {
      if (!isSubscribed || typeof window === "undefined") return;

      try {
        const apiUrl =
          resolveBrowserApiUrl().replace(/\/api\/?$/, "") ||
          DEFAULT_PUBLIC_API_URL.replace(/\/api\/?$/, "");
        const wsUrl = apiUrl.replace(/^http/, "ws");
        const token =
          localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken");

        if (!token) {
          reconnectTimerRef.current = setTimeout(connectNativeWs, 2000);
          return;
        }

        ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

        ws.onopen = () => {
          // Connected cleanly
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(String(event.data));
            if (parsed?.type === "EXTERNAL_INVOICE_PAID") {
              handleInvoicePaid(parsed);
            }
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          if (isSubscribed) {
            reconnectTimerRef.current = setTimeout(connectNativeWs, 3000);
          }
        };

        ws.onerror = () => {
          try {
            ws?.close();
          } catch {
            /* ignore */
          }
        };
      } catch {
        if (isSubscribed) {
          reconnectTimerRef.current = setTimeout(connectNativeWs, 5000);
        }
      }
    };

    connectNativeWs();

    // 3. Custom window event listener for in-app simulator or manual test dispatch
    const onCustomPaymentEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleInvoicePaid(customEvent.detail);
      }
    };
    window.addEventListener("xnet:whatsapp_inbound_paid", onCustomPaymentEvent);

    return () => {
      isSubscribed = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      unsubStomp();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      window.removeEventListener("xnet:whatsapp_inbound_paid", onCustomPaymentEvent);
    };
  }, [addPaymentItem]);

  return (
    <WhatsAppInboundPaymentContext.Provider
      value={{
        items,
        isDockOpen,
        setIsDockOpen,
        clearItems,
        removeItem,
        addPaymentItem,
      }}
    >
      {children}
    </WhatsAppInboundPaymentContext.Provider>
  );
};

export function useWhatsAppInboundPaymentQueue() {
  const ctx = useContext(WhatsAppInboundPaymentContext);
  if (!ctx) {
    throw new Error("useWhatsAppInboundPaymentQueue must be used within WhatsAppInboundPaymentProvider");
  }
  return ctx;
}
