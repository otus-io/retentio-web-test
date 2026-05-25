import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { request, LoginRes, setAuthFailureHandler } from "@/lib/api";

const TOKEN_KEY = "wordupx_token";

interface AuthContextValue {
  token: string | null;
  /** False while validating a token restored from localStorage on first load. */
  authReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (t: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem(TOKEN_KEY));

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setToken(null);
      setAuthReady(true);
    });
    return () => setAuthFailureHandler(null);
  }, [setToken]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY) return;
      setTokenState(e.newValue);
    };
    const onFocus = () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored !== token) setTokenState(stored);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    setAuthReady(false);
    void (async () => {
      try {
        await request("/api/profile", { token });
        if (!cancelled) setAuthReady(true);
      } catch {
        if (!cancelled) setToken(null);
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setToken]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await request<LoginRes>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(res.data.token);
    } catch (e) {
      setAuthReady(true);
      throw e;
    }
  }, [setToken]);

  const logout = useCallback(async () => {
    const t = token;
    setToken(null);
    if (t) {
      try {
        await request("/auth/logout", { method: "POST", token: t });
      } catch {
        // already cleared locally
      }
    }
  }, [token, setToken]);

  const value: AuthContextValue = { token, authReady, login, logout, setToken };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
