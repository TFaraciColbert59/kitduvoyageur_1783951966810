import { EmptyState } from '@/components/ui';
import { ROUTES } from '../_os/routeConfig';
import { Hero, MetricGrid, DataPanel } from '../_os/panels';
import { InspectorBox } from '../_os/osUi';
import { ReportButton } from '../_os/ReportButton';
import { MfaManager, type TotpFactor } from '../_components/MfaManager';
import { createClient } from '@/lib/supabase/server';
import { requireAdminOrRedirect } from '@/features/admin/queries';
import { getSecurityStats } from '@/features/admin/osQueries';

/** GET /admin/securite — Zero Trust (Admin OS). */
export default async function AdminSecurityPage() {
  await requireAdminOrRedirect();
  const cfg = ROUTES['securite'];

  let factors: TotpFactor[] = [];
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      unavailable = true;
    } else {
      factors = ((data.totp ?? []) as TotpFactor[]).filter((f) => f.status === 'verified');
    }
  } catch {
    unavailable = true;
  }
  const stats = await getSecurityStats().catch(() => null);

  return (
    <>
      <Hero
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<ReportButton section="audit" label="Exporter l’audit" />}
      />
      <MetricGrid
        metrics={[
          { label: 'Octrois de rôles', value: stats ? String(stats.admins) : '—', delta: 'attributions actives', icon: 'shield' },
          { label: 'Permissions', value: stats ? String(stats.grants) : '—', delta: 'rôle → permission', icon: 'users' },
          { label: 'MFA actif', value: factors.length > 0 ? 'Oui' : 'Non', delta: 'cette session', icon: 'lock', tone: factors.length > 0 ? undefined : 'warn' },
          { label: 'Actions sécurité 30 j', value: stats ? String(stats.secActions30d) : '—', delta: stats?.lastSecAction ?? '', icon: 'report' },
        ]}
      />
      <section className="os-workspace">
        <div className="os-workspace-primary">
          <DataPanel label="ACCÈS" title="Double authentification" chip={factors.length > 0 ? 'MFA actif' : 'MFA inactif'} kind="table" rows={[]}>
            {unavailable ? (
              <EmptyState title="MFA illisible" description="Impossible de lister les facteurs. Réessayez après reconnexion." />
            ) : (
              <MfaManager initialFactors={factors} />
            )}
          </DataPanel>
        </div>
        <InspectorBox
          content={{
            title: 'Audit Trail',
            subtitle: 'Sécurité 30 jours',
            headline: stats?.lastSecAction ?? 'Aucune action',
            text: 'Rôles, MFA et finances : toute action sensible est journalisée en append-only.',
            rows: stats
              ? [{ title: 'Actions sécurité', detail: 'rôles + MFA + finances', value: String(stats.secActions30d), tone: 'info' as const }]
              : [],
          }}
        />
      </section>
    </>
  );
}
