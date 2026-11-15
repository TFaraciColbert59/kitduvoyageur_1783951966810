/**
 * Lot N01 — Contrat Audio / TTS : Guidage vocal virage par virage (K4.02, S3.11),
 * Alertes audio aux waypoints (K4.08) & Annonces audio pendant l'effort (S1.07).
 *
 * Responsabilités :
 * - Fournir un adaptateur TTS découplé (`SpeechSynthesisAdapter`) fonctionnant
 *   100 % hors ligne sur les instructions et métriques locales.
 * - Gérer les préférences audio globales et par sport (`AudioGuidancePreferences`,
 *   `EffortAnnouncementPreferences`).
 * - Générer les annonces d'effort périodiques (`S1.07`) au franchissement de
 *   chaque split (`km` en métrique, `mi` en impérial) et/ou à intervalle de
 *   temps régulier (`timeIntervalS`), en adaptant automatiquement la métrique
 *   de rythme (`pace` pour course/trail, `speed` pour vélo/rando/ski/kayak).
 * - Ordonnancer les annonces par priorité (`off-route` > `turn-by-turn` >
 *   `waypoint` > `effort`) avec anti-bégaiement.
 */

import {
  splitPaceSecondsPerKm,
  splitPaceSecondsPerMile,
  splitSpeedKmh,
  MILE_DISTANCE_M,
} from '../explorer-v2/activity/splits';
import { rhythmMetric } from '../explorer-v2/sheet/sportSelection';
import type { ActivitySplit, Sport, SportSelection } from '../explorer-v2/state/types';
import type {
  AudioGuidancePreferences,
  EffortAnnouncementPreferences,
  NavigationUnits,
  QueuedAudioAnnouncement,
} from './types';
import {
  formatNavigationDuration,
  formatSpokenDistance,
} from './unitsAndOrientation';

export interface SpeechSynthesisAdapter {
  isSupported(): boolean;
  isHeadphonesConnected?(): boolean;
  speak(text: string, options: { lang: string; rate: number; pitch: number }): void;
  cancel(): void;
}

export const browserSpeechAdapter: SpeechSynthesisAdapter = {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  },
  speak(text, options): void {
    if (!this.isSupported()) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang;
      utterance.rate = options.rate;
      utterance.pitch = options.pitch;
      synth.speak(utterance);
    } catch {
      // Ne jamais faire échouer le suivi GPS sur une erreur de synthèse vocale
    }
  },
  cancel(): void {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignorer
    }
  },
};

export function defaultEffortPreferencesForSport(sport: Sport): EffortAnnouncementPreferences {
  switch (sport) {
    case 'course':
    case 'trail':
      return {
        enabled: true,
        onEachSplit: true,
        timeIntervalS: null,
        announceDistance: true,
        announceDuration: true,
        announceRhythm: true,
        announceSplitDelta: true,
      };
    case 'velo':
      return {
        enabled: true,
        onEachSplit: false,
        timeIntervalS: 600, // Toutes les 10 minutes
        announceDistance: true,
        announceDuration: true,
        announceRhythm: true,
        announceSplitDelta: false,
      };
    default:
      return {
        enabled: false,
        onEachSplit: true,
        timeIntervalS: null,
        announceDistance: true,
        announceDuration: true,
        announceRhythm: true,
        announceSplitDelta: false,
      };
  }
}

export function createDefaultAudioPreferences(): AudioGuidancePreferences {
  return {
    channel: 'all',
    turnByTurnEnabled: true,
    waypointAlertsEnabled: true,
    offRouteAlertsEnabled: true,
    effortBySport: {
      course: defaultEffortPreferencesForSport('course'),
      trail: defaultEffortPreferencesForSport('trail'),
      velo: defaultEffortPreferencesForSport('velo'),
      rando: defaultEffortPreferencesForSport('rando'),
      ski: defaultEffortPreferencesForSport('ski'),
      kayak: defaultEffortPreferencesForSport('kayak'),
      escalade: defaultEffortPreferencesForSport('escalade'),
      famille: defaultEffortPreferencesForSport('famille'),
      bivouac: defaultEffortPreferencesForSport('bivouac'),
    },
    lang: 'fr-FR',
    rate: 1.0,
    pitch: 1.0,
  };
}

