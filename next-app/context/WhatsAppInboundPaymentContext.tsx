"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
}

const WhatsAppInboundPaymentContext = createContext<WhatsAppInboundPaymentContextType | undefined>(undefined);

export const WhatsAppInboundPaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<WhatsAppInboundPaymentItem[]>([]);
  const [isDockOpen, setIsDockOpen] = useState(false);

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  useEffect(() => {
    const handleInvoicePaid = (data: any) => {
      if (!data) return;
      const isWa =
        data.source === "whatsapp_inbound" ||
        data.source === "whatsapp" ||
        data.changes?.source === "whatsapp_inbound" ||
        Boolean(data.matchedName);

      if (!isWa) return;

      const item: WhatsAppInboundPaymentItem = {
        id: `wa-paid-${data.invoiceId ?? Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        invoiceId: Number(data.invoiceId || data.data?.id || 0),
        fullName: String(data.fullName || data.data?.fullName || data.username || "Subscriber"),
        username: String(data.username || data.data?.username || ""),
        amount: Number(data.amount || data.paidAmount || data.data?.amountPaid || data.data?.totalAmount || 0),
        matchedName: data.matchedName || data.changes?.matchedName ? String(data.matchedName || data.changes?.matchedName) : undefined,
        from: data.from || data.changes?.from ? String(data.from || data.changes?.from) : undefined,
        timestamp: new Date().toISOString(),
      };

      setItems((prev) => [item, ...prev]);
      setIsDockOpen(true);

      notify.success(
        "WhatsApp Auto-Payment Received",
        `${item.fullName} paid $${item.amount > 0 ? item.amount.toFixed(2) : "—"} (Invoice #${item.invoiceId})`
      );
    };

    // 1. Subscribe to STOMP WebSocket
    const unsubStomp = websocketService.onNotification(handleInvoicePaid, "EXTERNAL_INVOICE_PAID");

    // 2. Also listen to native Express WebSocket broadcast
    let nativeWs: WebSocket | null = null;
    try {
      if (typeof window !== "undefined") {
        const apiUrl =
          resolveBrowserApiUrl().replace(/\/api\/?$/, "") ||
          DEFAULT_PUBLIC_API_URL.replace(/\/api\/?$/, "");
        const wsUrl = apiUrl.replace(/^http/, "ws");
        const token =
          localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken");
        nativeWs = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl);
        nativeWs.onmessage = (event) => {
          try {
            const parsed = JSON.parse(String(event.data));
            if (parsed?.type === "EXTERNAL_INVOICE_PAID") {
              handleInvoicePaid(parsed);
            }
          } catch {
            /* ignore */
          }
        };
      }
    } catch {
      /* ignore */
    }

    return () => {
      unsubStomp();
      nativeWs?.close();
    };
  }, []);

  return (
    <WhatsAppInboundPaymentContext.Provider
      value={{
        items,
        isDockOpen,
        setIsDockOpen,
        clearItems,
        removeItem,
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
