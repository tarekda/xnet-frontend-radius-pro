import React, { createContext, useState, useContext, useEffect } from 'react';
import { AuthUser } from '@/types/api';
import { apiClient, clearAuthStorage } from '@/api/client';
import { clearTelemetryUser, setTelemetryUser } from '@/lib/telemetry';
import { websocketService } from '@/services/websocket';

interface AuthContextType {
  isAuthenticated: boolean;
  /** Always null — access tokens live in httpOnly cookies, not JS. Kept for call-site compatibility. */
  accessToken: string | null;
  login: (user: AuthUser, _accessToken?: string | null, rememberMe?: boolean, _refreshToken?: string) => void;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Presence-only cookie (no token material) so Next.js middleware can guard
 * routes server-side. The real session is the httpOnly cookie on the API host.
 */
const AUTH_COOKIE = "xnet_auth";

const setAuthPresenceCookie = (rememberMe: boolean) => {
  if (typeof document === "undefined") return;
  const maxAge = rememberMe ? `; max-age=${60 * 60 * 24 * 30}` : "";
  document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax${maxAge}`;
};

const clearAuthPresenceCookie = () => {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
};

function readStoredUser(): { user: AuthUser | null; storage: "local" | "session" | null } {
  if (typeof window === "undefined") return { user: null, storage: null };
  const localRaw = localStorage.getItem("user");
  if (localRaw) {
    try {
      return { user: JSON.parse(localRaw) as AuthUser, storage: "local" };
    } catch {
      /* ignore */
    }
  }
  const sessionRaw = sessionStorage.getItem("user");
  if (sessionRaw) {
    try {
      return { user: JSON.parse(sessionRaw) as AuthUser, storage: "session" };
    } catch {
      /* ignore */
    }
  }
  return { user: null, storage: null };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storageFor = (rememberMe: boolean) => (rememberMe ? localStorage : sessionStorage);

  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: AuthUser | null;
    storage: "local" | "session" | null;
  }>(() => {
    const stored = readStoredUser();
    return {
      isAuthenticated: stored.user !== null,
      user: stored.user,
      storage: stored.storage,
    };
  });

  useEffect(() => {
    if (authState.isAuthenticated) {
      setAuthPresenceCookie(authState.storage !== "session");
    } else {
      clearAuthPresenceCookie();
    }
  }, [authState.isAuthenticated, authState.storage]);

  useEffect(() => {
    const u = authState.user;
    if (!authState.isAuthenticated || !u) {
      clearTelemetryUser();
      return;
    }
    setTelemetryUser({
      id: u.id,
      username: u.username,
      email: u.email,
      role: (u as any).role,
    });
  }, [authState.isAuthenticated, authState.user]);

  useEffect(() => {
    if (!authState.isAuthenticated) {
      websocketService.disconnect();
      return;
    }
    websocketService.connect();
    return () => websocketService.disconnect();
  }, [authState.isAuthenticated]);

  useEffect(() => {
    if (!authState.isAuthenticated) return;

    let cancelled = false;
    (async () => {
      try {
        const resp = await apiClient.get("/auth/profile");
        const u = resp?.data?.data as AuthUser | undefined;
        if (!u || cancelled) return;
        const merged: AuthUser = { ...(authState.user ?? ({} as any)), ...u };
        const store = authState.storage === "session" ? sessionStorage : localStorage;
        store.setItem("user", JSON.stringify(merged));
        setAuthState((prev) => ({ ...prev, user: merged }));
      } catch {
        // interceptor handles 401 → login; ignore other errors
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated]);

  const login = (user: AuthUser, _accessToken?: string | null, rememberMe: boolean = true) => {
    const store = storageFor(Boolean(rememberMe));
    const other = store === localStorage ? sessionStorage : localStorage;

    other.removeItem("accessToken");
    other.removeItem("refreshToken");
    other.removeItem("user");
    store.removeItem("accessToken");
    store.removeItem("refreshToken");
    store.setItem("user", JSON.stringify(user));
    setAuthPresenceCookie(Boolean(rememberMe));
    setAuthState({ isAuthenticated: true, user, storage: rememberMe ? "local" : "session" });
  };

  const updateUser = (patch: Partial<AuthUser>) => {
    setAuthState((prev) => {
      const merged = { ...(prev.user ?? ({} as any)), ...patch } as AuthUser;
      const store = prev.storage === "session" ? sessionStorage : localStorage;
      store.setItem("user", JSON.stringify(merged));
      return { ...prev, user: merged };
    });
  };

  const logout = () => {
    void apiClient.post("/auth/logout", {}).catch(() => undefined);
    clearAuthStorage();
    clearAuthPresenceCookie();
    setAuthState({ isAuthenticated: false, user: null, storage: null });
  };

  const value = {
    isAuthenticated: authState.isAuthenticated,
    accessToken: null,
    login,
    logout,
    updateUser,
    user: authState.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
