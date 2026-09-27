import type { Contingency, ItineraryModel } from '../types';

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
