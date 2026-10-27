import {
  branchSchema,
  branchSummarySchema,
  chapterSchema,
  restoreResultSchema,
  versionSchema,
  versionSummarySchema,
  type Book,
  type Branch,
  type Chapter,
  type CreateBranchInput,
  type CreateVersionInput,
} from "@ebook/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiRequest, apiSend } from "../../lib/api";
import { bookKeys } from "../books/books-api";

const chapterPath = (bookId: string, chapterId: string) => `/books/${bookId}/chapters/${chapterId}`;

export const versionKeys = {
  /** Everything for one chapter, for invalidating after a change */
  chapter: (bookId: string, chapterId: string) => ["versions", bookId, chapterId] as const,
  list: (bookId: string, chapterId: string, branchId: string | null) =>
    ["versions", bookId, chapterId, "list", branchId ?? "main"] as const,
  detail: (bookId: string, chapterId: string, versionId: string) =>
    ["versions", bookId, chapterId, "detail", versionId] as const,
  branches: (bookId: string, chapterId: string) => ["branches", bookId, chapterId] as const,
  branch: (bookId: string, chapterId: string, branchId: string) =>
    ["branches", bookId, chapterId, branchId] as const,
};

export function useVersions(bookId: string, chapterId: string, branchId: string | null) {
  return useQuery({
    queryKey: versionKeys.list(bookId, chapterId, branchId),
    queryFn: () =>
      apiRequest(
        `${chapterPath(bookId, chapterId)}/versions${branchId ? `?branchId=${branchId}` : ""}`,
        versionSummarySchema.array(),
      ),
  });
}

export function useVersion(bookId: string, chapterId: string, versionId: string | null) {
  return useQuery({
    queryKey: versionKeys.detail(bookId, chapterId, versionId ?? ""),
    queryFn: () =>
      apiRequest(`${chapterPath(bookId, chapterId)}/versions/${versionId}`, versionSchema),
    enabled: versionId !== null,
    // A version never changes once taken
    staleTime: Infinity,
  });
}

/** Saves a copy of the current text. Identical text isn't saved twice. */
export async function saveVersion(
  queryClient: QueryClient,
  bookId: string,
  chapterId: string,
  input: CreateVersionInput,
) {
  const version = await apiRequest(`${chapterPath(bookId, chapterId)}/versions`, versionSchema, {
    method: "POST",
    json: input,
  });
  void queryClient.invalidateQueries({ queryKey: versionKeys.chapter(bookId, chapterId) });
  return version;
}

export function useSaveVersion(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVersionInput) => saveVersion(queryClient, bookId, chapterId, input),
  });
}

/** Caches the chapter and refreshes its title and word count in the book's chapter list. */
export function storeChapter(queryClient: QueryClient, bookId: string, chapter: Chapter) {
  queryClient.setQueryData(bookKeys.chapter(bookId, chapter.id), chapter);
  queryClient.setQueryData<Book>(bookKeys.detail(bookId), (book) =>
    book
      ? {
          ...book,
          chapters: book.chapters.map((summary) =>
            summary.id === chapter.id
              ? { ...summary, title: chapter.title, wordCount: chapter.wordCount }
              : summary,
          ),
        }
      : book,
  );
  void queryClient.invalidateQueries({ queryKey: bookKeys.all, exact: true });
}

export function useRestoreVersion(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      apiRequest(
        `${chapterPath(bookId, chapterId)}/versions/${versionId}/restore`,
        restoreResultSchema,
        { method: "POST" },
      ),
    onSuccess: (result) => {
      if (result.target === "main") {
        storeChapter(queryClient, bookId, result.chapter);
      } else {
        queryClient.setQueryData(
          versionKeys.branch(bookId, chapterId, result.branch.id),
          result.branch,
        );
        void queryClient.invalidateQueries({ queryKey: versionKeys.branches(bookId, chapterId) });
      }
      void queryClient.invalidateQueries({ queryKey: versionKeys.chapter(bookId, chapterId) });
    },
  });
}

// ---- Branches ----

export function useBranches(bookId: string, chapterId: string | null) {
  return useQuery({
    queryKey: versionKeys.branches(bookId, chapterId ?? ""),
    queryFn: () =>
      apiRequest(`${chapterPath(bookId, chapterId!)}/branches`, branchSummarySchema.array()),
    enabled: chapterId !== null,
  });
}

export function useBranch(bookId: string, chapterId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: versionKeys.branch(bookId, chapterId ?? "", branchId ?? ""),
    queryFn: () =>
      apiRequest(`${chapterPath(bookId, chapterId!)}/branches/${branchId}`, branchSchema),
    enabled: chapterId !== null && branchId !== null,
    // The editor writes every change into this cache entry, so it's never stale
    staleTime: Infinity,
  });
}

export function useCreateBranch(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchInput) =>
      apiRequest(`${chapterPath(bookId, chapterId)}/branches`, branchSchema, {
        method: "POST",
        json: input,
      }),
    onSuccess: (branch) => {
      queryClient.setQueryData(versionKeys.branch(bookId, chapterId, branch.id), branch);
      void queryClient.invalidateQueries({ queryKey: versionKeys.branches(bookId, chapterId) });
    },
  });
}

/** Autosave for a branch: only its text changes; the title belongs to the chapter. */
export async function saveBranch(
  queryClient: QueryClient,
  bookId: string,
  chapterId: string,
  branchId: string,
  content: string,
): Promise<Branch> {
  const branch = await apiRequest(
    `${chapterPath(bookId, chapterId)}/branches/${branchId}`,
    branchSchema,
    { method: "PATCH", json: { content } },
  );
  void queryClient.invalidateQueries({
    queryKey: versionKeys.branches(bookId, chapterId),
    exact: true,
  });
  return branch;
}

export function useKeepBranch(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      apiRequest(`${chapterPath(bookId, chapterId)}/branches/${branchId}/keep`, chapterSchema, {
        method: "POST",
      }),
    onSuccess: (chapter, branchId) => {
      storeChapter(queryClient, bookId, chapter);
      queryClient.removeQueries({ queryKey: versionKeys.branch(bookId, chapterId, branchId) });
      void queryClient.invalidateQueries({ queryKey: versionKeys.branches(bookId, chapterId) });
      void queryClient.invalidateQueries({ queryKey: versionKeys.chapter(bookId, chapterId) });
    },
  });
}

export function useDeleteBranch(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      apiSend(`${chapterPath(bookId, chapterId)}/branches/${branchId}`, { method: "DELETE" }),
    onSuccess: (_result, branchId) => {
      queryClient.removeQueries({ queryKey: versionKeys.branch(bookId, chapterId, branchId) });
      void queryClient.invalidateQueries({ queryKey: versionKeys.branches(bookId, chapterId) });
    },
  });
}
