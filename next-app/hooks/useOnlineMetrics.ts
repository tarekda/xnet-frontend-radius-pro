// src/hooks/useOnlineMetrics.ts
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

interface OnlineMetrics {
    totalOnlineUsers: number;
    totalActiveUsers: number;
}

const EMPTY_METRICS: OnlineMetrics = {
    totalOnlineUsers: 0,
    totalActiveUsers: 0,
};

/** Guard against unrelated WebSocket/HTTP payloads being applied to the metrics state. */
function isOnlineMetrics(value: unknown): value is OnlineMetrics {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return typeof v.totalOnlineUsers === "number" && typeof v.totalActiveUsers === "number";
}

/**
 * Polls `/online-users-metrics` for live session KPIs.
 *
 * Previously this hook also opened its own raw `WebSocket` and called `setMetrics(data)` for
 * every incoming frame regardless of type, so unrelated broadcasts (session updates, pongs,
 * notifications) overwrote the metrics shape. The shared `websocketService` (STOMP/RabbitMQ)
 * has no metrics topic, so polling is the reliable source of truth here.
 */
export const useOnlineMetrics = (pollMs: number = 30000) => {
    const [metrics, setMetrics] = useState<OnlineMetrics>(EMPTY_METRICS);

    useEffect(() => {
        let cancelled = false;

        const fetchMetrics = async () => {
            try {
                const response = await apiClient.get("/online-users-metrics");
                const payload = response.data?.data ?? response.data;
                if (!cancelled && isOnlineMetrics(payload)) {
                    setMetrics(payload);
                }
            } catch (error) {
                console.error("Error fetching online metrics:", error);
            }
        };

        fetchMetrics();
        const timer = window.setInterval(fetchMetrics, Math.max(5000, pollMs));

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [pollMs]);

    return metrics;
};
