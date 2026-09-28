import { metricsContextFor } from '../catalog';
import { buildContingencies, isPhaseId, PHASE_IDS, type PhaseOutcome, type PhaseStatus } from './resilience';
import { renumberByDay } from './itinerary';
import { NO_MEASUREMENTS, weatherAnchor, type MeasurementRunners, type WeatherAnchor } from './measurements';
import { rulesItineraryEngine, findTimeOverlap, detectUnsourcedClaims } from './itineraryEngine';
import {
  materializeSteps,
  validateDrafted,
  type DraftedItinerary,
  type RejectionReason,
} from './itineraryEngine';
import { describeAiFailure } from './aiFailure';
import { dateRange, type DayWeather } from './weather';
import type { AIFailureReason } from '@/lib/ai/providers/types';
import type {
  AdventurePrepDraft,
  GenerationPhaseId,
  ItineraryModel,
  ItineraryStep,
} from '../types';
import type { PlaceInventory } from './places';

/**
 * Les quatre phases de la generation, en pur.
 *
 * Ce module ne fait AUCUN appel reseau et n'importe aucun module serveur-only :
 * il peut donc tourner dans le navigateur. C'est ce qui permet au rail de
 * cocher chaque phase APRES son propre travail, au lieu d'animer un minuteur.
 *
 * La seule phase qui sort du navigateur est la premiere, et elle est injectee
 * sous forme de fonction. En hors-ligne, on lui passe simplement une fonction
 * qui renvoie `null` : le repli regles s'enchaine sans aucune branche speciale.
 */

/**
 * Ce que la frontiere reseau a reellement rapporte.
 *
 * `drafted: null` seul ne suffirait pas : il oblige l'appelant a choisir entre
 * « le service est mort » et « l'utilisateur a coupe l'assistant », et ces deux
 * reponses sont fausses des que la cause est un delai. La cause voyage donc avec
 * la proposition, jusqu'au message affiche.
 */
export interface ProposalResult {
  drafted: DraftedItinerary | null;
  /** Cause reelle du repli, remontee jusqu'a l'ecran. `null` = rien n'a degrade. */
  failure: AIFailureReason | null;
}

/** Recuperation de la proposition : indisponible ou pas, la cause est toujours named. */
export type ProposalFetcher = (
  draft: AdventurePrepDraft,
  signal: AbortSignal,
  // Inventaire reel des lieux disponibles, charge AVANT la redaction. Sans lui
   // le proposeur ne voit que le depart et l arrivee, donc il invente des
   // etapes que `assignPlaces` ne peut pas rattacher. Optionnel : un
   // proposeur qui s en passe (tests, repli) reste valide.
  availablePlaces?: readonly PlaceInventory[],
) => Promise<ProposalResult>;

// Charge l inventaire. Meme forme qu un runner de mesure : le reseau est
// injecte, jamais importe, et le defaut ne pose RIEN — donc un serveur, un
// test ou un rendu statique ne pretendent pas avoir de lieux.
export type PlaceInventoryLoader = (
  draft: AdventurePrepDraft,
  signal: AbortSignal,
) => Promise<PlaceInventory[]>;

const NO_INVENTORY: PlaceInventoryLoader = async () => [];

export const AI_ENRICHMENT_UNAVAILABLE =
  "Parcours construit sur tes critères — l’enrichissement est indisponible.";

export const AI_ACCEPTED =
  'Parcours enrichi par l’IA, puis vérifié : les prix et les disponibilités restent à confirmer.';

export interface GenerationOutcome {
  model: ItineraryModel | null;
  engineId: 'rules' | 'ai';
  /** `true` quand le parcours vient des regles et non du modele. */
  degraded: boolean;
  /** Phrase a afficher telle quelle. `null` quand rien n'a degrade. */
  message: string | null;
  rejectedReason: RejectionReason | null;
  /** Cause reelle du repli, remontee jusqu'a l'ecran. `null` = rien n'a degrade. */
  failure: AIFailureReason | null;
  /**
   * Ce que chaque phase a REELLEMENT livre.
   *
   * C'est ce tableau qui permet de distinguer « la meteo n'a pas abouti » de
   * « la generation est morte ». Il est toujours present, y compris quand tout
   * a reussi : un shell qui lit `phaseHealth(outcome).dead` n'a plus jamais a
   * deviner pourquoi l'assistant semble coupe.
   */
  phases: readonly PhaseOutcome[];
  /**
   * Etapes refusees AVANT affichage, avec le motif de chaque refus.
   *
   * Elles ne sont pas dans le modele, mais leur raison est ici : un parcours
   * qui a retire une idee sans le dire ferait croire qu elle a ete revisee.
   */
  infeasible: readonly FeasibilityFinding[];
  /**
   * Etapes impossibles a trancher faute de source. Elles restent affichees et
   * portent le badge « a verifier » : on ne sait pas, donc on ne pretend pas.
   */
  toVerify: readonly FeasibilityFinding[];
}

export type PhaseReporter = (phase: GenerationPhaseId) => void;

/* ------------------------------------------------------------------ */
/* Phase 1 — analyse de la reponse brute                               */
/* ------------------------------------------------------------------ */

