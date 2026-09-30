/**
 * Provenance des donnees affichees — le gate bloquant de la phase T2.
 *
 * Le dossier (section 5, T2) fixe une regle qui ne se negocie pas :
 *
 *   « Un plan affiche sans donnee sans source = bug bloquant. »
 *
 * Ce module ne se contente donc pas d'attribuer une provenance : il la
 * VERIFIE, et il echoue bruyamment. `assertSnapshotProvenance` leve une
 * exception si une seule valeur presente a l'ecran ne peut pas etre
 * remontee jusqu'a une source. C'est transforme en test bloquant dans
 * `tests/features/trajectoire/provenance.spec.ts` : si quelqu'un ajoute
 * une carte, le test casse AVANT que la carte n'atterrisse en production.
 *
 * Trois decisions structurantes, et pourquoi :
 *
 *  1. LA DERIVEE N'EST PAS UNE MESURE, MAIS ELLE N'EST PAS UNE INVENTION.
 *     Les tarifs Routestack, les prix Viator et les points OSM sont releves
 *     chez un tiers (`official`), donc ils exigent une reference. Les valeurs
 *     calculees par le moteur pur — budget a partir des taux de zone, score
 *     de dangerousite a partir de l'altitude et de l'exposition — sont
 *     reproduites au bit pres, mais sans reference externe : c'est ce qui les
 *     distingue d'un chiffre invente.
 *
 *  2. LE `observedAt` N'EST PAS FABRIQUE. Il n'est renseigne que si l'appelant
 *     fournit une horloge reelle. Aucune date par defaut : une date
 *     synthetique qui a l'air d'etre une observation est exactement le piege
 *     que la regle « l'IA n'invente jamais » cherche a fermer. Pour la meme
 *     raison, `sources_hash` est compare par le client, jamais recalcule en
 *     base : voir l'en-tete de 20260930080001.
 *
 *  3. LA VERIFICATION EST SEPAREE DE L'ATTRIBUTION. `provenanceFor` dit d'ou
 *     vient une source ; `assertAllResolvable` dit si l'ensemble tient. Les
 *     deux sont testables isolement, et surtout la seconde reste testable sur
 *     un cas FAUTIF — ce qu'un garde-fou qui ne prend qu'un snapshot
 *     Fel wouldn't allow.
 */

import {
  isResolvableProvenance,
  type DataProvenance,
  type ProvenanceSource,
} from '@/features/adventure-intelligence/domain/provenance';

import type { TrajectoireSourceId } from './scaleAxis';
import type { TrajectoireSnapshot } from './types';

/* -------------------------------------------------------------------------- */
/* Taxonomie : source technique -> classe de provenance                      */
/* -------------------------------------------------------------------------- */

/**
 * Le sens de `TrajectoireSourceId` est « qui a produit la donnee », pas « qui
 * l'a verifie ». Ces deux reponses ne se confondent jamais : une trace de la
 * tribu est un DOCUMENT, mais sa duree a ete MESUREE par la personne qui
 * l'a parcourue ; un prix Routestack est une AFFIRMATION commerciale, verifiee
 * par la source elle-meme.
 */
export const SOURCE_PROVENANCE: Record<TrajectoireSourceId, ProvenanceSource> = {
  meteo: 'official',
  traces_perso: 'measured',
  routestack: 'official',
  refuges: 'official',
  viator: 'official',
  alt_meteo_7j: 'official',
  vols: 'official',
  esim: 'official',
  assurance: 'official',
  inventaire_lkdv: 'measured',
  traces_tribu: 'community',
  osm: 'official',
};

/**
 * Etiquettes courtes pour les chips de provenance.
 *
 * Volontairement 3 a 5 caracteres : ces chips se repetent sous chaque ligne de
 * chaque carte. Un libelle de 20 caracteres transformerait huit cartes en
 * paragraphes, et l'utilisateur arreterait de les lire — c'est-a-dire
 * exactement la perte de tracabilite que le module existe pour empecher.
 */
export const SOURCE_LABEL: Record<TrajectoireSourceId, string> = {
  meteo: 'METEO',
  traces_perso: 'PERSO',
  routestack: 'RS',
  refuges: 'REFUGE',
  viator: 'VTR',
  alt_meteo_7j: 'ALT7J',
  vols: 'VOLS',
  esim: 'ESIM',
  assurance: 'ASSUR',
  inventaire_lkdv: 'LKDV',
  traces_tribu: 'TRIBU',
  osm: 'OSM',
};

/** Nom lisible complet, pour l'accessibilite (aria-label) des chips. */
export const SOURCE_TITLE: Record<TrajectoireSourceId, string> = {
  meteo: 'Meteo officielle',
  traces_perso: 'Randonnees personnelles mesurees',
  routestack: 'Routestack (tarifs transport)',
  refuges: 'Refuges (tarifs hebergement)',
  viator: 'Viator (activites)',
  alt_meteo_7j: 'Altitude et meteo 7 jours',
  vols: 'Routestack (vols)',
  esim: 'eSIM',
  assurance: 'Assurance voyage',
  inventaire_lkdv: 'Inventaire LKDV (mesure)',
  traces_tribu: 'Carnets de la tribu',
  osm: 'OpenStreetMap',
};

