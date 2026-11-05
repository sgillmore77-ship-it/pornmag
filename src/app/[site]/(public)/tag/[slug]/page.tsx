import { Listing, listingMetadata } from "@/components/section-index";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[site]/tag/[slug]">) {
  const { site, slug } = await params;
  return listingMetadata(site, { kind: "tag", slug }, 1);
}

export default async function TagPage({ params }: PageProps<"/[site]/tag/[slug]">) {
  const { site, slug } = await params;
  return <Listing site={site} listing={{ kind: "tag", slug }} page={1} />;
}
