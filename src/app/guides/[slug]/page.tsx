import { Metadata } from 'next';
import GuideDetailClient from './GuideDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${title} — Guides Le Kit du Voyageur`,
    description: `Guide de voyage complet : ${title}. Conseils d'experts, checklists et équipement recommandé.`,
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  return <GuideDetailClient slug={slug} />;
}
