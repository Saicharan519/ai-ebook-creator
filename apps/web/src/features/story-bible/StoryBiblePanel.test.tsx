import type { StoryBible } from "@ebook/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoryBiblePanel } from "./StoryBiblePanel";

const id = (n: number) => `0190a0b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const ch1 = { id: id(11), position: 0, title: "Salt and Cinder" };
const ch3 = { id: id(13), position: 2, title: "Echoes" };

const bible: StoryBible = {
  status: { enabled: true, pendingChapters: 0 },
  warnings: [
    {
      id: id(1),
      entityId: id(2),
      entityName: "Elspeth Gunn",
      attribute: "eye colour",
      explanation: "Chapter 3 gives a different eye colour.",
      fact: { value: "brown", chapter: ch3 },
      conflictingFact: { value: "grey", chapter: ch1 },
    },
  ],
  entities: [
    {
      id: id(2),
      kind: "character",
      name: "Elspeth Gunn",
      aliases: ["Elspeth"],
      description: "The keeper's daughter.",
      pinned: false,
      source: "ai",
      facts: [{ id: id(3), attribute: "eye colour", value: "grey", source: "ai", chapter: ch1 }],
      appearances: [{ ...ch1, excerpt: "I climbed the tower." }],
    },
    {
      id: id(4),
      kind: "place",
      name: "Eilean Dubh",
      aliases: [],
      description: "The island.",
      pinned: true,
      source: "author",
      facts: [],
      appearances: [],
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/story-bible")) return new Response(JSON.stringify(bible));
    if (url.includes("/dismiss") && init?.method === "POST")
      return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "?" } }), {
      status: 404,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});

function renderPanel(onOpenChapter = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StoryBiblePanel bookId={id(99)} onOpenChapter={onOpenChapter} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return onOpenChapter;
}

describe("StoryBiblePanel", () => {
  it("shows contradictions with links to both chapters", async () => {
    const onOpenChapter = renderPanel();

    const warning = (await screen.findByText(/Elspeth Gunn: eye colour/)).closest("li")!;
    expect(within(warning).getByText(/“grey”/)).toBeInTheDocument();
    expect(within(warning).getByText(/“brown”/)).toBeInTheDocument();
    expect(
      within(warning).getByText("Chapter 3 gives a different eye colour."),
    ).toBeInTheDocument();

    await userEvent.click(within(warning).getByRole("button", { name: "ch. 3" }));
    expect(onOpenChapter).toHaveBeenCalledWith(ch3.id);
  });

  it("dismisses a contradiction the author intended", async () => {
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "It's intended" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/warnings/${id(1)}/dismiss`),
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.queryByText(/Elspeth Gunn: eye colour/)).not.toBeInTheDocument();
  });

  it("groups entries by kind and filters them with search", async () => {
    renderPanel();

    expect(await screen.findByText("Characters (1)")).toBeInTheDocument();
    expect(screen.getByText("Places (1)")).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search the Story Bible" }),
      "island",
    );
    expect(screen.queryByText("Characters (1)")).not.toBeInTheDocument();
    expect(screen.getByText("Eilean Dubh")).toBeInTheDocument();
  });

  it("expands an entry to show its details and where it appears", async () => {
    const onOpenChapter = renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /Elspeth Gunn/, expanded: false }),
    );

    expect(screen.getByText("Also called Elspeth")).toBeInTheDocument();
    expect(screen.getByText("“I climbed the tower.”")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ch. 1: Salt and Cinder" }));
    expect(onOpenChapter).toHaveBeenCalledWith(ch1.id);
  });
});
