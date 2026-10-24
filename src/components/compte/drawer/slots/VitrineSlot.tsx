'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StatTile } from '../cards/StatTile';
import { formatElevation } from '@/lib/format/metrics';
import { SlotEmpty } from './SlotEmpty';
import { BadgeTile, type BadgeItem } from '../cards/BadgeTile';
import { RepostCard, type RepostItem } from '../cards/RepostCard';

export type VitrineLens = 'stats' | 'repost' | 'badges';

export interface VitrineStats {
  km?: number;
  dplus?: number;
  outings?: number;
  nights?: number;
  massifs?: number;
  countries?: number;
  /** 12 valeurs, une par mois (janvier → décembre). */
  yearMonths?: number[];
  bestMonth?: string;
  longestOuting?: number;
}

export interface VitrineStamp {
  id: string;
  name: string;
  /** Nombre de sorties réelles rattachées à ce massif. */
  outings: number;
  /** Trace GPS vérifiée pour au moins une sortie du massif. */
  verified: boolean;
}

export interface VitrineSlotProps {
  /** Lentille active fournie par `ProfileDrawerHost` : stats, repost ou badges. */
  lens?: VitrineLens | string;
  /**
   * Payload du bootstrap (contrat hôte) : `payload.stats`, `payload.stamps`,
   * `payload.reposts`, `payload.badges`, `payload.visibility`. Les props
   * directes restent acceptées pour les tests et pour un montage isolé.
   */
  payload?: unknown;
  stats?: VitrineStats | null;
  reposts?: RepostItem[] | null;
  badges?: BadgeItem[] | null;
  /**
   * Rôle explicite du lecteur. **Câblage hôte requis** : `ProfileDrawerHost`
   * doit transmettre sa prop `viewer` au slot (tâche 18). Sans elle, le CTA
   * propriétaire ne peut être déduit que de `payload.viewer` ou d'un payload
   * authentifié non privé ; un visiteur authentifié verrait donc le CTA.
   */
  viewer?: 'owner' | 'visitor';
}

/**
 * Événement de confirmation émis par l'hôte après relecture de
 * `user_profiles.signature_visibility`. La Vitrine ne modifie l'état pressé
 * qu'à réception de cet événement, jamais sur la seule action optimiste.
 */
export const SIGNATURE_VISIBILITY_EVENT = 'lkdv:signature-visibility';

export interface SignatureVisibilityEventDetail {
  /** Valeur SQL confirmée (`private | communaute | public`). */
  value: 'private' | 'communaute' | 'public';
  persisted: boolean;
  /** Valeur SQL rétablie côté runtime après un échec. */
  revertedTo?: 'private' | 'communaute' | 'public';
  /** Corrélation avec la demande : un événement d'une autre requête est ignoré. */
  requestId?: number;
}

const MONTHS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const INTEGER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asFiniteNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `undefined` reste `undefined` : un champ absent ne devient jamais 0. */
function asOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(asFiniteNumber(value));
}

function formatInteger(value: number): string {
  return INTEGER_FORMAT.format(Math.round(asFiniteNumber(value)));
}

function formatKm(value: number): string {
  return `${formatNumber(value)} km`;
}

function formatMeters(value: number): string {
  return formatElevation(value);
}

/** Affiche un tiret cadratin quand la donnée n'existe pas, jamais un faux 0. */
function formatOptional(value: number | undefined, format: (value: number) => string): string {
  return value === undefined ? '—' : format(value);
}

/**
 * Normalise uniquement les champs attendus. Aucune valeur de repli n'est
 * inventée : un champ numérique absent reste `undefined` (affiché `—`) au lieu
 * de devenir un faux 0.
 */
function readStats(value: unknown): VitrineStats | null {
  const record = asRecord(value);
  const keys = Object.keys(record);
  if (keys.length === 0) return null;
  const yearMonths = Array.isArray(record.yearMonths)
    ? record.yearMonths.slice(0, 12).map(asFiniteNumber)
    : [];
  return {
    km: asOptionalNumber(record.km),
    dplus: asOptionalNumber(record.dplus),
    outings: asOptionalNumber(record.outings),
    nights: asOptionalNumber(record.nights),
    massifs: asOptionalNumber(record.massifs),
    countries: asOptionalNumber(record.countries),
    yearMonths,
    bestMonth: typeof record.bestMonth === 'string' ? record.bestMonth : '',
    longestOuting: asOptionalNumber(record.longestOuting),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readReposts(value: unknown): RepostItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      id: readString(row.id),
      sourceId: readString(row.sourceId) || undefined,
      sourceTitle: readString(row.sourceTitle),
      // Une source cachée n'a pas d'auteur : ne jamais le remplacer par le
      // relayeur ni par une chaîne vide fabriquée.
      sourceAuthor:
        row.sourceAuthor === null
          ? null
          : typeof row.sourceAuthor === 'string'
            ? row.sourceAuthor
            : undefined,
      sourceCreatedAt: readString(row.sourceCreatedAt) || undefined,
      sourceImageUrl: readString(row.sourceImageUrl) || null,
      sourceUnavailable: row.sourceUnavailable === true,
      createdAt: readString(row.createdAt),
      audience: readString(row.audience),
    }))
    .filter((row) => Boolean(row.id || row.sourceTitle));
}

/**
 * Massifs réellement rattachés aux sorties (`mapStamps` du bootstrap). Les
 * lignes sans nom sont ignorées, et un `kind` inconnu n'est pas présenté comme
 * un massif.
 */
