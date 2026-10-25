import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canOpenGlassLab } from '@/components/dev/glass/glassLabPolicy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Laboratoire Liquid Glass',
  robots: { index: false, follow: false },
};

export default async function GlassLabPage() {
  if (!canOpenGlassLab(process.env.NODE_ENV, process.env.LKDV_GLASS_LAB)) notFound();
  const { default: GlassLab } = await import('@/components/dev/glass/GlassLab');
  return <GlassLab />;
}
