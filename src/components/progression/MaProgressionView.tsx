'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Award, ChevronDown, Gift, RefreshCw, Target, Trophy } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, LoadingState, Tabs } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { createClient } from '@/lib/supabase/client';
import { useTranslation, type LocaleContextValue } from '@/lib/i18n/context';
import PassportSection from './PassportSection';
import type { UserDiscovery } from '@/features/progression/server/discoveries';
import { plural, type TranslationKey } from '@/lib/i18n/translate';
import { formatDate, formatNumber } from '@/lib/i18n/format';
import {
  UserProgressionProfile,
  TerritorialLeaderboard,
  TerritoryFilter,
  SkillType,
} from '@/features/progression/domain/types';

interface MaProgressionViewProps {
  initialProfile?: UserProgressionProfile;
  compact?: boolean;
  presentation?: 'page' | 'drawer';
}

type TFn = LocaleContextValue['t'];

const SKILL_LABEL_KEYS: Record<SkillType, TranslationKey> = {
  explorer: 'progression.skill.explorer',
  preparer: 'progression.skill.preparer',
  partager: 'progression.skill.partager',
  entraider: 'progression.skill.entraider',
};

const TERRITORY_FILTERS: { id: TerritoryFilter; labelKey: TranslationKey; icon: string }[] = [
  { id: 'around_me', labelKey: 'progression.territoryAroundMe', icon: 'map-pin' },
  { id: 'city', labelKey: 'progression.territoryCity', icon: 'navigation' },
  { id: 'region', labelKey: 'progression.territoryRegion', icon: 'map' },
  { id: 'country', labelKey: 'progression.territoryCountry', icon: 'flag' },
  { id: 'world', labelKey: 'progression.territoryWorld', icon: 'globe' },
];

/** Raisons honnêtes d'indisponibilité renvoyées par la RPC de classement. */
const LEADERBOARD_REASONS: Record<string, TranslationKey> = {
  flag_off: 'progression.reasonFlagOff',
  no_private_attachment: 'progression.reasonNoPrivateAttachment',
  rpc_unavailable: 'progression.reasonRpcUnavailable',
};

const GAIN_TYPE_LABELS: Record<string, TranslationKey> = {
  like: 'progression.gainType.like',
  comment: 'progression.gainType.comment',
  post: 'progression.gainType.post',
  carnet: 'progression.gainType.carnet',
  message: 'progression.gainType.message',
  referral: 'progression.gainType.referral',
  admin: 'progression.gainType.admin',
  PROGRESSION_AWARD: 'progression.gainType.progressionAward',
  hike_session: 'progression.gainType.hikeSession',
  trail_prep: 'progression.gainType.trailPrep',
  kit_report: 'progression.gainType.kitReport',
  place_review: 'progression.gainType.placeReview',
};

interface EarnedDistinction {
  id: string;
  name: string;
  icon: string | null;
  earnedAt: string | null;
}

interface GainRow {
  id: string;
  points: number;
  type: string;
  createdAt: string;
  skills: Array<{ skill: string; points: number; weight: number }>;
  rulesVersion: string | null;
}

/** T11 — intention non résolue : affichée « en analyse », jamais célébrée. */
interface PendingGainRow {
  id: string;
  label: string;
  effectiveAt: string;
  state: 'pending' | 'processing' | 'failed';
}

type ClientDataStatus = 'loading' | 'ready' | 'unavailable';

interface DistinctionsState {
  status: ClientDataStatus;
  items: EarnedDistinction[];
}

interface GainsState {
  status: ClientDataStatus;
  items: GainRow[];
  pending: PendingGainRow[];
  nextCursor: { before: string; beforeId: string } | null;
  loadingMore: boolean;
}

const EMPTY_GAINS: GainsState = {
  status: 'unavailable',
  items: [],
  pending: [],
  nextCursor: null,
  loadingMore: false,
};

/** T14 — l'affichage ne présente jamais de montant : avancement + distinction. */
interface MissionRow {
  id: string;
  modelId: string;
  title: string;
  progress: number;
  targetCount: number;
  completedAt: string | null;
}

interface MissionModelOption {
  id: string;
  title: string;
  targetCount: number;
}

interface MissionsState {
  status: ClientDataStatus;
  active: MissionRow[];
  models: MissionModelOption[];
  mutating: boolean;
}

interface HistoryApiItem {
  id: string;
  action: string;
  label: string;
  points: number;
  effectiveAt: string;
  rulesVersion: string | null;
  skills?: Array<{ skill: string; points: number; weight: number }>;
}

interface HistoryApiPayload {
  success?: boolean;
  items?: HistoryApiItem[];
  pending?: PendingGainRow[];
  nextCursor?: { before: string; beforeId: string } | null;
}

function mapHistoryItems(items: HistoryApiItem[] | undefined): GainRow[] {
  return (items ?? []).map((item) => ({
    id: item.id,
    points: Math.max(0, Math.floor(Number(item.points) || 0)),
    type: item.action,
    createdAt: item.effectiveAt,
    skills: Array.isArray(item.skills) ? item.skills : [],
    rulesVersion: item.rulesVersion ?? null,
  }));
}

function reasonLabel(reason: string | null | undefined, t: TFn): string {
  if (!reason) return t('progression.reasonUnavailable');
  const key = LEADERBOARD_REASONS[reason];
  return key ? t(key) : t('progression.reasonUnavailable');
}