function readStamps(value: unknown): VitrineStamp[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      id: readString(row.id),
      name: readString(row.name).trim(),
      kind: readString(row.kind),
      outings: asFiniteNumber(row.outings),
      verified: row.verified === true,
    }))
    .filter((row) => Boolean(row.name) && (!row.kind || row.kind === 'massif'))
    .map(({ name, outings, verified, id }) => ({
      id: id || name,
      name,
      outings,
      verified,
    }));
}

function readBadges(value: unknown): BadgeItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => ({
      id: readString(row.id),
      name: readString(row.name),
      rarity: readString(row.rarity),
      earned: row.earned === true,
      earnedAt: readString(row.earnedAt),
      requirementValue: asFiniteNumber(row.requirementValue),
      points: asFiniteNumber(row.points),
    }))
    .filter((row) => Boolean(row.name));
}

/** Trie les trophées obtenus du plus récent au plus ancien, sans invention. */
function sortRecentBadges(badges: BadgeItem[]): BadgeItem[] {
  return [...badges].sort((first, second) => {
    const firstDate = Date.parse(first.earnedAt || '');
    const secondDate = Date.parse(second.earnedAt || '');
    const firstValid = Number.isFinite(firstDate);
    const secondValid = Number.isFinite(secondDate);
    if (firstValid && secondValid && firstDate !== secondDate) return secondDate - firstDate;
    if (firstValid !== secondValid) return firstValid ? -1 : 1;
    return 0;
  });
}


const ROUTE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 19h18M6 19l5-11 4 7 3-4 3 8" />
    <path d="M9 12h2" />
  </svg>
);

const NIGHT_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

const MOUNTAIN_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m3 19 6-12 4 7 2-3 6 8H3Z" />
    <path d="m7 12 2 1 1-2" />
  </svg>
);

const GLOBE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5Z" />
  </svg>
);

function EmptyVitrine({
  lens,
  label,
  action,
}: {
  lens: VitrineLens;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="lkdv-vitrine"
      data-state="empty"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens={lens}
    >
      <style>{VITRINE_CSS}</style>
      <div className="lkdv-slot-state" data-state="empty">
        <span className="lkdv-slot-state-ico" aria-hidden="true">
          ○
        </span>
        <p>{label}</p>
        {action}
      </div>
    </div>
  );
}

function EmpreinteVisibility({
  visibility,
  pending,
  onSelect,
}: {
  visibility: SignatureVisibility;
  pending: boolean;
  onSelect: (target: 'public' | 'prive') => void;
}) {
  return (
    <div
      className="lkdv-vitrine-vis"
      role="group"
      aria-label="Visibilité de l’empreinte"
      aria-busy={pending ? 'true' : undefined}
    >
      <button
        type="button"
        aria-pressed={visibility === 'public'}
        aria-busy={pending ? 'true' : undefined}
        disabled={pending}
        onClick={() => onSelect('public')}
      >
        Public
      </button>
      <button
        type="button"
        aria-pressed={visibility === 'prive'}
        aria-busy={pending ? 'true' : undefined}
        disabled={pending}
        onClick={() => onSelect('prive')}
      >
        Privé
      </button>
    </div>
  );
}

/**
 * La visibilité du profil (`profile_visibility`) et celle de l'empreinte
 * (`signature_visibility`, `S.vis` du runtime) sont deux réglages distincts.
 * Le segmented ne peut afficher que public/privé : l'état intermédiaire
 * « Communauté » n'est donc revendiqué par aucun des deux boutons.
 */
type SignatureVisibility = 'public' | 'prive' | 'communaute';

interface AppliedVisibility {
  /** Visibilité du payload au moment de l'application. */
  base: 'public' | 'prive';
  value: SignatureVisibility;
}

/**
 * Chaque mutation du runtime reconstruit `#lkdv-slot-root`, ce qui remonte le
 * slot React. Ce cache faible, indexé par le payload stable de l'hôte, garde la
 * visibilité réellement appliquée tant que ce payload vit : le segmented ne
 * revient pas à l'ancienne valeur du profil après un `setvis`.
 */
const appliedVisibilityByPayload = new WeakMap<object, AppliedVisibility>();

interface CompteRuntimeWindow extends Window {
  __lkdvCompteAct?: (action: string, value?: unknown, meta?: unknown) => void;
  __lkdvGetState?: () => { S?: { vis?: unknown } };
  /** Pont de persistance installé par l'hôte (réel ou secours). */
  __lkdvOnMutate?: (key: string, value: unknown, state?: unknown, meta?: unknown) => unknown;
}

function toSignatureState(value: unknown): SignatureVisibility | null {
  if (value === 'private' || value === 0) return 'prive';
  if (value === 'communaute' || value === 1) return 'communaute';
  if (value === 'public' || value === 2) return 'public';
  return null;
}

/** Lit l'état réel du runtime, sans jamais le deviner s'il est indisponible. */
function readRuntimeVisibility(): SignatureVisibility | undefined {
  if (typeof window === 'undefined') return undefined;
  const runtime = window as CompteRuntimeWindow;
  if (typeof runtime.__lkdvGetState !== 'function') return undefined;
  try {
    const index = runtime.__lkdvGetState()?.S?.vis;
    if (index === 0) return 'prive';
    if (index === 1) return 'communaute';
    if (index === 2) return 'public';
  } catch {
    // Runtime en cours de démontage : on ne prétend rien.
  }
  return undefined;
}

