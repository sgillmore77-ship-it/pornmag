"use server";

/**
 * Every admin mutation. Each one re-checks the signed-in user's permission
 * for the publication on this host (never trusting the client), writes an
 * audit entry, and refreshes cached public pages when readers would see a
 * change.
 */
import { redirect } from "next/navigation";
import { audit, purge, requireAdmin, run, type ActionResult } from "@/lib/admin";
import { deleteContent, saveContent, type ContentInput } from "@/data/admin/content";
import {
  ALLOWED_IMAGE_TYPES,
  createMediaRow,
  MAX_UPLOAD_BYTES,
  sniffImageType,
  storageKeyFor,
  updateMediaMeta,
} from "@/data/admin/media";
import { deleteRedirect, saveHomepage, saveRedirect, saveSettings } from "@/data/admin/site";
import { authorForUser, deleteAuthor, deleteCategory, deleteTag, saveAuthor, saveCategory, saveTag } from "@/data/admin/taxonomy";
import type { z } from "zod";
import type { homepageInput, redirectInput, settingsInput } from "@/data/admin/site";
import type { authorInput, categoryInput, tagInput } from "@/data/admin/taxonomy";
import { deleteMessage, deletePage, savePage, setMessageHandled, type pageInput } from "@/data/admin/pages";
import { putObject } from "@/lib/storage";
import {
  moderateComments,
  removeAllComments,
  resolveContentReport,
  setCommentBlock,
  setRole,
  unpublishContent,
  type ModAction,
} from "@/data/admin/moderation";
import type { Role } from "@/lib/permissions";
import { approveVideoHost, forgetRecentFeed, importVideos, ImportError, previewFeed, previewFeedText, rememberRecentFeed, type FeedPreview, type FeedVideo, type ImportResult } from "@/data/admin/video-import";
import { deleteAd, saveAd, saveAdsSettings, type adInput, type adsSettingsInput } from "@/data/admin/ads";

// ---------- Content ----------

export async function saveContentAction(input: ContentInput): Promise<ActionResult<{ id: string; slug: string }>> {
  return run(async () => {
    const a = await requireAdmin("content.create");
    // New pieces get the writer's byline if none was chosen.
    if (!input.id && (!input.authorIds || input.authorIds.length === 0)) {
      input = { ...input, authorIds: [await authorForUser(a.db, a.ctx.site, a.user)] };
    }
    const r = await saveContent(a.db, a.ctx.site, a.actor, input);
    await audit(a, r.isNew ? "content.create" : "content.update", "content", r.id, { title: input.title, status: r.status });
    if (r.status === "published" || r.wasLive) await purge(a);
    return { id: r.id, slug: r.slug };
  }, "Saved");
}

export async function deleteContentAction(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    const a = await requireAdmin("content.edit.any");
    const r = await deleteContent(a.db, a.ctx.site, a.actor, id);
    await audit(a, "content.delete", "content", id, { title: r.title });
    await purge(a);
  });
  if (result.ok) redirect("/admin/content?deleted=1");
  return result;
}

// ---------- Media ----------

export async function uploadMediaAction(form: FormData): Promise<ActionResult<{ id: string; storageKey: string; alt: string; width: number | null; height: number | null }>> {
  return run(async () => {
    const a = await requireAdmin("media.upload");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose an image to upload");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Images must be 15 MB or smaller");
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Trust the file's contents, not its name or the browser's label.
    const type = sniffImageType(bytes);
    if (!type || !ALLOWED_IMAGE_TYPES[type]) throw new Error("Only JPEG, PNG, WebP, AVIF and GIF images can be uploaded");
    const width = Number(form.get("width")) || null;
    const height = Number(form.get("height")) || null;
    const alt = String(form.get("alt") ?? "").trim().slice(0, 300);
    const key = storageKeyFor(a.ctx.site, type);
    await putObject(key, bytes, type);
    const row = await createMediaRow(a.db, a.ctx.site, { storageKey: key, mimeType: type, sizeBytes: file.size, width, height, alt, uploadedBy: a.user.id });
    await audit(a, "media.upload", "media", row.id, { size: file.size, type });
    return { id: row.id, storageKey: row.storageKey, alt: row.alt, width: row.width, height: row.height };
  }, "Uploaded");
}

