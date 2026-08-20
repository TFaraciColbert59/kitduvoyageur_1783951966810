import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { getAlerts } from '@/features/materiel/services/getAlerts';
import { AlertsTimeline } from '@/features/materiel/components/alertes/AlertsTimeline';

export const dynamic = 'force-dynamic';

const FR_LABEL: Record<string, string> = {
  info: 'info', warning: 'avertissement', critical: 'critique',
};

export default async function AlertesPage() {
  const alerts = await getAlerts();
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;
  const reliability = Math.max(0, 100 - alerts.length * 10);

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">Alertes & fiabilité</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 md:col-span-3 p-4" aria-labelledby="score-fiab">
          <Eyebrow>Score de fiabilité</Eyebrow>
          <Metric value={`${reliability}/100`} tone={critical > 0 ? 'danger' : reliability >= 70 ? 'sage' : 'default'} />
          <div className="mt-2 flex gap-2">
            {critical > 0 && <Badge tone="danger">{critical} critiques</Badge>}
            {warning > 0 && <Badge tone="warn">{warning} avertissements</Badge>}
          </div>
        </GlassCard>
        <GlassCard className="col-span-12 md:col-span-3 p-4" aria-labelledby="nb-alertes">
          <Eyebrow>Alertes actives</Eyebrow>
          <Metric value={alerts.length} />
        </GlassCard>
        <div className="col-span-12 md:col-span-6" />
        <div className="col-span-12">
          <AlertsTimeline
            entries={alerts.map((a) => ({
              id: a.id,
              date: new Date(a.created_at).toLocaleDateString('fr-FR'),
              message: a.message,
              severity: a.severity,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