/**
 * Le runtime courant expose la fonction pure `resolveSetVis` (`'public'` → 2,
 * `'prive'` → 0). Import dynamique et typage local : le `.d.ts` du runtime ne
 * déclare encore que son initialiseur. `null` = pas de cible exacte possible.
 */
async function resolveExactVisibility(target: 'public' | 'prive'): Promise<number | null> {
  try {
    const runtime = (await import('../../compte-liquid-glass-v8-runtime')) as unknown as {
      resolveSetVis?: (value: unknown) => number | null;
    };
    const resolve = runtime.resolveSetVis;
    return typeof resolve === 'function' ? resolve(target) : null;
  } catch {
    return null;
  }
}

/**
 * Priorité d'affichage : visibilité réellement appliquée pour ce payload,
 * puis état du runtime (`S.vis`), puis visibilité du profil en dernier recours.
 * Le segmented pilote `signature_visibility`, pas `profile_visibility` : le
 * payload ne doit jamais contredire un état runtime lisible.
 */
function resolveDisplayedVisibility(
  visibility: 'public' | 'prive',
  payloadKey?: object | null
): SignatureVisibility {
  const applied = payloadKey ? appliedVisibilityByPayload.get(payloadKey) : undefined;
  if (applied) {
    if (applied.base === visibility) return applied.value;
    if (payloadKey) appliedVisibilityByPayload.delete(payloadKey);
  }
  return readRuntimeVisibility() ?? visibility;
}

interface PendingSignatureVisibility {
  target: 'public' | 'prive';
  requestId: number;
  /** État confirmé avant la demande, affiché tant que la persistance est en vol. */
  base: SignatureVisibility;
}

