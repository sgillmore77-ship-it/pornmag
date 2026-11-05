import { notFound, permanentRedirect } from "next/navigation";
import { Listing, listingMetadata } from "@/components/section-index";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

function parsePage(n: string): number {
  if (!/^\d{1,4}$/.test(n)) notFound();
  return Number(n);
}

export async function generateMetadata({ params }: PageProps<"/[site]/[section]/page/[n]">) {
  const { site, section, n } = await params;
  return listingMetadata(site, { kind: "section", section }, parsePage(n));
}

export default async function SectionPagedPage({ params }: PageProps<"/[site]/[section]/page/[n]">) {
  const { site, section, n } = await params;
  const page = parsePage(n);
  if (page === 1) permanentRedirect(`/${section}`);
  return <Listing site={site} listing={{ kind: "section", section }} page={page} />;
}
