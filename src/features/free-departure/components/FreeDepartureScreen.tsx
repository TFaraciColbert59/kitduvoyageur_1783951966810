'use client';

import React, { useCallback, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { activityById } from '@/features/adventure-prep/catalog';
import {
  LOCATION_PURPOSE,
  PERMISSION_LABELS,
  REFUSED_FALLBACK,
  type LocationPermission,
} from '../engine/location';
import { useFreeDepartureStore } from '../store/useFreeDepartureStore';
import { FreeActivityPickerSheet } from './FreeActivityPickerSheet';
import { FreeTraceMap } from './FreeTraceMap';

export interface FreeDepartureScreenProps {
  permission: LocationPermission;
  /** Demande l'autorisation — declenchee par l'appui sur « Demarrer ». */
  onRequestPermission: () => void;
  /** Lance le suivi. Ne redirige pas : l'ecran 61 prend le relais en place. */
  onStart: () => void;
  /** Ferme l'ecran et revient au hub. */
  onClose: () => void;
  /** Change l'activite (mode manuel, ou retour a la detection). */
  onPickActivity: (activityId: string | null) => void;
  /** Revient au mode « detection automatique ». */
  onUseAutoDetection: () => void;
}

/**
 * Ecran 60 — « Pret a partir ? », l'ecran d'avant.
 *
 * Il tient en quatre blocs et une seule action. Sa raison d'etre n'est pas de
 * demander des reglages : c'est de dire, AVANT la boite systeme, ce que
 * l'app fera de la position. Tant que ce paragraphe n'est pas dit, le bouton
 * « Demarrer » n'a pas le droit de declencher la demande.
 *
 * Aucun score, aucun pourcentage, aucune recommandation : ce retour est
 * mesure en temps, pas classe.
 */
export function FreeDepartureScreen({
  permission,
  onRequestPermission,
  onStart,
  onClose,
  onPickActivity,
  onUseAutoDetection,
}: FreeDepartureScreenProps) {
  const activityId = useFreeDepartureStore((state) => state.activityId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const manual = activityId === null ? null : activityById(activityId);
  // Nom COMPLET du catalogue avant le depart : on choisit une activite reelle,
  // pas un raccourci. Le nom court ne sert qu'apres, quand l'ecran doit tenir
  // en un titre, trois mesures et deux bascules.
  const manualLabel = manual?.label ?? null;

  const handleStart = useCallback(() => {
    // L'autorisation se demande ICI, au moment necessaire — jamais au montage.
    // Un refus laisse quand meme partir : il ne coute qu'une trace.
    if (permission === 'inconnue') onRequestPermission();
    onStart();
  }, [onRequestPermission, onStart, permission]);

  return (
    <div className="adventure-prep free-departure">
      <div className="free-screen">
        <div className="prep-nav free-top">
          <button type="button" className="free-close" onClick={onClose} aria-label="Revenir au hub">
            <Icon name="x" size={18} aria-hidden="true" />
          </button>
          <span className="free-top__title">Partir librement</span>
        </div>

        <div className="prep-body free-body">
          <div>
            <h1 className="free-h1">Prêt à partir ?</h1>
            <p className="free-sub">Aucun itinéraire : tu marches, on enregistre.</p>
          </div>

          {/* --- Comment l'activite sera determinee ---------------------- */}
          <ul className="free-modes" aria-label="Comment retenir l'activité">
            <li>
              <button
                type="button"
                className="free-mode"
                data-mode="auto"
                aria-pressed={activityId === null}
                onClick={onUseAutoDetection}
              >
                <span className="free-mode__icon" aria-hidden="true">
                  <Icon name="sparkles" size={20} />
                </span>
                <span className="free-mode__body">
                  <span className="free-mode__title">Détection automatique</span>
                  <span className="free-mode__hint">
                    L’activité est proposée à la fin, tu confirmes
                  </span>
                </span>
                <Icon name={activityId === null ? 'check-circle' : 'circle'} size={22} aria-hidden="true" />
              </button>
            </li>

            <li>
              <button
                type="button"
                className="free-mode"
                data-mode="manual"
                aria-pressed={activityId !== null}
                aria-haspopup="dialog"
                onClick={() => setPickerOpen(true)}
              >
                <span className="free-mode__icon" aria-hidden="true">
                  <Icon name="clipboard-list" size={20} />
                </span>
                <span className="free-mode__body">
                  <span className="free-mode__title">Je choisis l’activité</span>
                  {manualLabel ? (
                    <span className="free-mode__chosen">
                      {manualLabel} · Activité choisie par toi
                    </span>
                  ) : (
                    <span className="free-mode__hint">Randonnée, vélo, kayak…</span>
                  )}
                </span>
                <Icon name={activityId === null ? 'circle' : 'check-circle'} size={22} aria-hidden="true" />
              </button>
            </li>
          </ul>

          {manualLabel ? (
            <div className="free-chosen">
              <p className="free-chosen__note">
                {manualLabel} sera écrit dans ton carnet tel quel : la détection automatique ne
                l’écrasera pas.
              </p>
              <button type="button" className="free-chosen__undo" onClick={onUseAutoDetection}>
                <Icon name="rotate-ccw" size={15} aria-hidden="true" />
                Revenir à la détection
              </button>
            </div>
          ) : null}

          {/* --- Ce que la position va servir --------------------------- */}
          <div className="free-info">
            <span className="free-info__icon" aria-hidden="true">
              <Icon name="map-pin" size={20} />
            </span>
            <div>
              <p className="free-info__title">Ce que l’app fera de ta position</p>
              <p className="free-info__text">{LOCATION_PURPOSE}</p>
            </div>
          </div>

          {permission === 'refusee' ? (
            <div className="free-info" data-tone="warn">
              <span className="free-info__icon" aria-hidden="true">
                <Icon name="alert-circle" size={20} />
              </span>
              <div>
                <p className="free-info__title">{PERMISSION_LABELS.refusee}</p>
                <p className="free-info__text">{REFUSED_FALLBACK}</p>
              </div>
            </div>
          ) : null}

          {permission === 'indisponible' ? (
            <div className="free-info" data-tone="warn">
              <span className="free-info__icon" aria-hidden="true">
                <Icon name="alert-circle" size={20} />
              </span>
              <div>
                <p className="free-info__title">{PERMISSION_LABELS.indisponible}</p>
                <p className="free-info__text">
                  Tu pars quand même : le chrono tournera, la trace ne sera pas enregistrée.
                </p>
              </div>
            </div>
          ) : null}

          <FreeTraceMap
            pillLabel="Autour de moi"
            trace={[]}
            name="Autour de moi"
          />
        </div>

        <div className="prep-footer free-actions">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="prep-footer__primary"
            onClick={handleStart}
          >
            <Icon name="play" size={18} aria-hidden="true" />
            Démarrer
          </Button>
        </div>

        <FreeActivityPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          activityId={activityId}
          onPickActivity={onPickActivity}
          title="Quelle activité ?"
          description="Tu peux la changer jusqu’au départ. Sinon, LKDV la déduira de ton allure."
        />
      </div>
    </div>
  );
}

export default FreeDepartureScreen;


