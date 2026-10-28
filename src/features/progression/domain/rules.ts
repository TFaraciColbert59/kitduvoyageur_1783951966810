import { LevelTier, SkillType } from './types';

/**
 * 10 Paliers de Progression LKDV (Niveaux Voyageur)
 * Calculés uniquement sur les XP cumulés à vie (lifetimePoints).
 * Ne régressent jamais avec le changement de saison.
 * Titres historiques descriptifs : aucune qualification ni permission accordée.
 * Les fonctions essentielles et les avantages commerciaux ne dépendent pas du niveau.
 */
export const LEVEL_TIERS: readonly LevelTier[] = [
  {
    level: 1,
    minPoints: 0,
    maxPoints: 99,
    title: 'Randonneur Curieux',
    badge: 'flore',
    description: 'Le début de votre progression personnelle dans LKDV, à votre rythme.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 2,
    minPoints: 100,
    maxPoints: 299,
    title: 'Marcheur Averti',
    badge: 'foret',
    description: 'Un nouveau repère dans votre progression, au fil des réalisations validées.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 3,
    minPoints: 300,
    maxPoints: 699,
    title: 'Arpenteur des Bois',
    badge: 'boussole',
    description: 'Votre parcours personnel se dessine à travers les XP cumulés.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 4,
    minPoints: 700,
    maxPoints: 1499,
    title: 'Éclaireur des Cimes',
    badge: 'montagne',
    description: 'Une étape de plus dans votre parcours de voyage, selon vos objectifs.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 5,
    minPoints: 1500,
    maxPoints: 2999,
    title: 'Navigateur Alpin',
    badge: 'sommet',
    description: 'Un palier qui reflète vos réalisations validées dans LKDV.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 6,
    minPoints: 3000,
    maxPoints: 5499,
    title: 'Pionnier des Crêtes',
    badge: 'observation',
    description: 'Votre progression continue de s’enrichir, sans imposer un type de voyage.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 7,
    minPoints: 5500,
    maxPoints: 8999,
    title: 'Guide de Cordée',
    badge: 'escalade',
    description: 'Un titre historique qui accompagne votre progression personnelle dans LKDV.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 8,
    minPoints: 9000,
    maxPoints: 13999,
    title: "Maître d'Expédition",
    badge: 'neige',
    description: 'Une nouvelle étape symbolique de votre parcours, fondée sur vos XP cumulés.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 9,
    minPoints: 14000,
    maxPoints: 19999,
    title: 'Légende des Sentiers',
    badge: 'points',
    description: 'Un repère durable de vos réalisations validées, à votre manière de voyager.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
  {
    level: 10,
    minPoints: 20000,
    maxPoints: null,
    title: 'Gardien des Horizons',
    badge: 'recompense',
    description: 'Le dernier palier de présentation LKDV ; votre parcours peut continuer à s’enrichir.',
    perks: ['Repère personnel de progression', 'Titre de voyage descriptif'],
  },
] as const;

export const MIN_CRITICAL_MASS_PARTICIPANTS = 5;
export const TERRITORY_LOCK_DAYS = 30;
export const CHALLENGE_REPLACE_COOLDOWN_DAYS = 7;
export const DEFAULT_SEASON_DURATION_WEEKS = 8;

/**
 * Calcule le niveau et la progression en points vers le niveau supérieur.
 */
export function calculateLevel(lifetimePoints: number): {
  level: number;
  title: string;
  badge: string;
  minPoints: number;
  nextLevelPoints: number | null;
  progressPct: number;
} {
  const safePoints = Math.max(0, Math.floor(lifetimePoints));

  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    const tier = LEVEL_TIERS[i];
    if (safePoints >= tier.minPoints) {
      if (tier.maxPoints === null) {
        // Niveau maximum atteint (10)
        return {
          level: tier.level,
          title: tier.title,
          badge: tier.badge,
          minPoints: tier.minPoints,
          nextLevelPoints: null,
          progressPct: 100,
        };
      }

      const pointsInCurrentLevel = safePoints - tier.minPoints;
      const pointsRequiredForLevel = tier.maxPoints - tier.minPoints + 1;
      const pct = Math.min(100, Math.max(0, Math.round((pointsInCurrentLevel / pointsRequiredForLevel) * 100)));

      return {
        level: tier.level,
        title: tier.title,
        badge: tier.badge,
        minPoints: tier.minPoints,
        nextLevelPoints: tier.maxPoints + 1,
        progressPct: pct,
      };
    }
  }

  // Fallback Niveau 1
  return {
    level: 1,
    title: LEVEL_TIERS[0].title,
    badge: LEVEL_TIERS[0].badge,
    minPoints: 0,
    nextLevelPoints: 100,
    progressPct: Math.min(100, Math.max(0, safePoints)),
  };
}

