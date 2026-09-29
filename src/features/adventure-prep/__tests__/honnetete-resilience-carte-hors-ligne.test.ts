/**
 * Honnetete (resilience) - le bandeau hors ligne ne promet aucune carte.
 *
 * LE MENSONGE, verbatim, tel qu'il etait ecrit dans `resilience.ts` :
 *
 *   resume    : « 3 etapes enregistrees - le programme, la carte et les
 *                etapes restent sur cet appareil, lisibles sans reseau. »
 *   plan B    : « Ton parcours reste lisible hors ligne, comme la carte
 *                telechargee. »
 *
 * CE QUI EST VRAI, verifie dans le depot et non suppose :
 *
 *   1. `public/sw.js` met bien les tuiles en cache, mais cache-first a la
 *      VOLONTAIRE : ce qui a ete consulte en ligne. Borne FIFO a 3000
 *      entrees, donc evacueable. Rien ne garantit la couverture d'une zone.
 *   2. Le seul telechargement de carte du produit est
 *      `src/hooks/useOfflineDownload.ts`, et il n'est branche qu'a deux
 *      ecrans : `src/app/hors-ligne/page.tsx` et
 *      `src/components/explorer/TrailDetailPanel.tsx`.
 *   3. Le preparateur n'appelle `useOfflineDownload` nulle part, et
 *      `offlineReadiness` est une fonction PURE : elle n'a aucun acces a
 *      l'etat de ces downloads. Elle ne peut donc pas dire « la carte est la ».
 *
 * La conclusion n'est pas « il n'y a aucune carte » : c'est « le bandeau
 * s'engage sur ce qui est REELLEMENT local, et nomme le statut reel de la
 * carte ». Une phrase qui met la carte dans la meme liste que le programme et
 * les etapes fait porter au lecteur un engagement que personne n'a pris.
 *
 * Ces tests lisent la SORTIE DU MOTEUR, pas le fichier source : une garde de
 * texte peut etre satisfaite par un commentaire, une sortie, elle, non.
 */
import { describe, expect, it } from 'vitest';
import { buildContingencies, offlineReadiness } from '../engine/resilience';
import { buildItinerary } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

const model = (overrides: Parameters<typeof fullDraft>[0] = {}): ItineraryModel => {
  const built = buildItinerary(fullDraft(overrides));
  if (!built) throw new Error('modele attendu');
  return built;
};

/**
 * TOUTES les phrases que ce moteur peut mettre devant la personne.
 *
 * On balaie les quatre combinaisons reseau x assistant, l'absence totale de
 * modele, et les sept plans B. Une garde qui n'inspecterait que le resume
 * laisserait passer le meme mensonge reecrit dans un plan B.
 */
function phrasesAffichees(): string[] {
  const entrees = [
    offlineReadiness({ model: model(), online: true, aiEnabled: true }),
    offlineReadiness({ model: model(), online: false, aiEnabled: true }),
    offlineReadiness({ model: model(), online: true, aiEnabled: false }),
    offlineReadiness({ model: model(), online: false, aiEnabled: false }),
    offlineReadiness({ model: null, online: false, aiEnabled: false }),
  ];
  return [
    ...entrees.map((entree) => entree.summary),
    ...entrees.flatMap((entree) => entree.unavailable.flatMap((a) => [a.label, a.reason])),
    ...buildContingencies(model()).flatMap((plan) => [plan.trigger, plan.action]),
  ];
}

/**
 * La promesse qu'aucune mecanique ne tient.
 *
 * Le motif se lit dans les deux sens : « carte telechargee » comme
 * « telechargee, la carte ». Les accents sont acceptes en classe de
 * caracteres pour qu'une reformulation orthographique ne fasse pas passer le
 * mensonge ; rien d'autre n'est tolere, car c'est le mot « telechargee » qui
 * affirme un acte d'octroi.
 */
const PROMESSE_DE_TELECHARGEMENT =
  /carte[^.!?]{0,80}t[eé]l[eé]charg[eé]e|t[eé]l[eé]charg[eé]e[^.!?]{0,80}carte/i;

function prometUnTelechargementDeCarte(phrase: string): boolean {
  return PROMESSE_DE_TELECHARGEMENT.test(phrase);
}

