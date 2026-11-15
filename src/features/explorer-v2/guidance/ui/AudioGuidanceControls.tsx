'use client';

/**
 * Lot N01 / K4.02, K4.08, S1.07, S3.11 — Contrôles audio et TTS.
 *
 * Contrôlé par `AudioGuidancePreferences` : sortie (tout / casque / muet),
 * activations virage par virage, waypoints et hors-route, annonces d’effort par
 * sport, langue, débit et hauteur de voix. Le test de voix passe par
 * `SpeechSynthesisAdapter`, jamais par un appel direct à `window`.
 */

import React from 'react';
import {
  defaultEffortPreferencesForSport,
  type AudioGuidancePreferences,
  type AudioOutputChannel,
  type EffortAnnouncementPreferences,
  type SpeechSynthesisAdapter,
  type Sport,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import {
  GuidanceBadge,
  GuidanceButton,
  GuidancePanel,
  GuidancePanelHeader,
  GuidanceSegmented,
  GuidanceSwitch,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

type IntervalValue = 'off' | '300' | '600' | '1200';

const LANG_OPTIONS = [
  { value: 'fr-FR', label: 'Français' },
  { value: 'en-GB', label: 'English' },
  { value: 'es-ES', label: 'Español' },
] as const;

const TEST_SENTENCE = 'Guidage vocal prêt. Suivez le parcours en toute sécurité.';

function intervalToValue(seconds: number | null): IntervalValue {
  if (seconds === null) return 'off';
  if (seconds <= 300) return '300';
  if (seconds <= 600) return '600';
  return '1200';
}

function valueToInterval(value: IntervalValue): number | null {
  switch (value) {
    case 'off':
      return null;
    case '300':
      return 300;
    case '600':
      return 600;
    case '1200':
      return 1200;
  }
}

export interface AudioGuidanceControlsProps {
  preferences: AudioGuidancePreferences;
  sport: Sport;
  onChange?: (next: AudioGuidancePreferences) => void;
  /** Adaptateur injecté : `browserSpeechAdapter` en production, doublure en test. */
  speech?: SpeechSynthesisAdapter | null;
  onTestVoice?: (text: string) => void;
  className?: string;
}

export function AudioGuidanceControls({
  preferences,
  sport,
  onChange,
  speech = null,
  onTestVoice,
  className,
}: AudioGuidanceControlsProps) {
  const effort =
    preferences.effortBySport[sport] ?? defaultEffortPreferencesForSport(sport);
  const [voiceFeedback, setVoiceFeedback] = React.useState<string | null>(null);

  const update = (patch: Partial<AudioGuidancePreferences>) => {
    onChange?.({
      ...preferences,
      ...patch,
      effortBySport: {
        ...preferences.effortBySport,
        ...(patch.effortBySport ?? {}),
      },
    });
  };

  const updateEffort = (patch: Partial<EffortAnnouncementPreferences>) => {
    update({
      effortBySport: {
        ...preferences.effortBySport,
        [sport]: { ...effort, ...patch },
      },
    });
  };

  const supported = (() => {
    try {
      return Boolean(speech?.isSupported());
    } catch {
      return false;
    }
  })();
  const canTest = Boolean(onTestVoice) || supported;

  const testVoice = () => {
    if (!canTest) return;
    if (onTestVoice) {
      onTestVoice(TEST_SENTENCE);
    } else {
      try {
        speech?.speak(TEST_SENTENCE, {
          lang: preferences.lang,
          rate: preferences.rate,
          pitch: preferences.pitch,
        });
      } catch {
        setVoiceFeedback('La synthèse vocale a échoué sur cet appareil.');
        return;
      }
    }
    setVoiceFeedback('Test envoyé à la synthèse vocale.');
  };

  return (
    <GuidancePanel className={cx(styles.audioPanel, className)} ariaLabel="Guidage audio">
      <GuidancePanelHeader
        eyebrow="Audio"
        title="Guidage vocal"
        subtitle="Annonces virage par virage, repères et efforts, y compris hors ligne."
        action={
          <GuidanceBadge tone={preferences.channel === 'muted' ? 'warning' : 'success'} icon="vol">
            {preferences.channel === 'muted' ? 'Muet' : 'Actif'}
          </GuidanceBadge>
        }
      />

      <GuidanceSegmented<AudioOutputChannel>
        label="Sortie audio"
        value={preferences.channel}
        onChange={(channel) => update({ channel })}
        options={[
          { value: 'all', label: 'Tout' },
          { value: 'headphones_only', label: 'Casque' },
          { value: 'muted', label: 'Muet' },
        ]}
      />

      <div className={styles.stack} style={{ gap: 2 }}>
        <GuidanceSwitch
          label="Instructions virage par virage"
          hint="Annonces anticipées, approche et virage immédiat."
          checked={preferences.turnByTurnEnabled}
          onToggle={(next) => update({ turnByTurnEnabled: next })}
        />
        <GuidanceSwitch
          label="Alertes aux repères"
          hint="POI, refuges, points d’eau et highlights."
          checked={preferences.waypointAlertsEnabled}
          onToggle={(next) => update({ waypointAlertsEnabled: next })}
        />
        <GuidanceSwitch
          label="Alertes hors itinéraire"
          hint="Sortie de trace, recalcul et retour au tracé."
          checked={preferences.offRouteAlertsEnabled}
          onToggle={(next) => update({ offRouteAlertsEnabled: next })}
        />
      </div>

      <hr className={styles.divider} />

      <div className={styles.stack} style={{ gap: 2 }}>
        <p className={styles.sectionLabel}>Annonces pendant l’effort</p>
        <GuidanceSwitch
          label="Activer les annonces d’effort"
          hint="Distance, temps, allure ou vitesse selon le sport."
          checked={effort.enabled}
          onToggle={(next) => updateEffort({ enabled: next })}
        />
        <GuidanceSwitch
          label="À chaque split"
          hint="Kilomètre en métrique, mile en impérial."
          checked={effort.onEachSplit}
          onToggle={(next) => updateEffort({ onEachSplit: next })}
        />
      </div>

      <div className={styles.stack} style={{ gap: 6 }}>
        <p className={styles.sectionLabel}>Intervalle temporel</p>
        <GuidanceSegmented<IntervalValue>
          label="Intervalle des annonces d’effort"
          value={intervalToValue(effort.timeIntervalS)}
          onChange={(value) => updateEffort({ timeIntervalS: valueToInterval(value) })}
          options={[
            { value: 'off', label: 'Off' },
            { value: '300', label: '5 min' },
            { value: '600', label: '10 min' },
            { value: '1200', label: '20 min' },
          ]}
        />
      </div>

      <div className={styles.stack} style={{ gap: 2 }}>
        <GuidanceSwitch
          label="Annoncer la distance"
          checked={effort.announceDistance}
          onToggle={(next) => updateEffort({ announceDistance: next })}
        />
        <GuidanceSwitch
          label="Annoncer le temps"
          checked={effort.announceDuration}
          onToggle={(next) => updateEffort({ announceDuration: next })}
        />
        <GuidanceSwitch
          label={sport === 'velo' || sport === 'kayak' ? 'Annoncer la vitesse' : 'Annoncer l’allure'}
          checked={effort.announceRhythm}
          onToggle={(next) => updateEffort({ announceRhythm: next })}
        />
        <GuidanceSwitch
          label="Écart avec le split précédent"
          checked={effort.announceSplitDelta}
          onToggle={(next) => updateEffort({ announceSplitDelta: next })}
        />
      </div>

      <hr className={styles.divider} />

      <div className={styles.stack} style={{ gap: 8 }}>
        <p className={styles.sectionLabel}>Voix</p>
        <label className={styles.row} style={{ gap: 10 }}>
          <span className={styles.grow}>
            <span className={styles.switchLabel}>Langue</span>
          </span>
          <select
            className={styles.select}
            style={{ width: 160 }}
            value={preferences.lang}
            onChange={(event) => update({ lang: event.target.value })}
            aria-label="Langue de la synthèse vocale"
          >
            {LANG_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.rangeRow}>
          <span className={styles.rangeLabel}>Débit</span>
          <input
            className={styles.range}
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={preferences.rate}
            onChange={(event) => update({ rate: Number(event.target.value) })}
            aria-label="Débit de la voix"
          />
          <span className={styles.rangeValue}>{preferences.rate.toFixed(1)}×</span>
        </label>

        <label className={styles.rangeRow}>
          <span className={styles.rangeLabel}>Hauteur</span>
          <input
            className={styles.range}
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={preferences.pitch}
            onChange={(event) => update({ pitch: Number(event.target.value) })}
            aria-label="Hauteur de la voix"
          />
          <span className={styles.rangeValue}>{preferences.pitch.toFixed(1)}×</span>
        </label>
      </div>

      <GuidanceButton
        variant="secondary"
        fullWidth
        onClick={testVoice}
        disabled={!canTest}
      >
        <XpIcon name="vol" size={16} />
        {canTest ? 'Tester la voix' : 'Synthèse vocale indisponible'}
      </GuidanceButton>

      {voiceFeedback ? (
        <p className={styles.subtitle} role="status">
          {voiceFeedback}
        </p>
      ) : null}
    </GuidancePanel>
  );
}