/**
 * Extrait l'objet JSON d'une reponse qui peut etre entouree de prose ou d'un
 * bloc markdown. On echoue si on ne trouve pas exactement un objet : mieux
 * vaut aucun parcours qu'un parcours a moitie lu.
 */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  if (start === -1) return null;
  // Balayage a profondeur plutot que dernierIndexOf : un modele peut ecrire
  // une accolade DANS une chaine ("halle {d-epot}") et un simple
  // premier-dernier decouperait alors le JSON au mauvais endroit.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];
    if (escaped) {
      escaped = false;
    } else if (inString && char === '\\') {
      escaped = true;
    } else if (char === '"') {
      inString = !inString;
    } else if (!inString && char === '{') {
      depth += 1;
    } else if (!inString && char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) return null;
  // Un second objet colle juste apres le premier signale une sortie
  // tronquee ou dupliquee : on ne devine pas laquelle des deux vaut
  // la verite, on renvoie null et le repli regles prend le relais.
  const trailing = withoutFence.slice(end + 1).trimStart();
  if (trailing.startsWith('{')) return null;
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Phase 3 — Disponibilites : ce qui doit imperativement etre reserve   */
/* ------------------------------------------------------------------ */

/**
 * Toute nuit et tout transport demande une reservation : l'etat passe donc a
 * « a reserver ». Le reste reste une proposition. Aucune etape ne passe en
 * « confirme » ici — la confirmation vient de l'utilisateur ou de la
 * communaute, jamais du modele.
 */
export function annotateAvailability(steps: readonly ItineraryStep[]): ItineraryStep[] {
  return steps.map((step) => {
    const needsBooking = step.kind === 'nuit' || step.kind === 'trajet';
    const state = needsBooking ? ('a_reserver' as const) : ('propose' as const);
    return state === step.state ? step : { ...step, state };
  });
}

/* ------------------------------------------------------------------ */
/* Phase 4 — Assemblage                                                */
/* ------------------------------------------------------------------ */

const EMPTY_TOTALS = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
} as const;

/** Etapes materialisees puis classees par ce qui doit etre reserve. */
export function buildSteps(drafted: DraftedItinerary): ItineraryStep[] {
  return annotateAvailability(materializeSteps(drafted, drafted.days));
}

/**
 * Assemblage final. Les etapes sont deja materialisees et annotees : cette
 * fonction ne fait que racorder le modele, les compteurs et les points de
 * repli. Aucune donnee n est ajoutee ici.
 */
export function assembleModel(
  draft: AdventurePrepDraft,
  drafted: DraftedItinerary,
  steps: readonly ItineraryStep[],
): ItineraryModel {
  const days = drafted.days;
  const model: ItineraryModel = {
    days,
    steps: renumberByDay([...steps]),
    totals: { ...EMPTY_TOTALS },
    perDay: Array.from({ length: days }, () => ({ ...EMPTY_TOTALS })),
    // Rempli par la phase `meteo` si le fournisseur repond ; reste vide sinon.
    weather: Array.from({ length: days }, () => null),
    metricsContext: metricsContextFor(draft.activities),
    budgetPerPerson:
      draft.preferences.budgetPerPerson === null
        ? { amount: null, currency: 'EUR', state: 'a_reserver' }
        : {
            amount: draft.preferences.budgetPerPerson,
            currency: 'EUR',
            state: 'propose',
          },
    activityCount: 1 + draft.activities.extra.length,
    contingencies: [],
  };
  return { ...model, contingencies: buildContingencies(model) };
}

/**
 * Une phase de mesure ne doit pas pouvoir faire tomber l'ecran.
 *
 * Le mesureur fourni par l'appelant est une frontiere externe : s'il leve, la
 * phase est tentée, le modele reste tel quel — donc ses `null` — et la
 * generation continue. C'est exactement le meme contrat que le proposeur.
 *
 * Ce qui change ici, c'est que l'echec n'est plus AVALE : il est rendu dans un
 * `PhaseOutcome` nomme. Avant, un `catch { return model }` rendait la panne
 * invisible et le shell ne pouvait plus que la deviner.
 */
async function safely(
  phase: GenerationPhaseId,
  run: MeasurementRunners['trace'],
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  signal: AbortSignal,
  delivered: (measured: ItineraryModel) => boolean,
): Promise<{ model: ItineraryModel; outcome: PhaseOutcome }> {
  try {
    const measured = await run(draft, model, signal);
    // Le runner a rendu un modele, mais sans valeur reelle : ce n est pas une
    // panne, c'est une absence. Les deux se rejouent, ils ne se racontent pas
    // de la meme facon.
    const ok = delivered(measured);
    return {
      model: measured,
      outcome: phaseOutcome(phase, ok ? 'reussie' : 'inverifiable', ok ? null : PHASE_NO_VALUE[phase]),
    };
  } catch {
    return { model, outcome: phaseOutcome(phase, 'echoue', PHASE_RAISED[phase]) };
  }
}

function phaseOutcome(id: GenerationPhaseId, status: PhaseStatus, reason: string | null): PhaseOutcome {
  return { id, status, reason: status === 'reussie' ? null : reason, retryable: true };
}

/**
 * Raisons PAR PHASE, jamais un texte unique.
 *
 * Un message unique pour six pannes differentes oblige la personne a deviner
 * laquelle on lui annonce. Chacune nomme ce qui n'a pas abouti, et — surtout —
 * ne laisse fuir ni nom de fournisseur, ni code HTTP, ni trace d exception.
 */
const PHASE_RAISED: Readonly<Record<GenerationPhaseId, string>> = {
  recherche_parcours:
    'La recherche du parcours n’a pas abouti. Le parcours affiché reste celui construit par les règles.',
  verification_etapes: 'La vérification des étapes n’a pas abouti sur cette proposition.',
  disponibilites: 'Le classement des disponibilités n’a pas abouti.',
  lieux: 'La recherche des lieux réels n’a pas abouti : les étapes restent sans position.',
  trace: 'Le calcul des distances sur le réseau n’a pas abouti : le kilométrage reste à vérifier.',
  meteo: 'La météo des jours de ton aventure n’a pas été mesurée : chaque journée reste à vérifier.',
  synthese: 'La mise en forme finale n’a pas abouti.',
};

