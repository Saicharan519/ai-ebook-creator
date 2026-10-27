import { versionSummarySchema, type Version, type VersionSummary } from "@ebook/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPanel } from "./HistoryPanel";

const id = (n: number) => `0190a0b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const bookId = id(90);
const chapterId = id(91);

const saved: Version = {
  id: id(1),
  branchId: null,
  reason: "manual",
  label: "Opening draft",
  title: "The Gate",
  content: "The tree was gone.",
  wordCount: 4,
  createdAt: new Date().toISOString(),
};
const summaries: VersionSummary[] = [
  // Parsing drops the content, as the list endpoint does
  versionSummarySchema.parse(saved),
  {
    id: id(2),
    branchId: null,
    reason: "autosave",
    label: "",
    title: "The Gate",
    wordCount: 2,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.endsWith(`/versions/${saved.id}/restore`) && init?.method === "POST") {
      return json({
        target: "main",
        chapter: {
          id: chapterId,
          bookId,
          title: "The Gate",
          description: "",
          position: 0,
          wordCount: 4,
          content: saved.content,
          createdAt: saved.createdAt,
          updatedAt: saved.createdAt,
        },
      });
    }
    if (url.endsWith(`/versions/${saved.id}`)) return json(saved);
    if (url.endsWith("/versions") && init?.method === "POST") return json(saved, 201);
    if (url.includes("/versions")) return json(summaries);
    return json({ error: { code: "NOT_FOUND", message: "?" } }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

function renderPanel(overrides: Partial<Parameters<typeof HistoryPanel>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = {
    bookId,
    chapterId,
    branch: null,
    currentContent: "The tree was still there.",
    flushPending: vi.fn(async () => {}),
    onRestored: vi.fn(),
    onOpenBranch: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(
    <QueryClientProvider client={client}>
      <HistoryPanel {...props} />
    </QueryClientProvider>,
  );
  return props;
}

describe("HistoryPanel", () => {
  it("lists versions with their label or the reason they were taken", async () => {
    renderPanel();

    expect(await screen.findByText("Opening draft")).toBeInTheDocument();
    expect(screen.getByText("Autosave")).toBeInTheDocument();
    expect(screen.getByText(/Main text/)).toBeInTheDocument();
  });

  it("shows what changed since a version and restores it after saving pending edits", async () => {
    const props = renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: /Opening draft/ }));

    const changes = await screen.findByLabelText("Changes since this version");
    expect(within(changes).getByText("gone").tagName).toBe("DEL");
    expect(within(changes).getByText(/still there/).tagName).toBe("INS");

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(props.flushPending).toHaveBeenCalled();
    await vi.waitFor(() => expect(props.onRestored).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/versions/${saved.id}/restore`),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("saves a labelled version of the branch being edited", async () => {
    const props = renderPanel({ branch: { id: id(5), name: "Darker ending" } });

    expect(screen.getByText(/Darker ending/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Save a version/), "Before the big rewrite");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.flushPending).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/versions$/),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/versions") && init?.method === "POST",
    )!;
    expect(JSON.parse(String(init.body))).toEqual({
      reason: "manual",
      label: "Before the big rewrite",
      branchId: id(5),
    });
  });
});
