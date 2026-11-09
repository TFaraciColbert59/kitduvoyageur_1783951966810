import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canOpenCompasLab } from '@/features/compas/dev/labPolicy';
import { CarnetV2Lab } from './CarnetV2Lab';

/**
 * Banc visuel de la fiche carnet v2 : `CarnetScreenV2` sur la fiche pleine « Tour des Écrins »
 * (jeu de données de la maquette), sans compte ni base. Sert aux captures 390×844 et 430×932
 * comparées à la maquette dans le même état. Introuvable hors `next dev` (même garde que
 * `/dev/compas`, testée dans `labPolicy.test.ts`).
 *
 * Paramètres : `role=participant|visitor`, `vide=1`, `jour=0..4`, `tiroir=fil|route|sac|chiffres|equipage`.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Banc de la fiche carnet v2',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ role?: string; vide?: string }>;
}

export default async function CarnetV2LabPage({ searchParams }: Props) {
  if (!canOpenCompasLab(process.env.NODE_ENV)) notFound();
  const params = await searchParams;
  return <CarnetV2Lab role={params.role === 'visitor' ? 'visitor' : 'participant'} empty={params.vide === '1'} />;
}
