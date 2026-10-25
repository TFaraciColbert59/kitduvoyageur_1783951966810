/**
 * A3 — Fatigue intra-journée sans données de santé (moteur pur).
 *
 * Modèle additif simple et explicable : durée active, D+/D-, technicité,
 * portage, charge récente LKDV, pauses et fatigue déclarée. Toute valeur est
 * bornée et le score final est ramené dans [0, 100].
 * Aucune donnée santé connectée : uniquement GPS dérivé + déclaratif.
 */

export interface FatigueInput {
  activeDurationS: number;
  gainM: number;
  lossM: number;
  technicalClass?: number | null;
  packWeightKg?: number | null;
  pausesCount?: number;
  recentLoadS?: number | null;
  declaredFatigue?: number | null;
}

export interface FatigueComponent {
  label: string;
  value: number;
}

export interface FatigueResult {
  score: number;
  components: FatigueComponent[];
}

/** Borne les entrées non finies/négatives pour un modèle robuste. */
function positive(value: number | null | undefined, max: number): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

/**
 * Calcule un score de fatigue 0..100 (0 = frais, 100 = épuisé).
 * Chaque composante est documentée et peut être affichée à l'utilisateur.
 */
export function computeFatigue(input: FatigueInput): FatigueResult {
  const hours = positive(input.activeDurationS, 24 * 3600) / 3600;
  const gain = positive(input.gainM, 10000);
  const loss = positive(input.lossM, 10000);
  const technicalClass = positive(input.technicalClass, 5);
  const packWeight = positive(input.packWeightKg, 50);
  const recentLoadHours = positive(input.recentLoadS, 24 * 3600) / 3600;
  const declaredFatigue = positive(input.declaredFatigue, 10);
  const pausesCount = positive(input.pausesCount, 100);

  const components: FatigueComponent[] = [
    { label: 'Durée active', value: Math.min(35, hours * 7) },
    { label: 'Dénivelé positif', value: Math.min(25, gain / 50) },
    { label: 'Dénivelé négatif', value: Math.min(15, loss / 100) },
    { label: 'Technicité', value: Math.min(15, technicalClass * 3) },
    { label: 'Portage', value: Math.min(10, packWeight) },
    { label: 'Charge récente', value: Math.min(10, recentLoadHours * 2) },
    { label: 'Fatigue déclarée', value: Math.min(20, declaredFatigue * 2) },
    { label: 'Pauses', value: -Math.min(10, pausesCount * 2.5) },
  ];

  const raw = components.reduce((sum, component) => sum + component.value, 0);
  const score = Math.min(100, Math.max(0, raw));

  return {
    score: Math.round(score * 100) / 100,
    components,
  };
}
