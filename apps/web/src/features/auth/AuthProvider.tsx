import { authResponseSchema, type AuthResponse } from "@ebook/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  apiRequest,
  apiSend,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from "../../lib/api";
import { AuthContext, type AuthContextValue, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const signOutLocally = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setState({ status: "anonymous" });
  }, [queryClient]);

  const startSession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setState({ status: "authenticated", user: session.user });
  }, []);

  useEffect(() => {
    onSessionExpired(signOutLocally);

    // Restore the session from the refresh cookie on page load
    let cancelled = false;
    void refreshSession().then((session) => {
      if (cancelled) return;
      if (session) {
        startSession(session);
      } else {
        setState({ status: "anonymous" });
      }
    });

    return () => {
      cancelled = true;
      onSessionExpired(null);
    };
  }, [signOutLocally, startSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async login(input) {
        startSession(
          await apiRequest("/auth/login", authResponseSchema, {
            method: "POST",
            json: input,
            refreshOnUnauthorized: false,
          }),
        );
      },
      async register(input) {
        startSession(
          await apiRequest("/auth/register", authResponseSchema, {
            method: "POST",
            json: input,
            refreshOnUnauthorized: false,
          }),
        );
      },
      async logout() {
        try {
          await apiSend("/auth/logout", { method: "POST", refreshOnUnauthorized: false });
        } finally {
          signOutLocally();
        }
      },
    }),
    [state, startSession, signOutLocally],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
