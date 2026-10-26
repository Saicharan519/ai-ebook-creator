import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../lib/api";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import { LoginPage } from "./LoginPage";

function renderLogin(login: AuthContextValue["login"], initialPath = "/login") {
  const value: AuthContextValue = {
    state: { status: "anonymous" },
    login,
    register: vi.fn(),
    logout: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      { path: "/books", element: <p>Books page</p> },
      { path: "/books/:id", element: <p>Editor page</p> },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return router;
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

    await userEvent.type(screen.getByLabelText("Email"), "Asha@Example.com");
    await userEvent.type(screen.getByLabelText("Password"), "a password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(login).toHaveBeenCalledWith({ email: "asha@example.com", password: "a password" });
    expect(await screen.findByText("Editor page")).toBeInTheDocument();
  });

  it("ignores a 'next' link that points to another site", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(login, "/login?next=%2F%2Fevil.example.com");

    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "a password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Books page")).toBeInTheDocument();
  });

  it("shows the server's message when login fails", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiRequestError(401, "UNAUTHORIZED", "Incorrect email or password"));
    renderLogin(login);

    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
  });
});