/** Le travail a abouti, sans valeur : on ne sait pas, ce n’est pas une panne. */
const PHASE_NO_VALUE: Readonly<Record<GenerationPhaseId, string>> = {
  recherche_parcours:
    'Aucune proposition de parcours n’a été retenue : le parcours affiché reste celui construit par les règles.',
  verification_etapes: 'La vérification des étapes n’a rien trouvé à signaler.',
  disponibilites: 'Le classement des disponibilités n’a rien trouvé à classer.',
  lieux: 'Aucun lieu réel ne couvre ce trajet : les distances restent à vérifier.',
  trace: 'Aucun kilométrage réel n’a été rapporté pour ce parcours : la distance reste à vérifier.',
  meteo: 'Aucune prévision ne couvre les dates de cette aventure : la météo reste à vérifier.',
  synthese: 'La mise en forme n’a rien trouvé à compléter.',
};

/** Une annulation ne produit rien : mieux vaut un ecran intact qu'un modele partiel. */
function abortedOutcome(): GenerationOutcome {
  return {
    model: null,
    engineId: 'rules',
    degraded: true,
    message: null,
    rejectedReason: null,
    failure: null,
    phases: [],
    infeasible: [],
    toVerify: [],
  };
}

/* ------------------------------------------------------------------ */
/* Pilote                                                              */
/* ------------------------------------------------------------------ */

/**
 * Accroche des positions REELS aux etapes du modele.
 *
 * Meme forme qu un runner de mesure : le reseau est injecte, jamais importe.
 * Le defaut ne pose RIEN, ce qui laisse le modele sans position - et donc
 * honnete : le serveur, les tests et le rendu statique ne pretendent pas
 * avoir des lieux.
 */
export type PlaceResolver = (
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  signal: AbortSignal,
) => Promise<ItineraryModel>;

/** Le defaut : aucune position inventee. */
const NO_PLACES: PlaceResolver = async (_draft, model) => model;

/**
 * Le chef d'orchestre des sept phases.
 *
 * Deux invariants tiennent l'ensemble :
 *
 * 1. `onPhase` signale un travail FINI, jamais un travail annonce. Le rail
 *    coche donc « Verification des etapes » une fois la verification rendue
 *    la main, et « Kilometrage routier » une fois le routeur repondu — ou
 *    muet. Cocher a l'annonce ferait du theatre.
 *
 * 2. Le repli regles n'est pas un chemin de secours sans mesures : le
 *    kilometrage et la meteo se calculent sur le parcours produit, quel que
 *    soit le moteur qui l'a ecrit.
 *
 * 3. Le controle de faisabilite passe AVANT la mise en route des mesures :
 *    mesurer le kilometrage d une etape qui va etre refusee serait du travail
 *    paye pour rien, et une distance affichee sur une idee.rangee ferait croire
 *    qu elle tient.
 */
