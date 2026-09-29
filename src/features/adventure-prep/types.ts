/**
 * Préparateur d'aventure — contrats de domaine.
 *
 * Trois étapes plein écran : Destination · Parcours · Départ.
 *
 * Règles non negociables encodees ici :
 * 1. Aucune donnee inventee. Prix, disponibilite et lieux sont toujours
 *    `null` + un etat de confiance quand l'information est inconnue.
 * 2. Une decision dominante par ecran, pas de score global de preparation.
 * 3. Tout est immuable : les moteurs purs renvoient toujours de nouveaux objets.
 */

import type { AIFailureReason } from '@/lib/ai/providers/types';

import type { DayWeather } from './engine/weather';
// `import type` : le lien est efface a la compilation, donc aucun cycle
// d execution. `itineraryEngine.ts` importe deja `../types`.
import type { RejectionReason } from './engine/itineraryEngine';

/* ------------------------------------------------------------------ */
/* Etapes                                                              */
/* ------------------------------------------------------------------ */

export type PrepStepId = 'destination' | 'itinerary' | 'departure';

/** Progression en mots simples, jamais en jargon de pipeline. */
export const PREP_STEPS: readonly PrepStepId[] = ['destination', 'itinerary', 'departure'];

export const PREP_STEP_LABELS: Readonly<Record<PrepStepId, string>> = {
  destination: 'Créations',
  itinerary: 'Préparation',
  departure: 'En avant !',
};

/* ------------------------------------------------------------------ */
/* Catalogue d'activites                                               */
/* ------------------------------------------------------------------ */

export type ActivityCategoryId =
  'a_pied' | 'a_velo' | 'eau' | 'neige_montagne' | 'voyage_sejour' | 'autres_sports';

export interface ActivityCategory {
  id: ActivityCategoryId;
  label: string;
  icon: string;
}

/** Contexte de metrique dominant : pilote les trois metriques de l'etape 2. */
export type MetricsContext = 'terrain' | 'sejour' | 'voyage';

export interface ActivityDef {
  id: string;
  label: string;
  category: ActivityCategoryId;
  icon: string;
  keywords: readonly string[];
  metrics: MetricsContext;
  /** Activite principale possible dans le catalogue. */
  canBePrimary: boolean;
  /** Peut aussi s'ajouter comme nuit (bivouac). */
  canBeAddedNight: boolean;
  /** Se combine avec d'autres activites (un voyage peut contenir plusieurs). */
  combinable: boolean;
  /** Duree conseillee, uniquement une suggestion affichee comme telle. */
  suggestedDurationHours: number;
}

