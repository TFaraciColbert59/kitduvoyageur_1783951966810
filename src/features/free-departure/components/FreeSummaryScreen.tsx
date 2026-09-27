'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Switch } from '@/components/ui';
import { shortActivityLabel } from '../engine/activityGuess';
import type { ActivityGuessConfidence } from '../engine/activityGuess';
import type { FreePrivacyId, FreePrivacyRow } from '../engine/privacy';
import { guessHeadline, NO_VALUE, type TracePoint } from '../engine/freeSession';
import { FreeActivityPickerSheet } from './FreeActivityPickerSheet';
import { FreeTraceMap } from './FreeTraceMap';

export interface FreeSummaryScreenProps {
  /** Activite retenue, ou `null` si rien n'est defendable. */
  label: string | null;
  /**
   * Icone du catalogue. Optionnelle : une identite inconnue ne doit pas
   * faire tomber l'ecran au moment ou l'utilisateur relit sa sortie.
   */
  activityIcon?: string;
  /** `true` = deduction moteur : le titre devient une question. */
  isGuess: boolean;
  /** Justification composee de mesures. `null` quand l'utilisateur a choisi. */
  justification: string | null;
  guessConfidence: ActivityGuessConfidence | null;
  /** Pourquoi aucune proposition n'est faite. `null` quand il y en a une. */
  unknownReason: string | null;
  duration: string;
  distance: string;
  elevation: string;
  trace: TracePoint[];
  /** Les deux lignes de vie privee, deja decidees par le moteur. */
  privacy: FreePrivacyRow[];
  onTogglePrivacy: (id: FreePrivacyId, checked: boolean) => void;
  /** Corrige l'activite retenue : elle est figee telle quelle. */
  onPickActivity: (activityId: string | null) => void;
  onClose: () => void;
  /** Activite deja retenue, pour que la feuille « Corriger » la coche. */
  currentActivityId?: string | null;
}

/** Etiquette du badge : une lecture incertaine se dit aussi. */
function badgeLabel(confidence: ActivityGuessConfidence | null): string {
  return confidence === 'incertaine' ? 'Proposition incertaine' : 'Proposé';
}

/**
 * Ecran 62 — l'apres, ou la sortie devient une donnee.
 *
 * C'est le seul ecran des trois ou l'IA parle. Elle parle donc comme une
 * proposition, avec la mesure qui l'a produite, et l'utilisateur tranche d'un
 * seul geste. Ce qui n'est pas partage ne s'active jamais : les deux lignes de
 * vie privee disent ce qu'elles font, y compris — surtout — quand elles ne
 * peuvent pas le faire.
 */
export function FreeSummaryScreen({
  label,
  activityIcon,
  isGuess,
  justification,
  guessConfidence,
  unknownReason,
  duration,
  distance,
  elevation,
  trace,
  privacy,
  onTogglePrivacy,
  onPickActivity,
  onClose,
  currentActivityId = null,
}: FreeSummaryScreenProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const shortLabel = label === null ? null : shortActivityLabel(label);
  const icon = activityIcon ?? 'route';
  const title = shortLabel === null ? 'Activité à confirmer' : guessHeadline(shortLabel, isGuess);

  return (
    <div className="adventure-prep free-departure">
      <div className="free-screen">
        <div className="prep-nav free-top">
          <span className="free-top__title">Activité terminée</span>
          <button type="button" className="free-close" onClick={onClose} aria-label="Revenir au hub">
            <Icon name="x" size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="prep-body free-body">
          <div>
            <h1 className="free-h1">{title}</h1>
            <p className="free-sub">
              {isGuess
                ? 'On l’a déduit de ton allure et du terrain. À toi de confirmer.'
                : shortLabel
                  ? 'Tu as choisi cette activité avant de partir.'
                  : unknownReason}
            </p>
          </div>

          <div className="free-metrics">
            <div className="free-metric">
              <p
                className="free-metric__value"
                data-unknown={duration === NO_VALUE ? 'true' : undefined}
              >
                {duration}
              </p>
              <p className="free-metric__label">Durée</p>
            </div>
            <div className="free-metric">
              <p
                className="free-metric__value"
                data-unknown={distance === NO_VALUE ? 'true' : undefined}
              >
                {distance}
              </p>
              <p className="free-metric__label">Distance</p>
            </div>
            <div className="free-metric">
              <p
                className="free-metric__value"
                data-unknown={elevation === NO_VALUE ? 'true' : undefined}
              >
                {elevation}
              </p>
              <p className="free-metric__label">Dénivelé +</p>
            </div>
          </div>

          <FreeTraceMap pillLabel="Ma trace" trace={trace} name="Ma trace" />

          {shortLabel ? (
            <div className="free-proposal">
              <span className="free-proposal__icon" aria-hidden="true">
                <Icon name={icon} size={20} />
              </span>
              <div className="free-proposal__body">
                <p className="free-proposal__title">{shortLabel}</p>
                {justification ? <p className="free-proposal__why">{justification}</p> : null}
              </div>
              {isGuess ? (
                <span className="free-badge" data-confidence={guessConfidence ?? 'proposee'}>
                  <Icon name="sparkles" size={13} aria-hidden="true" />
                  {badgeLabel(guessConfidence)}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* --- Vie privee : deux lignes, deux etats verifiables --------- */}
          <div className="free-privacy">
            {privacy.map((row) => (
              <div
                key={row.id}
                className="free-privacy__row"
                data-privacy={row.id}
                data-disabled={row.disabled ? 'true' : undefined}
                aria-disabled={row.disabled ? 'true' : undefined}
              >
                <Icon name={row.id === 'trace' ? 'lock' : 'share2'} size={17} aria-hidden="true" />
                <div className="free-privacy__text">
                  <span className="free-privacy__label">{row.label}</span>
                  <span className="free-privacy__hint">{row.hint}</span>
                  {/* `blockedReason` existe justement pour etre dit. Une bascule
                      grisee sans sa raison force l'utilisateur a deviner — et
                      « desactive » sans plus ne dit PAS s'il peut resoudre. */}
                  {row.blockedReason ? (
                    <span className="free-privacy__reason">{row.blockedReason}</span>
                  ) : null}
                </div>
                <Switch
                  checked={row.checked}
                  disabled={row.disabled}
                  onCheckedChange={(checked) => onTogglePrivacy(row.id, checked)}
                  aria-label={row.label}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="prep-footer free-actions free-actions--stack">
          <Button variant="primary" size="lg" fullWidth onClick={() => setPickerOpen(true)}>
            <Icon name="pencil" size={18} aria-hidden="true" />
            Corriger
          </Button>
        </div>

        <FreeActivityPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          activityId={currentActivityId}
          onPickActivity={(id) => {
            setPickerOpen(false);
            onPickActivity(id);
          }}
          title="C’était quoi ?"
          description="Corrige le type d’activité : il sera écrit dans ton carnet tel que tu le choisis."
        />
      </div>
    </div>
  );
}

export default FreeSummaryScreen;
