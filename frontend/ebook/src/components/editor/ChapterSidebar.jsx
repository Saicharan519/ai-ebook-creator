import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Trash2, Plus, GripVertical } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import Button from "../ui/Button";

const SortableItem = ({
  chapter,
  index,
  selectedChapterIndex,
  onSelectChapter,
  onDeleteChapter,
  onGenerateChapterContent,
  isGenerating,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: chapter._id || `new-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden"
    >
      <Button
        className={`flex-1 flex items-center p-3 text-sm rounded-l-lg text-left transition-colors ${
          selectedChapterIndex === index
            ? "bg-violet-50/50 text-violet-700 font-semibold"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        onClick={() => onSelectChapter(index)}
      >
        <GripVertical
          className="w-4 h-4 text-slate-400 mr-2 cursor-grab"
          {...listeners}
          {...attributes}
        />
        <span className="truncate">
          {chapter.title || "Untitled Chapter"}
        </span>
      </Button>

      <div className="flex items-center ml-2 bg-white opacity-0 group-hover:opacity-100 transition-opacity px-2 py-3 absolute right-0">
        <Button
          variant="ghost"
          size="small"
          className="py-2 px-2"
          onClick={() => onGenerateChapterContent(index)}
          isLoading={isGenerating === index}
          title="Generate content with AI"
        >
          {isGenerating !== index && (
            <Sparkles className="w-3.5 h-3.5 text-violet-800" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="small"
          className="py-2 px-2"
          onClick={() => onDeleteChapter(index)}
          title="Delete chapter"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
};

const ChapterSidebar = ({
  book,
  selectedChapterIndex,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onGenerateChapterContent,
  isGenerating,
  onReorderChapters,
}) => {
  const navigate = useNavigate();

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = book.chapters.findIndex(
        (c, i) => (c._id || `new-${i}`) === active.id
      );
      const newIndex = book.chapters.findIndex(
        (c, i) => (c._id || `new-${i}`) === over.id
      );
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderChapters(oldIndex, newIndex);
      }
    }
  };

  const chapterIds = book.chapters.map((c, i) => c._id || `new-${i}`);

  return (
    <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </button>
        <h2 className="font-bold text-gray-900 truncate" title={book.title}>
          {book.title || "Untitled Book"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Chapters ({book.chapters.length})
          </span>
          <Button variant="ghost" size="small" onClick={onAddChapter}>
            <Plus className="w-4 h-4 text-violet-600" />
          </Button>
        </div>

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapterIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {book.chapters.map((chapter, index) => (
                <SortableItem
                  key={chapterIds[index]}
                  chapter={chapter}
                  index={index}
                  selectedChapterIndex={selectedChapterIndex}
                  onSelectChapter={onSelectChapter}
                  onDeleteChapter={onDeleteChapter}
                  onGenerateChapterContent={onGenerateChapterContent}
                  isGenerating={isGenerating}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};

export default ChapterSidebar;