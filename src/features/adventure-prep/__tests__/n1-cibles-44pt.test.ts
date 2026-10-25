/**
 * N1 — CIBLES TACTILES : 44 pt minimum.   *** CET ITEM EST UNE MESURE, PAS UN CORRECTIF. ***
 * =========================================================================
 *
 * La regle des 44 pt n'est PAS respectee par le produit. Ce fichier ne pretend
 * donc pas la fermer : il livre le RELEVE et il le fige. Figer un ecart est
 * deja utile, parce que ca rend la violation visible et que ca interdit a un
 * refactor silencieux de la faire deriver sans qu'on le remarque. Des qu'un
 * correctif sortira, ce test rougira : ce sera a lui de mettre le releve a
 * jour, pas a lui de mentir.
 *
 * LA MESURE (aucune donnee inventeee)
 * -----------------------------------
 * Navigateur reel -- Playwright 1.63.0 / Chromium, contexte
 *   viewport {width: 393, height: 852}, deviceScaleFactor 2,
 *   isMobile true, hasTouch true, locale fr-FR
 * page `/prepare?nouvelle=1`, parcours joue a la main dans cet ordre :
 *   etape 1 -> lieu de depart (Chamonix) -> date -> lieu d'arrivee (Annecy)
 *   -> "Creer mon parcours" -> attente de la generation -> "Reessayer".
 * Aucun mock, aucune valeur saisie a la main dans le JSON : chaque nombre est
 * un `getBoundingClientRect()` lu sur le rendu, arrondi a 0,01 px.
 *
 * LE PIEGE CORRIGE DEPUIS LA PREMIERE MESURE
 * ------------------------------------------
 * Une premiere version de ce releve comptait 21 cibles dont 14 sous 44 pt. Deux
 * de ces 21 etaient FAUSSES : deux <button> de 119,64 x 23,8 pt et
 * 250,19 x 23,8 pt ("Revenir au hub", "Ouvrir les preferences du trajet").
 * Ce n'etaient pas des cibles tactiles : ils sont enfants de
 * `.prep-visually-hidden`, l'idiome standard du clipping
 * (`position:absolute; width:1px; height:1px; clip-path:inset(50%)`).
 * Or `clip-path` NE MODIFIE PAS LA MISE EN PAGE : `getBoundingClientRect()`
 * leur renvoie leur boite reelle, alors qu'un hit-test sur la meme zone ne
 * capture rien (0/25). Compter une boite sans demander au navigateur ce qu il
 * touche, c'est compter des fantomes.
 * Le filtre de ce releve tranche donc sur deux preuves concordantes :
 *   1. un ancetre en `clip-path: inset(50%)` -> exclu (`masque` non nul) ;
 *   2. un hit-test sur une grille 5x5 de 44x44 px centree sur la cible
 *      (`zone44` / `echantillons`), qui revele les zones touchees reelles.
 * La garde N1-08 verrouille le point 1 pour qu on ne puisse pas reintroduire
 * des fantomes dans un futur releve.
 *
 * STABILITE : CE QUI EST FIGE ET CE QUI NE L'EST PAS
 * ---------------------------------------------------
 * Trois releves independants (deux heures d'ecart, generation IA tombee puis
 * retablie) donnent des HAUTEURS et des LARGEURS strictement identiques. En
 * revanche l'IA produit un NOMBRE VARIABLE de pastilles de POI (5 ou 6 selon
 * le tirage) et une largeur variable pour le bouton "Relancer « ... »" dont le
 * libelle depend de la phase qui a echoue. Ces deux quantites laissee a
 * l'ecart des pins -- une plancher et un effectif minimal -- et rien d'autre.
 *
 * QUATRIEME MESURE (independante, meme jour, phase d echec IA DIFFERENTE :
 * « Recherche du parcours » au lieu de « Meteo des jours ») : les 11
 * tailles stables de ce fichier sont toutes reproduites a l identique. Le seul
 * ecart porte sur les deux grandeurs deja declarees non figees plus bas : la
 * largeur des pastilles de POI et celle du bouton « Relancer ». Le JSON
 * livre reste la 3e mesure -- celle qui a servi a ecrire les pins -- et n est
 * volontairement pas remplace par la 4e.
 *
 * CE QUE CE TEST PEUT ET NE PEUT PAS PROUVER
 * ------------------------------------------
 * Il PROUVE que le releve fige est coherent avec lui-meme (reclassement
 * independant, exhaustivite par groupe, identite des cibles) et que les
 * valeurs mesurees sont celles annoncees. Il NE PEUT PAS re-mesurer dans une
 * CI : la generation demande un serveur de dev vivant et une cle IA.
 *
 * Il n'y a donc AUCUN morsant PRODUIT sur ce fichier, a une exception : N1-11
 * lit `adventure-prep.css` et mord reellement sur le produit. La regle est
 * aujourd'hui en echec et tous les fichiers qui permettraient de la remettre
 * au vert (PrepCrumb.tsx, HubGlobeMap.tsx, PrepCalendar.tsx,
 * ActivityPickerScreen.tsx, les boutons sans classe de ItineraryStep.tsx et des
 * Prep*Sheets.tsx) appartiennent a d'autres agents. Les morsants des autres
 * gardes tamperent le releve : ils prouvent que la garde n'est pas vacuous,
 * pas que le produit est faux. Ils sont annonces comme tels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RELEVE = resolve(ICI, 'n1-releve-393x852.json');
const CSS = resolve(ICI, '../adventure-prep.css');

type Cible = {
  tag: string;
  cls: string;
  parentCls: string;
  label: string;
  w: number;
  h: number;
  display: string;
  visibility: string;
  visible: boolean;
  masque: string | null;
  zone44: number;
  echantillons: number;
};

type Releve = {
  seuil: number;
  viewport: string;
  mesure: string;
  etapes: { nom: string; etat: string; cibles: Cible[] }[];
};

const releve = JSON.parse(readFileSync(RELEVE, 'utf8')) as Releve;
const SEUIL = 44;

const sousSeuil = (e: Releve['etapes'][number]): Cible[] =>
  e.cibles.filter((c) => Math.min(c.w, c.h) < SEUIL);

/** Les pastilles de POI sont produites par l'IA : leur nombre bouge. */
const estPoi = (c: Cible): boolean => c.cls === 'hub-globe-poi-chip';
/** "Relancer « Recherche du parcours »" / "« Meteo des jours »" : largeur liee au libelle. */
const estRelancer = (c: Cible): boolean => c.label.startsWith('Relancer');

