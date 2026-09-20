import { Card } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

export interface DispoKpisData { active: number; overdue: number; returned: number; totalObjects: number }

/** W-A-2 DispoKpis — 4 tuiles KPI. */
export function DispoKpis({ data }: { data: DispoKpisData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Indicateurs de disponibilité">
      <Card className="p-4"><Eyebrow>Prêts en cours</Eyebrow><Metric value={data.active} tone={data.active > 0 ? 'danger' : 'sage'} /></Card>
      <Card className="p-4"><Eyebrow>En retard</Eyebrow><Metric value={data.overdue} tone={data.overdue > 0 ? 'danger' : 'default'} /></Card>
      <Card className="p-4"><Eyebrow>Rendus</Eyebrow><Metric value={data.returned} tone="sage" /></Card>
      <Card className="p-4"><Eyebrow>Objets</Eyebrow><Metric value={data.totalObjects} /></Card>
    </div>
  );
}
