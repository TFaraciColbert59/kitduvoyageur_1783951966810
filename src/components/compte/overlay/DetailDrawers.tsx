'use client';

import { LikeIcon } from '@/components/social-kit';
import React, { useEffect, useRef, useState } from 'react';
import { Award, BadgeCheck, Compass, Lock, UserCheck, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { followErrorMessage, loadFollowState, setFollow } from '@/features/compte/client/followClient';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSavedPosts } from '@/features/community/posts/queries';
import type { SavedPost } from '@/features/community/posts/types';
import { ActionPill } from '@/components/ui/ActionPill';
import { DrawerButton, OverlaySheet } from './OverlaySheet';
import { formatElevation, formatKm } from '@/lib/format/metrics';
import { GearMileagePanel } from '../drawer/gear/GearMileagePanel';
import {
  EFFORT_CSS_VARS,
  EffortExpertDrawer,
  type EffortExpertDrawerData,
  EffortFatigueDrawer,
  type EffortFatigueDrawerData,
  EffortGroupDrawer,
  type EffortGroupDrawerData,
  type EffortOutingSummary,
  type EffortPlannedOutingSummary,
  EffortPrivacyDrawer,
  type EffortPrivacyDrawerData,
  EffortStateFeedback,
  type EffortSubDrawerKind,
  type EffortUiState,
  EffortWhyDrawer,
  formatDataLevelLabel,
  formatEffortInterval,
  formatEffortValue,
  formatPreventiveRiskMessage,
  formatTechniciteLabel,
  haptic,
} from './EffortSubDrawers';

export interface BadgeRow { id: string; name?: string; description?: string; rarity?: string; earned?: boolean; earnedAt?: string; requirement?: string; requirementValue?: number; points?: number }
export interface GearRowData { id: string; realId?: string; name?: string; brand?: string; category?: string; weight_g?: number; price_cents?: number; condition?: string; photo_url?: string | null; is_lent?: boolean; loaned_to?: string | null; outings_count?: number }
export interface BootstrapOverlayData {
  stats?: { outings?: number; km?: number; dplus?: number; massifs?: number; countries?: number; nights?: number };
  badges?: BadgeRow[];
  gearItems?: GearRowData[];
  kits?: Array<{ id: string; name?: string }>;
  followers?: unknown[];
  following?: unknown[];
  tribu?: unknown[];
  species?: unknown[];
  trust?: { verified?: boolean; active?: number; onTimeRate?: number | null; rating?: number | null };
  profile?: { trustScore?: number; name?: string; handle?: string; avatarUrl?: string } | null;
  /** Lectures partielles : ne jamais afficher un zéro trompeur. */
  followersUnavailable?: boolean;
  followingUnavailable?: boolean;
  followListsUnavailable?: boolean;
  profileUnavailable?: boolean;
  statsUnavailable?: boolean;
  gearItemsUnavailable?: boolean;
  kitsUnavailable?: boolean;
  trustUnavailable?: boolean;
  carnetsUnavailable?: boolean;
  outingsUnavailable?: boolean;
  ordersUnavailable?: boolean;
  notificationsUnavailable?: boolean;
  clubsUnavailable?: boolean;
  storiesUnavailable?: boolean;
  badgesUnavailable?: boolean;
  challengesUnavailable?: boolean;
  highlightsUnavailable?: boolean;
  highlightContentUnavailable?: boolean;
  kitContentUnavailable?: boolean;
  kitVisualsUnavailable?: boolean;
  outingPhotosUnavailable?: boolean;
  /** Lot P4 — Empreinte & Effort (Niveau 0, Niveau 1, Niveau 2). */
  sealUnavailable?: boolean;
  effortState?: EffortUiState;
  effortDiagnosticId?: string | null;
  effortErrorMessage?: string | null;
  effortCachedAt?: string | null;
  lastOutingEffort?: EffortOutingSummary | null;
  nextPlannedOutingEffort?: EffortPlannedOutingSummary | null;
  effortGroupSummary?: EffortGroupDrawerData | null;
  effortFatigueSummary?: EffortFatigueDrawerData | null;
  effortPrivacySummary?: EffortPrivacyDrawerData | null;
  effortExpertSummary?: EffortExpertDrawerData | null;
}

