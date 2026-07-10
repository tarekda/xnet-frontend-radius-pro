import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface AnalyticsData {
  time: string;
  users: number;
  bandwidth: number;
  authSuccess: number;
  authFailed: number;
}

export interface AuthDistribution {
  name: string;
  value: number;
  color: string;
}

export interface GeographicData {
  name: string;
  users: number;
  color: string;
}

export interface PeakHoursData {
  hour: string;
  usage: number;
}

export interface AnalyticsMetrics {
  activeUsers: number;
  bandwidthUsage: string;
  authSuccessRate: number;
  failedAttempts: number;
  userGrowth: number;
  bandwidthGrowth: number;
  authRateGrowth: number;
  failedAttemptsGrowth: number;
}

const isDev = process.env.NODE_ENV === "development";

const generateMockAnalyticsData = (timeRange: string): AnalyticsData[] => {
  const now = new Date();
  const data: AnalyticsData[] = [];
  let points = 24;

  switch (timeRange) {
    case "1h":
      points = 60;
      break;
    case "7d":
      points = 168;
      break;
    case "30d":
      points = 30;
      break;
    default:
      points = 24;
  }

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * (timeRange === "1h" ? 60 * 1000 : 60 * 60 * 1000));
    data.push({
      time:
        timeRange === "1h"
          ? time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : time.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" }),
      users: Math.floor(Math.random() * 50) + 20,
      bandwidth: Math.floor(Math.random() * 100) + 50,
      authSuccess: Math.floor(Math.random() * 100) + 80,
      authFailed: Math.floor(Math.random() * 20) + 5,
    });
  }

  return data;
};

const generateMockMetrics = (): AnalyticsMetrics => ({
  activeUsers: Math.floor(Math.random() * 1000) + 500,
  bandwidthUsage: `${(Math.random() * 5 + 1).toFixed(1)} GB/s`,
  authSuccessRate: Math.floor(Math.random() * 10) + 90,
  failedAttempts: Math.floor(Math.random() * 50) + 10,
  userGrowth: Math.floor(Math.random() * 20) - 5,
  bandwidthGrowth: Math.floor(Math.random() * 20) - 5,
  authRateGrowth: Math.floor(Math.random() * 10) - 2,
  failedAttemptsGrowth: Math.floor(Math.random() * 20) - 10,
});

const fetchAnalyticsData = async (timeRange: string): Promise<AnalyticsData[]> => {
  try {
    const response = await apiClient.get<AnalyticsData[]>(`/analytics/usage?range=${timeRange}`);
    return response.data;
  } catch (error) {
    if (isDev) {
      console.warn("Using mock data for analytics:", error);
      return generateMockAnalyticsData(timeRange);
    }
    throw error;
  }
};

const fetchAnalyticsMetrics = async (): Promise<AnalyticsMetrics> => {
  try {
    const response = await apiClient.get<AnalyticsMetrics>("/analytics/metrics");
    return response.data;
  } catch (error) {
    if (isDev) {
      console.warn("Using mock data for metrics:", error);
      return generateMockMetrics();
    }
    throw error;
  }
};

const fetchAuthDistribution = async (): Promise<AuthDistribution[]> => {
  try {
    const response = await apiClient.get<AuthDistribution[]>("/analytics/auth-distribution");
    return response.data;
  } catch (error) {
    if (isDev) {
      console.warn("Using mock data for auth distribution:", error);
      return [
        { name: "Success", value: 85, color: "#10b981" },
        { name: "Failed", value: 10, color: "#ef4444" },
        { name: "Timeout", value: 5, color: "#f59e0b" },
      ];
    }
    throw error;
  }
};

const fetchGeographicData = async (): Promise<GeographicData[]> => {
  try {
    const response = await apiClient.get<GeographicData[]>("/analytics/geographic");
    return response.data;
  } catch (error) {
    if (isDev) {
      console.warn("Using mock data for geographic data:", error);
      return [
        { name: "172.9.16.1", users: 45, color: "#3b82f6" },
        { name: "172.9.16.2", users: 30, color: "#8b5cf6" },
      ];
    }
    throw error;
  }
};

const fetchPeakHoursData = async (): Promise<PeakHoursData[]> => {
  try {
    const response = await apiClient.get<PeakHoursData[]>("/analytics/peak-hours");
    return response.data;
  } catch (error) {
    if (isDev) {
      console.warn("Using mock data for peak hours:", error);
      return Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour}:00`,
        usage: Math.floor(Math.random() * 100) + (hour >= 9 && hour <= 17 ? 50 : 20),
      }));
    }
    throw error;
  }
};

export const useAnalyticsData = (timeRange: string) =>
  useQuery({
    queryKey: ["analytics", "usage", timeRange],
    queryFn: () => fetchAnalyticsData(timeRange),
    refetchInterval: 30000,
    staleTime: 10000,
  });

export const useAnalyticsMetrics = () =>
  useQuery({
    queryKey: ["analytics", "metrics"],
    queryFn: fetchAnalyticsMetrics,
    refetchInterval: 15000,
    staleTime: 5000,
  });

export const useAuthDistribution = () =>
  useQuery({
    queryKey: ["analytics", "auth-distribution"],
    queryFn: fetchAuthDistribution,
    refetchInterval: 60000,
    staleTime: 30000,
  });

export const useGeographicData = () =>
  useQuery({
    queryKey: ["analytics", "geographic"],
    queryFn: fetchGeographicData,
    refetchInterval: 300000,
    staleTime: 120000,
  });

export const usePeakHoursData = () =>
  useQuery({
    queryKey: ["analytics", "peak-hours"],
    queryFn: fetchPeakHoursData,
    refetchInterval: 600000,
    staleTime: 300000,
  });

export const formatBandwidth = (bytes: number): string => {
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;

export const getGrowthColor = (growth: number): string => {
  if (growth > 0) return "text-green-600 dark:text-green-400";
  if (growth < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
};

export const getGrowthIcon = (growth: number): "TrendingUp" | "TrendingDown" | "Minus" => {
  if (growth > 0) return "TrendingUp";
  if (growth < 0) return "TrendingDown";
  return "Minus";
};
