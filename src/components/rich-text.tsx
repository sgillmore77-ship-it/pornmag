import Image from "next/image";
import type { ReactNode } from "react";
import type { RichTextDoc, RichTextNode } from "@/db/schema";
import { mediaUrl } from "@/lib/media";
import { embedSrc } from "@/lib/embeds";

/**
 * Renders the editor's JSON document as React elements on the server.
 * Nothing is injected as raw HTML; unknown node types render their children
 * only, and links and embeds are checked against allowlists.
 */
export function RichText({ doc, insertAfterParagraph }: { doc: RichTextDoc | null; insertAfterParagraph?: { n: number; node: ReactNode } }) {
  if (!doc?.content?.length) return null;
  let paragraphs = 0;
  const out: ReactNode[] = [];
  doc.content.forEach((n, i) => {
    out.push(renderNode(n, i));
    if (n.type === "paragraph" && ++paragraphs === insertAfterParagraph?.n) {
      out.push(<div key="inserted">{insertAfterParagraph.node}</div>);
    }
  });
  return <div className="prose-body">{out}</div>;
}

function children(node: RichTextNode): ReactNode {
  return node.content?.map((n, i) => renderNode(n, i));
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function safeHref(href: unknown): string | null {
  const h = str(href)?.trim();
  if (!h) return null;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  try {
    const u = new URL(h);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

function renderText(node: RichTextNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "code":
        out = <code>{out}</code>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (href) {
          const external = /^https?:/.test(href);
          out = (
            <a href={href} {...(external ? { rel: "noopener noreferrer nofollow", target: "_blank" } : {})}>
              {out}
            </a>
          );
        }
        break;
      }
    }
  }
  return <span key={key}>{out}</span>;
}

function renderNode(node: RichTextNode, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "paragraph":
      return <p key={key}>{children(node)}</p>;
    case "heading": {
      const level = Math.min(Math.max(num(node.attrs?.level) ?? 2, 2), 4);
      const H = `h${level}` as "h2" | "h3" | "h4";
      return <H key={key}>{children(node)}</H>;
    }
    case "bulletList":
      return <ul key={key}>{children(node)}</ul>;
    case "orderedList":
      return <ol key={key}>{children(node)}</ol>;
    case "listItem":
      return <li key={key}>{children(node)}</li>;
    case "blockquote":
      return <blockquote key={key}>{children(node)}</blockquote>;
    case "pullQuote":
      return (
        <figure key={key} className="pull-quote">
          <blockquote>{children(node)}</blockquote>
          {str(node.attrs?.attribution) && <figcaption>{str(node.attrs?.attribution)}</figcaption>}
        </figure>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image": {
      const key_ = str(node.attrs?.storageKey);
      if (!key_) return null;
      const width = num(node.attrs?.width) ?? 1600;
      const height = num(node.attrs?.height) ?? 1000;
      const caption = str(node.attrs?.caption);
      return (
        <figure key={key}>
          <Image
            src={mediaUrl(key_)}
            alt={str(node.attrs?.alt) ?? ""}
            width={width}
            height={height}
            sizes="(min-width: 768px) 720px, 100vw"
            className="h-auto w-full"
          />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case "embed": {
      const src = embedSrc(str(node.attrs?.provider), str(node.attrs?.url));
      if (!src) return null;
      return (
        <figure key={key} className="embed">
          <div className="relative aspect-video">
            <iframe
              src={src}
              title={str(node.attrs?.title) ?? "Embedded video"}
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </figure>
      );
    }
    case "table":
      return (
        <div key={key} className="table-wrap">
          <table>
            <tbody>{children(node)}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children(node)}</tr>;
    case "tableHeader":
      return <th key={key}>{children(node)}</th>;
    case "tableCell":
      return <td key={key}>{children(node)}</td>;
    default:
      return node.content ? <div key={key}>{children(node)}</div> : null;
  }
}
