import type { LoginInput, RegisterInput, User } from "@ebook/shared";
import { createContext, useContext } from "react";

export type AuthState =
  { status: "loading" } | { status: "anonymous" } | { status: "authenticated"; user: User };

export interface AuthContextValue {
  state: AuthState;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

/** The signed-in user. Only use inside routes wrapped in <RequireAuth>. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== "authenticated") {
    throw new Error("useCurrentUser called without a signed-in user");
  }
  return state.user;
}