function gainLabel(type: string, t: TFn): string {
  if (!type) return t('progression.gainFallback');
  const key = GAIN_TYPE_LABELS[type];
  return key ? t(key) : type.replace(/_/g, ' ');
}

/** Section détaillée repliée par défaut (divulgation progressive accessible). */
function ProgressionSection({
  title,
  summary,
  children,
  forceOpen = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  forceOpen?: boolean;
}) {
  const body = <div className="border-t border-black/5 p-4 pt-3 sm:p-5 sm:pt-3">{children}</div>;

  if (forceOpen) {
    return (
      <section className="glass overflow-hidden rounded-3xl border border-white/70 shadow-sm">
        <div className="flex min-h-[44px] items-center gap-3 p-4 sm:p-5">
          <span className="min-w-0">
            <span className="block font-display text-base font-bold text-[var(--lkv-text-primary)]">
              {title}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--lkv-text-secondary)]">{summary}</span>
          </span>
        </div>
        {body}
      </section>
    );
  }

  return (
    <details className="glass group rounded-3xl border border-white/70 shadow-sm">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-3xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-base font-bold text-[var(--lkv-text-primary)]">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--lkv-text-secondary)]">
            {summary}
          </span>
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 text-[var(--lkv-text-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-black/5 p-4 pt-3 sm:p-5 sm:pt-3">{children}</div>
    </details>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/80 bg-white/60 px-3 py-2">
      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
        {label}
      </span>
      <span className="font-mono text-lg font-extrabold tabular-nums text-[color:var(--lkv-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function SummaryChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-2xl border border-white/80 bg-white/60 px-3 py-2">
      <span className="shrink-0 text-[var(--lkv-secondary-ink)]" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
          {label}
        </span>
        <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
          {value}
        </span>
      </span>
    </div>
  );
}

export default function MaProgressionView({
  initialProfile,
  compact = false,
  presentation = 'page',
}: MaProgressionViewProps) {
  const isDrawer = presentation === 'drawer';
  const { triggerHaptic } = useHapticFeedback();
  const { t, locale } = useTranslation();
  const [profile, setProfile] = useState<UserProgressionProfile | null>(initialProfile || null);
  const [selectedFilter, setSelectedFilter] = useState<TerritoryFilter>('city');
  const [leaderboard, setLeaderboard] = useState<TerritorialLeaderboard | null>(null);
  const [leaderboardUnavailable, setLeaderboardUnavailable] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [distinctions, setDistinctions] = useState<DistinctionsState>({
    status: 'loading',
    items: [],
  });
  const [gains, setGains] = useState<GainsState>({
    status: 'loading',
    items: [],
    pending: [],
    nextCursor: null,
    loadingMore: false,
  });
  const [missions, setMissions] = useState<MissionsState>({
    status: 'loading',
    active: [],
    models: [],
    mutating: false,
  });
  const [passport, setPassport] = useState<{
    status: ClientDataStatus;
    discoveries: UserDiscovery[];
  }>({ status: 'loading', discoveries: [] });
  const [rhythm, setRhythm] = useState<{
    status: ClientDataStatus;
    rhythmId: 'leger' | 'regulier' | 'intense' | null;
    paused: boolean;
    weekly: { target: number | null; done: number; atGoal: boolean };
  }>({
    status: 'loading',
    rhythmId: null,
    paused: false,
    weekly: { target: null, done: 0, atGoal: false },
  });
  const [replacingChallenge, setReplacingChallenge] = useState(false);
  const [replaceChallengeError, setReplaceChallengeError] = useState(false);
  const [profileUnavailable, setProfileUnavailable] = useState(false);

  // Charger le profil si non fourni en SSR
  useEffect(() => {
    if (!profile) {
      fetch('/api/progression')
        .then(async (res) => {
          if (!res.ok) throw new Error(`status_${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.success && data.profile) {
            setProfile(data.profile);
          } else {
            setProfileUnavailable(true);
          }
        })
        .catch((err) => {
          console.warn('Visiteur non authentifié ou profil indisponible:', err);
          setProfileUnavailable(true);
        });
    }
  }, [profile]);

  // Charger le classement selon le filtre
  useEffect(() => {
    let alive = true;
    setLoadingLeaderboard(true);
    setLeaderboardUnavailable(false);
    fetch(`/api/progression/leaderboard?filter=${selectedFilter}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`leaderboard_${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        if (data.success && data.leaderboard) {
          setLeaderboard(data.leaderboard);
        } else {
          setLeaderboardUnavailable(true);
        }
      })
      .catch((err) => {
        if (!alive) return;
        console.error('Erreur chargement classement:', err);
        setLeaderboardUnavailable(true);
      })
      .finally(() => {
        if (alive) setLoadingLeaderboard(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedFilter]);

  // Distinctions (badges historiques réels) + historique de gains (ledger réel).
  // Lecture client sous RLS (le propriétaire uniquement) — zéro donnée simulée.
  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    async function loadAccountData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (alive) {
            setDistinctions({ status: 'unavailable', items: [] });
            setGains({ ...EMPTY_GAINS });
          }
          return;
        }

        const [badgesRes, gainsRes] = await Promise.all([
          supabase
            .from('user_badges')
            .select('badge_id, earned_at, badges(name, icon)')
            .eq('user_id', user.id)
            .order('earned_at', { ascending: false })
            .limit(12),
          // T11 — historique paginé par route serveur privée (gains confirmés
          // + intentions en attente strictement séparés).
          fetch('/api/progression/history?limit=8', { cache: 'no-store' }),
        ]);
        if (!alive) return;

        if (badgesRes.error) {
          setDistinctions({ status: 'unavailable', items: [] });
        } else {
          // Le client Supabase non typé expose l'embed `badges` tantôt en objet,
          // tantôt en tableau (relation many-to-one) — on normalise les deux.
          const rows = (badgesRes.data ?? []) as unknown as Array<{
            badge_id: string;
            earned_at: string | null;
            badges:
              | { name: string | null; icon: string | null }
              | Array<{ name: string | null; icon: string | null }>
              | null;
          }>;
          setDistinctions({
            status: 'ready',
            items: rows.map((row) => {
              const badge = Array.isArray(row.badges) ? (row.badges[0] ?? null) : row.badges;
              return {
                id: row.badge_id,
                name: badge?.name?.trim() || '',
                icon: badge?.icon?.trim() || null,
                earnedAt: row.earned_at,
              };
            }),
          });
        }

        if (!gainsRes.ok) {
          setGains({ ...EMPTY_GAINS });
        } else {
          const payload = (await gainsRes.json()) as HistoryApiPayload;
          if (payload?.success !== true) {
            setGains({ ...EMPTY_GAINS });
          } else {
            setGains({
              status: 'ready',
              items: mapHistoryItems(payload.items),
              pending: Array.isArray(payload.pending) ? payload.pending : [],
              nextCursor: payload.nextCursor ?? null,
              loadingMore: false,
            });
          }
        }
      } catch (err) {
        console.error('Erreur chargement distinctions/gains:', err);
        if (alive) {
          setDistinctions({ status: 'unavailable', items: [] });
          setGains({ ...EMPTY_GAINS });
        }
      }
    }

    loadAccountData();
    return () => {
      alive = false;
    };
  }, []);

  /** T11 — page suivante d'historique (curseur serveur), strictement additive. */
  const loadMoreGains = useCallback(async () => {
    const cursor = gains.nextCursor;
    if (!cursor || gains.loadingMore) return;
    setGains((prev) => ({ ...prev, loadingMore: true }));
    try {
      const response = await fetch(
        `/api/progression/history?limit=8&before=${encodeURIComponent(cursor.before)}&beforeId=${encodeURIComponent(cursor.beforeId)}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        setGains((prev) => ({ ...prev, loadingMore: false }));
        return;
      }
      const payload = (await response.json()) as HistoryApiPayload;
      if (payload?.success !== true) {
        setGains((prev) => ({ ...prev, loadingMore: false }));
        return;
      }
      setGains((prev) => ({
        ...prev,
        status: 'ready',
        items: [...prev.items, ...mapHistoryItems(payload.items)],
        pending: Array.isArray(payload.pending) ? payload.pending : prev.pending,
        nextCursor: payload.nextCursor ?? null,
        loadingMore: false,
      }));
    } catch {
      setGains((prev) => ({ ...prev, loadingMore: false }));
    }
  }, [gains.nextCursor, gains.loadingMore]);

  /** T14 — missions : lecture serveur (avancement recalculé), actions sans XP. */
  const refreshMissions = useCallback(async () => {
    try {
      const response = await fetch('/api/progression/missions', { cache: 'no-store' });
      if (!response.ok) {
        setMissions((prev) => ({ ...prev, status: 'unavailable' }));
        return;
      }
      const payload = (await response.json()) as {
        success?: boolean;
        missions?: Array<{
          id: string;
          modelId: string;
          state: string;
          targetCount: number;
          progress: number;
          completedAt: string | null;
        }>;
        availableModels?: Array<{ id: string; title: string; targetCount: number }>;
      };
      if (payload?.success !== true || !Array.isArray(payload.missions)) {
        setMissions((prev) => ({ ...prev, status: 'unavailable' }));
        return;
      }
      const models = Array.isArray(payload.availableModels) ? payload.availableModels : [];
      const titles = new Map(models.map((model) => [model.id, model.title]));
      const active = payload.missions
        .filter((mission) => mission.state === 'active')
        .map((mission) => ({
          id: mission.id,
          modelId: mission.modelId,
          title: titles.get(mission.modelId) ?? mission.modelId,
          progress: Math.max(0, Math.floor(Number(mission.progress) || 0)),
          targetCount: Math.max(1, Math.floor(Number(mission.targetCount) || 1)),
          completedAt: mission.completedAt ?? null,
        }));
      setMissions({ status: 'ready', active, models, mutating: false });
    } catch {
      setMissions((prev) => ({ ...prev, status: 'unavailable' }));
    }
  }, []);

  useEffect(() => {
    void refreshMissions();
  }, [refreshMissions]);

  const mutateMission = useCallback(
    async (body: Record<string, unknown>) => {
      setMissions((prev) => ({ ...prev, mutating: true }));
      try {
        await fetch('/api/progression/missions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(body),
        });
      } catch {
        /* silencieux : la relecture ci-dessous rétablit l'état réel */
      } finally {
        await refreshMissions();
        setMissions((prev) => ({ ...prev, mutating: false }));
      }
    },
    [refreshMissions]
  );

  /** T16 — rythme choisi (facultatif) : objectif hebdo + pause, sans dette. */
  const refreshRhythm = useCallback(async () => {
    try {
      const response = await fetch('/api/progression/preferences', { cache: 'no-store' });
      if (!response.ok) {
        setRhythm((prev) => ({ ...prev, status: 'unavailable' }));
        return;
      }
      const payload = (await response.json()) as {
        success?: boolean;
        preference?: { rhythmId?: 'leger' | 'regulier' | 'intense' | null; paused?: boolean };
        weekly?: { target?: number | null; done?: number; atGoal?: boolean };
      };
      if (payload?.success !== true) {
        setRhythm((prev) => ({ ...prev, status: 'unavailable' }));
        return;
      }
      const rhythmId = payload.preference?.rhythmId ?? null;
      setRhythm({
        status: 'ready',
        rhythmId:
          rhythmId === 'leger' || rhythmId === 'regulier' || rhythmId === 'intense' ? rhythmId : null,
        paused: payload.preference?.paused === true,
        weekly: {
          target: typeof payload.weekly?.target === 'number' ? payload.weekly.target : null,
          done: Math.max(0, Math.floor(Number(payload.weekly?.done) || 0)),
          atGoal: payload.weekly?.atGoal === true,
        },
      });
    } catch {
      setRhythm((prev) => ({ ...prev, status: 'unavailable' }));
    }
  }, []);

  useEffect(() => {
    void refreshRhythm();
  }, [refreshRhythm]);

  const postRhythm = useCallback(
    async (body: { rhythmId?: 'leger' | 'regulier' | 'intense' | null; paused?: boolean }) => {
      try {
        await fetch('/api/progression/preferences', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(body),
        });
      } catch {
        /* silencieux : la relecture rétablit l'état réel */
      } finally {
        await refreshRhythm();
      }
    },
    [refreshRhythm]
  );

  /** T19 — passeport privé (chargement différé, aucune coordonnée exposée). */
  const refreshPassport = useCallback(async () => {
    try {
      const response = await fetch('/api/progression/passport', { cache: 'no-store' });
      if (!response.ok) {
        setPassport((prev) => ({ ...prev, status: 'unavailable' }));
        return;
      }
      const payload = (await response.json()) as {
        success?: boolean;
        discoveries?: UserDiscovery[];
      };
      if (payload?.success !== true || !Array.isArray(payload.discoveries)) {
        setPassport((prev) => ({ ...prev, status: 'unavailable' }));
        return;
      }
      setPassport({ status: 'ready', discoveries: payload.discoveries });
    } catch {
      setPassport((prev) => ({ ...prev, status: 'unavailable' }));
    }
  }, []);

  useEffect(() => {
    void refreshPassport();
  }, [refreshPassport]);

  const handleFilterChange = (filter: TerritoryFilter) => {
    triggerHaptic('selection');
    setSelectedFilter(filter);
  };

  const handleReplaceChallenge = async () => {
    if (!profile?.challenge || !profile.challenge.canBeReplaced || replacingChallenge) return;
    triggerHaptic('selection');
    setReplacingChallenge(true);
    setReplaceChallengeError(false);
    try {
      const response = await fetch('/api/progression/challenge/replace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success && typeof data.challengeId === 'string') {
        const refreshed = await fetch('/api/progression')
          .then((res) => res.json())
          .catch(() => null);
        if (refreshed?.success && refreshed.profile) {
          setProfile(refreshed.profile);
        } else {
          // Rechargement impossible : ne jamais laisser un bouton actif alors
          // que le remplacement serveur a bien consommé le cooldown.
          setProfile((current) =>
            current?.challenge
              ? {
                  ...current,
                  challenge: {
                    ...current.challenge,
                    currentProgress: 0,
                    canBeReplaced: false,
                  },
                }
              : current
          );
        }
        return;
      }
      setReplaceChallengeError(true);
    } catch (err) {
      console.error('Erreur remplacement de défi:', err);
      setReplaceChallengeError(true);
    } finally {
      setReplacingChallenge(false);
    }
  };

  if (!profile) {
    if (profileUnavailable) {
      return (
        <div className="w-full space-y-6">
          <Card variant="featured" className="p-6 sm:p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] flex items-center justify-center mx-auto mb-4 shadow-md">
              <Trophy size={28} className="text-sand-200" />
            </div>
            <h2 className="font-display font-bold text-2xl text-[color:var(--lkv-text-primary)] mb-2">
              Votre Cordée & Progression
            </h2>
            <p className="text-sm text-[var(--lkv-text-muted)] max-w-md mx-auto mb-6 leading-relaxed">
              Connectez-vous pour mesurer vos compétences d&apos;expédition, accumuler vos points de saison et participer aux classements territoriaux officiels.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/connexion"
                className="inline-flex w-full items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-md)] rounded-full px-[var(--space-5)] text-[length:var(--lkv-text-body-sm)] font-semibold bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 sm:w-auto"
              >
                Se connecter / Créer un compte
              </Link>
              <Link
                href="/explorer"
                className="inline-flex w-full items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-md)] rounded-full px-[var(--space-5)] text-[length:var(--lkv-text-body-sm)] font-semibold border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] sm:w-auto"
              >
                Découvrir les sentiers
              </Link>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <LoadingState label={t('progression.loadingProfile')} />
      </div>
    );
  }

  const hasData = profile.hasData;
  const rank =
    typeof leaderboard?.rank === 'number' && leaderboard.rank > 0
      ? leaderboard.rank
      : typeof profile.leaderboardRank === 'number' && profile.leaderboardRank > 0
        ? profile.leaderboardRank
        : null;
  const challenge = profile.challenge;
  const seasonPoints = profile.points.seasonId !== null ? profile.points.season : null;
  const usableBalance = profile.usableBalance;
  const filterLabel = t(
    TERRITORY_FILTERS.find((filter) => filter.id === selectedFilter)?.labelKey ??
      'progression.territoryCity'
  );
  const challengePct =
    challenge && challenge.targetProgress > 0
      ? Math.min(100, Math.round((challenge.currentProgress / challenge.targetProgress) * 100))
      : null;

  const skillsList: { key: SkillType; data: typeof profile.skills.explorer }[] = [
    { key: 'explorer', data: profile.skills.explorer },
    { key: 'preparer', data: profile.skills.preparer },
    { key: 'partager', data: profile.skills.partager },
    { key: 'entraider', data: profile.skills.entraider },
  ];

  return (
    <div
      className={`w-full font-sans text-[var(--lkv-text-primary)] ${isDrawer ? 'hub-progression-drawer space-y-3' : `space-y-4 ${compact ? '' : 'sm:space-y-5'}`}`}
    >
      {/* ── (a) EN-TÊTE COMPACT : Points cumulés, points de saison, niveau + titre ── */}
      <section className="glass relative overflow-hidden rounded-3xl border border-white/70 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-xl shadow-sm">
              {hasData ? (
                profile.level.level >= 10 ? (
                  '👑'
                ) : profile.level.level >= 7 ? (
                  '🧗'
                ) : profile.level.level >= 4 ? (
                  '⛰️'
                ) : (
                  '🌱'
                )
              ) : (
                '🧭'
              )}
            </div>
            <div className="min-w-0">
              {!isDrawer ? (
                <>
                  <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-[var(--lkv-text-primary)] sm:text-2xl">
                    {hasData
                      ? profile.level.title ?? `${t('progression.level')} ${profile.level.level}`
                      : t('progression.title')}
                  </h1>
                  <p className="text-xs font-medium text-[var(--lkv-text-secondary)]">
                    {hasData
                      ? `${t('progression.level')} ${profile.level.level}`
                      : t('progression.noData')}
                    {hasData && profile.displayName ? ` · ${profile.displayName}` : ''}
                  </p>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatBlock
              label={t('progression.pointsLifetime')}
              value={hasData ? formatNumber(profile.points.lifetime, {}, locale) : '—'}
            />
            <StatBlock
              label={t('progression.pointsSeason')}
              value={seasonPoints !== null ? formatNumber(seasonPoints, {}, locale) : '—'}
            />
          </div>
        </div>

        {hasData ? (
          <div className="mt-4 border-t border-black/5 pt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
              <span className="text-[var(--lkv-text-secondary)]">
                {profile.level.nextLevelPoints
                  ? t('progression.progressToLevel', { level: profile.level.level + 1 })
                  : profile.level.title
                    ? t('progression.maxLevel')
                    : t('progression.levelThresholdsUnavailable')}
              </span>
              <span className="font-mono font-bold text-[var(--lkv-text-primary)]">
                {profile.level.progressPct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={profile.level.progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progression.levelProgressAria')}
              className="h-2.5 w-full overflow-hidden rounded-full border border-white/60 bg-black/5 p-0.5"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-primary)] to-[var(--lkv-secondary)] transition-all duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.max(4, profile.level.progressPct)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--lkv-text-muted)]">
              <span>{formatNumber(profile.points.lifetime, {}, locale)} {t('progression.pointsShort')}</span>
              <span>
                {profile.level.nextLevelPoints
                  ? `${formatNumber(profile.level.nextLevelPoints, {}, locale)} ${t('progression.pointsShort')}`
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            {t('progression.noDataBody')}
          </p>
        )}
      </section>

      {/* ── (b) RÉSUMÉ : 4 compétences courtes, rang, défi, solde utilisable ── */}
      <section
        aria-labelledby="progression-resume"
        className="glass rounded-3xl border border-white/70 p-4 shadow-sm sm:p-5"
      >
        <h2 id="progression-resume" className="sr-only">
          {t('progression.summaryAria')}
        </h2>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {skillsList.map(({ key, data }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-sm"
              >
                <Icon name={data.icon} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                    {t(SKILL_LABEL_KEYS[key])}
                  </span>
                  <span className="font-mono text-xs font-bold text-[color:var(--lkv-text-primary)]">
                    {hasData ? `${data.pct}%` : '—'}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={hasData ? data.pct : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('progression.skillProgressAria', { skill: t(SKILL_LABEL_KEYS[key]) })}
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5"
                >
                  <div
                    className="h-full rounded-full bg-[var(--lkv-primary)] transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${hasData ? Math.max(3, data.pct) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {(rank !== null || challenge !== null || usableBalance !== null) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rank !== null && (
              <SummaryChip
                icon={<Trophy size={15} />}
                label={`${t('progression.rank')} · ${filterLabel}`}
                value={`#${rank}`}
              />
            )}
            {challenge !== null && (
              <SummaryChip
                icon={<Target size={15} />}
                label={t('progression.nextChallenge')}
                value={
                  challengePct !== null
                    ? `${challenge.title} · ${challenge.currentProgress}/${challenge.targetProgress} ${challenge.unit}`
                    : challenge.title
                }
              />
            )}
            {usableBalance !== null && (
              <SummaryChip
                icon={<Gift size={15} />}
                label={t('progression.usableBalance')}
                value={`${formatNumber(usableBalance, {}, locale)} ${t('progression.pointsShort')}`}
              />
            )}
          </div>
        )}

        {!hasData &&
          rank === null &&
          challenge === null &&
          usableBalance === null && (
            <p className="mt-3 text-xs text-[var(--lkv-text-secondary)]">
              {t('progression.emptySummary')}
            </p>
          )}
      </section>

      {/* ── (c) SECTIONS DÉTAILLÉES — repliées par défaut ── */}

      <ProgressionSection
        forceOpen={isDrawer}
        title={t('progression.leaderboard')}
        summary={
          leaderboard
            ? `${plural(locale, leaderboard.totalParticipants, {
                one: t('progression.participantOne', { count: leaderboard.totalParticipants }),
                other: t('progression.participantOther', { count: leaderboard.totalParticipants }),
              })} · ${filterLabel}`
            : t('progression.leaderboardFiltersSummary')
        }
      >
        <Tabs
          options={TERRITORY_FILTERS.map((f) => ({
            id: f.id,
            label: t(f.labelKey),
            icon: <Icon name={f.icon} size={13} />,
          }))}
          value={selectedFilter}
          onChange={(id) => handleFilterChange(id as TerritoryFilter)}
          variant="scrollable"
          ariaLabel={t('progression.leaderboardFiltersAria')}
          className="mb-4"
        />

        {leaderboardUnavailable && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.leaderboardUnavailable')}
          </p>
        )}

        {leaderboard?.seasonUnavailable && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.seasonUnavailable')}
          </p>
        )}

        {leaderboard?.territoryMissing && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.territoryMissing')}
          </p>
        )}

        {leaderboard?.localUnavailable && (
          <p className="mb-4 rounded-2xl border border-white/80 bg-white/60 p-3 text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.localUnavailable', { reason: reasonLabel(leaderboard.reason, t) })}
          </p>
        )}

        {leaderboard?.communityForming && !leaderboard.territoryMissing && (
          <div className="mb-4 space-y-2 rounded-2xl border border-white/80 bg-white/70 p-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--lkv-primary)]/10 text-lg text-[color:var(--lkv-text-primary)]">
              🌱
            </div>
            <h4 className="text-sm font-bold text-[var(--lkv-text-primary)]">
              {t('progression.communityForming')}
            </h4>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--lkv-text-muted)]">
              {t('progression.communityFormingBody', { count: leaderboard.minParticipants })}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {loadingLeaderboard ? (
            <div className="py-6 text-center text-xs font-medium text-[var(--lkv-text-muted)]">
              {t('progression.loadingLeaderboard')}
            </div>
          ) : leaderboard?.rows && leaderboard.rows.length > 0 ? (
            leaderboard.rows.map((entry) => {
              const isCurrentUser = entry.isCurrentUser;
              const medal =
                entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;

              return (
                <div
                  key={`${selectedFilter}-${entry.rank}`}
                  className={`flex items-center justify-between rounded-2xl border p-3 transition-all ${
                    isCurrentUser
                      ? 'border-[var(--lkv-primary)] bg-white/95 shadow-sm ring-1 ring-[var(--lkv-primary)]/20'
                      : 'border-white/70 bg-white/55 hover:bg-white/75'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 font-mono text-xs font-bold shadow-sm">
                      {medal ?? `#${entry.rank}`}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`block truncate text-xs font-bold ${
                          isCurrentUser
                            ? 'text-[color:var(--lkv-text-primary)]'
                            : 'text-[var(--lkv-text-primary)]'
                        }`}
                      >
                        {entry.alias ?? '—'} {isCurrentUser ? t('progression.you') : ''}
                      </span>
                      <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                        {entry.level !== null
                          ? `${t('progression.levelShort')} ${entry.level}`
                          : `${t('progression.level')} —`}
                        {entry.levelTitle ? ` · ${entry.levelTitle}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block font-mono text-xs font-extrabold text-[color:var(--lkv-text-primary)] sm:text-sm">
                      {formatNumber(entry.seasonPoints, {}, locale)} {t('progression.pointsShort')}
                    </span>
                    <span className="font-mono text-[9.5px] text-[var(--lkv-text-muted)]">
                      {t('progression.currentSeason')}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            !leaderboardUnavailable && (
              <div className="py-5 text-center text-xs italic text-[var(--lkv-text-muted)]">
                {t('progression.noParticipant')}
              </div>
            )
          )}
        </div>
      </ProgressionSection>

      <ProgressionSection
        forceOpen={isDrawer}
        title={t('progression.challenges')}
        summary={
          challenge
            ? `${t('progression.challengeInProgress')} · ${challenge.currentProgress}/${challenge.targetProgress} ${challenge.unit}`
            : t('progression.challengeNone')
        }
      >
        {challenge ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--lkv-text-primary)]">
                {challenge.title}
              </h3>
              {/* Aucune promesse de points : un défi est une conséquence de la
                  progression, jamais une source de gains (règle produit). */}
              <Badge tone="stone" className="text-[10px] font-mono font-bold">
                {challenge.difficulty}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
              {challenge.description}
            </p>
            <div className="mt-3 flex items-center justify-between font-mono text-xs text-[var(--lkv-text-muted)]">
              <span>
                {challenge.currentProgress}/{challenge.targetProgress} {challenge.unit}
              </span>
              {challengePct !== null && <span>{challengePct}%</span>}
            </div>
            <div
              role="progressbar"
              aria-valuenow={challengePct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progression.challengeProgressAria')}
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/5"
            >
              <div
                className="h-full rounded-full bg-[var(--lkv-primary)] transition-all duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.max(3, challengePct ?? 0)}%` }}
              />
            </div>
            {challenge.isCompleted && (
              <p className="mt-2 text-xs font-semibold text-[color:var(--lkv-text-primary)]">
                {t('progression.challengeCompleted')}
              </p>
            )}
            {/* Remplacement réel (1/semaine) : affiché uniquement pour un défi
                réel et un cooldown écoulé ; sinon désactivé avec libellé
                explicite. Jamais de bouton factice. */}
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReplaceChallenge}
                disabled={!challenge.canBeReplaced || replacingChallenge}
                aria-label={t('progression.challengeReplaceAria')}
                icon={
                  <RefreshCw
                    size={14}
                    aria-hidden="true"
                    className={replacingChallenge ? 'animate-spin motion-reduce:animate-none' : ''}
                  />
                }
                className="w-full justify-center font-bold sm:w-auto"
              >
                {replacingChallenge
                  ? t('progression.challengeReplaceLoading')
                  : challenge.canBeReplaced
                    ? t('progression.challengeReplace')
                    : t('progression.challengeReplaceCooldown')}
              </Button>
              {replaceChallengeError && (
                <p role="status" className="mt-2 text-xs text-[var(--lkv-text-secondary)]">
                  {t('progression.challengeReplaceError')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            {t('progression.challengeNoneBody')}
          </p>
        )}
      </ProgressionSection>

      <ProgressionSection
        forceOpen={isDrawer}
        title={t('progression.distinctions')}
        summary={
          distinctions.status === 'ready'
            ? distinctions.items.length > 0
              ? plural(locale, distinctions.items.length, {
                  one: t('progression.distinctionOne', { count: distinctions.items.length }),
                  other: t('progression.distinctionOther', { count: distinctions.items.length }),
                })
              : t('progression.distinctionNone')
            : t('progression.distinctionsDefault')
        }
      >
        {distinctions.status === 'loading' && (
          <p className="text-xs text-[var(--lkv-text-muted)]">{t('progression.loadingDistinctions')}</p>
        )}
        {distinctions.status === 'unavailable' && (
          <p className="text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.distinctionUnavailable')}
          </p>
        )}
        {distinctions.status === 'ready' && distinctions.items.length === 0 && (
          <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            {t('progression.distinctionEmpty')}
          </p>
        )}
        {distinctions.status === 'ready' && distinctions.items.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {distinctions.items.map((distinction) => {
              const earnedLabel = formatDate(distinction.earnedAt, undefined, locale);
              return (
                <li
                  key={distinction.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/60 p-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-lg shadow-sm"
                  >
                    {distinction.icon ?? <Award size={16} className="text-[var(--lkv-secondary-ink)]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                      {distinction.name || t('progression.distinctionFallbackName')}
                    </span>
                    <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                      {earnedLabel
                        ? t('progression.distinctionEarnedOn', { date: earnedLabel })
                        : t('progression.distinctionEarned')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ProgressionSection>

      <ProgressionSection
        forceOpen={isDrawer}
        title={t('progression.missionsTitle')}
        summary={
          missions.status === 'ready'
            ? missions.active.length > 0
              ? t('progression.missionsCount', { count: missions.active.length })
              : t('progression.missionsEmpty')
            : t('progression.missionsTitle')
        }
      >
        {missions.status === 'loading' && (
          <p className="text-xs text-[var(--lkv-text-muted)]">{t('progression.missionsLoading')}</p>
        )}
        {missions.status === 'unavailable' && (
          <p className="text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.missionsUnavailable')}
          </p>
        )}
        {missions.status === 'ready' && (
          <>
            {missions.active.length === 0 && (
              <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
                {t('progression.missionsEmptyBody')}
              </p>
            )}
            {missions.active.length > 0 && (
              <ul className="divide-y divide-black/5">
                {missions.active.map((mission) => (
                  <li key={mission.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                        {mission.title}
                      </span>
                      <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                        {mission.progress}/{mission.targetCount}
                        {mission.completedAt
                          ? ` · ${t('progression.missionsCompleted')}`
                          : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={missions.mutating}
                      onClick={() => void mutateMission({ action: 'abandon', assignmentId: mission.id })}
                      className="shrink-0 min-h-[44px] rounded-full px-3 text-[11px] font-semibold text-[var(--lkv-text-secondary)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
                    >
                      {t('progression.missionsAbandon')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* T16 — rythme choisi : facultatif, sans obligation ni pénalité. */}
            <div className="mt-3 border-t border-black/5 pt-3">
              <p className="text-[11px] font-bold text-[var(--lkv-text-secondary)]">
                {t('progression.rhythmTitle')}
              </p>
              {rhythm.status === 'unavailable' && (
                <p className="mt-1 text-[10.5px] text-[var(--lkv-text-muted)]">
                  {t('progression.rhythmUnavailable')}
                </p>
              )}
              {rhythm.status === 'ready' && (
                <>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(
                      [
                        ['leger', t('progression.rhythmLeger')],
                        ['regulier', t('progression.rhythmRegulier')],
                        ['intense', t('progression.rhythmIntense')],
                      ] as Array<['leger' | 'regulier' | 'intense', string]>
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={rhythm.rhythmId === id}
                        onClick={() =>
                          void postRhythm({ rhythmId: rhythm.rhythmId === id ? null : id })
                        }
                        className={`min-h-[44px] rounded-full border px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
                          rhythm.rhythmId === id
                            ? 'border-[color:var(--lkv-primary)] text-[color:var(--lkv-primary)]'
                            : 'border-[color:var(--glass-border)] text-[color:var(--card-content)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10.5px] text-[var(--lkv-text-muted)]">
                    {rhythm.paused
                      ? t('progression.rhythmPaused')
                      : rhythm.weekly.target !== null
                        ? t('progression.rhythmWeek', {
                            done: rhythm.weekly.done,
                            target: rhythm.weekly.target,
                          })
                        : t('progression.rhythmNone')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void postRhythm({ paused: !rhythm.paused })}
                    className="mt-1 min-h-[44px] text-[11px] font-semibold text-[color:var(--lkv-text-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
                  >
                    {rhythm.paused ? t('progression.rhythmResume') : t('progression.rhythmPause')}
                  </button>
                </>
              )}
            </div>

            {missions.active.length < 3 && missions.models.length > 0 && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <p className="text-[11px] font-bold text-[var(--lkv-text-secondary)]">
                  {t('progression.missionsChoose')}
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {missions.models
                    .filter((model) => !missions.active.some((mission) => mission.modelId === model.id))
                    .map((model) => (
                      <li key={model.id}>
                        <button
                          type="button"
                          disabled={missions.mutating}
                          onClick={() => void mutateMission({ action: 'choose', modelId: model.id })}
                          className="min-h-[44px] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-3 text-[11px] font-semibold text-[color:var(--card-content)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
                        >
                          {model.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </ProgressionSection>

      <ProgressionSection
        forceOpen={isDrawer}
        title={t('progression.gainsHistory')}
        summary={
          gains.status === 'ready'
            ? gains.items.length > 0
              ? plural(locale, gains.items.length, {
                  one: t('progression.gainOne', { count: gains.items.length }),
                  other: t('progression.gainOther', { count: gains.items.length }),
                })
              : t('progression.gainsNone')
            : t('progression.gainsLast')
        }
      >
        {gains.status === 'loading' && (
          <p className="text-xs text-[var(--lkv-text-muted)]">{t('progression.loadingGains')}</p>
        )}
        {gains.status === 'unavailable' && (
          <p className="text-xs text-[var(--lkv-text-secondary)]">
            {t('progression.gainsUnavailable')}
          </p>
        )}
        {gains.status === 'ready' && gains.pending.length > 0 && (
          <div className="mb-3 rounded-2xl border border-dashed border-black/10 p-3">
            <p className="text-[11px] font-bold text-[var(--lkv-text-secondary)]">
              {t('progression.historyPendingTitle')}
            </p>
            <ul className="mt-1 space-y-1">
              {gains.pending.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-[var(--lkv-text-secondary)]">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-[10.5px] font-semibold text-[var(--lkv-text-muted)]">
                    {t('progression.historyPendingState')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {gains.status === 'ready' && gains.items.length === 0 && gains.pending.length === 0 && (
          <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
            {t('progression.gainsNoneBody')}
          </p>
        )}
        {gains.status === 'ready' && gains.items.length > 0 && (
          <ul className="divide-y divide-black/5">
            {gains.items.map((gain) => {
              const dateLabel = formatDate(gain.createdAt, undefined, locale);
              const breakdown = gain.skills
                .filter((skill) => skill.points > 0)
                .map((skill) => {
                  const entry =
                    profile?.skills?.[skill.skill as keyof UserProgressionProfile['skills']];
                  return `${entry?.label ?? skill.skill} ${skill.points}`;
                })
                .join(' · ');
              return (
                <li key={gain.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                      {gainLabel(gain.type, t)}
                    </span>
                    {breakdown && (
                      <span className="block truncate text-[10.5px] text-[var(--lkv-text-secondary)]">
                        {breakdown}
                      </span>
                    )}
                    {dateLabel && (
                      <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                        {dateLabel}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-extrabold text-[color:var(--lkv-text-primary)]">
                    +{formatNumber(gain.points, {}, locale)} {t('progression.pointsShort')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {gains.status === 'ready' && gains.nextCursor && (
          <button
            type="button"
            onClick={loadMoreGains}
            disabled={gains.loadingMore}
            className="mt-3 inline-flex min-h-[44px] items-center text-xs font-bold text-[color:var(--lkv-text-primary)] underline-offset-2 hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
          >
            {gains.loadingMore
              ? t('progression.historyLoadingMore')
              : t('progression.historyLoadMore')}
          </button>
        )}
        <Link
          href="/recompenses"
          className="mt-3 inline-flex min-h-[44px] items-center text-xs font-bold text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
        >
          {t('progression.seeAllRewards')}
        </Link>
      </ProgressionSection>

      <ProgressionSection
        forceOpen={isDrawer}
        title={t('progression.passportTitle')}
        summary={
          passport.status === 'ready'
            ? passport.discoveries.length > 0
              ? t('progression.passportTitle')
              : t('progression.passportEmpty')
            : t('progression.passportTitle')
        }
      >
        <PassportSection status={passport.status} discoveries={passport.discoveries} />
      </ProgressionSection>

      {/* Liens économiques distincts : récompenses utilisables et fidélité historique. */}
      <section aria-label={t('progression.rewardsAndLoyaltyAria')} className="flex flex-wrap gap-2">
        <Link
          href="/recompenses"
          className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-sm)] rounded-full px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-semibold border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
        >
          <Gift size={14} aria-hidden="true" />
          <span>{t('progression.rewards')}</span>
        </Link>
        <Link
          href="/fidelite"
          className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-sm)] rounded-full px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-semibold border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
        >
          <Award size={14} aria-hidden="true" />
          <span>{t('progression.loyalty')}</span>
        </Link>
      </section>
    </div>
  );
}
