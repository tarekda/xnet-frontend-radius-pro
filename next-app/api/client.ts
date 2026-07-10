import axios from "axios";
import { resolveBrowserApiUrl, resolvePublicApiUrl } from "@/lib/publicEnv";

declare global {
  interface Window {
    __ENV__?: {
      API_URL?: string;
      WS_URL?: string;
      DEFAULT_NAS_IP?: string;
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

function clearAuthStorage() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("user");
  try {
    document.cookie = "xnet_auth=; path=/; max-age=0; SameSite=Lax";
  } catch {
    /* ignore */
  }
}

function redirectToLogin() {
  try {
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    if (currentPath && currentPath !== "/login") {
      localStorage.setItem("redirectTo", currentPath);
    }
  } catch {
    /* ignore */
  }
  clearAuthStorage();
  window.location.href = "/login";
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken =
    localStorage.getItem("refreshToken") ?? sessionStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const resp = await axios.post(
      `${apiClient.defaults.baseURL}/auth/refresh-token`,
      { token: refreshToken },
      { headers: { "Content-Type": "application/json" } }
    );
    const accessToken = resp?.data?.data?.accessToken as string | undefined;
    const nextRefresh = (resp?.data?.data?.refreshToken as string | undefined) ?? refreshToken;
    if (!resp?.data?.success || !accessToken) return null;

    const store = localStorage.getItem("refreshToken") ? localStorage : sessionStorage;
    store.setItem("accessToken", accessToken);
    store.setItem("refreshToken", nextRefresh);
    return accessToken;
  } catch {
    return null;
  }
}

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
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    // Attempt one refresh on 401 (expired access token). Do not retry refresh itself.
    if (
      typeof window !== "undefined" &&
      status === 401 &&
      original &&
      !original._retry &&
      !String(original.url || "").includes("/auth/refresh-token") &&
      !String(original.url || "").includes("/auth/login")
    ) {
      original._retry = true;
      const newToken = await tryRefreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
      redirectToLogin();
      return Promise.reject(error);
    }

    if (typeof window !== "undefined" && status === 401) {
      const url = String(original?.url || error.config?.url || "");
      // Failed login credentials are 401 — don't wipe session / bounce the login page.
      if (!url.includes("/auth/login") && !url.includes("/auth/mobile/login")) {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);
