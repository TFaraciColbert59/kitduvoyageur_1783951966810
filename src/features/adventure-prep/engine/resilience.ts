import type { Contingency, ItineraryModel } from '../types';

/* ------------------------------------------------------------------ */
/* Hors ligne - ecran transverse 70                                   */
/* ------------------------------------------------------------------ */

/**
 * Une action reseau REELLEMENT indisponible, avec la raison affichee.
 *
 * Pourquoi `reason` est obligatoire dans le type : un controle grise sans
 * explication est exactement ce que cet ecran interdit. Si l'on ne sait pas
 * dire pourquoi, ce n'est pas une indisponibilite, c'est une panne d'affichage.
 */
export interface OfflineUnavailableAction {
  /** Cle stable : un enfant compare son action a cette cle, jamais au texte. */
  id: string;
  label: string;
  reason: string;
}

export interface OfflineReadiness {
  /** `true` = le programme local est complet et lisible sans reseau. */
  programReady: boolean;
  /** Phrase prete a afficher : ce qui reste accessible, en mots simples. */
  summary: string;
  /** Une entree par action reseau reellement indisponible. */
  unavailable: readonly OfflineUnavailableAction[];
}

export interface OfflineReadinessInput {
  /** Le programme deja produit ; `null` tant que rien n'a ete construit. */
  model: ItineraryModel | null;
  online: boolean;
  /** `false` = l'assistant est coupe pour cette aventure. */
  aiEnabled: boolean;
  /** Nombre d'etapes a compter ; par defaut, celui du modele. */
  stepsCount?: number;
}

/**
 * Cles des actions reseau du preparateur.
 *
 * Le preparateur n'a QU'UN appel reseau : `fetchItineraryProposal`
 * (`src/app/prepare/actions.ts`), l'enrichissement IA du parcours. La recherche
 * de lieu filtre un cache local et la lecture des participations aussi. On ne
 * declare donc aucune action fantome « synchronisation » : une entree
 * d'indisponibilite sans action derriere est du bruit, et du bruit apprend a
 * ignorer le bandeau.
 */
export const OFFLINE_ACTION = {
  itineraireIA: 'itineraire-ia',
} as const;

/*
 * Raisons distinctes, jamais un texte unique reutilise : l'utilisateur doit
 * pouvoir distinguer « pas de reseau » de « assistant coupe », parce que seule
 * la premiere se resout en attendant. Un message unique pour les deux cas
 * obligerait a deviner laquelle des deux il faut faire.
 */
const LABEL_IA = 'Enrichissement du parcours par l’assistant';

const REASON_IA_COUPE =
  'L’assistant n’est pas activé pour cette aventure. Le moteur par règles prend le relais : le programme se construit déjà, sans lui, et rien ne reste bloqué.';

const REASON_AUCUN_RESEAU =
  'Sans réseau, l’appel à l’assistant ne peut pas partir. Il repartira dès le retour de la connexion ; en attendant, tu peux continuer à corriger le parcours et à tout confirmer à la main.';

/**
 * Compte les etapes.
 *
 * Un `stepsCount` fourni l'emporte TOUJOURS, meme aberrant : negatif, infini
 * ou NaN retombent sur zero. Reprendre silencieusement le compte du modele
 * afficherait un nombre d'etapes plausible mais faux — exactement l'invention
 * que ce module interdit ailleurs.
 */
function countSteps({ model, stepsCount }: OfflineReadinessInput): number {
  if (stepsCount === undefined) return model?.steps.length ?? 0;
  if (!Number.isFinite(stepsCount)) return 0;
  return Math.max(0, Math.trunc(stepsCount));
}

function recordedStepsLabel(count: number): string {
  if (count === 0) return 'Aucune étape enregistrée';
  if (count === 1) return '1 étape enregistrée';
  return `${count} étapes enregistrées`;
}

/**
 * La phrase affichee dit CE QUI RESTE, pas ce qui manque : c'est la seule
 * information utile quand le reseau tombe. Le compte vient de la donnee, donc
 * le composant n'a jamais de chaine de secours a maintenir en parallele.
 */
function buildSummary(count: number): string {
  return `${recordedStepsLabel(count)} — le programme, la carte et les étapes restent sur cet appareil, lisibles sans réseau.`;
}

/**
 * Reseau manquant ET assistant coupe : on annonce les deux plutot que d'en
 * choisir un. Le reseau est la cause PROCHE, l'assistant coupe une seconde
 * qu'aucune patience ne resoudra.
 */