export async function updateMediaAction(input: { id: string; alt: string; caption?: string; credit?: string }): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("media.upload");
    await updateMediaMeta(a.db, a.ctx.site, input);
    await audit(a, "media.update", "media", input.id);
    await purge(a);
  }, "Saved");
}

// ---------- Taxonomy ----------

export async function saveCategoryAction(input: z.input<typeof categoryInput>): Promise<ActionResult<string>> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const id = await saveCategory(a.db, a.ctx.site, input);
    await audit(a, input.id ? "category.update" : "category.create", "category", id, { name: input.name });
    await purge(a);
    return id;
  }, "Saved");
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const r = await deleteCategory(a.db, a.ctx.site, id);
    await audit(a, "category.delete", "category", id, r);
    await purge(a);
  }, "Deleted");
}

export async function saveTagAction(input: z.input<typeof tagInput>): Promise<ActionResult<string>> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const id = await saveTag(a.db, a.ctx.site, input);
    await audit(a, input.id ? "tag.update" : "tag.create", "tag", id, { name: input.name });
    await purge(a);
    return id;
  }, "Saved");
}

export async function deleteTagAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const r = await deleteTag(a.db, a.ctx.site, id);
    await audit(a, "tag.delete", "tag", id, r);
    await purge(a);
  }, "Deleted");
}

export async function saveAuthorAction(input: z.input<typeof authorInput>): Promise<ActionResult<string>> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const id = await saveAuthor(a.db, a.ctx.site, input);
    await audit(a, input.id ? "author.update" : "author.create", "author", id, { name: input.name });
    await purge(a);
    return id;
  }, "Saved");
}

export async function deleteAuthorAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const r = await deleteAuthor(a.db, a.ctx.site, id);
    await audit(a, "author.delete", "author", id, r);
    await purge(a);
  }, "Deleted");
}

// ---------- Site ----------

export async function saveHomepageAction(input: z.input<typeof homepageInput>): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("homepage.manage");
    await saveHomepage(a.db, a.ctx.site, input);
    await audit(a, "homepage.update", "homepage", null, { sections: input.sections.map((x) => ({ id: x.id, enabled: x.enabled })) });
    await purge(a);
  }, "Homepage updated");
}

export async function saveSettingsAction(input: z.input<typeof settingsInput>): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const diff = await saveSettings(a.db, a.ctx.site, input);
    await audit(a, "settings.update", "publication", a.ctx.publication.id, diff);
    await purge(a);
  }, "Settings saved");
}

export async function saveRedirectAction(input: z.input<typeof redirectInput>): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const r = await saveRedirect(a.db, a.ctx.site, input);
    await audit(a, "redirect.save", "redirect", null, r);
    await purge(a);
  }, "Redirect saved");
}

export async function deleteRedirectAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const r = await deleteRedirect(a.db, a.ctx.site, id);
    await audit(a, "redirect.delete", "redirect", id, r);
    await purge(a);
  }, "Deleted");
}

export async function listMediaAction(q?: string): Promise<ActionResult<{ id: string; storageKey: string; alt: string; caption: string | null; width: number | null; height: number | null; blurColor: string | null }[]>> {
  return run(async () => {
    const a = await requireAdmin("media.upload");
    const { listMedia } = await import("@/data/admin/media");
    const rows = await listMedia(a.db, a.ctx.site, { q, limit: 120 });
    return rows.map((m) => ({ id: m.id, storageKey: m.storageKey, alt: m.alt, caption: m.caption, width: m.width, height: m.height, blurColor: m.blurColor }));
  });
}

