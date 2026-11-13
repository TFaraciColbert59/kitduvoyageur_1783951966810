'use client';

/**
 * Écran/panneau de préférences d'accessibilité (Lot O02-UI).
 *
 * Toutes les valeurs passent par le contrat `@/features/accessibility` :
 * lecture/écriture localStorage versionnée, résolution système (`prefers-*`,
 * `forced-colors`), application au document (`data-*`, `--lkdv-text-scale`)
 * et annonce lecteur d'écran. Aucun état dupliqué hors du hook.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Switch } from '@/components/ui/Switch';
import {
  getNearestTextScalePreset,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  TEXT_SCALE_PRESETS,
  useAccessibilityPreferences,
  useScreenReaderAnnouncer,
  type AccessibilityPreferences,
  type ContrastPreferenceMode,
  type MotionPreferenceMode,
  type TextScalePreset,
} from '@/features/accessibility';
import { AccessibilityStyles } from './AccessibilityStyles';

const TEXT_SCALE_LABELS: Record<TextScalePreset, string> = {
  xs: 'Très petit',
  sm: 'Petit',
  md: 'Standard',
  lg: 'Grand',
  xl: 'Très grand',
  xxl: 'Maximum',
};

const CONTRAST_OPTIONS: ReadonlyArray<{
  value: ContrastPreferenceMode;
  label: string;
  description: string;
}> = [
  {
    value: 'system',
    label: 'Suivre le système',
    description: 'Respecte le contraste élevé et le mode couleurs forcées de l’appareil.',
  },
  {
    value: 'high',
    label: 'Contraste élevé',
    description: 'Renforce les bordures, les textes secondaires et l’anneau de focus.',
  },
  {
    value: 'standard',
    label: 'Contraste standard',
    description: 'Garde la palette habituelle, même si le système demande plus de contraste.',
  },
];

const MOTION_OPTIONS: ReadonlyArray<{
  value: MotionPreferenceMode;
  label: string;
  description: string;
}> = [
  {
    value: 'system',
    label: 'Suivre le système',
    description: 'Respecte « Réduire les animations » réglé sur l’appareil.',
  },
  {
    value: 'reduce',
    label: 'Réduire les animations',
    description: 'Coupe les transitions et les mouvements non essentiels.',
  },
  {
    value: 'no-preference',
    label: 'Animations normales',
    description: 'Conserve les transitions, même si le système les réduit.',
  },
];

const SCALE_PRESETS = Object.entries(TEXT_SCALE_PRESETS) as Array<[TextScalePreset, number]>;

export interface AccessibilityPreferencesPanelProps {
  title?: string;
  description?: string;
  /** Niveau du titre, pour intégrer le panneau dans un écran ou un drawer. */
  titleAs?: 'h1' | 'h2' | 'h3';
  showPreview?: boolean;
  /** Notifié après chaque écriture réussie (pas au premier rendu). */
  onPreferencesChange?: (preferences: AccessibilityPreferences) => void;
  className?: string;
  id?: string;
  footer?: ReactNode;
}