/**
 * PIN PRINCIPAL — la hauteur est la dimension CONTRAINANTE pour chacune des
 * cibles en echec (verifie : 161x22,39 -> 22,39 ; 16x23,8 -> 23,8 ; 101x31,8 ->
 * 31,8 ; 176x40 -> 40). On fige donc le multiensemble trie des hauteurs, ce qui
 * compte en valeur ET en multiplicite, et on isole les pastilles de POI dont
 * le nombre depend du tirage de l'IA.
 */
const FIGE_HAUTEURS: Record<string, number[]> = {
  'etape-1-portail': [23, 24],
  'feuille-lieu-resultats': [22.39, 23, 24],
  'feuille-date': [23, 23.8, 24, 36, 36],
  'etape-2-pret-depart-seul': [23, 24],
  'etape-2-pret': [23, 24, 32],
  'etape-2-generee': [23, 24, 31.8, 31.8, 33.8, 36, 36, 36],
  'etape-2-reprise': [23, 24, 31.8, 31.8, 33.8, 36, 36, 36],
};

/** Nombre minimal de pastilles de POI attendu sur un parcours genere. */
const POI_MIN = 1;
const POI_HAUTEUR = 40;

/**
 * PIN SECONDAIRE — largeur x hauteur, cible par cible, pour tout ce qui ne
 * bouge pas. On y retrouve exactement les quatre valeurs censeses par la
 * checklist (`.prep-crumb__link` 31,8 / "Reessayer" 33,8 / "Details" et
 * "A conserver" 36 / `.hub-globe-poi-chip` 40) et les trois qui sont apparues
 * a la re-mesure (`.prepcal__nav` 36, bouton de `.stepper` 16, "Inverser
 * depart et arrivee" 32). Les pastilles de POI et le bouton "Relancer" sont
 * exclus : leurs largeurs dependent de l'IA.
 */