function aiUnavailableReason(online: boolean, aiEnabled: boolean): string {
  if (!online && !aiEnabled) return `${REASON_AUCUN_RESEAU} ${REASON_IA_COUPE}`;
  if (!online) return REASON_AUCUN_RESEAU;
  return REASON_IA_COUPE;
}

/** Une entree, et seulement si l'action est reellement indisponible. */
function unavailableActions({ online, aiEnabled }: OfflineReadinessInput): OfflineUnavailableAction[] {
  if (online && aiEnabled) return [];
  return [
    {
      id: OFFLINE_ACTION.itineraireIA,
      label: LABEL_IA,
      reason: aiUnavailableReason(online, aiEnabled),
    },
  ];
}

/**
 * Etat hors-ligne calcule, en pur : ni `window`, ni `navigator`, ni Date.
 *
 * Le composant ne fait que le lire. Toute la decision — ce qui reste lisible,
 * ce qui est reellement coupe, et pourquoi — vit ici, donc elle se verifie
 * sans DOM, sans evenement reseau et sans rendu.
 *
 * Immuabilite : chaque appel renvoie des objets neufs et un tableau neuf ;
 * l'entree recue n'est jamais lue puis reecrite.
 */
export function offlineReadiness(input: OfflineReadinessInput): OfflineReadiness {
  const count = countSteps(input);
  return {
    // Un programme sans aucune etape n'est pas « pret » : il n'y a rien a lire.
    // L'annoncer pret serait le meme mensonge qu'un bouton grise sans raison.
    programReady: count > 0,
    summary: buildSummary(count),
    unavailable: unavailableActions(input),
  };
}

/** Les sept aleas prevus, filtres selon ce que le parcours reellement contient. */
export function buildContingencies(model: ItineraryModel | null): ItineraryModel['contingencies'] {
  if (!model) return [];
  const steps = model.steps;
  const hasNight = steps.some((step) => step.kind === 'nuit');
  const hasBooking = steps.some((step) => step.state === 'a_reserver');
  const hasUnknownPrice = steps.some((step) => step.price.amount === null);
  const bivouac = steps.some((step) => step.kind === 'nuit' && step.title === 'Nuit en bivouac');
  const longTrip = model.days > 1;
  const hasLeg = steps.some((step) => step.kind === 'trajet');
  const outdoor = model.metricsContext === 'terrain' || model.metricsContext === 'voyage';

  const list: Contingency[] = [
    {
      kind: 'hors_ligne',
      trigger: 'Tu perds le réseau en chemin',
      action: 'Ton parcours reste lisible hors ligne, comme la carte téléchargée.',
      affectedStepIds: [] as string[],
      prepared: true,
    },
    {
      kind: 'ia_indisponible',
      trigger: 'Le service d’aide ne répond plus',
      action: 'Tu peux continuer à corriger le parcours à la main, étape par étape.',
      affectedStepIds: [] as string[],
      prepared: true,
    },
  ];

  if (outdoor) {
    list.push({
      kind: 'pluie',
      trigger: 'De la pluie pendant une étape',
      action: 'Chaque étape indique si elle peut être courte, remplacée ou décalée.',
      affectedStepIds: steps.filter((s) => s.kind !== 'nuit').map((s) => s.id),
      prepared: false,
    });
  }

  if (hasBooking) {
    list.push({
      kind: 'fermeture',
      trigger: 'Un hébergement ou un trajet refuse la réservation',
      action: 'Les étapes marquées « à réserver » sont regroupées ici.',
      affectedStepIds: steps.filter((s) => s.state === 'a_reserver').map((s) => s.id),
      prepared: false,
    });
  }

  if (hasNight) {
    list.push({
      kind: 'hebergement_indisponible',
      trigger: 'La nuit prévue n’est plus disponible',
      action: bivouac
        ? 'Ton bivouac reste une option : le spot précis est à trouver.'
        : 'Prévois une nuit de secours avant de partir.',
      affectedStepIds: steps.filter((s) => s.kind === 'nuit').map((s) => s.id),
      prepared: bivouac,
    });
  }

  if (longTrip && hasLeg) {
    list.push({
      kind: 'retard',
      trigger: 'Un transport arrive en retard',
      action: 'Les jours suivants gardent de la marge : rien n’est calé à la minute.',
      affectedStepIds: steps.filter((s) => s.kind === 'trajet').map((s) => s.id),
      prepared: false,
    });
  }

  if (hasUnknownPrice) {
    list.push({
      kind: 'offre_absente',
      trigger: 'Un prix n’est pas encore connu',
      action: 'Les montants vides restent « à vérifier » au lieu d’un chiffre inventé.',
      affectedStepIds: steps.filter((s) => s.price.amount === null).map((s) => s.id),
      prepared: false,
    });
  }

  return list;
}