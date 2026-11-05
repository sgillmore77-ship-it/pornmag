import { SectionIndex, sectionIndexMetadata } from "@/components/section-index";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[site]/[section]">) {
  const { site, section } = await params;
  return sectionIndexMetadata(site, section, 1);
}

export default async function SectionPage({ params }: PageProps<"/[site]/[section]">) {
  const { site, section } = await params;
  return <SectionIndex site={site} section={section} page={1} />;
}