export async function runItineraryGeneration(
  draft: AdventurePrepDraft,
  signal: AbortSignal,
  fetchProposal: ProposalFetcher,
  onPhase: PhaseReporter,
  measure: MeasurementRunners = NO_MEASUREMENTS,
  feasibility: FeasibilityDeps = {},
  resolvePlaces: PlaceResolver = NO_PLACES,
  loadInventory: PlaceInventoryLoader = NO_INVENTORY,
): Promise<GenerationOutcome> {
  // Chaque phase note ce qu elle a REELLEMENT livre. Ce tableau est la seule
  // source de verite pour « phase tombee » vs « generation morte ».
  const phases: PhaseOutcome[] = [];
  /** Les refus et les incertitudes accumules, dans l'ordre ou ils sont survenus. */
  const infeasible: FeasibilityFinding[] = [];
  const toVerify: FeasibilityFinding[] = [];
  // 1. Recherche du parcours — la seule phase reseau du proposeur.
  // Le proposeur est une frontiere reseau : il peut rejeter pour une raison
  // que l'utilisateur n'a pas a connaitre. Toute rejection est un « pas de
  // proposition », jamais une exception qui casserait l'ecran de preparation.
  let drafted: DraftedItinerary | null = null;
  let failure: AIFailureReason | null = null;
  // L inventaire se charge AVANT la redaction, jamais apres : c est lui qui
  // dit au proposeur ce qui existe. Le charger apres reviendrait a lui envoyer
  // un parcours deja ecrit hors des lieux du corridor.
  let inventory: readonly PlaceInventory[] = [];
  try {
    inventory = await loadInventory(draft, signal);
  } catch {
    // Un depot de POIS muet ne doit pas etre pire que pas d inventaire du
    // tout : le proposeur ecrira alors comme avant, et le repli regles prend
    // le relais comme il le fait pour toute frontiere reseau tombee.
    inventory = [];
  }
  try {
    const proposal = await fetchProposal(draft, signal, inventory);
    drafted = proposal.drafted;
    failure = proposal.failure;
  } catch {
    // Un proposeur qui leve est une frontiere reseau tombee, pas une annulation :
    // le parcours doit quand meme etre construit par les regles, et la cause
    // doit etre nommee plutot que devinee.
    drafted = null;
    failure = 'provider_indisponible';
  }
  if (signal.aborted) return abortedOutcome();
  // La recherche est finie, qu'elle ait trouve ou non : on coche, puis on
  // regarde ce qu'elle a rapporte.
  onPhase('recherche_parcours');
  // Une frontiere reseau qui leve n est pas une generation morte : le repli
  // regles produit un parcours. La phase est donc NOTEE, pas declaree morte.
  phases.push(
    drafted
      ? phaseOutcome('recherche_parcours', 'reussie', null)
      : phaseOutcome('recherche_parcours', 'echoue', PHASE_RAISED.recherche_parcours),
  );

  let model: ItineraryModel | null = null;
  let engineId: GenerationOutcome['engineId'] = 'rules';
  let degraded = false;
  let message: string | null = null;
  let rejectedReason: RejectionReason | null = null;

  if (drafted !== null) {
    // 2. Verification des etapes — invariants metier, sur les donnees reelles.
    const verdict = validateDrafted(drafted);
    onPhase('verification_etapes');
    phases.push(
      verdict.ok
        ? phaseOutcome('verification_etapes', 'reussie', null)
        : phaseOutcome('verification_etapes', 'echoue', verdict.detail),
    );

    if (verdict.ok) {
      // 3. Faisabilite — AVANT toute mesure et avant l'affichage. On raisonne
      //    sur les etapes materialisees, donc sur les memes objets que ceux qui
      //    seront rendus : le controle porte sur ce qui est reellement propose.
      const screened = await screenFeasibility(draft, buildSteps(drafted), feasibility);
      infeasible.push(...screened.dropped);
      toVerify.push(...screened.toVerify);
      if (signal.aborted) return abortedOutcome();

      if (screened.kept.length > 0) {
        // 4. Disponibilites — classement de ce qui doit imperativement etre reserve.
        const steps = renumberByDay([...screened.kept]);
        onPhase('disponibilites');
        phases.push(phaseOutcome('disponibilites', 'reussie', null));
        // 5. Modele de base : compteurs, contexte, points de repli. Les mesures
        //    partent de la, jamais d'un modele a moitie construit.
        model = assembleModel(draft, drafted, steps);
        engineId = 'ai';
        message = AI_ACCEPTED;
      } else {
        // Toute la proposition etait infaisable. Elle ne disparait pas sans
        // bruit : les motifs restent dans `infeasible`, et le repli regles prend
        // le relais pour qu un ecran vide ne remplace jamais un parcours.
        onPhase('disponibilites');
        phases.push(phaseOutcome('disponibilites', 'echoue', infeasible[0]?.reason ?? null));
      }
    } else {
      rejectedReason = verdict.reason;
    }
  }

  if (!model) {
    // Repli regles. Le moteur historique construit, verifie et classe ses
    // propres etapes : les phases 2 et 3 ont donc bien eu lieu, par lui.
    model = await rulesItineraryEngine.generate(draft, signal);
    degraded = true;
    // Un brouillon incomplet n'est pas une degradation : il n'y a rien a
    // construire, et afficher un avertissement serait mentiraire.
    // La cause connue PRIME : le message generique ne doit apparaitre que
    // lorsqu on ne sait rien, jamais quand on sait pourquoi.
    message = model ? describeAiFailure(failure) ?? AI_ENRICHMENT_UNAVAILABLE : null;
    if (signal.aborted) {
      return { model: null, engineId, degraded, message: null, rejectedReason, failure, phases, infeasible, toVerify };
    }
    onPhase('verification_etapes');
    onPhase('disponibilites');
    // Le moteur de regles fait ce travail lui-meme, sur ses propres etapes.
    phases.push(
      phaseOutcome('verification_etapes', model ? 'reussie' : 'echoue', model ? null : PHASE_RAISED.verification_etapes),
      phaseOutcome('disponibilites', model ? 'reussie' : 'echoue', model ? null : PHASE_RAISED.disponibilites),
    );
  }
  if (signal.aborted || !model) {
    return { model: null, engineId, degraded, message: null, rejectedReason, failure, phases, infeasible, toVerify };
  }

  // 4 bis. Les LIEUX, avant toute mesure. Le moteur assemble des etapes sans
  // position ; c est ici qu on leur accroche des points d interet REELS. Sans
  // cette phase, aucune chaine a router n existe et le kilometrage resterait a
  // verifier indefiniment - les fournisseurs, eux, repondent.
  const placed = await safely('lieux', resolvePlaces, draft, model, signal, (m) =>
    m.steps.some((step) => step.lat !== null && step.lon !== null),
  );
  model = placed.model;
  phases.push(placed.outcome);
  if (signal.aborted) {
    return { model: null, engineId, degraded, message: null, rejectedReason, failure, phases, infeasible, toVerify };
  }
  onPhase('lieux');

  // 5. Kilometrage routier et denivele, jour par jour. Un routeur muet laisse
  //    la mesure a null : elle n'est ni comptee a zero ni approchee.
  const traced = await safely('trace', measure.trace, draft, model, signal, (m) =>
    m.totals.distanceKm !== null,
  );
  model = traced.model;
  phases.push(traced.outcome);
  if (signal.aborted) {
    return { model: null, engineId, degraded, message: null, rejectedReason, failure, phases, infeasible, toVerify };
  }
  onPhase('trace');

  // 6. Meteo des dates reelles. Un fournisseur muet laisse la journee a null.
  const measured = await safely('meteo', measure.weather, draft, model, signal, (m) =>
    m.weather.length === m.days && m.days > 0 && m.weather.some((day) => day !== null),
  );
  model = measured.model;
  phases.push(measured.outcome);
  if (signal.aborted) {
    return { model: null, engineId, degraded, message: null, rejectedReason, failure, phases, infeasible, toVerify };
  }
  onPhase('meteo');

  // 7. Mise en forme finale.
  onPhase('synthese');
  phases.push(phaseOutcome('synthese', 'reussie', null));
  return { model, engineId, degraded, message, rejectedReason, failure, phases, infeasible, toVerify };
}


