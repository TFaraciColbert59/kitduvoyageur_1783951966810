import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { AdminRiskBadge } from '@/components/admin-os/AdminRiskBadge';
import { getMarketplaceReviewQueue } from '@/features/admin-os/marketplace/queries';

/** GET /admin/marketplace — file de review + risque vendeur (Admin OS). */
export default async function AdminMarketplacePage() {
  const market = (ROUTES as Record<string, { eyebrow: string; title: string; subtitle: string }>)['market'];
  const cfg = {
    eyebrow: 'MARKETPLACE OPS',
    title: 'Marketplace',
    subtitle: market?.subtitle ?? 'Annonces, risque vendeur, litiges.',
  };
  const queue = await getMarketplaceReviewQueue(20).catch(() => null);

  if (!queue) {
    return (
      <>
        <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={null} />
        <EmptyState title="Lecture impossible" description="Permission moderation.read requise." />
      </>
    );
  }

  const critical = queue.filter((i) => i.risk_level === 'critical');
  const first = queue[0];

  return (
    <>
      <Hero eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} actions={null} />
      <MetricGrid
        metrics={[
          { label: 'À revoir', value: String(queue.length), delta: 'non actives + 7 j', icon: 'bag' },
          { label: 'Critiques', value: String(critical.length), delta: 'risque vendeur', icon: 'warning', tone: critical.length > 0 ? 'warn' : undefined },
          { label: 'Signalements', value: String(queue.reduce((s, i) => s + i.reports, 0)), delta: 'moderation_queue', icon: 'shield' },
          { label: 'Litiges', value: String(queue.reduce((s, i) => s + i.disputes, 0)), delta: 'rejets', icon: 'clock' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="REVIEW" title="Annonces à revoir" chip={`${queue.length} items`} kind="table" rows={[]}>
            {queue.length === 0 ? (
              <EmptyState title="File vide" description="Aucune annonce à revoir." />
            ) : (
              <ul className="os-rows">
                {queue.map((item) => (
                  <li key={item.id} className="os-row">
                    <span className="os-row-copy">
                      <strong>
                        {item.listing_type} · {(item.prix_cents / 100).toFixed(2)} € · {item.statut}
                      </strong>
                      <small>
                        vendeur {item.vendeur_age_days} j · {item.reports} signalement(s) · {item.disputes} litige(s) · {item.risk_indicators.join(', ') || 'aucun signal'}
                      </small>
                    </span>
                    <AdminRiskBadge tier={item.risk_level === 'critical' ? 4 : item.risk_level === 'high' ? 3 : item.risk_level === 'medium' ? 2 : 1} />
                  </li>
                ))}
              </ul>
            )}
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: first ? `Annonce ${first.id.slice(0, 8)}` : 'Aucune annonce',
            subtitle: first ? `risque ${first.risk_score}/100` : '—',
            headline: critical.length > 0 ? `${critical.length} critique(s)` : 'File nominale',
            text: 'Restriction graduée (restreinte/suspendue) via commande auditée, jamais de ban direct.',
            rows: [],
          }}
        />
      </section>
    </>
  );
}
