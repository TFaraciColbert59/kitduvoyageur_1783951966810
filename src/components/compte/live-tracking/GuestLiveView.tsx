'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import Button from '@/components/ui/Button';
import LkvIcon from '@/components/ui/LkvIcon';
import Spinner from '@/components/ui/Spinner';
import type { GuestTrackingReadResult } from '@/features/live-tracking';

import {
  FRESHNESS_LABEL,
  GUEST_FAIL_COPY,
  formatAge,
  formatCoordinate,
  formatRemaining,
} from './model';
import { liveTrackingApi, type LiveTrackingApi } from './liveTrackingApi';
import { Chip, ErrorNotice, PanelCard, formatDateTime } from './shared';

export interface GuestLiveViewProps {
  token: string;
  api?: LiveTrackingApi;
  initialResult?: GuestTrackingReadResult;
  refreshIntervalMs?: number;
}

const DEFAULT_REFRESH_MS = 15_000;

export function GuestLiveView({
  token,
  api = liveTrackingApi,
  initialResult,
  refreshIntervalMs = DEFAULT_REFRESH_MS,
}: GuestLiveViewProps) {
  const titleId = useId();
  const [result, setResult] = useState<GuestTrackingReadResult | null>(initialResult ?? null);
  const [loading, setLoading] = useState(!initialResult);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await api.fetchGuestView(token);
      if (!mounted.current) return;
      setResult(next);
      setNetworkError(null);
    } catch {
      if (!mounted.current) return;
      setNetworkError('Connexion instable. La dernière position connue reste affichée.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    mounted.current = true;
    if (!initialResult) void load();
    return () => {
      mounted.current = false;
    };
  }, [initialResult, load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 10_000);
    return () => window.clearInterval(tick);
  }, []);

  const shouldPoll = result === null || result.ok;

  useEffect(() => {
    if (refreshIntervalMs <= 0 || !shouldPoll) return;
    // Un jeton révoqué, expiré ou invalide ne peut pas redevenir valide : inutile
    // de continuer à interroger l'API. Le bouton « Réessayer » reste disponible.
    const poll = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load();
    }, refreshIntervalMs);
    return () => window.clearInterval(poll);
  }, [load, refreshIntervalMs, shouldPoll]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Spinner size="lg" label="Chargement du suivi" />
        <p className="text-[13px] text-[color:var(--glass-secondary)]">Chargement du suivi…</p>
      </div>
    );
  }

  if (!result || !result.ok) {
    const reason = result && !result.ok ? result.reason : 'invalid_token';
    const copy = GUEST_FAIL_COPY[reason];
    return (
      <div className="space-y-4">
        {networkError ? <ErrorNotice message={networkError} onRetry={() => void load()} /> : null}
        <PanelCard className="text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--lkv-danger-bg)] text-[color:var(--lkv-danger-dark)]"
          >
            <LkvIcon name="lock" size={26} />
          </div>
          <h1 id={titleId} className="text-[22px] font-semibold text-[color:var(--glass-label)]">
            {copy.title}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[color:var(--glass-secondary)]">
            {copy.description}
          </p>
          <div className="mt-5 flex justify-center">
            <Button variant="secondary" size="md" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        </PanelCard>
        <p className="text-center text-[11px] leading-relaxed text-[color:var(--glass-secondary)]">
          Aucune position n’a été affichée. Un lien de suivi ne donne accès à rien d’autre qu’à la
          position partagée.
        </p>
      </div>
    );
  }

  const position = result.latestPosition;
  const freshTone = position?.freshness === 'live' ? 'live' : position ? 'warning' : 'neutral';

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {position
          ? `Position mise à jour ${formatAge(position.ageSeconds)}.`
          : 'Aucune position reçue pour le moment.'}
      </div>

      {networkError ? <ErrorNotice message={networkError} onRetry={() => void load()} /> : null}

      <PanelCard aria-labelledby={titleId}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-action)]">
              Suivi en direct
            </p>
            <h1
              id={titleId}
              className="mt-1 text-[24px] font-semibold leading-tight text-[color:var(--glass-label)]"
            >
              Position partagée
            </h1>
          </div>
          <Chip tone={result.status === 'active' ? 'live' : 'warning'}>
            {result.status === 'active' ? 'En direct' : 'En pause'}
          </Chip>
        </div>

        {position ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-[var(--lkv-surface-muted)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={freshTone}>{FRESHNESS_LABEL[position.freshness]}</Chip>
                <span className="text-[12px] text-[color:var(--glass-secondary)]">
                  {formatAge(position.ageSeconds)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--glass-secondary)]">
                    Latitude
                  </dt>
                  <dd className="mt-0.5 font-mono text-[18px] font-semibold text-[color:var(--glass-label)]">
                    {formatCoordinate(position.lat)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--glass-secondary)]">
                    Longitude
                  </dt>
                  <dd className="mt-0.5 font-mono text-[18px] font-semibold text-[color:var(--glass-label)]">
                    {formatCoordinate(position.lng)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[12px] text-[color:var(--glass-secondary)]">
                Reçue le {formatDateTime(position.recordedAtIso)}
                {position.accuracyM != null
                  ? ` · précision ±${Math.round(position.accuracyM)} m`
                  : ''}
              </p>
              {position.isStale ? (
                <p className="mt-2 rounded-xl bg-[var(--lkv-warning-bg)] px-3 py-2 text-[12px] leading-relaxed text-[color:var(--lkv-warning-dark)]">
                  La position n’est plus très récente. Le voyageur peut être hors réseau.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={`/carte-interactive?lat=${position.lat}&lng=${position.lng}&zoom=15`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--glass-rim)] px-4 text-[13px] font-semibold text-[color:var(--glass-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
              >
                <span aria-hidden>
                  <LkvIcon name="map-pin" size={16} />
                </span>
                Ouvrir sur la carte
              </a>
              <Button variant="ghost" size="md" onClick={() => void load()}>
                Actualiser
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl bg-[var(--lkv-surface-muted)] p-6 text-center">
            <Spinner size="md" label="En attente d’une position" />
            <p className="text-[14px] font-medium text-[color:var(--glass-label)]">
              En attente de la première position
            </p>
            <p className="text-[12px] leading-relaxed text-[color:var(--glass-secondary)]">
              Le voyageur a démarré le partage. La position apparaîtra dès le premier relevé GPS.
            </p>
          </div>
        )}
      </PanelCard>

      <PanelCard aria-labelledby="guest-live-details-title">
        <h2
          id="guest-live-details-title"
          className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--glass-secondary)]"
        >
          Ce lien
        </h2>
        <dl className="mt-3 space-y-2 text-[13px]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[color:var(--glass-secondary)]">Expire dans</dt>
            <dd className="font-medium text-[color:var(--glass-label)]">
              {formatRemaining(result.expiresAtIso, nowMs)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[color:var(--glass-secondary)]">Historique</dt>
            <dd className="font-medium text-[color:var(--glass-label)]">
              {result.trail.length > 0
                ? `${result.trail.length} point${result.trail.length > 1 ? 's' : ''}`
                : 'Non partagé'}
            </dd>
          </div>
        </dl>
        {result.trail.length > 1 ? (
          <ol className="mt-3 max-h-40 space-y-1 overflow-auto border-t border-[color:var(--glass-rim)] pt-3">
            {result.trail.map((point) => (
              <li
                key={`${point.recordedAtIso}-${point.lat}-${point.lng}`}
                className="flex items-center justify-between gap-3 font-mono text-[11px] text-[color:var(--glass-secondary)]"
              >
                <span>
                  {formatCoordinate(point.lat)}, {formatCoordinate(point.lng)}
                </span>
                <span>{formatDateTime(point.recordedAtIso)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <p className="mt-4 text-[11px] leading-relaxed text-[color:var(--glass-secondary)]">
          Le voyageur peut révoquer ce lien à tout moment. Ne le transfère pas : toute personne qui
          l’ouvre voit la même position.
        </p>
      </PanelCard>
    </div>
  );
}

export default GuestLiveView;
