import type { Metadata } from 'next';
import { ProtectedPreviewView } from '@/components/media-sharing/ProtectedPreviewView';
import { resolvePreviewLink } from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Aperçu protégé · Le Kit du Voyageur',
  description: "Aperçu de trace en lecture seule, révocable par son auteur.",
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ mv?: string }>;
}

/**
 * K5.28 — vue publique d'un aperçu révocable.
 * Le token reste dans l'URL mais n'est jamais journalisé ni renvoyé au client
 * sous forme de donnée structurée : seule la résolution serveur l'utilise.
 */
export default async function ProtectedPreviewPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : undefined;
  const resolution = resolvePreviewLink(token, query?.mv);
  return <ProtectedPreviewView resolution={resolution} />;
}
