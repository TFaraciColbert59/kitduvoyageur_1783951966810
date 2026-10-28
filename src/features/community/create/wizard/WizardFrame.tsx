'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';

export interface WizardFrameProps {
  step: number;
  total: number;
  /** Nom court de l'étape (« Média », « Texte »…), affiché en capitales. */
  kicker: string;
  error?: string | null;
  busy?: boolean;
  nextLabel: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  /** Étape suivante, ou envoi sur la dernière étape. */
  onNext: () => void;
  children: React.ReactNode;
}

/**
 * Cadre commun d'une étape : en-tête (nom + n/total), corps qui remplit la
 * carte sans défiler, pied avec points de progression, retour et action.
 * Un `<form>` : la touche Entrée valide l'étape (hors zones de texte).
 */
export function WizardFrame({
  step,
  total,
  kicker,
  error,
  busy = false,
  nextLabel,
  nextDisabled = false,
  onBack,
  onNext,
  children,
}: WizardFrameProps) {
  return (
    <form
      className="lkdv-wz"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !nextDisabled) onNext();
      }}
    >
      <div className="lkdv-wz-head">
        <span className="lkdv-wz-kicker">{kicker}</span>
        <span className="lkdv-wz-count" aria-label={`Étape ${step + 1} sur ${total}`}>
          {step + 1}/{total}
        </span>
      </div>

      <div className="lkdv-wz-body" key={step}>
        {error ? (
          <p className="lkdv-wz-error" role="alert">
            {error}
          </p>
        ) : null}
        {children}
      </div>

      <div className="lkdv-wz-foot">
        <div className="lkdv-wz-dots" aria-hidden="true">
          {/* Au-delà de 8 étapes (carnet de plusieurs jours), le compteur n/total suffit. */}
          {total <= 8
            ? Array.from({ length: total }, (_, index) => <span key={index} data-on={index === step ? 'true' : 'false'} />)
            : null}
        </div>
        {step > 0 && onBack ? (
          <button type="button" className="lkdv-wz-back" aria-label="Étape précédente" onClick={onBack} disabled={busy}>
            <Icon name="chevron-left" size={18} aria-hidden="true" />
          </button>
        ) : null}
        <button type="submit" className="lkdv-wz-next" disabled={busy || nextDisabled}>
          {busy ? 'Envoi…' : nextLabel}
        </button>
      </div>
    </form>
  );
}

export default WizardFrame;