/* ------------------------------------------------------------------ */
/* P0.2 — La meteo du programme, telle que l ecran la consomme         */
/* ------------------------------------------------------------------ */

/**
 * Une journee du programme, avec SA date reelle et SA meteo mesuree.
 *
 * `status` est ce que l'ecran doit regarder, pas `weather` : `mesuree` signifie
 * « une valeur reelle existe pour CETTE date », `absente` signifie « personne ne
 * l'a mesuree ». Conflondre les deux ferait afficher « meteo indisponible »
 * pour une journee que le fournisseur couvre parfaitement.
 */
export interface ProgramWeatherDay {
  /** 1-based : le jour 1 du sejour, comme partout ailleurs dans le moteur. */
  readonly day: number;
  /** `null` quand le brouillon n'a pas de date de depart. Jamais une date devinee. */
  readonly date: string | null;
  readonly weather: DayWeather | null;
  readonly status: 'mesuree' | 'absente';
}

export interface ProgramWeather {
  /** Le point interroge pour la meteo, ou `null` si aucun lieu n'est connu. */
  readonly anchor: WeatherAnchor | null;
  /** Les dates reellement mesurees, ou `null` sans date de depart. */
  readonly dates: readonly string[] | null;
  readonly days: readonly ProgramWeatherDay[];
  readonly measuredCount: number;
  /** `true` seulement si TOUTES les journees sont mesurees. Jamais « presque ». */
  readonly complete: boolean;
  /** Phrase honnete expliquant l'absence, ou `null` quand tout est mesure. */
  readonly reason: string | null;
}

const REASON_NO_DATE =
  'Date de départ inconnue : la météo n’a pas pu être mesurée.';

/**
 * L'ancre de la meteo, y compris quand aucun parcours n'existe encore.
 *
 * `weatherAnchor` exige un modele ; on ne lui en fabrique pas un, on applique
 * simplement la meme regle sur le brouillon seul. Le depart choisi reste la
 * decision unique qui gouverne la selection comme la requete.
 */
function anchorFor(
  draft: AdventurePrepDraft,
  model: ItineraryModel | null,
): WeatherAnchor | null {
  if (model) return weatherAnchor(draft, model);
  const origin = draft.route.origin;
  return origin ? { lat: origin.lat, lon: origin.lon } : null;
}

/**
 * La meteo du programme, jour par jour, PRETE A AFFICHER.
 *
 * Ce module ne fait aucun appel reseau : la mesure a deja eu lieu pendant la
 * phase `meteo` (via `/api/weather`), et cette fonction ne fait que la mettre en
 * forme. C'est ce qui permet a l'ecran de consommer le resultat sans jamais
 * pouvoir le confondre avec une donnee inventee.
 *
 * Un brouillon vierge (`startDate === null`) ne leve rien : les journees sont
 * listees sans date, toutes en `absente`, et `reason` dit pourquoi. C'est la
 * seule reponse honete tant que la personne n'a pas choisi de date.
 */
export function programWeather(
  draft: AdventurePrepDraft,
  model: ItineraryModel | null,
): ProgramWeather {
  const anchor = anchorFor(draft, model);
  const days = model?.days ?? 0;
  const dates = days > 0 ? dateRange(draft.calendar.startDate, days) : null;

  const perDay: ProgramWeatherDay[] = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const date = dates ? (dates[index] ?? null) : null;
    // On ne lit la mesure du modele que si la date existe ET que la mesure porte
    // bien sur CETTE date. Sans ce second test, un jour sans date afficherait la
    // meteo du jour 1 decalee — exactement le decalage que la route interdit.
    const measured = date ? model?.weather[index] ?? null : null;
    return {
      day,
      date,
      weather: measured,
      status: measured ? ('mesuree' as const) : ('absente' as const),
    };
  });

  const measuredCount = perDay.filter((day) => day.status === 'mesuree').length;
  const complete = perDay.length > 0 && measuredCount === perDay.length;

  return {
    anchor,
    dates,
    days: perDay,
    measuredCount,
    complete,
    reason: complete
      ? null
      : dates
        ? `${measuredCount} journée${measuredCount > 1 ? 's' : ''} mesurée${measuredCount > 1 ? 's' : ''} sur ${perDay.length} — les autres restent à vérifier.`
        : REASON_NO_DATE,
  };
}

/** La meteo d'UNE journee du programme, ou `null` si le jour n'existe pas. */
export function weatherOnDay(
  program: ProgramWeather,
  day: number,
): ProgramWeatherDay | null {
  if (!Number.isInteger(day) || day < 1 || day > program.days.length) return null;
  return program.days[day - 1] ?? null;
}




/* ------------------------------------------------------------------ */
/* P0.3 — Reprise d UNE SEULE phase                                     */
/* ------------------------------------------------------------------ */