export function AccessibilityPreferencesPanel({
  title = 'Préférences d’accessibilité',
  description = 'Ces réglages restent sur cet appareil et s’appliquent à toute l’application. Ils ne remplacent pas les réglages système : ils les complètent.',
  titleAs = 'h2',
  showPreview = true,
  onPreferencesChange,
  className,
  id,
  footer,
}: AccessibilityPreferencesPanelProps) {
  const { preferences, updatePreferences, resetPreferences } = useAccessibilityPreferences();
  const { announce } = useScreenReaderAnnouncer();
  const titleId = useId();
  const descriptionId = useId();
  const scaleId = useId();
  const [status, setStatus] = useState<string | null>(null);
  const lastNotifiedRef = useRef(preferences);

  const Heading = titleAs;
  const nearestPreset = getNearestTextScalePreset(preferences.textScale);

  useEffect(() => {
    if (lastNotifiedRef.current === preferences) return;
    lastNotifiedRef.current = preferences;
    onPreferencesChange?.(preferences);
  }, [onPreferencesChange, preferences]);

  const commit = useCallback(
    (partial: Partial<AccessibilityPreferences>, message: string) => {
      updatePreferences(partial);
      setStatus(message);
      announce(message, { dedupeWindowMs: 250 });
    },
    [announce, updatePreferences],
  );

  const handleReset = useCallback(() => {
    resetPreferences();
    const message = 'Préférences d’accessibilité réinitialisées.';
    setStatus(message);
    announce(message, { dedupeWindowMs: 250 });
  }, [announce, resetPreferences]);

  const handleScale = useCallback(
    (value: number, announceChange = true) => {
      const clamped = Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));
      const label = TEXT_SCALE_LABELS[getNearestTextScalePreset(clamped)];
      updatePreferences({ textScale: clamped });
      setStatus(`Taille du texte : ${Math.round(clamped * 100)} % (${label}).`);
      if (announceChange) {
        announce(`Taille du texte : ${Math.round(clamped * 100)} pour cent.`, {
          dedupeWindowMs: 300,
        });
      }
    },
    [announce, updatePreferences],
  );

  return (
    <section
      id={id}
      className={['lkdv-a11y-root', 'lkdv-a11y-panel', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-lkdv-accessibility-preferences=""
    >
      <AccessibilityStyles />
      <header className="lkdv-a11y-panel-head">
        <p className="lkdv-a11y-kicker">Confort de lecture</p>
        <Heading id={titleId} className="lkdv-a11y-title">
          {title}
        </Heading>
        <p id={descriptionId} className="lkdv-a11y-lead">
          {description}
        </p>
      </header>

      <fieldset className="lkdv-a11y-section">
        <legend className="lkdv-a11y-legend">Contraste</legend>
        <p className="lkdv-a11y-help">
          Le mode élevé renforce les textes secondaires et les contours, sans changer la mise en
          page. Le mode couleurs forcées du système reste prioritaire.
        </p>
        <div className="lkdv-a11y-choices">
          {CONTRAST_OPTIONS.map((option) => {
            const checked = preferences.contrastMode === option.value;
            return (
              <label
                key={option.value}
                className="lkdv-a11y-choice"
                data-checked={checked ? 'true' : 'false'}
              >
                <input
                  type="radio"
                  name="lkdv-contrast-mode"
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    commit(
                      { contrastMode: option.value },
                      `Contraste : ${option.label.toLowerCase()}.`,
                    )
                  }
                />
                <span className="lkdv-a11y-choice-txt">
                  <span className="lkdv-a11y-choice-label">{option.label}</span>
                  <span className="lkdv-a11y-choice-desc">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="lkdv-a11y-section">
        <legend className="lkdv-a11y-legend">Animations</legend>
        <p className="lkdv-a11y-help">
          La réduction des animations coupe les transitions de l’application. Les changements
          d’état restent annoncés et les contenus restent visibles.
        </p>
        <div className="lkdv-a11y-choices">
          {MOTION_OPTIONS.map((option) => {
            const checked = preferences.motionMode === option.value;
            return (
              <label
                key={option.value}
                className="lkdv-a11y-choice"
                data-checked={checked ? 'true' : 'false'}
              >
                <input
                  type="radio"
                  name="lkdv-motion-mode"
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    commit({ motionMode: option.value }, `Animations : ${option.label.toLowerCase()}.`)
                  }
                />
                <span className="lkdv-a11y-choice-txt">
                  <span className="lkdv-a11y-choice-label">{option.label}</span>
                  <span className="lkdv-a11y-choice-desc">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="lkdv-a11y-section">
        <legend className="lkdv-a11y-legend">Taille du texte</legend>
        <p className="lkdv-a11y-help" id={`${scaleId}-help`}>
          Ajuste le texte de l’interface entre 85 % et 200 %. Les commandes restent au moins à
          44 px et aucun contenu n’est tronqué.
        </p>
        <div className="lkdv-a11y-scale-head">
          <label htmlFor={scaleId} className="lkdv-a11y-choice-label">
            Échelle typographique
          </label>
          <output htmlFor={scaleId} className="lkdv-a11y-scale-value">
            {Math.round(preferences.textScale * 100)} %
          </output>
        </div>
        <input
          id={scaleId}
          className="lkdv-a11y-range"
          type="range"
          min={MIN_TEXT_SCALE}
          max={MAX_TEXT_SCALE}
          step={0.05}
          value={preferences.textScale}
          aria-describedby={`${scaleId}-help`}
          aria-valuetext={`${Math.round(preferences.textScale * 100)} pour cent`}
          onChange={(event) => handleScale(Number(event.target.value), false)}
          onPointerUp={(event) => handleScale(Number(event.currentTarget.value))}
          onKeyUp={(event) => handleScale(Number(event.currentTarget.value))}
        />
        <div className="lkdv-a11y-presets" role="group" aria-label="Tailles de texte prédéfinies">
          {SCALE_PRESETS.map(([preset, value]) => (
            <button
              key={preset}
              type="button"
              className="lkdv-a11y-preset"
              aria-pressed={nearestPreset === preset}
              aria-label={`Taille ${TEXT_SCALE_LABELS[preset]}`}
              onClick={() => handleScale(value)}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="lkdv-a11y-section">
        <legend className="lkdv-a11y-legend">Assistance et clavier</legend>
        <p className="lkdv-a11y-help">
          Ces options décrivent les commandes aux lecteurs d’écran et rendent le focus plus
          visible. Elles n’enlèvent jamais l’accès au clavier.
        </p>

        <div className="lkdv-a11y-switch-row">
          <div className="lkdv-a11y-switch-txt">
            <Switch
              checked={preferences.screenReaderHints}
              onCheckedChange={(checked) =>
                commit(
                  { screenReaderHints: checked },
                  checked
                    ? 'Indices lecteur d’écran activés.'
                    : 'Indices lecteur d’écran désactivés.',
                )
              }
              label="Indices et descriptions enrichies"
            />
            <span className="lkdv-a11y-switch-desc">
              Ajoute le contexte utile (distance, dénivelé, état du panneau) aux libellés lus.
            </span>
          </div>
        </div>

        <div className="lkdv-a11y-switch-row">
          <div className="lkdv-a11y-switch-txt">
            <Switch
              checked={preferences.keyboardNavigation}
              onCheckedChange={(checked) =>
                commit(
                  { keyboardNavigation: checked },
                  checked
                    ? 'Raccourcis clavier de la carte activés.'
                    : 'Raccourcis clavier de la carte désactivés.',
                )
              }
              label="Raccourcis clavier de la carte"
            />
            <span className="lkdv-a11y-switch-desc">
              Flèches pour déplacer, + et − pour zoomer, Origine pour recentrer, Échap pour
              effacer la sélection.
            </span>
          </div>
        </div>

        <div className="lkdv-a11y-switch-row">
          <div className="lkdv-a11y-switch-txt">
            <Switch
              checked={preferences.enhancedFocusIndicator}
              onCheckedChange={(checked) =>
                commit(
                  { enhancedFocusIndicator: checked },
                  checked ? 'Anneau de focus renforcé.' : 'Anneau de focus standard.',
                )
              }
              label="Anneau de focus renforcé"
            />
            <span className="lkdv-a11y-switch-desc">
              Épaissit le contour du focus pour les personnes qui naviguent au clavier.
            </span>
          </div>
        </div>
      </fieldset>

      {showPreview ? (
        <section className="lkdv-a11y-section" aria-labelledby={`${titleId}-preview`}>
          <h3 id={`${titleId}-preview`} className="lkdv-a11y-legend">
            Aperçu
          </h3>
          <p className="lkdv-a11y-help">
            Le texte ci-dessous suit immédiatement l’échelle choisie ; les commandes gardent leur
            cible tactile.
          </p>
          <div
            className="lkdv-a11y-preview"
            data-testid="accessibility-preview"
            data-text-scale={nearestPreset}
            style={{ fontSize: `${preferences.textScale}rem` }}
          >
            Le chemin s’ouvre devant vous. <strong>Refuge du col, 2,4 km.</strong> Dénivelé positif
            340 m.
          </div>
        </section>
      ) : null}

      <button type="button" className="lkdv-a11y-reset" onClick={handleReset}>
        Réinitialiser les préférences
      </button>

      {status ? (
        <p className="lkdv-a11y-status" data-testid="accessibility-status">
          {status}
        </p>
      ) : null}

      {footer}
    </section>
  );
}

export default AccessibilityPreferencesPanel;
