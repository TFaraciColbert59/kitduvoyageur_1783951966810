'use client';

/**
 * LKDV — Mon Matériel • Plein écran « Disponibilité ».
 * Onglets : Prêté par moi / Emprunté par moi / Engagé dans un départ.
 * Synthèse, timeline par objet (prêt, départ, conflits) et actions
 * (relancer, marquer rendu, résoudre le conflit).
 */

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';
import type { GearAvailability, AvailabilitySlot } from '../domain/gear-availability';
import type { GearStatus } from '../domain/gear-status';
import type { GearLoanRecord } from '../types';
import { formatDateFr, formatEuro } from '../domain/gear-format';
import { SectionCard } from '../components/SectionCard';
import { IconCheck, IconRefresh } from '../components/icons';

export interface AvailabilityFullscreenProps {
  equipment: UserEquipmentItem[];
  statuses: Map<string, GearStatus>;
  availability: Map<string, GearAvailability>;
  activeLoans: GearLoanRecord[];
  committedGear: UserEquipmentItem[];
  activeDeparture: PlannedHike | null;
  onMarkReturned: (gearId: string) => Promise<void>;
  onNudge: (gearId: string) => void;
  onOpenGear: (gearId: string) => void;
  onOpenDeparture: () => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

type Tab = 'lent' | 'borrowed' | 'engaged';

const SLOT_COLORS: Record<AvailabilitySlot['reason'], { text: string; label: string }> = {
  on_loan: { text: 'Prêté', label: 'text-[#8C6A1A] bg-[#8C6A1A]/10 border-[#8C6A1A]/25' },
  departure: { text: 'Départ', label: 'text-[#2D5A3D] bg-[#2D5A3D]/10 border-[#2D5A3D]/25' },
  maintenance: { text: 'Maintenance', label: 'text-[#9B2C2C] bg-[#9B2C2C]/10 border-[#9B2C2C]/25' },
  expired: { text: 'Périmé', label: 'text-[#9B2C2C] bg-[#9B2C2C]/10 border-[#9B2C2C]/25' },
  unowned: { text: 'À acquérir', label: 'text-[#2D5A3D] bg-[#2D5A3D]/10 border-[#2D5A3D]/25' },
};

export function AvailabilityFullscreen({
  equipment,
  statuses,
  availability,
  activeLoans: _activeLoans,
  committedGear,
  activeDeparture,
  onMarkReturned,
  onNudge,
  onOpenGear,
  onOpenDeparture,
  onToast,
}: AvailabilityFullscreenProps) {
  const [tab, setTab] = useState<Tab>('lent');

  const lentItems = useMemo(
    () =>
      equipment.filter((g) => {
        const st = statuses.get(g.id);
        return st?.loan.active || g.loan_status === 'prêté' || Boolean(g.loan_to_name);
      }),
    [equipment, statuses]
  );

  const borrowedItems = useMemo(
    () => equipment.filter((g) => (statuses.get(g.id)?.borrowed.active ?? false) === true),
    [equipment, statuses]
  );

  const engagedItems = useMemo(
    () => committedGear.filter((g) => equipment.some((e) => e.id === g.id)),
    [committedGear, equipment]
  );

  const unavailableCount = useMemo(
    () => Array.from(availability.values()).filter((a) => !a.available).length,
    [availability]
  );

  const outOfHomeValue = useMemo(
    () => lentItems.reduce((sum, g) => sum + (Number(g.purchase_price) || 0) * (g.quantity || 1), 0),
    [lentItems]
  );

  const conflictCount = useMemo(
    () => Array.from(availability.values()).filter((a) => a.conflicts.length > 0).length,
    [availability]
  );

  const list = tab === 'lent' ? lentItems : tab === 'borrowed' ? borrowedItems : engagedItems;

  return (
    <div className="space-y-4">
      <SectionCard title="Synthèse de disponibilité">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Synth value={unavailableCount} label="Indisponibles" />
          <Synth value={formatEuro(outOfHomeValue)} label="Valeur hors domicile" />
          <Synth value={conflictCount} label="Conflits" />
          <Synth value={lentItems.length} label="En prêt" />
        </div>
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-4">
          {/* Tabs sidebar */}
          <div className="lg:sticky lg:top-8">
            <div className="flex gap-1 flex-wrap">
              {(
                [
                  ['lent', `Prêté par moi (${lentItems.length})`],
                  ['borrowed', `Emprunté par moi (${borrowedItems.length})`],
                  ['engaged', `Engagé dans un départ (${engagedItems.length})`],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`w-full text-left px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                    tab === key ? 'bg-[#2D5A3D] text-white' : 'bg-white/50 text-[#1C2620]/80 border border-[#1C2620]/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-4">
            {tab === 'engaged' && (
              <SectionCard
                title={activeDeparture ? `Engagement pour « ${activeDeparture.name} »` : 'Engagement départ'}
                action={
                  activeDeparture ? (
                    <button type="button" onClick={onOpenDeparture} className="text-xs font-bold text-[#2D5A3D] hover:underline">
                      Voir le départ
                    </button>
                  ) : undefined
                }
              >
                {!activeDeparture ? (
                  <p className="text-xs text-[#1C2620]/60">Aucun départ planifié avec kit assigné.</p>
                ) : (
                  <p className="text-xs text-[#1C2620]/70">
                    {engagedItems.length} objet(s) réservés pour ce départ — ils deviennent indisponibles sur la période.
                  </p>
                )}
              </SectionCard>
            )}

            {list.length === 0 ? (
              <SectionCard title="Disponibilité">
                <p className="text-xs text-[#1C2620]/60">Rien à afficher dans cet onglet.</p>
              </SectionCard>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((gear) => {
                  const st = statuses.get(gear.id);
                  const av = availability.get(gear.id);
                  return (
                    <div key={gear.id} className="rounded-2xl bg-white/60 border border-[#1C2620]/7 p-3 flex items-start gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white/60 border border-[#1C2620]/8 overflow-hidden relative shrink-0 flex items-center justify-center p-1">
                        <Image src={gear.image || '/assets/images/no_image.png'} alt={gear.name} width={44} height={44} className="object-contain max-h-full max-w-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1C2620] truncate">{gear.name}</p>
                        <p className="text-xs text-[#1C2620]/60 truncate">
                          {gear.category || 'Autre'}
                          {st?.loan.to ? ` · prêté à ${st.loan.to}` : ''}
                          {st?.engagement.departureName ? ` · ${st.engagement.departureName}` : ''}
                          {gear.usage_count !== undefined && (
                            <>
                              <span className="ml-1 text-[#1C2620]/60">·</span>
                              <span className="font-mono text-[#2D5A3D]">{gear.usage_count}</span>
                              <span className="text-[#1C2620]/60">fois</span>
                            </>
                          )}
                        </p>

                        {av && !av.available && (
                          <div className="mt-1.5 space-y-1">
                            {av.blocks.map((slot) => (
                              <div key={slot.id} className="flex items-center gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full border font-mono font-bold ${SLOT_COLORS[slot.reason].label}`}>
                                  {SLOT_COLORS[slot.reason].text}
                                </span>
                                <span className="text-[#1C2620]/75 truncate">{slot.label}</span>
                                {slot.from && <span className="text-[#1C2620]/45 shrink-0">{formatDateFr(slot.from, true)}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {av?.available && (
                          <p className="text-xs text-[#2D5A3D] font-semibold mt-1.5">Disponible</p>
                        )}

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <MiniBtn
                            label="Marquer rendu"
                            primary
                            onClick={() =>
                              void onMarkReturned(gear.id).then(() => onToast(`« ${gear.name} » marqué rendu`, 'success'))
                            }
                            icon={<IconCheck size={13} />}
                          />
                          <MiniBtn
                            label="Relancer"
                            onClick={() => {
                              onNudge(gear.id);
                              onToast('Relance enregistrée', 'info');
                            }}
                            icon={<IconRefresh size={13} />}
                          />
                          <MiniBtn label="Ouvrir la fiche" onClick={() => onOpenGear(gear.id)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Synth({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7">
      <span className="block text-lg font-bold font-mono text-[#1C2620] leading-none truncate">{value}</span>
      <span className="block text-xs text-[#1C2620]/70 mt-1">{label}</span>
    </div>
  );
}

function MiniBtn({
  label,
  onClick,
  primary = false,
  icon,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-full border text-xs font-bold transition-colors min-h-[44px] inline-flex items-center gap-1 ${
        primary
          ? 'bg-[#2D5A3D] text-white border-[#2D5A3D] hover:bg-[#235030]'
          : danger
          ? 'bg-[#9B2C2C]/8 border-[#9B2C2C]/20 text-[#9B2C2C]'
          : 'bg-white/60 border-[#1C2620]/10 text-[#1C2620]/80 hover:bg-[#2D5A3D]/8'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}