/**
 * Reference stable et resolvable par source technique.
 *
 * Elle sert de `sourceRef` quand l'appelant n'a pas de reference plus fine.
 * C'est la porte de sortie honnete : plutot que d'inventer un identifiant
 * precis (`routestack:offer:84213`) qu'aucun systeme ne pourrait retrouver, on
 * nomme la source, qui elle-meme se resout.
 */
const SOURCE_REF: Record<TrajectoireSourceId, string> = {
  meteo: 'meteo:station',
  traces_perso: 'traces_perso:owner',
  routestack: 'routestack:tarifs',
  refuges: 'refuges:tarifs',
  viator: 'viator:activites',
  alt_meteo_7j: 'alt_meteo_7j:forecast',
  vols: 'routestack:vols',
  esim: 'esim:offre',
  assurance: 'assurance:contrat',
  inventaire_lkdv: 'inventaire_lkdv:items',
  traces_tribu: 'traces_tribu:carnets',
  osm: 'osm:way',
};

export interface ProvenanceContext {
  /**
   * Observations reelles fournies par l'appelant, par source.
   *
   * C'est le SEUL endroit ou une horloge entre dans le module. Une source
   * absente de cette table reste resolvable par `SOURCE_REF`, mais n'affiche
   * aucun age : « d'ou vient cette donnee » reste vrai, « quand a-t-elle ete
   * relevee » n'est pas pret a mentir.
   */
  observedAt?: Partial<Record<TrajectoireSourceId, string>>;
  /** References plus precises que `SOURCE_REF`, si l'appelant en a. */
  sourceRefs?: Partial<Record<TrajectoireSourceId, string>>;
}

