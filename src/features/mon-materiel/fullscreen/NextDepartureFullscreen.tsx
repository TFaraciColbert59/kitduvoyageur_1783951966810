'use client';

/**
 * LKDV — Mon Matériel • Plein écran « Prochain départ ».
 * Compte à rebours, statut global, score de préparation, poids/distance/météo,
 * « Ce qui bloque », checklist condensée, participants et validation de préparation
 * (snapshot + réservation matériel sur la période).
 */

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { DepartureChecklistItem, DepartureReadiness } from '../domain/departure-readiness';
import { countdownLabel, formatDateRange, formatTemp, formatWeather } from '../domain/gear-format';
import { kitTotalWeight } from '../domain/gear-completeness';
import { SectionCard } from '../components/SectionCard';
import { IconCheck, IconUsers } from '../components/icons';

export interface DepartureConsumables {
  waterL: number;
  meals: number;
  snacks: number;
  fuelG: number;
  advice: string;
}

export interface NextDepartureFullscreenProps {
  hike: PlannedHike;
  plannedHikes: PlannedHike[];
  kits: CustomKit[];
  kit: CustomKit | null;
  equipment: UserEquipmentItem[];
  readiness: DepartureReadiness;
  checklist: DepartureChecklistItem[];
  checkedSet: Set<string>;
  onToggleChecked: (id: string) => void;
  onSelectHike: (h: PlannedHike) => void;
  onAssignKit: (hikeId: string, kitId: string) => void;
  onDeleteHike: (hikeId: string) => void;
  onValidate: () => void;
  consumables?: DepartureConsumables | null;
  recommended?: { kit: CustomKit | null; score: number | null };
  onOpenGear?: (gearId: string) => void;
  /** Ouvre le plein écran « Inventaire & catalogue » pré-filtré sur un objet. */
  onNeedStock?: (query: string) => void;
}