export interface PhaseRetryDeps {
  /** Les deux mesures. Sans elles, `trace` et `meteo` ne sont pas rejouables. */
  readonly measure?: MeasurementRunners;
  /** Le proposeur, uniquement necessaire pour rejouer `recherche_parcours`. */
  readonly fetchProposal?: ProposalFetcher;
  /**
   * Le resolveur de lieux, et l inventaire qui l alimente.
   *
   * Sans eux, rejouer `recherche_parcours` replace un modele entier dont AUCUNE
   * etape ne porte de position : plus aucune chaine a router, donc plus aucun
   * kilometre, plus aucun denivele et plus aucun point sur la carte. Une reprise
   * qui degrade le parcours qu elle vient de reparer est pire qu une reprise
   * refusee, donc le moteur ne simule pas ces dependances : il les exige.
   */
  readonly resolvePlaces?: PlaceResolver;
  readonly loadInventory?: PlaceInventoryLoader;
}

export interface PhaseRetry {
  readonly phase: GenerationPhaseId;
  /**
   * Le modele APRES la reprise. En cas d echec, c'est EXACTEMENT l objet
   * passe en parametre : une reprise ratee ne doit jamais demarrer un parcours
   * a moitie mesure, ni Muter celui que la personne vient de corriger.
   */
  readonly model: ItineraryModel;
  readonly outcome: PhaseOutcome;
}

/** Le trace a-t-il produit une distance reelle ? */
function traceDelivered(model: ItineraryModel): boolean {
  return model.totals.distanceKm !== null;
}

/** La meteo a-t-elle couvert au moins une journee reelle ? */
function weatherDelivered(model: ItineraryModel): boolean {
  return model.days > 0 && model.weather.some((day) => day !== null);
}

function failed(phase: GenerationPhaseId, reason: string, retryable = true): PhaseOutcome {
  return { id: phase, status: 'echoue', reason, retryable };
}

/**
 * Rejoue UNE phase, sans reconstruire le reste.
 *
 * C'est la fonction que le shell doit appeler derriere un bouton « Reessayer »
 * pose sur une phase tombee. Ses trois garanties :
 *
 * 1. Une phase de mesure ne rejoue QUE son runner. Le kilometrage deja mesure
 *    survit a une reprise de la meteo, et reciproquement : sinon « reessayer »
 *    effacerait du travail deja fait.
 * 2. Une reprise qui echoue rend le modele INTACT et nomme la phase. Elle ne
 *    remplace jamais le parcours par un objet a moitie construit.
 * 3. Une phase inconnue est refusee avec un message clair, pas un `undefined`
 *    qui remonterait trois composants plus loin.
 */
export async function retryGenerationPhase(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  phase: GenerationPhaseId,
  deps: PhaseRetryDeps = {},
  signal: AbortSignal = new AbortController().signal,
): Promise<PhaseRetry> {
  if (!isPhaseId(phase)) {
    return { phase, model, outcome: { ...failed(phase, 'Cette étape de préparation n’existe pas.'), retryable: false } };
  }
  if (signal.aborted) {
    return { phase, model, outcome: failed(phase, 'Reprise interrompue avant son départ.') };
  }

  // Les deux phases de mesure : un runner injecte, jamais le reseau direct.
  // La cle du runner ne porte pas le meme nom que la phase : le rail parle de
  // « meteo », le mesureur expose `weather`. Ce decouplage est volontaire, il
  // faut donc le nommer explicitement plutot que d'indexer a l aveugle.
  if (phase === 'trace' || phase === 'meteo') {
    const runner = phase === 'trace' ? deps.measure?.trace : deps.measure?.weather;
    if (!runner) {
      return { phase, model, outcome: failed(phase, PHASE_RAISED[phase]) };
    }
    const delivered = phase === 'trace' ? traceDelivered : weatherDelivered;
    const result = await safely(phase, runner, draft, model, signal, delivered);
    return { phase, model: result.model, outcome: result.outcome };
  }

  // Les phases de texte : recalculees sur le modele existant, sans reseau.
  if (phase === 'verification_etapes') {
    // Meme verification que celle de la generation, sur les etapes REELLES
    // affichees : c est la seule qui puisse attraper un chevauchement introduit
    // apres coup (une etape ajoutee a la main, une heure modifiee).
    const overlap = findTimeOverlap(model.steps);
    if (overlap) {
      return {
        phase,
        model,
        outcome: failed(
          phase,
          'Deux étapes se chevauchent sur la même journée : la journée affichée doit être corrigée.',
        ),
      };
    }
    const claimed = model.steps.some(
      (step) =>
        detectUnsourcedClaims(step.title).length > 0 ||
        detectUnsourcedClaims(step.reason).length > 0,
    );
    if (claimed) {
      return {
        phase,
        model,
        outcome: failed(phase, 'Une étape affirme un prix ou une disponibilité qui n’est pas vérifiée.'),
      };
    }
    return { phase, model, outcome: phaseOutcome(phase, 'reussie', null) };
  }

  if (phase === 'disponibilites') {
    const steps = annotateAvailability(model.steps);
    return {
      phase,
      model: { ...model, steps: renumberByDay(steps) },
      outcome: phaseOutcome(phase, 'reussie', null),
    };
  }

  if (phase === 'synthese') {
    return {
      phase,
      model: { ...model, contingencies: buildContingencies(model) },
      outcome: phaseOutcome(phase, 'reussie', null),
    };
  }

  // recherche_parcours : la seule reprise qui replace un modele entier.
  if (!deps.fetchProposal) {
    return { phase, model, outcome: failed(phase, PHASE_RAISED.recherche_parcours) };
  }
  const outcome = await runItineraryGeneration(
    draft,
    signal,
    deps.fetchProposal,
    () => {},
    deps.measure ?? NO_MEASUREMENTS,
    {},
    deps.resolvePlaces,
    deps.loadInventory,
  );
  if (!outcome.model) {
    return { phase, model, outcome: failed(phase, PHASE_RAISED.recherche_parcours) };
  }
  // Les mesures deja acquises survivent a une nouvelle proposition, mais
  // seulement si le nombre de jours n'a pas bouge : une serie datee d'un autre
  // sejour ne peut pas etre recollee sur un parcours qui en compte un autre.
  const previous = model.days === outcome.model.days ? model : null;
  return {
    phase,
    model: previous
      ? {
          ...outcome.model,
          totals: previous.totals,
          perDay: previous.perDay,
          weather: previous.weather,
        }
      : outcome.model,
    outcome: phaseOutcome(phase, 'reussie', null),
  };
}




