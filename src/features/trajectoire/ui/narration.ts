/**
 * Narration déterministe.
 *
 * Règle produit : le LLM n'invente jamais. Cette fonction est la seule source
 * de texte de la carte « Le plan vivant » tant qu'aucun modèle n'a produit de
 * phrase vérifiée ; elle est donc explicitement étiquetée « modèle » dans l'UI.
 */

import { describeDuration } from '@/features/trajectoire/domain/derive';
import type { TrajectoireSnapshot, IntentionProfile } from '@/features/trajectoire/domain/types';
import { DEMO_TRACES } from '@/features/trajectoire/domain/traces';
import type { DangerLevel, TrajectoireZone } from '@/features/trajectoire/domain/scaleAxis';

const DANGER_PHRASE: Record<DangerLevel, string> = {
  tranquille: 'Terrain abordable pour une première fois.',
  modere: 'Accessible, mais il faut gérer l’effort.',
  exigeant: 'Exigeant : météo verrouillée, aucune improvisation.',
  engage: 'Engagé : préparation et décision de parcours obligatoire.',
};

const ZONE_VERB: Record<TrajectoireZone, string> = {
  run: 'Une sortie',
  journee: 'Une journée',
  raid: 'Un raid',
  expedition: 'Une expédition',
  monde: 'Un tour du monde',
};

/** Étiquette affichée à côté de la narration pour Recall Score (n'invente jamais). */
export const NARRATION_ORIGIN_LABEL = 'Modèle déterministe · n’invente jamais';

export interface NarrationLine {
  id: string;
  text: string;
  /** Source de la ligne : toujours dérivée de l'état, jamais inventée. */
  origin: 'modele';
}

export interface Narration {
  headline: string;
  lines: readonly NarrationLine[];
  origin: 'modele';
}

/**
 * Compose la narration à partir de l'état dérivé. Pure et déterministe :
 * deux appels avec le même snapshot rendent exactement la même sortie.
 */
export function narrate(snapshot: TrajectoireSnapshot, intention: IntentionProfile): Narration {
  const destination = intention.destination.name;
  const stepCount = snapshot.steps.length;
  const owned = snapshot.kit.filter((item) => item.owned).length;
  const radius = Math.round(snapshot.radiusKm).toLocaleString('fr-FR');

  const headline =
    `${ZONE_VERB[snapshot.zone]} de ${describeDuration(snapshot.hours)}` +
    ` vers ${destination} — ${radius} km autour de toi.`;

  const lines: NarrationLine[] = [
    {
      id: 'danger',
      origin: 'modele',
      text: `${DANGER_PHRASE[snapshot.danger.level]} Indice ${snapshot.danger.score}/100.`,
    },
    {
      id: 'window',
      origin: 'modele',
      text:
        `Fenêtre idéale ${snapshot.window.ideal}` +
        (snapshot.window.risk ? `, à risque ${snapshot.window.risk}` : '') +
        '.',
    },
    {
      id: 'plan',
      origin: 'modele',
      text:
        `${stepCount} étape${stepCount > 1 ? 's' : ''} au grain « ${snapshot.grain} », ` +
        `calculées sur ${snapshot.provenance.length} sources vérifiées.`,
    },
    {
      id: 'kit',
      origin: 'modele',
      text:
        owned === snapshot.kit.length
          ? `Ton inventaire couvre les ${snapshot.kit.length} items du plan.`
          : `${owned}/${snapshot.kit.length} items déjà dans ton sac, ` +
            `${Math.round(snapshot.budget.kitManquantEur)} € à compléter.`,
    },
    {
      id: 'traces',
      origin: 'modele',
      text:
        snapshot.traces.length > 0
          ? `${snapshot.traces.length} traces de la tribu pour éclairer cette échelle.`
          : 'Aucune trace indexée à cette échelle : le plan reste purement dérivé.',
    },
  ];

  return { headline, lines, origin: 'modele' };
}

/** Nombre de traces de démonstration disponibles hors ligne. */
export const TRACE_POOL_SIZE = DEMO_TRACES.length;