export function SavedPostsDrawer({ onClose, onOpenPost }: { onClose: () => void; onOpenPost: (id: string) => void }) {
  const [items, setItems] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchSavedPosts().then((rows) => { if (!cancelled) setItems(rows); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return (
    <OverlaySheet title="Enregistrements" onClose={onClose}>
      {loading ? <div className="lkdv-overlay-empty"><p>Chargement…</p></div> : items.length === 0 ? (
        <div className="lkdv-overlay-empty"><b>Aucun enregistrement</b><ActionPill label="Explorer" icon={<Compass />} onClick={onClose} /></div>
      ) : (
        <div className="lkdv-saved-grid">
          {items.map((item) => (
            <button key={item.id} type="button" className="lkdv-saved-card" onClick={() => onOpenPost(item.id)}>
              <span className="lkdv-saved-media">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="lkdv-saved-placeholder">LKDV</span>}</span>
              <span className="lkdv-saved-body"><b>{item.title}</b><small>{item.author?.name || 'Voyageur'} · {item.likesCount} <LikeIcon size={10} /><span className="sr-only">j’aime</span></small></span>
            </button>
          ))}
        </div>
      )}
    </OverlaySheet>
  );
}

export function BadgeDetailSheet({ badge, onClose }: { badge: BadgeRow; onClose: () => void }) {
  const earned = Boolean(badge.earned);
  return (
    <OverlaySheet title="Trophée" onClose={onClose} nested>
      <div className="lkdv-badge-detail">
        <span className={`lkdv-badge-detail-medal ${earned ? 'is-earned' : ''}`}>{earned ? <Award size={34} /> : <Lock size={26} />}</span>
        <h3>{badge.name || 'Trophée'}</h3>
        <span className="lkdv-badge-detail-rarity">{badge.rarity || 'Trophée LKDV'}</span>
        {badge.description ? <p>{badge.description}</p> : null}
        <dl>
          <div><dt>Statut</dt><dd>{earned ? 'Obtenu' : 'Verrouillé'}</dd></div>
          {earned && badge.earnedAt ? <div><dt>Date</dt><dd>{new Date(badge.earnedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div> : null}
          {badge.requirement ? <div><dt>Condition</dt><dd>{badge.requirement}{badge.requirementValue ? ` · ${badge.requirementValue}` : ''}</dd></div> : null}
          {badge.points ? <div><dt>Récompense</dt><dd>{badge.points} points</dd></div> : null}
        </dl>
      </div>
    </OverlaySheet>
  );
}

export function GearDetailSheet({ item, onClose }: { item: GearRowData; onClose: () => void }) {
  return (
    <OverlaySheet title="Matériel" onClose={onClose} nested>
      <div className="lkdv-gear-detail">
        <div className={`lkdv-gear-detail-hero${item.photo_url ? ' has-photo' : ''}`}>
          {item.photo_url ? <img src={item.photo_url} alt="" /> : <span>{item.name?.charAt(0).toUpperCase() || 'L'}</span>}
          <span className="lkdv-gear-detail-glass">
            <h3>{item.name || 'Objet'}</h3>
            <p>{[item.brand, item.category].filter(Boolean).join(' · ') || 'Matériel'}</p>
          </span>
        </div>
        <dl>
          <div><dt>Poids</dt><dd>{item.weight_g ? `${item.weight_g} g` : '—'}</dd></div>
          <div><dt>État</dt><dd>{item.condition || '—'}</dd></div>
          <div><dt>Sorties</dt><dd>{item.outings_count ?? 0}</dd></div>
          <div><dt>Prêt</dt><dd>{item.is_lent ? `À ${item.loaned_to || 'un membre'}` : 'Disponible'}</dd></div>
        </dl>
        <GearMileagePanel
          gearItemId={item.realId || item.id}
          gearName={item.name}
          gearCategory={item.category}
        />
      </div>
    </OverlaySheet>
  );
}

export function TrustDetailSheet({ data, trustScore, onClose }: { data: BootstrapOverlayData; trustScore?: number; onClose: () => void }) {
  const trust = data.trust;
  // Un profil ou des prêts illisibles ne valent pas zéro : on affiche « — »
  // et on n'invente ni un score ni un nombre de prêts actifs.
  const trustUnavailable =
    data.trustUnavailable === true ||
    data.profileUnavailable === true ||
    data.profile == null ||
    typeof trustScore !== 'number';
  const score = trustUnavailable ? null : trustScore;
  return (
    <OverlaySheet title="Indice de confiance" subtitle="Agrégat de tes prêts, sans classement." onClose={onClose} nested>
      <div className="lkdv-trust-detail">
        <div className="lkdv-trust-detail-score"><b>{score == null ? '—' : score}<small>/100</small></b><span>{trustUnavailable ? 'Vérification indisponible' : trust?.verified ? 'Profil vérifié' : 'Profil non vérifié'}</span></div>
        <div className="lkdv-trust-detail-gauge"><i style={{ width: `${score == null ? 0 : Math.max(0, Math.min(100, score))}%` }} /></div>
        <div className="lkdv-trust-detail-grid">
          <div><b>{trustUnavailable ? '—' : trust?.active ?? 0}</b><span>Prêts actifs</span></div>
          <div><b>{trustUnavailable || trust?.onTimeRate == null ? '—' : `${trust.onTimeRate} %`}</b><span>Retours à temps</span></div>
          <div><b>{trustUnavailable || trust?.rating == null ? '—' : trust.rating.toFixed(1)}</b><span>Note moyenne</span></div>
        </div>
        {trustUnavailable ? <p className="lkdv-trust-detail-empty">Indice momentanément indisponible.</p> : trust?.onTimeRate == null ? <p className="lkdv-trust-detail-empty">Aucun retour noté pour le moment.</p> : null}
      </div>
    </OverlaySheet>
  );
}

function radar(values: number[]): string {
  const scaled = values.map((value) => Math.log1p(Math.max(0, value)));
  const max = Math.max(1, ...scaled);
  return values.map((value, i) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / values.length;
    const d = 8 + 70 * (scaled[i] / max);
    return `${(80 + Math.cos(angle) * d).toFixed(1)},${(80 + Math.sin(angle) * d).toFixed(1)}`;
  }).join(' ');
}

export interface SealDrawerProps {
  data: BootstrapOverlayData;
  onClose: () => void;
  onOpenSubDrawer?: (kind: EffortSubDrawerKind) => void;
  onRetryEffort?: () => void;
  effortStateOverride?: EffortUiState;
}

export function SealDrawer({
  data,
  onClose,
  onOpenSubDrawer,
  onRetryEffort,
  effortStateOverride,
}: SealDrawerProps) {
  const [internalSubDrawer, setInternalSubDrawer] = useState<EffortSubDrawerKind | null>(null);

  const stats = data.stats ?? {};
  // Une liste illisible n'est pas une liste vide : afficher « — » plutôt que
  // « 0 », qui laisserait croire à une tribu réellement vide.
  const sealUnavailable = data.sealUnavailable === true;
  const followersUnavailable =
    sealUnavailable ||
    data.followersUnavailable === true ||
    (data.followersUnavailable === undefined && data.followListsUnavailable === true);
  const followersCount = data.followers?.length ?? 0;
  const tribeValue = followersUnavailable ? 0 : followersCount;
  const tribeDisplay = followersUnavailable ? '—' : String(followersCount);
  // Même règle pour les autres lectures : un échec n'est pas un zéro.
  const statsUnavailable = sealUnavailable || data.statsUnavailable === true;
  const gearUnavailable = sealUnavailable || data.gearItemsUnavailable === true;
  const kitsUnavailable = sealUnavailable || data.kitsUnavailable === true;
  const gearCount = data.gearItems?.length ?? 0;
  const kitsCount = data.kits?.length ?? 0;
  const speciesCount = data.species?.length ?? 0;
  const values = [
    statsUnavailable ? 0 : stats.outings ?? 0,
    statsUnavailable ? 0 : stats.km ?? 0,
    statsUnavailable ? 0 : stats.dplus ?? 0,
    gearUnavailable ? 0 : gearCount,
    kitsUnavailable ? 0 : kitsCount,
    sealUnavailable ? 0 : speciesCount,
    tribeValue,
  ];
  const labels = ['Sorties', 'Kilomètres', 'Dénivelé', 'Matériel', 'Kits', 'Espèces', 'Tribu'];
  const displays = [
    statsUnavailable ? '—' : String(stats.outings ?? 0),
    statsUnavailable ? '—' : formatKm(stats.km ?? 0),
    statsUnavailable ? '—' : formatElevation(stats.dplus ?? 0),
    gearUnavailable ? '—' : String(gearCount),
    kitsUnavailable ? '—' : String(kitsCount),
    sealUnavailable ? '—' : String(speciesCount),
    tribeDisplay,
  ];
  const someUnavailable = sealUnavailable || statsUnavailable || gearUnavailable || kitsUnavailable;

  const uiState: EffortUiState = effortStateOverride ?? data.effortState ?? 'ready';
  const lastOuting = sealUnavailable ? null : data.lastOutingEffort ?? null;
  const nextOuting = sealUnavailable ? null : data.nextPlannedOutingEffort ?? null;

  const triggerSubDrawer = (kind: EffortSubDrawerKind) => {
    haptic();
    if (onOpenSubDrawer) {
      onOpenSubDrawer(kind);
      return;
    }
    const globalApi =
      typeof window !== 'undefined' ? (window as any).__lkdvCompteOverlay : undefined;
    if (globalApi && typeof globalApi.openEffortSubDrawer === 'function') {
      globalApi.openEffortSubDrawer(kind);
      return;
    }
    setInternalSubDrawer(kind);
  };

  if (internalSubDrawer === 'effort-why') {
    return (
      <EffortWhyDrawer
        outing={lastOuting ?? nextOuting}
        state={uiState}
        diagnosticId={data.effortDiagnosticId}
        errorMessage={data.effortErrorMessage}
        cachedAt={data.effortCachedAt}
        onRetry={onRetryEffort}
        onClose={() => setInternalSubDrawer(null)}
      />
    );
  }
  if (internalSubDrawer === 'effort-group') {
    return (
      <EffortGroupDrawer
        groupData={sealUnavailable ? null : data.effortGroupSummary}
        state={uiState}
        diagnosticId={data.effortDiagnosticId}
        errorMessage={data.effortErrorMessage}
        cachedAt={data.effortCachedAt}
        onRetry={onRetryEffort}
        onClose={() => setInternalSubDrawer(null)}
      />
    );
  }
  if (internalSubDrawer === 'effort-fatigue') {
    return (
      <EffortFatigueDrawer
        fatigueData={sealUnavailable ? null : data.effortFatigueSummary}
        state={uiState}
        diagnosticId={data.effortDiagnosticId}
        errorMessage={data.effortErrorMessage}
        cachedAt={data.effortCachedAt}
        onRetry={onRetryEffort}
        onClose={() => setInternalSubDrawer(null)}
      />
    );
  }
  if (internalSubDrawer === 'effort-privacy') {
    return (
      <EffortPrivacyDrawer
        privacyData={
          sealUnavailable
            ? null
            : data.effortPrivacySummary ?? {
                dataLevel: lastOuting?.dataLevel ?? null,
                evidence: lastOuting?.evidence ?? [],
                consents: [],
              }
        }
        state={uiState}
        diagnosticId={data.effortDiagnosticId}
        errorMessage={data.effortErrorMessage}
        cachedAt={data.effortCachedAt}
        onRetry={onRetryEffort}
        onClose={() => setInternalSubDrawer(null)}
      />
    );
  }
  if (internalSubDrawer === 'effort-expert') {
    return (
      <EffortExpertDrawer
        expertData={
          sealUnavailable
            ? null
            : data.effortExpertSummary ??
              (lastOuting
                ? {
                    scoreVersion: lastOuting.scoreVersion || 'effort-score-v1',
                    snapshotHash: lastOuting.snapshotHash ?? null,
                    iea: lastOuting.iea ?? null,
                    erp: lastOuting.erp ?? null,
                    eFlatKm: lastOuting.eFlatKm ?? null,
                    rawDose: lastOuting.rawDose ?? null,
                    multipliers: lastOuting.multipliers ?? null,
                    ablations: [],
                    rawSegments: [],
                  }
                : null)
        }
        state={uiState}
        diagnosticId={data.effortDiagnosticId}
        errorMessage={data.effortErrorMessage}
        cachedAt={data.effortCachedAt}
        onRetry={onRetryEffort}
        onClose={() => setInternalSubDrawer(null)}
      />
    );
  }

  return (
    <OverlaySheet
      title="Empreinte & Effort"
      subtitle="100 % dérivé de tes sorties GPS vérifiées"
      onClose={onClose}
      className="lkdv-seal-drawer"
    >
      <div className="lkdv-seal" style={{ ...EFFORT_CSS_VARS, color: '#172B24' }}>
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#172B24' }}>
            Empreinte
          </h3>
          <span
            data-testid="seal-data-level-header"
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              background: '#F2F7EE',
              border: '1px solid var(--tint, #17402C)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#172B24',
            }}
          >
            {formatDataLevelLabel(lastOuting?.dataLevel ?? nextOuting?.dataLevel ?? null)}
          </span>
        </div>

        <div className="lkdv-seal-radar">
          <svg
            viewBox="0 0 160 160"
            role="img"
            aria-label="Radar 7 axes de l’Empreinte terrain"
          >
            {[40, 62, 78].map((r) => (
              <circle key={r} cx="80" cy="80" r={r} fill="none" stroke="rgba(23,64,44,.16)" />
            ))}
            {values.map((_, i) => {
              const a = -Math.PI / 2 + (Math.PI * 2 * i) / values.length;
              return (
                <line
                  key={i}
                  x1="80"
                  y1="80"
                  x2={80 + Math.cos(a) * 78}
                  y2={80 + Math.sin(a) * 78}
                  stroke="rgba(23,64,44,.14)"
                />
              );
            })}
            <polygon
              points={radar(values)}
              fill="rgba(23,64,44,.16)"
              stroke="#17402c"
              strokeWidth="2"
            />
            <circle cx="80" cy="80" r="4" fill="#17402c" />
          </svg>
        </div>

        <div className="lkdv-seal-grid">
          {labels.map((label, i) => (
            <div key={label}>
              <span style={{ color: '#172B24' }}>{label}</span>
              <b style={{ color: '#172B24' }}>{displays[i]}</b>
            </div>
          ))}
        </div>

        {followersUnavailable ? (
          <p className="lkdv-trust-detail-empty" style={{ color: '#172B24' }}>
            Liste de la tribu momentanément indisponible.
          </p>
        ) : null}
        {someUnavailable ? (
          <p className="lkdv-trust-detail-empty" style={{ color: '#172B24' }}>
            Certaines données de l’Empreinte sont momentanément indisponibles.
          </p>
        ) : null}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          <EffortStateFeedback
            state={uiState}
            diagnosticId={data.effortDiagnosticId}
            errorMessage={data.effortErrorMessage}
            cachedAt={data.effortCachedAt}
            onRetry={onRetryEffort}
          />

          {uiState !== 'loading' && uiState !== 'error' ? (
            <>
              {/* CARTE 1 : DERNIÈRE SORTIE */}
              <section
                aria-labelledby="lkdv-effort-last-outing-title"
                data-testid="effort-last-outing-card"
                className="lkdv-overlay-card"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: '#FFFFFF',
                  color: '#172B24',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <h3
                      id="lkdv-effort-last-outing-title"
                      style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}
                    >
                      Dernière sortie
                    </h3>
                    <small style={{ fontSize: '11px', color: '#172B24' }}>
                      {lastOuting?.title
                        ? `${lastOuting.title}${lastOuting.dateLabel ? ` · ${lastOuting.dateLabel}` : ''}`
                        : 'Aucune sortie évaluée'}
                    </small>
                  </div>
                  <span
                    data-testid="effort-last-data-level"
                    style={{
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: '#F6F9F4',
                      border: '1px solid rgba(23, 43, 36, 0.2)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#172B24',
                    }}
                  >
                    {formatDataLevelLabel(lastOuting?.dataLevel)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '7px',
                    marginBottom: '9px',
                  }}
                >
                  <div style={{ padding: '7px 9px', borderRadius: '10px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#172B24' }}>
                      Score IEA (absolu)
                    </span>
                    <b data-testid="effort-last-iea" style={{ fontSize: '14px', color: '#172B24' }}>
                      {lastOuting && lastOuting.iea != null
                        ? formatEffortValue(lastOuting.iea, { suffix: '%' })
                        : '— (non évalué)'}
                    </b>
                  </div>

                  <div style={{ padding: '7px 9px', borderRadius: '10px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#172B24' }}>
                      Fourchette [P10–P90]
                    </span>
                    <b data-testid="effort-last-interval" style={{ fontSize: '13px', color: '#172B24' }}>
                      {formatEffortInterval(lastOuting?.interval, '%')}
                    </b>
                  </div>

                  <div style={{ padding: '7px 9px', borderRadius: '10px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#172B24' }}>
                      Score ERP (personnel)
                    </span>
                    <b data-testid="effort-last-erp" style={{ fontSize: '14px', color: '#172B24' }}>
                      {lastOuting && lastOuting.erp != null
                        ? formatEffortValue(lastOuting.erp, { suffix: '%' })
                        : '— (non évalué)'}
                    </b>
                  </div>

                  <div style={{ padding: '7px 9px', borderRadius: '10px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', color: '#172B24' }}>
                      Équivalent plat (eFlatKm)
                    </span>
                    <b data-testid="effort-last-eflat" style={{ fontSize: '13.5px', color: '#172B24' }}>
                      {lastOuting && lastOuting.eFlatKm != null
                        ? formatEffortValue(lastOuting.eFlatKm, { decimals: 1, suffix: 'km-effort' })
                        : '—'}
                    </b>
                  </div>
                </div>

                <div
                  data-testid="effort-last-action-phrase"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: '#F2F7EE',
                    border: '1px solid var(--good, #3D7A52)',
                    fontSize: '11.5px',
                    marginBottom: '8px',
                    color: '#172B24',
                  }}
                >
                  <b>Action conseillée : </b>
                  <span>{lastOuting?.actionPhrase || 'non évalué'}</span>
                </div>

                {/* Bandeaux Technicité (1–5) et Risque strictement séparés du score */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    role="region"
                    aria-label="Technicité du parcours (séparée du score d’effort)"
                    data-testid="effort-last-technicite"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '10px',
                      background: '#F6F9F4',
                      border: '1px solid var(--tint, #17402C)',
                      fontSize: '11.5px',
                      color: '#172B24',
                    }}
                  >
                    <b>Technicité (1–5) : </b>
                    <span>{formatTechniciteLabel(lastOuting?.technicite)}</span>
                  </div>

                  <div
                    role="region"
                    aria-label="Vigilance terrain (séparée du score d’effort)"
                    data-testid="effort-last-risque"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '10px',
                      background: '#FDF6E7',
                      border: '1.5px solid var(--warn, #B98A2E)',
                      fontSize: '11.5px',
                      color: '#172B24',
                    }}
                  >
                    <b>Vigilance &amp; conditions : </b>
                    <span>{formatPreventiveRiskMessage(lastOuting?.risque)}</span>
                  </div>
                </div>
              </section>

              {/* CARTE 2 : PROCHAINE SORTIE PRÉVUE + ACCÈS NIVEAU 1 & NIVEAU 2 */}
              <section
                aria-labelledby="lkdv-effort-next-outing-title"
                data-testid="effort-next-outing-card"
                className="lkdv-overlay-card"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: '#FFFFFF',
                  color: '#172B24',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <h3
                      id="lkdv-effort-next-outing-title"
                      style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#172B24' }}
                    >
                      Prochaine sortie prévue
                    </h3>
                    <small style={{ fontSize: '11px', color: '#172B24' }}>
                      {nextOuting?.title
                        ? `${nextOuting.title}${nextOuting.departureLabel ? ` · ${nextOuting.departureLabel}` : ''}`
                        : 'Aucune sortie planifiée'}
                    </small>
                  </div>
                  <span
                    data-testid="effort-next-data-level"
                    style={{
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: '#F6F9F4',
                      border: '1px solid rgba(23, 43, 36, 0.2)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#172B24',
                    }}
                  >
                    {formatDataLevelLabel(nextOuting?.dataLevel)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ padding: '6px 8px', borderRadius: '9px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#172B24' }}>IEA prévu</span>
                    <b data-testid="effort-next-iea" style={{ fontSize: '13px', color: '#172B24' }}>
                      {nextOuting && nextOuting.iea != null
                        ? formatEffortValue(nextOuting.iea, { suffix: '%' })
                        : '—'}
                    </b>
                  </div>
                  <div style={{ padding: '6px 8px', borderRadius: '9px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#172B24' }}>[P10–P90]</span>
                    <b data-testid="effort-next-interval" style={{ fontSize: '12px', color: '#172B24' }}>
                      {formatEffortInterval(nextOuting?.interval, '%')}
                    </b>
                  </div>
                  <div style={{ padding: '6px 8px', borderRadius: '9px', background: '#F6F9F4' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#172B24' }}>Équiv. plat</span>
                    <b data-testid="effort-next-eflat" style={{ fontSize: '12px', color: '#172B24' }}>
                      {nextOuting && nextOuting.eFlatKm != null
                        ? formatEffortValue(nextOuting.eFlatKm, { decimals: 1, suffix: 'km' })
                        : '—'}
                    </b>
                  </div>
                </div>

                <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#172B24' }}>
                  <b>Préparation : </b>
                  <span>{nextOuting?.actionPhrase || 'non évalué'}</span>
                </p>

                <nav
                  aria-label="Approfondir l’analyse d’effort (Niveaux 1 et 2)"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}
                >
                  <DrawerButton
                    tone="secondary"
                    data-testid="open-subdrawer-effort-why"
                    onClick={() => triggerSubDrawer('effort-why')}
                  >
                    Pourquoi ce score ?
                  </DrawerButton>
                  <DrawerButton
                    tone="secondary"
                    data-testid="open-subdrawer-effort-group"
                    onClick={() => triggerSubDrawer('effort-group')}
                  >
                    Sortie de groupe
                  </DrawerButton>
                  <DrawerButton
                    tone="secondary"
                    data-testid="open-subdrawer-effort-fatigue"
                    onClick={() => triggerSubDrawer('effort-fatigue')}
                  >
                    Forme &amp; fatigue
                  </DrawerButton>
                  <DrawerButton
                    tone="secondary"
                    data-testid="open-subdrawer-effort-privacy"
                    onClick={() => triggerSubDrawer('effort-privacy')}
                  >
                    Données, confiance &amp; vie privée
                  </DrawerButton>
                  <DrawerButton
                    tone="primary"
                    data-testid="open-subdrawer-effort-expert"
                    onClick={() => triggerSubDrawer('effort-expert')}
                  >
                    Mode expert
                  </DrawerButton>
                </nav>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </OverlaySheet>
  );
}