/* ------------------------------------------------------------------ */
/* P0.4 — Faisabilite : ce qui ne peut pas etre propose, et pourquoi    */
/* ------------------------------------------------------------------ */

/**
 * Un garde-fou n annule pas une idee, il en refuse l affichage.
 *
 * Le modele propose. Il ne connait ni le nombre d enfants du groupe, ni la
 * distance reelle au rivage, ni l effectif present le jour venu. Le moteur,
 * lui, connait ces trois faits — ou sait qu il ne les connait pas.
 *
 * Deux principes, dans cet ordre :
 *
 * 1. Une impossibilite se retire et se NOMME. « Regate en mer » proposee a
 *    120 km de la cote, c est une idee.rangee, pas une idee a polir. La
 *    retirer sans rien dire laisserait croire que le parcours a ete revise.
 * 2. Une incertitude ne se retire pas. Si aucune source n a mesure la
 *    distance au rivage, on ne peut pas dire « c est loin » : on dit « a
 *    verifier ». Rejeter sur une donnee inventeee serait exactement le
 *    travers que la regle du projet interdit.
 */

/** Les cinq impossibilites qu une proposition ne peut pas franchir. */
export type FeasibilityRule =
  | 'plongee_avec_mineurs'
  | 'nautique_hors_rivage'
  | 'coordonnees_hors_plage'
  | 'effectif_insuffisant'
  | 'encadrement_adulte_manquant';

export interface FeasibilityFinding {
  readonly stepId: string;
  readonly day: number;
  readonly title: string;
  readonly rule: FeasibilityRule;
  /**
   * Phrase complete, affichable telle quelle. Elle porte TOUJOURS le fait qui
   * a provoque le refus — un code de regle seul ne s explique a personne.
   */
  readonly reason: string;
}

export interface FeasibilityVerdict {
  readonly kept: readonly ItineraryStep[];
  /** Etapes refusees : elles ne seront pas affichees, mais leur motif survit. */
  readonly dropped: readonly FeasibilityFinding[];
  /** Impossible a trancher sans une source : ni refusee, ni affirmee. */
  readonly toVerify: readonly FeasibilityFinding[];
}

/**
 * Distance au rivage le plus proche, en kilometres.
 *
 * `null` = la source n a pas repondu. Cette valeur ne se deduit jamais, ne
 * s approxime pas et ne se remplace pas par un defaut : elle n existe pas.
 */
export type ShoreDistanceProbe = (step: ItineraryStep) => Promise<number | null>;

export interface FeasibilityDeps {
  /**
   * Sonde geographique injectee, sur le meme modele que le routage et la
   * meteo : le moteur reste pur, la frontiere reseau reste dehors. Sans sonde,
   * aucune activite nautique n est affirmee ni refusee.
   */
  readonly distanceToShoreKm?: ShoreDistanceProbe;
  /** Au-dela, l eau est hors d portee a pied. 25 km par defaut. */
  readonly shoreLimitKm?: number;
}

/** Ce qui distingue une impossibilite d une simple incertitude. */
const SHORE_LIMIT_KM = 25;

/* Vocabulaire des regles. Volontairement etroit : on ne traque pas tout le
   vocabulaire du nautique, seulement les formulations qui engagent. */

const DIVING = /\bplong(?:ée|ee|e)\b|\bscuba\b|\bpalier|\bbouteille|\bprofondeur|\bcr(?:â|a)ne?\b/i;
const NAUTICAL =
  /\br(?:é|e)gate\b|\bvoilier\b|\bsailboat\b|\bkayak\b|\bcano(?:ë|e)?\b|\bradeau\b|planche [àa] voile|\bjet-?ski\b|nage en mer|\bbaignade\b|\bmer\b|\bmarine\b|open ?water/i;
const SUPERVISION =
  /\bencadr\w*\b|\bmoniteur\b|\bmonitrice\b|\baccompagnateur\b|\badulte\b|\bresponsable\b/i;

/** « minimum 6 personnes », « à partir de 4 pers », « 3 participants au moins ». */
const MIN_PARTICIPANTS =
  /(?:minimum|min\.?|a partir de|au moins|from)\s*:?\s*(\d+)\s*(?:pers\b|personnes\b|participants\b)/i;
const MIN_PARTICIPANTS_SUFFIX =
  /\b(\d+)\s*(?:pers\b|personnes\b|participants\b)\s*(?:minimum|au moins)\b/i;

const groupSize = (draft: AdventurePrepDraft): number =>
  Math.max(0, draft.group.adults) + Math.max(0, draft.group.children);