export function NextDepartureFullscreen({
  hike,
  plannedHikes,
  kits,
  kit,
  equipment: _equipment,
  readiness,
  checklist,
  checkedSet,
  onToggleChecked,
  onSelectHike,
  onAssignKit,
  onDeleteHike,
  onValidate,
  consumables,
  recommended,
  onOpenGear,
  onNeedStock,
}: NextDepartureFullscreenProps) {
  const d = useMemo(() => countdownLabel(hike.targetDate), [hike]);
  const kitWeight = kit ? kitTotalWeight(kit) : 0;
  const readinessLabel =
    readiness.status === 'ready'
      ? { text: 'Prêt', cls: 'bg-[#2D5A3D]/10 text-[#235030] border-[#2D5A3D]/30' }
      : readiness.status === 'to_check'
      ? { text: 'À vérifier', cls: 'bg-[#8C6A1A]/10 text-[#8C6A1A] border-[#8C6A1A]/30' }
      : { text: 'Bloqué', cls: 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/30' };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Prochain départ"
        action={
          <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${readinessLabel.cls}`}>
            {readinessLabel.text}
          </span>
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-[#2D5A3D]/10 text-[#2D5A3D] text-xs font-bold font-mono border border-[#2D5A3D]/25">
            {d}
          </span>
          <span className="text-xs text-[#1C2620]/60">{formatDateRange(hike)}</span>
        </div>
        <div>
          <h3 className="text-2xl font-extrabold text-[#1C2620]">{hike.name}</h3>
          <p className="text-xs text-[#1C2620]/70 mt-1">
            {hike.terrain || hike.season || 'Randonnée'}
            {hike.companions ? ` · Compagnons : ${hike.companions}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Distance" value={`${hike.distanceKm} km`} />
          <Stat label="Dénivelé D+" value={`+${hike.elevationGain || 0} m`} />
          <Stat label="Durée" value={hike.isOvernight ? `${(hike.nightsCount || 1) + 1} j` : '1 j'} />
          <Stat label={`Météo ${formatTemp(hike)}`} value={formatWeather(hike)} />
        </div>

        {consumables && (consumables.waterL > 0 || consumables.meals > 0 || consumables.fuelG > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {consumables.waterL > 0 && <Chip label={`${consumables.waterL.toFixed(1).replace('.', ',')} L d’eau`} />}
            {consumables.meals > 0 && <Chip label={`${consumables.meals} repas`} />}
            {consumables.snacks > 0 && <Chip label={`${consumables.snacks} en-cas`} />}
            {consumables.fuelG > 0 && <Chip label={`${consumables.fuelG} g gaz`} />}
            <Chip label={consumables.advice} tone="warning" />
          </div>
        )}

        {hike.routeId ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/randonnee-active?routeId=${hike.routeId}`}
              className="px-4 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold"
            >
              Démarrer l’itinéraire
            </Link>
            <Link
              href={`/preparer-randonnee?routeId=${hike.routeId}`}
              className="px-4 py-2 rounded-full bg-white/60 hover:bg-[#1C2620]/6 text-[#1C2620] text-xs font-bold border border-[#1C2620]/10"
            >
              Itinéraire détaillé
            </Link>
          </div>
        ) : (
          <p className="text-xs text-[#1C2620]/60">Randonnée créée manuellement — aucun itinéraire lié.</p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Kit pour ce départ">
          <select
            value={hike.assignedKitId || ''}
            onChange={(e) => onAssignKit(hike.id, e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#1C2620]/14 text-xs text-[#1C2620] focus:outline-none focus:border-[#2D5A3D] cursor-pointer"
          >
            {kits.length === 0 && <option value="">Aucun kit</option>}
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({kitTotalWeight(k).toLocaleString('fr-FR')} g)
              </option>
            ))}
          </select>
          {kit && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#1C2620]/80">
                  Prêt : <strong className="text-[#1C2620]">{readiness.ownedCount}/{readiness.totalCount}</strong>
                </span>
                <span className="font-mono font-bold text-[#2D5A3D]">{readiness.readinessPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C2620]/7 overflow-hidden">
                <div
                  className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500"
                  style={{ width: `${readiness.readinessPct}%` }}
                />
              </div>
              <p className="text-xs text-[#1C2620]/60">Poids du kit : {(kitWeight / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg</p>
            </>
          )}
          {recommended?.kit && recommended.kit.id !== kit?.id && (
            <div className="rounded-xl bg-[#2D5A3D]/8 border border-[#2D5A3D]/25 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-[#2D5A3D]">
                Kit recommandé : {recommended.kit.name}
                {recommended.score !== null ? ` · score ${recommended.score}/100` : ''}
              </p>
              <button
                type="button"
                onClick={() => onAssignKit(hike.id, recommended.kit!.id)}
                className="px-3 py-1.5 rounded-full bg-[#2D5A3D] text-white text-xs font-bold"
              >
                Utiliser ce kit
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={`Ce qui bloque (${readiness.blockers.length})`}
          action={
            readiness.blockers.length === 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 text-[#235030] border border-[#2D5A3D]/30 text-xs font-bold">
                Tout est prêt
              </span>
            ) : undefined
          }
        >
          {readiness.blockers.length === 0 ? (
            <p className="text-xs text-[#1C2620]/60">Aucun blocant — vous pouvez valider la préparation.</p>
          ) : (
            <div className="space-y-2">
              {readiness.blockers.map((b) => (
                <div key={b.id} className="p-2.5 rounded-xl bg-[#9B2C2C]/6 border border-[#9B2C2C]/15 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#1C2620]/90 truncate">{b.label}</p>
                    {b.gearId && onOpenGear ? (
                      <button
                        type="button"
                        onClick={() => onOpenGear(b.gearId!)}
                        className="px-2 py-1 rounded-lg bg-white/60 border border-[#1C2620]/10 text-[#2D5A3D] font-bold shrink-0"
                      >
                        Ouvrir la fiche
                      </button>
                    ) : (
                      <span className="shrink-0 text-[#9B2C2C] font-mono font-bold">Bloquant</span>
                    )}
                  </div>
                  <p className="text-[#1C2620]/70 mt-0.5">{b.detail}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`Checklist condensée (${checklist.filter((c) => !checkedSet.has(c.id)).length} restants)`}>
        <div className="space-y-1.5">
          {checklist.slice(0, 8).map((it) => {
            const checked = checkedSet.has(it.id);
            const hasStockInfo = typeof it.availableQty === 'number' && typeof it.requiredQty === 'number';
            const outOfStock = hasStockInfo && it.availableQty === 0;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onToggleChecked(it.id)}
                aria-pressed={checked}
                className="w-full text-left p-2 rounded-xl bg-white/40 hover:bg-white/60 border border-[#1C2620]/7 text-xs flex items-center justify-between gap-2 min-h-[44px] transition-colors"
              >
                <span className={`min-w-0 truncate ${checked ? 'text-[#1C2620]/45 line-through' : 'text-[#1C2620]/90'}`}>
                  {it.label}
                </span>
                {hasStockInfo ? (
                  outOfStock && onNeedStock ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNeedStock(it.searchQuery || it.label);
                      }}
                      aria-label={`Ajouter à l’inventaire ${it.label}`}
                      className="px-2.5 py-1 rounded-full bg-[#9B2C2C]/10 border border-[#9B2C2C]/30 text-[#9B2C2C] font-bold shrink-0"
                    >
                      Aucun stock — ajouter
                    </button>
                  ) : (
                    <span
                      data-stock-count
                      className={`px-2 py-0.5 rounded-full border font-mono font-bold shrink-0 ${
                        outOfStock
                          ? 'bg-[#9B2C2C]/8 border-[#9B2C2C]/25 text-[#9B2C2C]'
                          : 'bg-[#2D5A3D]/8 border-[#2D5A3D]/25 text-[#2D5A3D]'
                      }`}
                    >
                      {it.availableQty}/{it.requiredQty}
                    </span>
                  )
                ) : (
                  <span
                    className={`w-6 h-6 rounded-md border shrink-0 flex items-center justify-center ${
                      checked ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white' : 'border-[#1C2620]/30 text-transparent'
                    }`}
                  >
                    <IconCheck size={12} />
                  </span>
                )}
              </button>
            );
          })}
          {checklist.length > 8 && (
            <p className="text-xs text-[#1C2620]/60">+ {checklist.length - 8} autres éléments — voir « À ne pas oublier ».</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title={`Participants (${hike.companions ? 'renseignés' : 'aucun'})`}>
        <div className="flex items-center gap-2 text-xs text-[#1C2620]/70">
          <IconUsers size={16} className="text-[#2D5A3D]" />
          <p>
            {hike.companions || 'Aucun compagnon renseigné.'}{' '}
            <span className="text-[#1C2620]/45">Pensez à prévenir un contact en cas d’urgence.</span>
          </p>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onValidate}
          className="px-6 py-3 rounded-full bg-[#2D5A3D] hover:bg-[#235030] text-white text-sm font-bold transition-all active:scale-95 inline-flex items-center gap-2"
        >
          <IconCheck size={16} /> Valider ma préparation
        </button>
        <button
          type="button"
          onClick={() => onDeleteHike(hike.id)}
          className="px-4 py-2.5 rounded-full bg-[#9B2C2C]/8 hover:bg-[#9B2C2C]/15 text-[#9B2C2C] text-xs font-bold border border-[#9B2C2C]/25 transition-colors"
        >
          Supprimer la sortie
        </button>
      </div>

      <SectionCard title={`Toutes les sorties (${plannedHikes.length})`}>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {plannedHikes.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelectHike(h)}
              className={`px-3 py-1.5 rounded-xl text-left border shrink-0 transition-all ${
                h.id === hike.id
                  ? 'bg-[#2D5A3D]/10 border-[#2D5A3D]/50 text-[#1C2620] font-bold'
                  : 'bg-white/40 border-[#1C2620]/7 text-[#1C2620]/70'
              }`}
            >
              <span className="block text-xs truncate max-w-[140px]">{h.name}</span>
              <span className="text-xs font-mono text-[#2D5A3D]">{countdownLabel(h.targetDate)}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7">
      <span className="block text-lg font-bold font-mono text-[#1C2620] leading-none truncate">{value}</span>
      <span className="block text-xs text-[#1C2620]/70 mt-1">{label}</span>
    </div>
  );
}

function Chip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'warning' }) {
  return (
    <span
      className={`px-2 py-1 rounded-lg text-xs border ${
        tone === 'warning'
          ? 'bg-white/40 text-[#8C6A1A] border-[#8C6A1A]/25'
          : 'bg-white/50 text-[#1C2620]/85 border-[#1C2620]/7'
      }`}
    >
      {label}
    </span>
  );
}