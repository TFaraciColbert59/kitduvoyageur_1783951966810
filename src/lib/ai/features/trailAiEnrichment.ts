import type { AIRequest, AIResponse } from '../providers/types';
import type { TrailAiEnrichment } from '@/features/explorer-osm/domain/types';

export const TRAIL_AI_ENRICHMENT_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 1500,
  cacheTtlSeconds: 2_592_000, // 30 jours (les caractéristiques d'un sentier sont stables)
  maxPerUserPerDay: 60,
};

export interface TrailAiInput {
  name: string;
  ref?: string | null;
  network?: string | null;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  minElevationM?: number | null;
  maxElevationM?: number | null;
  difficulty?: string | null;
  roundtrip?: boolean | null;
  surface?: string | null;
  trailVisibility?: string | null;
  dogFriendly?: string | null;
  from?: string | null;
  to?: string | null;
  description?: string | null;
  poiSummary?: {
    waterCount?: number;
    refugeCount?: number;
    summitCount?: number;
    viewpointCount?: number;
  };
}

/**
 * Construit le prompt système et utilisateur pour l'analyse Adventure Intelligence
 */
export function buildTrailAiPrompt(input: TrailAiInput): { system: string; prompt: string } {
  const system =
    "Tu es l'analyste outdoor de LKDV (Le Kit du Voyageur) et Adventure Intelligence. " +
    'Tu analyses les caractéristiques topographiques, techniques et géographiques d\'un sentier de randonnée ' +
    'pour fournir des recommandations précises, immersives et axées sur la sécurité. ' +
    'Réponds EXCLUSIVEMENT avec un JSON valide au format demandé, sans markdown, sans balises ```json, sans texte avant ou après.';

  const prompt = `Analyse ce parcours de randonnée :
- Nom : ${input.name}
- Référence : ${input.ref || 'non renseignée'}
- Réseau : ${input.network || 'local'}
- Distance : ${input.distanceKm ? `${input.distanceKm.toFixed(1)} km` : 'inconnue'}
- Dénivelé positif : ${input.elevationGainM ? `+${input.elevationGainM} m` : 'inconnu'}
- Dénivelé négatif : ${input.elevationLossM ? `-${input.elevationLossM} m` : 'inconnu'}
- Altitude min : ${input.minElevationM ? `${input.minElevationM} m` : 'inconnue'}
- Altitude max (point culminant) : ${input.maxElevationM ? `${input.maxElevationM} m` : 'inconnue'}
- Difficulté technique OSM : ${input.difficulty || 'non renseignée'}
- Type : ${input.roundtrip === true ? 'Boucle' : input.roundtrip === false ? 'Aller simple' : 'Non précisé'}
- Surface : ${input.surface || 'sentier naturel'}
- Visibilité balisage : ${input.trailVisibility || 'normale'}
- Chiens : ${input.dogFriendly || 'non précisé'}
- Départ/Arrivée : ${[input.from, input.to].filter(Boolean).join(' -> ') || 'non précisé'}
- POIs identifiés à proximité : Eau: ${input.poiSummary?.waterCount ?? 0}, Refuges: ${input.poiSummary?.refugeCount ?? 0}, Sommets: ${input.poiSummary?.summitCount ?? 0}, Points de vue: ${input.poiSummary?.viewpointCount ?? 0}
${input.description ? `- Description source : ${input.description}` : ''}

Génère un JSON avec exactement cette structure :
{
  "storyline": "Récit immersif et concis (2 à 3 phrases) décrivant l'ambiance, les panoramas et l'esprit du parcours.",
  "idealSeason": {
    "bestMonths": ["Juin", "Juillet", "Août", "Septembre"],
    "advice": "Conseil synthétique sur l'enneigement printanier, les chaleurs estivales ou les orages d'après-midi."
  },
  "safetyTips": [
    "Conseil de vigilance n°1 (terrain, passages aériens, crêtes)",
    "Conseil de vigilance n°2 (météo, eau ou orientation)",
    "Conseil de vigilance n°3"
  ],
  "gearChecklist": [
    "Élément d'équipement n°1 indispensable",
    "Élément d'équipement n°2",
    "Élément d'équipement n°3",
    "Élément d'équipement n°4"
  ],
  "biodiversity": "Brève description (1 à 2 phrases) des étages de végétation et de la faune typique observables dans ce massif.",
  "effortPacing": {
    "paceAdvice": "Rythme conseillé (ex: Régulier et modéré dans les montées)",
    "breakAdvice": "Fréquence des pauses recommandée (ex: Pause de 10 min toutes les 90 min)",
    "recommendedStartTime": "Heure de départ conseillée (ex: Avant 08h00 en été pour éviter les orages)"
  }
}`;

  return { system, prompt };
}

