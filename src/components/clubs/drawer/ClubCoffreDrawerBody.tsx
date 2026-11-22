'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
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

type VaultFilterId = 'all' | 'available' | 'mine' | 'light';
type KitSeasonFilter = 'all' | 'summer' | 'winter';

interface CollectiveLoadItem {
  key: string;
  name: string;
  weightG: number;
  category: string;
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
  // D16 — 3.0 VAULT-ITEMS ("Équipements prêtables du coffre")
  // ============================================================================
  const reservedCount = vaultGear.filter((g) => g.reservedByMe).length;
  const totalVaultWeightKg = (
    vaultGear.reduce((acc, g) => acc + (g.weightG || 0), 0) / 1000
  ).toFixed(1);

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
            {filteredVault.map((g) => (
              <ClubStaggerCard key={g.id} className="li nt club-outing-row club-glass-card">
                <div>
                  <div className="ttl">
                    <b>{g.name}</b> · <span className="s2">{g.brand} ({g.weightG} g)</span>
                  </div>
                  <div className="s2">
                    Prêté par <b>{g.ownerName}</b> (@{g.ownerHandle}) · {g.category} ·{' '}
                    <span className={g.reservedByMe ? 'club-badge-sage' : 'club-badge-soft'}>
                      {g.reservedByMe ? 'Réservé par vous ✓' : g.condition || 'Vérifié'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`reseau-btn ${g.reservedByMe ? 'active' : 'primary'} club-icon-pill`}
                  onClick={() => {
                    onToggleReserveGear(g.id);
                    onToast?.({
                      title: g.reservedByMe ? 'Emprunt libéré' : 'Équipement réservé ✓',
                      subtitle: `${g.name} (${g.ownerName})`,
                      undo: () => onToggleReserveGear(g.id),
                    });
                  }}
                  aria-label={g.reservedByMe ? 'Réservé' : 'Emprunter'}
                  title={g.reservedByMe ? 'Réservé' : 'Emprunter'}
                >
                  {g.reservedByMe ? <Check size={16} aria-hidden="true" /> : <Package size={16} aria-hidden="true" />}
                </button>
              </ClubStaggerCard>
            ))}
          </ClubStaggerList>
        )}
      </div>
    </div>
  );
}

export default ClubCoffreDrawerBody;