const FIGE_TAILLE: Record<string, string[]> = {
  'etape-1-portail': ['23x23', '24x24'],
  'feuille-lieu-resultats': ['161x22.39', '23x23', '24x24'],
  'feuille-date': ['16x23.8', '23x23', '24x24', '36x36', '36x36'],
  'etape-2-pret-depart-seul': ['23x23', '24x24'],
  'etape-2-pret': ['23x23', '24x24', '32x32'],
  'etape-2-generee': ['101.08x31.8', '101.3x31.8', '102.61x36', '112.81x33.8', '23x23', '24x24', '69.14x36'],
  'etape-2-reprise': ['101.08x31.8', '101.3x31.8', '102.61x36', '112.81x33.8', '23x23', '24x24', '69.14x36'],
};

const trouver = (nom: string) => {
  const e = releve.etapes.find((x) => x.nom === nom);
  expect(e, `le releve doit contenir le groupe ${nom}`).toBeDefined();
  return e!;
};
const taille = (c: Cible) => `${c.w}x${c.h}`;
const tri = (a: number[]) => [...a].sort((x, y) => x - y);
const triTexte = (a: string[]) => [...a].sort();
const attendu = (nom: string) => sousSeuil(trouver(nom)).filter((c) => !estPoi(c));

/* =======================================================================
 * LE CORRECTIF CSS, LUI, VAUT PREUVE -- et lui seul.
 *
 * Les pins du haut sont un RELEVE, donc une PHOTO d'un build. Ils ne
 * bougent pas : les retirer, ou les requalifier en "conforme", serait
 * exactement la faute que ce fichier s'interdit. Ce que la feuille peut
 * prouver, c'est qu'elle ne laisse PLUS passer 44 pt la ou le releve les
 * a vus caresser. Chaque ligne du tableau est un couple
 * { mesures du releve -> declarations CSS qui les font remonter }.
 *
 * Ces tests mordent sur le PRODUIT : `corpsCSS` va lire la vraie feuille.
 * Un correctif de papier ne peut donc pas les faire passer.
 * ======================================================================= */

const CSS_SANS_COMMENT = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Le corps de la regle CSS qui porte exactement ce selecteur.
 *
 * Les commentaires sont retires AVANT toute recherche : sinon un nom de
 * classe cite dans une explication se lirait comme une regle, et le test
 * validerait du texte. Entre le selecteur et son accolade on n'accepte que
 * des blancs : `.prepcal__nav:hover` ne peut donc pas satisfaire une
 * recherche de `.prepcal__nav`, ni l'inverse.
 */
const corpsCSS = (selecteur: string): string[] => {
  const blocs: string[] = [];
  let from = 0;
  for (;;) {
    const i = CSS_SANS_COMMENT.indexOf(selecteur, from);
    if (i < 0) break;
    from = i + selecteur.length;
    const ouverture = CSS_SANS_COMMENT.indexOf('{', i + selecteur.length);
    if (ouverture < 0) break;
    if (!/^\s*$/.test(CSS_SANS_COMMENT.slice(i + selecteur.length, ouverture))) continue;
    let profondeur = 0;
    for (let k = ouverture; k < CSS_SANS_COMMENT.length; k += 1) {
      const c = CSS_SANS_COMMENT[k];
      if (c === '{') profondeur += 1;
      else if (c === '}') {
        profondeur -= 1;
        if (profondeur === 0) {
          blocs.push(CSS_SANS_COMMENT.slice(ouverture + 1, k));
          break;
        }
      }
    }
  }
  return blocs;
};

const attend = (selecteur: string, declaration: string): void => {
  const corps = corpsCSS(selecteur);
  expect(corps.length, `la regle \`${selecteur}\` doit exister dans la feuille`).toBeGreaterThan(0);
  // TOUTES les regles qui portent ce selecteur, pas seulement la premiere :
  // une declaration concurrente pourrait sinon redefinir la taille sous le
  // seuil, et l ordre de chargement decides -- ce qu aucun test ne voit.
  corps.forEach((bloc, index) => {
    expect(
      bloc,
      `\`${selecteur}\` (regle ${index + 1}/${corps.length}) doit porter \`${declaration}\``,
    ).toContain(declaration);
  });
};

