import { INLINE_ACTION_LABELS, type InlineAction } from "@ebook/shared";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Sparkles } from "lucide-react";

const ACTIONS: InlineAction[] = ["rewrite", "expand", "shorten", "show"];
const TONES = ["tense", "playful", "melancholy", "warm", "formal", "eerie"];

/** Appears above selected text with AI actions for that selection. */
export function AiSelectionMenu({
  editor,
  onAction,
}: {
  editor: Editor;
  onAction: (action: InlineAction, tone?: string) => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor, state }) => editor.isEditable && !state.selection.empty}
    >
      <div
        role="toolbar"
        aria-label="AI actions for the selected text"
        className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-1 text-sm shadow-lg"
      >
        <Sparkles className="mx-1 h-4 w-4 text-violet-600" aria-hidden="true" />
        {ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onAction(action)}
            className="rounded-md px-2 py-1 whitespace-nowrap text-stone-700 hover:bg-violet-50 hover:text-violet-800"
          >
            {INLINE_ACTION_LABELS[action]}
          </button>
        ))}
        <select
          aria-label="Change tone"
          value=""
          onChange={(event) => onAction("tone", event.target.value)}
          className="rounded-md bg-transparent px-1 py-1 text-stone-700 hover:bg-violet-50"
        >
          <option value="" disabled>
            Tone…
          </option>
          {TONES.map((tone) => (
            <option key={tone} value={tone}>
              {tone[0]!.toUpperCase() + tone.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </BubbleMenu>
  );
}
