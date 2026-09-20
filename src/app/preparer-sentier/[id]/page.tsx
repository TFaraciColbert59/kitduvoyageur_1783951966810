import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  PrepareActivityAuthError,
  prepareActivityFromTrail,
  type PrepareTrailOutcome,
} from '@/features/trips/server/prepareActivityFromTrail';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const UNAVAILABLE_COPY: Record<'not_found' | 'no_name' | 'no_geometry', string> = {
  not_found: "Ce sentier n'existe pas dans nos données réelles.",
  no_name: "Ce sentier n'a pas de nom exploitable dans nos données réelles.",
  no_geometry: "Le tracé réel de ce sentier n'est pas disponible.",
};

/**
 * `/preparer-sentier/[id]` — préparation serveur d'une activité réelle depuis un sentier.
 *
 * Sentier inconnu/sans nom/sans tracé → page honnête, aucune écriture.
 * Non connecté (sentier valide) → redirection connexion avec reprise.
 * Succès/réutilisation → `/preparer-sentier/[id]/activer` pose le cookie
 * d'aventure active (Next n'autorise l'écriture de cookie que dans un Route
 * Handler ou une Server Action) puis redirige vers `/hub`.
 */
export default async function PreparerSentierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let outcome: PrepareTrailOutcome;
  try {
    outcome = await prepareActivityFromTrail(id);
  } catch (error) {
    if (error instanceof PrepareActivityAuthError) {
      redirect('/connexion?next=' + encodeURIComponent(`/preparer-sentier/${id}`));
    }
    throw error;
  }

  if (outcome.status === 'unavailable') {
    const persistFailed = outcome.reason === 'persist_failed';
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent px-6 py-24">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            {persistFailed
              ? 'Préparation momentanément indisponible — réessayez'
              : 'Données réelles indisponibles pour ce sentier'}
          </h1>
          <p className="mt-4 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
            {outcome.reason === 'persist_failed'
              ? "L'activité n'a pas pu être enregistrée. Aucune donnée n'a été inventée : relancez la préparation dans un instant."
              : `${UNAVAILABLE_COPY[outcome.reason]} Aucune activité n'a été créée.`}
          </p>
          <Link
            href="/explorer"
            className="mt-8 inline-flex min-h-[var(--control-height-md)] items-center justify-center rounded-full bg-[color:var(--lkv-action)] px-6 text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-on-action)] transition-colors hover:bg-[color:var(--lkv-action-hover)]"
          >
            Revenir à l&apos;explorateur
          </Link>
        </Card>
      </div>
    );
  }

  redirect(`/preparer-sentier/${encodeURIComponent(id)}/activer`);
}
