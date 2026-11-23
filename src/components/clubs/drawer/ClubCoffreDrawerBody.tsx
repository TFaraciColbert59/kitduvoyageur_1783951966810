'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type { PickerProduct } from '@/features/community/create/kit/types';
import {
  Copy,
  Layers,
  Package,
  Search,
  X,
} from 'lucide-react';
import { KitCard, type KitEntry, type KitProductView } from '@/components/compte/drawer/cards/KitCard';
import {
  ClubStaggerCard,
  ClubStaggerList,
} from './ClubDrawerMotion';
import { ClubEmptyCard } from './ClubSharedUi';
import { mapClubStandardKitToKitEntry } from './clubKitAdapter';
import type { ClubCoffreDrawerBodyProps } from './ClubDrawerTypes';
import { ClubG02Workspace } from '../g02';

const KitProductSheetV2 = dynamic(
  () => import('@/features/community/v2/create/kit/KitProductSheetV2').then((m) => m.KitProductSheetV2),
  { ssr: false },
);

export type VaultFilterId = 'all' | 'available' | 'mine' | 'light';
export type KitSeasonFilter = 'all' | 'summer' | 'winter';

function resolveGearProductImage(name: string, category: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  const hay = `${name} ${category}`.toLowerCase();
  if (hay.includes('tente') || hay.includes('bivouac') || hay.includes('abri')) {
    return '/assets/images/product-tent.jpg';
  }
  if (hay.includes('duvet') || hay.includes('couchage') || hay.includes('matelas')) {
    return '/assets/images/product-sleeping.jpg';
  }
  if (hay.includes('rechaud') || hay.includes('réchaud') || hay.includes('cuisine') || hay.includes('jetboil')) {
    return '/assets/images/gear-stove.jpg';
  }
  if (hay.includes('frontale') || hay.includes('eclairage') || hay.includes('éclairage') || hay.includes('lampe')) {
    return '/assets/images/product-headlamp.jpg';
  }
  if (hay.includes('crampon') || hay.includes('chaussure') || hay.includes('piolet') || hay.includes('baton') || hay.includes('bâton')) {
    return '/assets/images/gear-boots.jpg';
  }
  if (hay.includes('veste') || hay.includes('doudoune') || hay.includes('textile')) {
    return '/assets/images/product-jacket.jpg';
  }
  if (hay.includes('gourde') || hay.includes('hydrat')) {
    return '/assets/images/product-bottle.jpg';
  }
  return '/assets/images/product-backpack.jpg';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function ClubCoffreDrawerBody({
  activeSubTab,
  activeClub,
  vaultGear,
  standardKits,
  members,
  kitSeason: controlledKitSeason,
  vaultFilter: controlledVaultFilter,
  onToggleReserveGear,
  onCloneStandardKit,
  onToast,
}: ClubCoffreDrawerBodyProps & {
  kitSeason?: KitSeasonFilter;
  vaultFilter?: VaultFilterId;
}) {
  // D16 — Vault items search & filter state (filter controlled from bottom-right SortMenuButton)
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultScope, setVaultScope] = useState<'all' | 'club' | 'member'>('all');
  const vaultFilter = controlledVaultFilter ?? 'all';
  const [visibleVaultCount, setVisibleVaultCount] = useState(35);
  const [selectedGearIndex, setSelectedGearIndex] = useState<number | null>(null);
  const [selectedKitProductState, setSelectedKitProductState] = useState<{
    kitTitle: string;
    totalWeightG: number;
    products: KitProductView[];
    index: number;
  } | null>(null);

  const kitSeason = controlledKitSeason ?? 'all';

  const clubInventoryCount = useMemo(
    () => vaultGear.filter((g) => g.ownershipScope === 'club').length,
    [vaultGear],
  );
  const memberInventoryCount = vaultGear.length - clubInventoryCount;

  const filteredVault = useMemo(() => {
    const q = normalizeText(vaultSearch.trim());
    return vaultGear.filter((g) => {
      const scope = g.ownershipScope ?? 'member';
      if (vaultScope !== 'all' && scope !== vaultScope) return false;
      if (vaultFilter === 'available' && (!g.available || g.reservedByMe)) return false;
      if (vaultFilter === 'mine' && !g.reservedByMe) return false;
      if (vaultFilter === 'light' && g.weightG >= 500) return false;
      if (!q) return true;
      return normalizeText(`${g.name} ${g.brand} ${g.category} ${g.ownerName} ${g.ownerHandle}`).includes(q);
    });
  }, [vaultGear, vaultSearch, vaultScope, vaultFilter]);

  const filteredKits = useMemo(() => {
    return standardKits.filter((k) => {
      if (kitSeason === 'all') return true;
      const s = normalizeText(k.season);
      if (kitSeason === 'winter') return s.includes('hiver') || s.includes('alpi') || s.includes('4');
      return s.includes('ete') || s.includes('3') || s.includes('printemps') || !s.includes('hiver');
    });
  }, [standardKits, kitSeason]);

  // ============================================================================
  // D17 — 3.1 VAULT-KITS ("Kits types du club") — KitCard canonique Profil/Carnet
  // ============================================================================
  if (activeSubTab === 1) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-vault-kits-pane">
        {filteredKits.length === 0 ? (
          <ClubEmptyCard
            icon={<Layers size={22} />}
            title="Aucun kit standard recommandé pour ce filtre."
            description="Les kits types préparés par les encadrants apparaîtront ici."
          />
        ) : (
          <ClubStaggerList style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredKits.map((k) => {
              const kgLabel = (k.totalWeightG / 1000).toFixed(1);
              const entry = mapClubStandardKitToKitEntry(k);
              return (
                <ClubStaggerCard
                  key={k.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  <KitCard
                    kit={entry}
                    viewer="visitor"
                    onSelectProduct={(_prod, prods, idx) =>
                      setSelectedKitProductState({
                        kitTitle: k.title,
                        totalWeightG: k.totalWeightG,
                        products: prods,
                        index: idx,
                      })
                    }
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px' }}>
                    <button
                      type="button"
                      className={k.cloned ? 'lkdv-carnet-btn-soft' : 'lkdv-carnet-btn-primary'}
                      style={{ height: 30, fontSize: 11.5, padding: '0 12px' }}
                      onClick={() => {
                        onCloneStandardKit(k.id);
                        onToast?.({
                          title: k.cloned ? 'Kit mis à jour dans votre Carnet' : 'Kit cloné dans votre Carnet ✓',
                          subtitle: `${k.title} (${kgLabel} kg)`,
                        });
                      }}
                    >
                      {k.cloned ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                      <span>{k.cloned ? 'Cloné dans mon Carnet' : 'Cloner ce kit'}</span>
                    </button>
                  </div>
                </ClubStaggerCard>
              );
            })}
          </ClubStaggerList>
        )}

        {selectedKitProductState &&
        selectedKitProductState.products[selectedKitProductState.index] &&
        typeof document !== 'undefined'
          ? createPortal(
              (() => {
                const p = selectedKitProductState.products[selectedKitProductState.index];
                const product: PickerProduct = {
                  key: p.id,
                  source: 'sac',
                  id: p.id,
                  name: p.name,
                  brand: p.brand || null,
                  category: p.category || null,
                  weightG: p.weightG || null,
                  image: p.image || null,
                  wear: null,
                  conditionLabel: p.condition || 'Équipement club',
                  description: p.description || `Inclus dans ${selectedKitProductState.kitTitle}.`,
                  priceLabel: null,
                  owner: null,
                  cartable: null,
                  ownershipId: null,
                  productId: null,
                };
                return (
                  <KitProductSheetV2
                    product={product}
                    initialCategory={p.category || undefined}
                    currentKitWeightG={selectedKitProductState.totalWeightG}
                    alreadyInKit
                    positionLabel={`${selectedKitProductState.index + 1} / ${selectedKitProductState.products.length}`}
                    hasPrev={selectedKitProductState.index > 0}
                    hasNext={selectedKitProductState.index < selectedKitProductState.products.length - 1}
                    onPrev={() =>
                      setSelectedKitProductState((s) =>
                        s && s.index > 0 ? { ...s, index: s.index - 1 } : s,
                      )
                    }
                    onNext={() =>
                      setSelectedKitProductState((s) =>
                        s && s.index < s.products.length - 1 ? { ...s, index: s.index + 1 } : s,
                      )
                    }
                    onToggleInKit={() => setSelectedKitProductState(null)}
                    onClose={() => setSelectedKitProductState(null)}
                  />
                );
              })(),
              document.body,
            )
          : null}
      </div>
    );
  }

  // ============================================================================
  // D18b — 3.2 VAULT-CHALLENGES ("Défis & classements")
  // ============================================================================
  if (activeSubTab === 2) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-vault-challenges-pane">
        <ClubG02Workspace clubId={activeClub.id} initialSection="challenges" lockedSection />
        <ClubG02Workspace clubId={activeClub.id} initialSection="leaderboard" lockedSection />
      </div>
    );
  }

  // ============================================================================
  // D16 — 3.0 VAULT-ITEMS ("Équipements prêtables du coffre")
  // ============================================================================
  const reservedCount = vaultGear.filter((g) => g.reservedByMe).length;
  const totalVaultWeightKg = (
    vaultGear.reduce((acc, g) => acc + (g.weightG || 0), 0) / 1000
  ).toFixed(1);
  const visibleVault = filteredVault.slice(0, visibleVaultCount);
  const remainingVaultCount = Math.max(0, filteredVault.length - visibleVault.length);

  return (
    <div className="club-drawer-pane-content" data-testid="club-vault-items-pane">
      {/* Search & Filter strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, paddingRight: vaultSearch ? 28 : 10, width: '100%' }}
            placeholder="Rechercher tente, DVA, réchaud, marque, prêteur…"
            aria-label="Rechercher dans le coffre matériel"
            value={vaultSearch}
            onChange={(e) => setVaultSearch(e.target.value)}
          />
          {vaultSearch ? (
            <button
              type="button"
              onClick={() => setVaultSearch('')}
              aria-label="Effacer la recherche du coffre"
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Regime switch: Parc du club vs Entraide membres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {(
          [
            { id: 'all', label: `Tout (${vaultGear.length})` },
            { id: 'club', label: `Parc du club (${clubInventoryCount})` },
            { id: 'member', label: `Entraide membres (${memberInventoryCount})` },
          ] as const
        ).map((pill) => {
          const active = vaultScope === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setVaultScope(pill.id)}
              className={active ? 'lkdv-carnet-btn-primary' : 'lkdv-carnet-btn-soft'}
              style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 999 }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      <div className="reseau-list">
        {filteredVault.length === 0 ? (
          <ClubEmptyCard
            icon={<Package size={22} />}
            title="Aucune pièce d’équipement pour ce filtre."
            description="Mutualisez votre matériel technique avec les membres de la cordée."
          />
        ) : (
          <ClubStaggerList style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const groups = new Map<string, typeof visibleVault>();
              for (const g of visibleVault) {
                const cat = g.category?.trim() || 'Équipement';
                const list = groups.get(cat);
                if (list) list.push(g);
                else groups.set(cat, [g]);
              }
              return Array.from(groups.entries()).map(([cat, items]) => {
                const totalWeightG = items.reduce((sum, x) => sum + (x.weightG || 0), 0);
                const products: KitProductView[] = items.map((g) => {
                  const isClubOwned = g.ownershipScope === 'club';
                  const qtyAvail = g.quantityAvailable ?? (g.available ? 1 : 0);
                  const qtyTotal = g.quantityTotal ?? 1;
                  const depositEur = g.depositCents ? Math.round(g.depositCents / 100) : 0;
                  const ownerText = isClubOwned
                    ? `Parc ${activeClub.name} · ${qtyAvail}/${qtyTotal} dispo`
                    : `Entraide · Prêté par ${g.ownerName} (@${g.ownerHandle})`;
                  const extraBadges = [
                    g.isEpi ? `EPI${g.epiExpiresAt ? ` (exp. ${g.epiExpiresAt})` : ''}` : null,
                    depositEur > 0 ? `Caution ${depositEur} €` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return {
                    id: g.id,
                    name: g.name,
                    category: g.category || cat,
                    weightG: g.weightG || null,
                    quantity: qtyTotal,
                    condition: g.reservedByMe
                      ? 'Réservé ✓'
                      : isClubOwned
                        ? `${qtyAvail}/${qtyTotal} dispo`
                        : g.condition || 'Vérifié',
                    priority: g.isEpi ? 'EPI' : null,
                    vital: Boolean(g.isEpi),
                    brand: g.brand || null,
                    description: extraBadges ? `${ownerText} · ${extraBadges}` : ownerText,
                    image: resolveGearProductImage(g.name, g.category, g.imageUrl),
                    isLent: Boolean(g.reservedByMe),
                  };
                });
                const kit: KitEntry = {
                  id: `vault-cat-${cat}`,
                  name: cat,
                  desc: `${items.length} pièce${items.length > 1 ? 's' : ''} · Coffre ${activeClub.name}`,
                  gen: `${items.length} pièce${items.length > 1 ? 's' : ''}`,
                  total_weight_g: totalWeightG,
                  w: totalWeightG,
                  items: products.length,
                  products,
                };
                return (
                  <KitCard
                    key={kit.id}
                    kit={kit}
                    viewer="visitor"
                    onSelectProduct={(product) => {
                      const idx = visibleVault.findIndex((item) => item.id === product.id);
                      if (idx >= 0) setSelectedGearIndex(idx);
                    }}
                  />
                );
              });
            })()}
            {remainingVaultCount > 0 ? (
              <button
                type="button"
                className="lkdv-carnet-btn-soft"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                onClick={() => setVisibleVaultCount((c) => c + 50)}
              >
                Afficher 50 de plus ({remainingVaultCount} restants)
              </button>
            ) : null}
          </ClubStaggerList>
        )}
      </div>

      {selectedGearIndex !== null &&
      visibleVault[selectedGearIndex] &&
      typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const g = visibleVault[selectedGearIndex];
              const totalKgWeightG = visibleVault.reduce((sum, x) => sum + (x.weightG || 0), 0);
              const ownerMember = members.find(
                (m) => (m.handle || '').toLowerCase() === (g.ownerHandle || '').toLowerCase(),
              );
              const product: PickerProduct = {
                key: g.id,
                source: 'pret',
                id: g.id,
                name: g.name,
                brand: g.brand || null,
                category: g.category || null,
                weightG: g.weightG || null,
                image: resolveGearProductImage(g.name, g.category, g.imageUrl),
                wear: null,
                conditionLabel: g.condition || 'Vérifié',
                description: `Équipement mutualisé dans le club ${activeClub.name} par ${g.ownerName} (@${g.ownerHandle}).`,
                priceLabel: null,
                owner: {
                  id: ownerMember?.userId || ownerMember?.id || g.ownerHandle,
                  name: g.ownerName,
                  avatarUrl: ownerMember?.avatarUrl ?? null,
                  trustScore: null,
                },
                cartable: null,
                ownershipId: null,
                productId: null,
              };
              return (
                <KitProductSheetV2
                  product={product}
                  initialCategory={g.category || undefined}
                  currentKitWeightG={totalKgWeightG}
                  alreadyInKit={Boolean(g.reservedByMe)}
                  positionLabel={`${selectedGearIndex + 1} / ${visibleVault.length}`}
                  hasPrev={selectedGearIndex > 0}
                  hasNext={selectedGearIndex < visibleVault.length - 1}
                  onPrev={() => setSelectedGearIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  onNext={() =>
                    setSelectedGearIndex((i) =>
                      i !== null && i < visibleVault.length - 1 ? i + 1 : i,
                    )
                  }
                  onClose={() => setSelectedGearIndex(null)}
                  onAdd={() => {
                    onToggleReserveGear(g.id);
                    onToast?.({
                      title: 'Équipement réservé ✓',
                      subtitle: `${g.name} (${g.ownerName})`,
                      undo: () => onToggleReserveGear(g.id),
                    });
                    setSelectedGearIndex(null);
                  }}
                  onRemove={() => {
                    onToggleReserveGear(g.id);
                    onToast?.({
                      title: 'Emprunt libéré',
                      subtitle: `${g.name} (${g.ownerName})`,
                    });
                    setSelectedGearIndex(null);
                  }}
                />
              );
            })(),
            document.body,
          )
        : null}
    </div>
  );
}

export default ClubCoffreDrawerBody;
