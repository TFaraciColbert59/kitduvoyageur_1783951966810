'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip } from '@/components/ui';
import { A_VERIFIER, formatMinutes, moneyLabel, stateLabel } from '../engine/trust';
import { adjustmentIds, previewAdjustment } from '../engine/adjustments';
import { daySteps, knownGaps, stepById } from '../engine/itinerary';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type {
  AdventurePrepDraft,
  AdjustmentId,
  ItineraryStep,
  ItineraryStepKind,
  MealSlot,
} from '../types';
import { MEAL_SLOT_LABELS } from '../types';

export interface ItinerarySheetProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
  onClose: () => void;
  stepId?: string | null;
}

const KIND_LABELS: Readonly<Record<ItineraryStepKind, string>> = {
  trajet: 'Trajet',
  arret: 'Arrêt',
  repos: 'Pause',
  nuit: 'Nuit',
  ravitaillement: 'Ravitaillement',
};

const STEP_ICONS: Readonly<Record<ItineraryStepKind, string>> = {
  trajet: 'route',
  arret: 'map-pin',
  repos: 'footprints',
  nuit: 'bed-double',
  ravitaillement: 'droplets',
};

const ADJUSTMENT_LABELS: Readonly<Record<AdjustmentId, string>> = {
  moins_cher: 'Moins cher',
  moins_de_transport: 'Moins de transport',
  plus_de_nature: 'Plus de nature',
  plus_tranquille: 'Plus tranquille',
  plus_de_decouvertes: 'Plus de découvertes',
};

function section(title: string, children: React.ReactNode) {
  return (
    <section style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
      <h3 className="prep-section-title">{title}</h3>
      {children}
    </section>
  );
}

function whenLabel(step: ItineraryStep): string {
  const time = step.startTime ?? 'Heure à vérifier';
  const duration = formatMinutes(step.durationMin);
  return `${time} · ${duration} sur place`;
}

/* ------------------------------------------------------------------ */
/* Detail d'une etape (A6)                                             */
/* ------------------------------------------------------------------ */

