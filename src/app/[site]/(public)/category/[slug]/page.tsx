import { Listing, listingMetadata } from "@/components/section-index";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[site]/category/[slug]">) {
  const { site, slug } = await params;
  return listingMetadata(site, { kind: "category", slug }, 1);
}

export default async function CategoryPage({ params }: PageProps<"/[site]/category/[slug]">) {
  const { site, slug } = await params;
  return <Listing site={site} listing={{ kind: "category", slug }} page={1} />;
}
