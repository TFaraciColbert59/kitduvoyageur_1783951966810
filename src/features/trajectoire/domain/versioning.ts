/**
 * Versionnage des plans et regrain conservateur.
 *
 * Un plan est IMMUABLE. On n'ecrit jamais par-dessus : chaque recalcul
 * produit une nouvelle version avec le hash des sources qui l'ont produite.
 * C'est ce qui rend la regle "l'IA n'invente jamais" verifiable : on peut
 * remonter la chaine et prouver d'ou vient chaque ligne.
 *
 * Regrain (risque n 3 du dossier) : quand le curseur change de zone, le
 * plan se REGRAINE, il ne se regenere pas. Jamais de perte d'etapes, seulement
 * un changement de granularite.
 */

import { getZone, stepGrain, type StepGrain, type TrajectoireZone } from './scaleAxis';
import { ENGINE_VERSION } from './derive';
import type { PlanStep, TrajectoireSnapshot } from './types';

export interface TrajectoirePlanVersion {
  version: number;
  engineVersion: string;
  /** Hash des entrees qui ont produit cette version. */
  sourcesHash: string;
  zone: TrajectoireZone;
  grain: StepGrain;
  scaleT: number;
  steps: readonly PlanStep[];
  /** Snapshot complet, pour l'affichage. */
  snapshot: TrajectoireSnapshot;
  createdAt: string;
}

/**
 * FNV-1a 32 bits, en hex. Pas de dependance a `crypto` : ce module doit
 * tourner identiquement dans Node, dans le navigateur et dans un edge runtime.
 */