/**
 * La phrase qui ENGAGE sur ce qui est sur l'appareil.
 *
 * C'est la coordination qui ment, pas un mot isole : mettre la carte dans la
 * meme enumeration que le programme et les etapes lui fait promettre la meme
 * disponibilite a trois choses dont une ne la partage pas. On isole donc la
 * proposition qui porte l'engagement, et on exige qu'elle ne nomme que ce
 * qui est reellement local.
 */
function engagementDeLocalite(summary: string): string {
  return (
    summary
      .split(/[.—]/u)
      .find((clause) => /rest[ei]/u.test(clause) && /programme/u.test(clause)) ?? ''
  );
}

describe('resilience - aucune carte hors ligne n est promise', () => {
  it('RESP-H-00 : TEMOIN - les deux gardes voient le mensonge d aujourd hui', () => {
    // Les deux verbatims relus dans `resilience.ts` au moment de l'ecriture de
    // ce fichier. Ils doivent etre captes : sinon les tests ci-dessous ne
    // prouvent rien, et le fichier peut disparaitre sans qu'on le voie.
    const resumeMensonger =
      '3 étapes enregistrées — le programme, la carte et les étapes restent sur cet appareil, lisibles sans réseau.';
    const planBMensonger = 'Ton parcours reste lisible hors ligne, comme la carte téléchargée.';

    expect(
      prometUnTelechargementDeCarte(planBMensonger),
      'le temoin ne prouve rien : le plan B menteur passe'
    ).toBe(true);
    expect(
      prometUnTelechargementDeCarte(resumeMensonger),
      'le temoin ne prouve rien : le resume menteur passe pour un telechargement'
    ).toBe(false);
    expect(
      engagementDeLocalite(resumeMensonger),
      'le temoin ne prouve rien : la carte echappe a l engagement'
    ).toContain('carte');
  });

  it('RESP-H-01 : aucune phrase affichee ne dit qu une carte a ete telechargee', () => {
    const coupables = phrasesAffichees().filter(prometUnTelechargementDeCarte);
    expect(coupables, 'une phrase promet un telechargement de carte qui n existe pas').toEqual([]);
  });

  it('RESP-H-02 : le resume n engage que sur ce qui est reellement local', () => {
    const resume = offlineReadiness({ model: model(), online: true, aiEnabled: true }).summary;
    const engagement = engagementDeLocalite(resume);

    // Anti-vacuite : si l extracteur ne retrouve rien, « la carte est absente
    // de l engagement » serait vrai par accident, pas par merite.
    expect(engagement, "l extracteur n'a pas trouve d engagement de localite").not.toBe('');
    expect(engagement).toContain('programme');
    expect(engagement).toContain('étapes');
    // Le coeur du correctif : la carte sort de la liste de ce qui « reste ».
    expect(engagement, 'la carte est encore engagee comme etant sur cet appareil').not.toContain(
      'carte'
    );
  });

  it('RESP-H-03 : le resume nomme le statut REEL de la carte au lieu de taire', () => {
    const resume = offlineReadiness({ model: model(), online: true, aiEnabled: true }).summary;

    // Taire la carte laisserait croire qu'elle est comprise dans le reste. La
    // doctrine du chantier impose l'inverse : nommer l'absence.
    expect(resume, 'la carte n est ni promise ni nommee').toMatch(/carte/iu);
    // Et son statut reel est une limite, pas un acquis.
    expect(resume).toMatch(/uniquement|seulement|que sur/iu);
  });

  it('RESP-H-04 : le plan B hors ligne dit la meme verite que le resume', () => {
    // Deux textes, un seul ecran : s ils divergent, l'un des deux ment. Le plan
    // B est celui que la personne lit EN CHEMIN, hors ligne, donc celui ou
    // une promesse de carte coute le plus cher.
    const horsLigne = buildContingencies(model()).find((plan) => plan.kind === 'hors_ligne');
    expect(horsLigne, 'le repli reseau a disparu').toBeDefined();
    expect(prometUnTelechargementDeCarte(horsLigne?.action ?? '')).toBe(false);
    // Le programme et les etapes, eux, restent reellement disponibles.
    expect(horsLigne?.action).toContain('étapes');
  });
});
