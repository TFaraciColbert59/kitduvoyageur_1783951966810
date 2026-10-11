/**
 * UNIFIED PROGRESSION & TERRITORIAL RANKINGS
 * Domain Types & Interfaces
 *
 * Invariants:
 * 1. Single visible currency: "Points LKDV" (no separate XP currency visible to users).
 * 2. Permanent level (1-10) calculated exclusively on cumulative lifetime validated points.
 * 3. Season points determine territorial leaderboard ranks (8-week cycles).
 * 4. 4 transversal skills: Explorer, Se préparer, Partager, S'entraider.
 *    Single global points grant, broken down with sum of weights = 1.0.
 * 5. Territorial rankings: 5 filters (1 km / confidentiel, ville, région, pays, monde).
 *    Strict privacy: GPS coordinates and exact addresses are NEVER exposed in leaderboards.
 *    Critical mass threshold: < 5 active participants -> "Communauté en formation" state.
 * 6. L'inconnu est distinct de zéro : aucune valeur de progression, de rang ou de solde
 *    n'est inventée quand la donnée serveur n'existe pas (null, jamais un faux défaut).
 */

export type SkillType = 'explorer' | 'preparer' | 'partager' | 'entraider';

export interface SkillProgress {
  skill: SkillType;
  label: string;
  points: number;
  pct: number;
  icon: string;
  description: string;
}

export interface LevelTier {
  level: number;
  minPoints: number;
  maxPoints: number | null;
  title: string;
  badge: string;
  description: string;
  perks: string[];
}

export interface ProgressionSeason {
  id: string;
  seasonNumber: number;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'upcoming' | 'completed';
}

export interface ProgressionChallenge {
  id: string;
  title: string;
  description: string;
  skill: SkillType;
  pointsReward: number;
  difficulty: 'facile' | 'moyen' | 'expert';
  currentProgress: number;
  targetProgress: number;
  unit: string;
  isCompleted: boolean;
  canBeReplaced: boolean;
}

export type TerritoryFilter = 'around_me' | 'city' | 'region' | 'country' | 'world';

export interface TerritorialAttachment {
  cityName: string | null;
  departmentCode: string | null;
  regionName: string | null;
  countryCode: string;
  postalCode: string | null;
  territoryLockUntil: string | null;
  canUpdateTerritory: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  levelTitle: string;
  seasonPoints: number;
  lifetimePoints: number;
  topSkill: SkillType;
  distinction: string | null;
  isCurrentUser: boolean;
}

export interface LeaderboardResult {
  filter: TerritoryFilter;
  territoryLabel: string;
  totalParticipants: number;
  communityForming: boolean;
  minThreshold: number;
  suggestedFallbackFilter: TerritoryFilter | null;
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
}

export interface ProgressionPoints {
  lifetime: number;
  season: number;
  seasonId: string | null;
}

export interface ProgressionLevel {
  level: number;
  title: string | null;
  nextLevelPoints: number | null;
  progressPct: number;
}

export interface TerritorySummary {
  cityName: string | null;
  cityCode: string | null;
  regionCode: string | null;
  countryCode: string | null;
}

export interface UserProgressionProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasData: boolean;
  points: ProgressionPoints;
  level: ProgressionLevel;
  skills: Record<SkillType, SkillProgress>;
  challenge: ProgressionChallenge | null;
  leaderboardRank: number | null;
  usableBalance: number | null;
  updatedAt: string | null;
  territory: TerritorySummary | null;
}

export interface TerritorialLeaderboardRow {
  rank: number;
  alias: string | null;
  level: number | null;
  levelTitle: string | null;
  seasonPoints: number;
  isCurrentUser: boolean;
}

export interface TerritorialLeaderboard {
  filter: TerritoryFilter;
  rows: TerritorialLeaderboardRow[];
  totalParticipants: number;
  communityForming: boolean;
  minParticipants: number;
  refreshedAt: string | null;
  /** Rang du demandeur, fourni par le serveur même hors page courante. */
  rank?: number | null;
  /** Filtre 1 km indisponible (flag serveur éteint, rattachement privé absent…). */
  localUnavailable?: boolean;
  /** Territoire déclaré manquant pour le filtre demandé. */
  territoryMissing?: boolean;
  /** Aucune saison active côté serveur. */
  seasonUnavailable?: boolean;
  /** Raison honnête d'indisponibilité (`flag_off`, `no_private_attachment`…). */
  reason?: string | null;
  /** Erreur serveur explicite (`rate_limited`). */
  error?: string | null;
}

/* ==========================================================================
 * Contrat économique v2 (T05) — registre versionné, montants et règles.
 * Source d'exécution : `registryV2.ts`. Aucun montant de ce contrat n'est
 * activé tant que la porte de phase correspondante n'est pas ouverte.
 * Aucune conversion XP → valeur commerciale n'existe ni ne doit exister.
 * ========================================================================== */

export type ProgressionFamily = 'terrain' | 'preparation' | 'partage' | 'entraide';

