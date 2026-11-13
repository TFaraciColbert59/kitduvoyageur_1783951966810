'use client';

import React from 'react';
import { HeartPulse, ShieldCheck } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import type { HealthConsentScope, HealthConsentState } from '@/features/sensors';
import { READ_SCOPE_VIEWS, WRITE_SCOPE_VIEWS } from './healthScopeView';

export interface HealthConsentPanelProps {
  state: HealthConsentState;
  onToggle: (scope: HealthConsentScope, granted: boolean) => void;
  disabled?: boolean;
}

/**
 * Consentement P01 granulaire (S6.16) : chaque scope est accordé ou révoqué
 * indépendamment. Aucun « tout autoriser » ne masque les conséquences.
 */
export function HealthConsentPanel({ state, onToggle, disabled = false }: HealthConsentPanelProps) {
  const grantedCount = [...READ_SCOPE_VIEWS, ...WRITE_SCOPE_VIEWS].filter(
    (view) => state.grants[view.scope]?.granted,
  ).length;
  const readGranted = state.grants.workouts_read?.granted === true;
  const writeGranted = state.grants.workouts_write?.granted === true;

  return (
    <section className="lkdv-sensor-panel lkv-glass" aria-labelledby="lkdv-health-consent-title">
      <header className="lkdv-sensor-panel-head">
        <span className="lkdv-sensor-panel-ico" aria-hidden="true">
          <ShieldCheck size={17} />
        </span>
        <div>
          <h2 id="lkdv-health-consent-title">Consentement Santé</h2>
          <p>
            Politique {state.policyVersion}. Chaque autorisation se révoque seule, à tout moment.
          </p>
        </div>
        <span className="lkdv-sensor-consent-count" aria-live="polite">
          {grantedCount} / {READ_SCOPE_VIEWS.length + WRITE_SCOPE_VIEWS.length}
        </span>
      </header>

      <div className="lkdv-sensor-consent-summary">
        <span data-granted={readGranted}>
          <HeartPulse size={14} aria-hidden="true" />
          Lecture des séances {readGranted ? 'autorisée' : 'non autorisée'}
        </span>
        <span data-granted={writeGranted}>
          Écriture des séances {writeGranted ? 'autorisée' : 'non autorisée'}
        </span>
      </div>

      {(['read', 'write'] as const).map((group) => {
        const views = group === 'read' ? READ_SCOPE_VIEWS : WRITE_SCOPE_VIEWS;
        return (
          <div className="lkdv-sensor-consent-group" key={group}>
            <h3>{group === 'read' ? 'Lecture' : 'Écriture'}</h3>
            <ul>
              {views.map((view) => {
                const granted = state.grants[view.scope]?.granted === true;
                return (
                  <li key={view.scope} data-granted={granted}>
                    <div className="lkdv-sensor-consent-copy">
                      <b>{view.label}</b>
                      <p>{view.description}</p>
                      {view.conditional ? (
                        <small>Demandé uniquement si la séance contient cette donnée.</small>
                      ) : null}
                    </div>
                    <Switch
                      checked={granted}
                      onCheckedChange={(checked) => onToggle(view.scope, checked)}
                      disabled={disabled}
                      aria-label={`${view.label} : ${granted ? 'autorisé' : 'refusé'}`}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <p className="lkdv-sensor-panel-note">
        Les données Santé ne quittent l’appareil que pour la séance que vous enregistrez. Un refus
        laisse la séance LKDV intacte.
      </p>
    </section>
  );
}

export default HealthConsentPanel;
