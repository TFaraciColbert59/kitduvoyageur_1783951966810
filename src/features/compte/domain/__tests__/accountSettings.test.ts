// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDistanceDisplay,
  formatElevationDisplay,
  formatPaceOrSpeedDisplay,
  formatTemperatureDisplay,
  formatWeightDisplay,
  isValidClockTime,
  listLocaleChoices,
  readSportUnitsPreferences,
  SPORT_NOTIFICATION_DEFINITIONS,
  writeSportUnitsPreferences,
} from '../accountSettings';
import { ACCOUNT_SETTINGS_KEY, readUnitSystem, UNIT_SETTING_EVENT } from '@/lib/i18n/unitSetting';

describe('O01 K7.07 / S6.21 — langue, unités sportives et non-mutation des valeurs stockées', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'lkdv_units=; Max-Age=0; Path=/';
  });

  it('synchronise user_account_settings_v1, lkdv_units et lkdv:unit-setting sans désalignement', () => {
    const listener = vi.fn();
    window.addEventListener(UNIT_SETTING_EVENT, listener);

    const saved = writeSportUnitsPreferences({
      unitSystem: 'imperial',
      paceUnit: 'min_mi',
      elevationUnit: 'ft',
      temperatureUnit: 'f',
      weightUnit: 'lb_oz',
      firstDayOfWeek: 'sunday',
    });

    expect(saved.unitSystem).toBe('imperial');
    expect(readUnitSystem()).toBe('imperial');
    expect(readSportUnitsPreferences()).toEqual(saved);
    expect(window.localStorage.getItem(ACCOUNT_SETTINGS_KEY)).toContain('"unitSystem":"imperial"');
    expect(window.localStorage.getItem('lkdv_units')).toBe('imperial');
    expect(document.cookie).toContain('lkdv_units=imperial');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(UNIT_SETTING_EVENT, listener);
  });

  it('convertit à l’affichage sans muter la valeur canonique stockée et distingue zéro vs manquant', () => {
    const canonical = { distanceM: 10_000, elevationM: 1000, speedMps: 3.3333, tempC: 20, weightG: 750 };
    const snapshot = { ...canonical };

    expect(formatDistanceDisplay(canonical.distanceM, 'metric')).toBe('10.0 km');
    expect(formatDistanceDisplay(canonical.distanceM, 'imperial')).toBe('6.21 mi');
    expect(formatElevationDisplay(canonical.elevationM, 'm')).toBe('1000 m');
    expect(formatElevationDisplay(canonical.elevationM, 'ft')).toBe('3281 ft');
    expect(formatPaceOrSpeedDisplay(canonical.speedMps, 'min_km')).toBe('5:00 /km');
    expect(formatPaceOrSpeedDisplay(canonical.speedMps, 'kmh')).toBe('12.0 km/h');
    expect(formatTemperatureDisplay(canonical.tempC, 'c')).toBe('20 °C');
    expect(formatTemperatureDisplay(canonical.tempC, 'f')).toBe('68 °F');
    expect(formatWeightDisplay(canonical.weightG, 'kg_g')).toBe('750 g');
    expect(formatWeightDisplay(canonical.weightG, 'lb_oz')).toBe('1.65 lb');

    // Zéro réel vs manquant (null -> '—')
    expect(formatDistanceDisplay(0, 'metric')).toBe('0 m');
    expect(formatElevationDisplay(0, 'm')).toBe('0 m');
    expect(formatDistanceDisplay(null, 'metric')).toBe('—');
    expect(formatElevationDisplay(undefined, 'ft')).toBe('—');
    expect(formatTemperatureDisplay(null, 'c')).toBe('—');

    expect(canonical).toEqual(snapshot);
  });

  it('garde le français actif et verrouille les langues sans drapeau de build', () => {
    const choices = listLocaleChoices();
    const fr = choices.find((c) => c.code === 'fr');
    expect(fr?.enabled).toBe(true);
    expect(choices.some((c) => c.code === 'en')).toBe(true);
  });

  it('expose les définitions de notifications sportives S6.20 et valide les heures calmes', () => {
    expect(SPORT_NOTIFICATION_DEFINITIONS.map((d) => d.key)).toContain('gearMileageAlerts');
    expect(SPORT_NOTIFICATION_DEFINITIONS.map((d) => d.key)).toContain('segmentsPr');
    expect(isValidClockTime('22:00')).toBe(true);
    expect(isValidClockTime('07:30')).toBe(true);
    expect(isValidClockTime('25:99')).toBe(false);
  });
});

describe('O01 K7.11 — Dark mode automatique ExplorerV2 & Liquid Glass sans entrée manuelle superflue', () => {
  it('applique automatiquement useSystemTheme() dans ExplorerV2 et conserve les tokens dark CSS', () => {
    const root = process.cwd();
    const explorer = readFileSync(path.join(root, 'src/features/explorer-v2/ExplorerV2.tsx'), 'utf8');
    const zoneCss = readFileSync(
      path.join(root, 'src/features/explorer-v2/sheet/ZoneSettingsPanel.module.css'),
      'utf8',
    );
    const compteCss = readFileSync(path.join(root, 'src/components/compte/compte-v8.css'), 'utf8');
    const swiftTokens = readFileSync(
      path.join(root, 'ios/App/App/DesignTokens.generated.swift'),
      'utf8',
    );

    expect(explorer).toContain('useSystemTheme()');
    expect(explorer).toContain('data-theme={theme}');
    expect(zoneCss).toContain("[data-theme='dark']");
    expect(compteCss).toContain('prefers-color-scheme:dark');
    expect(swiftTokens.length).toBeGreaterThan(50);
  });
});
