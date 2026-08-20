'use client';

/**
 * LKDV — Mon Matériel • Plein écran « Inventaire & catalogue ».
 * Onglets : Mon inventaire / Catalogue / En commande / Corbeille.
 * Le catalogue utilise UNIQUEMENT les données réelles `shop_products`
 * (via `useEquipment.products`). Flux universel « Ajouter à l'équipement »
 * intégré via `AddToEquipmentButton` (Cas A/B/C + réception).
 */

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import type { UserEquipmentItem, UnifiedProduct } from '@/hooks/useEquipment';
import type { CustomKit } from '@/hooks/useUserKits';
import type { GearStatus } from '../domain/gear-status';
import type { OrderedProductItem, GearDestination } from '../types';
import { formatEuro, formatWeight, formatDateFr } from '../domain/gear-format';
import { SectionCard } from '../components/SectionCard';
import { AddToEquipmentButton } from '../components/AddToEquipmentButton';
import { ExportButton, exportServiceSingleton as exportService } from '../components/shared/ExportButton';
import { IconCheck } from '../components/icons';

export interface InventoryCatalogFullscreenProps {
  equipment: UserEquipmentItem[];
  products: UnifiedProduct[];
  kits: CustomKit[];
  statuses: Map<string, GearStatus>;
  ordered: OrderedProductItem[];
  departureName?: string | null;
  /** Pré-filtre initial (recherche + ouverture sur l'onglet Catalogue). */
  initialQuery?: string;
  onOpenGear: (gearId: string) => void;
  onEditGear: (gear: UserEquipmentItem) => void;
  onDeleteGear: (gearId: string) => void;
  onToggleFavorite: (gear: UserEquipmentItem) => void;
  onAddToKit: (gearId: string, kitId: string) => void;
  onAddToCart: (product: UnifiedProduct, destination?: GearDestination) => void;
  onConfirmReception: (ordered: OrderedProductItem) => Promise<void>;
  trashKits: CustomKit[];
  onRestoreKit: (kitId: string) => void;
  onPermanentDeleteKit: (kitId: string) => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

type Tab = 'inventory' | 'catalog' | 'on_order' | 'trash';

export function InventoryCatalogFullscreen({
  equipment,
  products,
  kits,
  statuses,
  ordered,
  departureName,
  initialQuery = '',
  onOpenGear,
  onEditGear,
  onDeleteGear,
  onToggleFavorite,
  onAddToKit,
  onAddToCart,
  onConfirmReception,
  trashKits,
  onRestoreKit,
  onPermanentDeleteKit,
  onToast,
}: InventoryCatalogFullscreenProps) {
  const [tab, setTab] = useState<Tab>(initialQuery ? 'catalog' : 'inventory');
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'recent' | 'usage' | 'name' | 'weight' | 'category'>('recent');

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category_main || p.category || 'Autre'));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (category !== 'all' && (p.category_main || p.category) !== category) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            (p.brand || '').toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [products, category, query]
  );

  const filteredAndSortedEquipment = useMemo(() => {
    let filtered = equipment.filter((g) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          g.name.toLowerCase().includes(q) ||
          (g.brand || '').toLowerCase().includes(q) ||
          (g.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sort) {
        case 'usage':
          return (b.usage_count || 0) - (a.usage_count || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'weight': {
          const weightA = (a.weight_g || 0) * (a.quantity || 1);
          const weightB = (b.weight_g || 0) * (b.quantity || 1);
          return weightB - weightA;
        }
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
case 'recent':
          default: {
            const dateA = a.acquired_at ? new Date(a.acquired_at).getTime() : 0;
            const dateB = b.acquired_at ? new Date(b.acquired_at).getTime() : 0;
            return dateB - dateA;
          }
      }
    });

    return filtered;
  }, [equipment, query, sort]);

  const ownedByProduct = (product: UnifiedProduct): UserEquipmentItem | undefined =>
    equipment.find(
      (g) =>
        (product.id && (g.product_id === product.id || g.id === product.id)) ||
        g.name.trim().toLowerCase() === product.name.trim().toLowerCase()
    );

  const orderedNotReceived = ordered.filter((o) => !['delivered', 'received'].includes(o.status));

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Inventaire & catalogue (${equipment.length} objets · ${products.length} produits)`}
        action={<Tabs tab={tab} onChange={setTab} orderedCount={orderedNotReceived.length} trashCount={trashKits.length} />}
      >
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'catalog' ? 'Rechercher dans le catalogue…' : tab === 'on_order' ? 'Rechercher une commande…' : 'Rechercher dans l’inventaire…'}
            className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-white/60 border border-[#1C2620]/10 text-xs text-[#1C2620] placeholder-[#1C2620]/45 focus:outline-none focus:border-[#2D5A3D]"
            aria-label="Rechercher"
          />
          {tab === 'inventory' && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-2.5 py-2 rounded-xl bg-white/60 border border-[#1C2620]/10 text-xs text-[#1C2620] focus:outline-none"
              aria-label="Trier l'inventaire"
            >
              <option value="recent">Récents</option>
              <option value="usage">Utilisation</option>
              <option value="name">Nom</option>
              <option value="weight">Poids</option>
              <option value="category">Catégorie</option>
            </select>
          )}
          {tab === 'catalog' && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-white/60 border border-[#1C2620]/10 text-xs text-[#1C2620] focus:outline-none"
              aria-label="Filtrer par catégorie"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'Toutes catégories' : c}</option>
              ))}
            </select>
          )}
        </div>
      </SectionCard>

      {tab === 'inventory' && (
        <>
          <EquipmentOverviewBar equipment={equipment} onOpenGear={onOpenGear} onToast={onToast} />
          {filteredAndSortedEquipment.length === 0 && (
            <SectionCard title="Mon inventaire">
              <p className="text-xs text-[#1C2620]/60">
                {query ? 'Aucun résultat pour cette recherche.' : 'Votre inventaire est vide — ajoutez votre premier article.'}
              </p>
            </SectionCard>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredAndSortedEquipment.map((gear) => {
              const status = statuses.get(gear.id);
              return (
                <div key={gear.id} className="rounded-2xl bg-white/60 border border-[#1C2620]/7 p-3 flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/60 border border-[#1C2620]/8 overflow-hidden relative shrink-0 flex items-center justify-center p-1">
                    <Image src={gear.image || '/assets/images/no_image.png'} alt={gear.name} width={44} height={44} className="object-contain max-h-full max-w-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1C2620] truncate">{gear.name}</p>
                        <p className="text-xs text-[#1C2620]/60 truncate">
                          {gear.brand || 'Outdoor'} · {gear.category || 'Autre'} · {formatWeight((gear.weight_g || 0) * (gear.quantity || 1))}
                        </p>
                        <div className="flex items-center gap-1 text-xs mt-0.5">
                          <span className="text-[#1C2620]/60">Utilisé</span>
                          <span className="font-mono text-[#2D5A3D]">{gear.usage_count || 0}</span>
                          <span className="text-[#1C2620]/60">fois</span>
                          {(gear.usage_count || 0) > 0 && gear.last_used_date && (
                            <span className="ml-1 text-[#1C2620]/50">· {formatDateFr(gear.last_used_date, true)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(gear)}
                        aria-label={gear.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          gear.is_favorite
                            ? 'bg-[#9B2C2C]/10 border-[#9B2C2C]/30 text-[#9B2C2C]'
                            : 'bg-white/50 border-[#1C2620]/10 text-[#1C2620]/40'
                        }`}
                      >
                        <IconHeartBeat filled={Boolean(gear.is_favorite)} />
                      </button>
                    </div>
                    {status && status.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {status.badges.slice(0, 3).map((b) => (
                          <Badge key={b.id} label={b.label} tone={b.severity} />
                        ))}
                        {gear.usage_count !== undefined && gear.usage_count >= 10 && (
                          <Badge
                            key={`usage-${gear.id}`}
                            label={gear.usage_count >= 20 ? 'Extrêmement utilisé' : 'Très utilisé'}
                            tone='success'
                          />
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <MiniBtn label="Fiche" onClick={() => onOpenGear(gear.id)} />
                      <MiniBtn label="Modifier" onClick={() => onEditGear(gear)} />
                      <MiniBtn
                        label="Supprimer"
                        danger
                        onClick={() => {
                          if (window.confirm(`Supprimer « ${gear.name} » de l’inventaire ?`)) onDeleteGear(gear.id);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'catalog' && (
        <>
          {filteredProducts.length === 0 && (
            <SectionCard title="Catalogue">
              <p className="text-xs text-[#1C2620]/60">Aucun produit ne correspond — essayez un autre filtre.</p>
            </SectionCard>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredProducts.map((product) => {
              const owned = ownedByProduct(product) || null;
              const status = owned ? statuses.get(owned.id) : undefined;
              return (
                <div key={product.id} className="rounded-2xl bg-white/60 border border-[#1C2620]/7 p-3 flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/60 border border-[#1C2620]/8 overflow-hidden relative shrink-0 flex items-center justify-center p-1">
                    <Image src={product.image || '/assets/images/no_image.png'} alt={product.name} width={44} height={44} className="object-contain max-h-full max-w-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p data-testid="catalog-name" className="text-xs font-bold text-[#1C2620] truncate">{product.name}</p>
                    <p className="text-xs text-[#1C2620]/60 truncate">
                      {product.brand || 'Le Kit du Voyageur'} · {product.category_main || product.category} ·{' '}
                      {formatWeight(product.weight_g)} · {formatEuro(product.price_eur)}
                    </p>
                    {owned && status && status.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {status.badges.slice(0, 3).map((b) => (
                          <Badge key={b.id} label={b.label} tone={b.severity} />
                        ))}
                      </div>
                    )}
                    {owned && (
                      <div className="mt-1 space-x-2 text-xs">
                        <span className="text-[#1C2620]/60">Utilisé</span>
                        <span className="font-mono text-[#2D5A3D]">{owned.usage_count || 0}</span>
                        <span className="text-[#1C2620]/60">fois</span>
                        {(owned.usage_count || 0) > 0 && owned.last_used_date && (
                          <span className="ml-1 text-[#1C2620]/50">· {formatDateFr(owned.last_used_date, true)}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-2">
                      <AddToEquipmentButton
                        product={product}
                        ownedItem={owned}
                        status={status}
                        kits={kits}
                        departureName={departureName}
                        onAddToKit={onAddToKit}
                        onAddToCart={(p, dest) => {
                          onAddToCart(p, dest);
                          onToast(dest ? 'Ajouté au panier avec destination mémorisée' : 'Ajouté au panier', 'success');
                        }}
                        onToast={onToast}
                        compact
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'on_order' && (
        <>
          {orderedNotReceived.length === 0 && (
            <SectionCard title="En commande">
              <p className="text-xs text-[#1C2620]/60">
                Aucune commande en cours. Ajoutez un produit à l’équipement depuis le catalogue pour le retrouver ici.
              </p>
            </SectionCard>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {orderedNotReceived.map((o) => (
              <div key={o.orderItemId} className="rounded-2xl bg-white/60 border border-[#1C2620]/7 p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1C2620] truncate">{o.name} × {o.quantity}</p>
                  <p className="text-xs text-[#1C2620]/60 truncate">
                    {o.brand || 'Le Kit du Voyageur'} · {o.priceEur ? formatEuro(o.priceEur * o.quantity) : '—'}
                    {o.createdAt ? ` · commandé le ${new Date(o.createdAt).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                  {o.destination && (
                    <p className="text-xs text-[#2D5A3D] mt-1">
                      <span className="font-semibold">Destination :</span> {o.destination.type === 'kit' ? o.destination.label || 'un kit' : o.destination.type === 'departure' ? 'prochain départ' : o.destination.type === 'checklist' ? 'checklist de préparation' : 'inventaire'}
                      {o.destination.reason ? ` — ${o.destination.reason}` : ''}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void onConfirmReception(o)}
                  className="px-4 py-2 rounded-full bg-[#2D5A3D] text-white text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5 shrink-0"
                >
                  <IconCheck size={13} /> Confirmer réception
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'trash' && (
        <SectionCard title={`Corbeille des kits (${trashKits.length})`}>
          {trashKits.length === 0 ? (
            <p className="text-xs text-[#1C2620]/60">Corbeille vide. Les articles d’inventaire supprimés le sont définitivement (pas de corbeille d’équipement).</p>
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
                        onRestoreKit(k.id);
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
                          onPermanentDeleteKit(k.id);
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
  );
}

function Tabs({
  tab,
  onChange,
  orderedCount,
  trashCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  orderedCount: number;
  trashCount: number;
}) {
  const tabs: [Tab, string][] = [
    ['inventory', 'Mon inventaire'],
    ['catalog', 'Catalogue'],
    ['on_order', `En commande${orderedCount > 0 ? ` (${orderedCount})` : ''}`],
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

function Badge({ label, tone }: { label: string; tone: string }) {
  const cls =
    tone === 'critical'
      ? 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/30'
      : tone === 'warning'
      ? 'bg-[#8C6A1A]/10 text-[#8C6A1A] border-[#8C6A1A]/30'
      : tone === 'success'
      ? 'bg-[#2D5A3D]/10 text-[#235030] border-[#2D5A3D]/30'
      : 'bg-[#2D5A3D]/10 text-[#2D5A3D] border-[#2D5A3D]/25';
  return <span className={`px-2 py-0.5 rounded-full border font-mono text-xs font-bold ${cls}`}>{label}</span>;
}

function MiniBtn({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors min-h-[44px] ${
        danger
          ? 'bg-[#9B2C2C]/8 border-[#9B2C2C]/20 text-[#9B2C2C] hover:bg-[#9B2C2C]/15'
          : 'bg-white/60 border-[#1C2620]/10 text-[#1C2620]/80 hover:bg-[#2D5A3D]/8'
      }`}
    >
      {label}
    </button>
  );
}

function IconHeartBeat({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 8.7a5 5 0 0 0-9-0 5 5 0 0 0-9 0c0 4.4 4.8 7.6 9 11.3 4.2-3.7 9-6.9 9-11.3Z" />
    </svg>
  );
}

function EquipmentOverviewBar({
  equipment,
  onOpenGear,
  onToast,
}: {
  equipment: UserEquipmentItem[];
  onOpenGear: (id: string) => void;
  onToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}) {
  const totalWeightG = equipment.reduce((s, g) => s + (g.weight_g || 0) * (g.quantity || 1), 0);
  const totalValue = equipment.reduce((s, g) => s + (Number(g.purchase_price || 0)) * (g.quantity || 1), 0);
  const needPhoto = equipment.filter((g) => !g.image).length;
  const incomplete = equipment.filter((g) => !g.size_label || !g.serial_number || !g.condition).length;
  const duplicates: Array<[UserEquipmentItem, UserEquipmentItem]> = [];
  for (let i = 0; i < equipment.length; i++) {
    for (let j = i + 1; j < equipment.length; j++) {
      const a = (equipment[i].name || '').toLowerCase().trim();
      const b = (equipment[j].name || '').toLowerCase().trim();
      if (a && a === b) duplicates.push([equipment[i], equipment[j]]);
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard title="Vue d’ensemble">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <p className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs">
            <strong className="block font-mono text-lg text-[#2D5A3D] leading-none">{equipment.length}</strong>
            objets
          </p>
          <p className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs">
            <strong className="block font-mono text-lg text-[#2D5A3D] leading-none">{formatWeight(totalWeightG)}</strong>
            poids total
          </p>
          <p className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs">
            <strong className="block font-mono text-lg text-[#2D5A3D] leading-none">{formatEuro(totalValue)}</strong>
            valeur
          </p>
          <div className="p-2.5 rounded-xl bg-white/40 border border-[#1C2620]/7 text-xs flex flex-col justify-center">
            <ExportButton
              label="Exporter CSV"
              onExport={() => exportService.exportInventoryCsv(equipment)}
              onResult={(r) => onToast(r.ok ? `Export « ${r.fileName} » généré` : r.error || 'Export impossible', r.ok ? 'success' : 'warning')}
            />
          </div>
        </div>
      </SectionCard>

      {(needPhoto > 0 || incomplete > 0 || duplicates.length > 0) && (
        <SectionCard title="Fiabilisation de la fiche">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {needPhoto > 0 && (
              <button
                type="button"
                onClick={() => {
                  const first = equipment.find((g) => !g.image);
                  if (first) onOpenGear(first.id);
                }}
                className="p-2 rounded-xl bg-[#8C6A1A]/8 border border-[#8C6A1A]/20 text-xs text-left hover:bg-[#8C6A1A]/15 transition-colors"
              >
                <strong className="text-[#8C6A1A]">{needPhoto} photo(s) manquante(s)</strong>
                <span className="block text-[#1C2620]/65 mt-0.5">Cliquez pour ajouter une photo.</span>
              </button>
            )}
            {incomplete > 0 && (
              <button
                type="button"
                onClick={() => {
                  const first = equipment.find((g) => !g.size_label || !g.serial_number || !g.condition);
                  if (first) onOpenGear(first.id);
                }}
                className="p-2 rounded-xl bg-[#8C6A1A]/8 border border-[#8C6A1A]/20 text-xs text-left hover:bg-[#8C6A1A]/15 transition-colors"
              >
                <strong className="text-[#8C6A1A]">{incomplete} fiche(s) incomplète(s)</strong>
                <span className="block text-[#1C2620]/65 mt-0.5">Taille, n° série ou état manquant.</span>
              </button>
            )}
            {duplicates.length > 0 && (
              <div className="p-2 rounded-xl bg-[#9B2C2C]/8 border border-[#9B2C2C]/20 text-xs">
                <strong className="text-[#9B2C2C]">{duplicates.length} doublon(s) détecté(s)</strong>
                <ul className="mt-1 space-y-1">
                  {duplicates.slice(0, 3).map(([a, b]) => (
                    <li key={`${a.id}-${b.id}`} className="flex items-center justify-between gap-1">
                      <span className="truncate text-[#1C2620]/70">{a.name}</span>
                      <button type="button" onClick={() => onOpenGear(a.id)} className="text-[#2D5A3D] font-bold shrink-0">
                        Fiche
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}