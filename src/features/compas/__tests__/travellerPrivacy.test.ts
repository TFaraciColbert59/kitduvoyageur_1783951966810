import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { travellerPrivacyViolations } from '../../../../scripts/verify/traveller_privacy.mjs';

/**
 * Verrou de vie privée du profil voyageur (PLAN-100 4.1) : le dépôt est conforme,
 * et chaque fuite possible casse le verrou (dépôts factices dans un dossier temporaire).
 */
const roots: string[] = [];
function repo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lkdv-traveller-'));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const READ = "import { readTraveller } from '@/features/compas/server/traveller';\n";

describe('verrou de vie privée du profil voyageur', () => {
  it('le dépôt est conforme', () => {
    expect(travellerPrivacyViolations(process.cwd())).toEqual([]);
  });

  it('un composant public qui importe le lecteur casse le verrou', () => {
    expect(travellerPrivacyViolations(repo({ 'src/components/profil/PublicCard.tsx': READ }))).toEqual([
      'lecteur du profil voyageur importé par src/components/profil/PublicCard.tsx',
    ]);
  });

  it('même dans le Compas, un fichier « use client » ne lit jamais le profil', () => {
    const root = repo({ 'src/features/compas/components/Leak.tsx': `'use client';\nimport { readTraveller } from '../server/traveller';\n` });
    expect(travellerPrivacyViolations(root)).toEqual(['lecteur du profil voyageur importé par src/features/compas/components/Leak.tsx']);
  });

  it('le serveur du Compas et les deux pages du profil peuvent le lire', () => {
    const root = repo({
      'src/features/compas/server/autofillActions.ts': `'use server';\nimport { readTraveller } from './traveller';\n`,
      'src/app/compas/page.tsx': READ,
      'src/app/compte/voyageur/page.tsx': `${READ}import TravellerCard from '@/components/identity/TravellerCard';\n`,
      'src/components/identity/TravellerCard.tsx': `'use client';\nimport { saveTravellerAction } from '@/features/compas/server/travellerActions';\n`,
      'src/features/compas/components/CompasStart.tsx': `'use client';\nimport TravellerCard from '@/components/identity/TravellerCard';\n`,
      'src/server/gdprExport.ts': "const t = 'user_traveller';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });

  it('la table nommée ailleurs, une réexportation des actions, la carte montée ailleurs : refusées', () => {
    const root = repo({
      'src/features/trips/server/joinActivity.ts': "await service.from('user_traveller').select('*');\n",
      'src/components/profil/actions.ts': "export * from '../../features/compas/server/travellerActions';\n",
      'src/app/profil/[id]/page.tsx': "import TravellerCard from '@/components/identity/TravellerCard';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'carte du profil voyageur montée dans src/app/profil/[id]/page.tsx',
      'actions du profil voyageur importées par src/components/profil/actions.ts',
      'table user_traveller nommée hors du lecteur : src/features/trips/server/joinActivity.ts',
    ]);
  });

  it('l’IA et les partages ne reçoivent jamais le contexte voyageur brut', () => {
    const root = repo({
      'src/lib/ai/features/compasAutofill.ts': "import type { TravellerContext } from '@/features/compas/engine/traveller';\n",
      'src/app/k/[token]/page.tsx': "import { travellerView } from '@/features/compas/engine/traveller';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'contexte voyageur importé par src/app/k/[token]/page.tsx',
      'contexte voyageur importé par src/lib/ai/features/compasAutofill.ts',
    ]);
  });

  it('aucun journal dans le lecteur ni dans les actions', () => {
    const root = repo({ 'src/features/compas/server/travellerActions.ts': "'use server';\nconsole.info('profil', 1);\n" });
    expect(travellerPrivacyViolations(root)).toEqual(['journal interdit dans src/features/compas/server/travellerActions.ts']);
  });

  it('la ligne « Papiers » d’une nationalité ne se lit que dans le moteur des papiers et la lecture du Compas', () => {
    const root = repo({
      'src/features/compas/engine/papers.ts': 'export function readerPapersNotes() {}\nexport function notesForReader() {}\n',
      'src/features/compas/server/getCompasData.ts': "import { notesForReader } from '../engine/papers';\n",
      'src/features/compas/server/autofillActions.ts': "import { readerPapersNotes } from '../engine/papers';\n",
      'src/features/trips/server/shareTrip.ts': "import { notesForReader } from '@/features/compas/engine/papers';\n",
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      "ligne « Papiers » d'une nationalité nommée hors de la lecture : src/features/compas/server/autofillActions.ts",
      "ligne « Papiers » d'une nationalité nommée hors de la lecture : src/features/trips/server/shareTrip.ts",
    ]);
  });

  it('les notes de papiers brutes (celles d’une nationalité) ne se rangent pas sur le voyage ; filtrées de leur ligne « Papiers », oui', () => {
    const leak = repo({
      'src/features/compas/server/autofillActions.ts': 'const essential = [...papers.notes, ...safety];\n',
    });
    expect(travellerPrivacyViolations(leak)).toEqual([
      'notes de papiers brutes (nationalité) reprises dans src/features/compas/server/autofillActions.ts',
    ]);
    const kept = repo({
      'src/features/compas/server/autofillActions.ts':
        'const essential = [...shared, ...papers.notes.filter((n) => !isPapersNote(n)), ...safety];\n',
    });
    expect(travellerPrivacyViolations(kept)).toEqual([]);
  });

  it('un calcul qui lit le profil (formalités, appareils) ne se nomme que dans son moteur et la lecture', () => {
    const root = repo({
      'src/features/compas/server/autofillActions.ts':
        'const f = abroadCosts(abroad, entryRule);\nconst b = formalitiesBasis(null);\nconst e = entryFees(cc);\nconst d = frenchDevices(t);\n',
      'src/features/compas/engine/travel.ts': 'export function abroadCosts() {}\n',
      'src/features/compas/engine/costs.ts': 'export const formalitiesBasis = () => 1;\nexport const entryFees = () => 2;\n',
      'src/features/compas/engine/formalities.ts':
        "import { abroadCosts } from './travel';\nconst x = [abroadCosts, formalitiesBasis, entryFees];\n",
      'src/features/compas/engine/papers.ts': 'function frenchDevices() {}\nentryFees();\ntravelPapers();\n',
      'src/features/compas/server/getCompasData.ts': 'readerFormalities({});\nreaderPlugsNotes();\nnotesForReader();\n',
    });
    expect(travellerPrivacyViolations(root)).toEqual([
      'calcul dépendant du profil (abroadCosts) nommé hors de son moteur et de la lecture : src/features/compas/server/autofillActions.ts',
      'calcul dépendant du profil (formalitiesBasis) nommé hors de son moteur et de la lecture : src/features/compas/server/autofillActions.ts',
      'calcul dépendant du profil (entryFees) nommé hors de son moteur et de la lecture : src/features/compas/server/autofillActions.ts',
      'calcul dépendant du profil (frenchDevices) nommé hors de son moteur et de la lecture : src/features/compas/server/autofillActions.ts',
    ]);
  });

  it('un commentaire qui nomme ces calculs ne casse pas le verrou, une ligne de code le casse', () => {
    const doc = repo({
      'src/features/compas/server/autofillActions.ts':
        "// Les formalités (abroadCosts, entryFees) se lisent via readerFormalities.\n/**\n * frenchDevices, formalitiesBasis, keepAiNote\n */\nconst a = 1; // isFrenchNational\n",
    });
    expect(travellerPrivacyViolations(doc)).toEqual([]);
    const code = repo({ 'src/features/compas/server/autofillActions.ts': "const a = 1; // ok\nconst b = isFrenchNational(t);\n" });
    expect(travellerPrivacyViolations(code)).toEqual([
      'calcul dépendant du profil (isFrenchNational) nommé hors de son moteur et de la lecture : src/features/compas/server/autofillActions.ts',
    ]);
  });

  it('un conseil de l’IA n’est rangé qu’après le filtre sans profil (sharedRules)', () => {
    const ok = repo({
      'src/features/compas/server/autofillActions.ts':
        'const aiRules = sharedRules(cc, name, abroad);\nconst a = notes.filter((n) => keepAiNote(n, aiRules));\nconst b = notes.filter((n) => keepAiNote(n, sharedRules(cc, name, abroad)));\n',
    });
    expect(travellerPrivacyViolations(ok)).toEqual([]);
    const profile = repo({ 'src/features/compas/server/autofillActions.ts': 'const a = notes.filter((n) => keepAiNote(n, papers));\n' });
    expect(travellerPrivacyViolations(profile)).toEqual([
      "conseil de l'IA filtré avec d'autres règles que celles sans profil (sharedRules) dans src/features/compas/server/autofillActions.ts",
    ]);
    const lanceur = repo({
      'src/features/compas/server/autofillActions.ts':
        'const aiRules = rulesOf(traveller);\nconst a = notes.filter((n) => keepAiNote(n, aiRules));\n',
    });
    expect(travellerPrivacyViolations(lanceur)).toEqual(['aiRules ne vient pas de sharedRules dans src/features/compas/server/autofillActions.ts']);
    // Plusieurs lignes, arguments imbriqués : le second argument est bien lu.
    const multi = repo({
      'src/features/compas/server/autofillActions.ts': 'keepAiNote(\n  fn(a, b),\n  papers\n);\n',
    });
    expect(travellerPrivacyViolations(multi)).toHaveLength(1);
  });

  it('l’écriture du voyage ne lit du profil que le fuseau et le départ, et ne le passe jamais entier', () => {
    const ok = repo({
      'src/features/compas/server/autofillActions.ts': [
        "import { readTraveller } from './traveller';",
        'const [{ data: row }, profile, traveller] = await Promise.all([a, b, readTraveller(c)]);',
        'const today = travellerToday(zone, now, traveller.timeZone);',
        'const home = homeForLeg(a, b, traveller.home);',
        'const t = traveller?.home;',
      ].join('\n'),
    });
    expect(travellerPrivacyViolations(ok)).toEqual([]);
    const leak = repo({
      'src/features/compas/server/autofillActions.ts': [
        "import { readTraveller } from './traveller';",
        'const [t, traveller] = [1, await readTraveller(c)];',
        "const entry = entryFor(find, traveller.nationality, cc, abroad);",
        'const cur = traveller?.currency;',
        'const who = rules(a, traveller, b);',
      ].join('\n'),
    });
    // Étalé (`...traveller`), assigné ou rendu seul : le profil entier circule aussi.
    for (const line of ['const all = { ...traveller };', 'const same = traveller;', 'return { traveller };'])
      expect(
        travellerPrivacyViolations(
          repo({ 'src/features/compas/server/autofillActions.ts': `import { readTraveller } from './traveller';\n${line}\n` })
        ),
        line
      ).toEqual(["profil voyageur passé tel quel dans l'écriture du voyage : src/features/compas/server/autofillActions.ts"]);
    expect(travellerPrivacyViolations(leak)).toEqual([
      "valeur du profil (traveller.nationality) lue dans l'écriture du voyage : src/features/compas/server/autofillActions.ts",
      "valeur du profil (traveller.currency) lue dans l'écriture du voyage : src/features/compas/server/autofillActions.ts",
      "profil voyageur passé tel quel dans l'écriture du voyage : src/features/compas/server/autofillActions.ts",
    ]);
  });

  it('la lecture du Compas, elle, peut lire tout le profil du lecteur ; un fichier qui ne lit pas le profil n’est pas concerné', () => {
    const root = repo({
      'src/features/compas/server/getCompasData.ts':
        "import { readTraveller } from './traveller';\nconst traveller = await readTraveller(c);\nrules(traveller, traveller.nationality, traveller.currency);\n",
      'src/features/compas/server/rates.ts': 'export interface Targets {\n  traveller: string | null;\n}\nconst c = input.traveller;\n',
    });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });

  it('la consigne de l’IA ne reçoit aucun réglage : la nationalité ne part pas à un tiers', () => {
    const ok = repo({
      'src/lib/ai/features/compasAutofill.ts': 'export function buildCompasAutofillSystem(): string {\n  return "";\n}\n',
      'src/features/compas/server/autofillActions.ts': 'const s = buildCompasAutofillSystem();\nconst t = buildCompasAutofillSystem( );\n',
    });
    expect(travellerPrivacyViolations(ok)).toEqual([]);
    const leak = repo({
      'src/lib/ai/features/compasAutofill.ts': 'export function buildCompasAutofillSystem(frenchNational = false): string {\n  return "";\n}\n',
      'src/features/compas/server/autofillActions.ts': 'const s = buildCompasAutofillSystem(true);\n',
    });
    expect(travellerPrivacyViolations(leak)).toEqual([
      "consigne de l'IA réglée par un argument (la nationalité ne part pas à un tiers) : src/features/compas/server/autofillActions.ts",
      "consigne de l'IA réglée par un argument (la nationalité ne part pas à un tiers) : src/lib/ai/features/compasAutofill.ts",
    ]);
  });

  it('les tests ne comptent pas', () => {
    const root = repo({ 'src/features/compas/__tests__/x.test.ts': READ, 'src/components/x.spec.tsx': READ });
    expect(travellerPrivacyViolations(root)).toEqual([]);
  });
});