export const PROGRESSION_FAMILIES: readonly ProgressionFamily[] = [
  'terrain',
  'preparation',
  'partage',
  'entraide',
] as const;

export type ProgressionFirstPhase = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7';

export type ProgressionAwardKind = 'fixed' | 'duration_tiers' | 'tiered_by_proof' | 'items_bonus';

export interface ProgressionDurationTier {
  /** Minutes actives minimales pour ce palier. */
  minActiveMinutes: number;
  points: number;
}

export interface ProgressionActionPoints {
  kind: ProgressionAwardKind;
  /** Montant nominal (ou plancher des formules variables). */
  base: number;
  /** Borne basse explicite (tiered_by_proof) quand différente du plancher. */
  min?: number;
  /** Borne haute absolue du gain de l'action, bonus compris. */
  max?: number;
  /** Paliers de durée active (`duration_tiers`). */
  tiers?: ProgressionDurationTier[];
  /** Bonus par item distinct (débrief kit). */
  itemsBonus?: { perItem: number; maxItems: number };
  /** Deux paliers selon la preuve (avis de lieu : visite contrôlée). */
  proofTiers?: { withoutProof: number; withProof: number };
  /** Objectif adapté vérifié : le plancher sans condition de durée. */
  adaptedObjectiveFloor?: number;
}

/** Plafonds en NOMBRE D'ACTIONS (jamais des plafonds d'XP), par date métier. */
export interface ProgressionCaps {
  day: number;
  week: number;
  season: number;
}

export type ProgressionClaimKind =
  | 'source' // unicité de la réalisation source (clé d'idempotence)
  | 'activity' // même activité entre adaptateurs (multitag = 1 gain)
  | 'novelty' // nouveauté de parcours canonique par saison
  | 'media' // empreinte d'un média original (pas de recrédit carnet ↔ lieu)
  | 'object' // même objet (entretien, réparation)
  | 'pair' // même paire de personnes (accompagnement, prêts)
  | 'aventure' // même aventure préparée (sentier ↔ Compas exclusifs)
  | 'report'; // même rapport (correction ↔ accessibilité exclusives)

export interface ProgressionClaimRules {
  kinds: ProgressionClaimKind[];
  /** Actions mutuellement exclusives sur le même fait. */
  exclusiveWith?: string[];
  /** Délai minimum entre deux gains sur le même objet. */
  perObjectCooldownDays?: number;
  /** Délai minimum entre deux gains sur la même paire. */
  perPairCooldownDays?: number;
  /** Nombre maximal de récompenses par activité (photos). */
  maxPerActivity?: number;
  note?: string;
}

export interface ProgressionNoveltyRule {
  points: number;
  perSeason: true;
  /** Plafond du gain total (base + nouveauté) de l'action. */
  maxTotal: number;
  scope: 'canonical_trail';
}

export interface ProgressionRegistryAction {
  id: string;
  label: string;
  family: ProgressionFamily;
  firstPhase: ProgressionFirstPhase;
  weights: Record<SkillType, number>;
  points: ProgressionActionPoints;
  novelty?: ProgressionNoveltyRule;
  caps: ProgressionCaps;
  /** Variantes partageant un compteur commun (quotas mutualisés). */
  capGroup?: string;
  claims: ProgressionClaimRules;
  /** Preuve exigée — reprise du document d'économie. */
  proof: string;
  /** Émission économique associée (P6, fermée jusqu'au financement vérifié). */
  partsOnAward?: number;
}

export interface ProgressionCapGroup {
  id: string;
  label: string;
  caps: ProgressionCaps;
  members: readonly string[];
}

export interface ProgressionFamilyCap {
  family: ProgressionFamily;
  weekPoints: number;
  seasonPoints: number;
}

export interface ProgressionCommercialContract {
  /** Fidélité : crédits par euro de marchandises effectivement payé. */
  loyaltyCreditsPerEuro: number;
  /** Bons futurs : 1 000 crédits → 2 € (barème fermé P6). */
  loyaltyBons: { credits: number; euros: number }[];
  /** Parts : plafonds proposés, émission fermée jusqu'au pool financé. */
  partsWeeklyCap: number;
  partsPeriodCap: number;
  /** Garde-fou doctrinal : aucune conversion XP/argent. */
  conversionXpToMoney: false;
  activationGate: string;
}

export interface ProgressionRegistryV2 {
  version: string;
  /** Date métier d'application : les gains antérieurs gardent leur version. */
  effectiveFrom: string;
  latePolicy: 'refuse' | 'lifetime_only';
  graceDays: number;
  seasonDurationWeeks: number;
  familyCaps: ProgressionFamilyCap[];
  capGroups: ProgressionCapGroup[];
  /** Jalons de présentation des compétences — aucun crédit supplémentaire. */
  skillMilestones: number[];
  actions: ProgressionRegistryAction[];
  /** Comportements explicitement sans XP (gouvernance). */
  nonAwarded: string[];
  commercial: ProgressionCommercialContract;
}
