'use client';

/**
 * LKDV — Mon Matériel • Plein écran « Mes kits ».
 * Onglets (Mes kits / Kit du prochain départ / Corbeille), recherche & tri,
 * détail de kit (répartition par catégorie, disponibles/prêtés/périmés/manquants,
 * substituts), actions complètes.
 */

import React, { useMemo, useState } from 'react';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { PlannedHike } from '@/lib/preparation/plannedHikes';
import {
  evaluateKitCompleteness,
  findSubstitutes,
  kitTotalWeight,
} from '../domain/gear-completeness';
import { countdownLabel, formatDateFr, formatWeight } from '../domain/gear-format';
import { SectionCard } from '../components/SectionCard';
import {
  IconBackpack,
  IconCopy,
  IconPlus,
  IconTrash,
} from '../components/icons';

export interface MyKitsFullscreenProps {
  kits: CustomKit[];
  trashKits: CustomKit[];
  trashCount: number;
  equipment: UserEquipmentItem[];
  activeHike: PlannedHike | null;
  onOpenKit: (kit: CustomKit) => void;
  onCreateKit: () => void;
  onAssignKit: (hikeId: string, kitId: string) => void;
  onRestore: (kitId: string) => void;
  onPermanentDelete: (kitId: string) => void;
  onDuplicateKit: (kit: CustomKit) => void;
  onOpenGear?: (gearId: string) => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

type Tab = 'kits' | 'next' | 'trash';

export function MyKitsFullscreen({
  kits,
  trashKits,
  trashCount,
  equipment,
  activeHike,
  onOpenKit,
  onCreateKit,
  onAssignKit,
  onRestore,
  onPermanentDelete,
  onDuplicateKit,
  onOpenGear,
  onToast,
}: MyKitsFullscreenProps) {
  const [tab, setTab] = useState<Tab>('kits');
  const [search, setSearch] = useState('');
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [sort, setSort] = useState<'recent' | 'usage' | 'weight' | 'name'>('recent');

  const nextKit = useMemo(() => {
    if (!activeHike?.assignedKitId) return null;
    return kits.find((k) => k.id === activeHike.assignedKitId) || null;
  }, [kits, activeHike]);

  const sorted = useMemo(() => {
    const filtered = kits.filter(
      (k) => k.name.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (sort === 'weight') return kitTotalWeight(b) - kitTotalWeight(a);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'usage') return (b.last_used_at || 0) - (a.last_used_at || 0);
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });
  }, [kits, search, sort]);

  const selectedKit = kits.find((k) => k.id === selectedKitId) || null;

  return (
    <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
      {/* Sidebar - Controls and Tabs */}
      <div className="lg:sticky lg:top-8">
        <SectionCard title={`Mes kits (${kits.length})`} action={<HeaderTabs tab={tab} onChange={setTab} trashCount={trashCount} />}>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un kit…"
              className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-white/60 border border-[#1C2620]/10 text-xs text-[#1C2620] placeholder-[#1C2620]/45 focus:outline-none focus:border-[#2D5A3D]"
              aria-label="Rechercher un kit"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-2.5 py-2 rounded-xl bg-white/60 border border-[#1C2620]/10 text-xs text-[#1C2620] focus:outline-none"
              aria-label="Trier les kits"
            >
              <option value="recent">Récents</option>
              <option value="usage">Utilisation</option>
              <option value="weight">Poids</option>
              <option value="name">Nom</option>
            </select>
            <button
              type="button"
              onClick={onCreateKit}
              className="px-4 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5"
            >
              <IconPlus size={14} /> Nouveau kit
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {tab === 'kits' && (
          <>
            {sorted.length === 0 && (
              <SectionCard title="Kits">
                <p className="text-xs text-[#1C2620]/60">Aucun kit actif — créez votre premier kit.</p>
              </SectionCard>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {sorted.map((kit) => {
                const completeness = evaluateKitCompleteness(kit, equipment);
                const assigned = activeHike?.assignedKitId === kit.id;
                return (
                  <SectionCard
                    key={kit.id}
                    title={
                      <span className="inline-flex items-center gap-2">
                        {kit.name}
                        {assigned && (
                          <span className="px-2 py-0.5 rounded-full bg-[#2D5A3D]/10 text-[#235030] border border-[#2D5A3D]/30 font-mono text-[10px]">
                            Kit départ
                          </span>
                        )}
                      </span>
                    }
                    action={<KitActions kit={kit} onOpen={onOpenKit} onDuplicate={onDuplicateKit} />}
                  >
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#1C2620]/75">
                      <span>{kit.activity || 'Randonnée'}</span>
                      {kit.season && <span>· {kit.season}</span>}
                      <span>· {kit.items?.length || 0} articles</span>
                      <span>· {formatWeight(kitTotalWeight(kit))}</span>
                      {kit.last_used_at && <span>· utilisé {formatDateFr(kit.last_used_at, true)}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#1C2620]/70">
                        Prêt : <strong className="text-[#1C2620]">{completeness.availableCount}/{completeness.totalItems}</strong>
                        {completeness.missingCount > 0 && (
                          <span className="ml-1 text-[#9B2C2C]">· {completeness.missingCount} manquant(s)</span>
                        )}
                        {completeness.unavailableCount > 0 && (
                          <span className="ml-1 text-[#8C6A1A]">· {completeness.unavailableCount} indisponible(s)</span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-[#2D5A3D]">{completeness.availabilityPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1C2620]/7 overflow-hidden">
                      <div className="h-full bg-[#2D5A3D] rounded-full transition-all duration-500" style={{ width: `${completeness.availabilityPct}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedKitId(selectedKitId === kit.id ? null : kit.id)}
                        className="px-3 py-1.5 rounded-full bg-[#2D5A3D]/10 border border-[#2D5A3D]/30 text-[#2D5A3D] text-xs font-bold min-h-[44px]"
                      >
                        {selectedKitId === kit.id ? 'Masquer le détail' : 'Voir le détail'}
                      </button>
                      {activeHike && (
                        <button
                          type="button"
                          onClick={() => {
                            onAssignKit(activeHike.id, kit.id);
                            onToast(`Kit « ${kit.name} » assigné au départ`, 'success');
                          }}
                          disabled={assigned}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold min-h-[44px] disabled:opacity-50 ${
                            assigned ? 'bg-[#2D5A3D] text-white' : 'bg-white/60 border border-[#1C2620]/10 text-[#1C2620]/80'
                          }`}
                        >
                          {assigned ? 'Assigné au départ' : 'Assigner au départ'}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onPermanentDelete(kit.id)}
                      className="text-xs font-bold text-[#9B2C2C]/70 hover:text-[#9B2C2C] inline-flex items-center gap-1"
                    >
                      <IconTrash size={12} /> Vers la corbeille
                    </button>
                  </SectionCard>
                );
              })}
            </div>

            {selectedKit && (
              <KitDetail
                kit={selectedKit}
                equipment={equipment}
                onOpenGear={onOpenGear}
              />
            )}
          </>
        )}

        {tab === 'next' && (
          <SectionCard title={nextKit ? `Kit du prochain départ — ${nextKit.name}` : 'Kit du prochain départ'}>
            {!nextKit ? (
              <p className="text-xs text-[#1C2620]/60">
                {activeHike ? `Aucun kit assigné à « ${activeHike.name} ».` : 'Aucun départ planifié.'}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#1C2620]/80">
                    {activeHike ? `Pour « ${activeHike.name} » — ${countdownLabel(activeHike.targetDate)}` : ''}
                  </span>
                  <span className="font-mono font-bold text-[#2D5A3D]">{formatWeight(kitTotalWeight(nextKit))}</span>
                </div>
                <KitDetail kit={nextKit} equipment={equipment} onOpenGear={onOpenGear} compact />
              </>
            )}
          </SectionCard>
        )}

        {tab === 'trash' && (
          <SectionCard title={`Corbeille (${trashCount})`}>
            {trashKits.length === 0 ? (
              <p className="text-xs text-[#1C2620]/60">Corbeille vide.</p>
            ) : (
              <div className="space-y-2">
                {trashKits.map((k) => (
                  <div key={k.id} className="p-3 rounded-xl bg-white/40 border border-[#1C2620]/7 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-[#1C2620] truncate">{k.name}</p>
                      <p className="text-[#1C2620]/45">
                        Supprimé {k.deleted_at ? new Date(k.deleted_at).toLocaleDateString('fr-FR') : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRestore(k.id);
                          onToast(`Kit « ${k.name} » restauré`, 'success');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2D5A3D]/15 hover:bg-[#2D5A3D]/25 border border-[#2D5A3D]/30 text-[#2D5A3D] font-bold"
                      >
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Supprimer définitivement « ${k.name} » ?`)) {
                            onPermanentDelete(k.id);
                            onToast('Kit supprimé définitivement', 'info');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#9B2C2C]/10 hover:bg-[#9B2C2C]/20 border border-[#9B2C2C]/20 text-[#9B2C2C] font-bold"
                      >
                        Suppr. définitif
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function HeaderTabs({
  tab,
  onChange,
  trashCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  trashCount: number;
}) {
  const tabs: [Tab, string][] = [
    ['kits', 'Mes kits'],
    ['next', 'Prochain départ'],
    ['trash', `Corbeille (${trashCount})`],
  ];
  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
            tab === key ? 'bg-[#2D5A3D] text-white' : 'bg-white/50 text-[#1C2620]/80 border border-[#1C2620]/10'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function KitActions({
  kit,
  onOpen,
  onDuplicate,
}: {
  kit: CustomKit;
  onOpen: (k: CustomKit) => void;
  onDuplicate: (k: CustomKit) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onOpen(kit)}
        aria-label={`Ouvrir le kit ${kit.name}`}
        title="Ouvrir le kit"
        className="w-9 h-9 rounded-full bg-white/60 hover:bg-[#2D5A3D]/10 border border-[#1C2620]/10 flex items-center justify-center text-[#2D5A3D]"
      >
        <IconBackpack size={15} />
      </button>
      <button
        type="button"
        onClick={() => onDuplicate(kit)}
        aria-label={`Dupliquer le kit ${kit.name}`}
        title="Dupliquer"
        className="w-9 h-9 rounded-full bg-white/60 hover:bg-[#1C2620]/6 border border-[#1C2620]/10 flex items-center justify-center text-[#1C2620]/70"
      >
        <IconCopy size={15} />
      </button>
    </div>
  );
}

function KitDetail({
  kit,
  equipment,
  onOpenGear,
  compact = false,
}: {
  kit: CustomKit;
  equipment: UserEquipmentItem[];
  onOpenGear?: (gearId: string) => void;
  compact?: boolean;
}) {
  const completeness = useMemo(() => evaluateKitCompleteness(kit, equipment), [kit, equipment]);

  // Répartition par catégorie
  const categories = useMemo(() => {
    const map = new Map<string, { items: number; weight: number }>();
    for (const item of kit.items || []) {
      const cat = item.category || 'Autre';
      const entry = map.get(cat) || { items: 0, weight: 0 };
      entry.items += 1;
      entry.weight += (item.weight_g || 0) * (item.quantity || 1);
      map.set(cat, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].weight - a[1].weight);
  }, [kit]);

  if (compact) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <MiniStat label="Articles possédés" value={`${completeness.ownedCount}/${completeness.totalItems}`} />
        <MiniStat label="Disponibles" value={`${completeness.availableCount}/${completeness.totalItems}`} />
        {completeness.missingItems.length > 0 && (
          <MiniStat label="Manquants" value={`${completeness.missingCount}`} tone="danger" />
        )}
        {completeness.unavailableItems.length > 0 && (
          <MiniStat label="Indisponibles" value={`${completeness.unavailableCount}`} tone="warn" />
        )}
      </div>
    );
  }

  return (
    <SectionCard title={`Détail — ${kit.name}`}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Possédés" value={`${completeness.ownedCount}/${completeness.totalItems}`} />
        <MiniStat label="Disponibles" value={`${completeness.availableCount}/${completeness.totalItems}`} />
        <MiniStat label="Manquants" value={`${completeness.missingCount}`} tone="danger" />
        <MiniStat label="Indisponibles" value={`${completeness.unavailableCount}`} tone="warn" />
      </div>

      {categories.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620]">Répartition par catégorie</p>
          {categories.map(([cat, info]) => (
            <div key={cat} className="flex items-center justify-between text-xs">
              <span className="capitalize truncate text-[#1C2620]/80">{cat}</span>
              <span className="font-mono text-[#2D5A3D]">
                {info.items} · {formatWeight(info.weight)}
              </span>
            </div>
          ))}
        </div>
      )}

      {completeness.missingItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#9B2C2C]">
            Matériel manquant ({completeness.missingItems.length})
          </p>
          {completeness.missingItems.map((m) => {
            const subs = findSubstitutes(m, equipment);
            return (
              <div key={m.id} className="p-2 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs space-y-1">
                <p className="font-semibold text-[#1C2620]/90">{m.item_name}</p>
                {subs.length > 0 && (
                  <p className="text-[#1C2620]/60">
                    Substituts : {subs.slice(0, 2).map((s) => s.name).join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completeness.unavailableItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#8C6A1A]">
            Matériel indisponible ({completeness.unavailableItems.length})
          </p>
          {completeness.unavailableItems.map(({ item, gear }) => (
            <div key={item.id} className="p-2 rounded-xl bg-[#8C6A1A]/8 border border-[#8C6A1A]/20 text-xs flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-[#1C2620]/90">{item.item_name}</span>
              {gear && onOpenGear ? (
                <button
                  type="button"
                  onClick={() => onOpenGear(gear.id)}
                  className="px-2 py-1 rounded-lg bg-white/60 border border-[#1C2620]/10 text-[#2D5A3D] font-bold shrink-0"
                >
                  Ouvrir la fiche
                </button>
              ) : (
                <span className="shrink-0 text-[#8C6A1A] font-mono">{item.item_name}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'warn';
}) {
  const color =
    tone === 'danger' ? 'text-[#9B2C2C]' : tone === 'warn' ? 'text-[#8C6A1A]' : 'text-[#2D5A3D]';
  return (
    <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7">
      <span className={`block text-lg font-bold font-mono leading-none ${color}`}>{value}</span>
      <span className="block text-xs text-[#1C2620]/70 mt-1">{label}</span>
    </div>
  );
}