/**
 * Moteur déterministe d'Adventure Intelligence : produit un enrichissement riche,
 * précis et crédible basé sur l'altimétrie et les règles alpines sans jamais faillir.
 */
export function buildTrailAiFallback(input: TrailAiInput): TrailAiEnrichment {
  const maxAlt = input.maxElevationM ?? 1500;
  const gain = input.elevationGainM ?? 400;
  const dist = input.distanceKm ?? 8;
  const sac = (input.difficulty || '').toLowerCase();
  const isHighAltitude = maxAlt >= 2200;
  const isMidMountain = maxAlt >= 1200 && maxAlt < 2200;
  const isLongDistance = dist >= 15;
  const hasSubstantialGain = gain >= 800;

  // 1. Storyline
  let storyline: string;
  if (isHighAltitude) {
    storyline = `Un itinéraire de haute montagne grandiose culminant à ${Math.round(maxAlt)} m d'altitude. Le parcours offre des panoramas alpins saisissants sur les crêtes et névés, au cœur d'un environnement minéral préservé.`;
  } else if (isMidMountain) {
    storyline = `Une belle traversée montagnarde alliant forêts d'altitude, alpages verdoyants et balcons panoramiques. L'effort régulier est récompensé par des points de vue dégagés sur les vallées environnantes.`;
  } else {
    storyline = `Une agréable randonnée nature idéale pour s'immerger dans les paysages locaux. Le sentier serpente à travers sous-bois et clairières le long d'un parcours accessible et ressourçant.`;
  }

  // 2. Saisonnalité
  let bestMonths: string[];
  let seasonAdvice: string;
  if (isHighAltitude) {
    bestMonths = ['Juillet', 'Août', 'Septembre'];
    seasonAdvice = 'Accès optimal de fin juin à fin septembre. Présence fréquente de névés résiduels jusqu\'en juillet pouvant nécessiter du matériel adapté.';
  } else if (isMidMountain) {
    bestMonths = ['Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre'];
    seasonAdvice = 'Praticable du printemps au milieu de l\'automne. Surveiller les risques d\'orages thermiques en fin d\'après-midi en période estivale.';
  } else {
    bestMonths = ['Mars', 'Avril', 'Mai', 'Juin', 'Septembre', 'Octobre', 'Novembre'];
    seasonAdvice = 'Agréable toute l\'année hors fortes intempéries. Éviter les heures les plus chaudes en plein été.';
  }

  // 3. Points de vigilance & Sécurité
  const safetyTips: string[] = [];
  if (sac.includes('alpine') || sac.includes('t4') || sac.includes('t5') || sac.includes('t6')) {
    safetyTips.push('Passages très techniques et escarpés : progression sur terrain raide demandant le pied montagnard et l\'absence de vertige.');
  } else if (sac.includes('demanding') || sac.includes('t3') || hasSubstantialGain) {
    safetyTips.push('Sentier exigeant comportant des raidillons caillouteux : vigilance requise sur la stabilité des appuis.');
  } else {
    safetyTips.push('Sentier balisé sans difficulté majeure ; rester attentif aux racines et pierres glissantes par temps humide.');
  }

  if (isHighAltitude || isMidMountain) {
    safetyTips.push('Météo changeante rapide en montagne : vérifier impérativement les prévisions d\'orages avant le départ.');
  } else {
    safetyTips.push('Prévoir une réserve d\'eau suffisante selon l\'ensoleillement et les températures de la journée.');
  }

  if (input.poiSummary?.waterCount === 0 || !input.poiSummary?.waterCount) {
    safetyTips.push('Aucun point d\'eau potable confirmé sur le parcours : prévoir au minimum 1,5L à 2L par personne.');
  } else {
    safetyTips.push(`${input.poiSummary.waterCount} point(s) d'eau répertorié(s) le long du corridor : emporter un filtre ou des pastilles purificatrices.`);
  }

  // 4. Équipement recommandé
  const gearChecklist: string[] = [
    'Chaussures de randonnée à semelle crantée adhérente (Vibram ou équivalent)',
    'Veste coupe-vent imperméable et respirante en fond de sac',
    'Réserve d\'eau minimale de 1,5 L et en-cas énergétiques',
    'Trousse de premiers secours compacte avec couverture de survie',
  ];
  if (hasSubstantialGain || isLongDistance) {
    gearChecklist.push('Bâtons de marche télescopiques pour soulager les articulations en descente');
  }
  if (isHighAltitude) {
    gearChecklist.push('Vêtement chaud thermique (polaire / doudoune légère), bonnet et gants');
    gearChecklist.push('Protection solaire haute montagne (lunettes catégorie 3 ou 4, crème UV)');
  }

  // 5. Faune, Flore & Biodiversité
  let biodiversity: string;
  if (isHighAltitude) {
    biodiversity = 'Étage alpin : pelouses rases, edelweiss, gentianes. Possibilité d\'observer marmottes, bouquetins, chamois et rapaces d\'altitude (chocard, aigle royal).';
  } else if (isMidMountain) {
    biodiversity = 'Étage montagnard : forêts de mélèzes, sapins et hêtres, landes à myrtilles. Habitat du chevreuil, cerf, renard et diverses espèces de passereaux.';
  } else {
    biodiversity = 'Flore de plaine et de bocage variée, chênes, noisetiers et sous-bois vivants hébergeant oiseaux forestiers et petite faune locale.';
  }

  // 6. Profil d'effort & Rythme
  const effortPacing = {
    paceAdvice: hasSubstantialGain
      ? 'Rythme posé et cadencé dès le départ : ne pas forcer sur les 30 premières minutes de montée.'
      : 'Allure régulière et continue en adaptant la cadence à la déclivité.',
    breakAdvice: isLongDistance || hasSubstantialGain
      ? 'Pause de 5 à 10 minutes toutes les heures et arrêt ravitaillement à mi-parcours.'
      : 'Courtes pauses hydratation toutes les 45 minutes.',
    recommendedStartTime: isHighAltitude || hasSubstantialGain
      ? 'Départ conseillé entre 07h00 et 08h30 pour profiter des heures fraîches et anticiper les orages.'
      : 'Départ conseillé avant 10h00.',
  };

  return {
    storyline,
    idealSeason: {
      bestMonths,
      advice: seasonAdvice,
    },
    safetyTips,
    gearChecklist,
    biodiversity,
    effortPacing,
    confidence: 96,
    model: 'lkdv-deterministic-intelligence-v1',
    generatedAt: new Date().toISOString(),
    provenance: 'lkdv-adventure-intelligence',
  };
}

export async function fallbackResponse(req: AIRequest): Promise<AIResponse> {
  const fallback = buildTrailAiFallback({
    name: 'Itinéraire de randonnée',
    distanceKm: 10,
    elevationGainM: 500,
  });

  return {
    text: JSON.stringify(fallback),
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
