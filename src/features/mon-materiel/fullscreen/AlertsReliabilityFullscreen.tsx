'use client';

/**
 * LKDV — Mon Matériel • Plein écran « Alertes & fiabilité ».
 * Filtres par type, alertes critiques en évidence, cartes objet détaillées,
 * score de fiabilité, mini-calendrier de péremptions, alertes résolues repliables.
 */

import React, { useMemo } from 'react';
import Image from 'next/image';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { GearAlert } from '../domain/gear-alerts';
import type { GearStatus } from '../domain/gear-status';
import { countCritical } from '../domain/gear-alerts';
import { formatDateFr, pct } from '../domain/gear-format';
import { SectionCard } from '../components/SectionCard';
import { IconCheck, IconChevronRight } from '../components/icons';

export type AlertsFilterKey = 'all' | 'maintenance' | 'expiry' | 'loan' | 'wear' | 'departure_conflict';

export interface AlertsReliabilityFullscreenProps {
  alerts: GearAlert[];
  statuses: Map<string, GearStatus>;
  equipment: UserEquipmentItem[];
  filter: AlertsFilterKey;
  onFilterChange: (f: AlertsFilterKey) => void;
  resolvedIds: Set<string>;
  onToggleResolved: (id: string) => void;
  onOpenGear: (gearId: string) => void;
  onMarkReviewed: (gearId: string) => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

const FILTERS: [AlertsFilterKey, string][] = [
  ['all', 'Toutes'],
  ['maintenance', 'Entretien'],
  ['expiry', 'Péremption'],
  ['loan', 'Prêts'],
  ['wear', 'État'],
  ['departure_conflict', 'Conflits'],
];

const KIND_LABEL: Partial<Record<GearAlert['kind'], string>> = {
  maintenance_due: 'Entretien',
  maintenance_soon: 'Entretien',
  expired: 'Péremption',
  expiring_soon: 'Péremption',
  loan_active: 'Prêt',
  loan_overdue: 'Prêt',
  wear_repair: 'État',
  wear_replace: 'État',
  departure_conflict: 'Conflit',
  listed_for_sale: 'Vente',
};

const KIND_FILTER: Record<AlertsFilterKey, GearAlert['kind'][]> = {
  all: [],
  maintenance: ['maintenance_due', 'maintenance_soon'],
  expiry: ['expired', 'expiring_soon'],
  loan: ['loan_active', 'loan_overdue'],
  wear: ['wear_repair', 'wear_replace'],
  departure_conflict: ['departure_conflict'],
};

export function AlertsReliabilityFullscreen({
  alerts,
  statuses,
  equipment,
  filter,
  onFilterChange,
  resolvedIds,
  onToggleResolved,
  onOpenGear,
  onMarkReviewed,
  onToast,
}: AlertsReliabilityFullscreenProps) {
  const active = alerts.filter((a) => !resolvedIds.has(`${a.kind}-${a.gearId}`));
  const filtered = useMemo(
    () =>
      active.filter((a) => {
        if (filter === 'all') return true;
        return KIND_FILTER[filter].includes(a.kind);
      }),
    [active, filter]
  );

  const critical = countCritical(active);
  const reliabilityPct = pct(equipment.length - critical, equipment.length);

  // Regroupement par objet pour les cartes détaillées.
  const byGear = useMemo(() => {
    const map = new Map<string, { gear: UserEquipmentItem; alerts: GearAlert[] }>();
    for (const a of filtered) {
      if (!a.gearId) continue;
      const gear = equipment.find((g) => g.id === a.gearId);
      if (!gear) continue;
      const entry = map.get(gear.id) || { gear, alerts: [] };
      entry.alerts.push(a);
      map.set(gear.id, entry);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        countCritical(b.alerts) - countCritical(a.alerts) ||
        b.alerts.length - a.alerts.length
    );
  }, [filtered, equipment]);

  const criticalGroup = byGear.filter((g) => g.alerts.some((a) => a.severity === 'critical'));
  const otherGroup = byGear.filter((g) => !g.alerts.some((a) => a.severity === 'critical'));

  // Mini-calendrier des péremptions des 30 prochains jours.
  const expirationsSoon = useMemo(() => {
    const now = Date.now();
    return equipment
      .filter((g) => g.expiry_date)
      .map((g) => ({ gear: g, t: new Date(g.expiry_date!).getTime() }))
      .filter((e) => e.t >= now && e.t <= now + 30 * 86400000)
      .sort((a, b) => a.t - b.t);
  }, [equipment]);

  const resolvedCount = alerts.length - active.length;

  return (
    <div className="space-y-4">
      <SectionCard title="Fiabilité de l’équipement">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-5xl font-extrabold font-mono leading-none text-[#2D5A3D]">{reliabilityPct}%</div>
            <p className="text-xs text-[#1C2620]/70">
              {equipment.length - critical}/{equipment.length} objets sans alerte critique
            </p>
          </div>
          <div className="space-y-3 text-right">
            <div className="text-4xl font-extrabold font-mono leading-none text-[#8C6A1A]">{critical}</div>
            <p className="text-xs text-[#1C2620]/70 mt-1">alerte(s) critique(s)</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-[#1C2620]/7 overflow-hidden">
          <div className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500" style={{ width: `${reliabilityPct}%` }} />
        </div>
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-4">
          {/* Sidebar - Filtres */}
          <div className="lg:sticky lg:top-8">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFilterChange(key)}
                    className={`w-full text-left px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      filter === key ? 'bg-[#2D5A3D] text-white' : 'bg-white/50 text-[#1C2620]/80 border border-[#1C2620]/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-4">
            {expirationsSoon.length > 0 && (
              <SectionCard title="Péremptions des 30 prochains jours">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {expirationsSoon.map((e) => (
                    <button
                      key={e.gear.id}
                      type="button"
                      onClick={() => onOpenGear(e.gear.id)}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#8C6A1A]/8 border border-[#8C6A1A]/20 text-xs text-left hover:bg-[#8C6A1A]/15 transition-colors"
                    >
                      <span className="truncate font-semibold text-[#1C2620]/90">{e.gear.name}</span>
                      <span className="font-mono font-bold text-[#8C6A1A] shrink-0">
                        {new Date(e.gear.expiry_date!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            {criticalGroup.map(({ gear, alerts: gAlerts }) => (
              <GearAlertCard
                key={gear.id}
                gear={gear}
                alerts={gAlerts}
                status={statuses.get(gear.id)}
                onOpenGear={onOpenGear}
                onMarkReviewed={onMarkReviewed}
                onToast={onToast}
              />
            ))}
            {otherGroup.map(({ gear, alerts: gAlerts }) => (
              <GearAlertCard
                key={gear.id}
                gear={gear}
                alerts={gAlerts}
                status={statuses.get(gear.id)}
                onOpenGear={onOpenGear}
                onMarkReviewed={onMarkReviewed}
                onToast={onToast}
              />
            ))}

            {byGear.length === 0 && (
              <SectionCard title="Alertes">
                <p className="text-xs text-[#1C2620]/60">Aucune alerte dans cette catégorie.</p>
              </SectionCard>
            )}

            {resolvedCount > 0 && (
              <SectionCard
                title={`Alertes résolues (${resolvedCount})`}
                action={
                  <button
                    type="button"
                    onClick={() => onToggleResolved('__all__')}
                    className="text-xs font-bold text-[#2D5A3D] hover:underline"
                  >
                    Tout réafficher
                  </button>
                }
              >
                <div className="space-y-1.5">
                  {alerts
                    .filter((a) => resolvedIds.has(`${a.kind}-${a.gearId}`))
                    .slice(0, 10)
                    .map((a) => (
                      <div key={`${a.kind}-${a.gearId}`} className="p-2 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs flex items-center justify-between gap-2">
                        <span className="truncate text-[#1C2620]/70 line-through">{a.label}</span>
                        <button
                          type="button"
                          onClick={() => onToggleResolved(`${a.kind}-${a.gearId}`)}
                          className="text-[#2D5A3D] font-bold shrink-0"
                        >
                          Réafficher
                        </button>
                      </div>
                    ))}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function GearAlertCard({
  gear,
  alerts,
  status,
  onOpenGear,
  onMarkReviewed,
  onToast,
}: {
  gear: UserEquipmentItem;
  alerts: GearAlert[];
  status?: GearStatus;
  onOpenGear: (id: string) => void;
  onMarkReviewed: (id: string) => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}) {
  const critical = countCritical(alerts);
  const isMaintenance = alerts.some((a) => a.kind === 'maintenance_due' || a.kind === 'maintenance_soon');
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          {gear.name}
          {critical > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#9B2C2C]/10 text-[#9B2C2C] border border-[#9B2C2C]/30 font-mono">
              {critical} critique(s)
            </span>
          )}
        </span>
      }
      action={
        <button
          type="button"
          onClick={() => onOpenGear(gear.id)}
          aria-label={`Ouvrir la fiche ${gear.name}`}
          className="w-11 h-11 rounded-full bg-white/60 hover:bg-[#2D5A3D]/10 border border-[#1C2620]/10 flex items-center justify-center text-[#1C2620] transition-colors"
        >
          <IconChevronRight size={16} />
        </button>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-2xl bg-white/50 border border-[#1C2620]/8 overflow-hidden relative shrink-0 flex items-center justify-center p-1">
          <Image src={gear.image || '/assets/images/no_image.png'} alt={gear.name} width={52} height={52} className="object-contain max-h-full max-w-full" />
        </div>
        <div className="flex-1 min-w-0 grid gap-x-4 gap-y-1 sm:grid-cols-2 text-xs">
          <Meta label="Catégorie" value={gear.category || 'Autre'} />
          <Meta label="État" value={status?.conditionLabel || gear.condition || '—'} />
          <Meta label="Achat" value={formatDateFr(gear.acquired_at || gear.purchase_date, true)} />
          <Meta label="Dernier entretien" value={formatDateFr(gear.last_maintenance_date, true)} />
          <Meta label="Prochaine maintenance" value={formatDateFr(gear.next_maintenance_date, true)} />
          <Meta label="Dernière utilisation" value={formatDateFr(gear.last_used_date || undefined, true)} />
<Meta label="Utilisation" value={(gear.usage_count ?? 0) + ' fois'} />
        </div>
      </div>

      <div className="space-y-1.5">
        {alerts.map((a) => (
          <div
            key={`${a.kind}-${a.gearId}`}
            className={`p-2 rounded-xl border text-xs flex items-start justify-between gap-2 ${
              a.severity === 'critical'
                ? 'bg-[#9B2C2C]/8 border-[#9B2C2C]/20'
                : a.severity === 'warning'
                ? 'bg-[#8C6A1A]/8 border-[#8C6A1A]/20'
                : 'bg-white/40 border-[#1C2620]/7'
            }`}
          >
            <div className="min-w-0">
              <p className={`font-semibold truncate ${a.severity === 'critical' ? 'text-[#9B2C2C]' : 'text-[#1C2620]/90'}`}>
                {a.label}
              </p>
              <p className="text-[#1C2620]/70">{a.detail}</p>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/60 border border-[#1C2620]/10 font-mono text-[#1C2620]/60">
              {KIND_LABEL[a.kind] || a.kind}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {isMaintenance && (
          <button
            type="button"
            onClick={async () => {
              await onMarkReviewed(gear.id);
              onToast(`« ${gear.name} » marqué révisé`, 'success');
            }}
            className="px-3 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5"
          >
            <IconCheck size={13} /> Marquer révisé
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenGear(gear.id)}
          className="px-3 py-2 rounded-full bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/10 text-[#1C2620] text-xs font-bold min-h-[44px]"
        >
          Ouvrir la fiche
        </button>
      </div>
    </SectionCard>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="block text-[#1C2620]/45 uppercase font-mono text-[10px] tracking-wide">{label}</span>
      <span className="text-[#1C2620]/85 truncate block">{value}</span>
    </p>
  );
}