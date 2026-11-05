'use client';

/**
 * src/features/kit-studio/drawers/InventaireDrawer.tsx
 * Tiroir Inventaire du Kit Studio (Lot L6-1 / D-01..D-03 / KIT_STUDIO_SPEC §13, §14).
 *
 * Sous-volets via DrawerShell :
 * 1. Mon inventaire (catégories, recherche, filtre, tri, ajout/retrait/pesée honnête, défis sobres, validation « Je pars »)
 * 2. Acquisition (Aperçu / Prévu / Boutique Stripe réelle / Prêts entre membres)
 * 3. Groupe (Navigation LensPager entre son sac et les kits partagés en lecture seule)
 */

import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Compass,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { DrawerEmpty, DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import { getSlotLabel } from '../scene/bag/parts';
import { formatWeight, formatWeightSummary } from '../state/selectors';
import type { DerivedTotals, KitConfiguration, KitItem, SlotId } from '../state/types';
import { AcquisitionPane } from './acquisition/AcquisitionPane';
import type {
  AcquisitionCatalogItem,
  MemberLoanRecord,
} from './acquisition/acquisitionEngine';
import { GroupePane, type SharedGroupMemberKit } from './groupe/GroupePane';

export interface OwnedInventoryCandidate {
  id: string;
  productOwnershipId: string | null;
  name: string;
  category: string | null;
  weightG: number | null; // null = non pesé, jamais 0 par défaut
}

export interface ActionablePrepChallenge {
  id: string;
  message: string;
  isUnverifiedAiSuggestion?: boolean;
}

export interface InventaireDrawerProps {
  config: KitConfiguration;
  totals: DerivedTotals;
  ownedCandidates?: OwnedInventoryCandidate[];
  catalogItems?: AcquisitionCatalogItem[];
  loans?: MemberLoanRecord[];
  groupMembers?: SharedGroupMemberKit[];
  tripId?: string | null;
  crewId?: string | null;
  kitName?: string;
  loadState?: 'ready' | 'loading' | 'error';
  onRetryLoad?: () => void;
  initialSubTab?: 'inventaire' | 'acquisition' | 'groupe';
  readOnly?: boolean;
  inspectedMemberId: string | null;
  onInspectMember: (
    member: SharedGroupMemberKit | null,
    derivedConfig: KitConfiguration | null
  ) => void;
  onAddItem: (item: Omit<KitItem, 'slotOrder'>, slotId?: SlotId | null) => Promise<void> | void;
  onRemoveItem: (itemId: string) => Promise<void> | void;
  onToggleChecked: (itemId: string, isChecked: boolean) => Promise<void> | void;
  onMoveItem: (itemId: string, targetSlotId: SlotId | null) => Promise<void> | void;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void> | void;
}

type SortKey = 'name' | 'weight-desc' | 'status';
type StatusFilter = 'all' | 'checked' | 'unchecked' | 'unweighed';

/**
 * KIT_STUDIO_SPEC §13 : Défis courts, factuels, ignorables sans pénalité, jamais d'évaluation chiffrée.
 */
export function buildHonestPrepChallenges(
  config: KitConfiguration,
  totals: DerivedTotals
): ActionablePrepChallenge[] {
  if (config.items.length === 0) return [];
  const challenges: ActionablePrepChallenge[] = [];
  const lowerNames = config.items.map((i) => i.name.toLowerCase());

  const hasWater = lowerNames.some(
    (n) =>
      n.includes('eau') ||
      n.includes('gourde') ||
      n.includes('flasque') ||
      n.includes('filtre') ||
      n.includes('poche à eau')
  );
  if (!hasWater) {
    challenges.push({
      id: 'missing-hydration',
      message: 'Aucun système d’hydratation ou de filtration d’eau détecté dans ce sac.',
    });
  }

  if (totals.unknownWeightCount > 0) {
    challenges.push({
      id: 'unweighed-items',
      message: `${totals.unknownWeightCount} équipement${totals.unknownWeightCount > 1 ? 's' : ''} n’${totals.unknownWeightCount > 1 ? 'ont' : 'a'} pas encore de masse déclarée.`,
    });
  }

  const unslottedCount = config.items.filter(
    (i) => !i.slotId || !config.slots[i.slotId]
  ).length;
  if (unslottedCount > 0 && Object.keys(config.slots).length > 0) {
    challenges.push({
      id: 'unslotted-items',
      message: `${unslottedCount} objet${unslottedCount > 1 ? 's sont encore non rangés' : ' est encore non rangé'} dans un compartiment du sac.`,
    });
  }

  return challenges;
}

export function InventaireDrawer({
  config,
  totals,
  ownedCandidates = [],
  catalogItems = [],
  loans = [],
  groupMembers,
  tripId = null,
  crewId = null,
  kitName = 'Mon sac',
  loadState = 'ready',
  onRetryLoad,
  initialSubTab = 'inventaire',
  readOnly = false,
  inspectedMemberId,
  onInspectMember,
  onAddItem,
  onRemoveItem,
  onToggleChecked,
  onMoveItem,
}: InventaireDrawerProps) {
  const initialIdx =
    initialSubTab === 'acquisition' ? 1 : initialSubTab === 'groupe' ? 2 : 0;
  const [tabIndex, setTabIndex] = useState<number>(initialIdx);

  // Contrôles de recherche, catégorie, filtre et tri (D-01)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  // Formulaire d'ajout rapide honnête (poids vide -> null, jamais 0)
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<string>('Équipement');
  const [newItemWeightInput, setNewItemWeightInput] = useState<string>('');
  const [newItemSlotId, setNewItemSlotId] = useState<string>('');

  // Défis ignorés volontairement par l'utilisateur (§13) et panneau « Je pars » (§14)
  const [dismissedChallenges, setDismissedChallenges] = useState<Set<string>>(() => new Set());
  const [showDepartureCheck, setShowDepartureCheck] = useState<boolean>(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    config.items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    ownedCandidates.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [config.items, ownedCandidates]);

  const filteredKitItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = config.items.filter((item) => {
      if (selectedCategory !== 'all' && (item.category || 'Équipement') !== selectedCategory) {
        return false;
      }
      if (q && !item.name.toLowerCase().includes(q) && !(item.category || '').toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === 'checked' && !item.isChecked) return false;
      if (statusFilter === 'unchecked' && item.isChecked) return false;
      if (statusFilter === 'unweighed' && item.weightG !== null) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortKey === 'weight-desc') {
        const wa = a.weightG ?? -1;
        const wb = b.weightG ?? -1;
        return wb - wa;
      }
      if (sortKey === 'status') {
        if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
        return a.name.localeCompare(b.name, 'fr');
      }
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [config.items, searchQuery, selectedCategory, statusFilter, sortKey]);

  const availableCandidates = useMemo(() => {
    const inKitOwnershipIds = new Set(
      config.items.map((i) => i.productOwnershipId).filter(Boolean)
    );
    const inKitIds = new Set(config.items.map((i) => i.id));
    const q = searchQuery.trim().toLowerCase();

    return ownedCandidates.filter((c) => {
      if (inKitIds.has(c.id)) return false;
      if (c.productOwnershipId && inKitOwnershipIds.has(c.productOwnershipId)) return false;
      if (selectedCategory !== 'all' && (c.category || 'Équipement') !== selectedCategory) {
        return false;
      }
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ownedCandidates, config.items, selectedCategory, searchQuery]);

  const activeChallenges = useMemo(
    () =>
      buildHonestPrepChallenges(config, totals).filter(
        (c) => !dismissedChallenges.has(c.id)
      ),
    [config, totals, dismissedChallenges]
  );

  const slotEntries = useMemo(() => Object.values(config.slots), [config.slots]);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    const rawWeight = newItemWeightInput.trim();
    const parsedWeight =
      rawWeight !== '' && Number.isFinite(Number(rawWeight)) && Number(rawWeight) >= 0
        ? Math.round(Number(rawWeight))
        : null;

    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const targetSlot: SlotId | null =
      newItemSlotId && config.slots[newItemSlotId]
        ? newItemSlotId
        : config.slots['interior-bottom']
          ? 'interior-bottom'
          : null;

    await onAddItem(
      {
        id,
        productOwnershipId: null,
        name: trimmed,
        category: newItemCategory || 'Équipement',
        quantity: 1,
        weightG: parsedWeight, // null si non saisi — JAMAIS 0 par défaut
        weightSource: parsedWeight !== null ? 'declared' : 'unknown',
        isChecked: false,
        slotId: targetSlot,
        visual: {
          scale: [0.06, 0.045, 0.06],
          color: 'var(--hub-bag-moss)',
        },
      },
      targetSlot
    );

    setNewItemName('');
    setNewItemWeightInput('');
  };

  const handleAddCandidate = async (candidate: OwnedInventoryCandidate) => {
    if (readOnly) return;
    const defaultSlot: SlotId | null = config.slots['interior-bottom']
      ? 'interior-bottom'
      : slotEntries[0]?.id ?? null;

    await onAddItem(
      {
        id: candidate.id,
        productOwnershipId: candidate.productOwnershipId,
        name: candidate.name,
        category: candidate.category,
        quantity: 1,
        weightG: candidate.weightG,
        weightSource: candidate.weightG !== null ? 'declared' : 'unknown',
        isChecked: false,
        slotId: defaultSlot,
        visual: {
          scale: [0.06, 0.045, 0.06],
          color: 'var(--hub-bag-pine)',
        },
      },
      defaultSlot
    );
  };

  const weightSummary = formatWeightSummary(totals);
  const uncheckedCount = Math.max(0, totals.itemCount - totals.checkedCount);
  const pendingLoansCount = loans.filter((l) => l.status === 'pending').length;

  const renderMyInventoryPane = () => (
    <div data-testid="studio-inventaire-pane" className="space-y-4 pb-8">
      {/* Barre de recherche, catégorie, filtre et tri (D-01) */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search
            className="w-4 h-4 text-[var(--hub-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="studio-inv-search" className="sr-only">
            Rechercher un équipement
          </label>
          <input
            id="studio-inv-search"
            type="search"
            data-testid="inventaire-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un équipement…"
            className="w-full min-h-[44px] pl-10 pr-3.5 rounded-2xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-sm text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="studio-inv-cat" className="sr-only">
              Filtrer par catégorie
            </label>
            <select
              id="studio-inv-cat"
              data-testid="inventaire-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            >
              <option value="all">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="studio-inv-filter" className="sr-only">
              Filtrer par état
            </label>
            <select
              id="studio-inv-filter"
              data-testid="inventaire-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            >
              <option value="all">Tous états</option>
              <option value="unchecked">À cocher</option>
              <option value="checked">Prêts (cochés)</option>
              <option value="unweighed">Non pesés</option>
            </select>
          </div>

          <div>
            <label htmlFor="studio-inv-sort" className="sr-only">
              Trier les objets
            </label>
            <select
              id="studio-inv-sort"
              data-testid="inventaire-sort-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            >
              <option value="name">Tri : A → Z</option>
              <option value="weight-desc">Tri : Poids ↓</option>
              <option value="status">Tri : À préparer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout d'équipement réel (masqué en lecture seule E-07) */}
      {!readOnly && (
        <form
          onSubmit={handleQuickAddSubmit}
          data-testid="inventaire-add-form"
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--hub-secondary)]">
            Ajouter un objet au sac
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="new-item-name" className="sr-only">
                Nom de l’objet
              </label>
              <input
                id="new-item-name"
                data-testid="inventaire-new-name"
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Ex. Veste imperméable, Filtre…"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="new-item-weight" className="sr-only">
                  Poids en grammes (optionnel)
                </label>
                <input
                  id="new-item-weight"
                  data-testid="inventaire-new-weight"
                  type="number"
                  min={0}
                  step={1}
                  value={newItemWeightInput}
                  onChange={(e) => setNewItemWeightInput(e.target.value)}
                  placeholder="Poids (g, optionnel)"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
                />
              </div>

              <div>
                <label htmlFor="new-item-cat" className="sr-only">
                  Catégorie
                </label>
                <select
                  id="new-item-cat"
                  data-testid="inventaire-new-category"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
                >
                  <option value="Équipement">Équipement</option>
                  <option value="Abri">Abri</option>
                  <option value="Couchage">Couchage</option>
                  <option value="Vêtements">Vêtements</option>
                  <option value="Cuisine">Cuisine</option>
                  <option value="Hydratation">Hydratation</option>
                  <option value="Sécurité">Sécurité</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {slotEntries.length > 0 ? (
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="new-item-slot" className="sr-only">
                  Compartiment cible
                </label>
                <select
                  id="new-item-slot"
                  data-testid="inventaire-new-slot"
                  value={newItemSlotId}
                  onChange={(e) => setNewItemSlotId(e.target.value)}
                  className="w-full min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
                >
                  <option value="">Compartiment par défaut</option>
                  {slotEntries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {getSlotLabel(s.id)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <button
              type="submit"
              data-testid="inventaire-add-submit"
              disabled={!newItemName.trim()}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-primary)]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Ajouter au sac</span>
            </button>
          </div>
        </form>
      )}

      {/* Réserve personnelle disponible à verser dans le sac */}
      {!readOnly && availableCandidates.length > 0 && (
        <section className="space-y-2" aria-label="Votre inventaire disponible">
          <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
            Dans votre réserve personnelle ({availableCandidates.length})
          </h4>
          <div className="space-y-1.5">
            {availableCandidates.slice(0, 8).map((cand) => (
              <div
                key={cand.id}
                data-testid={`inventaire-candidate-${cand.id}`}
                className="p-2.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--hub-text-primary)] truncate">
                    {cand.name}
                  </div>
                  <div className="text-[11px] text-[var(--hub-text-secondary)]">
                    {cand.category || 'Équipement'} •{' '}
                    {cand.weightG !== null ? formatWeight(cand.weightG) : '— (non pesé)'}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`inventaire-pick-candidate-${cand.id}`}
                  onClick={() => handleAddCandidate(cand)}
                  className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-primary-subtle)] text-[var(--hub-primary)] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ranger</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Défis courts, factuels et ignorables sans pénalité (KIT_STUDIO_SPEC §13) */}
      {!readOnly && activeChallenges.length > 0 && (
        <section
          data-testid="inventaire-prep-challenges"
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--hub-primary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--hub-action)]" aria-hidden="true" />
            <span>Repères de préparation (ignorables librement)</span>
          </div>
          <div className="space-y-1.5">
            {activeChallenges.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between gap-2 text-xs text-[var(--hub-text-secondary)] bg-[var(--hub-surface)] px-3 py-2 rounded-xl"
              >
                <span>
                  {ch.message}
                  {ch.isUnverifiedAiSuggestion ? ' (suggestion non vérifiée)' : ''}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedChallenges((prev) => {
                      const next = new Set(prev);
                      next.add(ch.id);
                      return next;
                    })
                  }
                  aria-label="Ignorer ce repère"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--hub-text-muted)] shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Liste des articles du kit ou état vide honnête (D-03 : JAMAIS de faux objet) */}
      {config.items.length === 0 ? (
        <div
          data-testid="inventaire-empty-state"
          className="p-5 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]"
        >
          <DrawerEmpty
            title="Votre sac est vide"
            hint="Ajoutez vos premiers équipements réels ci-dessus ou depuis votre réserve personnelle."
          />
        </div>
      ) : filteredKitItems.length === 0 ? (
        <div className="p-5 rounded-3xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucun équipement ne correspond aux filtres"
            hint="Modifiez votre recherche ou réinitialisez la catégorie sélectionnée."
          />
        </div>
      ) : (
        <div className="space-y-2" data-testid="inventaire-items-list">
          {filteredKitItems.map((item) => (
            <div
              key={item.id}
              data-testid={`inventaire-item-row-${item.id}`}
              className="p-3 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {!readOnly ? (
                  <button
                    type="button"
                    data-testid={`inventaire-check-${item.id}`}
                    onClick={() => onToggleChecked(item.id, !item.isChecked)}
                    aria-pressed={item.isChecked}
                    aria-label={
                      item.isChecked
                        ? `Décocher ${item.name}`
                        : `Valider ${item.name} dans le sac`
                    }
                    className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center shrink-0 ${
                      item.isChecked
                        ? 'bg-[var(--hub-action)] border-[var(--hub-action)] text-[var(--hub-text-inverted)]'
                        : 'bg-[var(--hub-surface)] border-[var(--hub-border-strong)] text-[var(--hub-text-muted)]'
                    }`}
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </button>
                ) : null}

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--hub-text-primary)] truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-[var(--hub-text-secondary)] flex flex-wrap items-center gap-1.5">
                    <span>{item.category || 'Équipement'}</span>
                    <span>•</span>
                    <span data-testid={`inventaire-item-weight-${item.id}`}>
                      {item.weightG !== null ? formatWeight(item.weightG) : '— (non pesé)'}
                    </span>
                    <span>•</span>
                    <span>Qté {item.quantity}</span>
                    {item.visual === null && (
                      <>
                        <span>•</span>
                        <span className="text-[var(--hub-text-muted)]">
                          Listé (sans forme 3D dédiée)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2 shrink-0">
                  {slotEntries.length > 0 && (
                    <>
                      <label htmlFor={`inv-slot-${item.id}`} className="sr-only">
                        Emplacement de {item.name}
                      </label>
                      <select
                        id={`inv-slot-${item.id}`}
                        data-testid={`inventaire-slot-select-${item.id}`}
                        value={item.slotId ?? ''}
                        onChange={(e) =>
                          onMoveItem(item.id, e.target.value ? e.target.value : null)
                        }
                        className="min-h-[44px] px-2.5 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
                      >
                        <option value="">Non rangé</option>
                        {slotEntries.map((s) => (
                          <option key={s.id} value={s.id}>
                            {getSlotLabel(s.id)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <button
                    type="button"
                    data-testid={`inventaire-remove-${item.id}`}
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={`Retirer ${item.name}`}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--hub-border)] bg-[var(--hub-surface)] text-[var(--hub-danger)] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation honnête « Je pars » (KIT_STUDIO_SPEC §14) */}
      {!readOnly && config.items.length > 0 && (
        <section className="pt-2 space-y-2.5">
          <button
            type="button"
            data-testid="inventaire-je-pars-btn"
            onClick={() => setShowDepartureCheck((v) => !v)}
            aria-expanded={showDepartureCheck}
            className="w-full min-h-[48px] px-4 rounded-2xl bg-[var(--hub-primary)] text-[var(--hub-text-inverted)] text-sm font-bold flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>Point de préparation « Je pars »</span>
          </button>

          {showDepartureCheck && (
            <div
              data-testid="inventaire-je-pars-summary"
              role="region"
              aria-label="Bilan honnête avant départ"
              className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--hub-primary)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
                <span>
                  Prêt dans le sac : {totals.checkedCount} sur {totals.itemCount} objets ({weightSummary.primary})
                </span>
              </div>

              {uncheckedCount === 0 && totals.unknownWeightCount === 0 && pendingLoansCount === 0 ? (
                <p className="text-[var(--hub-success)] font-medium">
                  Tous les équipements inscrits sont cochés et pesés. Bonne route !
                </p>
              ) : (
                <div className="space-y-1 text-[var(--hub-text-secondary)]">
                  <div className="font-semibold text-[var(--hub-warning)]">
                    Points restant incertains avant départ :
                  </div>
                  <ul className="space-y-0.5 pl-3">
                    {uncheckedCount > 0 && (
                      <li>
                        • {uncheckedCount} objet{uncheckedCount > 1 ? 's' : ''} prévu{uncheckedCount > 1 ? 's' : ''} non encore coché{uncheckedCount > 1 ? 's' : ''} physiquement.
                      </li>
                    )}
                    {totals.unknownWeightCount > 0 && (
                      <li>
                        • {totals.unknownWeightCount} objet{totals.unknownWeightCount > 1 ? 's' : ''} sans masse déclarée (exclus du total en grammes).
                      </li>
                    )}
                    {pendingLoansCount > 0 && (
                      <li>
                        • {pendingLoansCount} prêt{pendingLoansCount > 1 ? 's' : ''} entre membres non encore réceptionné{pendingLoansCount > 1 ? 's' : ''}.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'inventaire',
      label: 'Mon inventaire',
      icon: <Package className="w-4 h-4" aria-hidden="true" />,
      render: renderMyInventoryPane,
    },
    {
      id: 'acquisition',
      label: 'Acquisition & Prêts',
      icon: <ShoppingBag className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <AcquisitionPane
          config={config}
          catalogItems={catalogItems}
          loans={loans}
          onAddPlannedItem={(item) => onAddItem(item, item.slotId)}
        />
      ),
    },
    {
      id: 'groupe',
      label: 'Groupe',
      icon: <Users className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <GroupePane
          ownConfig={config}
          ownKitName={kitName}
          tripId={tripId}
          crewId={crewId}
          initialMembers={groupMembers}
          inspectedMemberId={inspectedMemberId}
          onInspectMember={onInspectMember}
        />
      ),
    },
  ];

  return (
    <DrawerShell
      tabs={tabs}
      activeIndex={tabIndex}
      onIndexChange={setTabIndex}
      state={loadState}
      onRetry={onRetryLoad}
    />
  );
}
