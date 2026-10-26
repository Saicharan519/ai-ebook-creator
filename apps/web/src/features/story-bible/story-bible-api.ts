import {
  storyBibleSchema,
  storyEntitySchema,
  type CreateEntityInput,
  type CreateFactInput,
  type StoryBible,
  type StoryEntity,
  type UpdateEntityInput,
} from "@ebook/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, apiSend } from "../../lib/api";

export const storyBibleKey = (bookId: string) => ["books", bookId, "story-bible"] as const;

/** Polls faster while chapters are still being read, so new entries show up soon. */
export function useStoryBible(bookId: string, enabled: boolean) {
  return useQuery({
    queryKey: storyBibleKey(bookId),
    queryFn: () => apiRequest(`/books/${bookId}/story-bible`, storyBibleSchema),
    enabled,
    refetchInterval: (query) => (query.state.data?.status.pendingChapters ? 5_000 : 30_000),
  });
}

/** Replaces one entity in the cached Story Bible after it changes. */
function useStoreEntity(bookId: string) {
  const queryClient = useQueryClient();
  return (entity: StoryEntity) =>
    queryClient.setQueryData<StoryBible>(storyBibleKey(bookId), (bible) =>
      bible
        ? {
            ...bible,
            entities: bible.entities.some((e) => e.id === entity.id)
              ? bible.entities.map((e) => (e.id === entity.id ? entity : e))
              : [...bible.entities, entity].sort((a, b) => a.name.localeCompare(b.name)),
          }
        : bible,
    );
}

export function useCreateEntity(bookId: string) {
  const store = useStoreEntity(bookId);
  return useMutation({
    mutationFn: (input: CreateEntityInput) =>
      apiRequest(`/books/${bookId}/entities`, storyEntitySchema, { method: "POST", json: input }),
    onSuccess: store,
  });
}

export function useUpdateEntity(bookId: string) {
  const store = useStoreEntity(bookId);
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateEntityInput & { id: string }) =>
      apiRequest(`/books/${bookId}/entities/${id}`, storyEntitySchema, {
        method: "PATCH",
        json: input,
      }),
    onSuccess: store,
  });
}

export function useDeleteEntity(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string) =>
      apiSend(`/books/${bookId}/entities/${entityId}`, { method: "DELETE" }),
    onSuccess: (_result, entityId) =>
      queryClient.setQueryData<StoryBible>(storyBibleKey(bookId), (bible) =>
        bible
          ? {
              ...bible,
              entities: bible.entities.filter((e) => e.id !== entityId),
              warnings: bible.warnings.filter((w) => w.entityId !== entityId),
            }
          : bible,
      ),
  });
}

export function useAddFact(bookId: string) {
  const store = useStoreEntity(bookId);
  return useMutation({
    mutationFn: ({ entityId, ...input }: CreateFactInput & { entityId: string }) =>
      apiRequest(`/books/${bookId}/entities/${entityId}/facts`, storyEntitySchema, {
        method: "POST",
        json: input,
      }),
    onSuccess: store,
  });
}

export function useDeleteFact(bookId: string) {
  const store = useStoreEntity(bookId);
  return useMutation({
    mutationFn: ({ entityId, factId }: { entityId: string; factId: string }) =>
      apiRequest(`/books/${bookId}/entities/${entityId}/facts/${factId}`, storyEntitySchema, {
        method: "DELETE",
      }),
    onSuccess: store,
  });
}

export function useDismissWarning(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (warningId: string) =>
      apiSend(`/books/${bookId}/warnings/${warningId}/dismiss`, { method: "POST" }),
    onSuccess: (_result, warningId) =>
      queryClient.setQueryData<StoryBible>(storyBibleKey(bookId), (bible) =>
        bible ? { ...bible, warnings: bible.warnings.filter((w) => w.id !== warningId) } : bible,
      ),
  });
}

export function useRefreshMemory(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/books/${bookId}/memory/refresh`, z.object({ queued: z.int() }), {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: storyBibleKey(bookId) }),
  });
}
