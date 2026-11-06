'use client';

/**
 * src/features/kit-studio/drawers/groupe/GroupePane.tsx
 * Navigation entre son propre kit et les kits partagés par les membres actifs du groupe (Lot L7-3 / E-01..E-10).
 *
 * INVARIANTS CRITIQUES :
 * - E-01 : Réutilise littéralement `LensPager` (`@/components/ui/drawer`) pour naviguer entre kits.
 * - E-02 : Sélectionner un membre change le sac affiché dans le Studio en lecture seule.
 * - E-07 : En lecture seule, AUCUN bouton d'édition n'est rendu dans le DOM.
 * - E-08 : Si le membre inspecté quitte le groupe ou retire son partage, retour immédiat à « Mon kit » avec message explicite.
 * - E-06 / E-10 : Ne consomme que les charges utiles purifiées par `sanitizeSharedGroupKitPayload` (`viewerCanReadDocs = false`, aucun objet privé).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { DrawerEmpty, DrawerError, DrawerSkeleton, LensPager } from '@/components/ui/drawer';
import { DEFAULT_BAG_CAPABILITIES } from '../../state/kitConfiguration';
import { formatWeightSummary, selectDerivedTotals } from '../../state/selectors';
import type { KitConfiguration, KitItem, PartConfig, PartId } from '../../state/types';

export interface SharedGroupMemberKit {
  memberId: string;
  memberName: string;
  memberAvatarUrl?: string | null;
  readOnly: true;
  viewerCanReadDocs: false;
  kit: {
    kitId: string;
    name: string;
    bagModelId: string | null;
    bagParts: Record<PartId, PartConfig>;
    revision: number;
  };
  items: KitItem[];
  placedBadges: Array<{
    id: string;
    badgeId: string;
    anchorId: string;
    scale: number;
  }>;
}

export interface GroupePaneProps {
  ownConfig: KitConfiguration;
  ownKitName?: string;
  tripId?: string | null;
  crewId?: string | null;
  initialMembers?: SharedGroupMemberKit[];
  inspectedMemberId: string | null;
  onInspectMember: (member: SharedGroupMemberKit | null, derivedConfig: KitConfiguration | null) => void;
}

export function memberKitToConfiguration(member: SharedGroupMemberKit): KitConfiguration {
  return {
    kitId: member.kit.kitId,
    revision: member.kit.revision,
    bag: {
      modelId: member.kit.bagModelId,
      capabilities: DEFAULT_BAG_CAPABILITIES,
      parts: member.kit.bagParts ?? {},
      declaredCapacityL: null,
    },
    slots: {},
    items: member.items,
    placedBadges: member.placedBadges,
  };
}

export function detectCommunalDuplicates(
  ownItems: KitItem[],
  members: SharedGroupMemberKit[]
): string[] {
  const COMMUNAL_KEYWORDS = ['réchaud', 'rechaud', 'tente', 'filtre', 'popote', 'corde', 'trousse'];
  const counts = new Map<string, Set<string>>();

  const register = (holder: string, itemName: string) => {
    const lower = itemName.toLowerCase();
    for (const kw of COMMUNAL_KEYWORDS) {
      if (lower.includes(kw)) {
        const set = counts.get(kw) ?? new Set<string>();
        set.add(holder);
        counts.set(kw, set);
      }
    }
  };

  ownItems.forEach((i) => register('Vous', i.name));
  members.forEach((m) => m.items.forEach((i) => register(m.memberName, i.name)));

  const warnings: string[] = [];
  for (const [kw, holders] of counts.entries()) {
    if (holders.size >= 2) {
      warnings.push(
        `${holders.size} membres emportent « ${kw} » (${Array.from(holders).join(', ')})`
      );
    }
  }
  return warnings;
}

export function GroupePane({
  ownConfig,
  ownKitName = 'Mon sac',
  tripId = null,
  crewId = null,
  initialMembers,
  inspectedMemberId,
  onInspectMember,
}: GroupePaneProps) {
  const [members, setMembers] = useState<SharedGroupMemberKit[]>(initialMembers ?? []);
  const [loading, setLoading] = useState<boolean>(!initialMembers && Boolean(tripId || crewId));
  const [error, setError] = useState<string | null>(null);
  const [departedNotice, setDepartedNotice] = useState<string | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  const fetchGroupKits = async () => {
    if (!tripId && !crewId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (tripId) qs.set('tripId', tripId);
      if (crewId) qs.set('crewId', crewId);
      const res = await fetch(`/api/kit-studio/group?${qs.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Erreur réseau (${res.status})`);
      }
      const data = await res.json();
      const nextMembers: SharedGroupMemberKit[] = Array.isArray(data.members)
        ? data.members
        : [];
      setMembers(nextMembers);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger les kits partagés du groupe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialMembers !== undefined) {
      setMembers(initialMembers);
      return;
    }
    void fetchGroupKits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, crewId, initialMembers]);

  // E-08 : Détection départ d'un membre ou retrait de partage -> retour automatique à Mon kit
  useEffect(() => {
    if (!inspectedMemberId) return;
    const stillPresent = members.some((m) => m.memberId === inspectedMemberId);
    if (!stillPresent) {
      setDepartedNotice(
        'Ce membre ne partage plus son kit avec l’équipage — retour à votre sac.'
      );
      onInspectMember(null, null);
    }
  }, [members, inspectedMemberId, onInspectMember]);

  const lenses = useMemo(() => {
    const entries: Array<
      | { kind: 'self'; id: string; label: string; config: KitConfiguration }
      | {
          kind: 'member';
          id: string;
          label: string;
          member: SharedGroupMemberKit;
          config: KitConfiguration;
        }
    > = [
      {
        kind: 'self',
        id: 'self',
        label: ownKitName,
        config: ownConfig,
      },
    ];

    for (const member of members) {
      entries.push({
        kind: 'member',
        id: member.memberId,
        label: member.memberName,
        member,
        config: memberKitToConfiguration(member),
      });
    }

    return entries;
  }, [ownConfig, ownKitName, members]);

  const activeLensIndex = useMemo(() => {
    if (!inspectedMemberId) return 0;
    const idx = lenses.findIndex(
      (entry) => entry.kind === 'member' && entry.member.memberId === inspectedMemberId
    );
    return idx >= 0 ? idx : 0;
  }, [inspectedMemberId, lenses]);

  const handleSelectLens = (index: number) => {
    const target = lenses[index];
    if (!target || target.kind === 'self') {
      onInspectMember(null, null);
      return;
    }
    setDepartedNotice(null);
    onInspectMember(target.member, target.config);
  };

  const duplicateWarnings = useMemo(
    () => detectCommunalDuplicates(ownConfig.items, members),
    [ownConfig.items, members]
  );

  if (loading) {
    return <DrawerSkeleton />;
  }

  if (error) {
    return <DrawerError onRetry={fetchGroupKits} />;
  }

  return (
    <div data-testid="studio-groupe-pane" className="space-y-4 pb-8">
      {departedNotice && (
        <div
          data-testid="groupe-departed-banner"
          role="alert"
          className="p-3.5 rounded-2xl bg-[var(--hub-warning-bg)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
        >
          {departedNotice}
        </div>
      )}

      {/* Capsule de sélection synchronisée avec LensPager (E-01) */}
      <div className="flex items-center justify-between gap-2">
        <div
          ref={flowRef}
          role="tablist"
          aria-label="Sacs de l’équipage"
          className="flex-1 flex items-center gap-1.5 overflow-x-auto p-1 rounded-full bg-[var(--hub-surface-muted)] border border-[var(--hub-border)]"
          data-hscroll="true"
        >
          {lenses.map((lens, idx) => {
            const active = idx === activeLensIndex;
            return (
              <button
                key={lens.id}
                type="button"
                role="tab"
                data-testid={`groupe-lens-tab-${lens.id}`}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => handleSelectLens(idx)}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)] ${
                  active
                    ? 'bg-[var(--hub-primary)] text-[var(--hub-text-inverted)]'
                    : 'text-[var(--hub-text-secondary)] hover:text-[var(--hub-text-primary)]'
                }`}
              >
                {lens.kind === 'self' ? `Mon sac` : lens.label}
              </button>
            );
          })}
        </div>

        {(tripId || crewId) && (
          <button
            type="button"
            data-testid="groupe-refresh-btn"
            onClick={fetchGroupKits}
            aria-label="Actualiser les kits partagés du groupe"
            className="min-h-[44px] min-w-[44px] rounded-full bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-center text-[var(--hub-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Piste horizontale LensPager identique au drawer Kit de Compte (E-01, E-02) */}
      <LensPager
        index={activeLensIndex}
        count={lenses.length}
        onIndexChange={handleSelectLens}
        flowRef={flowRef}
        label="Kits partagés de l’équipage"
      >
        <div
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: '100%',
            width: '100%',
          }}
        >
          {lenses.map((lens, idx) => {
            const totals = selectDerivedTotals(lens.config);
            const weight = formatWeightSummary(totals);
            const isActive = idx === activeLensIndex;

            return (
              <div
                key={lens.id}
                data-testid={`groupe-lens-pane-${lens.id}`}
                aria-hidden={!isActive}
                inert={!isActive}
                className="w-full px-0.5 space-y-3"
              >
                <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-secondary)]">
                        {lens.kind === 'self'
                          ? 'Propriétaire (édition active)'
                          : 'Consultation lecture seule'}
                      </span>
                      <h4 className="text-sm font-bold text-[var(--hub-primary)]">
                        {lens.kind === 'self'
                          ? ownKitName
                          : `${lens.member.kit.name} • ${lens.member.memberName}`}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--hub-primary)]">
                        {weight.primary}
                      </div>
                      {weight.secondary && (
                        <div className="text-[11px] text-[var(--hub-warning)]">
                          {weight.secondary}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-[var(--hub-text-secondary)] flex flex-wrap items-center gap-2">
                    <span>
                      {totals.checkedCount}/{totals.itemCount} objets prêts
                    </span>
                    {lens.kind === 'member' && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-[var(--hub-primary)] font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          Objets privés et documents exclus
                        </span>
                      </>
                    )}
                  </div>

                  {/* Liste en lecture seule des objets partagés du coéquipier (E-07 : ZÉRO bouton d'édition) */}
                  {lens.kind === 'member' && (
                    <div className="pt-2 space-y-1.5 border-t border-[var(--hub-border-subtle)]">
                      {lens.member.items.length === 0 ? (
                        <p className="text-xs text-[var(--hub-text-muted)]">
                          Aucun équipement public listé dans ce sac partagé.
                        </p>
                      ) : (
                        lens.member.items.map((item) => (
                          <div
                            key={item.id}
                            data-testid={`groupe-peer-item-${item.id}`}
                            className="py-1.5 px-2.5 rounded-xl bg-[var(--hub-surface)] flex items-center justify-between text-xs"
                          >
                            <span className="font-medium text-[var(--hub-text-primary)] truncate">
                              {item.name} (×{item.quantity})
                            </span>
                            <span className="text-[var(--hub-text-secondary)] shrink-0 ml-2">
                              {item.weightG !== null ? `${item.weightG} g` : '—'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </LensPager>

      {/* État vide honnête si aucun membre ne partage encore son kit */}
      {members.length === 0 && (
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucun autre sac partagé dans ce groupe"
            hint="Seuls les coéquipiers ayant activé « Partager mon kit avec l’équipage » dans Options apparaissent ici."
          />
        </div>
      )}

      {/* Synthèse collective des doublons d'équipement commun */}
      {duplicateWarnings.length > 0 && (
        <section
          data-testid="groupe-communal-duplicates"
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-1.5"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--hub-primary)]">
            <Users className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
            <span>Coordination matériel collectif</span>
          </div>
          <ul className="space-y-1 text-xs text-[var(--hub-text-secondary)]">
            {duplicateWarnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