/**
 * Valide la clé de répartition des compétences (somme = 1.0)
 * et ventile les points de manière déterministe avec la méthode du plus fort reste.
 */
export function validateAndDistributeSkillPoints(
  pointsTotal: number,
  weights: Record<SkillType, number>
): Record<SkillType, number> {
  if (pointsTotal < 0) {
    throw new Error(`Points total must be positive: ${pointsTotal}`);
  }

  const skills: SkillType[] = ['explorer', 'preparer', 'partager', 'entraider'];
  let sumWeights = 0;

  for (const s of skills) {
    const w = weights[s] ?? 0;
    if (w < 0 || w > 1) {
      throw new Error(`Invalid skill weight for ${s}: ${w}. Must be between 0 and 1.`);
    }
    sumWeights += w;
  }

  if (Math.abs(sumWeights - 1.0) > 0.001) {
    throw new Error(`Sum of skill weights must equal 1.0, received: ${sumWeights}`);
  }

  if (pointsTotal === 0) {
    return { explorer: 0, preparer: 0, partager: 0, entraider: 0 };
  }

  // Distribution exacte par la méthode du plus fort reste (évite toute perte d'entier)
  const floats = skills.map((s) => ({
    skill: s,
    exact: pointsTotal * (weights[s] ?? 0),
    integerPart: Math.floor(pointsTotal * (weights[s] ?? 0)),
    remainder: (pointsTotal * (weights[s] ?? 0)) - Math.floor(pointsTotal * (weights[s] ?? 0)),
  }));

  const initialAllocated = floats.reduce((acc, f) => acc + f.integerPart, 0);
  let missing = pointsTotal - initialAllocated;

  // Trier par plus fort reste décroissant
  floats.sort((a, b) => b.remainder - a.remainder);

  const result: Record<SkillType, number> = {
    explorer: 0,
    preparer: 0,
    partager: 0,
    entraider: 0,
  };

  for (const item of floats) {
    let extra = 0;
    if (missing > 0) {
      extra = 1;
      missing--;
    }
    result[item.skill] = item.integerPart + extra;
  }

  return result;
}

/**
 * Vérifie si l'utilisateur a le droit de remplacer son défi en cours.
 * Cooldown de 7 jours (1 remplacement maximum par semaine).
 */
export function canReplaceChallenge(lastReplacedAt: string | Date | null): boolean {
  if (!lastReplacedAt) return true;
  const replacedDate = typeof lastReplacedAt === 'string' ? new Date(lastReplacedAt) : lastReplacedAt;
  const cooldownMs = CHALLENGE_REPLACE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - replacedDate.getTime() >= cooldownMs;
}

/**
 * Vérifie si le rattachement territorial est actuellement verrouillé (anti-abus 30 jours).
 */
export function isTerritoryLocked(lockUntil: string | Date | null): boolean {
  if (!lockUntil) return false;
  const lockDate = typeof lockUntil === 'string' ? new Date(lockUntil) : lockUntil;
  return Date.now() < lockDate.getTime();
}

/**
 * Calcule la nouvelle date d'expiration du verrou de territoire (+30 jours).
 */
export function computeNewTerritoryLock(): Date {
  return new Date(Date.now() + TERRITORY_LOCK_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Vérifie si un classement territorial manque de participants (< 5).
 */
export function isCommunityForming(activeCount: number): boolean {
  return activeCount < MIN_CRITICAL_MASS_PARTICIPANTS;
}
