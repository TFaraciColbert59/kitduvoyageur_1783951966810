/**
 * LOT ETAPE 2 — deux defauts qui rendaient l ecran illisible ou inaccessible.
 *
 * 1. Un texte de developpement rendu HORS d un commentaire JSX s affiche a
 *    l ecran comme du contenu. C est arrive : trois phrases de conception
 *    (« Un appui long NE FABRIQUE pas de journee… ») se lisaient au-dessus du
 *    parcours. Le test echoue des qu une phrase de conception redevient du
 *    JSX vivant.
 *
 * 2. L etape 2 s auto-avancait des la generation reussie, ce qui la rendait
 *    invisible et son unique sortie (« Vers le depart ») inatteignable. La
 *    validation appartient au PIED de page, seul chemin autorise.
 *
 * Ces deux tests lisent la SOURCE et non le rendu : le premier est un defaut
 * de syntaxe JSX que le DOM ne peut pas distinguer d un contenu legitime, le
 * second un defaut d enchainement d etat que seul le store revele.
 *
 * Point de methode : on COMMENTE la source avant d y chercher un appel. Un
 * commentaire qui NOMME l appel interdit ne doit pas faire echouer le test
 * — ce serait tester la documentation, pas le comportement.
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const RAW = readFileSync(
  path.resolve(__dirname, '../components/ItineraryStep.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');

/** La source, commentaires retires : seul le CODE subsiste. */
const CODE = RAW
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** Le corps de startRun, de sa declaration a sa fermeture. */
function startRunBody(): string {
  const start = CODE.indexOf('const startRun = useCallback');
  expect(start).toBeGreaterThan(-1);
  const end = CODE.indexOf('}, []);', start);
  expect(end).toBeGreaterThan(start);
  return CODE.slice(start, end);
}

describe('ET2-1 — aucun texte de conception ne fuite a l ecran', () => {
  it('ET2-1-01: plus aucune phrase de conception en JSX vivant', () => {
    // Symptome : du texte brut hors de toute balise. Un `{/* */}` ferme puis
    // des mots en clair = une page de notes affichee au lecteur. On cherche
    // la MOINSIRE elle : elle ouvre le texte fuite et n existe nulle part
    // ailleurs dans le composant.
    expect(RAW).not.toMatch(/^\s{6,}Un appui long NE FABRIQUE/m);
  });

  it('ET2-1-02: la regle reste ecrite, mais dans le commentaire', () => {
    // Le comportement n a pas disparu : il est dit la ou il sert, et le
    // code dit vrai (`onAddWaypoint` n existe que sur un jour focus).
    expect(RAW).toContain('D1-D bis');
  });
});

describe('ET2-2 — l etape 2 ne s auto-avance plus', () => {
  it('ET2-2-01: la reussite de la generation ne valide pas l etape', () => {
    // Le reducer fait avancer `currentStep` des que l etape est satisfaite :
    // appeler `completeStep('itinerary')` depuis la generation suffisait a
    // faire disparaitre l ecran en moins d une seconde. Le parcours s
    // affichait, et la meme seconde l ecran changeait de page.
    expect(startRunBody()).not.toMatch(/completeStep\(\s*'itinerary'\s*\)/);
  });

  it('ET2-2-02: le pied de page valide et redirige, lui', () => {
    // Le correctif ne doit pas casser la sortie : sans ce `completeStep`, on
    // resterait bloque sur l etape 2 pour toujours. Un seul endroit decide.
    expect(CODE).toMatch(/completeStep\(\s*'itinerary'\s*\)/);
    expect(CODE).toMatch(/goToStep\(\s*'departure'\s*\)/);
  });

  it('ET2-2-03: la sortie est proposee, pas subie', () => {
    // Le pied propose « Vers le depart ». Si le mot disparait, l etape 2
    // devient un cul-de-sac : on ne pourrait plus rien en faire.
    expect(RAW).toContain('Vers le départ');
  });
});
