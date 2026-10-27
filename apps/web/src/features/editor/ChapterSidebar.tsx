import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChapterSummary } from "@ebook/shared";
import { GripVertical, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { pluralize } from "../../lib/format";

interface ChapterSidebarProps {
  chapters: ChapterSummary[];
  selectedId: string | null;
  onSelect: (chapterId: string) => void;
  onAdd: () => void;
  adding: boolean;
  onDelete: (chapter: ChapterSummary) => void;
  onReorder: (chapterIds: string[]) => void;
  onPlan: () => void;
}

export function ChapterSidebar({
  chapters,
  selectedId,
  onSelect,
  onAdd,
  adding,
  onDelete,
  onReorder,
  onPlan,
}: ChapterSidebarProps) {
  const sensors = useSensors(
    // A small distance threshold so a plain click still selects the chapter
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = chapters.map((chapter) => chapter.id);
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <nav aria-label="Chapters" className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="font-serif text-base font-medium text-stone-900">Chapters</h2>
        <Button variant="ghost" size="sm" onClick={onAdd} loading={adding}>
          {!adding && <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
            {chapters.map((chapter, index) => (
              <SortableChapter
                key={chapter.id}
                chapter={chapter}
                index={index}
                selected={chapter.id === selectedId}
                canDelete={chapters.length > 1}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="border-t border-stone-200 p-3">
        <Button variant="secondary" size="sm" className="w-full justify-center" onClick={onPlan}>
          <Sparkles className="h-4 w-4 text-accent-600" />
          Plan chapters with AI
        </Button>
      </div>
    </nav>
  );
}

function SortableChapter({
  chapter,
  index,
  selected,
  canDelete,
  onSelect,
  onDelete,
}: {
  chapter: ChapterSummary;
  index: number;
  selected: boolean;
  canDelete: boolean;
  onSelect: (chapterId: string) => void;
  onDelete: (chapter: ChapterSummary) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-lg pr-1",
        selected ? "bg-accent-50" : "hover:bg-stone-100",
        isDragging && "relative z-10 bg-white shadow-md",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${chapter.title}`}
        className="cursor-grab touch-none rounded p-1 text-stone-400 hover:text-stone-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onSelect(chapter.id)}
        aria-current={selected ? "page" : undefined}
        className="min-w-0 flex-1 py-2 text-left"
      >
        <span
          className={cn(
            "block truncate text-sm",
            selected ? "font-medium text-accent-800" : "text-stone-800",
          )}
        >
          <span className="mr-1.5 text-stone-400">{index + 1}.</span>
          {chapter.title || "Untitled"}
        </span>
        <span className="block text-xs text-stone-500">{pluralize(chapter.wordCount, "word")}</span>
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(chapter)}
          aria-label={`Delete ${chapter.title}`}
          className="rounded p-1 text-stone-400 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
