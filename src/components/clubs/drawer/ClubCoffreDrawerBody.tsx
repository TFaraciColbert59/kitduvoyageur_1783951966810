'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type { PickerProduct } from '@/features/community/v2/create/kit/useKitProductPickerV2';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AnimatedNumber,
  ClubStaggerCard,
  ClubStaggerList,
} from './ClubDrawerMotion';
import { ClubEmptyCard } from './ClubSharedUi';
import type { ClubCoffreDrawerBodyProps } from './ClubDrawerTypes';
import { ClubG02Workspace } from '../g02';

const KitProductSheetV2 = dynamic(
  () => import('@/features/community/v2/create/kit/KitProductSheetV2').then((m) => m.KitProductSheetV2),
  { ssr: false },
);

type VaultFilterId = 'all' | 'available' | 'mine' | 'light';
type KitSeasonFilter = 'all' | 'summer' | 'winter';

interface CollectiveLoadItem {
  key: string;
  name: string;
  weightG: number;
  category: string;
}

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
  onToggleReserveGear,
  onCloneStandardKit,
  onSwitchToCreate,
  onToast,
}: ClubCoffreDrawerBodyProps) {
  // D16 — Vault items search & filter state
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultFilter, setVaultFilter] = useState<VaultFilterId>('all');
  const [visibleVaultCount, setVisibleVaultCount] = useState(35);
  const [selectedGearIndex, setSelectedGearIndex] = useState<number | null>(null);

  // D17 — Standard kits filter & expanded card state
  const [kitSeason, setKitSeason] = useState<KitSeasonFilter>('all');
  const [expandedKitIds, setExpandedKitIds] = useState<Record<string, boolean>>({});

  // D18 — Collective weight splitter state
  const carrierList = useMemo(() => {
    const fromMembers = members.slice(0, 4).map((m) => `${m.name} (@${m.handle})`);
    return fromMembers.length >= 2
      ? fromMembers
      : ['Tony (@tony_frc)', 'Léa (@lea.fontaine)', 'Marc (@marc_alpi)', 'Clara (@clara.bivouac)'];
  }, [members]);

  const [collectiveItems, setCollectiveItems] = useState<CollectiveLoadItem[]>([
    { key: 'tente', name: 'Abri / Tente 3P', weightG: 1720, category: 'Bivouac' },
    { key: 'rechaud', name: 'Réchaud + Popote Titane', weightG: 310, category: 'Cuisine' },
    { key: 'corde', name: 'Corde Rando 30 m', weightG: 890, category: 'Sécurité' },
    { key: 'secours', name: 'Pharmacie & Bivouac Urgence', weightG: 420, category: 'Secours' },
  ]);

  const [cordeeCarrier, setCordeeCarrier] = useState<Record<string, string>>({
    tente: 'Tony (@tony_frc)',
    rechaud: 'Léa (@lea.fontaine)',
    corde: 'Marc (@marc_alpi)',
    secours: 'Clara (@clara.bivouac)',
  });

  const [newColName, setNewColName] = useState('');
  const [newColWeight, setNewColWeight] = useState('450');
  const [showAddCollective, setShowAddCollective] = useState(false);

  const filteredVault = useMemo(() => {
    const q = normalizeText(vaultSearch.trim());
    return vaultGear.filter((g) => {
      if (vaultFilter === 'available' && (!g.available || g.reservedByMe)) return false;
      if (vaultFilter === 'mine' && !g.reservedByMe) return false;
      if (vaultFilter === 'light' && g.weightG >= 500) return false;
      if (!q) return true;
      return normalizeText(`${g.name} ${g.brand} ${g.category} ${g.ownerName} ${g.ownerHandle}`).includes(q);
    });
  }, [vaultGear, vaultSearch, vaultFilter]);

  const filteredKits = useMemo(() => {
    return standardKits.filter((k) => {
      if (kitSeason === 'all') return true;
      const s = normalizeText(k.season);
      if (kitSeason === 'winter') return s.includes('hiver') || s.includes('alpi') || s.includes('4');
      return s.includes('ete') || s.includes('3') || s.includes('printemps') || !s.includes('hiver');
    });
  }, [standardKits, kitSeason]);

  // ============================================================================
  // D17 — 3.1 VAULT-KITS ("Kits types du club")
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
          <ClubStaggerList style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredKits.map((k) => {
              const isExpanded = Boolean(expandedKitIds[k.id]);
              const kgLabel = (k.totalWeightG / 1000).toFixed(1);
              const perItemWeight = Math.round(k.totalWeightG / Math.max(1, k.items.length));

              return (
                <ClubStaggerCard
                  key={k.id}
                  className="li nt club-outing-row club-glass-card"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div className="ttl">
                        <b>{k.title}</b> · <span className="club-badge-sage">{kgLabel} kg</span>
                      </div>
                      <div className="s2">
                        {k.season} · {k.items.length} pièces · {k.items.join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="reseau-btn active club-icon-pill"
                        onClick={() =>
                          setExpandedKitIds((prev) => ({
                            ...prev,
                            [k.id]: !prev[k.id],
                          }))
                        }
                        aria-label={isExpanded ? 'Masquer le détail du kit' : 'Voir le détail du kit'}
                        title={isExpanded ? 'Masquer le détail' : 'Détail des pièces'}
                      >
                        {isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className={`reseau-btn ${k.cloned ? 'active' : 'primary'} club-icon-pill`}
                        onClick={() => {
                          onCloneStandardKit(k.id);
                          onToast?.({
                            title: k.cloned ? 'Kit mis à jour dans votre Carnet' : 'Kit cloné dans votre Carnet ✓',
                            subtitle: `${k.title} (${kgLabel} kg)`,
                          });
                        }}
                        aria-label={k.cloned ? 'Cloné' : 'Cloner'}
                        title={k.cloned ? 'Cloné' : 'Cloner'}
                      >
                        {k.cloned ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: 14,
                        background: 'rgba(23,64,44,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                        <b>Composition détaillée du kit</b>
                        <span>Poids moyen ~{perItemWeight} g / pièce</span>
                      </div>
                      <div className="club-skill-tags">
                        {k.items.map((item, idx) => (
                          <span key={idx} className="club-skill-tag">
                            ✓ {item} (~{perItemWeight} g)
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </ClubStaggerCard>
              );
            })}
          </ClubStaggerList>
        )}
      </div>
    );
  }

  // ============================================================================
  // D18 — 3.2 VAULT-WEIGHT ("Répartition poids de cordée")
  // ============================================================================
  if (activeSubTab === 2) {
    const totalWeightG = collectiveItems.reduce((acc, it) => acc + it.weightG, 0);
    const totalKgLabel = (totalWeightG / 1000).toFixed(2).replace('.', ',');

    const loadByCarrier: Record<string, number> = {};
    carrierList.forEach((c) => {
      loadByCarrier[c] = 0;
    });
    collectiveItems.forEach((it) => {
      const assigned = cordeeCarrier[it.key] || carrierList[0];
      loadByCarrier[assigned] = (loadByCarrier[assigned] ?? 0) + it.weightG;
    });

    const autoBalanceCordee = () => {
      const sorted = [...collectiveItems].sort((a, b) => b.weightG - a.weightG);
      const buckets = carrierList.map((name) => ({ name, load: 0 }));
      const nextAssignment: Record<string, string> = {};
      sorted.forEach((item) => {
        buckets.sort((a, b) => a.load - b.load);
        nextAssignment[item.key] = buckets[0].name;
        buckets[0].load += item.weightG;
      });
      setCordeeCarrier(nextAssignment);
      onToast?.({
        title: 'Charge collective équilibrée ✓',
        subtitle: `${totalKgLabel} kg répartis sur ${carrierList.length} membres`,
      });
    };

    return (
      <div className="club-drawer-pane-content" data-testid="club-vault-weight-pane">
        {/* Actions bar: Auto-balance + Add collective item */}
        <div className="club-form-pills" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className="reseau-btn primary"
            onClick={autoBalanceCordee}
          >
            <Scale size={14} aria-hidden="true" />
            <span>Équilibrer automatiquement</span>
          </button>
          <button
            type="button"
            className="reseau-btn active"
            onClick={() => setShowAddCollective((v) => !v)}
          >
            <Plus size={14} aria-hidden="true" />
            <span>{showAddCollective ? 'Fermer' : 'Ajouter une pièce'}</span>
          </button>
        </div>

        {showAddCollective ? (
          <form
            className="li nt club-glass-card"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, marginBottom: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newColName.trim()) return;
              const weightG = Math.max(50, Number(newColWeight) || 400);
              const key = `col-${Date.now()}`;
              setCollectiveItems((prev) => [
                ...prev,
                { key, name: newColName.trim(), weightG, category: 'Collectif' },
              ]);
              setCordeeCarrier((prev) => ({
                ...prev,
                [key]: carrierList[collectiveItems.length % carrierList.length],
              }));
              setNewColName('');
              setShowAddCollective(false);
              onToast?.({
                title: 'Pièce collective ajoutée',
                subtitle: `${newColName.trim()} (${weightG} g)`,
              });
            }}
          >
            <div className="club-form-grid-2">
              <input
                type="text"
                className="club-glass-input"
                placeholder="Nom de la pièce (ex : Filtre eau)"
                aria-label="Nom de la pièce collective"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
              <input
                type="number"
                className="club-glass-input"
                placeholder="Poids (g)"
                aria-label="Poids en grammes"
                value={newColWeight}
                onChange={(e) => setNewColWeight(e.target.value)}
              />
            </div>
            <button type="submit" className="reseau-btn primary">
              Ajouter à la charge de cordée
            </button>
          </form>
        ) : null}

        {/* Per-carrier load summary card */}
        <div
          className="li nt club-glass-card"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, marginBottom: 8 }}
        >
          <b style={{ fontSize: 12.5, color: '#172b24' }}>Charge portée par membre</b>
          {Object.entries(loadByCarrier).map(([carrierName, grams]) => {
            const pct = Math.min(100, Math.round((grams / Math.max(1, totalWeightG)) * 100));
            return (
              <div key={carrierName} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div className="s2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{carrierName}</span>
                  <b>{grams} g ({pct}%)</b>
                </div>
                <div className="club-progress-track">
                  <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {collectiveItems.map((item) => {
          const assigned = cordeeCarrier[item.key] || carrierList[0];
          return (
            <div key={item.key} className="li nt club-glass-card">
              <div>
                <div className="ttl">
                  <span>
                    {item.name} ({item.weightG.toLocaleString('fr-FR')} g)
                  </span>
                </div>
                <div className="s2">
                  Porté par : <b>{assigned}</b>
                </div>
              </div>
              <button
                type="button"
                className="reseau-btn active club-icon-pill"
                onClick={() => {
                  const cur = cordeeCarrier[item.key] || carrierList[0];
                  const idx = carrierList.indexOf(cur);
                  const next = carrierList[(idx + 1) % carrierList.length];
                  setCordeeCarrier((prev) => ({ ...prev, [item.key]: next }));
                }}
                aria-label="Changer"
                title="Changer de porteur"
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // D18b — 3.3 VAULT-CHALLENGES ("Défis & classements")
  // ============================================================================
  if (activeSubTab === 3) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, width: '100%' }}
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
              const weightLabel =
                g.weightG >= 1000
                  ? `${(g.weightG / 1000).toFixed(1).replace('.', ',')} kg`
                  : `${g.weightG} g`;
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
                        {g.ownerName} · {weightLabel}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                        <span className={g.reservedByMe ? 'club-badge-sage' : 'club-badge-soft'}>
                          {g.reservedByMe ? 'Réservé ✓' : g.condition || 'Vérifié'}
                        </span>
                        <span className="club-badge-soft">{g.category}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`reseau-btn ${g.reservedByMe ? 'active' : 'primary'} club-icon-pill`}
                    style={{ flex: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGearIndex(idx);
                    }}
                    aria-label={g.reservedByMe ? 'Réservé · Voir la fiche' : 'Voir l’équipement'}
                    title={g.reservedByMe ? 'Réservé · Voir' : 'Voir'}
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
