import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, fr } from '@/lib/i18n/translations';
import { AI_NOTICE_DONE, AI_NOTICE_RUN } from '@/features/compas/engine/aiNotice';
import { COMPAS_STEPS_SAME_IN_EN } from '@/lib/i18n/translations/compas-steps.en';
import {
  COMPAS_ENGINE_MIXED_FILES,
  COMPAS_I18N_FILES,
  COMPAS_SERVER_I18N_FILES,
  findFrenchLiterals,
  findFrenchMessages,
  flattenKeys,
  placeholders,
} from '../../scripts/i18n/compas-coverage.mjs';

/**
 * PLAN-100 phase 6 « Monde », lot 1 : l'espace de noms `compas` du système i18n.
 * Échoue si une clé FR n'a pas son équivalent EN (ou l'inverse), si un gabarit
 * perd un placeholder, ou si un fichier extrait garde une chaîne française en dur.
 */

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

const flatFr = flattenKeys(fr.compas as Record<string, unknown>, 'compas') as Record<
  string,
  string
>;
const flatEn = flattenKeys(en.compas as Record<string, unknown>, 'compas') as Record<
  string,
  string
>;

describe('i18n Compas — dictionnaires FR / EN', () => {
  it('chaque clé FR a son équivalent EN, et inversement', () => {
    const onlyFr = Object.keys(flatFr).filter((k) => !(k in flatEn));
    const onlyEn = Object.keys(flatEn).filter((k) => !(k in flatFr));
    expect(onlyFr, 'clés FR sans EN').toEqual([]);
    expect(onlyEn, 'clés EN sans FR').toEqual([]);
    expect(Object.keys(flatFr).length).toBeGreaterThan(40);
  });

  it('aucune valeur vide, et les placeholders sont les mêmes dans les deux langues', () => {
    for (const [key, value] of Object.entries(flatFr)) {
      expect(value.trim(), `FR vide : ${key}`).not.toBe('');
      expect(flatEn[key]?.trim(), `EN vide : ${key}`).not.toBe('');
      expect(placeholders(flatEn[key]), `placeholders : ${key}`).toEqual(placeholders(value));
    }
  });

  it('l’anglais est une traduction : seuls les noms propres et la mention imposée restent identiques', () => {
    const allowed: readonly string[] = COMPAS_STEPS_SAME_IN_EN;
    const same = Object.keys(flatFr).filter((k) => flatFr[k] === flatEn[k] && !allowed.includes(k));
    // « Powered by Geoapify » : formule exigée par les conditions du service ; « auto » : même mot.
    expect(same.sort()).toEqual(['compas.credit.geoapify', 'compas.start.auto']);
  });

  it('typographie française : apostrophe courbe, pas d’apostrophe droite', () => {
    for (const [key, value] of Object.entries(flatFr)) expect(value, key).not.toContain("'");
  });

  it('les mentions IA restent mot pour mot celles du moteur (pas de dérive)', () => {
    expect(fr.compas.ai.noticeRun).toBe(AI_NOTICE_RUN);
    expect(fr.compas.ai.noticeDone).toBe(AI_NOTICE_DONE);
  });

  it('chaque clé est employée dans le code du Compas, et chaque clé employée existe', () => {
    const join = (files: readonly string[]) =>
      files
        .filter((f) => fs.existsSync(path.join(root, f)))
        .map(read)
        .join('\n');
    const sources = join([...COMPAS_I18N_FILES, ...COMPAS_ENGINE_MIXED_FILES]);
    // Côté serveur, seules les clés `compas.server.…` comptent (`compas.xxxAction` y nomme un journal).
    const serverSources = join(COMPAS_SERVER_I18N_FILES);
    const used = new Set([
      ...[...sources.matchAll(/['"](compas\.[\w.]+)['"]/g)].map((m) => m[1]),
      ...[...serverSources.matchAll(/['"](compas\.server\.[\w.]*\w)['"]/g)].map((m) => m[1]),
    ]);
    const missing = [...used].filter((k) => !(k in flatFr));
    const unused = Object.keys(flatFr).filter((k) => !used.has(k));
    expect(missing, 'clés employées mais absentes').toEqual([]);
    expect(unused, 'clés jamais employées').toEqual([]);
  });
});

describe('i18n Compas — plus de français en dur dans le lot 1', () => {
  for (const file of COMPAS_I18N_FILES) {
    it(file, () => {
      expect(findFrenchLiterals(read(file))).toEqual([]);
    });
  }
});

describe('i18n Compas — messages serveur : plus de français en dur (6.1)', () => {
  for (const file of COMPAS_SERVER_I18N_FILES) {
    it(file, () => {
      expect(findFrenchMessages(read(file))).toEqual([]);
    });
  }

  it('repère une erreur, une note ou un refus en dur, ignore un journal', () => {
    const src = [
      "return { success: false, error: 'Lieu invalide' };",
      'notes.push(`Base du séjour.`);',
      "console.warn('[compas] étape introuvable');",
      "return actionError('compas.server.place.invalid');",
    ].join('\n');
    expect(findFrenchMessages(src).map((h) => h.line)).toEqual([1, 2]);
  });
});

describe('i18n Compas — l’heuristique détecte sans bloquer à tort', () => {
  it('voit le texte JSX, les attributs lus et les gabarits', () => {
    const src = [
      'const A = () => (',
      '  <nav aria-label="Étapes du Compas">',
      '    <button title={LOCKED}>Plus</button>',
      '    <p>',
      '      Ta position sert au trajet',
      '    </p>',
      '    <span>{`${label} : moins`}</span>',
      '  </nav>',
      ');',
      "const LOCKED = 'Disponible dès le premier choix';",
    ].join('\n');
    const texts = findFrenchLiterals(src).map((h) => h.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        'Étapes du Compas',
        'Plus',
        'Ta position sert au trajet',
        '${label} : moins',
        'Disponible dès le premier choix',
      ])
    );
  });

  it('ignore commentaires, imports, chemins, clés, attributs techniques et lignes marquées', () => {
    const src = [
      "import { AiNotice } from './AiNotice'; // Où ? ici",
      '/* Préparation : à venir */',
      '{/* Le navigateur demande la position */}',
      '<Icon name="plus" size={14} />',
      '<a href="/politique-confidentialite" className="cp-note cp-ai">{t(\'compas.ai.privacyLink\')}</a>',
      "router.push(`/connexion?next=${encodeURIComponent('/compas')}`);",
      '<a href="https://www.geoapify.com/">Powered by Geoapify</a>',
      "const sep = ' · '; // i18n-ok",
      "const x = 'Écrit à dessein'; // i18n-ok",
    ].join('\n');
    expect(findFrenchLiterals(src)).toEqual([]);
  });
});
