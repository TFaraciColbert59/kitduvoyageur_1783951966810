import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

interface MaintenanceEvent { item: string; date: string }

/** W-L-8 MaintenanceCalendar — calendrier mensuel des rappels d'entretien. */
export function MaintenanceCalendar({ events }: { events: MaintenanceEvent[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay = new Map<number, MaintenanceEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const arr = byDay.get(d.getDate()) ?? [];
      arr.push(e);
      byDay.set(d.getDate(), arr);
    }
  }
  const cells: (number | null)[] = [
    ...Array.from({ length: first }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <GlassCard as="article" ariaLabelledBy="cal-title" className="p-4">
      <Eyebrow>Calendrier entretien</Eyebrow>
      <h3 id="cal-title" className="sr-only">Rappels d'entretien du mois</h3>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {['D','L','M','M','J','V','S'].map((d, i) => <span key={i} className="text-[10px] text-[color:var(--label-tertiary)]">{d}</span>)}
        {cells.map((day, i) => (
          <div key={i} className={`h-8 flex items-center justify-center text-xs rounded-[var(--r-sm)] ${day === null ? '' : 'bg-stone-100'}`}>
            {day !== null && (
              byDay.has(day) ? <Badge tone="warn">{day}</Badge> : <span className="text-[color:var(--label)]">{day}</span>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
