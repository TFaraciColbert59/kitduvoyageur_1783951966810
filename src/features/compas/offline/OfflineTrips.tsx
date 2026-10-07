'use client';

/**
 * Aventures du Compas gardées sur l'appareil, relues sans réseau.
 * Les données viennent d'IndexedDB (`compas_snapshots`), jamais du serveur :
 * la page `/hors-ligne` reste publique et cacheable (règle SEC-1).
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, type BadgeTone } from '@/components/ui';
import type { CompasSnapshot } from './snapshot';

const FR_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const FR_DATETIME = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function dayDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : FR_DATE.format(d);
}

function walk(min: number | null): string | null {
  if (min == null || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

const VERDICT: Record<CompasSnapshot['verdict']['level'], { label: string; tone: BadgeTone }> = {
  go: { label: 'Prêt', tone: 'sage' },
  vigilance: { label: 'Vigilance', tone: 'warn' },
  bloque: { label: 'Bloqué', tone: 'danger' },
  incomplet: { label: 'Incomplet', tone: 'stone' },
};

const text = 'text-[color:var(--lkv-text-primary)]';
const muted = 'text-[color:var(--lkv-text-muted)]';

export function OfflineTrips() {
  const [trips, setTrips] = useState<CompasSnapshot[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { listCompasSnapshots } = await import('@/lib/offlineStorage');
      const list = await listCompasSnapshots<CompasSnapshot>();
      list.sort((a, b) => (a.dates.start ?? '9999').localeCompare(b.dates.start ?? '9999'));
      setTrips(list);
      if (list.length === 1) setOpen(list[0].key);
    } catch {
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!trips || trips.length === 0) return null;

  return (
    <section aria-labelledby="offline-trips-title" className="space-y-[var(--space-3)]">
      <h2 id="offline-trips-title" className={`px-[var(--space-1)] text-[length:var(--lkv-text-body)] font-semibold ${text}`}>
        Mes aventures préparées
      </h2>
      {trips.map((t) => {
        const isOpen = open === t.key;
        const verdict = VERDICT[t.verdict.level];
        const toPack = t.kit.lines.filter((l) => !l.packed);
        return (
          <Card key={t.key} className="overflow-hidden p-0">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`offline-trip-${t.tripId}`}
              onClick={() => setOpen(isOpen ? null : t.key)}
              className="flex min-h-[var(--lkv-touch-min)] w-full items-start justify-between gap-[var(--space-2)] p-[var(--space-4)] text-left"
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-[length:var(--lkv-text-body-sm)] font-semibold leading-tight ${text}`}>{t.title}</span>
                <span className={`mt-1 block text-[length:var(--lkv-text-caption)] ${muted}`}>
                  {t.dates.label}
                  {t.days.length ? ` · ${t.days.length} étape${t.days.length > 1 ? 's' : ''}` : ''}
                  {t.route.distanceKm ? ` · ${Math.round(t.route.distanceKm)} km` : ''}
                </span>
                <span className={`mt-1 block text-[length:var(--lkv-text-caption-2)] ${muted}`}>
                  Enregistrée le {FR_DATETIME.format(new Date(t.savedAt))}
                </span>
              </span>
              <Badge tone={verdict.tone} className="shrink-0">
                {verdict.label}
              </Badge>
            </button>

            {isOpen && (
              <div id={`offline-trip-${t.tripId}`} className="space-y-[var(--space-4)] border-t border-[color:var(--lkv-border)] p-[var(--space-4)]">
                {t.emergency && (
                  <div>
                    <h3 className={`text-[length:var(--lkv-text-caption)] font-semibold uppercase tracking-[0.1em] ${muted}`}>
                      Urgences · {t.emergency.label}
                    </h3>
                    <ul className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)]">
                      {t.emergency.numbers.map((n) => (
                        <li key={n.number}>
                          <a
                            href={`tel:${n.number}`}
                            className={`inline-flex min-h-[var(--lkv-touch-min)] items-center gap-2 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] px-3 font-semibold ${text}`}
                          >
                            {n.number}
                            <span className={`font-normal ${muted}`}>{n.use}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {t.days.length > 0 && (
                  <div>
                    <h3 className={`text-[length:var(--lkv-text-caption)] font-semibold uppercase tracking-[0.1em] ${muted}`}>Itinéraire</h3>
                    <ol className="mt-[var(--space-2)] space-y-[var(--space-2)]">
                      {t.days.map((d) => {
                        const w = t.weather.days.find((x) => d.date && x.date === d.date.slice(0, 10));
                        const facts = [
                          d.distanceKm ? `${Math.round(d.distanceKm * 10) / 10} km` : null,
                          d.gainM ? `D+ ${Math.round(d.gainM)} m` : null,
                          walk(d.walkMin),
                        ].filter(Boolean);
                        return (
                          <li key={d.day} className="rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] p-[var(--space-3)]">
                            <p className={`text-[length:var(--lkv-text-body-sm)] font-semibold ${text}`}>
                              Jour {d.day}
                              {dayDate(d.date) ? ` · ${dayDate(d.date)}` : ''} · {d.title}
                            </p>
                            {facts.length > 0 && <p className={`text-[length:var(--lkv-text-caption)] ${muted}`}>{facts.join(' · ')}</p>}
                            {d.stay && <p className={`text-[length:var(--lkv-text-caption)] ${muted}`}>Nuit : {d.stay}</p>}
                            {w && (
                              <p className={`text-[length:var(--lkv-text-caption)] ${muted}`}>
                                Météo lue le {FR_DATETIME.format(new Date(t.weather.readAt))} : {Math.round(w.minC)}° / {Math.round(w.maxC)}°
                                {w.precipMm != null ? ` · ${w.precipMm} mm` : ''}
                                {w.precipPct != null ? ` · pluie ${w.precipPct} %` : ''}
                              </p>
                            )}
                            {d.lat != null && d.lon != null && (
                              <p className={`text-[length:var(--lkv-text-caption-2)] ${muted}`}>
                                GPS {d.lat.toFixed(5)}, {d.lon.toFixed(5)}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    <p className={`mt-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] ${muted}`}>Météo : {t.weather.source}</p>
                  </div>
                )}

                {t.kit.lines.length > 0 && (
                  <div>
                    <h3 className={`text-[length:var(--lkv-text-caption)] font-semibold uppercase tracking-[0.1em] ${muted}`}>
                      Sac · {t.kit.packedPct ?? 0} % emballé
                      {toPack.length ? ` · ${toPack.length} à emballer` : ''}
                    </h3>
                    <ul className="mt-[var(--space-2)] space-y-1">
                      {t.kit.lines.map((l, i) => (
                        <li key={`${l.name}-${i}`} className={`flex items-center gap-2 text-[length:var(--lkv-text-body-sm)] ${text}`}>
                          <span aria-hidden="true">{l.packed ? '✓' : '○'}</span>
                          <span className="min-w-0 flex-1">
                            {l.quantity > 1 ? `${l.quantity} × ` : ''}
                            {l.name}
                            {l.vital ? <span className={muted}> · vital</span> : null}
                          </span>
                          <span className="sr-only">{l.packed ? 'emballé' : 'pas encore emballé'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(t.budget.planned > 0 || t.budget.spent > 0) && (
                  <p className={`text-[length:var(--lkv-text-caption)] ${muted}`}>
                    Budget : {money(t.budget.planned, t.budget.currency)} prévus · {money(t.budget.spent, t.budget.currency)} dépensés
                    {t.budget.perPerson != null ? ` · ${money(t.budget.perPerson, t.budget.currency)} par personne` : ''}
                  </p>
                )}

                {t.verdict.reasons.length > 0 && (
                  <ul className={`list-disc pl-5 text-[length:var(--lkv-text-caption)] ${muted}`}>
                    {t.verdict.reasons.slice(0, 5).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}

                <p className={`text-[length:var(--lkv-text-caption-2)] ${muted}`}>
                  Version enregistrée sur cet appareil. Les changements se font dans le Compas, une fois en ligne.
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </section>
  );
}