export async function setLayoutAction(layout: "issue" | "feed"): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("homepage.manage");
    if (layout !== "issue" && layout !== "feed") throw new Error("Unknown layout");
    const { publications } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const theme = { ...a.ctx.publication.theme, layout };
    await a.db.update(publications).set({ theme }).where(eq(publications.id, a.ctx.publication.id));
    await audit(a, "homepage.layout", "publication", a.ctx.publication.id, { layout });
    await purge(a);
  }, "Layout changed");
}

// ---------- Studios & creators ----------

export async function saveEntityAction(input: import("zod").input<typeof import("@/data/admin/taxonomy").entityInput>): Promise<ActionResult<string>> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const { saveEntity } = await import("@/data/admin/taxonomy");
    const id = await saveEntity(a.db, a.ctx.site, input);
    await audit(a, input.id ? "entity.update" : "entity.create", "entity", id, { name: input.name });
    await purge(a);
    return id;
  }, "Saved");
}

export async function deleteEntityAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("taxonomy.manage");
    const { deleteEntity } = await import("@/data/admin/taxonomy");
    const r = await deleteEntity(a.db, a.ctx.site, id);
    await audit(a, "entity.delete", "entity", id, r);
    await purge(a);
  }, "Deleted");
}

// ---------- Community ----------

export async function moderateCommentsAction(ids: string[], action: ModAction): Promise<ActionResult<number>> {
  return run(async () => {
    const a = await requireAdmin("comments.moderate");
    if (!["approve", "remove", "spam", "dismiss"].includes(action)) throw new Error("Unknown action");
    const n = await moderateComments(a.db, a.ctx.site, a.actor, ids.map(String), action);
    await audit(a, `comment.${action}`, "comment", ids.length === 1 ? String(ids[0]) : null, { count: n });
    return n;
  });
}

export async function setCommentBlockAction(userId: string, blocked: boolean, reason?: string, removeAll?: boolean): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("comments.moderate");
    await setCommentBlock(a.db, a.ctx.site, a.actor, String(userId), !!blocked, reason ? String(reason) : undefined);
    const removed = blocked && removeAll ? await removeAllComments(a.db, a.ctx.site, a.actor, String(userId)) : 0;
    await audit(a, blocked ? "member.block" : "member.unblock", "user", String(userId), { reason, removed });
  }, blocked ? "Blocked from commenting" : "Unblocked");
}

export async function setRoleAction(userId: string, role: Role): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    await setRole(a.db, a.ctx.site, a.actor, String(userId), role);
    await audit(a, "member.role", "user", String(userId), { role });
  }, "Role updated");
}

export async function resolveReportAction(id: string, reopen = false): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("comments.moderate");
    await resolveContentReport(a.db, a.ctx.site, a.actor, String(id), !!reopen);
    await audit(a, reopen ? "report.reopen" : "report.resolve", "content_report", String(id));
  }, reopen ? "Reopened" : "Marked as resolved");
}

export async function unpublishReportedAction(contentId: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("content.publish");
    await unpublishContent(a.db, a.ctx.site, a.actor, String(contentId));
    await audit(a, "content.unpublish", "content", String(contentId), { via: "report" });
    await purge(a);
  }, "Taken offline (moved to drafts)");
}

// ---------- Ads ----------

export async function saveAdAction(input: z.input<typeof adInput>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const r = await saveAd(a.db, a.ctx.site, input);
    await audit(a, input.id ? "ad.update" : "ad.create", "ad", r.id, { name: r.name, slot: input.slot, enabled: input.enabled });
    await purge(a);
    return { id: r.id };
  }, "Placement saved");
}

export async function deleteAdAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const r = await deleteAd(a.db, a.ctx.site, String(id));
    await audit(a, "ad.delete", "ad", String(id), r);
    await purge(a);
  }, "Deleted");
}

export async function saveAdsSettingsAction(input: z.input<typeof adsSettingsInput>): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    await saveAdsSettings(a.db, a.ctx.site, input);
    await audit(a, "ads.settings", "publication", a.ctx.publication.id, { previewPlaceholders: input.previewPlaceholders });
    await purge(a);
  }, "Saved");
}

