import {
  bookSchema,
  bookSummarySchema,
  chapterSchema,
  chapterSummarySchema,
  type Book,
  type Chapter,
  type CreateBookInput,
  type UpdateBookInput,
  type UpdateChapterInput,
} from "@ebook/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiRequest, apiSend } from "../../lib/api";

export const bookKeys = {
  all: ["books"] as const,
  detail: (bookId: string) => ["books", bookId] as const,
  chapter: (bookId: string, chapterId: string) => ["books", bookId, "chapters", chapterId] as const,
};

export function useBooks() {
  return useQuery({
    queryKey: bookKeys.all,
    queryFn: () => apiRequest("/books", bookSummarySchema.array()),
  });
}

export function useBook(bookId: string) {
  return useQuery({
    queryKey: bookKeys.detail(bookId),
    queryFn: () => apiRequest(`/books/${bookId}`, bookSchema),
  });
}

export function useChapter(bookId: string, chapterId: string | null) {
  return useQuery({
    queryKey: bookKeys.chapter(bookId, chapterId ?? ""),
    queryFn: () => apiRequest(`/books/${bookId}/chapters/${chapterId}`, chapterSchema),
    enabled: chapterId !== null,
    // The editor writes every change into this cache entry, so it's never stale
    staleTime: Infinity,
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) =>
      apiRequest("/books", bookSchema, { method: "POST", json: input }),
    onSuccess: (book) => {
      queryClient.setQueryData(bookKeys.detail(book.id), book);
      void queryClient.invalidateQueries({ queryKey: bookKeys.all, exact: true });
    },
  });
}

/** Caches a fresh copy of a book and refreshes the dashboard list. */
function storeBook(queryClient: QueryClient, book: Book) {
  queryClient.setQueryData(bookKeys.detail(book.id), book);
  void queryClient.invalidateQueries({ queryKey: bookKeys.all, exact: true });
}

export function useUpdateBook(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBookInput) =>
      apiRequest(`/books/${bookId}`, bookSchema, { method: "PATCH", json: input }),
    onSuccess: (book) => storeBook(queryClient, book),
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => apiSend(`/books/${bookId}`, { method: "DELETE" }),
    onSuccess: (_result, bookId) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(bookId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.all, exact: true });
    },
  });
}

export function usePublishBook(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publish: boolean) =>
      apiRequest(`/books/${bookId}/publish`, bookSchema, {
        method: publish ? "POST" : "DELETE",
      }),
    onSuccess: (book) => storeBook(queryClient, book),
  });
}

export function useUploadCover(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("cover", file);
      return apiRequest(`/books/${bookId}/cover`, bookSchema, { method: "PUT", body });
    },
    onSuccess: (book) => storeBook(queryClient, book),
  });
}

export function useRemoveCover(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest(`/books/${bookId}/cover`, bookSchema, { method: "DELETE" }),
    onSuccess: (book) => storeBook(queryClient, book),
  });
}

export function useCreateChapter(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/books/${bookId}/chapters`, chapterSchema, { method: "POST", json: {} }),
    onSuccess: (chapter) => {
      queryClient.setQueryData(bookKeys.chapter(bookId, chapter.id), chapter);
      void queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId), exact: true });
    },
  });
}

export function useDeleteChapter(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) =>
      apiSend(`/books/${bookId}/chapters/${chapterId}`, { method: "DELETE" }),
    onSuccess: (_result, chapterId) => {
      queryClient.removeQueries({ queryKey: bookKeys.chapter(bookId, chapterId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId), exact: true });
    },
  });
}

/** Reorders immediately in the UI, then rolls back if the server rejects it. */
export function useReorderChapters(bookId: string) {
  const queryClient = useQueryClient();
  const key = bookKeys.detail(bookId);

  return useMutation({
    mutationFn: (chapterIds: string[]) =>
      apiRequest(`/books/${bookId}/chapters/order`, chapterSummarySchema.array(), {
        method: "PATCH",
        json: { chapterIds },
      }),
    onMutate: async (chapterIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Book>(key);
      if (previous) {
        const byId = new Map(previous.chapters.map((chapter) => [chapter.id, chapter]));
        queryClient.setQueryData<Book>(key, {
          ...previous,
          chapters: chapterIds.map((id, position) => ({ ...byId.get(id)!, position })),
        });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key, exact: true }),
  });
}

/** Saves chapter edits and updates the cached book so the sidebar shows new titles and counts. */
export async function saveChapter(
  queryClient: QueryClient,
  bookId: string,
  chapterId: string,
  input: UpdateChapterInput,
): Promise<Chapter> {
  const chapter = await apiRequest(`/books/${bookId}/chapters/${chapterId}`, chapterSchema, {
    method: "PATCH",
    json: input,
  });

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
  return chapter;
}