export function ProfilePreviewDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user } = useAuth();
  const viewerId = user?.id;
  const [profile, setProfile] = useState<{ id: string; full_name?: string; handle?: string; avatar_url?: string; bio?: string; location?: string; trust_score?: number } | null>(null);
  const [following, setFollowing] = useState(false);
  const [requested, setRequested] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');
  const [loading, setLoading] = useState(true);
  const readEpochRef = useRef(0);
  const followBusyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const epoch = ++readEpochRef.current;
    const supabase = createClient();
    followBusyRef.current = false;
    setFollowing(false);
    setRequested(false);
    setFollowBusy(false);
    setFollowError('');
    setLoading(true);
    void (async () => {
      const { data } = await supabase.from('public_profiles').select('id,full_name,handle,avatar_url,bio,location,trust_score').eq('id', userId).maybeSingle();
      if (cancelled) return;
      setProfile(data ?? null);
      if (data && viewerId && viewerId !== data.id) {
        try {
          const state = await loadFollowState(supabase, viewerId, data.id);
          if (cancelled || epoch !== readEpochRef.current) return;
          setFollowing(state === 'following');
          setRequested(state === 'requested');
        } catch {
          // La lecture en échec laisse le bouton neutre, sans écraser une
          // mutation qui aurait démarré pendant la requête.
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, viewerId]);
  const toggle = async () => {
    if (followBusyRef.current || !user || !profile || user.id === profile.id) return;
    followBusyRef.current = true;
    const epoch = ++readEpochRef.current;
    const wasFollowing = following;
    const wasRequested = requested;
    const action = following || requested ? 'unfollow' : 'follow';
    setFollowBusy(true);
    setFollowError('');
    setFollowing(action === 'follow');
    setRequested(false);
    try {
      const status = await setFollow(profile.id, action);
      if (epoch !== readEpochRef.current) return;
      setFollowing(status === 'following');
      setRequested(status === 'requested');
    } catch (error) {
      if (epoch !== readEpochRef.current) return;
      setFollowing(wasFollowing);
      setRequested(wasRequested);
      setFollowError(
        followErrorMessage(error, 'L’abonnement n’a pas été enregistré. Réessayez.')
      );
    } finally {
      // Une réponse périmée ne doit pas réarmer le verrou d'une requête plus
      // récente : seule la requête courante rend la main au bouton.
      if (epoch === readEpochRef.current) {
        followBusyRef.current = false;
        setFollowBusy(false);
      }
    }
  };
  return (
    <OverlaySheet title="Profil" subtitle={profile?.handle ? `@${profile.handle}` : undefined} onClose={onClose} nested>
      {loading ? <div className="lkdv-overlay-empty"><p>Chargement…</p></div> : !profile ? <div className="lkdv-overlay-empty"><b>Profil privé</b></div> : (
        <div className="lkdv-profile-preview">
          <div className="lkdv-profile-preview-head">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profile.full_name?.charAt(0) || 'L'}</span>}
            <div><h3>{profile.full_name || profile.handle || 'Voyageur'}</h3><p>@{profile.handle || 'voyageur'}{profile.location ? ` · ${profile.location}` : ''}</p><small><BadgeCheck size={13} /> Confiance {profile.trust_score ?? 0}/100</small></div>
          </div>
          {profile.bio ? <p className="lkdv-profile-preview-bio">{profile.bio}</p> : null}
          {user?.id !== profile.id ? (
            <div className="lkdv-apill-row is-start lkdv-profile-preview-actions">
              <ActionPill
                tone={following || requested ? 'glass' : 'primary'}
                label={requested ? 'Demande envoyée' : following ? 'Abonné' : 'Suivre'}
                text={requested ? 'Demande envoyée' : following ? 'Abonné' : 'Suivre'}
                aria-pressed={following || requested}
                icon={following || requested ? <UserCheck /> : <UserPlus />}
                busy={followBusy}
                onClick={() => void toggle()}
              />
            </div>
          ) : null}
          {followError ? (
            <p className="lkdv-profile-preview-bio" role="alert" style={{ color: 'var(--lkv-danger)' }}>
              {followError}
            </p>
          ) : null}
        </div>
      )}
    </OverlaySheet>
  );
}

export default SavedPostsDrawer;
