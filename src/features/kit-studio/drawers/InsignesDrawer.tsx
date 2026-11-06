'use client';

/**
 * src/features/kit-studio/drawers/InsignesDrawer.tsx
 * Tiroir Insignes du Kit Studio (Lot L7-5 / F-07..F-10 / SEC-08).
 *
 * INVARIANTS CRITIQUES :
 * - F-07 / SEC-08 : Aucune récompense n'est accordée depuis le client. Les insignes de « À débloquer »
 *   ne possèdent aucun bouton d'attribution ou de pose, et le serveur vérifie `public.user_badges`.
 * - F-08 : L'attribution serveur existante est idempotente (`UNIQUE (user_id, badge_id)`).
 * - F-09 : Trophées (`kind: 'trophy'`, médaillon hexagonal métallique issu du ledger de progression)
 *   et Écussons (`kind: 'patch'`, emblème circulaire textile cousu) sont visuellement distincts.
 * - F-10 : Pose autorisée UNIQUEMENT sur une ancre listée dans `config.bag.capabilities.badgeAnchors`.
 */

import React, { useMemo, useState } from 'react';
import { Award, Lock, MapPin, Pin, Shield, Trash2 } from 'lucide-react';
import { DrawerEmpty, DrawerShell, type DrawerTab } from '@/components/ui/drawer';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { getAnchorLabel } from '../scene/bag/parts';
import type { AnchorId, KitConfiguration } from '../state/types';

export interface StudioBadgeDefinition {
  id: string;
  label: string;
  description: string;
  kind: 'trophy' | 'patch';
  earned: boolean;
  earnedAtLabel?: string | null;
  colorToken?: string;
}

export type BadgePlacementValidation =
  | { ok: true; anchorId: AnchorId; scale: number }
  | { ok: false; code: 'NOT_OWNED' | 'NO_ANCHORS' | 'INCOMPATIBLE_ANCHOR'; reason: string };

/**
 * F-07 & F-10 : Validation pure de pose d'insigne sur le sac.
 * Refuse tout insigne non possédé et toute ancre absente de `supportedAnchors`.
 */
export function validateBadgePlacement(params: {
  badgeId: string;
  ownedBadgeIds: ReadonlySet<string>;
  anchorId: AnchorId;
  supportedAnchors: readonly AnchorId[];
  scale?: number;
}): BadgePlacementValidation {
  const { badgeId, ownedBadgeIds, anchorId, supportedAnchors, scale = 1.0 } = params;

  if (!ownedBadgeIds.has(badgeId)) {
    return {
      ok: false,
      code: 'NOT_OWNED',
      reason: 'Pose refusée : cet insigne n’est pas encore débloqué sur votre compte.',
    };
  }

  if (supportedAnchors.length === 0) {
    return {
      ok: false,
      code: 'NO_ANCHORS',
      reason: 'Ce modèle de sac ne dispose d’aucun emplacement d’insigne compatible.',
    };
  }

  if (!supportedAnchors.includes(anchorId)) {
    return {
      ok: false,
      code: 'INCOMPATIBLE_ANCHOR',
      reason: `Emplacement « ${anchorId} » incompatible avec ce modèle de sac.`,
    };
  }

  const clampedScale = Math.max(0.5, Math.min(3.0, Number.isFinite(scale) ? scale : 1.0));
  return {
    ok: true,
    anchorId,
    scale: clampedScale,
  };
}

/**
 * Rendu visuel distinct Trophée métallique hexagonal vs Écusson textile circulaire cousu (F-09).
 */
