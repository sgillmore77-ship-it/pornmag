"use server";

import {
  CommunityError,
  deleteOwnComment,
  editComment,
  getThread,
  postComment,
  reportComment,
  reportContent,
  toggleFavourite,
  updateProfile,
  type ThreadState,
} from "@/data/community";
import { submitContactMessage } from "@/data/pages";
import { currentReader, ipHash } from "@/lib/reader";

export type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const err = e as Error & { issues?: { message: string }[] };
    if (err.issues?.length) return { ok: false, error: err.issues[0].message };
    if (err instanceof CommunityError || err.name === "CommunityError") return { ok: false, error: err.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

async function signedIn() {
  const r = await currentReader();
  if (!r.reader) throw new CommunityError("Sign in first.");
  return { ...r, reader: r.reader };
}

export async function loadThreadAction(contentId: string): Promise<Result<ThreadState | null>> {
  return attempt(async () => {
    const { ctx, db, reader } = await currentReader();
    return getThread(db, ctx.site, String(contentId), reader);
  });
}

export async function postCommentAction(input: { contentId: string; parentId?: string | null; body: string }) {
  return attempt(async () => {
    const { ctx, db, reader } = await signedIn();
    return postComment(db, ctx.site, reader, input, await ipHash());
  });
}

export async function editCommentAction(id: string, body: string) {
  return attempt(async () => {
    const { ctx, db, reader } = await signedIn();
    await editComment(db, ctx.site, reader, String(id), body);
  });
}

export async function deleteCommentAction(id: string) {
  return attempt(async () => {
    const { ctx, db, reader } = await signedIn();
    await deleteOwnComment(db, ctx.site, reader, String(id));
  });
}

export async function reportCommentAction(id: string, reason: string) {
  return attempt(async () => {
    const { ctx, db, reader } = await signedIn();
    await reportComment(db, ctx.site, reader, String(id), String(reason));
  });
}

export async function toggleSaveAction(contentId: string) {
  return attempt(async () => {
    const { ctx, db, reader } = await signedIn();
    return toggleFavourite(db, ctx.site, reader, String(contentId));
  });
}

export async function updateProfileAction(input: { handle: string; displayName?: string; bio?: string }) {
  return attempt(async () => {
    const { ctx, db, reader } = await signedIn();
    await updateProfile(db, ctx.site, reader.userId, input);
  });
}

export async function reportContentAction(input: { contentId: string; reason: string; details?: string; email?: string }) {
  return attempt(async () => {
    const { ctx, db, reader } = await currentReader();
    await reportContent(db, ctx.site, reader?.userId ?? null, input, await ipHash());
  });
}

export async function sendContactAction(input: { name: string; email: string; topic: string; message: string; website?: string }) {
  return attempt(async () => {
    const { ctx, db } = await currentReader();
    await submitContactMessage(db, ctx.site, input, await ipHash());
  });
}
