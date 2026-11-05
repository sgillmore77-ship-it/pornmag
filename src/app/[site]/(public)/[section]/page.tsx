import { Listing, listingMetadata } from "@/components/section-index";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[site]/[section]">) {
  const { site, section } = await params;
  return listingMetadata(site, { kind: "section", section }, 1);
}

export default async function SectionPage({ params }: PageProps<"/[site]/[section]">) {
  const { site, section } = await params;
  return <Listing site={site} listing={{ kind: "section", section }} page={1} />;
}
