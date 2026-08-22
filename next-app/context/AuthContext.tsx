import React, { createContext, useState, useContext, useEffect } from 'react';
import { AuthUser } from '@/types/api';
import { apiClient } from '@/api/client';
import { clearTelemetryUser, setTelemetryUser } from '@/lib/telemetry';

interface AuthContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (user: AuthUser, accessToken: string, rememberMe?: boolean, refreshToken?: string) => void;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Presence-only cookie (no token material) so Next.js middleware can guard
 * routes server-side and avoid flashing protected pages before redirect.
 * The real authorization is still enforced by the backend on every API call.
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getStoredAuth = (): { accessToken: string | null; user: AuthUser | null; storage: "local" | "session" | null } => {
    if (typeof window === "undefined") {
      return { accessToken: null, user: null, storage: null };
    }
    const localToken = localStorage.getItem("accessToken");
    const sessionToken = sessionStorage.getItem("accessToken");
    const storage: "local" | "session" | null = localToken ? "local" : sessionToken ? "session" : null;
    const token = localToken ?? sessionToken ?? null;
    const userRaw =
      storage === "local"
        ? localStorage.getItem("user")
        : storage === "session"
          ? sessionStorage.getItem("user")
          : null;
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
    return { accessToken: token, user, storage };
  };

  const storageFor = (rememberMe: boolean) => (rememberMe ? localStorage : sessionStorage);

  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    accessToken: string | null;
    user: AuthUser | null;
    storage: "local" | "session" | null;
  }>(() => {
    const stored = getStoredAuth();
    return {
      isAuthenticated: stored.accessToken !== null,
      accessToken: stored.accessToken,
      user: stored.user,
      storage: stored.storage,
    };
  });

  // Keep the middleware presence cookie in sync with the stored session
  // (covers sessions that existed before the cookie was introduced).
  useEffect(() => {
    if (authState.isAuthenticated) {
      setAuthPresenceCookie(authState.storage !== "session");
    } else {
      clearAuthPresenceCookie();
    }
  }, [authState.isAuthenticated, authState.storage]);

  // Attach user context to telemetry (Sentry), if enabled.
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

  // Keep permissions in sync with the server (new role grants after migrations).
  useEffect(() => {
    if (!authState.accessToken) return;

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
        // ignore; UI will treat as no permissions and backend will still enforce
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.accessToken]);

  const login = (user: AuthUser, accessToken: string, rememberMe: boolean = true, refreshToken?: string) => {
    const store = storageFor(Boolean(rememberMe));
    const other = store === localStorage ? sessionStorage : localStorage;

    // Ensure we don't keep stale auth in the other storage
    other.removeItem("accessToken");
    other.removeItem("refreshToken");
    other.removeItem("user");

    store.setItem("accessToken", accessToken);
    if (refreshToken) store.setItem("refreshToken", refreshToken);
    store.setItem("user", JSON.stringify(user));
    setAuthPresenceCookie(Boolean(rememberMe));
    setAuthState({ isAuthenticated: true, accessToken, user: user, storage: rememberMe ? "local" : "session" });
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
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
    clearAuthPresenceCookie();
    setAuthState({ isAuthenticated: false, accessToken: null, user: null, storage: null });
  };

  const value = {
    isAuthenticated: authState.isAuthenticated,
    accessToken: authState.accessToken,
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