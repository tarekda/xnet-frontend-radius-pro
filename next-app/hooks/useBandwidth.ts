import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface BandwidthData {
  interface: string;
  rxByte: number;
  txByte: number;
  rxPacket: number;
  txPacket: number;
  rxRate: number;
  txRate: number;
  timestamp: Date;
}

export interface BandwidthSummary {
  totalRxBytes: number;
  totalTxBytes: number;
  totalRxRate: number;
  totalTxRate: number;
  interfaces: BandwidthData[];
  timestamp: Date;
}

export interface BandwidthMetrics {
  bandwidth: {
    download: {
      rate: number;
      bytes: number;
      utilization: number;
    };
    upload: {
      rate: number;
      bytes: number;
      utilization: number;
    };
    total: {
      rate: number;
      bytes: number;
    };
  };
  system: {
    cpuLoad: number;
    memoryUsage: number;
    uptime: number;
  };
  interfaces: BandwidthData[];
  timestamp: Date;
}

export const useBandwidthMetrics = () => {
  return useQuery({
    queryKey: ['bandwidth', 'metrics'],
    queryFn: async (): Promise<BandwidthMetrics> => {
      const response = await apiClient.get('/bandwidth/metrics');
      return response.data.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 3,
    retryDelay: 1000,
  });
};

export const useBandwidthSummary = () => {
  return useQuery({
    queryKey: ['bandwidth', 'summary'],
    queryFn: async (): Promise<BandwidthSummary> => {
      const response = await apiClient.get('/bandwidth/summary');
      return response.data.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useInterfaceTraffic = () => {
  return useQuery({
    queryKey: ['bandwidth', 'interfaces'],
    queryFn: async (): Promise<BandwidthData[]> => {
      const response = await apiClient.get('/bandwidth/interfaces');
      return response.data.data;
    },
    refetchInterval: 5000,
    staleTime: 2000,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useSystemResources = () => {
  return useQuery({
    queryKey: ['bandwidth', 'system'],
    queryFn: async () => {
      const response = await apiClient.get('/bandwidth/system');
      return response.data.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    staleTime: 10000,
    retry: 3,
    retryDelay: 1000,
  });
};

export type HistoricalTrafficPoint = {
  timestamp?: string | number;
  rxRate?: number;
  txRate?: number;
  rxByte?: number;
  txByte?: number;
};

export const useHistoricalBandwidth = (interfaceName: string | null, durationSec = 3600) => {
  return useQuery({
    queryKey: ["bandwidth", "historical", interfaceName, durationSec],
    queryFn: async (): Promise<HistoricalTrafficPoint[]> => {
      const response = await apiClient.get("/bandwidth/historical", {
        params: { interface: interfaceName, duration: durationSec },
      });
      const raw = response.data?.data;
      return Array.isArray(raw) ? raw : raw?.points || raw?.samples || [];
    },
    enabled: Boolean(interfaceName),
    staleTime: 30_000,
    retry: 1,
  });
};

export const useBandwidthConnection = () => {
  return useQuery({
    queryKey: ['bandwidth', 'connection'],
    queryFn: async () => {
      const response = await apiClient.get('/bandwidth/test');
      return response.data.data;
    },
    refetchInterval: 30000, // Check connection every 30 seconds
    staleTime: 25000,
    retry: 2,
    retryDelay: 2000,
  });
};

// Utility functions for formatting bandwidth data
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatBitsPerSecond = (bps: number): string => {
  if (bps === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

export const bitsToMbps = (bps: number, decimals = 2): string => {
  return ((bps) / 1_000_000).toFixed(decimals);
}; 