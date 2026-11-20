// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompteOverlayHost } from '../CompteOverlayHost';
import { type BootstrapOverlayData, SealDrawer } from '../DetailDrawers';
import {
  EffortExpertDrawer,
  EffortFatigueDrawer,
  EffortGroupDrawer,
  EffortPrivacyDrawer,
  EffortWhyDrawer,
  haptic,
} from '../EffortSubDrawers';

const FORBIDDEN_VOCABULARY = [
  /\btier\b/i,
  /\brank\b/i,
  /\bgrade\b/i,
  /\bleaderboard\b/i,
  /\bpalier\b/i,
  /\bclassement\b/i,
  /\brang\b/i,
  /\bpercentile\b/i,
];

const FORBIDDEN_MEDICAL_TERMS = [
  /diagnostic/i,
  /pathologie/i,
  /hypothermie clinique/i,
  /hyperthermie/i,
  /tachycardie/i,
  /arythmie/i,
  /ischémie/i,
  /œdème/i,
  /prescription médicale/i,
];

const FORBIDDEN_BIOMETRIC_KEYS = [
  'weightkg',
  'vo2max',
  'hrrest',
  'hrmax',
  'hrv',
  'sleep',
  'birthyear',
  'flatspeedkmh',
];

const FULL_EFFORT_BOOTSTRAP: BootstrapOverlayData = {
  authenticated: true,
  profile: { name: 'Camille', handle: 'camille_rando', trustScore: 91 },
  stats: { outings: 14, km: 218.5, dplus: 11400 },
  badges: [],
  gearItems: [{ id: 'g1', name: 'Bâtons carbone' }],
  kits: [{ id: 'k1', name: 'Kit Alpin 3 saisons' }],
  followers: [{ id: 'f1' }, { id: 'f2' }],
  species: [{ id: 's1' }],
  trust: { verified: true, active: 1, onTimeRate: 100, rating: 4.9 },
  effortState: 'ready',
  effortDiagnosticId: 'DIAG-P4-20261120',
  effortCachedAt: '2026-11-20T09:30:00.000Z',
  lastOutingEffort: {
    title: 'Traversée du Pic de Bure',
    dateLabel: '18 nov. 2026',
    scoreVersion: 'effort-score-v1',
    snapshotHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    iea: 64,
    erp: 58,
    eFlatKm: 27.4,
    rawDose: 142.8,
    interval: { p10: 59, p50: 64, p90: 70 },
    technicite: 4,
    risque: {
      level: 'moderate',
      score: 48,
      dimensions: {
        exposure: 3,
        isolation: 3,
        weatherHazard: 2,
        terrainHazard: 3,
        turnaroundMarginS: 4500,
      },
      factors: ['Vigilance refroidissement : pause coupe-vent conseillée sur la crête sommitale'],
    },
    dataLevel: 'complet',
    actionPhrase: 'Prévois 1,8 L d’eau, les bâtons pour la descente du pierrier et un coupe-vent accessible au col.',
    shapley: {
      baseDistance: 22.0,
      ascent: 16.4,
      descent: 4.1,
      packLoad: 7.2,
      surfaceAndSnow: 6.5,
      thermalAndWind: 3.8,
      altitude: 2.4,
      fatigue: 1.6,
      total: 42.0,
    },
    multipliers: {
      load: 1.21,
      terrainEta: 1.35,
      thermal: 1.06,
      altitude: 1.09,
      fatigue: 1.05,
      descentEccentric: 1.12,
    },
    elevationSegments: [
      {
        segmentId: 1,
        label: 'Tronçon 1 · Approche forestière',
        distanceKm: 4.2,
        altitudeM: 1450,
        slopePct: 8.5,
        surface: 'dirt',
        intensityTone: 'good',
        intensityLabel: 'Modéré',
      },
      {
        segmentId: 2,
        label: 'Tronçon 2 · Combe de Bure',
        distanceKm: 3.8,
        altitudeM: 2150,
        slopePct: 18.4,
        surface: 'scree',
        intensityTone: 'warn',
        intensityLabel: 'Soutenu',
      },
      {
        segmentId: 3,
        label: 'Tronçon 3 · Plateau sommital venté',
        distanceKm: 2.5,
        altitudeM: 2709,
        slopePct: 11.2,
        surface: 'rock',
        intensityTone: 'bad',
        intensityLabel: 'Exigeant',
      },
    ],
    evidence: [
      {
        value: 2709,
        unit: 'm',
        source: 'IGN Géoplateforme RGE ALTI',
        kind: 'measured',
        quality: 0.98,
        capturedAt: '2026-11-18T14:20:00.000Z',
        licenceSnapshot: 'Licence Ouverte Etalab 2.0',
        modelVersion: 'effort-score-v1',
      },
      {
        value: 8.5,
        unit: 'm/s',
        source: 'Météo-France AROME',
        kind: 'measured',
        quality: 0.92,
        capturedAt: '2026-11-18T12:00:00.000Z',
        licenceSnapshot: 'Licence Ouverte Etalab 2.0',
        modelVersion: 'effort-score-v1',
      },
    ],
  },
  nextPlannedOutingEffort: {
    title: 'Boucle des Lacs de Crupillouse',
    departureLabel: 'Sam. 22 nov. · 07:30',
    iea: 52,
    erp: 49,
    eFlatKm: 21.0,
    interval: { p10: 46, p50: 52, p90: 58 },
    technicite: 3,
    dataLevel: 'cardio',
    actionPhrase: 'Départ conseillé avant 07:30 pour conserver 1 h 25 de marge avant le crépuscule.',
  },
  effortGroupSummary: {
    mode: 'regroupement',
    memberCount: 4,
    groupPaceKmH: 3.6,
    collectiveIea: 55,
    collectiveTechnicite: 3,
    actionPhrase: 'Organiser deux pauses coupe-vent de 4 min aux cols et répartir 2,0 kg d’eau commune.',
    twilightMarginMin: 85,
    regroupWaitMin: 11,
    coolingAlertRegroupement:
      'Vigilance refroidissement d’attente : attente estimée 11 min aux points de regroupement — veste coupe-vent dès l’arrêt conseillée.',
    coolingAlertCompact:
      'Mode Compact : allure calée sur le collectif, attente réduite à 2 min — maintien thermique régulier.',
    pauseEveryMinutes: 50,
    redistributionTransfers: 2,
    redistributionWeightKg: 2.0,
    cohesionLabel: 'Écart modéré',
    heatmapRows: [
      {
        memberLabel: 'Membre A',
        cells: [
          { segmentId: 1, segmentLabel: 'Tronçon 1', tone: 'good', textLabel: 'Confort · Allure fluide' },
          { segmentId: 2, segmentLabel: 'Tronçon 2', tone: 'warn', textLabel: 'Soutenu · Attente 4 min' },
        ],
      },
      {
        memberLabel: 'Membre B',
        cells: [
          { segmentId: 1, segmentLabel: 'Tronçon 1', tone: 'good', textLabel: 'Confort · Allure fluide' },
          { segmentId: 2, segmentLabel: 'Tronçon 2', tone: 'bad', textLabel: 'Vigilance · Pause col conseillée' },
        ],
      },
    ],
  },
  effortFatigueSummary: {
    status: 'available',
    formLabel: 'Charge productive',
    fitnessCtl: 44,
    fatigueAtl: 51,
    formTsb: -7,
    weeklyLoad: 320,
    activeDaysCount: 16,
    descriptiveGuidance:
      'Ta charge des 7 derniers jours est légèrement supérieure à ton habitude sur 6 semaines : privilégie une allure régulière dès le départ.',
    progressionHref: '/hub?panel=points',
  },
  effortPrivacySummary: {
    dataLevel: 'complet',
    evidence: [
      {
        value: 2709,
        unit: 'm',
        source: 'IGN Géoplateforme RGE ALTI',
        kind: 'measured',
        quality: 0.98,
        capturedAt: '2026-11-18T14:20:00.000Z',
        licenceSnapshot: 'Licence Ouverte Etalab 2.0',
        modelVersion: 'effort-score-v1',
      },
    ],
    consents: [
      {
        purpose: 'personal_scoring',
        title: 'Calcul personnel d’effort (IEA & ERP)',
        description: 'Calcul bioénergétique personnel',
        granted: true,
      },
      {
        purpose: 'wearable_sync',
        title: 'Synchronisation capteurs & montres (Cardio)',
        description: 'Fusion fréquence cardiaque',
        granted: true,
      },
      {
        purpose: 'group_simulation',
        title: 'Simulation collective de sortie de groupe',
        description: 'Allure collective sans biométrie',
        granted: false,
      },
      {
        purpose: 'anonymized_calibration',
        title: 'Calibration anonymisée des sentiers',
        description: 'Contribution agrégée k-anonyme',
        granted: false,
      },
    ],
  },
  effortExpertSummary: {
    scoreVersion: 'effort-score-v1',
    snapshotHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    iea: 64,
    erp: 58,
    eFlatKm: 27.4,
    rawDose: 142.8,
    multipliers: {
      load: 1.21,
      terrainEta: 1.35,
      thermal: 1.06,
      altitude: 1.09,
      fatigue: 1.05,
      descentEccentric: 1.12,
    },
    ablations: [
      { id: 'no-pack', label: 'Sans charge sac', iea: 56.8, deltaPts: -7.2 },
      { id: 'no-wind', label: 'Sans vent ni contrainte thermique', iea: 60.2, deltaPts: -3.8 },
    ],
    rawSegments: [
      {
        segmentId: 1,
        distanceM: 4200,
        altitudeM: 1450,
        slopePct: 8.5,
        surface: 'dirt',
        eta: 1.1,
        powerW: 410,
        doseDeff: 48.2,
      },
      {
        segmentId: 2,
        distanceM: 3800,
        altitudeM: 2150,
        slopePct: 18.4,
        surface: 'scree',
        eta: 1.35,
        powerW: 565,
        doseDeff: 94.6,
      },
    ],
  },
} as BootstrapOverlayData;

