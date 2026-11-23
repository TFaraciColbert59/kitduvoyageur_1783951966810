'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type { PickerProduct } from '@/features/community/create/kit/types';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  Eye,
  Layers,
  Package,
  Search,
  ShieldCheck,
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
export type VaultScopeId = 'all' | 'club' | 'member';
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
  outings = [],
  kitSeason: controlledKitSeason,
  vaultFilter: controlledVaultFilter,
  vaultScope: controlledVaultScope,
  onToggleReserveGear,
  onRequestGearLoan,
  onTransitionGearLoan,
  onCloneStandardKit,
  onToast,
}: ClubCoffreDrawerBodyProps & {
  kitSeason?: KitSeasonFilter;
  vaultFilter?: VaultFilterId;
  vaultScope?: VaultScopeId;
  onRequestGearLoan?: (payload: {
    gearItemId: string;
    quantity: number;
    eventId?: string | null;
    neededFrom?: string | null;
    neededUntil?: string | null;
    note?: string | null;
  }) => Promise<boolean> | void;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
}) {
  // D16 — Vault items search & filter state (filter & scope controlled from bottom-right SortMenuButton)
  const [vaultSearch, setVaultSearch] = useState('');
  const vaultScope = controlledVaultScope ?? 'all';
  const vaultFilter = controlledVaultFilter ?? 'all';
  const [visibleVaultCount, setVisibleVaultCount] = useState(35);
  const [selectedGearIndex, setSelectedGearIndex] = useState<number | null>(null);
  const [loanDraftGearId, setLoanDraftGearId] = useState<string | null>(null);
  const [loanQty, setLoanQty] = useState(1);
  const [loanFrom, setLoanFrom] = useState('');
  const [loanUntil, setLoanUntil] = useState('');
  const [loanEventId, setLoanEventId] = useState('');
  const [loanNote, setLoanNote] = useState('');
  const loanDraftGear = useMemo(
    () => (loanDraftGearId ? vaultGear.find((g) => g.id === loanDraftGearId) ?? null : null),
    [loanDraftGearId, vaultGear],
  );
  const [loanConditionPick, setLoanConditionPick] = useState<Record<string, 'new' | 'good' | 'worn' | 'repair'>>({});
  const [loanReturnNote, setLoanReturnNote] = useState<Record<string, string>>({});
  const [selectedKitProductState, setSelectedKitProductState] = useState<{
    kitTitle: string;
    totalWeightG: number;
    products: KitProductView[];
    index: number;
  } | null>(null);

  const canManageClubGear = Boolean(
    activeClub.viewerCanManageGear ||
      activeClub.viewerRole === 'founder' ||
      activeClub.viewerRole === 'admin',
  );

  const kitSeason = controlledKitSeason ?? 'all';

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
                  style={{ position: 'relative' }}
                >
                  <KitCard
                    kit={entry}
                    viewer="visitor"
                    onSelectProduct={(_product, products, index) =>
                      setSelectedKitProductState({
                        products,
                        index,
                        kitTitle: k.title,
                        totalWeightG: k.totalWeightG,
                      })
                    }
                  />
                  <button
                    type="button"
                    className="lkdv-carnet-btn-soft"
                    aria-label={k.cloned ? 'Kit cloné dans votre Carnet' : 'Cloner ce kit'}
                    title={k.cloned ? 'Kit cloné' : 'Cloner ce kit'}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 5,
                      width: 32,
                      height: 32,
                      padding: 0,
                      borderRadius: '50%',
                      justifyContent: 'center',
                    }}
                    onClick={() => {
                      onCloneStandardKit(k.id);
                      onToast?.({
                        title: k.cloned ? 'Kit mis à jour dans votre Carnet' : 'Kit cloné dans votre Carnet ✓',
                        subtitle: `${k.title} (${kgLabel} kg)`,
                      });
                    }}
                  >
                    {k.cloned ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  </button>
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
                  source: 'inventory',
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
                    onAdd={() => setSelectedKitProductState(null)}
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

  if (loanDraftGear) {
    const maxQty = Math.max(1, loanDraftGear.quantityAvailable ?? 1);
    const depositEur = loanDraftGear.depositCents ? Math.round(loanDraftGear.depositCents / 100) : 0;
    return (
      <div className="club-drawer-pane-content" data-testid="club-vault-loan-request-pane">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className="lkdv-carnet-btn-soft"
            style={{ height: 32, padding: '0 10px' }}
            onClick={() => setLoanDraftGearId(null)}
          >
            <ChevronLeft size={15} aria-hidden="true" />
            <span>Retour</span>
          </button>
          <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Demander un emprunt</b>
        </div>

        <form
          className="club-drawer-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (onRequestGearLoan) {
              await onRequestGearLoan({
                gearItemId: loanDraftGear.id,
                quantity: Math.min(maxQty, Math.max(1, loanQty)),
                eventId: loanEventId || null,
                neededFrom: loanFrom || null,
                neededUntil: loanUntil || null,
                note: loanNote.trim() || null,
              });
            } else {
              onToggleReserveGear(loanDraftGear.id);
            }
            onToast?.({
              title: 'Demande d’emprunt envoyée ✓',
              subtitle: `${loanDraftGear.name} (×${Math.min(maxQty, Math.max(1, loanQty))})`,
            });
            setLoanDraftGearId(null);
            setLoanNote('');
          }}
        >
          <div className="club-glass-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b style={{ fontSize: 13.5 }}>{loanDraftGear.name}</b>
            <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>
              {loanDraftGear.ownershipScope === 'club' ? 'Parc du club' : loanDraftGear.ownerName} · {maxQty} disponible{maxQty > 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {depositEur > 0 ? (
                <span className="club-badge-soft">Caution indicative : {depositEur} € (à la remise)</span>
              ) : null}
              {loanDraftGear.isEpi ? (
                <span className="club-badge-sage">
                  EPI{loanDraftGear.epiExpiresAt ? ` · contrôle valable jusqu’au ${loanDraftGear.epiExpiresAt}` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div className="club-form-grid-2">
            <label className="club-field-label">
              <span>Quantité</span>
              <input
                type="number"
                min={1}
                max={maxQty}
                className="club-glass-input"
                value={loanQty}
                onChange={(e) => setLoanQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
              />
            </label>
            <label className="club-field-label">
              <span>Sortie associée</span>
              <select
                className="club-glass-input"
                value={loanEventId}
                onChange={(e) => setLoanEventId(e.target.value)}
              >
                <option value="">Hors sortie</option>
                {outings.slice(0, 15).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="club-form-grid-2">
            <label className="club-field-label">
              <span>Du</span>
              <input
                type="date"
                className="club-glass-input"
                value={loanFrom}
                onChange={(e) => setLoanFrom(e.target.value)}
              />
            </label>
            <label className="club-field-label">
              <span>Au</span>
              <input
                type="date"
                className="club-glass-input"
                value={loanUntil}
                onChange={(e) => setLoanUntil(e.target.value)}
              />
            </label>
          </div>

          <label className="club-field-label">
            <span>Note pour le responsable</span>
            <input
              type="text"
              className="club-glass-input"
              placeholder="Point de récupération, taille…"
              value={loanNote}
              onChange={(e) => setLoanNote(e.target.value)}
            />
          </label>

          <button type="submit" className="lkdv-carnet-btn-soft" style={{ justifyContent: 'center', fontWeight: 600 }}>
            Demander l’emprunt
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="club-drawer-pane-content" data-testid="club-vault-items-pane">
      {/* Search strip */}
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

      <div className="reseau-list">
        {filteredVault.length === 0 ? (
          <ClubEmptyCard
            icon={<Package size={22} />}
            title="Aucune pièce d’équipement pour ce filtre."
            description="Mutualisez votre matériel technique avec les membres de la cordée."
          />
        ) : (
          <ClubStaggerList style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleVault.map((g, idx) => {
              const isClubOwned = g.ownershipScope === 'club';
              const qtyAvail = g.quantityAvailable ?? (g.available ? 1 : 0);
              const qtyTotal = g.quantityTotal ?? 1;
              const depositEur = g.depositCents ? Math.round(g.depositCents / 100) : 0;
              const weightLabel =
                g.weightG >= 1000
                  ? `${(g.weightG / 1000).toFixed(1).replace('.', ',')} kg`
                  : `${g.weightG} g`;
              const conditionLabel =
                g.conditionStatus === 'new'
                  ? 'Neuf'
                  : g.conditionStatus === 'worn'
                    ? 'Usé'
                    : g.conditionStatus === 'repair'
                      ? 'À réparer'
                      : g.condition || 'Bon état';

              let epiState: 'ok' | 'warn' | 'expired' | null = null;
              if (g.isEpi) {
                if (g.epiExpiresAt) {
                  const expMs = Date.parse(g.epiExpiresAt);
                  const daysLeft = Number.isFinite(expMs) ? (expMs - Date.now()) / 86_400_000 : 999;
                  epiState = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'warn' : 'ok';
                } else {
                  epiState = 'ok';
                }
              }

              return (
                <ClubStaggerCard
                  key={g.id}
                  className="li nt club-outing-row club-glass-card"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                  onClick={() => setSelectedGearIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveGearProductImage(g.name, g.category, g.imageUrl)}
                      alt={g.name}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        objectFit: 'cover',
                        background: 'rgba(23, 64, 44, 0.06)',
                        flex: 'none',
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <b
                        style={{
                          display: 'block',
                          fontSize: 13.5,
                          lineHeight: 1.25,
                          color: 'var(--label)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {g.name}
                      </b>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--label2)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isClubOwned ? 'Parc du club' : g.ownerName} · {weightLabel} · {conditionLabel}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                        <span className={g.reservedByMe || (isClubOwned && qtyAvail > 0) ? 'club-badge-sage' : 'club-badge-soft'}>
                          {g.reservedByMe
                            ? 'Demandé ✓'
                            : isClubOwned || qtyTotal > 1
                              ? `${qtyAvail}/${qtyTotal} dispo`
                              : g.available
                                ? 'Disponible'
                                : 'Prêté'}
                        </span>
                        {epiState ? (
                          <span
                            className="club-badge-soft"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              color:
                                epiState === 'expired'
                                  ? '#b91c1c'
                                  : epiState === 'warn'
                                    ? '#c2410c'
                                    : '#17402c',
                              background:
                                epiState === 'expired'
                                  ? 'rgba(185, 28, 28, 0.10)'
                                  : epiState === 'warn'
                                    ? 'rgba(194, 65, 12, 0.12)'
                                    : undefined,
                            }}
                          >
                            {epiState === 'ok' ? (
                              <ShieldCheck size={11} aria-hidden="true" />
                            ) : (
                              <AlertTriangle size={11} aria-hidden="true" />
                            )}
                            EPI{g.epiExpiresAt ? ` · ${g.epiExpiresAt}` : ''}
                          </span>
                        ) : null}
                        {depositEur > 0 ? (
                          <span className="club-badge-soft">Caution {depositEur} €</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`reseau-btn ${g.reservedByMe ? 'active' : ''} club-icon-pill`}
                    style={{ flex: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGearIndex(idx);
                    }}
                    aria-label={g.reservedByMe ? 'Demandé · Voir la fiche' : 'Voir l’équipement'}
                    title={g.reservedByMe ? 'Demandé · Voir' : 'Voir'}
                  >
                    {g.reservedByMe ? <Check size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </ClubStaggerCard>
              );
            })}
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
                    setSelectedGearIndex(null);
                    setLoanQty(1);
                    setLoanDraftGearId(g.id);
                  }}
                  onRemove={() => {
                    if (g.loanId && onTransitionGearLoan && (g.loanStatus === 'requested' || g.loanStatus === 'approved')) {
                      void onTransitionGearLoan({ loanId: g.loanId, gearItemId: g.id, status: 'cancelled' });
                    } else {
                      onToggleReserveGear(g.id);
                    }
                    onToast?.({
                      title: 'Demande d’emprunt annulée',
                      subtitle: `${g.name}`,
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