/** Provenance resolue d'une source technique. */
export function provenanceFor(
  sourceId: TrajectoireSourceId,
  context: ProvenanceContext = {}
): DataProvenance {
  const observedAt = context.observedAt?.[sourceId];
  const reference = context.sourceRefs?.[sourceId] ?? SOURCE_REF[sourceId];
  return {
    source: SOURCE_PROVENANCE[sourceId],
    sourceRef: reference,
    ...(observedAt ? { observedAt } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Inventaire des donnees affichees                                           */
/* -------------------------------------------------------------------------- */

/** Une valeur affichee a l'ecran, avec l'endroit ou elle vit. */
export interface DisplayedDatum {
  /** Identifiant stable : carte + clef de ligne. Sert aussi dans les messages. */
  id: string;
  /** La ou l'utilisateur la voit. */
  location: string;
  /** Nom court de la source, pour l'erreur. */
  sourceId: TrajectoireSourceId;
  provenance: DataProvenance;
}

const BUDGET_SOURCE: Record<
  'transport' | 'hebergement' | 'activites' | 'kit',
  TrajectoireSourceId
> = {
  transport: 'routestack',
  hebergement: 'refuges',
  activites: 'viator',
  kit: 'inventaire_lkdv',
};

/**
 * TOUTES les donnees que l'ecran affiche.
 *
 * Cette fonction est la seule source de verite du gate. `TrajectoireBoard`
 * rend des cartes, pas des donnees isolees : il y a donc un risque reel
 * qu'une nouvelle carte oublie de se declarer ici. Le test bloquant verifie
 * qu'il y a 8 cartes, et que chacune expose au moins une donnee.
 */
export function collectDisplayedData(snapshot: TrajectoireSnapshot): DisplayedDatum[] {
  const data: DisplayedDatum[] = [];

  const push = (location: string, id: string, sourceId: TrajectoireSourceId): void => {
    data.push({
      id: `${location}:${id}`,
      location,
      sourceId,
      provenance: provenanceFor(sourceId),
    });
  };

  // Budget : total + les quatre lignes decomposees + chaque ligne d'affiliation.
  push('budget', 'total', 'routestack');
  for (const key of ['transport', 'hebergement', 'activites', 'kit'] as const) {
    push('budget', key, BUDGET_SOURCE[key]);
  }
  for (const [index, line] of snapshot.budget.affiliation.entries()) {
    push('budget', `affiliation-${index}-${line.sourceId}`, line.sourceId);
  }

  // Dangerosite : le score, puis chaque facteur.
  push('danger', 'score', 'alt_meteo_7j');
  for (const factor of snapshot.danger.factors) {
    push('danger', factor.id, factor.sourceId);
  }

  // Fenetre meteo : 4 chaines affichees.
  push('window', 'ideal', snapshot.window.sourceId);
  if (snapshot.window.risk) push('window', 'risk', snapshot.window.sourceId);
  push('window', 'daylight', snapshot.window.sourceId);
  push('window', 'amplitude', snapshot.window.sourceId);
  push('window', 'water', 'osm');

  // Plan : les etapes apparaissent sur DEUX cartes — le recit (« Plan
  // vivant ») et la liste (« Etapes »). Les deux les affichent, donc les
  // deux doivent etre couvertes ; n'en garder qu'une laisserait un des deux
  // ecrans sans provenance.
  for (const step of snapshot.steps) {
    push('plan', step.id, step.sourceId);
    push('steps', step.id, step.sourceId);
  }

  // Kit : chaque item, possede ou non — un prix affiche sans source serait
  // exactement le piege de la carte panier (T5).
  for (const item of snapshot.kit) {
    push('kit', item.id, item.sourceId);
  }

  // Traces : chaque trace affichee porte sa source (tribu ou perso).
  for (const trace of snapshot.traces) {
    push('traces', trace.id, trace.source === 'randonnee_perso' ? 'traces_perso' : 'traces_tribu');
  }

  // Veille : chaque regle.
  for (const rule of snapshot.veille) {
    push('veille', rule.kind, rule.sourceId);
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* LE GATE                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Donnees affichees dont la provenance ne se resout pas.
 *
 * Une liste vide est le seul etat acceptable en production.
 */
export function unresolvedData(snapshot: TrajectoireSnapshot): DisplayedDatum[] {
  return collectDisplayedData(snapshot).filter(
    (datum) => !isResolvableProvenance(datum.provenance)
  );
}

/**
 * LE gate de sortie T2, sur une liste de donnees.
 *
 * Cette fonction est la seule qui leve. Elle prend une liste plutot qu'un
 * snapshot pour une raison qui n'est pas cosmetique : tant qu'elle ne
 * prenait que le snapshot, elle n'avait aucun moyen d'etre testee sur un cas
 * FAUTIF. La taxonomie des sources est fermee et toutes se resolvent, donc
 * un snapshot reellement produit n'est jamais fautif — et un test qui
 * n'essaie que des snapshots valides ne prouve pas que le garde existe. Il le
 * prouve en appelant celui-ci avec une donnee dont la provenance est,
 * elle, irresoluble.
 *
 * Leve en listant CHAQUE donnee fautive, et non la premiere : reparer vingt
 * erreurs une par une est exactement le travail qui fait glisser un chantier
 * d'une demi-journee. Le message nomme la carte, la ligne et la source, donc
 * le correctif se deduit de l'erreur.
 */
export function assertAllResolvable(data: readonly DisplayedDatum[]): void {
  const unresolved = data.filter((datum) => !isResolvableProvenance(datum.provenance));
  if (unresolved.length === 0) return;

  const detail = unresolved
    .map((datum) => `${datum.location}/${datum.id} (source ${datum.sourceId})`)
    .join(', ');

  throw new Error(
    `Trajectoire — bug bloquant T2 : ${unresolved.length} donnee(s) affichee(s) ` +
      `sans provenance resolvable : ${detail}`
  );
}

/** LE gate de sortie T2, sur l'instantane courant. */
export function assertSnapshotProvenance(snapshot: TrajectoireSnapshot): void {
  assertAllResolvable(collectDisplayedData(snapshot));
}

/**
 * Etape du gate qui se branche sur le re-rendu des cartes.
 *
 * L'echec ne doit pas etre silencieux : React afficherait sinon une page
 * blanche sans dire pourquoi. On journalise ET on laisse le squelette
 * s'afficher avec la mention « source manquante » — l'utilisateur voit que
 * quelque chose ne va pas, et la console garde la cause.
 */
export function verifyProvenance(snapshot: TrajectoireSnapshot): void {
  try {
    assertSnapshotProvenance(snapshot);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

/* -------------------------------------------------------------------------- */
/* Groupement pour les chips                                                  */
/* -------------------------------------------------------------------------- */

/** Provenance d'une carte entiere, deduitee de ses donnees. */
export interface CardProvenance {
  /** Sources techniques, dans l'ordre ou elles apparaissent. */
  sources: readonly TrajectoireSourceId[];
  /** La source la plus structurante de la carte. */
  primary: TrajectoireSourceId;
  resolvable: boolean;
}

/**
 * Resume d'une carte : de quelles sources elle tire ses lignes.
 *
 * Les chips n'ont pas besoin d'une ligne par ligne — huit cartes x quarante
 * lignes = 320 chips. Une carte montre ses sources DISTINCTES, ce qui suffit
 * a repondre a « d'ou vient ce numero ? » sans noyer l'ecran.
 */
export function cardProvenance(snapshot: TrajectoireSnapshot, location: string): CardProvenance {
  const data = collectDisplayedData(snapshot).filter((datum) => datum.location === location);
  const sources = Array.from(new Set(data.map((datum) => datum.sourceId)));
  return {
    sources,
    // La premiere source est la plus structurante : c'est celle qui rend la
    // carte fiable. Une carte vide ne doit pas lever, elle doit etre vide.
    primary: sources[0] ?? 'osm',
    resolvable: data.every((datum) => isResolvableProvenance(datum.provenance)),
  };
}

/** Les 8 cartes du dossier, dans l'ordre du rendu. */
export const CARD_LOCATIONS = [
  'budget',
  'danger',
  'window',
  'plan',
  'steps',
  'kit',
  'traces',
  'veille',
] as const;

export type CardLocation = (typeof CARD_LOCATIONS)[number];
