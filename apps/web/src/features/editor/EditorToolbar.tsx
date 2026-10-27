import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and the selection) in the editor when clicking a button
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 transition-colors disabled:opacity-40",
        active ? "bg-accent-100 text-accent-700" : "text-stone-600 hover:bg-stone-100",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  // Re-renders only when one of these values changes, not on every keystroke
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const divider = <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden="true" />;

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-1"
    >
      <ToolbarButton
        icon={Bold}
        label="Bold"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="Italic"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      {divider}
      <ToolbarButton
        icon={Heading2}
        label="Heading"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={Heading3}
        label="Subheading"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      {divider}
      <ToolbarButton
        icon={List}
        label="Bulleted list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label="Quote"
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={Minus}
        label="Scene break"
        onClick={() => chain().setHorizontalRule().run()}
      />
      {divider}
      <ToolbarButton
        icon={Undo2}
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}