/** Le plus petit effectif qu une etape s impose, ou `null` si elle n en impose pas. */
function declaredMinimum(text: string): number | null {
  const match = MIN_PARTICIPANTS.exec(text) ?? MIN_PARTICIPANTS_SUFFIX.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Tout ce qu une etape affirme, dans les deux champs qui sont lus a l'ecran. */
function stepText(step: ItineraryStep): string {
  return [step.title, step.reason, step.placeName].filter(Boolean).join(' ');
}

/** Les coordonnees doivent etre sur Terre. Sinon, c est une invention. */
function offEarth(step: ItineraryStep): boolean {
  const { lat, lon } = step;
  if (lat === null && lon === null) return false;
  if (lat === null || lon === null) return true;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return true;
  return lat < -90 || lat > 90 || lon < -180 || lon > 180;
}

function finding(step: ItineraryStep, rule: FeasibilityRule, reason: string): FeasibilityFinding {
  return { stepId: step.id, day: step.day, title: step.title, rule, reason };
}

/**
 * Les regles qui ne dependent d'aucune mesure : elles sont vraies ou fausses,
 * et « faux » veut dire refuser.
 */
function impossibleWithoutMeasure(
  draft: AdventurePrepDraft,
  step: ItineraryStep,
): FeasibilityFinding | null {
  const text = stepText(step);

  if (draft.group.children > 0 && DIVING.test(text)) {
    return finding(
      step,
      'plongee_avec_mineurs',
      `Ton groupe compte ${draft.group.children} enfant${draft.group.children > 1 ? 's' : ''} : « ${step.title} » exige une plongée encadrée, elle ne peut pas leur être proposée.`,
    );
  }

  if (offEarth(step)) {
    return finding(
      step,
      'coordonnees_hors_plage',
      `« ${step.title} » porte des coordonnées qui n’existent pas sur Terre : cette étape ne peut pas être affichée telle quelle.`,
    );
  }

  const minimum = declaredMinimum(text);
  const size = groupSize(draft);
  if (minimum !== null && minimum > size) {
    return finding(
      step,
      'effectif_insuffisant',
      `« ${step.title} » demande au moins ${minimum} personnes, ton groupe en compte ${size} : elle n’est pas possible telle quelle.`,
    );
  }

  if (draft.group.adults === 0 && SUPERVISION.test(text)) {
    return finding(
      step,
      'encadrement_adulte_manquant',
      `« ${step.title} » demande un encadrement adulte, aucun adulte n’est inscrit dans ton groupe : elle ne peut pas être proposée.`,
    );
  }

  return null;
}

/**
 * Passe de faisabilite, executee AVANT l'affichage.
 *
 * Elle ne repond jamais par un nombre invente : quand la source mute, l etape
 * passe de l autre cote — elle est signalee « a verifier », ce qui laisse
 * l affichage dire la verite au lieu de la deviner.
 */
export async function screenFeasibility(
  draft: AdventurePrepDraft,
  steps: readonly ItineraryStep[],
  deps: FeasibilityDeps = {},
): Promise<FeasibilityVerdict> {
  const kept: ItineraryStep[] = [];
  const dropped: FeasibilityFinding[] = [];
  const toVerify: FeasibilityFinding[] = [];

  for (const step of steps) {
    const impossible = impossibleWithoutMeasure(draft, step);
    if (impossible) {
      dropped.push(impossible);
      continue;
    }

    // Seule regle qui a besoin d une mesure. C est aussi la seule dont la
    // source peut disparaitre : d ou les deux issues possibles.
    if (NAUTICAL.test(stepText(step))) {
      const probe = deps.distanceToShoreKm;
      if (!probe) {
        toVerify.push(
          finding(
            step,
            'nautique_hors_rivage',
            `« ${step.title} » est une activité sur l’eau : sa distance au rivage n’a pas été mesurée, elle reste à vérifier.`,
          ),
        );
        kept.push(step);
        continue;
      }
      let km: number | null = null;
      try {
        km = await probe(step);
      } catch {
        km = null;
      }
      if (km === null || !Number.isFinite(km)) {
        // La sonde a muete : personne ne sait. On garde l etape ET on le dit.
        toVerify.push(
          finding(
            step,
            'nautique_hors_rivage',
            `« ${step.title} » est une activité sur l’eau : la distance au rivage n’a pas pu être mesurée, elle reste à vérifier.`,
          ),
        );
        kept.push(step);
        continue;
      }
      const limit = deps.shoreLimitKm ?? SHORE_LIMIT_KM;
      if (km > limit) {
        dropped.push(
          finding(
            step,
            'nautique_hors_rivage',
            `« ${step.title} » est proposée à ${km} km du rivage le plus proche : l’eau est hors d’atteinte depuis ton parcours.`,
          ),
        );
        continue;
      }
    }

    kept.push(step);
  }

  return { kept, dropped, toVerify };
}

export interface FeasibilityResult {
  readonly model: ItineraryModel;
  readonly dropped: readonly FeasibilityFinding[];
  readonly toVerify: readonly FeasibilityFinding[];
}

/**
 * Applique le verdict a un modele deja construit.
 *
 * Une etape retiree laisse un trou dans la numerotation : les ordres sont donc
 * renumerotes, sinon l ecran afficherait « 1, 3 » et laisserait croire a une
 * etape manquante.
 */
export async function applyFeasibility(
  draft: AdventurePrepDraft,
  model: ItineraryModel,
  deps: FeasibilityDeps = {},
): Promise<FeasibilityResult> {
  const verdict = await screenFeasibility(draft, model.steps, deps);
  if (verdict.dropped.length === 0) {
    return { model, dropped: [], toVerify: verdict.toVerify };
  }
  return {
    model: { ...model, steps: renumberByDay([...verdict.kept]) },
    dropped: verdict.dropped,
    toVerify: verdict.toVerify,
  };
}
