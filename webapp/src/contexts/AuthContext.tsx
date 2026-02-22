import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { request, LoginRes } from "@/lib/api";

const TOKEN_KEY = "wordupx_token";

interface AuthContextValue {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (t: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await request<LoginRes>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(res.data.token);
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

  const value: AuthContextValue = { token, login, logout, setToken };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
