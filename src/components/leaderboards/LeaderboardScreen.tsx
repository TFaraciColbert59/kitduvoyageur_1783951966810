'use client';

import React, { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import {
  createInitialLeaderboardDrawerState,
  reduceLeaderboardDrawerState,
  type LeaderboardFilterQuery,
  type LocalLegendResult,
  type SegmentLeaderboardResult,
} from '@/features/leaderboards';
import type {
  AntiCheatSummary,
  LeaderboardClubOption,
  LeaderboardSegmentView,
  LocalLegendResponse,
  SegmentLeaderboardResponse,
} from '@/lib/leaderboards/types';
import {
  formatDistance,
  formatElevation,
  formatEffortCount,
  sportLabel,
} from '@/lib/leaderboards/format';
import { AntiCheatNotice } from './AntiCheatNotice';
import { LeaderboardFilters } from './LeaderboardFilters';
import { LeaderboardTable } from './LeaderboardTable';
import { LocalLegendsPanel } from './LocalLegendsPanel';

export interface LeaderboardScreenProps {
  segment: LeaderboardSegmentView;
  initialLeaderboard: SegmentLeaderboardResult;
  initialLocalLegend: LocalLegendResult;
  initialAntiCheat: AntiCheatSummary;
  initialFilters?: LeaderboardFilterQuery;
  clubOptions?: LeaderboardClubOption[];
  isAuthenticated: boolean;
  onClose?: () => void;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Erreur ${response.status}`);
  }
  if (!payload) throw new Error('Réponse de classement illisible.');
  return payload as T;
}

/**
 * Écran de classement d'un segment (S4.05 / S4.06 / S4.08).
 *
 * Le sous-drawer suit le réducteur du contrat (`reduceLeaderboardDrawerState`) :
 * l'onglet, les filtres et l'offset sont la seule source de vérité, et chaque
 * changement est projeté à l'API avec un calcul serveur anti-triche.
 */
export function LeaderboardScreen({
  segment,
  initialLeaderboard,
  initialLocalLegend,
  initialAntiCheat,
  initialFilters = {},
  clubOptions = [],
  isAuthenticated,
  onClose,
}: LeaderboardScreenProps) {
  const [state, dispatch] = useReducer(reduceLeaderboardDrawerState, initialFilters, (filters) =>
    reduceLeaderboardDrawerState(createInitialLeaderboardDrawerState(20), {
      type: 'OPEN_LEADERBOARD_DRAWER',
      segmentId: segment.segmentId,
      parentDrawerContext: `segment-detail:${segment.segmentId}`,
      activeTab: 'leaderboard',
      filters,
    })
  );

  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [localLegend, setLocalLegend] = useState(initialLocalLegend);
  const [antiCheat, setAntiCheat] = useState(initialAntiCheat);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const didMount = useRef(false);

  const { period, scope, clubId, gender } = state.filters;

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const base = new URLSearchParams({
          period,
          scope,
          gender,
          limit: String(state.limit),
          offset: String(state.offset),
        });
        if (clubId) base.set('clubId', clubId);

        const legends = new URLSearchParams({ scope });
        if (clubId) legends.set('clubId', clubId);

        const [leaderboardPayload, legendPayload] = await Promise.all([
          fetchJson<SegmentLeaderboardResponse>(
            `/api/leaderboards/segments/${encodeURIComponent(segment.segmentId)}?${base.toString()}`,
            controller.signal
          ),
          fetchJson<LocalLegendResponse>(
            `/api/leaderboards/segments/${encodeURIComponent(segment.segmentId)}/local-legends?${legends.toString()}`,
            controller.signal
          ),
        ]);

        setLeaderboard(leaderboardPayload.leaderboard);
        setAntiCheat(leaderboardPayload.antiCheat);
        setLocalLegend(legendPayload.localLegend);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Classement indisponible.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [period, scope, clubId, gender, state.limit, state.offset, segment.segmentId, refreshNonce]);

  const openTab = (activeTab: 'leaderboard' | 'local_legend') => {
    if (state.activeTab === activeTab) return;
    dispatch({ type: 'SET_TAB', activeTab });
  };

  const changeFilters = (filters: LeaderboardFilterQuery) => {
    dispatch({ type: 'SET_FILTERS', filters });
  };

  const canGoPrevious = state.offset > 0;
  const canGoNext = leaderboard.page.hasMore;

  return (
    <div className="lkb-screen">
      <header className="lkb-hero">
        <div className="lkb-hero-top">
          <Link className="lkb-back" href="/classements">
            <span aria-hidden="true">←</span> Tous les classements
          </Link>
          {onClose && (
            <button type="button" className="lkb-close" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          )}
        </div>
        <p className="lkb-eyebrow">
          {sportLabel(segment.sport)}
          {segment.region ? ` · ${segment.region}` : ''}
        </p>
        <h1 className="lkb-title">{segment.name}</h1>
        <dl className="lkb-stats">
          <div>
            <dt>Distance</dt>
            <dd>{formatDistance(segment.distanceM)}</dd>
          </div>
          <div>
            <dt>Dénivelé</dt>
            <dd>{formatElevation(segment.elevationGainM)}</dd>
          </div>
          <div>
            <dt>Classés</dt>
            <dd>{leaderboard.page.totalEntries}</dd>
          </div>
        </dl>
      </header>

      <div className="lkb-tabs" role="tablist" aria-label="Classement et Local Legend">
        <button
          type="button"
          role="tab"
          id="lkb-tab-leaderboard"
          aria-controls="lkb-panel-leaderboard"
          aria-selected={state.activeTab === 'leaderboard'}
          className="lkb-tab"
          onClick={() => openTab('leaderboard')}
        >
          Classement
        </button>
        <button
          type="button"
          role="tab"
          id="lkb-tab-legend"
          aria-controls="lkb-panel-legend"
          aria-selected={state.activeTab === 'local_legend'}
          className="lkb-tab"
          onClick={() => openTab('local_legend')}
        >
          Local Legend
        </button>
      </div>

      <LeaderboardFilters
        filters={state.filters}
        capabilities={leaderboard.capabilities}
        clubOptions={clubOptions}
        isAuthenticated={isAuthenticated}
        disabled={loading}
        onChange={changeFilters}
      />

      {loading && (
        <p className="lkb-loading" role="status">
          <span className="lkb-spinner" aria-hidden="true" />
          Mise à jour du classement…
        </p>
      )}

      {error && (
        <div className="lkb-error" role="alert">
          <p>{error}</p>
          <button type="button" className="lkb-retry" onClick={() => setRefreshNonce((n) => n + 1)}>
            Réessayer
          </button>
        </div>
      )}

      {state.activeTab === 'leaderboard' ? (
        <section
          id="lkb-panel-leaderboard"
          role="tabpanel"
          aria-labelledby="lkb-tab-leaderboard"
          className="lkb-panel"
        >
          <div className="lkb-panel-head">
            <p className="lkb-panel-title">Classement</p>
            <p className="lkb-panel-meta">{formatEffortCount(leaderboard.page.totalEntries)}</p>
          </div>
          <LeaderboardTable
            entries={leaderboard.entries}
            viewerEntry={leaderboard.viewerEntry}
            sport={leaderboard.sport}
          />
          <div className="lkb-pager" aria-label="Pagination du classement">
            <button
              type="button"
              className="lkb-pager-button"
              onClick={() =>
                dispatch({ type: 'SET_PAGE_OFFSET', offset: state.offset - state.limit })
              }
              disabled={!canGoPrevious || loading}
            >
              Précédent
            </button>
            <span className="lkb-pager-status">
              {leaderboard.page.totalEntries === 0
                ? '0 passage'
                : `${leaderboard.page.offset + 1}–${Math.min(
                    leaderboard.page.offset + leaderboard.entries.length,
                    leaderboard.page.totalEntries
                  )} sur ${leaderboard.page.totalEntries}`}
            </span>
            <button
              type="button"
              className="lkb-pager-button"
              onClick={() =>
                dispatch({ type: 'SET_PAGE_OFFSET', offset: state.offset + state.limit })
              }
              disabled={!canGoNext || loading}
            >
              Suivant
            </button>
          </div>
        </section>
      ) : (
        <section
          id="lkb-panel-legend"
          role="tabpanel"
          aria-labelledby="lkb-tab-legend"
          className="lkb-panel"
        >
          <LocalLegendsPanel result={localLegend} segment={segment} />
        </section>
      )}

      <AntiCheatNotice summary={antiCheat} />
    </div>
  );
}
