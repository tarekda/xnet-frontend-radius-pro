import { useEffect } from "react";
import { DEFAULT_PUBLIC_API_URL, resolveBrowserApiUrl } from "@/lib/publicEnv";

/**
 * When the backend auto-marks an external invoice paid (e.g. WhatsApp group webhook),
 * invalidate the table via WebSocket push.
 */
export function useExternalInvoiceRealtimeSync(onPaid?: () => void) {
  useEffect(() => {
    if (!onPaid || typeof window === "undefined") return undefined;

    const apiUrl =
      resolveBrowserApiUrl().replace(/\/api\/?$/, "") ||
      DEFAULT_PUBLIC_API_URL.replace(/\/api\/?$/, "");
    const wsUrl = apiUrl.replace(/^http/, "ws");
    const token =
      localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken");
    const ws = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message?.type === "EXTERNAL_INVOICE_PAID" || message?.type === "WHATSAPP_PAYMENT_AMBIGUITY") {
          onPaid();
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
    };
  }, [onPaid]);
}
