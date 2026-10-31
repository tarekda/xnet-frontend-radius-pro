import axios from "axios";
import { resolveBrowserApiUrl, resolvePublicApiUrl } from "@/lib/publicEnv";
import { safeRedirectPath } from "@/lib/safeRedirect";

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
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

export function clearAuthStorage() {
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

function isSubscriberPath() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/subscriber");
}

function redirectToLogin() {
  if (isSubscriberPath()) {
    window.location.href = "/subscriber";
    return;
  }
  try {
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    if (currentPath && currentPath !== "/login") {
      localStorage.setItem("redirectTo", safeRedirectPath(currentPath));
    }
  } catch {
    /* ignore */
  }
  clearAuthStorage();
  window.location.href = "/login";
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const resp = await axios.post(
        `${apiClient.defaults.baseURL}/auth/refresh-token`,
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );
      return Boolean(resp?.data?.success);
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

let subscriberRefreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSubscriberToken(): Promise<boolean> {
  if (subscriberRefreshInFlight) return subscriberRefreshInFlight;
  subscriberRefreshInFlight = (async () => {
    try {
      const resp = await axios.post(
        `${apiClient.defaults.baseURL}/auth/subscriber/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );
      return Boolean(resp?.data?.success);
    } catch {
      return false;
    } finally {
      subscriberRefreshInFlight = null;
    }
  })();
  return subscriberRefreshInFlight;
}

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const next = resolveBrowserApiUrl();
      if (apiClient.defaults.baseURL !== next) {
        apiClient.defaults.baseURL = next;
      }
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

    if (
      typeof window !== "undefined" &&
      status === 401 &&
      original &&
      !original._retry &&
      !String(original.url || "").includes("/auth/refresh-token") &&
      !String(original.url || "").includes("/auth/subscriber/refresh") &&
      !String(original.url || "").includes("/auth/login") &&
      !String(original.url || "").includes("/auth/subscriber/login") &&
      !String(original.url || "").includes("/auth/logout")
    ) {
      original._retry = true;
      const ok = isSubscriberPath()
        ? await tryRefreshSubscriberToken()
        : await tryRefreshAccessToken();
      if (ok) {
        return apiClient(original);
      }
      if (!isSubscriberPath()) redirectToLogin();
      return Promise.reject(error);
    }

    if (typeof window !== "undefined" && status === 403) {
      const code = error.response?.data?.code;
      if (code === "MFA_ENROLLMENT_REQUIRED") {
        const path = window.location.pathname;
        if (path !== "/settings/security" && path !== "/change-password") {
          window.location.replace("/settings/security");
        }
        return Promise.reject(error);
      }
    }

    if (typeof window !== "undefined" && status === 401 && !isSubscriberPath()) {
      const url = String(original?.url || error.config?.url || "");
      if (
        !url.includes("/auth/login") &&
        !url.includes("/auth/subscriber/login") &&
        !url.includes("/auth/mobile/login") &&
        !url.includes("/auth/logout")
      ) {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);
