import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { Card } from '@/components/ui';
import type { PublishedRouteHubSummary } from '@/features/route-collab/integrations';

/**
 * 10.3 : le HUB affiche la VERSION PUBLIÉE de l'itinéraire du voyage (lecture serveur, RLS), jamais le
 * brouillon en cours. Composant sans état : rendu par un Server Component, aucun appel réseau ici.
 * « Modifier dans le Compas » ouvre `/compas/itineraire?trip=<id>`.
 */
export function PublishedRouteCard({ summary }: { summary: PublishedRouteHubSummary }) {
  const km = summary.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const facts: Array<{ label: string; value: string }> = [
    { label: 'Distance', value: `${km} km` },
    { label: 'Étapes', value: String(summary.stagesCount) },
    { label: 'Version', value: `V${summary.revisionNo}` },
    {
      label: 'Sac à revérifier',
      value: summary.kitRevalidationCount > 0 ? String(summary.kitRevalidationCount) : 'Rien',
    },
    {
      label: 'Prêts au départ',
      value:
        summary.participantsTotalCount > 0
          ? `${summary.participantsReadyCount} sur ${summary.participantsTotalCount}`
          : 'Aucun suivi',
    },
  ];
  return (
    <Card>
      <section aria-label="Itinéraire publié" data-testid="hub-published-route" className="space-y-3 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">Itinéraire publié</p>
            <h2 className="truncate text-base font-semibold">{summary.title}</h2>
          </div>
          <Link
            href={summary.href}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium"
            data-testid="hub-edit-in-compas"
          >
            Modifier dans le Compas <Icon name="arrow-right" size={14} aria-hidden="true" />
          </Link>
        </header>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-[11px] uppercase tracking-[0.1em] text-[var(--lkv-text-muted)]">{fact.label}</dt>
              <dd className="text-sm font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {summary.hasNewerDraft && (
          <p className="text-xs text-[var(--lkv-text-muted)]">
            Le brouillon a avancé depuis cette version : le HUB montre la version publiée.
          </p>
        )}
      </section>
    </Card>
  );
}
