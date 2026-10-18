import { describe, expect, it } from 'vitest';
import { computeCoverage, matchRecord, scoreboardMarkdown, testsByEtape } from '../../scripts/compas/lib/coverage-core.mjs';

/**
 * Phase 7 — le rapport de couverture croise l'inventaire statique et ce que
 * les scénarios ont RÉELLEMENT fait dans le navigateur. Aucun faux 100 % :
 * un contrôle ne compte que s'il a été activé ET son effet vérifié.
 */
const ctl = (o: Record<string, unknown>) => ({
  classes: [],
  ancetres: [],
  delegue: undefined,
  ...o,
});
const inventory = {
  controles: [
    ctl({ id: 'S::A::button::close', etape: 'commun', nom: 'Fermer', motif: '^\\s*(?:Fermer)\\s*$', balise: 'button', role: 'button', classes: ['cp-ibtn'] }),
    ctl({ id: 'S::A::button::less', etape: 'depart', nom: '… : moins', motif: '^\\s*(?:.*?\\s*:\\s+moins)\\s*$', balise: 'button', role: 'button' }),
    ctl({ id: 'S::Ou::button::x', etape: 'ou', nom: '…', motif: '^\\s*(?:.*?)\\s*$', balise: 'button', role: 'button', ancetres: ['cp-stepper'] }),
    ctl({ id: 'S::Kit::button::y', etape: 'kit', nom: '…', motif: '^\\s*(?:.*?)\\s*$', balise: 'button', role: 'button', ancetres: ['cp-stepper'] }),
    ctl({ id: 'S::Kit::geste::glisser', etape: 'kit', nom: '[cp-row]', motif: '.*', balise: 'div', type: 'geste', geste: 'glisser', classes: ['cp-row'] }),
    ctl({ id: 'S::P::button::seg', etape: 'commun', nom: '…', motif: '.*', balise: 'button', role: 'button', delegue: true }),
    ctl({ id: 'S::A::input::range', etape: 'commun', nom: 'Verre', motif: '^\\s*(?:Verre)\\s*$', balise: 'input', role: 'slider', input: 'range' }),
  ],
};
const rec = (o: Record<string, unknown>) => ({ etape: 'ou', ancestorClasses: [], verified: true, scenario: 's', ...o });
const el = (o: Record<string, unknown>) => ({ tag: 'button', role: null, type: null, classes: [], name: '', ...o });

describe('matchRecord', () => {
  it('reconnaît un contrôle par balise, rôle, classes et nom', () => {
    const r = rec({ chain: [el({ classes: ['cp-ibtn', 'cp-glass'], name: 'Fermer' })] });
    expect(matchRecord(inventory.controles, r)).toEqual({ id: 'S::A::button::close' });
  });

  it('préfère le contrôle dont le nom est littéral à un nom calculé', () => {
    const r = rec({ etape: 'depart', ancestorClasses: [], chain: [el({ name: 'Durée : moins' })] });
    expect(matchRecord(inventory.controles, r)).toEqual({ id: 'S::A::button::less' });
  });

  it("départage deux noms calculés par l'étape, et refuse de choisir s'ils restent à égalité", () => {
    const inKit = rec({ etape: 'kit', ancestorClasses: ['cp-stepper'], chain: [el({ name: '2' })] });
    expect(matchRecord(inventory.controles, inKit)).toEqual({ id: 'S::Kit::button::y' });
    const elsewhere = rec({ etape: 'nous', ancestorClasses: ['cp-stepper'], chain: [el({ name: '2' })] });
    expect(matchRecord(inventory.controles, elsewhere)).toEqual({ ambigu: ['S::Ou::button::x', 'S::Kit::button::y'] });
  });

  it('remonte la chaîne (cible → parents) jusqu’à un contrôle connu, et ne crédite jamais une primitive déléguée', () => {
    const r = rec({ chain: [el({ tag: 'span', name: 'x' }), el({ tag: 'input', type: 'range', name: 'Verre' })] });
    expect(matchRecord(inventory.controles, r)).toEqual({ id: 'S::A::input::range' });
  });

  it('un geste ne correspond qu’à un contrôle « geste » du même type', () => {
    const swipe = rec({ etape: 'kit', gesture: 'glisser', chain: [el({ tag: 'div', classes: ['cp-row'], name: 'Gourde' })] });
    expect(matchRecord(inventory.controles, swipe)).toEqual({ id: 'S::Kit::geste::glisser' });
    const tap = rec({ etape: 'kit', chain: [el({ tag: 'div', classes: ['cp-row'], name: 'Gourde' })] });
    expect(matchRecord(inventory.controles, tap)).toBeNull();
  });

  it('ne crédite JAMAIS par ressemblance un contrôle au nom entièrement calculé, sans classe ni parent', () => {
    const anon = [ctl({ id: 'S::K::button::anonyme', etape: 'kit', nom: '…', motif: '^\\s*(?:.*?)\\s*$', balise: 'button', role: 'button' })];
    expect(matchRecord(anon, rec({ etape: 'kit', chain: [el({ name: 'Budget' })] }))).toBeNull();
    expect(matchRecord(anon, rec({ control: 'S::K::button::anonyme', chain: [] }))).toEqual({ id: 'S::K::button::anonyme' });
  });

  it("l'identifiant explicite d'un scénario prime, s'il existe", () => {
    expect(matchRecord(inventory.controles, rec({ control: 'S::Ou::button::x', chain: [] }))).toEqual({ id: 'S::Ou::button::x' });
    expect(matchRecord(inventory.controles, rec({ control: 'inconnu', chain: [] }))).toBeNull();
  });
});

