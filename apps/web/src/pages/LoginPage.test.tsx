import type { LoginInput } from "@ebook/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "../features/auth/auth-context";
import { RedirectIfAuthenticated } from "../features/auth/RequireAuth";
import { ApiRequestError } from "../lib/api";
import { LoginPage } from "./LoginPage";

const user = {
  id: "0190a0b0-0000-7000-8000-000000000001",
  name: "Asha",
  email: "asha@example.com",
  createdAt: new Date().toISOString(),
};

/** A real, stateful auth context whose login is the given mock. */
function TestAuth({
  login,
  children,
}: {
  login: (input: LoginInput) => Promise<void>;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>({ status: "anonymous" });
  const value = {
    state,
    login: async (input: LoginInput) => {
      await login(input);
      setState({ status: "authenticated", user });
    },
    register: vi.fn(),
    logout: vi.fn(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Renders the same route structure as the app: login sits behind RedirectIfAuthenticated. */
function renderLogin(login: (input: LoginInput) => Promise<void>, initialPath = "/login") {
  const router = createMemoryRouter(
    [
      {
        element: <RedirectIfAuthenticated />,
        children: [{ path: "/login", element: <LoginPage /> }],
      },
      { path: "/books", element: <p>Books page</p> },
      { path: "/books/:id", element: <p>Editor page</p> },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <TestAuth login={login}>
      <RouterProvider router={router} />
    </TestAuth>,
  );
  return router;
}

async function submit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginPage", () => {
  it("shows field errors without calling the API", async () => {
    const login = vi.fn();
    renderLogin(login);

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("logs in and returns to the page the user came from", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(login, "/login?next=%2Fbooks%2Fabc");

    await submit("Asha@Example.com", "a password");

    expect(login).toHaveBeenCalledWith({ email: "asha@example.com", password: "a password" });
    expect(await screen.findByText("Editor page")).toBeInTheDocument();
  });

  it("ignores a 'next' link that points to another site", async () => {
    renderLogin(vi.fn().mockResolvedValue(undefined), "/login?next=%2F%2Fevil.example.com");

    await submit("a@example.com", "a password");

    expect(await screen.findByText("Books page")).toBeInTheDocument();
  });

  it("shows the server's message when login fails", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiRequestError(401, "UNAUTHORIZED", "Incorrect email or password"));
    renderLogin(login);

    await submit("a@example.com", "wrong password");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  });
});