export function hashSources(parts: readonly (string | number | boolean)[]): string {
  const input = parts.join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Les entrees qui font varier un plan. La narration N'EST PAS dedans. */
export function sourcesHashFor(snapshot: TrajectoireSnapshot, intentionId: string): string {
  return hashSources([
    ENGINE_VERSION,
    intentionId,
    snapshot.hours,
    snapshot.zone,
    snapshot.danger.score,
    snapshot.budget.totalEur,
    snapshot.steps.map((step) => step.id).join(','),
    snapshot.kit.map((item) => `${item.id}:${item.owned ? 1 : 0}`).join(','),
    snapshot.provenance.join(','),
  ]);
}

/**
 * Idempotence : un recalcul qui ne change rien ne cree PAS de version.
 * C'est ce qui permet de rejouer le meme evenement (meteo, trace) sans
 * deversionner la trajectoire.
 */
export function nextPlanVersion(
  previous: TrajectoirePlanVersion | null,
  snapshot: TrajectoireSnapshot,
  intentionId: string,
  createdAt: string
): TrajectoirePlanVersion {
  const sourcesHash = sourcesHashFor(snapshot, intentionId);

  if (previous && previous.sourcesHash === sourcesHash) {
    return previous;
  }

  return {
    version: (previous?.version ?? 0) + 1,
    engineVersion: ENGINE_VERSION,
    sourcesHash,
    zone: snapshot.zone,
    grain: snapshot.grain,
    scaleT: snapshot.t,
    steps: regrainSteps(previous?.steps ?? [], snapshot),
    snapshot,
    createdAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Regrain                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Regrain conservateur : le plan se REGRAINE, il ne se regenere pas.
 *
 * Le moteur pur est deja l autorite sur la granularite : `deriveTrajectoire`
 * produit des etapes au grain de la zone cible, et lui seul sait combien un
 * « journee » doit contenir d etapes pour 121 heures. Regrouper ici reviendrait
 * a compter le grain une seconde fois — et a supprimer des etapes que rien
 * n a demande de supprimer. Sur une expedition a cinq etapes au grain
 * « journee », un regroupement par deux en rendrait trois : une perte silencieuse,
 * exactement le risque n 3 du dossier.
 *
 * Le regrain ne fait donc qu une chose, et c est la seule qui compte :
 * **garantir qu aucune etape du plan precedent ne disparait.** Quand le
 * curseur resserre (expedition -> sortie), le moteur rend moins d etapes ; les
 * etapes ecartees sont rattachees au detail de l etape qui les recouvre, avec
 * leur distance cumulee. Rattacher plutot que supprimer : c est la difference
 * entre un plan qui s est elargi et un plan qui a oublie.
 *
 * Invariant, teste dans `versioning.spec.ts` : pour toute etape de
 * `previous`, son titre apparait soit comme titre d une etape de sortie, soit
 * dans le detail d une de ces etapes.
 */
export function regrainSteps(
  previous: readonly PlanStep[],
  snapshot: TrajectoireSnapshot
): PlanStep[] {
  // Copie defensive : le snapshot est partage avec les 8 cartes, et on ne
  // modifie jamais un objet qui n est pas notre (regle d immutabilite).
  const fresh: PlanStep[] = snapshot.steps.map((step) => ({ ...step }));
  if (previous.length === 0 || fresh.length === 0) return fresh;

  const known = new Set(fresh.map((step) => step.title));

  for (let index = 0; index < previous.length; index += 1) {
    const step = previous[index];
    if (known.has(step.title)) continue;

    // Position proportionnelle : l etape 3 sur 5 reste proche de l etape 3
    // sur 3, plutot que de partir au debut de la liste.
    const hostIndex = Math.min(
      fresh.length - 1,
      Math.floor((index * fresh.length) / previous.length)
    );
    const host = fresh[hostIndex];
    host.detail = dedupe([step.title, host.detail]).join(' - ');
    host.distanceKm = sumDistance([host.distanceKm, step.distanceKm]);
    known.add(step.title);
  }

  return fresh;
}

/** Addition en tolérant a null : une étape sans distance n annule pas l autre. */
function sumDistance(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => typeof value === 'number');
  if (present.length === 0) return null;
  return present.reduce((total, value) => total + value, 0);
}

function pickSource(steps: readonly PlanStep[]): PlanStep['sourceId'] {
  const ordered = [
    'vols',
    'viator',
    'refuges',
    'routestack',
    'traces_tribu',
    'alt_meteo_7j',
    'meteo',
    'osm',
  ] as const;
  for (const candidate of ordered) {
    if (steps.some((step) => step.sourceId === candidate)) return candidate;
  }
  return 'osm';
}

function dedupe(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

/* -------------------------------------------------------------------------- */
/* Regles d'autopilot (V5)                                                    */
/* -------------------------------------------------------------------------- */

export type AutopilotTrigger = 'meteo' | 'prix' | 'creneaux' | 'dangerosite';

export interface AutopilotEvent {
  kind: AutopilotTrigger;
  /** Ce que l'evenement dit, en clair. */
  message: string;
  /** Nouvelle position de curseur proposee, 0-1. */
  proposedT: number;
  /** Severite : 0 = information, 1 = action requise. */
  severity: 0 | 1;
}

/**
 * L'autopilot ne decide pas : il PROPOSE une nouvelle position de curseur,
 * et c'est le moteur qui regraine. Evenement -> proposition, deterministe.
 */
export function proposeReposition(
  snapshot: TrajectoireSnapshot,
  event: AutopilotEvent['kind']
): AutopilotEvent {
  const zone = getZone(snapshot.zone);
  switch (event) {
    case 'meteo':
      return {
        kind: 'meteo',
        message: `Fenetre meteo degradee sur ${zone.label}. Deplacement propose vers ${zone.label} - ${zone.windowIdeal}.`,
        proposedT: snapshot.t,
        severity: 1,
      };
    case 'prix':
      return {
        kind: 'prix',
        message: 'Baisse tarifaire Routestack detectee sur la zone courante.',
        proposedT: snapshot.t,
        severity: 0,
      };
    case 'creneaux':
      return {
        kind: 'creneaux',
        message: `Prochaine fenetre a risque : ${zone.windowRisk ?? 'aucune'}.`,
        proposedT: snapshot.t,
        severity: 1,
      };
    case 'dangerosite':
      return {
        kind: 'dangerosite',
        message: `Dangerosite ${snapshot.danger.score}/100 (${snapshot.danger.level}). Escalade proposee vers la zone inferieure.`,
        proposedT: Math.max(0, snapshot.t - 0.08),
        severity: 1,
      };
    default:
      return {
        kind: 'meteo',
        message: 'Aucun evenement.',
        proposedT: snapshot.t,
        severity: 0,
      };
  }
}

export { stepGrain };
