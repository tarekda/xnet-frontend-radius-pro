import axios from "axios";
import { resolveBrowserApiUrl, resolvePublicApiUrl } from "@/lib/publicEnv";

declare global {
  interface Window {
    __ENV__?: {
      API_URL?: string;
      DEFAULT_NAS_IP?: string;
      DEFAULT_NAS_SECRET?: string;
      DEFAULT_NAS_COA_PORT?: string | number;
    };
  }
}

const baseURL = typeof window === "undefined" ? resolvePublicApiUrl() : resolveBrowserApiUrl();

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const next = resolveBrowserApiUrl();
      if (apiClient.defaults.baseURL !== next) {
        apiClient.defaults.baseURL = next;
      }
    }
    const token = localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        if (currentPath && currentPath !== '/login') {
          localStorage.setItem('redirectTo', currentPath);
        }
      } catch {}
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);