export function StepSheet({ draft, actions, onClose, stepId }: ItinerarySheetProps) {
  const model = draft.itinerary;
  const step = model && stepId ? stepById(model, stepId) : undefined;

  if (!model || !step) {
    return (
      <div>
        <p className="prep-note">Cette étape n’existe plus dans le programme.</p>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  const priceUnknown = step.price.amount === null;

  return (
    <div>
      <section className="prep-step" style={{ marginBottom: 20 }}>
        <div className="prep-step__head">
          <span className="prep-step__thumb">
            <Icon name={step.icon || STEP_ICONS[step.kind]} size={22} />
          </span>
          <div className="prep-step__body">
            <h4 className="prep-step__name">{step.title}</h4>
            <p className="prep-step__when">{whenLabel(step)}</p>
            {step.placeName && <p className="prep-step__reason">{step.placeName}</p>}
            {step.reason && <p className="prep-step__reason">{step.reason}</p>}
          </div>
          <span className="prep-step__price" data-state={step.price.state}>
            {moneyLabel(step.price)}
          </span>
        </div>
        <div className="prep-step__actions">
          <span className="prep-act__meta">{stateLabel(step.state)}</span>
          {step.kept && (
            <span className="prep-act__meta" style={{ color: 'var(--lkv-action)' }}>
              <Icon name="check" size={15} /> À conserver
            </span>
          )}
        </div>
      </section>

      {priceUnknown && (
        <p className="prep-note" data-tone="warn" style={{ marginBottom: 16 }}>
          Prix {A_VERIFIER.toLowerCase()} : aucun montant n’est inventé. Un clic sortant ne
          vaudra jamais réservation.
        </p>
      )}

      {section(
        'État',
        <p className="prep-block__hint" style={{ paddingInline: 0 }}>
          {stateLabel(step.state)} — proposé, retenu, à réserver ou confirmé selon les
          preuves disponibles.
        </p>,
      )}

      {section('Repas associé', (
        <div className="prep-cats">
          <Chip
            selected={step.mealSlot === null}
            onClick={() => actions.linkMeal(step.id, null)}
          >
            Aucun
          </Chip>
          {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (
            <Chip
              key={slot}
              selected={step.mealSlot === slot}
              onClick={() => actions.linkMeal(step.id, slot)}
            >
              {MEAL_SLOT_LABELS[slot]}
            </Chip>
          ))}
        </div>
      ))}

      <div className="prep-actionrow" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="md" onClick={onClose}>
          Fermer
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            actions.dropStep(step.id);
            onClose();
          }}
        >
          <Icon name="x" size={18} />
          Retirer
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Programme complet (A6)                                              */
/* ------------------------------------------------------------------ */

export function StepsSheet({ draft, actions, onClose }: ItinerarySheetProps) {
  const model = draft.itinerary;
  if (!model) {
    return (
      <div>
        <p className="prep-note">Le programme n’est pas encore généré.</p>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {Array.from({ length: model.days }, (_, index) => index + 1).map((day) => {
        const steps = daySteps(model, day);
        return (
          <section key={day} style={{ marginBottom: 20 }}>
            <h3 className="prep-section-title" style={{ marginBottom: 8 }}>
              Jour {day}
            </h3>
            {steps.length === 0 ? (
              <p className="prep-block__hint" style={{ paddingInline: 0 }}>
                Aucune étape proposée pour cette journée.
              </p>
            ) : (
              <ul className="prep-acts">
                {steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      className="prep-act"
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(
                          new CustomEvent('prep:focus-step', { detail: { stepId: step.id } }),
                        );
                      }}
                    >
                      <span className="prep-act__icon">
                        <Icon name={step.icon || STEP_ICONS[step.kind]} size={20} />
                      </span>
                      <span className="prep-act__name">
                        {step.startTime ? `${step.startTime} · ` : ''}
                        {step.title}
                      </span>
                      <span className="prep-act__meta">{KIND_LABELS[step.kind]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <div className="prep-actionrow" style={{ justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="md" onClick={onClose}>
          Fermer
        </Button>
      </div>
      <p className="prep-visually-hidden" aria-live="polite">
        {draft.itinerary?.steps.length ?? 0} étapes au programme
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ajuster (A6)                                                        */
/* ------------------------------------------------------------------ */

export function AdjustSheet({ draft, actions, onClose }: ItinerarySheetProps) {
  const model = draft.itinerary;
  const [pending, setPending] = useState<AdjustmentId | null>(null);
  const [freeText, setFreeText] = useState('');
  const [applied, setApplied] = useState<string | null>(null);

  const preview = useMemo(
    () => (model && pending ? previewAdjustment(model, pending) : null),
    [model, pending],
  );

  if (!model) {
    return (
      <div>
        <p className="prep-note">Ajuster un parcours n’a de sens qu’une fois le programme créé.</p>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {section('Réglage simple', (
        <ul className="prep-acts">
          {adjustmentIds().map((id) => (
            <li key={id}>
              <button
                type="button"
                className="prep-act"
                aria-pressed={pending === id}
                onClick={() => setPending(pending === id ? null : id)}
              >
                <span className="prep-act__icon">
                  <Icon name="sparkles" size={20} />
                </span>
                <span className="prep-act__name">{ADJUSTMENT_LABELS[id]}</span>
                {pending === id ? <Icon name="check" size={18} className="prep-act__check" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ))}

      {preview && (
        <div className="prep-note" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{preview.impact}</p>
          {preview.preservedStepIds.length > 0 && (
            <p style={{ margin: '6px 0 0' }}>
              {preview.preservedStepIds.length} étape(s) conservée(s) ou confirmée(s) ne bougent
              pas.
            </p>
          )}
        </div>
      )}

      {section('Ou en une phrase', (
        <input
          className="prep-block__row"
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          placeholder="Ex. moins de route, plus de forêt"
          aria-label="Ajustement libre en une phrase"
        />
      ))}

      {applied && (
        <p className="prep-note" role="status" style={{ marginBottom: 14 }}>
          {applied}
        </p>
      )}

      <div className="prep-actionrow" style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="md" onClick={onClose}>
          Garder l’actuel
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={!preview && freeText.trim().length < 2}
          onClick={() => {
            if (preview) {
              actions.adjust(preview.id);
              setApplied(`${ADJUSTMENT_LABELS[preview.id]} — ${preview.impact}`);
            } else {
              // Un ajustement libre est enregistré comme intention : aucune
              // réorganisation n'est inventée sans moteur derrière.
              setApplied(
                `« ${freeText.trim()} » sera pris en compte au prochain calcul. Aucun changement n'est appliqué à l'aveugle.`,
              );
            }
            setPending(null);
            setFreeText('');
          }}
        >
          Appliquer
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ajouter une etape (A6)                                             */
/* ------------------------------------------------------------------ */

const ADD_KINDS: readonly { id: ItineraryStepKind; label: string }[] = [
  { id: 'arret', label: 'Lieu' },
  { id: 'trajet', label: 'Trajet' },
  { id: 'nuit', label: 'Hébergement' },
  { id: 'ravitaillement', label: 'Ravitaillement' },
  { id: 'repos', label: 'Pause' },
];

export function AddStepSheet({ draft, actions, onClose }: ItinerarySheetProps) {
  const model = draft.itinerary;
  const [kind, setKind] = useState<ItineraryStepKind>('arret');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [day, setDay] = useState(1);
  const [meal, setMeal] = useState<MealSlot | null>(null);

  if (!model) {
    return (
      <div>
        <p className="prep-note">Il faut d’abord un programme pour y ajouter une étape.</p>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" size="md" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  const gaps = knownGaps(model);

  return (
    <div>
      {section('Nature de l’étape', (
        <div className="prep-cats">
          {ADD_KINDS.map((option) => (
            <Chip key={option.id} selected={kind === option.id} onClick={() => setKind(option.id)}>
              {option.label}
            </Chip>
          ))}
        </div>
      ))}

      {section('Intitulé', (
        <input
          className="prep-block__row"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex. Pause au viewpoint"
          aria-label="Intitulé de l'étape"
        />
      ))}

      {section('Lieu (facultatif)', (
        <input
          className="prep-block__row"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          placeholder="Nom du lieu"
          aria-label="Lieu de l'étape"
        />
      ))}

      {section('Jour', (
        <div className="prep-days">
          {Array.from({ length: model.days }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              className="prep-day"
              aria-pressed={day === value}
              onClick={() => setDay(value)}
            >
              Jour {value}
            </button>
          ))}
        </div>
      ))}

      {section('Repas couvert (facultatif)', (
        <div className="prep-cats">
          <Chip selected={meal === null} onClick={() => setMeal(null)}>
            Aucun
          </Chip>
          {(Object.keys(MEAL_SLOT_LABELS) as MealSlot[]).map((slot) => (
            <Chip key={slot} selected={meal === slot} onClick={() => setMeal(slot)}>
              {MEAL_SLOT_LABELS[slot]}
            </Chip>
          ))}
        </div>
      ))}

      {gaps.length > 0 && (
        <p className="prep-note" style={{ marginBottom: 14 }}>
          {gaps.length} information(s) restent inconnues : rien n’est inventé pour les
          combler.
        </p>
      )}

      <div className="prep-actionrow" style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="md" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={title.trim().length < 2}
          onClick={() => {
            actions.addStepToDay(day, kind, {
              title: title.trim(),
              placeName: place.trim() || null,
              mealSlot: meal,
            });
            onClose();
          }}
        >
          Ajouter au parcours
        </Button>
      </div>
    </div>
  );
}