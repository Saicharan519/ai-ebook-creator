import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Shows chapter Markdown exactly as the editor does, but read-only. Going
 * through the editor's schema (rather than injecting HTML) means raw HTML in
 * the text can never run: anything outside the schema is dropped or shown as text.
 * The content is read once, so mount with a key per chapter.
 */
export function MarkdownView({ markdown }: { markdown: string }) {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: { openOnClick: true },
      }),
      Markdown,
    ],
    content: markdown,
    contentType: "markdown",
    editorProps: { attributes: { class: "chapter-prose" } },
  });

  return <EditorContent editor={editor} />;
}
