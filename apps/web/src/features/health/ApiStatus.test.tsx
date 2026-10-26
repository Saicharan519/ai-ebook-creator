import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiStatus } from "./ApiStatus";

function renderWithQuery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApiStatus />
    </QueryClientProvider>,
  );
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("ApiStatus", () => {
  it("shows online when the API and database are up", async () => {
    mockFetch(200, {
      status: "ok",
      database: "up",
      uptimeSeconds: 5,
      timestamp: new Date().toISOString(),
    });
    renderWithQuery();

    expect(await screen.findByText("API and database online")).toBeInTheDocument();
  });

  it("shows when the database is down", async () => {
    mockFetch(503, {
      status: "degraded",
      database: "down",
      uptimeSeconds: 5,
      timestamp: new Date().toISOString(),
    });
    renderWithQuery();

    expect(await screen.findByText("API online, database down")).toBeInTheDocument();
  });

  it("shows unreachable when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    renderWithQuery();

    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
  });

  it("treats a response that breaks the contract as an error", async () => {
    mockFetch(200, { status: "fine" });
    renderWithQuery();

    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
  });
});