/** Formate une durée en secondes pour la synthèse vocale (« 1 heure 12 minutes 30 secondes »). */
export function formatSpokenDuration(movingS: number): string {
  if (!Number.isFinite(movingS) || movingS <= 0) return '0 seconde';
  const total = Math.round(movingS);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} heure${h > 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (s > 0 && h === 0) parts.push(`${s} seconde${s > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(' ') : '0 seconde';
}

/** Formate le rythme (allure ou vitesse) pour la synthèse vocale selon le sport et les unités (`S1.07`). */
export function formatSpokenRhythm(
  sport: Sport,
  distanceM: number,
  movingS: number,
  units: NavigationUnits = 'metric',
  selection?: SportSelection,
  completedSplit?: ActivitySplit | null,
): string | null {
  const metricKind = rhythmMetric(sport, selection);

  if (metricKind === 'pace') {
    let secPerUnit: number | null = null;
    if (completedSplit && completedSplit.completed) {
      secPerUnit =
        units === 'imperial'
          ? splitPaceSecondsPerMile(completedSplit)
          : splitPaceSecondsPerKm(completedSplit);
    } else if (distanceM > 0 && movingS > 0) {
      const unitM = units === 'imperial' ? MILE_DISTANCE_M : 1000;
      secPerUnit = movingS / (distanceM / unitM);
    }

    if (secPerUnit === null || !Number.isFinite(secPerUnit) || secPerUnit <= 0) {
      return null;
    }
    const rounded = Math.round(secPerUnit);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    const unitWord = units === 'imperial' ? 'par mile' : 'par kilomètre';
    return `Allure ${mins} minute${mins > 1 ? 's' : ''}${secs > 0 ? ` ${secs}` : ''} ${unitWord}`;
  }

  // Vitesse (km/h ou mph)
  let kmh: number | null = null;
  if (completedSplit && completedSplit.completed) {
    kmh = splitSpeedKmh(completedSplit);
  } else if (distanceM > 0 && movingS > 0) {
    kmh = (distanceM / movingS) * 3.6;
  }
  if (kmh === null || !Number.isFinite(kmh) || kmh <= 0) {
    return null;
  }
  if (units === 'imperial') {
    const mph = Math.round(((kmh * 1000) / MILE_DISTANCE_M) * 10) / 10;
    return `Vitesse ${String(mph).replace('.', ',')} miles par heure`;
  }
  const roundedKmh = Math.round(kmh * 10) / 10;
  return `Vitesse ${String(roundedKmh).replace('.', ',')} kilomètres par heure`;
}

/**
 * Construit le texte complet d'une annonce audio pendant l'effort (`S1.07`).
 */
export function buildEffortAnnouncementText(input: {
  sport: Sport;
  selection?: SportSelection;
  distanceM: number;
  movingS: number;
  units: NavigationUnits;
  prefs: EffortAnnouncementPreferences;
  completedSplit?: ActivitySplit | null;
}): string | null {
  const { sport, selection, distanceM, movingS, units, prefs, completedSplit } = input;
  if (!prefs.enabled) return null;

  const segments: string[] = [];

  if (prefs.announceDistance) {
    if (completedSplit && completedSplit.completed) {
      const unitName = completedSplit.kind === 'mi' ? 'Mile' : 'Kilomètre';
      segments.push(`${unitName} ${completedSplit.index}`);
    } else {
      segments.push(`Distance ${formatSpokenDistance(distanceM, units)}`);
    }
  }

  if (prefs.announceDuration && movingS > 0) {
    segments.push(`Temps ${formatSpokenDuration(movingS)} (${formatNavigationDuration(movingS)})`);
  }

  if (prefs.announceRhythm) {
    const rhythm = formatSpokenRhythm(
      sport,
      distanceM,
      movingS,
      units,
      selection,
      prefs.announceSplitDelta ? completedSplit : null,
    );
    if (rhythm) segments.push(rhythm);
  }

  return segments.length > 0 ? `${segments.join('. ')}.` : null;
}

export interface EffortEvaluationInput {
  sport: Sport;
  selection?: SportSelection;
  distanceM: number;
  movingS: number;
  splits?: readonly ActivitySplit[];
  mileSplits?: readonly ActivitySplit[];
  units?: NavigationUnits;
  nowMs?: number;
}

/**
 * Contrôleur unifié de guidage et d'annonces audio (`K4.02`, `K4.08`, `S1.07`, `S3.11`).
 */
export class AudioGuidanceController {
  private adapter: SpeechSynthesisAdapter;
  private prefs: AudioGuidancePreferences;
  private spokenKeys = new Set<string>();
  private lastSpokenText = '';
  private lastSpokenAtMs = 0;
  private lastAnnouncedSplitIndex = 0;
  private lastAnnouncedTimeBucket = 0;
  private history: QueuedAudioAnnouncement[] = [];

  constructor(
    adapter: SpeechSynthesisAdapter = browserSpeechAdapter,
    initialPrefs: AudioGuidancePreferences = createDefaultAudioPreferences(),
  ) {
    this.adapter = adapter;
    this.prefs = {
      ...initialPrefs,
      effortBySport: { ...initialPrefs.effortBySport },
    };
  }

  public get preferences(): AudioGuidancePreferences {
    return {
      ...this.prefs,
      effortBySport: { ...this.prefs.effortBySport },
    };
  }

  public get spokenHistory(): readonly QueuedAudioAnnouncement[] {
    return [...this.history];
  }

  public updatePreferences(patch: Partial<AudioGuidancePreferences>): AudioGuidancePreferences {
    this.prefs = {
      ...this.prefs,
      ...patch,
      effortBySport: {
        ...this.prefs.effortBySport,
        ...(patch.effortBySport ?? {}),
      },
    };
    if (this.prefs.channel === 'muted') {
      this.adapter.cancel();
    }
    return this.preferences;
  }

  public updateSportEffortPreferences(
    sport: Sport,
    patch: Partial<EffortAnnouncementPreferences>,
  ): EffortAnnouncementPreferences {
    const current = this.prefs.effortBySport[sport] ?? defaultEffortPreferencesForSport(sport);
    const updated: EffortAnnouncementPreferences = { ...current, ...patch };
    this.prefs = {
      ...this.prefs,
      effortBySport: {
        ...this.prefs.effortBySport,
        [sport]: updated,
      },
    };
    return updated;
  }

  /** Réinitialise les clés d'annonces liées au tracé (ex: lors d'un changement de parcours K4.10). */
  public resetRouteAnnouncements(): void {
    for (const key of Array.from(this.spokenKeys)) {
      if (key.startsWith('turn:') || key.startsWith('wp:') || key.startsWith('offroute:')) {
        this.spokenKeys.delete(key);
      }
    }
  }

  /** Réinitialise l'ensemble de la session audio. */
  public resetAll(): void {
    this.spokenKeys.clear();
    this.lastSpokenText = '';
    this.lastSpokenAtMs = 0;
    this.lastAnnouncedSplitIndex = 0;
    this.lastAnnouncedTimeBucket = 0;
    this.history = [];
    this.adapter.cancel();
  }

  private canOutputAudio(): boolean {
    if (this.prefs.channel === 'muted') return false;
    if (!this.adapter.isSupported()) return false;
    if (this.prefs.channel === 'headphones_only') {
      if (typeof this.adapter.isHeadphonesConnected === 'function') {
        return this.adapter.isHeadphonesConnected();
      }
      return false;
    }
    return true;
  }

  /**
   * Prononce et journalise un événement audio s'il est autorisé et non dupliqué.
   */
  public dispatchAnnouncement(
    event: Omit<QueuedAudioAnnouncement, 'id' | 'createdAtMs'>,
    nowMs = Date.now(),
    cooldownMs = 8_000,
  ): QueuedAudioAnnouncement | null {
    if (!event.text.trim()) return null;

    if (event.category === 'turn-by-turn' && !this.prefs.turnByTurnEnabled) return null;
    if (event.category === 'waypoint' && !this.prefs.waypointAlertsEnabled) return null;
    if (event.category === 'off-route' && !this.prefs.offRouteAlertsEnabled) return null;

    if (this.spokenKeys.has(event.dedupeKey)) {
      return null;
    }
    if (
      event.text === this.lastSpokenText &&
      nowMs - this.lastSpokenAtMs < Math.max(0, cooldownMs)
    ) {
      return null;
    }

    this.spokenKeys.add(event.dedupeKey);
    const queued: QueuedAudioAnnouncement = {
      ...event,
      id: `${event.category}-${nowMs}-${this.history.length + 1}`,
      createdAtMs: nowMs,
    };
    this.history.push(queued);
    this.lastSpokenText = event.text;
    this.lastSpokenAtMs = nowMs;

    if (this.canOutputAudio()) {
      this.adapter.speak(event.text, {
        lang: this.prefs.lang,
        rate: this.prefs.rate,
        pitch: this.prefs.pitch,
      });
    }

    return queued;
  }

  /**
   * Évalue et déclenche les annonces audio d'effort (`S1.07`) au franchissement
   * d'un split (`km` ou `mi`) ou d'un palier temporel (`timeIntervalS`).
   */
  public evaluateEffortProgress(input: EffortEvaluationInput): QueuedAudioAnnouncement | null {
    const units = input.units ?? 'metric';
    const nowMs = input.nowMs ?? Date.now();
    const prefs =
      this.prefs.effortBySport[input.sport] ?? defaultEffortPreferencesForSport(input.sport);

    if (!prefs.enabled) return null;

    // 1. Déclenchement par split complété (km en métrique, mile en impérial)
    if (prefs.onEachSplit) {
      const relevantSplits = units === 'imperial' ? input.mileSplits : input.splits;
      const completedSplits = (relevantSplits ?? []).filter((s) => s.completed);
      const latestCompleted =
        completedSplits.length > 0 ? completedSplits[completedSplits.length - 1] : null;

      if (latestCompleted && latestCompleted.index > this.lastAnnouncedSplitIndex) {
        this.lastAnnouncedSplitIndex = latestCompleted.index;
        const text = buildEffortAnnouncementText({
          sport: input.sport,
          selection: input.selection,
          distanceM: input.distanceM,
          movingS: input.movingS,
          units,
          prefs,
          completedSplit: latestCompleted,
        });
        if (text) {
          return this.dispatchAnnouncement(
            {
              dedupeKey: `effort:split:${units}:${latestCompleted.index}`,
              priority: 4,
              category: 'effort',
              text,
            },
            nowMs,
            2_000,
          );
        }
      }
    }

    // 2. Déclenchement par intervalle de temps en mouvement
    if (
      typeof prefs.timeIntervalS === 'number' &&
      Number.isFinite(prefs.timeIntervalS) &&
      prefs.timeIntervalS >= 60 &&
      input.movingS >= prefs.timeIntervalS
    ) {
      const bucket = Math.floor(input.movingS / prefs.timeIntervalS);
      if (bucket > this.lastAnnouncedTimeBucket) {
        this.lastAnnouncedTimeBucket = bucket;
        const text = buildEffortAnnouncementText({
          sport: input.sport,
          selection: input.selection,
          distanceM: input.distanceM,
          movingS: input.movingS,
          units,
          prefs,
          completedSplit: null,
        });
        if (text) {
          return this.dispatchAnnouncement(
            {
              dedupeKey: `effort:time:${bucket}`,
              priority: 4,
              category: 'effort',
              text,
            },
            nowMs,
            2_000,
          );
        }
      }
    }

    return null;
  }
}
