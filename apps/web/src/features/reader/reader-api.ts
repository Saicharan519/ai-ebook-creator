import { publicBookSchema, publicChapterSchema } from "@ebook/shared";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../lib/api";

export function usePublicBook(slug: string) {
  return useQuery({
    queryKey: ["public", slug],
    queryFn: () => apiRequest(`/public/books/${encodeURIComponent(slug)}`, publicBookSchema),
  });
}

export function usePublicChapter(slug: string, chapterId: string | null) {
  return useQuery({
    queryKey: ["public", slug, chapterId],
    queryFn: () =>
      apiRequest(
        `/public/books/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterId!)}`,
        publicChapterSchema,
      ),
    enabled: chapterId !== null,
  });
}
