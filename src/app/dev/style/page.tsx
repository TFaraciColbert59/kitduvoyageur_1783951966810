import { notFound } from 'next/navigation';
import { canOpenGlassLab } from '@/components/dev/glass/glassLabPolicy';

export const metadata = { title: 'LKDV — Planche de style' };

export default async function StylePage() {
  if (!canOpenGlassLab(process.env.NODE_ENV, process.env.LKDV_GLASS_LAB)) notFound();
  const { default: StyleShowcase } = await import('@/components/dev/style/StyleShowcase');
  return <StyleShowcase />;
}