export function BadgeEmblemVisual({
  kind,
  earned,
}: {
  kind: 'trophy' | 'patch';
  earned: boolean;
}) {
  if (kind === 'trophy') {
    return (
      <div
        data-testid="badge-emblem-trophy"
        data-badge-kind="trophy"
        aria-hidden="true"
        className={`w-11 h-11 flex items-center justify-center shrink-0 border-2 ${
          earned
            ? 'bg-[var(--hub-warning-bg)] border-[var(--hub-warning)] text-[var(--hub-primary)]'
            : 'bg-[var(--hub-surface-muted)] border-[var(--hub-border)] text-[var(--hub-text-muted)]'
        }`}
        style={{
          clipPath: 'polygon(25% 5%, 75% 5%, 98% 50%, 75% 95%, 25% 95%, 2% 50%)',
        }}
      >
        <Award className="w-5 h-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      data-testid="badge-emblem-patch"
      data-badge-kind="patch"
      aria-hidden="true"
      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-2 border-dashed ${
        earned
          ? 'bg-[var(--hub-primary-subtle)] border-[var(--hub-action)] text-[var(--hub-action)]'
          : 'bg-[var(--hub-surface-muted)] border-[var(--hub-border)] text-[var(--hub-text-muted)]'
      }`}
    >
      <Shield className="w-5 h-5" aria-hidden="true" />
    </div>
  );
}

export interface InsignesDrawerProps {
  config: KitConfiguration;
  badges?: StudioBadgeDefinition[];
  readOnly?: boolean;
  onPlaceBadge: (badgeId: string, anchorId: AnchorId, scale?: number) => Promise<void> | void;
  onRemoveBadge: (placedBadgeId: string) => Promise<void> | void;
}

export function InsignesDrawer({
  config,
  badges = [],
  readOnly = false,
  onPlaceBadge,
  onRemoveBadge,
}: InsignesDrawerProps) {
  const { haptic } = useHapticFeedback();
  const [tabIndex, setTabIndex] = useState<number>(0);
  const supportedAnchors = config.bag.capabilities.badgeAnchors;

  const earnedBadges = useMemo(() => badges.filter((b) => b.earned), [badges]);
  const lockedBadges = useMemo(() => badges.filter((b) => !b.earned), [badges]);
  const ownedSet = useMemo(
    () => new Set(earnedBadges.map((b) => b.id)),
    [earnedBadges]
  );

  const [selectedBadgeId, setSelectedBadgeId] = useState<string>(
    earnedBadges[0]?.id ?? ''
  );
  const [selectedAnchorId, setSelectedAnchorId] = useState<AnchorId>(
    supportedAnchors[0] ?? ''
  );
  const [selectedScale, setSelectedScale] = useState<number>(1.0);
  const [placementMessage, setPlacementMessage] = useState<string | null>(null);

  const badgeById = useMemo(
    () => new Map(badges.map((b) => [b.id, b])),
    [badges]
  );

  const handlePinBadge = async (badgeId: string, anchorOverride?: AnchorId) => {
    if (readOnly) return;
    haptic('light');
    const anchor = anchorOverride || selectedAnchorId || supportedAnchors[0] || '';
    const check = validateBadgePlacement({
      badgeId,
      ownedBadgeIds: ownedSet,
      anchorId: anchor,
      supportedAnchors,
      scale: selectedScale,
    });

    if (!check.ok) {
      setPlacementMessage(check.reason);
      return;
    }

    await onPlaceBadge(badgeId, check.anchorId, check.scale);
    setPlacementMessage(
      `Insigne épinglé sur « ${getAnchorLabel(check.anchorId)} ».`
    );
  };

  const renderEarnedPane = () => (
    <div data-testid="studio-insignes-earned-pane" className="space-y-3 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
      {placementMessage && (
        <div
          data-testid="insignes-placement-feedback"
          role="status"
          className="p-3 rounded-2xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] text-xs text-[var(--hub-text-primary)]"
        >
          {placementMessage}
        </div>
      )}

      {supportedAnchors.length === 0 && (
        <div
          data-testid="insignes-no-anchors-notice"
          className="p-3.5 rounded-2xl bg-[var(--hub-surface-muted)] border border-[var(--hub-border)] text-xs text-[var(--hub-text-secondary)]"
        >
          Ce modèle de sac ne comporte aucun point d’attache d’insigne : vos trophées et écussons restent consultables ci-dessous, mais la pose sur toile est désactivée.
        </div>
      )}

      {earnedBadges.length === 0 ? (
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucun insigne débloqué pour l’instant"
            hint="Vos trophées de sorties validées et vos écussons acquis s’afficheront automatiquement ici."
          />
        </div>
      ) : (
        earnedBadges.map((badge) => {
          const alreadyPinned = config.placedBadges.find((p) => p.badgeId === badge.id);
          return (
            <div
              key={badge.id}
              data-testid={`insigne-earned-${badge.id}`}
              className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <BadgeEmblemVisual kind={badge.kind} earned={true} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--hub-text-primary)] truncate">
                      {badge.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--hub-surface-muted)] text-[var(--hub-secondary)] shrink-0">
                      {badge.kind === 'trophy' ? 'Trophée métallique' : 'Écusson textile'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--hub-text-secondary)] truncate">
                    {badge.description}
                  </p>
                </div>
              </div>

              {!readOnly && supportedAnchors.length > 0 && (
                <button
                  type="button"
                  data-testid={`insigne-pin-btn-${badge.id}`}
                  onClick={() => handlePinBadge(badge.id)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{alreadyPinned ? 'Reposer' : 'Épingler'}</span>
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderLockedPane = () => (
    <div data-testid="studio-insignes-locked-pane" className="space-y-3 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
      <p className="px-1 text-xs text-[var(--hub-text-secondary)]">
        Les trophées sont attribués uniquement par le serveur lors de vos étapes réelles validées.
      </p>

      {lockedBadges.length === 0 ? (
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucun jalon en attente"
            hint="Tous les insignes du catalogue actuel sont déjà obtenus."
          />
        </div>
      ) : (
        lockedBadges.map((badge) => (
          <div
            key={badge.id}
            data-testid={`insigne-locked-${badge.id}`}
            className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-between gap-3 opacity-85"
          >
            <div className="flex items-center gap-3 min-w-0">
              <BadgeEmblemVisual kind={badge.kind} earned={false} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--hub-text-primary)] truncate">
                  {badge.label}
                </div>
                <p className="text-xs text-[var(--hub-text-secondary)]">
                  {badge.description}
                </p>
              </div>
            </div>
            {/* F-07 : ZÉRO bouton d'attribution ou d'épinglage client sur un insigne non obtenu */}
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--hub-surface-muted)] text-[var(--hub-text-muted)] inline-flex items-center gap-1 shrink-0">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Verrouillé</span>
            </span>
          </div>
        ))
      )}
    </div>
  );

  const renderPinnedPane = () => (
    <div data-testid="studio-insignes-pinned-pane" className="space-y-3 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
      {config.placedBadges.length === 0 ? (
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucun insigne épinglé sur ce sac"
            hint="Choisissez un trophée ou un écusson dans l’onglet « Obtenus » pour le fixer sur une ancre."
          />
        </div>
      ) : (
        config.placedBadges.map((placed) => {
          const def = badgeById.get(placed.badgeId);
          return (
            <div
              key={placed.id}
              data-testid={`insigne-placed-${placed.id}`}
              className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <BadgeEmblemVisual kind={def?.kind ?? 'patch'} earned={true} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--hub-text-primary)] truncate">
                    {def?.label ?? placed.badgeId}
                  </div>
                  <div className="text-xs text-[var(--hub-text-secondary)]">
                    Ancre : {getAnchorLabel(placed.anchorId)} • Taille ×{placed.scale.toFixed(1)}
                  </div>
                </div>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  data-testid={`insigne-remove-${placed.id}`}
                  onClick={() => {
                    haptic('light');
                    void onRemoveBadge(placed.id);
                  }}
                  aria-label={`Retirer l’insigne ${def?.label ?? placed.badgeId}`}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-[var(--hub-border)] bg-[var(--hub-surface)] text-[var(--hub-danger)] flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const renderAnchorAndSizePane = () => {
    if (supportedAnchors.length === 0) {
      return (
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucune ancre compatible sur ce sac"
            hint="Ce gabarit de sac ne possède pas de zone dédiée aux insignes."
          />
        </div>
      );
    }

    return (
      <div data-testid="studio-insignes-placement-pane" className="space-y-4 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="insigne-badge-select"
              className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]"
            >
              Insigne obtenu à positionner
            </label>
            <select
              id="insigne-badge-select"
              data-testid="insigne-select-owned"
              value={selectedBadgeId}
              onChange={(e) => setSelectedBadgeId(e.target.value)}
              disabled={earnedBadges.length === 0 || readOnly}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--hub-field-bg)] border border-[var(--hub-field-border)] text-xs text-[var(--hub-text-primary)]"
            >
              {earnedBadges.length === 0 ? (
                <option value="">Aucun insigne obtenu</option>
              ) : (
                earnedBadges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.kind === 'trophy' ? 'Trophée' : 'Écusson'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)]">
              Ancres compatibles sur ce sac ({supportedAnchors.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {supportedAnchors.map((anchorId) => {
                const active = anchorId === (selectedAnchorId || supportedAnchors[0]);
                return (
                  <button
                    key={anchorId}
                    type="button"
                    data-testid={`insigne-anchor-btn-${anchorId}`}
                    aria-pressed={active}
                    onClick={() => {
                      haptic('selection');
                      setSelectedAnchorId(anchorId);
                    }}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold ${
                      active
                        ? 'bg-[var(--hub-primary)] border-[var(--hub-primary)] text-[var(--hub-text-inverted)]'
                        : 'bg-[var(--hub-surface)] border-[var(--hub-border)] text-[var(--hub-text-primary)]'
                    }`}
                  >
                    {getAnchorLabel(anchorId)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="insigne-scale-range"
              className="text-xs font-bold uppercase tracking-wider text-[var(--hub-text-muted)] block"
            >
              Échelle : ×{selectedScale.toFixed(1)}
            </label>
            <input
              id="insigne-scale-range"
              data-testid="insigne-scale-input"
              type="range"
              min={0.7}
              max={1.8}
              step={0.1}
              value={selectedScale}
              disabled={readOnly}
              onChange={(e) => setSelectedScale(Number(e.target.value))}
              className="w-full min-h-[44px]"
            />
          </div>

          {!readOnly && earnedBadges.length > 0 && (
            <button
              type="button"
              data-testid="insigne-apply-placement-btn"
              onClick={() =>
                handlePinBadge(
                  selectedBadgeId || earnedBadges[0].id,
                  selectedAnchorId || supportedAnchors[0]
                )
              }
              className="w-full min-h-[44px] px-4 rounded-xl bg-[var(--hub-action)] text-[var(--hub-text-inverted)] text-xs font-semibold"
            >
              Appliquer sur cette ancre
            </button>
          )}
        </div>
      </div>
    );
  };

  const tabs: DrawerTab[] = [
    {
      id: 'obtenus',
      label: 'Obtenus',
      icon: <Award className="w-4 h-4" aria-hidden="true" />,
      render: renderEarnedPane,
    },
    {
      id: 'debloquer',
      label: 'À débloquer',
      icon: <Lock className="w-4 h-4" aria-hidden="true" />,
      render: renderLockedPane,
    },
    {
      id: 'epingles',
      label: 'Épinglés',
      icon: <Pin className="w-4 h-4" aria-hidden="true" />,
      render: renderPinnedPane,
    },
    {
      id: 'emplacement',
      label: 'Emplacement et taille',
      icon: <MapPin className="w-4 h-4" aria-hidden="true" />,
      render: renderAnchorAndSizePane,
    },
  ];

  return (
    <DrawerShell
      tabs={tabs}
      activeIndex={tabIndex}
      onIndexChange={(idx) => {
        haptic('selection');
        setTabIndex(idx);
      }}
    />
  );
}