function assertNoForbiddenVocabulary(text: string) {
  for (const pattern of FORBIDDEN_VOCABULARY) {
    expect(text).not.toMatch(pattern);
  }
  for (const medicalPattern of FORBIDDEN_MEDICAL_TERMS) {
    expect(text).not.toMatch(medicalPattern);
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as any).__lkdvCompteOverlay;
  delete (window as any).Capacitor;
});

describe('Lot P4 — Niveau 0 : SealDrawer « Empreinte & Effort »', () => {
  it('conserve le radar 7 axes et affiche Dernière sortie, Prochaine sortie prévue, Technicité et Risque séparés', () => {
    render(<SealDrawer data={FULL_EFFORT_BOOTSTRAP} onClose={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Empreinte & Effort' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Radar 7 axes/i })).toBeTruthy();

    for (const axis of ['Sorties', 'Kilomètres', 'Dénivelé', 'Matériel', 'Kits', 'Espèces', 'Tribu']) {
      expect(screen.getByText(axis)).toBeTruthy();
    }

    expect(screen.getByTestId('effort-last-iea').textContent).toBe('64 %');
    expect(screen.getByTestId('effort-last-interval').textContent).toBe('[59 % – 70 %]');
    expect(screen.getByTestId('effort-last-erp').textContent).toBe('58 %');
    expect(screen.getByTestId('effort-last-eflat').textContent).toBe('27,4 km-effort');
    expect(screen.getByTestId('effort-last-data-level').textContent).toBe(
      'Niveau de données : Complet'
    );
    expect(screen.getByTestId('effort-last-action-phrase').textContent).toContain(
      'Prévois 1,8 L d’eau'
    );

    const techRegion = screen.getByRole('region', {
      name: /Technicité du parcours \(séparée du score d’effort\)/i,
    });
    expect(techRegion.textContent).toContain('4 / 5');

    const riskRegion = screen.getByRole('region', {
      name: /Vigilance terrain \(séparée du score d’effort\)/i,
    });
    expect(riskRegion.textContent).toContain('Vigilance refroidissement');

    expect(screen.getByTestId('effort-next-iea').textContent).toBe('52 %');
    expect(screen.getByTestId('effort-next-data-level').textContent).toBe(
      'Niveau de données : Cardio'
    );

    assertNoForbiddenVocabulary(document.body.textContent ?? '');
  });

  it('affiche « — » et « non évalué » sans aucun zéro trompeur sur un compte vide ou sealUnavailable', () => {
    const emptyData: BootstrapOverlayData = {
      stats: { outings: 0, km: 0, dplus: 0 },
      sealUnavailable: true,
    };
    render(<SealDrawer data={emptyData} onClose={() => {}} />);

    expect(screen.getByTestId('effort-last-iea').textContent).toBe('— (non évalué)');
    expect(screen.getByTestId('effort-last-interval').textContent).toBe('—');
    expect(screen.getByTestId('effort-last-erp').textContent).toBe('— (non évalué)');
    expect(screen.getByTestId('effort-last-eflat').textContent).toBe('—');
    expect(screen.getByTestId('effort-last-data-level').textContent).toBe(
      'Niveau de données : non évalué'
    );
    expect(screen.getByTestId('effort-last-technicite').textContent).toContain('non évalué');
    expect(screen.getByTestId('effort-last-risque').textContent).toContain('non évalué');

    expect(screen.getByTestId('effort-next-iea').textContent).toBe('—');
    expect(screen.getByTestId('effort-next-interval').textContent).toBe('—');
    expect(screen.getByTestId('effort-next-eflat').textContent).toBe('—');

    const lastCardText = screen.getByTestId('effort-last-outing-card').textContent ?? '';
    expect(lastCardText).not.toContain('0 %');
    expect(lastCardText).not.toContain('0 km');
    expect(lastCardText).not.toContain('0 / 5');
  });
});

describe('Lot P4 — Niveau 1 & Niveau 2 : 5 sous-drawers EffortSubDrawers', () => {
  it('1. effort-why : affiche les 6 facteurs Shapley sur la même échelle signée et le profil altimétrique avec accessibilityLayer + équivalent textuel', () => {
    render(
      <EffortWhyDrawer
        outing={FULL_EFFORT_BOOTSTRAP.lastOutingEffort}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Pourquoi ce score ?' })).toBeTruthy();
    const barsList = screen.getByTestId('shapley-bars-list');
    const minScale = barsList.getAttribute('data-scale-min');
    const maxScale = barsList.getAttribute('data-scale-max');
    expect(Number(minScale)).toBe(-Number(maxScale));

    const factorIds = [
      'pente-denivele',
      'charge-sac',
      'terrain-neige',
      'meteo-vent',
      'altitude-hypoxie',
      'duree-fatigue',
    ];
    for (const id of factorIds) {
      const node = screen.getByTestId(`shapley-factor-${id}`);
      expect(node.getAttribute('data-scale-shared')).toBe(`${minScale}:+${maxScale}`);
    }

    const a11yLayer = screen.getByTestId('elevation-accessibility-layer');
    expect(a11yLayer.getAttribute('data-accessibility-layer')).toBe('true');

    const textEquiv = screen.getByTestId('elevation-textual-equivalent');
    expect(textEquiv.textContent).toContain('Tronçon 1 · Approche forestière');
    expect(textEquiv.textContent).toContain('Intensité : Modéré');
    expect(textEquiv.textContent).toContain('Intensité : Exigeant');

    assertNoForbiddenVocabulary(document.body.textContent ?? '');
  });

  it('2. effort-group : affiche la synthèse, la marge crépuscule, l’alerte refroidissement (Regroupement vs Compact) et la heatmap avec libellé texte explicite sans biométrie', () => {
    render(
      <EffortGroupDrawer
        groupData={FULL_EFFORT_BOOTSTRAP.effortGroupSummary}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Sortie de groupe' })).toBeTruthy();
    expect(screen.getByTestId('group-twilight-margin').textContent).toContain(
      '+1 h 25 min avant crépuscule'
    );
    expect(screen.getByTestId('group-cooling-alert').textContent).toContain(
      'Mode Regroupement'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mode Compact' }));
    expect(screen.getByTestId('group-cooling-alert').textContent).toContain(
      'Mode Compact'
    );

    const cells = screen.getAllByTestId('group-heatmap-cell');
    expect(cells.length).toBe(4);
    for (const cell of cells) {
      expect((cell.textContent ?? '').trim().length).toBeGreaterThan(5);
    }

    const bodyLower = (document.body.textContent ?? '').toLowerCase();
    for (const biometricKey of FORBIDDEN_BIOMETRIC_KEYS) {
      expect(bodyLower).not.toContain(biometricKey);
    }
    assertNoForbiddenVocabulary(document.body.textContent ?? '');
  });

  it('3. effort-fatigue : affiche la vue descriptive CTL/ATL/TSB sans ratio ACWR anxiogène', () => {
    render(
      <EffortFatigueDrawer
        fatigueData={FULL_EFFORT_BOOTSTRAP.effortFatigueSummary}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Forme & fatigue' })).toBeTruthy();
    expect(screen.getByTestId('fatigue-ctl').textContent).toBe('44');
    expect(screen.getByTestId('fatigue-atl').textContent).toBe('51');
    expect(screen.getByTestId('fatigue-tsb').textContent).toBe('-7');
    expect(screen.getByTestId('fatigue-form-chip').textContent).toBe('Charge productive');

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/ACWR/i);
    expect(text).not.toMatch(/Ratio A:C/i);
    assertNoForbiddenVocabulary(text);
  });

  it('4. effort-privacy : affiche Niveau de données, Evidence<T>, les 4 interrupteurs avec confirmation explicite avant révocation, Export JSON et Effacement', () => {
    const onConsentChange = vi.fn();
    const onExportJson = vi.fn();
    const onDeleteEffortData = vi.fn();

    render(
      <EffortPrivacyDrawer
        privacyData={FULL_EFFORT_BOOTSTRAP.effortPrivacySummary}
        onConsentChange={onConsentChange}
        onExportJson={onExportJson}
        onDeleteEffortData={onDeleteEffortData}
        onClose={() => {}}
      />
    );

    expect(screen.getByTestId('privacy-data-level-badge').textContent).toBe(
      'Niveau de données : Complet'
    );
    expect(screen.getByTestId('privacy-evidence-list').textContent).toContain(
      'IGN Géoplateforme RGE ALTI'
    );
    expect(screen.getByTestId('privacy-evidence-list').textContent).toContain(
      'Licence Ouverte Etalab 2.0'
    );

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(4);

    // Tenter de révoquer personal_scoring (actuellement activé) : doit demander confirmation
    const personalRow = screen.getByTestId('consent-row-personal_scoring');
    const personalSwitch = within(personalRow).getByRole('switch');
    expect(personalSwitch.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(personalSwitch);
    expect(onConsentChange).not.toHaveBeenCalled();
    const confirmBox = screen.getByTestId('confirm-revoke-personal_scoring');
    expect(confirmBox).toBeTruthy();

    // Annuler garde le switch activé
    fireEvent.click(within(confirmBox).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByTestId('confirm-revoke-personal_scoring')).toBeNull();
    expect(personalSwitch.getAttribute('aria-checked')).toBe('true');

    // Ré-ouvrir et confirmer la révocation
    fireEvent.click(personalSwitch);
    const confirmBox2 = screen.getByTestId('confirm-revoke-personal_scoring');
    fireEvent.click(
      within(confirmBox2).getByRole('button', { name: 'Confirmer la révocation' })
    );
    expect(onConsentChange).toHaveBeenCalledWith('personal_scoring', false);
    expect(personalSwitch.getAttribute('aria-checked')).toBe('false');

    // Exporter mes données (JSON)
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données (JSON)' }));
    expect(onExportJson).toHaveBeenCalledOnce();

    // Effacer mes données d'effort (avec confirmation)
    fireEvent.click(screen.getByRole('button', { name: "Effacer mes données d'effort" }));
    expect(onDeleteEffortData).not.toHaveBeenCalled();
    const eraseBox = screen.getByTestId('confirm-erase-effort-data');
    fireEvent.click(
      within(eraseBox).getByRole('button', { name: 'Confirmer l’effacement définitif' })
    );
    expect(onDeleteEffortData).toHaveBeenCalledOnce();

    assertNoForbiddenVocabulary(document.body.textContent ?? '');
  });

  it('5. effort-expert (Niveau 2) : affiche score_version, snapshot_hash, équations LCDA/Pandolf/Péronnet/Hill, ablations et <figure role="group"> + <figcaption>', () => {
    render(
      <EffortExpertDrawer
        expertData={FULL_EFFORT_BOOTSTRAP.effortExpertSummary}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Mode expert' })).toBeTruthy();
    expect(screen.getByTestId('expert-score-version').textContent).toBe('effort-score-v1');
    expect(screen.getByTestId('expert-snapshot-hash').textContent).toBe(
      'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
    );

    const equationsText = screen.getByTestId('expert-reference-equations').textContent ?? '';
    expect(equationsText).toContain('LCDA');
    expect(equationsText).toContain('Pandolf (1976)');
    expect(equationsText).toContain('Péronnet (1991)');
    expect(equationsText).toContain('Hill');

    const figure = screen.getByTestId('expert-raw-figure');
    expect(figure.tagName.toLowerCase()).toBe('figure');
    expect(figure.getAttribute('role')).toBe('group');
    expect(figure.querySelector('figcaption')?.textContent).toContain('effort-score-v1');
    expect(screen.getByTestId('expert-raw-table').textContent).toContain('410');

    assertNoForbiddenVocabulary(document.body.textContent ?? '');
  });
});

describe('Lot P4 — Les 6 états UI, navigation pile CompteOverlayHost, Capacitor Android backButton & haptique', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => FULL_EFFORT_BOOTSTRAP,
        })
      )
    );
  });

  it('gère explicitement les 6 états : idle, loading (aria-busy="true"), ready, saving, error (ID diagnostic + Réessayer), offline (horodatage cache)', () => {
    const onRetry = vi.fn();

    const { rerender } = render(
      <SealDrawer
        data={FULL_EFFORT_BOOTSTRAP}
        effortStateOverride="loading"
        onClose={() => {}}
      />
    );
    const loadingEl = screen.getByTestId('effort-state-loading');
    expect(loadingEl.getAttribute('aria-busy')).toBe('true');

    rerender(
      <SealDrawer
        data={FULL_EFFORT_BOOTSTRAP}
        effortStateOverride="idle"
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('effort-state-idle')).toBeTruthy();

    rerender(
      <SealDrawer
        data={FULL_EFFORT_BOOTSTRAP}
        effortStateOverride="saving"
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('effort-state-saving').getAttribute('aria-busy')).toBe('true');

    rerender(
      <SealDrawer
        data={FULL_EFFORT_BOOTSTRAP}
        effortStateOverride="offline"
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('effort-state-offline').textContent).toContain(
      'Hors ligne — dernier cache :'
    );

    rerender(
      <SealDrawer
        data={FULL_EFFORT_BOOTSTRAP}
        effortStateOverride="error"
        onRetryEffort={onRetry}
        onClose={() => {}}
      />
    );
    const errCard = screen.getByTestId('effort-state-error');
    expect(errCard.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('effort-diagnostic-id').textContent).toContain(
      'DIAG-P4-20261120'
    );
    fireEvent.click(within(errCard).getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('dépile les sous-drawers via Escape et le bouton retour Capacitor Android avant tout history.back()', async () => {
    let capacitorBackHandler: ((info?: { canGoBack?: boolean }) => void) | null = null;
    const removeMock = vi.fn();
    (window as any).Capacitor = {
      Plugins: {
        App: {
          addListener: vi.fn((event: string, cb: (info?: { canGoBack?: boolean }) => void) => {
            if (event === 'backButton') capacitorBackHandler = cb;
            return { remove: removeMock };
          }),
        },
      },
    };
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(<CompteOverlayHost />);
    await waitFor(() => expect((window as any).__lkdvCompteOverlay).toBeTruthy());

    await act(async () => {
      (window as any).__lkdvOpenSeal();
    });
    expect(await screen.findByRole('heading', { name: 'Empreinte & Effort' })).toBeTruthy();

    // Ouvrir le sous-drawer Niveau 1 « Pourquoi ce score ? » depuis la carte
    await act(async () => {
      fireEvent.click(screen.getByTestId('open-subdrawer-effort-why'));
    });
    expect(await screen.findByRole('heading', { name: 'Pourquoi ce score ?' })).toBeTruthy();

    // 1er appui bouton retour Android : dépile le sous-drawer et revient à Niveau 0 sans appeler history.back()
    await act(async () => {
      capacitorBackHandler?.({ canGoBack: true });
    });
    expect(await screen.findByRole('heading', { name: 'Empreinte & Effort' })).toBeTruthy();
    expect(historyBackSpy).not.toHaveBeenCalled();

    // 2e appui bouton retour Android : dépile SealDrawer sans appeler history.back()
    await act(async () => {
      capacitorBackHandler?.({ canGoBack: true });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(historyBackSpy).not.toHaveBeenCalled();

    // 3e appui bouton retour Android (pile vide) : appelle history.back()
    await act(async () => {
      capacitorBackHandler?.({ canGoBack: true });
    });
    expect(historyBackSpy).toHaveBeenCalledOnce();
  });

  it('gère la navigation clavier (Escape, Tab / Shift+Tab focus trap) et les ponts window.__lkdvOpenEffort*', async () => {
    render(<CompteOverlayHost />);
    await waitFor(() => expect((window as any).__lkdvOpenSeal).toBeTruthy());

    await act(async () => {
      (window as any).__lkdvOpenSeal();
    });
    const level0Dialog = await screen.findByRole('dialog');
    expect(within(level0Dialog).getByRole('heading', { name: 'Empreinte & Effort' })).toBeTruthy();

    // Navigation par pont direct vers effort-group
    await act(async () => {
      (window as any).__lkdvOpenEffortGroup();
    });
    const groupDialog = await screen.findByRole('dialog');
    expect(within(groupDialog).getByRole('heading', { name: 'Sortie de groupe' })).toBeTruthy();
    expect(
      groupDialog.closest('.lkdv-compte-overlay')?.getAttribute('data-nested')
    ).toBe('true');

    // Focus trap Tab / Shift+Tab dans le dialogue
    const focusables = Array.from(
      groupDialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    expect(focusables.length).toBeGreaterThan(1);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(groupDialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(groupDialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Touche Escape ferme le sous-drawer et revient à Empreinte & Effort
    await act(async () => {
      fireEvent.keyDown(groupDialog, { key: 'Escape' });
    });
    expect(await screen.findByRole('heading', { name: 'Empreinte & Effort' })).toBeTruthy();

    // Événement DOM lkdv:backButton ferme le drawer Niveau 0
    await act(async () => {
      window.dispatchEvent(new CustomEvent('lkdv:backButton', { cancelable: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('respecte prefers-reduced-motion dans haptic() et protège navigator.vibrate', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    haptic(10);
    expect(vibrateMock).toHaveBeenCalledWith(10);

    vibrateMock.mockClear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    haptic(10);
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});