export interface ActivitySelection {
  primary: string | null;
  extra: readonly string[];
  /** Nuits ajoutees (bivouac) : ni le lieu ni la date ne sont inventes. */
  nights: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Confiance                                                           */
/* ------------------------------------------------------------------ */

/** Trois etats, toujours explicites a l'ecran. */
export type BookingState = 'propose' | 'a_reserver' | 'confirme' | 'confirme_communaute';

export const BOOKING_STATE_LABELS: Readonly<Record<BookingState, string>> = {
  propose: 'Proposé',
  a_reserver: 'À réserver',
  confirme: 'Confirmé',
  confirme_communaute: 'Confirmé par la communauté',
};

/**
 * Les états qui engagent l'utilisateur, distincts de ceux que rapportent les
 * autres : l'écran doit pouvoir les différencier, sinon « onSuppose » se lit
 * comme « c'est sûr ».
 */
export const SELF_CONFIRMED_STATES: readonly BookingState[] = ['confirme'];

/** Prix : jamais invente. `amount === null` signifie « à vérifier ». */
export interface MoneyValue {
  amount: number | null;
  currency: 'EUR';
  state: BookingState;
}

export const PRICE_TO_CHECK: MoneyValue = { amount: null, currency: 'EUR', state: 'a_reserver' };

/**
 * Detail d'un prix affiche dans la fiche d'une etape.
 *
 * Une seule valeur `MoneyValue` ne suffit pas : une nuit affiche « par nuit »,
 * une place de transport « par personne », et l'utilisateur veut toujours lire
 * le total de son groupe. `isEstimate` separe ce qui est verifie de ce qui ne
 * l'est pas — une estimation doit porter la mention, jamais un chiffre nu.
 */
export interface PriceBreakdown {
  /** « par nuit », « par personne »… `null` quand l'unite n'a pas de sens. */
  unitLabel: string | null;
  perUnit: MoneyValue;
  perPerson: MoneyValue;
  groupTotal: MoneyValue;
  isEstimate: boolean;
}

/* ------------------------------------------------------------------ */
/* Etape 1 — On part ou ?                                             */
/* ------------------------------------------------------------------ */

export interface PlaceRef {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export type RouteShape = 'boucle' | 'aller_simple';

/**
 * La forme du parcours n'est plus un choix de l'utilisateur : elle se deduit
 * des lieux. Un point de depart seul produit une boucle ; un depart et une
 * arrivee distincts produisent un aller simple. On ne demande donc jamais
 * « boucle ou aller simple » — on demande juste ou, et l'IA s'adapte.
 */
export function deriveRouteShape(route: Pick<RouteBlock, 'origin' | 'destination'>): RouteShape {
  return route.destination !== null ? 'aller_simple' : 'boucle';
}

export interface RouteBlock {
  origin: PlaceRef | null;
  destination: PlaceRef | null;
  /** Derive de origin/destination par `deriveRouteShape`, jamais saisi a la main. */
  shape: RouteShape;
}

export interface CalendarBlock {
  /** ISO `YYYY-MM-DD`. `null` = inconnu, affiche « à choisir ». */
  startDate: string | null;
  /**
   * Vrai quand la date vient d une proposition, pas d un choix connu.
   *
   * Sans ce drapeau, une date posee par l IA se lirait comme un fait : rien
   * ne dirait qu on peut la changer. C est le miroir de `durationIsSuggested`
   * pour la date, et il disparait des que la personne ouvre le calendrier.
   */
  startDateIsSuggested: boolean;
  durationDays: number | null;
  /** Vrai quand la duree vient d'une proposition, pas d'une preference connue. */
  durationIsSuggested: boolean;
  returnDate: string | null;
  /**
   * Heure de depart saisie, `"HH:MM"` en 24 h, ou `null` = jamais choisie.
   *
   * Elle est SAISIE, jamais calculee : une heure inventee se lirait comme un
   * fait alors qu elle n a aucun poids derriere elle. `null` doit donc rester
   * l absence de fait - l ecran affiche « a choisir », et rien n est pose a
   * la persistance tant que la personne n a pas repondu.
   *
   * Volontairement `string` et pas `Date` : la valeur survit au changement
   * de fuseau et se relit telle qu elle a ete tapee. `ItineraryStep.startTime`
   * porte la meme forme, pour la meme raison.
   *
   * Le champ est OPTIONNEL pour qu un brouillon deja enregistre avant son
   * arrival (donc sans la cle) reste relisible. Son absence se lit exactement
   * comme `null` - jamais comme une heure par defaut.
   */
  startTime?: string | null;
}

/**
 * Une heure saisie est-elle une heure ?
 *
 * La seule forme acceptee est `HH:MM` en 24 h, minutes entre 0 et 59.
 * Tout le reste — espace, texte, `7:5`, `25:00` — se relit comme une
 * ABSENCE, jamais comme une heure approchee : on ne devine pas ce que la
 * personne voulait taper, on ne garde que ce qui est complet et vrai.
 */
export const HEURE_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * L'heure recopiee dans sa forme canonique, ou `null` si elle n'en est pas une.
 *
 * Le leading zero est tolere en entree et impose en sortie : `8:5` est refuse
 * (forme incomplete), `8:05` devient `08:05`, ce qui rend la valeur comparable
 * a celle du modele et de la base.
 */
export function normalizeClockTime(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const heures = Number(m[1]);
  const minutes = Number(m[2]);
  if (heures < 0 || heures > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * L'heure de depart rejoint-elle la metadata du voyage ?
 *
 * Elle y entre telle quelle, ou PAS DU TOUT. La regle est stricte dans les
 * deux sens, parce que les deux erreurs se lisent de la meme facon a l'ecran :
 *
 *   - deposer une heure la ou la personne n en a pas choisi ferait afficher
 *     une heure qui n'a aucun fait derriere elle ;
 *   - en omettre une qui a ete saisie ferait croire a l'utilisateur que sa
 *     reponse a disparu.
 *
 * La cle n est donc posee QUE pour une heure reelle : son absence se distingue
 * d'un `null` pose, qui se lirait comme un fait enregistre.
 */
export function avecHeureDeDepart(
  metadata: Record<string, unknown>,
  startTime: string | null | undefined,
): Record<string, unknown> {
  if (typeof startTime !== 'string' || !HEURE_RE.test(startTime)) return metadata;
  // `metadata` est un `Record<string, unknown>` : `prep` y est type `unknown`
  // et ne peut pas etre etale tel quel. On ne le traite comme un objet que
  // s il l EST vraiment - sinon on repart d'un objet vide plutot que de
  // laisser une valeur parasite effleurer l'ecriture du voyage.
  const existant = metadata.prep;
  const base =
    typeof existant === 'object' && existant !== null && !Array.isArray(existant)
      ? (existant as Record<string, unknown>)
      : {};
  return { ...metadata, prep: { ...base, startTime } };
}

export type GroupMode = 'solo' | 'groupe';

export interface GroupBlock {
  mode: GroupMode;
  adults: number;
  children: number;
  hasPets: boolean;
  knownMembers: readonly string[];
}

export type Pace = 'tranquille' | 'normal' | 'rapide';
export type BudgetLevel = 'economique' | 'modere' | 'confort';
export type TransportPreference = 'peigne' | 'train' | 'voiture' | 'avion' | 'mixte';

export interface PreferencesBlock {
  budgetPerPerson: number | null;
  budgetLevel: BudgetLevel;
  pace: Pace;
  transport: TransportPreference;
  interests: readonly string[];
  accessibilityNeeds: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Etape 2 — Voici ton aventure                                        */
/* ------------------------------------------------------------------ */

export type ItineraryStepKind = 'trajet' | 'arret' | 'repos' | 'nuit' | 'ravitaillement';

export interface ItineraryStep {
  id: string;
  day: number;
  order: number;
  kind: ItineraryStepKind;
  title: string;
  placeName: string | null;
  /**
   * Identifiant REEL du lieu dans le catalogue d origine, ou `null` quand la
   * source n en fournit pas (ligne OSM, commerce de proximite).
   *
   * Toujours present, y compris a `null` : une absence doit se lire « aucun
   * lieu rattache », jamais « identifiant oublie ». Jamais de valeur fabriquee
   * — une cle synthetique se lit comme une reference de catalogue qui ne
   * mene nulle part.
   */
  placeId: string | null;
  /** Heure indicative « 08:30 », jamais une reservation. */
  startTime: string | null;
  durationMin: number | null;
  /** Raison courte du choix : proximite, preference, ravitaillement… */
  reason: string | null;
  price: MoneyValue;
  state: BookingState;
  /** « À conserver » : bloque l'etape lors d'une nouvelle proposition. */
  kept: boolean;
  icon: string;
  lat: number | null;
  lon: number | null;
  /** Tag optionnel : rattache un ravitaillement a un repas precis. */
  mealSlot?: MealSlot | null;
  /**
   * Detail du prix quand il est connu : par unite, par personne, total groupe.
   * `null` ou absent = « a verifier », jamais une ligne vide qui ferait croire
   * que le prix a ete oublie plutot que non verifie.
   */
  priceBreakdown?: PriceBreakdown | null;
}

export interface DayTotals {
  /**
   * Distance mesuree sur le reseau du mode de deplacement reel, jamais une
   * distance a vol d'oiseau. Un trajet de marche annonce en 12 min de voiture
   * etait le defaut le plus grave du preparateur (P0.22).
   */
  distanceKm: number | null;
  /** Temps de deplacement mesure sur ce meme reseau, jamais un temps estime. */
  movingMin: number | null;
  /**
   * Duree d'activite du jour : la somme des durees REELLEMENT connues de ses
   * etapes. `null` des qu'une seule est inconnue — jamais une somme partielle
   * presentee comme le total de la journee.
   */
  activityMin: number | null;
  elevGainM: number | null;
  elevLossM: number | null;
}

export interface ItineraryModel {
  /**
   * Etiquette du parcours, PROPOSEE PAR LE MODELE. `null` quand rien n a ete
   * propose (repli regles, ou modele muet) : l ecran affiche alors son libelle
   * neutre plutot que d inventer un nom.
   */
  title: string | null;
  days: number;
  steps: readonly ItineraryStep[];
  /**
   * Intentions non rattachees a un lieu reel. Elles ne sont PAS des etapes :
   * sans position elles ne peuvent recevoir ni distance, ni duree, ni prix.
   * Les garder dans `steps` ferait passer toute la journee a « a verifier »
   * alors que la base contient des lieux reels. La note garde la trace de ce
   * que la personne a demande, sans jamais pretendre qu un lieu existe.
   */
  notes?: readonly DayNote[];
  totals: DayTotals;
  perDay: readonly DayTotals[];
  /**
   * Meteo REELLE, indexee comme `perDay` : index 0 = jour 1.
   * `null` = le fournisseur ne couvre pas cette date, ou n a pas repondu.
   * Jamais une valeur reportee d un autre jour, jamais une valeur par defaut.
   */
  weather: readonly (DayWeather | null)[];
  /** Contexte qui a determine les trois metriques affichees. */
  metricsContext: MetricsContext;
  budgetPerPerson: MoneyValue;
  activityCount: number;
  /** Points de repli calcules (pluie, fermeture, retard…). */
  contingencies: readonly Contingency[];
}

/** Intention de programme sans lieu : ni distance, ni duree, ni prix. */
export interface DayNote {
  readonly day: number;
  readonly kind: ItineraryStepKind;
  readonly title: string;
  readonly reason: string | null;
}

/** Ajuster : cinq reglages(exprimes simplement) + une phrase libre. */
export type AdjustmentId =
  | 'moins_cher'
  | 'moins_de_transport'
  | 'plus_de_nature'
  | 'plus_tranquille'
  | 'plus_de_decouvertes';

export interface AdjustmentPreview {
  id: AdjustmentId;
  /** Effet explique en mots, jamais un pourcentage invente. */
  impact: string;
  /** Etapes conservees ou confirmees : jamais deplacees silencieusement. */
  preservedStepIds: readonly string[];
  changedStepIds: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Etape 3 — Tout est pret ?                                          */
/* ------------------------------------------------------------------ */

export type GearCategory =
  'shelter' | 'sleep' | 'cook' | 'clothing' | 'water' | 'safety' | 'navigation' | 'misc';

export interface GearNeed {
  id: string;
  name: string;
  category: GearCategory;
  quantity: number;
  vital: boolean;
  requiredFor: readonly string[];
  /** `null` = personne designee, le partage reste « a confirmer ». */
  ownerId: string | null;
  /** `null` = poids inconnu, jamais un zero par defaut. */
  weightGrams: number | null;
  /** Toujours `false` a la creation : possede ne veut pas dire prepare. */
  packed: boolean;
}

export interface WaterNeed {
  stepId: string;
  litersPerPerson: number | null;
  /** Fiabilite du point de ravitaillement suivant. */
  confidence: 'fiable' | 'incertaine';
  refillPlaceName: string | null;
  alternativePlaceName: string | null;
}

/** Repas d'une journee : jamais de menu invente, seulement un besoin. */
export type MealSlot = 'petit_dejeuner' | 'dejeuner' | 'diner';

export const MEAL_SLOT_LABELS: Readonly<Record<MealSlot, string>> = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
};

export interface MealNeed {
  day: number;
  slot: 'petit_dejeuner' | 'dejeuner' | 'diner';
  coveredByStepId: string | null;
  label: string;
}

export interface DepartureMetrics {
  gearToVerify: number;
  /** Possession inconnue != absent : les deux sont distingues. */
  missing: readonly { name: string; ownership: 'inconnu' | 'absent' }[];
  packWeightGrams: number | null;
  packWeightHasGaps: boolean;
  water: WaterNeed[];
  meals: MealNeed[];
  confirmedParticipants: number;
  invitedParticipants: number;
  /** Effectif prevu utilise par les calculs (confirme + invite). */
  plannedParticipants: number;
  budgetEstimated: MoneyValue;
  budgetCommitted: number;
  budgetRemaining: MoneyValue;
  /** Verifications concretes. Jamais un score de securite. */
  openPoints: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export type GenerationPhaseId =
  | 'recherche_parcours'
  | 'verification_etapes'
  | 'disponibilites'
  | 'lieux'
  | 'trace'
  | 'meteo'
  | 'synthese';

export interface GenerationPhase {
  id: GenerationPhaseId;
  label: string;
  done: boolean;
}

/**
 * Le verdict REEL d'une phase, tel que le moteur le rend.
 *
 * Distinct de 'done', qui veut dire « cette phase a ete atteinte », pas
 * « elle a livre ». Une phase atteinte puis tombee est donc 'done' ET
 * echouee : confondre les deux ferait afficher 7/7 alors que le kilometrage
 * n'existe pas.
 */
export interface GenerationPhaseVerdict {
  readonly id: GenerationPhaseId;
  readonly status: 'reussie' | 'echoue' | 'inverifiable';
  /** Raison motivee, prete a etre lue. Jamais de detail technique. */
  readonly reason: string | null;
  /** Cette phase se rejoue-t-elle seule, sans reconstruire le parcours ? */
  readonly retryable: boolean;
}

export type GenerationStatus = 'idle' | 'en_cours' | 'interrompu' | 'echec' | 'termine';

export interface GenerationState {
  status: GenerationStatus;
  phases: readonly GenerationPhase[];
  /** Resultats deja produits : conserves apres « Arreter » ou un echec. */
  steps: readonly ItineraryStep[];
  days: number;
  /** Erreur honnete, jamais de detail technique suppose. */
  error: string | null;
  /**
   * Phrase a afficher alors que le parcours EST pret : le parcours a pu etre
   * construit sur les regles parce que l'IA ne repondait pas. Sans elle, un
   * repli silencieux ferait croire a un enrichissement qui n'a pas eu lieu.
   */
  notice: string | null;
  /**
   * Cause REELLE de la degradation, quand elle est connue.
   *
   * `notice` est la phrase lisible, ceci la cause machine. Ils ne peuvent pas
   * diverger : le bandeau et la notice lisent le meme etat, donc un seul peut
   * mentir a la fois — et ne mentiront pas, car la phrase est produite par la
   * cause.
   */
  failure: AIFailureReason | null;
  /**
   * POURQUOI le planning propose par l IA a ete REFUSE, quand elle l a ete.
   *
   * Valeur distincte de `failure` : celle-ci dit quel SERVICE a tombe,
   * celle-ci dit ce que le CONTROLE de coherence a refuse. Un refus porte
   * aucun fournisseur et aucune panne - il porte une contradiction mesuree.
   *
   * `null` = rien n a ete refuse. C est la valeur par defaut d une
   * generation, et elle est PRESERVEE par une reprise de phase : le refus
   * reste un fait passe tant qu un resultat ne l a pas remplace.
   */
  rejectedReason: RejectionReason | null;
  /**
   * Les verdicts REELS rendus par le moteur, phase par phase.
   *
   * Vides tant qu'aucune generation ne s'est achevee, et absents sur un
   * brouillon enregistre avant leur existence : l'absence se lit comme une
   * absence, jamais comme un echec.
   */
  outcomes: readonly GenerationPhaseVerdict[];
}

/**
 * La phase qu on peut rejouer seule, DERIVEE de l etat — jamais supposee.
 *
 * Pourquoi seulement sur `echec` : une generation `interrompu` l a ete arretee
 * volontairement, et son parcours de reprise (« Reprendre ») n a rien a
 * reparer. Confondre les deux afficherait un bouton « Reessayer » sur un
 * choix de l utilisateur, et ferait croire qu une panne a eu lieu.
 *
 * Pourquoi la PREMIERE phase non livree : les phases sont ordonnees, donc la
 * premiere qui n a rien rendu est celle dont l absence bloque la suite. Les
 * phases suivantes ne sont pas « en echec », elles n ont pas ete atteintes.
 *
 * Pourquoi `null` quand toutes les phases ont livre : un echec enregistre apres
 * coup, ou un etat incoherent, ne doit pas fabriquer une phase a rejouer. Pas de
 * phase a designer = pas de bouton — plutot qu un bouton qui ne rejouerait rien.
 */
export function failedGenerationPhase(generation: GenerationState): GenerationPhase | null {
  // Le verdict du moteur prime : c'est lui qui sait si la phase a livre. Un
  // parcours affiche peut etre complet ET degradé — refuser de designer une
  // phase dans ce cas laissait l'ecran plein de « A verifier » sans nom ni
  // action, alors que le moteur avait mesure la panne.
  const tombee = (generation.outcomes ?? []).find(
    (verdict) => verdict.status !== 'reussie' && verdict.retryable
  );
  if (tombee) {
    const connue = generation.phases.find((phase) => phase.id === tombee.id);
    if (connue) return { ...connue, done: false };
  }
  // Repli historique : une generation declaree en echec sans verdict engine.
  if (generation.status !== 'echec') return null;
  return generation.phases.find((phase) => !phase.done) ?? null;
}

/**
 * La raison a afficher quand une phase n'a rien livre.
 *
 * Le verdict du moteur parle en premier : il dit CE qui n'a pas abouti. L'erreur
 * de generation ne sert que de repli, pour une generation declaree en echec sans
 * verdict. Sans cette distinction, un parcours degrade affichait un bandeau
 * « Échec » sans jamais dire pourquoi.
 */
export function failedGenerationReason(generation: GenerationState): string | null {
  const tombee = (generation.outcomes ?? []).find((verdict) => verdict.status !== 'reussie');
  return tombee?.reason ?? generation.error;
}

/* ------------------------------------------------------------------ */
/* Robustesse                                                          */
/* ------------------------------------------------------------------ */

export type ContingencyKind =
  | 'pluie'
  | 'fermeture'
  | 'retard'
  | 'hebergement_indisponible'
  | 'hors_ligne'
  | 'ia_indisponible'
  | 'offre_absente';

export interface Contingency {
  kind: ContingencyKind;
  trigger: string;
  action: string;
  affectedStepIds: readonly string[];
  prepared: boolean;
}

/* ------------------------------------------------------------------ */
/* Brouillon autosave                                                  */
/* ------------------------------------------------------------------ */

export interface AdventurePrepDraft {
  /** Incremente a chaque sauvegarde : sert de version de reprise. */
  version: number;
  activities: ActivitySelection;
  /** Invite libre de l'etape 1 : ce que l'utilisateur veut, en toutes lettres. */
  brief: string | null;
  /** L'utilisateur a choisi de partir sans activite du catalogue. */
  pickerDismissed: boolean;
  route: RouteBlock;
  calendar: CalendarBlock;
  group: GroupBlock;
  preferences: PreferencesBlock;
  generation: GenerationState;
  itinerary: ItineraryModel | null;
  gear: readonly GearNeed[];
  packedGearIds: readonly string[];
  currentStep: PrepStepId;
  /** Nom personnalise de l aventures ; ull = nom propose par defaut. */
  coverName: string | null;
  /** Etapes deja terminees, accessibles au toucher. */
  completedSteps: readonly PrepStepId[];
  updatedAt: number | null;
}