/** Les groupes du releve que la feuille du preparateur fait, seule, remonter. */
const CORRECTIFS_N1: {
  groupe: string;
  mesures: string[];
  selecteur: string;
  declarations: string[];
}[] = [
  {
    groupe: 'les deux boutons de mois du calendrier',
    mesures: ['36x36', '36x36'],
    selecteur: '.prepcal__nav',
    declarations: ['width: 44px', 'height: 44px'],
  },
  {
    groupe: 'les boutons +/- du compteur de jours',
    mesures: ['16x23.8'],
    selecteur: '.stepper button',
    declarations: ['min-width: 44px', 'min-height: 44px'],
  },
  {
    groupe: 'le bouton d inversion des extremites',
    mesures: ['32x32'],
    selecteur: '.prep-swap__button',
    declarations: ['width: 44px', 'height: 44px'],
  },
  {
    groupe: 'le champ de recherche de lieu',
    mesures: ['161x22.39'],
    selecteur: '.prep-search input',
    declarations: ['min-height: 44px'],
  },
  {
    groupe: 'le bouton Reessayer du bandeau d etat',
    mesures: ['112.81x33.8'],
    selecteur: ".adventure-prep details[role='status'] summary > button",
    declarations: ['min-width: 44px', 'min-height: 44px'],
  },
  {
    groupe: 'les boutons sm du <Button> canonique',
    mesures: ['69.14x36', '102.61x36'],
    selecteur: ".adventure-prep button[data-size='sm']",
    declarations: ['min-width: 44px', 'min-height: 44px'],
  },
  {
    groupe: 'les pastilles de POI du rail de carte',
    mesures: ['176x40'],
    selecteur: '.prep-map .hub-globe-poi-chip',
    declarations: ['min-height: 44px'],
  },
  {
    groupe: 'la zone de toucher des liens de fil d Ariane',
    mesures: ['101.08x31.8', '101.3x31.8'],
    selecteur: '.prep-crumb__link::after',
    declarations: ['height: 44px', 'min-width: 44px'],
  },
];

