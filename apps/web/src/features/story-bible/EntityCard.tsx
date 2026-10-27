import type { StoryEntity } from "@ebook/shared";
import { ChevronRight, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { errorMessage } from "../../lib/form-errors";
import { useAddFact, useDeleteEntity, useDeleteFact, useUpdateEntity } from "./story-bible-api";

interface EntityCardProps {
  bookId: string;
  entity: StoryEntity;
  onOpenChapter: (chapterId: string) => void;
}

const inputClass =
  "w-full rounded-md border border-stone-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none";

export function EntityCard({ bookId, entity, onOpenChapter }: EntityCardProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingFact, setAddingFact] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useUpdateEntity(bookId);
  const remove = useDeleteEntity(bookId);
  const addFact = useAddFact(bookId);
  const deleteFact = useDeleteFact(bookId);

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate(
      {
        id: entity.id,
        name: String(form.get("name")).trim(),
        description: String(form.get("description")).trim(),
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleAddFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attribute = String(form.get("attribute")).trim();
    const value = String(form.get("value")).trim();
    if (!attribute || !value) return;
    addFact.mutate(
      { entityId: entity.id, attribute, value },
      { onSuccess: () => setAddingFact(false) },
    );
  }

  const error = update.error ?? remove.error ?? addFact.error ?? deleteFact.error;

  return (
    <li className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left"
        >
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 text-stone-400 transition", open && "rotate-90")}
          />
          <span className="truncate text-sm font-medium text-stone-900">{entity.name}</span>
          {entity.source === "author" && (
            <span className="rounded bg-stone-100 px-1 text-[10px] text-stone-500 uppercase">
              yours
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => update.mutate({ id: entity.id, pinned: !entity.pinned })}
          aria-label={entity.pinned ? `Unpin ${entity.name}` : `Pin ${entity.name}`}
          title={
            entity.pinned ? "Pinned: always given to the AI" : "Pin: always give this to the AI"
          }
          className={cn(
            "rounded p-1",
            entity.pinned ? "text-violet-600" : "text-stone-300 hover:text-stone-500",
          )}
        >
          {entity.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-stone-100 px-3 py-2.5 text-sm">
          {editing ? (
            <form onSubmit={handleEdit} className="space-y-2">
              <input
                name="name"
                defaultValue={entity.name}
                aria-label="Name"
                required
                maxLength={100}
                className={inputClass}
              />
              <textarea
                name="description"
                defaultValue={entity.description}
                aria-label="Description"
                maxLength={500}
                rows={3}
                className={inputClass}
              />
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={update.isPending}>
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <>
              {entity.description && <p className="text-stone-700">{entity.description}</p>}
              {entity.aliases.length > 0 && (
                <p className="text-xs text-stone-500">Also called {entity.aliases.join(", ")}</p>
              )}
            </>
          )}

          <div>
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
              Details
            </h4>
            {entity.facts.length === 0 && <p className="text-xs text-stone-400">None yet</p>}
            <ul className="space-y-0.5">
              {entity.facts.map((fact) => (
                <li key={fact.id} className="group flex items-start gap-1 text-stone-700">
                  <span className="flex-1">
                    <span className="text-stone-500">{fact.attribute}:</span> {fact.value}
                    <span className="ml-1 text-xs text-stone-400">
                      {fact.chapter ? `ch. ${fact.chapter.position + 1}` : "yours"}
                    </span>
                  </span>
                  {fact.source === "author" && (
                    <button
                      type="button"
                      onClick={() => deleteFact.mutate({ entityId: entity.id, factId: fact.id })}
                      aria-label={`Remove ${fact.attribute}`}
                      className="rounded p-0.5 text-stone-300 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {addingFact ? (
              <form onSubmit={handleAddFact} className="mt-1.5 flex gap-1">
                <input
                  name="attribute"
                  placeholder="Detail, e.g. age"
                  aria-label="Detail"
                  maxLength={60}
                  className={inputClass}
                  autoFocus
                />
                <input
                  name="value"
                  placeholder="Value"
                  aria-label="Value"
                  maxLength={200}
                  className={inputClass}
                />
                <Button type="submit" size="sm" loading={addFact.isPending}>
                  Add
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingFact(true)}
                className="mt-1 flex items-center gap-1 text-xs text-violet-700 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add a detail
              </button>
            )}
          </div>

          {entity.appearances.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                Appears in
              </h4>
              <ul className="space-y-1">
                {entity.appearances.map((appearance) => (
                  <li key={appearance.id}>
                    <button
                      type="button"
                      onClick={() => onOpenChapter(appearance.id)}
                      className="text-left text-xs text-violet-700 hover:underline"
                    >
                      Ch. {appearance.position + 1}: {appearance.title}
                    </button>
                    {appearance.excerpt && (
                      <p className="text-xs text-stone-500 italic">“{appearance.excerpt}”</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {errorMessage(error)}
            </p>
          )}

          <div className="flex justify-end gap-1 border-t border-stone-100 pt-2">
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {confirmDelete ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={remove.isPending}
                  onClick={() => remove.mutate(entity.id)}
                >
                  Delete entry
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
