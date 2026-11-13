'use client';

import React, { useSyncExternalStore } from 'react';
import { useLocale } from '@/lib/i18n/context';
import { enabledLocales, type Locale } from '@/lib/i18n/locale';
import type { UnitSystem } from '@/lib/i18n/region';
import {
  readUnitSystem,
  subscribeUnitSystem,
  writeAccountSettings,
  writeUnitSystem,
} from '@/lib/i18n/unitSetting';
import { useMeasurePrefs } from '@/lib/i18n/useMeasurePrefs';
import {
  formatDistanceIn,
  formatElevationIn,
  formatPaceIn,
  formatWeightIn,
} from '@/lib/i18n/measure';
import { OverlaySheet } from '../../overlay/OverlaySheet';
import './settingsSheets.css';

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
};

const UNIT_OPTIONS: ReadonlyArray<{ id: UnitSystem | null; label: string }> = [
  { id: null, label: 'Automatique' },
  { id: 'metric', label: 'Métrique' },
  { id: 'imperial', label: 'Impérial' },
];

const serverNull = () => null;

export function LanguageUnitsSheet({ onClose }: { onClose: () => void }) {
  const { locale, setLocale } = useLocale();
  const system = useSyncExternalStore(subscribeUnitSystem, readUnitSystem, serverNull);
  const prefs = useMeasurePrefs();
  const available = enabledLocales();
  const languageOptions = available.includes(locale) ? available : [locale, ...available];
  const [status, setStatus] = React.useState<string | null>(null);

  const chooseLocale = (next: Locale) => {
    if (next === locale) return;
    setLocale(next);
    writeAccountSettings({ language: next });
    setStatus(`Langue : ${LOCALE_LABELS[next]}.`);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const chooseUnits = (next: UnitSystem | null) => {
    writeUnitSystem(next);
    setStatus(
      next === null
        ? 'Unités : selon la région de la langue.'
        : `Unités : ${next === 'metric' ? 'métriques' : 'impériales'}.`
    );
    window.setTimeout(() => setStatus(null), 2200);
  };

  return (
    <OverlaySheet
      title="Langue et unités"
      subtitle="Affichage seulement : les valeurs stockées ne changent pas"
      onClose={onClose}
      nested
      className="lkdv-cp-settings-overlay"
    >
      <div className="lkdv-cp-settings-sheet">
        {status ? (
          <p className="lkdv-cp-settings-status is-ok" role="status">{status}</p>
        ) : null}

        <section className="lkdv-cp-settings-section" aria-labelledby="lkdv-cp-language">
          <h3 id="lkdv-cp-language">Langue</h3>
          <p>
            {available.length > 1
              ? 'Choisis la langue de l’interface. Le choix est conservé sur cet appareil et pour le serveur.'
              : 'Seul le français est activé dans cette version. Les autres langues apparaîtront quand leur traduction sera complète.'}
          </p>
          <div className="lkdv-cp-choice-group" role="group" aria-label="Langue de l’interface">
            {languageOptions.map((item) => (
              <button
                key={item}
                type="button"
                className="lkdv-cp-choice"
                aria-pressed={item === locale}
                onClick={() => chooseLocale(item)}
              >
                {LOCALE_LABELS[item]}
              </button>
            ))}
          </div>
          <p className="lkdv-cp-settings-note">
            La langue règle les textes et les séparateurs de nombres. Les unités peuvent rester
            indépendantes.
          </p>
        </section>

        <section className="lkdv-cp-settings-section" aria-labelledby="lkdv-cp-units">
          <h3 id="lkdv-cp-units">Unités</h3>
          <p>
            Distance et allure, altitude, poids. « Automatique » suit la région de la langue
            (France : métrique ; États-Unis : impérial).
          </p>
          <div className="lkdv-cp-choice-group" role="group" aria-label="Système d’unités">
            {UNIT_OPTIONS.map((option) => (
              <button
                key={option.id ?? 'auto'}
                type="button"
                className="lkdv-cp-choice"
                aria-pressed={system === option.id}
                onClick={() => chooseUnits(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="lkdv-cp-preview" role="group" aria-label="Aperçu des unités">
            <div>
              <small>Distance</small>
              <b>{formatDistanceIn(12.4, locale, { prefs })}</b>
            </div>
            <div>
              <small>Allure</small>
              <b>{formatPaceIn(500, locale, { prefs })}</b>
            </div>
            <div>
              <small>Altitude</small>
              <b>{formatElevationIn(1200, locale, { prefs })}</b>
            </div>
            <div>
              <small>Poids</small>
              <b>{formatWeightIn(1200, locale, { prefs })}</b>
            </div>
          </div>

          <p className="lkdv-cp-settings-note">
            Les valeurs enregistrées restent en kilomètres, mètres et grammes : seule leur
            écriture change. Changer d’unité ne modifie ni une sortie, ni un poids, ni une allure
            stockée.
          </p>
        </section>
      </div>
    </OverlaySheet>
  );
}

export default LanguageUnitsSheet;
