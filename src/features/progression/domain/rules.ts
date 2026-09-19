import { LevelTier, SkillType } from './types';

/**
 * 10 Paliers de Progression LKDV (Niveaux Voyageur)
 * Calculés uniquement sur les Points LKDV cumulés à vie (lifetimePoints).
 * Ne régressent jamais avec le changement de saison.
 */
export const LEVEL_TIERS: readonly LevelTier[] = [
  {
    level: 1,
    minPoints: 0,
    maxPoints: 99,
    title: 'Randonneur Curieux',
    badge: '🌱',
    description: 'Vos premiers pas sur les sentiers. Vous explorez et apprenez à équiper votre sac.',
    perks: ['Accès au Hub & inventaire', 'Badges de bienvenue'],
  },
  {
    level: 2,
    minPoints: 100,
    maxPoints: 299,
    title: 'Marcheur Averti',
    badge: '🌲',
    description: 'Une pratique régulière et des kits affûtés pour des sorties d’une journée.',
    perks: ['Création de sorties collectives', 'Partage de carnets'],
  },
  {
    level: 3,
    minPoints: 300,
    maxPoints: 699,
    title: 'Arpenteur des Bois',
    badge: '🧭',
    description: 'Vous maîtrisez votre matériel et vos premières nuits sous la tente.',
    perks: ['Classement territorial 1 km & ville', 'Accès aux défis hebdomadaires'],
  },
  {
    level: 4,
    minPoints: 700,
    maxPoints: 1499,
    title: 'Éclaireur des Cimes',
    badge: '⛰️',
    description: 'Autonome sur 2 à 3 jours en moyenne montagne, sentiers techniques et météo changeante.',
    perks: ['Création de clubs locaux', 'Téléchargement GPX illimité'],
  },
  {
    level: 5,
    minPoints: 1500,
    maxPoints: 2999,
    title: 'Navigateur Alpin',
    badge: '🏔️',
    description: 'Itinérance alpine, gestion stricte du poids et de la sécurité en altitude.',
    perks: ['Badge vérifié sur la communauté', 'Accès anticipé aux nouveautés'],
  },
  {
    level: 6,
    minPoints: 3000,
    maxPoints: 5499,
    title: 'Pionnier des Crêtes',
    badge: '🦅',
    description: 'Treks engagés en autonomie complète. Vos conseils font référence.',
    perks: ['Contribution aux sentiers officiels', 'Distinction Élite'],
  },
  {
    level: 7,
    minPoints: 5500,
    maxPoints: 8999,
    title: 'Guide de Cordée',
    badge: '🧗',
    description: 'Expérience solide, solidarité exemplaire et entraide active auprès des marcheurs.',
    perks: ['Modération communautaire bienveillante', 'Accès aux tables rondes'],
  },
  {
    level: 8,
    minPoints: 9000,
    maxPoints: 13999,
    title: "Maître d'Expédition",
    badge: '❄️',
    description: 'Traversées majeures, conditions extrêmes et organisation d’expéditions de groupe.',
    perks: ['Rôle mentor officiel', 'Bons partenaires privilégiés'],
  },
  {
    level: 9,
    minPoints: 14000,
    maxPoints: 19999,
    title: 'Légende des Sentiers',
    badge: '🌟',
    description: 'Des milliers de kilomètres parcourus et un patrimoine de carnets d’exception.',
    perks: ['Hall of Fame LKDV', 'Invitation aux événements annuels'],
  },
  {
    level: 10,
    minPoints: 20000,
    maxPoints: null,
    title: 'Gardien des Horizons',
    badge: '👑',
    description: 'Le sommet de la cordée LKDV. Ambassadeur perpétuel du voyage responsable.',
    perks: ['Statut perpétuel', 'Trophée physique de cordée'],
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