// ---------- Video import ----------

export async function previewFeedAction(url: string, limit: number): Promise<ActionResult<FeedPreview>> {
  return run(async () => {
    const a = await requireAdmin("content.create");
    try {
      const preview = await previewFeed(a.db, a.ctx.site, String(url), Number(limit) || 100);
      await rememberRecentFeed(a.db, a.ctx.site, String(url));
      return preview;
    } catch (e) {
      if (e instanceof ImportError) throw new Error(e.message);
      throw e;
    }
  });
}

export async function importVideosAction(videos: FeedVideo[], opts: { categoriesAsTags: boolean; tagsAsTags: boolean }): Promise<ActionResult<ImportResult>> {
  return run(async () => {
    const a = await requireAdmin("content.create");
    if (!Array.isArray(videos) || videos.length > 25) throw new Error("Import up to 25 videos at a time");
    // Re-validate everything the browser sent: only https players and thumbnails.
    const clean = videos.map((v) => ({
      ...v,
      title: String(v.title ?? "").slice(0, 200),
      description: v.description ? String(v.description).slice(0, 600) : null,
      embedUrl: String(v.embedUrl ?? ""),
      thumbUrl: v.thumbUrl && /^https:\/\//.test(String(v.thumbUrl)) ? String(v.thumbUrl) : null,
      durationSeconds: Number.isFinite(Number(v.durationSeconds)) ? Number(v.durationSeconds) : null,
      categories: (Array.isArray(v.categories) ? v.categories : []).map(String),
      tags: (Array.isArray(v.tags) ? v.tags : []).map(String),
    }));
    const r = await importVideos(a.db, a.ctx.site, a.actor, clean, { categoriesAsTags: !!opts?.categoriesAsTags, tagsAsTags: !!opts?.tagsAsTags });
    await audit(a, "video.import", "content", null, { imported: r.imported.length, skipped: r.skipped.length });
    return r;
  });
}

export async function approveVideoHostAction(host: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const h = await approveVideoHost(a.db, a.ctx.site, String(host));
    await audit(a, "settings.video_host", "publication", a.ctx.publication.id, { host: h });
    await purge(a);
  }, "Approved");
}

// ---------------------------------------------------------------------------
// Pages (About, Contact, Terms…) and contact messages
// ---------------------------------------------------------------------------

export async function savePageAction(input: z.input<typeof pageInput>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const r = await savePage(a.db, a.ctx.site, input);
    await audit(a, input.id ? "page.update" : "page.create", "page", r.id, { slug: r.slug });
    await purge(a);
    return { id: r.id };
  }, "Page saved");
}

export async function deletePageAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    const r = await deletePage(a.db, a.ctx.site, id);
    await audit(a, "page.delete", "page", id, r);
    await purge(a);
  }, "Page deleted");
}

export async function setMessageHandledAction(id: string, handled: boolean): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    await setMessageHandled(a.db, a.ctx.site, id, a.user.id, handled);
    await audit(a, handled ? "message.handle" : "message.reopen", "contact_message", id);
  });
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("publication.manage");
    await deleteMessage(a.db, a.ctx.site, id);
    await audit(a, "message.delete", "contact_message", id);
  }, "Message deleted");
}

export async function forgetRecentFeedAction(url: string): Promise<ActionResult> {
  return run(async () => {
    const a = await requireAdmin("content.create");
    await forgetRecentFeed(a.db, a.ctx.site, String(url));
  });
}

export async function previewFeedFileAction(text: string, limit: number): Promise<ActionResult<FeedPreview>> {
  return run(async () => {
    const a = await requireAdmin("content.create");
    try {
      return await previewFeedText(a.db, a.ctx.site, String(text), Number(limit) || 100);
    } catch (e) {
      if (e instanceof ImportError) throw new Error(e.message);
      throw e;
    }
  });
}
