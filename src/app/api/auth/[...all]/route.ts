import { getAuth } from "@/lib/auth";
import { getPublicationByHost } from "@/data/publications";

async function handle(request: Request): Promise<Response> {
  const host = request.headers.get("host") ?? "";
  const publication = await getPublicationByHost(host);
  if (!publication) return new Response("Unknown publication", { status: 404 });
  const auth = await getAuth(publication, host);
  return auth.handler(request);
}

export const GET = handle;
export const POST = handle;
