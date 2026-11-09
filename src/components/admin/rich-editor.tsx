"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import type { RichTextDoc } from "@/db/schema";
import { toEmbed } from "@/lib/embeds";
import { mediaUrl } from "@/lib/media";
import { MediaPicker } from "./media-picker";

/** Pull quote: a styled quote block with an optional attribution. */
const PullQuote = Node.create({
  name: "pullQuote",
  group: "block",
  content: "paragraph+",
  defining: true,
  addAttributes() {
    return { attribution: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "figure[data-pull-quote]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-pull-quote": "", class: "pull-quote" }), ["blockquote", 0]];
  },
});

/** Video/content embed from an approved provider. Rendered as a placeholder box while editing. */
const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { provider: { default: null }, url: { default: null }, title: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-embed]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-embed": "", class: "embed-node" }), `▶ Embed · ${HTMLAttributes.provider} · ${HTMLAttributes.url}`];
  },
});

/** Images keep their media-library key so pages render through the image pipeline. */
const MediaImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      storageKey: { default: null },
      width: { default: null },
      height: { default: null },
      caption: { default: null },
    };
  },
});

function B({ on, label, title, onClick, disabled }: { on?: boolean; label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on ? "true" : "false"} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

function Toolbar({ editor, onImage, videoHosts }: { editor: Editor; onImage: () => void; videoHosts: string[] }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      pull: e.isActive("pullQuote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  return (
    <div className="tt-toolbar" role="toolbar" aria-label="Formatting">
      <B on={s.bold} label="B" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} />
      <B on={s.italic} label="I" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} />
      <B on={s.underline} label="U" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <span className="sep" />
      <B on={s.h2} label="H2" title="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <B on={s.h3} label="H3" title="Subheading" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <B on={s.bullet} label="• List" title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <B on={s.ordered} label="1. List" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <B on={s.quote} label="❝" title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <B
        on={s.pull}
        label="Pull quote"
        title="Pull quote"
        onClick={() => {
          if (editor.isActive("pullQuote")) {
            editor.chain().focus().lift("pullQuote").run();
            return;
          }
          const attribution = window.prompt("Attribution (optional)", "") ?? "";
          editor.chain().focus().wrapIn("pullQuote", { attribution }).run();
        }}
      />
      <span className="sep" />
      <B
        on={s.link}
        label="Link"
        title="Link"
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const href = window.prompt("Link URL (https://… or /path)");
          if (!href) return;
          if (!/^(https?:\/\/|\/|mailto:)/.test(href)) {
            alert("Links must start with https://, / or mailto:");
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        }}
      />
      <B label="Image" title="Insert image" onClick={onImage} />
      <B
        label="Embed"
        title="Embed video"
        onClick={() => {
          const url = window.prompt(videoHosts.length ? "Video link or embed code (YouTube, Vimeo, or an approved partner player)" : "Video URL (YouTube or Vimeo)");
          if (!url) return;
          const e = toEmbed(url, videoHosts);
          if (!e) {
            alert("That link isn't from an approved video provider.");
            return;
          }
          editor.chain().focus().insertContent({ type: "embed", attrs: e }).run();
        }}
      />
      <B
        on={s.table}
        label="Table"
        title={s.table ? "Delete table" : "Insert table"}
        onClick={() => (s.table ? editor.chain().focus().deleteTable().run() : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      />
      {s.table && (
        <>
          <B label="+ Row" title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()} />
          <B label="+ Col" title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()} />
        </>
      )}
      <B label="―" title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <span className="sep" />
      <B label="↶" title="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <B label="↷" title="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()} />
    </div>
  );
}

export function RichEditor({ initial, onChange, videoHosts = [] }: { initial: RichTextDoc | null; onChange: (doc: RichTextDoc) => void; videoHosts?: string[] }) {
  const [picking, setPicking] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        code: false,
        link: { openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"] },
      }),
      PullQuote,
      Embed,
      MediaImageNode.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "Write the story…" }),
    ],
    content: initial && initial.content?.length ? initial : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "prose-body", "aria-label": "Story body" } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichTextDoc),
  });

  if (!editor) return <div className="tt-body">Loading editor…</div>;

  return (
    <div>
      <Toolbar editor={editor} onImage={() => setPicking(true)} videoHosts={videoHosts} />
      <div className="tt-body">
        <EditorContent editor={editor} />
      </div>
      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(m) => {
          if (m.storageKey.startsWith("placeholder:")) {
            alert("Placeholder images can't be placed in the body. Upload a real image.");
            return;
          }
          editor
            .chain()
            .focus()
            .insertContent({ type: "image", attrs: { src: mediaUrl(m.storageKey), alt: m.alt, storageKey: m.storageKey, width: m.width, height: m.height, caption: m.caption ?? null } })
            .run();
        }}
      />
    </div>
  );
}
