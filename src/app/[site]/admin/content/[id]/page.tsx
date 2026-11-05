import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { PageHead } from "@/components/admin/bits";
import { ContentEditor, EMPTY_REVIEW, EMPTY_VIDEO, type EditorInitial } from "@/components/admin/content-editor";
import { formatDuration } from "@/lib/format";
import { canEditItem, CONTENT_TYPES, getContentForEdit } from "@/data/admin/content";
import { getMedia } from "@/data/admin/media";
import { listAuthorsAdmin, listCategoriesAdmin, listEntitiesAdmin, listTagsAdmin } from "@/data/admin/taxonomy";
import { contentItems } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin";
import { can } from "@/lib/permissions";

function picked(m: Awaited<ReturnType<typeof getMedia>> | null) {
  return m ? { id: m.id, storageKey: m.storageKey, alt: m.alt, caption: m.caption, width: m.width, height: m.height, blurColor: m.blurColor } : null;
}

export default async function EditContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const a = await requireAdminPage("content.create");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";

  const item = isNew ? null : await getContentForEdit(a.db, a.ctx.site, id);
  if (!isNew && !item) notFound();
  if (item && !(await canEditItem(a.db, a.ctx.site, a.actor, item.id))) redirect("/admin/content?denied=1");

  const [cats, authors, tags, relatable, hero, og, ents] = await Promise.all([
    listCategoriesAdmin(a.db, a.ctx.site),
    listAuthorsAdmin(a.db, a.ctx.site),
    listTagsAdmin(a.db, a.ctx.site),
    a.db
      .select({ id: contentItems.id, name: contentItems.title })
      .from(contentItems)
      .where(and(eq(contentItems.publicationId, a.ctx.publication.id), eq(contentItems.status, "published")))
      .orderBy(desc(contentItems.publishedAt))
      .limit(300),
    item?.heroImageId ? getMedia(a.db, a.ctx.site, item.heroImageId) : null,
    item?.ogImageId ? getMedia(a.db, a.ctx.site, item.ogImageId) : null,
    listEntitiesAdmin(a.db, a.ctx.site),
  ]);

  const type = (CONTENT_TYPES.find((t) => t === sp.type) ?? "article") as EditorInitial["type"];
  const initial: EditorInitial = item
    ? {
        id: item.id,
        type: item.type,
        status: item.status,
        title: item.title,
        slug: item.slug,
        standfirst: item.standfirst ?? "",
        body: item.body,
        scheduledFor: item.scheduledFor?.toISOString() ?? null,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        categoryId: item.categoryId ?? "",
        heroImage: picked(hero),
        ogImage: picked(og),
        authorIds: item.authorIds,
        tagNames: item.tagNames,
        related: item.related.map((r) => ({ id: r.id, name: r.title })),
        isFeatured: item.isFeatured,
        commentsEnabled: item.commentsEnabled,
        review: item.review
          ? {
              score: String(item.review.score),
              badge: item.review.badge ?? "",
              verdict: item.review.verdict ?? "",
              pros: item.review.pros,
              cons: item.review.cons,
              subjectEntityId: item.review.subjectEntityId ?? "",
              releaseYear: item.review.releaseYear ? String(item.review.releaseYear) : "",
              pricing: item.review.pricing ?? "",
              affiliateUrl: item.review.affiliateUrl ?? "",
            }
          : EMPTY_REVIEW,
        video: item.video
          ? {
              url: item.video.embedUrl,
              duration: formatDuration(item.video.durationSeconds),
              studioEntityId: item.video.studioEntityId ?? "",
              score: item.type === "video" && item.review ? String(item.review.score) : "",
            }
          : EMPTY_VIDEO,
        seoTitle: item.seoTitle ?? "",
        metaDescription: item.metaDescription ?? "",
        canonicalUrl: item.canonicalUrl ?? "",
        robotsIndex: item.robotsIndex,
      }
    : {
        id: null,
        type,
        status: "draft",
        title: "",
        slug: "",
        standfirst: "",
        body: null,
        scheduledFor: null,
        publishedAt: null,
        categoryId: "",
        heroImage: null,
        ogImage: null,
        authorIds: [],
        tagNames: [],
        related: [],
        isFeatured: false,
        commentsEnabled: a.ctx.publication.settings.commentsEnabled,
        review: EMPTY_REVIEW,
        video: EMPTY_VIDEO,
        seoTitle: "",
        metaDescription: "",
        canonicalUrl: "",
        robotsIndex: true,
      };

  return (
    <>
      {isNew && <PageHead title="New story" />}
      <ContentEditor
        key={item?.id ?? "new"}
        initial={initial}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        authors={authors.map((x) => ({ id: x.id, name: x.name }))}
        tagSuggestions={tags.map((t) => t.name)}
        relatable={relatable}
        entities={ents.map((e) => ({ id: e.id, name: e.name, kind: e.kind }))}
        canPublish={can(a.actor, "content.publish")}
        canDelete={can(a.actor, "content.edit.any")}
        origin={a.ctx.origin}
        siteName={a.ctx.publication.name}
      />
    </>
  );
}
