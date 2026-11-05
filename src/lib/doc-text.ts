import type { RichTextDoc, RichTextNode } from "@/db/schema";

/** Plain text of a rich-text document, for search indexing and fallbacks. */
export function docToText(doc: RichTextDoc | null): string {
  const parts: string[] = [];
  const walk = (n: RichTextNode) => {
    if (n.text) parts.push(n.text);
    n.content?.forEach(walk);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(n.type)) parts.push(" ");
  };
  doc?.content?.forEach(walk);
  return parts.join("").replace(/\s+/g, " ").trim();
}
