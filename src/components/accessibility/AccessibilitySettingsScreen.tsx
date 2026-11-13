'use client';

/**
 * Écran composite d'accessibilité (Lot O02-UI).
 *
 * Assemble les briques du lot : préférences persistables, audit de contraste
 * WCAG/RGAA et repères clavier. Il peut être monté dans un drawer Compte ou
 * dans une route dédiée sans dépendre d'un runtime serveur.
 */

import React, { useId } from 'react';
import { AccessibilityPreferencesPanel } from './AccessibilityPreferencesPanel';
import { AccessibilityStyles } from './AccessibilityStyles';
import {
  ContrastAuditTable,
  LKDV_CONTRAST_SAMPLES,
} from './ContrastAuditTable';
import { ScreenReaderAnnouncerProvider } from './LiveRegion';
import type { ContrastPairInput } from '@/features/accessibility';

export interface AccessibilitySettingsScreenProps {
  title?: string;
  intro?: string;
  /** Paires de contraste à auditer (par défaut les jetons LKDV). */
  contrastPairs?: ReadonlyArray<ContrastPairInput>;
  showContrastAudit?: boolean;
  showKeyboardHelp?: boolean;
  className?: string;
  contentId?: string;
}

const KEYBOARD_HELP: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'Tab / Maj+Tab', action: 'Parcourir les commandes ; le focus reste dans un drawer modal.' },
  { keys: 'Échap', action: 'Fermer le drawer ou effacer la sélection de la carte.' },
  { keys: 'Flèches', action: 'Déplacer la carte (Maj pour un pas plus grand).' },
  { keys: '+ / −', action: 'Zoomer ou dézoomer la carte.' },
  { keys: 'Origine', action: 'Recentrer la carte.' },
  { keys: 'Entrée / Espace', action: 'Activer l’élément sélectionné sur la carte.' },
];

export function AccessibilitySettingsScreen({
  title = 'Accessibilité',
  intro = 'Réglez le confort de lecture, le mouvement et le clavier. Chaque choix est conservé sur cet appareil et vérifié avec les seuils WCAG 2.2 AA/AAA et RGAA.',
  contrastPairs = LKDV_CONTRAST_SAMPLES,
  showContrastAudit = true,
  showKeyboardHelp = true,
  className,
  contentId = 'contenu-accessibilite',
}: AccessibilitySettingsScreenProps) {
  const titleId = useId();
  const keyboardId = useId();

  return (
    <ScreenReaderAnnouncerProvider>
      <div
        id={contentId}
        className={['lkdv-a11y-root', 'lkdv-a11y-screen', className].filter(Boolean).join(' ')}
        data-lkdv-accessibility-screen=""
        tabIndex={-1}
      >
        <AccessibilityStyles />
        <header className="lkdv-a11y-screen-head">
          <p className="lkdv-a11y-kicker">Le Kit du Voyageur · Accessibilité</p>
          <h1 id={titleId} className="lkdv-a11y-screen-title">
            {title}
          </h1>
          <p className="lkdv-a11y-lead">{intro}</p>
        </header>

        <AccessibilityPreferencesPanel titleAs="h2" />

        {showContrastAudit ? (
          <ContrastAuditTable
            pairs={contrastPairs}
            title="Contraste des couleurs"
            titleAs="h2"
          />
        ) : null}

        {showKeyboardHelp ? (
          <section className="lkdv-a11y-panel" aria-labelledby={keyboardId}>
            <header className="lkdv-a11y-panel-head">
              <p className="lkdv-a11y-kicker">Clavier</p>
              <h2 id={keyboardId} className="lkdv-a11y-title">
                Repères de navigation
              </h2>
              <p className="lkdv-a11y-lead">
                Les raccourcis ci-dessous fonctionnent quand la carte a le focus. Aucun panneau ne
                retient le focus : Échap rend toujours la main.
              </p>
            </header>
            <ul className="lkdv-a11y-kbd-list">
              {KEYBOARD_HELP.map((item) => (
                <li key={item.keys}>
                  <kbd className="lkdv-a11y-kbd">{item.keys}</kbd>
                  <span>{item.action}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ScreenReaderAnnouncerProvider>
  );
}

export default AccessibilitySettingsScreen;