function EmpreinteBlock({
  stamps,
  visibility,
  payloadKey,
}: {
  stamps: VitrineStamp[];
  visibility: 'public' | 'prive';
  payloadKey?: object | null;
}) {
  // Au montage, le runtime fait foi ; le payload n'est qu'un dernier recours.
  // Une visibilité déjà appliquée (cache faible) garde la priorité absolue.
  const [currentVisibility, setCurrentVisibility] = useState<SignatureVisibility>(() =>
    resolveDisplayedVisibility(visibility, payloadKey)
  );
  const [pending, setPending] = useState<PendingSignatureVisibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingSignatureVisibility | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    setCurrentVisibility(resolveDisplayedVisibility(visibility, payloadKey));
  }, [visibility, payloadKey]);

  const commitVisibility = (next: SignatureVisibility) => {
    setCurrentVisibility(next);
    if (payloadKey) {
      appliedVisibilityByPayload.set(payloadKey, { base: visibility, value: next });
    }
  };

  const settlePending = (next: PendingSignatureVisibility | null) => {
    pendingRef.current = next;
    setPending(next);
  };

  // Confirmation (ou infirmation) de l'écriture réelle par l'hôte.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPersistence = (event: Event) => {
      const detail = (event as CustomEvent<SignatureVisibilityEventDetail>).detail;
      if (!detail) return;
      const confirmed = toSignatureState(detail.value);
      if (!confirmed) return;

      const current = pendingRef.current;
      if (current) {
        // Événement d'une autre requête : il ne résout pas celle en vol.
        if (detail.requestId != null && detail.requestId !== current.requestId) return;
        // Sans identifiant (runtime antérieur), la valeur doit être la cible.
        const expected = current.target === 'public' ? 'public' : 'private';
        if (detail.value !== expected) return;
      }

      if (detail.persisted) {
        settlePending(null);
        setError(null);
        commitVisibility(confirmed);
        return;
      }

      // Échec confirmé : la cible n'est jamais affichée comme appliquée.
      settlePending(null);
      if (payloadKey) appliedVisibilityByPayload.delete(payloadKey);
      const reverted =
        (detail.revertedTo ? toSignatureState(detail.revertedTo) : null) ??
        readRuntimeVisibility() ??
        current?.base ??
        visibility;
      setCurrentVisibility(reverted);
      setError(
        'La visibilité de l’empreinte n’a pas pu être enregistrée. L’état précédent a été rétabli.'
      );
    };
    window.addEventListener(SIGNATURE_VISIBILITY_EVENT, onPersistence);
    return () => window.removeEventListener(SIGNATURE_VISIBILITY_EVENT, onPersistence);
  }, [payloadKey, visibility]);

  const selectVisibility = async (target: 'public' | 'prive') => {
    if (typeof window === 'undefined') return;
    if (pendingRef.current) return;
    const runtime = window as CompteRuntimeWindow;
    const act = runtime.__lkdvCompteAct;
    if (typeof act !== 'function') return;

    // `setvis` applique la cible exacte ; `cyclevis` reste le repli des
    // runtimes antérieurs. Dans les deux cas seul l'état réellement relu est
    // affiché : sans état runtime lisible, aucune cible n'est revendiquée.
    const exactTarget = await resolveExactVisibility(target);
    if (typeof exactTarget === 'number') {
      // Sans pont de persistance, aucune écriture ne peut être confirmée :
      // on refuse l'action plutôt que d'afficher un état non enregistré.
      if (typeof runtime.__lkdvOnMutate !== 'function') {
        setError(
          'La visibilité de l’empreinte n’a pas pu être enregistrée : le pont de persistance est indisponible.'
        );
        return;
      }
      const requestId = ++requestSeqRef.current;
      settlePending({ target, requestId, base: currentVisibility });
      setError(null);
      try {
        act('setvis', target, { preserveSlot: true, signatureRequestId: requestId });
      } catch {
        settlePending(null);
        setError('La visibilité de l’empreinte n’a pas pu être enregistrée.');
      }
      return;
    }

    try {
      act('cyclevis');
    } catch {
      return;
    }
    const realVisibility = readRuntimeVisibility();
    if (realVisibility) commitVisibility(realVisibility);
  };

  return (
    <section
      className="lkdv-vitrine-card lkdv-vitrine-empreinte"
      aria-labelledby="lkdv-vitrine-empreinte-title"
    >
      <header className="lkdv-vitrine-empreinte-head">
        <h3 id="lkdv-vitrine-empreinte-title">Empreinte</h3>
        <EmpreinteVisibility
          visibility={currentVisibility}
          pending={pending !== null}
          onSelect={selectVisibility}
        />
      </header>

      {error ? (
        <p className="lkdv-vitrine-vis-error" role="alert">
          {error}
        </p>
      ) : null}

      {stamps.length > 0 ? (
        <ul className="lkdv-empreinte-list" role="list" aria-label="Massifs de l’empreinte">
          {stamps.map((stamp) => (
            <li key={stamp.id} className="lkdv-empreinte-row">
              <span className="lkdv-empreinte-name">{stamp.name}</span>
              <span className="lkdv-empreinte-outings">
                {formatInteger(stamp.outings)} sortie{stamp.outings > 1 ? 's' : ''}
              </span>
              {stamp.verified ? (
                <span className="lkdv-empreinte-verified">
                  <span aria-hidden="true">✓ </span>
                  Vérifié
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="lkdv-vitrine-note">Aucun massif rattaché à vos sorties</p>
      )}
    </section>
  );
}

function StatsLens({
  stats,
  stamps,
  owner,
  visibility,
  payloadKey,
}: {
  stats: VitrineStats;
  stamps: VitrineStamp[];
  owner: boolean;
  visibility: 'public' | 'prive';
  payloadKey?: object | null;
}) {
  const yearMonths = MONTHS_LONG.map((_, index) => asFiniteNumber(stats.yearMonths?.[index]));
  const maxMonth = Math.max(0, ...yearMonths);
  const hasYearData = maxMonth > 0;

  return (
    <div
      className="lkdv-vitrine"
      data-state="ready"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens="stats"
    >
      <style>{VITRINE_CSS}</style>

      <section className="lkdv-vitrine-card lkdv-vitrine-hero" aria-label="Statistiques clés">
        <div className="lkdv-vitrine-metric">
          <b>{formatOptional(stats.km, formatKm)}</b>
          <span>Distance</span>
        </div>
        <div className="lkdv-vitrine-metric">
          <b>{formatOptional(stats.dplus, formatMeters)}</b>
          <span>Dénivelé positif</span>
        </div>
        <div className="lkdv-vitrine-metric">
          <b>{formatOptional(stats.outings, formatInteger)}</b>
          <span>Sorties</span>
        </div>
      </section>

      {(() => {
        // Un repère à zéro n'apprend rien : on ne garde que les tuiles réellement renseignées.
        const tiles = [
          { label: 'Nuits', value: stats.nights, icon: NIGHT_ICON },
          { label: 'Massifs', value: stats.massifs, icon: MOUNTAIN_ICON },
          { label: 'Pays', value: stats.countries, icon: GLOBE_ICON },
        ].filter((tile) => (tile.value ?? 0) > 0);
        if (tiles.length === 0) return null;
        return (
          <div
            className="lkdv-vitrine-tiles"
            role="list"
            aria-label="Repères de la vitrine"
            style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
          >
            {tiles.map((tile) => (
              <StatTile
                key={tile.label}
                label={tile.label}
                value={formatOptional(tile.value, formatInteger)}
                icon={tile.icon}
              />
            ))}
          </div>
        );
      })()}

      {/* L'empreinte et son contrôle de visibilité sont réservés au
          propriétaire : un visiteur ne voit que les agrégats publics. */}
      {owner ? (
        <EmpreinteBlock stamps={stamps} visibility={visibility} payloadKey={payloadKey} />
      ) : null}

      <section className="lkdv-vitrine-card lkdv-vitrine-year" aria-labelledby="lkdv-vitrine-year-title">
        <header className="lkdv-vitrine-year-head">
          <h3 id="lkdv-vitrine-year-title">Cette année</h3>
          <span aria-hidden="true">{ROUTE_ICON}</span>
        </header>

        <div className="lkdv-vitrine-bars" role="group" aria-label="Distance parcourue par mois">
          {yearMonths.map((value, index) => {
            const height = hasYearData
              ? Math.max(4, Math.round((value / maxMonth) * 100))
              : 4;
            const label = `${MONTHS_LONG[index]} : ${formatNumber(value)} km`;
            return (
              <div className="lkdv-vitrine-month" key={MONTHS_LONG[index]}>
                <div
                  className="lkdv-vitrine-bar"
                  data-testid="vitrine-month-bar"
                  role="img"
                  aria-label={label}
                  title={label}
                >
                  <i style={{ height: `${height}%` }} />
                </div>
                <small aria-hidden="true">{MONTHS_SHORT[index]}</small>
              </div>
            );
          })}
        </div>

        {hasYearData ? null : (
          <p className="lkdv-vitrine-note">Aucune sortie enregistrée cette année.</p>
        )}

        <div className="lkdv-vitrine-year-foot">
          {hasYearData ? (
            <div>
              <span>Meilleur mois</span>
              <b>{stats.bestMonth?.trim() || '—'}</b>
            </div>
          ) : null}
          <div>
            <span>Plus longue sortie</span>
            <b>{formatOptional(stats.longestOuting, formatKm)}</b>
          </div>
        </div>
      </section>
    </div>
  );
}

function RepostCta() {
  return (
    <a className="mbtn p lkdv-vitrine-cta" href="/communaute">
      Republier une publication
    </a>
  );
}

function RepostLens({ reposts, owner }: { reposts: RepostItem[]; owner: boolean }) {
  const count = reposts.length;
  return (
    <div
      className="lkdv-vitrine"
      data-state="ready"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens="repost"
    >
      <style>{VITRINE_CSS}</style>

      <ul className="lkdv-reposts" role="list" aria-label="Republications">
        {reposts.map((repost, index) => (
          <RepostCard
            key={repost.id || `${repost.sourceId ?? 'source'}-${index}`}
            repost={repost}
          />
        ))}
      </ul>

      <footer className="lkdv-repost-foot">
        <span className="lkdv-repost-count">
          {count} republication{count > 1 ? 's' : ''}
        </span>
        {owner ? <RepostCta /> : null}
      </footer>
    </div>
  );
}

/** Progression de la collection : aucun pourcentage individuel n'est inventé. */
function badgeProgress(earnedCount: number, total: number) {
  const safeTotal = Math.max(total, 1);
  return {
    width: Math.round((earnedCount / safeTotal) * 100),
    now: earnedCount,
    max: total,
    label: `Collection : ${earnedCount} / ${total} trophées débloqués`,
  };
}

/** Nom accessible porté par l'élément de liste, pas par la tuile décorative. */
function badgeAccessibleLabel(badge: BadgeItem): string {
  const stateLabel = badge.earned ? 'obtenu' : 'à débloquer';
  return [badge.name, badge.rarity?.trim(), stateLabel].filter(Boolean).join(', ');
}

function BadgesLens({ badges }: { badges: BadgeItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const earned = badges.filter((badge) => badge.earned);
  const recent = sortRecentBadges(earned).slice(0, 4);
  const next = badges.find((badge) => !badge.earned) ?? null;
  const earnedCount = earned.length;
  const total = badges.length;
  const progress = next ? badgeProgress(earnedCount, total) : null;
  const nextMeta = next
    ? [next.rarity?.trim(), next.points ? `+${formatInteger(next.points)} pts` : '']
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div
      className="lkdv-vitrine"
      data-state="ready"
      data-testid="slot-content"
      data-slot="vitrine"
      data-lens="badges"
    >
      <style>{VITRINE_CSS}</style>

      <section
        className="lkdv-vitrine-card lkdv-badge-shelf-card"
        aria-labelledby="lkdv-badge-shelf-title"
      >
        <header className="lkdv-vitrine-section-head">
          <h3 id="lkdv-badge-shelf-title">Trophées récents</h3>
          <span>
            {earnedCount} / {total}
          </span>
        </header>
        {recent.length > 0 ? (
          <ul className="lkdv-badge-shelf" role="list" aria-label="Trophées récents">
            {recent.map((badge) => (
              <li key={badge.id} aria-label={badgeAccessibleLabel(badge)}>
                <button type="button" className="lkdv-badge-open" onClick={() => (window as any).__lkdvOpenBadge?.(badge.id)}>
                  <BadgeTile badge={badge} variant="shelf" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lkdv-vitrine-note">Aucun trophée débloqué pour le moment.</p>
        )}
      </section>

      <section
        className="lkdv-vitrine-card lkdv-next-badge"
        aria-labelledby="lkdv-next-badge-title"
      >
        <header className="lkdv-vitrine-section-head">
          <h3 id="lkdv-next-badge-title">Prochain badge</h3>
          <span>
            {earnedCount} / {total} trophées
          </span>
        </header>

        {next && progress ? (
          <>
            <div className="lkdv-next-badge-main">
              <BadgeTile badge={next} variant="next" showName={false} />
              <div className="lkdv-next-badge-txt">
                <b>{next.name}</b>
                {nextMeta ? <small>{nextMeta}</small> : null}
                {next.requirementValue ? (
                  <small>Objectif : {formatInteger(next.requirementValue)}</small>
                ) : null}
              </div>
            </div>
            <small className="lkdv-badge-progress-label">Collection</small>
            <div
              className="lkdv-badge-progress"
              role="progressbar"
              aria-label={progress.label}
              aria-valuemin={0}
              aria-valuemax={progress.max}
              aria-valuenow={progress.now}
            >
              <i style={{ width: `${progress.width}%` }} />
            </div>
          </>
        ) : (
          <p className="lkdv-vitrine-note">Tous les trophées sont débloqués.</p>
        )}
      </section>

      <section
        className="lkdv-vitrine-card lkdv-badge-all"
        id="lkdv-badge-all-panel"
        aria-labelledby="lkdv-badge-all-title"
      >
        <header className="lkdv-vitrine-section-head">
          <h3 id="lkdv-badge-all-title">Tous les trophées</h3>
          <button
            type="button"
            className="mbtn soft lkdv-badge-toggle"
            aria-expanded={showAll}
            aria-controls="lkdv-badge-all-panel"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? 'Réduire' : 'Tout voir'}
          </button>
        </header>

        {showAll ? (
          <ul className="lkdv-badge-grid" role="list" aria-label="Tous les trophées">
            {badges.map((badge) => (
              <li key={badge.id} aria-label={badgeAccessibleLabel(badge)}>
                <button type="button" className="lkdv-badge-open" onClick={() => (window as any).__lkdvOpenBadge?.(badge.id)}>
                  <BadgeTile badge={badge} variant="grid" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

/**
 * Slot Vitrine du drawer Profil.
 *
 * La lentille `stats` affiche les agrégats réels du bootstrap, `repost` les
 * republications et `badges` les trophées. Aucune donnée n'est fabriquée : les
 * tableaux vides gardent un état vide explicite.
 */
export function VitrineSlot({
  lens,
  payload,
  stats: statsProp,
  reposts: repostsProp,
  badges: badgesProp,
  viewer,
}: VitrineSlotProps) {
  const normalizedLens: VitrineLens =
    lens === 'repost' || lens === 'badges' ? lens : 'stats';
  const data = asRecord(payload);
  const stats = readStats(statsProp ?? data.stats);
  const stamps = readStamps(data.stamps);
  // Identité stable du payload hôte, utilisée pour survivre à un remontage.
  const payloadKey = isRecord(payload) ? payload : null;
  const declaredViewer =
    viewer ??
    (data.viewer === 'owner' || data.viewer === 'visitor' ? data.viewer : undefined);
  const profileVisibility = asRecord(data.visibility).profile === 'prive' ? 'prive' : 'public';
  // Inférence stricte : le CTA propriétaire n'apparaît que si le rôle est
  // explicite (prop `viewer` ou `payload.viewer`), ou si le payload est un
  // bootstrap authentifié non privé. Sans marqueur, on n'est PAS propriétaire.
  // `ProfileDrawerHost` doit transmettre `viewer` (tâche 18) : en attendant,
  // un visiteur authentifié sur un profil public est traité comme propriétaire.
  const owner = declaredViewer
    ? declaredViewer === 'owner'
    : data.authenticated === true && profileVisibility !== 'prive';

  const allReposts = readReposts(repostsProp ?? data.reposts);
  const allBadges = readBadges(badgesProp ?? data.badges);
  const hasActivity =
    Boolean(stats && ((stats.outings ?? 0) > 0 || (stats.km ?? 0) > 0 || (stats.dplus ?? 0) > 0)) ||
    stamps.length > 0 ||
    allReposts.length > 0 ||
    allBadges.some((badge) => badge.earned);

  if (normalizedLens === 'stats' && !hasActivity) {
    return (
      <div
        className="lkdv-slot-state"
        data-state="empty"
        data-testid="slot-content"
        data-slot="vitrine"
        data-lens={normalizedLens}
      >
        <SlotEmpty
          title="Aucune sortie publiée"
          hint="Enregistre ta première sortie pour voir tes kilomètres, ton dénivelé et ton empreinte."
          action={
            <Link className="lkdv-slot-empty-cta" href="/compas">
              Enregistrer une sortie
            </Link>
          }
        />
      </div>
    );
  }

  if (normalizedLens === 'repost') {
    const reposts = readReposts(repostsProp ?? data.reposts);
    if (reposts.length === 0) {
      return (
        <EmptyVitrine
          lens="repost"
          label="Aucune republication pour le moment."
          action={owner ? <RepostCta /> : undefined}
        />
      );
    }
    return <RepostLens reposts={reposts} owner={owner} />;
  }

  if (normalizedLens === 'badges') {
    const badges = readBadges(badgesProp ?? data.badges);
    if (badges.length === 0) {
      return <EmptyVitrine lens="badges" label="Aucun badge pour le moment." />;
    }
    return <BadgesLens badges={badges} />;
  }

  if (!stats) {
    return <EmptyVitrine lens="stats" label="Aucune statistique à afficher pour le moment." />;
  }

  return (
    <StatsLens
      stats={stats}
      stamps={stamps}
      owner={owner}
      visibility={profileVisibility}
      payloadKey={payloadKey}
    />
  );
}

/**
 * Styles scopés du slot. Ils ne créent aucune palette : uniquement les tokens
 * verre du runtime et les classes existantes (`.li`, `.mbtn`, `--glass-*`).
 */
export const VITRINE_CSS = `
.lkdv-vitrine{display:flex;flex-direction:column;gap:8px;padding:0 0 2px;color:var(--label);}
.lkdv-vitrine-card{border-radius:20px;background:var(--glass-bg-medium,rgba(255,255,255,.46));border:.5px solid var(--glass-border,rgba(23,43,36,.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 6px 18px rgba(23,43,36,.06);padding:11px 12px;box-sizing:border-box;}
.lkdv-vitrine-hero{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:12px 6px;}
.lkdv-vitrine-metric{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;padding:0 4px;text-align:center;}
.lkdv-vitrine-metric+.lkdv-vitrine-metric::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:.5px;background:var(--sep,rgba(23,43,36,.1));}
.lkdv-vitrine-metric b{display:block;font-family:var(--sf);font-weight:700;font-size:clamp(20px,7.2vw,28px);line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--label);white-space:nowrap;}
.lkdv-vitrine-metric span{display:block;font-family:var(--sf);font-weight:600;font-size:9.5px;line-height:1.15;letter-spacing:.02em;text-transform:uppercase;color:var(--label2);text-align:center;}
.lkdv-vitrine-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
.lkdv-vitrine .lkdv-stat-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:0;min-height:60px;padding:7px 5px;border-top:0;border-radius:16px;background:var(--glass-bg-medium,rgba(255,255,255,.46));box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px var(--glass-border,rgba(23,43,36,.1));text-align:center;box-sizing:border-box;}
.lkdv-stat-tile-ico{display:grid;place-items:center;width:16px;height:16px;color:var(--accent);opacity:.9;}
.lkdv-stat-tile-ico svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-stat-tile-value{display:block;font-family:var(--sf);font-weight:700;font-size:19px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--label);}
.lkdv-stat-tile-label{display:block;font-family:var(--sf);font-weight:600;font-size:9px;line-height:1.15;letter-spacing:.03em;text-transform:uppercase;color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.lkdv-vitrine-year{display:flex;flex-direction:column;gap:8px;}
.lkdv-vitrine-year-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.lkdv-vitrine-year-head h3{margin:0;font-family:var(--sf);font-weight:700;font-size:14px;line-height:1.2;letter-spacing:-.01em;color:var(--label);}
.lkdv-vitrine-year-head>span{display:grid;place-items:center;width:18px;height:18px;color:var(--accent);opacity:.8;}
.lkdv-vitrine-year-head svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-vitrine-bars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;align-items:end;}
.lkdv-vitrine-month{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:0;}
.lkdv-vitrine-bar{height:62px;display:flex;align-items:flex-end;border-radius:5px;background:rgba(23,43,36,.05);overflow:hidden;}
.lkdv-vitrine-bar i{display:block;width:100%;border-radius:4px 4px 2px 2px;background:linear-gradient(180deg,var(--accent,#5B7F55),var(--tint,#17402C));}
.lkdv-vitrine-month small{display:block;font-family:var(--sf);font-weight:600;font-size:7.5px;line-height:1;color:var(--label3);text-align:center;}
.lkdv-vitrine-note{margin:0;font-family:var(--sf);font-size:11px;line-height:1.3;color:var(--label2);}
.lkdv-vitrine-year-foot{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:2px;border-top:.5px solid var(--sep,rgba(23,43,36,.1));}
.lkdv-vitrine-year-foot div{min-width:0;display:flex;flex-direction:column;gap:1px;}
.lkdv-vitrine-year-foot span{font-family:var(--sf);font-weight:500;font-size:9.5px;line-height:1.15;color:var(--label2);}
.lkdv-vitrine-year-foot b{font-family:var(--sf);font-weight:700;font-size:13px;line-height:1.2;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-vitrine-empreinte{display:flex;flex-direction:column;gap:7px;}
.lkdv-vitrine-empreinte-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.lkdv-vitrine-empreinte-head h3{margin:0;font-family:var(--sf);font-weight:700;font-size:14px;line-height:1.2;letter-spacing:-.01em;color:var(--label);}
.lkdv-vitrine-vis{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:rgba(23,43,36,.06);}
.lkdv-vitrine-vis button{height:44px;min-height:44px;padding:0 10px;border:0;border-radius:999px;background:none;color:var(--label2);font-family:var(--sf);font-weight:600;font-size:10.5px;line-height:1;cursor:pointer;}
.lkdv-vitrine-vis button[aria-pressed="true"]{background:rgba(255,255,255,.9);color:var(--tint,#17402C);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);}
.lkdv-vitrine-vis button:disabled{opacity:.55;cursor:wait;}
.lkdv-vitrine-vis-error{margin:4px 0 0;font-size:11px;line-height:1.35;color:var(--bad,#B3261E);}
.lkdv-empreinte-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;}
.lkdv-empreinte-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:6px 7px;border-radius:12px;background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.05);}
.lkdv-empreinte-name{min-width:0;font-family:var(--sf);font-weight:600;font-size:12.5px;line-height:1.2;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-empreinte-outings{font-family:var(--sf);font-weight:500;font-size:10px;line-height:1.2;color:var(--label2);white-space:nowrap;}
.lkdv-empreinte-verified{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;font-family:var(--sf);font-weight:600;font-size:9px;line-height:1;color:var(--good,#3D7A52);background:rgba(61,122,82,.1);white-space:nowrap;}
.lkdv-reposts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
.lkdv-vitrine .lkdv-repost{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:76px;padding:7px 8px;border-top:0;border-radius:18px;background:var(--glass-bg-medium,rgba(255,255,255,.46));box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px var(--glass-border,rgba(23,43,36,.1));box-sizing:border-box;}
.lkdv-repost-thumb{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:linear-gradient(160deg,rgba(91,127,85,.22),rgba(23,64,44,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(23,43,36,.08);color:var(--accent);}
.lkdv-repost-thumb svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-repost-main{display:flex;flex-direction:column;gap:2px;min-width:0;}
.lkdv-repost-title{display:block;font-family:var(--sf);font-weight:600;font-size:13px;line-height:1.25;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-repost-meta{display:flex;flex-wrap:wrap;align-items:center;gap:3px 7px;min-width:0;}
.lkdv-repost-author{position:relative;max-width:100%;font-family:var(--sf);font-weight:500;font-size:10.5px;line-height:1.2;color:var(--tint,#17402C);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-repost-author::before{content:"d’après ";color:var(--label2);font-weight:400;}
.lkdv-repost-date{font-family:var(--sf);font-weight:400;font-size:10px;line-height:1.2;color:var(--label2);white-space:nowrap;}
.lkdv-vitrine .lkdv-repost-audience{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;font-family:var(--sf);font-size:9px;font-weight:600;line-height:1;color:var(--tint,#17402C);background:rgba(236,244,233,.7);box-shadow:inset 0 0 0 .5px var(--soft-line,rgba(91,127,85,.38));cursor:default;}
.lkdv-vitrine .lkdv-repost-original{display:inline-flex;align-items:center;justify-content:center;height:44px;min-height:44px;padding:0 10px;border-radius:999px;font-size:10.5px;line-height:1;text-align:center;text-decoration:none;white-space:normal;}
.lkdv-repost-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 2px 0;}
.lkdv-repost-count{font-family:var(--sf);font-weight:500;font-size:10.5px;line-height:1.2;color:var(--label2);}
.lkdv-vitrine .lkdv-vitrine-cta{display:inline-flex;align-items:center;justify-content:center;height:44px;min-height:44px;padding:0 14px;border-radius:999px;font-size:12px;line-height:1;text-decoration:none;white-space:nowrap;}
.lkdv-vitrine-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.lkdv-vitrine-section-head h3{margin:0;font-family:var(--sf);font-weight:700;font-size:14px;line-height:1.2;letter-spacing:-.01em;color:var(--label);}
.lkdv-vitrine-section-head>span{font-family:var(--sf);font-weight:500;font-size:10px;line-height:1.2;color:var(--label2);white-space:nowrap;}
.lkdv-badge-shelf{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;list-style:none;margin:6px 0 0;padding:0;}
.lkdv-badge-shelf>li{min-width:0;}
.lkdv-badge{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;padding:7px 4px 6px;border-radius:16px;background:var(--glass-bg-medium,rgba(255,255,255,.46));box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px var(--glass-border,rgba(23,43,36,.1));box-sizing:border-box;text-align:center;overflow:hidden;}
.lkdv-badge::before{content:"";position:absolute;inset:2px;border-radius:14px;box-shadow:inset 0 0 0 1.5px var(--rarity-color,var(--glass-border,rgba(23,43,36,.1)));opacity:.6;pointer-events:none;}
.lkdv-badge[data-rarity="commun"],.lkdv-badge[data-rarity="common"]{--rarity-color:var(--label3);}
.lkdv-badge[data-rarity="rare"]{--rarity-color:var(--accent);}
.lkdv-badge[data-rarity="epique"],.lkdv-badge[data-rarity="epic"]{--rarity-color:var(--warn,#B98A2E);}
.lkdv-badge[data-rarity="legendaire"],.lkdv-badge[data-rarity="legendary"]{--rarity-color:var(--good,#3D7A52);}
.lkdv-badge[data-earned="false"]{opacity:.62;filter:saturate(.4);}
.lkdv-badge[data-earned="false"]::before{opacity:.3;}
.lkdv-badge[data-variant="shelf"]{min-height:72px;}
.lkdv-badge[data-variant="grid"]{min-height:96px;padding:9px 5px;}
.lkdv-badge[data-variant="next"]{width:56px;min-height:56px;padding:5px 3px;flex:none;}
.lkdv-badge-medal{display:grid;place-items:center;width:24px;height:24px;color:var(--rarity-color,var(--accent));}
.lkdv-badge-medal svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-badge-name{display:block;max-width:100%;font-family:var(--sf);font-weight:600;font-size:10px;line-height:1.15;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-badge-rarity{display:block;max-width:100%;font-family:var(--sf);font-weight:600;font-size:8.5px;line-height:1.1;letter-spacing:.02em;color:var(--rarity-color,var(--label2));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-badge-date{font-family:var(--sf);font-weight:400;font-size:8px;line-height:1.1;color:var(--label3);white-space:nowrap;}
.lkdv-badge-lock{font-family:var(--sf);font-weight:600;font-size:8px;line-height:1.1;color:var(--label3);white-space:nowrap;}
.lkdv-next-badge-main{display:grid;grid-template-columns:56px minmax(0,1fr);gap:9px;align-items:center;margin-top:6px;}
.lkdv-next-badge-txt{display:flex;flex-direction:column;gap:1px;min-width:0;}
.lkdv-next-badge-txt b{font-family:var(--sf);font-weight:600;font-size:13px;line-height:1.2;color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-next-badge-txt small{font-family:var(--sf);font-weight:400;font-size:10px;line-height:1.25;color:var(--label2);}
.lkdv-badge-progress-label{display:block;margin-top:7px;font-family:var(--sf);font-weight:600;font-size:8.5px;line-height:1;letter-spacing:.05em;text-transform:uppercase;color:var(--label2);}
.lkdv-badge-progress{height:6px;margin-top:3px;border-radius:99px;background:var(--fill,rgba(23,43,36,.09));overflow:hidden;}
.lkdv-badge-progress i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent,#5B7F55),var(--tint,#17402C));transition:width .35s cubic-bezier(.16,1,.3,1);}
.lkdv-badge-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;list-style:none;margin:6px 0 0;padding:0;}
.lkdv-badge-grid>li{min-width:0;}
.lkdv-vitrine .lkdv-badge-toggle{display:inline-flex;align-items:center;justify-content:center;height:44px;min-height:44px;padding:0 12px;border-radius:999px;font-size:11px;line-height:1;white-space:nowrap;}
@media (prefers-reduced-motion:reduce){.lkdv-vitrine,.lkdv-vitrine *{transition:none!important;animation:none!important;}}
`;

export default VitrineSlot;