describe('computeCoverage', () => {
  const registry = {
    'S::A::button::close': { scenario: 'commun › tiroir' },
    'S::A::button::less': { scenario: 'depart › préciser' },
    'S::Ou::button::x': { en_attente: 'lot Où' },
    'S::Kit::button::y': { raison_non_testable: 'paiement réel' },
    'S::Kit::geste::glisser': { scenario: 'kit › glisser' },
    'S::A::input::range': { scenario: 'commun › affichage' },
    'S::P::button::seg': { raison_non_testable: 'primitive' },
  };
  const records = [
    rec({ chain: [el({ classes: ['cp-ibtn'], name: 'Fermer' })] }),
    // Activé sans assertion : n'est PAS compté comme couvert.
    rec({ etape: 'depart', verified: false, chain: [el({ name: 'Durée : moins' })] }),
    rec({ chain: [el({ tag: 'a', name: 'Inconnu' })] }),
  ];
  const cov = computeCoverage({ inventory, records, registry });

  it('ne compte que les contrôles activés ET vérifiés ; les primitives déléguées sortent du total', () => {
    expect(cov.global.total).toBe(6);
    expect(cov.global.verifies).toBe(1);
    expect(cov.global.pourcentage).toBeCloseTo(16.7, 1);
    expect(cov.parEtape.commun).toMatchObject({ total: 2, verifies: 1 });
    expect(cov.parEtape.depart).toMatchObject({ total: 1, verifies: 0, sans_assertion: 1 });
  });

  it('liste chaque contrôle non exercé avec sa raison', () => {
    const why = Object.fromEntries(cov.nonExerces.map((c: { id: string; raison: string }) => [c.id, c.raison]));
    expect(why['S::Kit::button::y']).toMatch(/non testable : paiement réel/);
    expect(why['S::Ou::button::x']).toMatch(/en attente : lot Où/);
    expect(why['S::A::button::less']).toMatch(/activé sans assertion/);
    expect(why['S::Kit::geste::glisser']).toMatch(/déclaré couvert par « kit › glisser » mais non exercé/);
    expect(why['S::A::button::close']).toBeUndefined();
  });

  it('garde trace de ce qui n’a pu être rattaché à aucun contrôle', () => {
    expect(cov.nonReconnus).toHaveLength(1);
  });

  it('écrit un tableau de bord par étape (scénarios réussis / échoués, contrôles non couverts)', () => {
    const md = scoreboardMarkdown(cov, {
      commun: { passed: 2, failed: 0, skipped: 0 },
      kit: { passed: 0, failed: 1, skipped: 1 },
    });
    expect(md).toMatch(/\| Commun .*\| 2 \| 0 \| 0 \| 1 \/ 2 \| 50 % \|/);
    expect(md).toMatch(/\| Kit .*\| 0 \| 1 \| 1 \| 0 \/ 2 \| 0 % \|/);
    expect(md).toMatch(/Objectif : 100 %/);
  });
});

describe('testsByEtape', () => {
  it("range les résultats Playwright (rapport JSON) par l'étiquette @etape:… du titre", () => {
    const report = {
      suites: [
        {
          title: 'smoke.spec.ts',
          specs: [],
          suites: [
            {
              title: '@etape:ou fumée',
              specs: [{ title: 'ouvre Où', tests: [{ results: [{ status: 'passed' }] }] }],
              suites: [],
            },
            {
              title: '@etape:kit fumée',
              specs: [{ title: 'ouvre Kit', tests: [{ results: [{ status: 'failed' }, { status: 'passed' }] }] }],
              suites: [],
            },
          ],
        },
      ],
    };
    expect(testsByEtape(report)).toEqual({
      ou: { passed: 1, failed: 0, skipped: 0 },
      // Réussi au deuxième essai : compté comme instable, donc échoué (pas de faux vert).
      kit: { passed: 0, failed: 1, skipped: 0 },
    });
  });
});