describe('N1 — releve des cibles tactiles sous 44 pt (mesure, pas correctif)', () => {
  it('N1-01 le releve a ete pris au format qui est exige', () => {
    expect(releve.viewport, 'le releve doit declarer son viewport').toBe('393x852 CSS @dpr2');
  });

  it('N1-02 le seuil mesure est bien 44 pt', () => {
    expect(releve.seuil).toBe(SEUIL);
  });

  it('N1-03 les sept groupes du parcours sont tous mesures et atteignables', () => {
    expect(releve.etapes.map((e) => e.nom)).toEqual(Object.keys(FIGE_HAUTEURS));
    const rates = releve.etapes.filter((e) => e.etat === 'INATTEIGNABLE').map((e) => e.nom);
    // Un parcours qui n'a pas ete genere doit faire ROUGE, pas disparaitre en
    // silence avec un beau zero sous 44.
    expect(rates, 'aucun groupe ne doit etre inatteignable').toEqual([]);
  });

  it('N1-04 hauteurs en echec : le multiensemble trie est celui mesure', () => {
    for (const [nom, hauteurs] of Object.entries(FIGE_HAUTEURS)) {
      const obtenu = tri(sousSeuil(trouver(nom)).filter((c) => !estPoi(c)).map((c) => c.h));
      expect(obtenu, `hauteurs sous ${SEUIL} pt dans ${nom}`).toEqual(hauteurs);
    }
  });

  it('N1-05 largeurs en echec : taille exacte, cible par cible', () => {
    for (const [nom, tailles] of Object.entries(FIGE_TAILLE)) {
      const obtenu = triTexte(attendu(nom).filter((c) => !estRelancer(c)).map(taille));
      expect(obtenu, `tailles sous ${SEUIL} pt dans ${nom}`).toEqual(tailles);
    }
  });

  it('N1-06 les deux pastilles 23/24 pt sont bien les marqueurs de la barre basse', () => {
    // Sans cette garde d identite, un agent pourrait remplacer ces deux cibles
    // par n'importe quel autre element de 23x23 ou 24x24 et le pin resterait vert.
    for (const nom of Object.keys(FIGE_HAUTEURS)) {
      const pastilles = sousSeuil(trouver(nom)).filter((c) => taille(c) === '23x23' || taille(c) === '24x24');
      expect(pastilles.length, `deux pastilles attendues dans ${nom}`).toBe(2);
      for (const p of pastilles) expect(p.parentCls, `parent de la pastille dans ${nom}`).toBe('lkv-nav-tab');
    }
  });

  it('N1-07 les pastilles de POI sont mesurees a 40 pt de haut, en nombre utile', () => {
    // Nombre et largeurs variables (tirage de l'IA) : on fige la hauteur et on
    // interdit un effectif nul, qui ferait disparaitre la classe du releve
    // sans que personne ne s en apercoive.
    for (const nom of ['etape-2-generee', 'etape-2-reprise']) {
      const poi = sousSeuil(trouver(nom)).filter(estPoi);
      expect(poi.length, `pastilles POI dans ${nom}`).toBeGreaterThanOrEqual(POI_MIN);
      for (const p of poi) expect(p.h, `hauteur d une pastille POI dans ${nom}`).toBe(POI_HAUTEUR);
    }
  });

  it('N1-08 aucune cible comptee n est visuellement masquee', () => {
    // C est la garde qui empeche de reintroduire les deux fantomes de
    // `.prep-visually-hidden` du premier releve.
    for (const e of releve.etapes) {
      for (const c of e.cibles) {
        expect(c.masque, `${c.cls} "${c.label}" dans ${e.nom} a un ancetre en clip-path`).toBeNull();
        expect(c.visible, `${c.cls} "${c.label}" dans ${e.nom} n est pas rendu`).toBe(true);
        expect(c.display, `${c.cls} "${c.label}" dans ${e.nom}`).not.toBe('none');
        expect(c.visibility, `${c.cls} "${c.label}" dans ${e.nom}`).not.toBe('hidden');
      }
    }
  });

  it('N1-09 le plancher dur constate vaut 16 pt de large', () => {
    // Toute nouvelle cible plus petite doit faire ROUGE : elle n aura pas ete
    // vue. 16 pt = le bouton sans classe du `.stepper` de la feuille de date.
    let plancher = Infinity;
    for (const e of releve.etapes) for (const c of e.cibles) plancher = Math.min(plancher, Math.min(c.w, c.h));
    expect(plancher).toBe(16);
  });

  it('N1-10 les cibles declarees conformes le sont vraiment', () => {
    // Le tri ne doit pas laisser passer un element ABIEMENT classe conforme.
    for (const e of releve.etapes) {
      const conformes = e.cibles.filter((c) => Math.min(c.w, c.h) >= SEUIL);
      expect(conformes.length, `comptage des conformes dans ${e.nom}`).toBe(e.cibles.length - sousSeuil(e).length);
      for (const c of conformes) expect(Math.min(c.w, c.h), `conforme ${c.cls} "${c.label}"`).toBeGreaterThanOrEqual(SEUIL);
      // La barre basse : cinq onglets de 60 pt de haut, tous distincts.
      const onglets = e.cibles.filter((c) => c.cls === 'lkv-nav-tab');
      expect(onglets.length, `onglets de la barre basse dans ${e.nom}`).toBeGreaterThanOrEqual(5);
      expect(new Set(onglets.map((o) => o.label)).size, `onglets distincts dans ${e.nom}`).toBe(onglets.length);
      for (const o of onglets) expect(o.h, `hauteur d un onglet dans ${e.nom}`).toBe(60);
    }
  });

  it('N1-11 le plancher de 44 pt reste declare dans la feuille de style', () => {
    // SEUL point de couplage de ce fichier avec un fichier que je ne possede
    // pas : si un autre agent abaisse le plancher, ce test rougit et le releve
    // doit etre refait. C est un morsant PRODUIT.
    const css = readFileSync(CSS, 'utf8');
    expect(css, 'le jeton --prep-action-height doit rester declare').toMatch(/--prep-action-height\s*:/);
    expect(css, 'le plancher 44 px doit rester declare sur .prep-action').toMatch(/\.prep-action\s*\{[^}]*min-height:\s*44px/);
  });

  it('N1-12 le releve est une mesure datee, et l ecart a une signature', () => {
    expect(releve.mesure, 'le releve doit porter son horodatage').toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // La signature de l ecart, tous groupes confondus : la liste triee des
    // tailles distinctes en echec. C'est la ligne qu'un correctif doit faire
    // disparaitre, taille par taille. Les pastilles de POI et le bouton
    // "Relancer" sont exclus : leurs largeurs dependent du tirage de l'IA.
    const signature = triTexte(
      releve.etapes
        .flatMap((e) => sousSeuil(e))
        .filter((c) => !estPoi(c) && !estRelancer(c))
        .map(taille)
    ).filter((t, i, a) => a.indexOf(t) === i);
    expect(signature, 'signature de l ecart sous 44 pt').toEqual([
      '101.08x31.8',
      '101.3x31.8',
      '102.61x36',
      '112.81x33.8',
      '161x22.39',
      '16x23.8',
      '23x23',
      '24x24',
      '32x32',
      '36x36',
      '69.14x36',
    ]);
    const total = releve.etapes.reduce((n, e) => n + e.cibles.length, 0);
    const echecs = releve.etapes.reduce((n, e) => n + sousSeuil(e).length, 0);
    expect(total, 'le releve doit contenir plus de conformes que d echecs').toBeGreaterThan(echecs);
  });

  for (const correctif of CORRECTIFS_N1) {
    it(`N1-13 ${correctif.groupe} : ${correctif.mesures.join(' / ')} remontes a 44 pt`, () => {
      // La declaration est lue DANS la feuille, pas reecrite ici : un
      // correctif de papier ne peut pas la faire apparaitre.
      for (const declaration of correctif.declarations) {
        attend(correctif.selecteur, declaration);
      }
    });
  }

  it('N1-14 chaque correctif est ancre sur une mesure REELLE du releve', () => {
    // Anti-vacuite : une ligne du tableau qui ne decode plus aucune mesure
    // ne doit pas pouvoir passer inapercue. Le tableau suit le releve, pas
    // l'inverse.
    const mesuresDuReleve = new Set(
      releve.etapes.flatMap((e) => sousSeuil(e).map((c) => taille(c))),
    );
    for (const correctif of CORRECTIFS_N1) {
      for (const mesure of correctif.mesures) {
        expect(
          mesuresDuReleve.has(mesure),
          `${correctif.groupe} annonce ${mesure}, absente du releve`,
        ).toBe(true);
      }
    }
  });

  it('N1-15 les deux groupes hors de portee sont NOMMES, pas forgets', () => {
    // 23x23 et 24x24 sont des <span> sans classe, enfants d un
    // <a class="lkv-nav-tab"> qui mesure 68,59 x 60 et capte 25/25
    // echantillons : ce sont les enfants decoratifs d une cible deja
    // conforme, pas des cibles. Les elargir a 44 px casserait la barre
    // basse pour rien. Le seul correctif est dans `TabItem.tsx`, qui
    // n'appartient pas a ce lot : on le dit plutot que de le maquiller.
    const horsPortee = releve.etapes
      .flatMap((e) => sousSeuil(e))
      .filter((c) => c.parentCls === 'lkv-nav-tab');
    expect(
      new Set(horsPortee.map((c) => taille(c))),
      'les deux tailles decoratives du rail',
    ).toEqual(new Set(['23x23', '24x24']));
    // Et la cible qui les contient, elle, est bien conforme.
    const onglets = releve.etapes[0].cibles.filter((c) => c.cls === 'lkv-nav-tab');
    expect(onglets.length, 'la barre basse compte ses onglets').toBeGreaterThan(0);
    for (const onglet of onglets) {
      expect(Math.min(onglet.w, onglet.h), `onglet ${onglet.label}`).toBeGreaterThanOrEqual(SEUIL);
      expect(onglet.zone44, `onglet ${onglet.label} capte toute la zone 44`).toBe(onglet.echantillons);
    }
  });
});
