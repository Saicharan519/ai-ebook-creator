import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "./auth-context";
import { RequireAuth } from "./RequireAuth";

function renderAt(path: string, state: AuthState) {
  const router = createMemoryRouter(
    [
      { element: <RequireAuth />, children: [{ path: "/books", element: <p>Secret books</p> }] },
      { path: "/login", element: <p>Login page</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AuthContext.Provider value={{ state, login: vi.fn(), register: vi.fn(), logout: vi.fn() }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return router;
}

describe("RequireAuth", () => {
  it("sends anonymous visitors to login, remembering where they were going", () => {
    const router = renderAt("/books?x=1", { status: "anonymous" });

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/books?x=1")}`);
  });

  it("shows the page to signed-in users", () => {
    renderAt("/books", {
      status: "authenticated",
      user: { id: "1", name: "A", email: "a@example.com", createdAt: new Date().toISOString() },
    });

    expect(screen.getByText("Secret books")).toBeInTheDocument();
  });

  it("waits while the session is being restored", () => {
    renderAt("/books", { status: "loading" });

    expect(screen.queryByText("Secret books")).not.toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
