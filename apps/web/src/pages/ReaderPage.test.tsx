import type { PublicBook, PublicChapter } from "@ebook/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderPage } from "./ReaderPage";

const id = (n: number) => `0190a0b0-0000-7000-8000-${String(n).padStart(12, "0")}`;

const book: PublicBook = {
  slug: "the-glass-orchard-abc12345",
  title: "The Glass Orchard",
  subtitle: "",
  author: "Mira Vale",
  genre: "Fantasy",
  coverUrl: null,
  publishedAt: "2026-10-27T10:00:00.000Z",
  wordCount: 12,
  chapters: [
    { id: id(1), title: "The Gate", wordCount: 5 },
    { id: id(2), title: "The Tree", wordCount: 7 },
  ],
};

const chapter: PublicChapter = {
  id: id(2),
  title: "The Tree",
  number: 2,
  content: "The tree was **gone**.\n\n<img src=x onerror=alert(1)>",
  previous: { id: id(1), title: "The Gate" },
  next: null,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith(`/public/books/${book.slug}`)) return new Response(JSON.stringify(book));
      if (url.endsWith(`/chapters/${chapter.id}`)) return new Response(JSON.stringify(chapter));
      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }), {
        status: 404,
      });
    }),
  );
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/read/:slug/:chapterId?", element: <ReaderPage /> }],
    {
      initialEntries: [path],
    },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("ReaderPage", () => {
  it("shows the book with its contents", async () => {
    renderAt(`/read/${book.slug}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "The Glass Orchard" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 chapters · 12 words/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start reading" })).toHaveAttribute(
      "href",
      `/read/${book.slug}/${id(1)}`,
    );
    expect(screen.getByRole("link", { name: /The Tree/ })).toHaveAttribute(
      "href",
      `/read/${book.slug}/${id(2)}`,
    );
  });

  it("renders a chapter's Markdown without running raw HTML, with links to its neighbours", async () => {
    renderAt(`/read/${book.slug}/${chapter.id}`);

    expect(await screen.findByText("Chapter 2")).toBeInTheDocument();
    expect(await screen.findByText("gone")).toHaveProperty("tagName", "STRONG");
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: /Previous\s*The Gate/ })).toHaveAttribute(
      "href",
      `/read/${book.slug}/${id(1)}`,
    );
  });

  it("explains when a book isn't available", async () => {
    renderAt("/read/unpublished-book-00000000");

    expect(await screen.findByText("This book isn't available")).toBeInTheDocument();
  });
});
