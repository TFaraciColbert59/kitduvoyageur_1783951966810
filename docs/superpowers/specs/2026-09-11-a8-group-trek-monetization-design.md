# A8 — Groupe, trek et monétisation — Design & Plan

Date : 2026-09-11 · Type : spec + plan combinés
Contraintes : ADR-AI-003 (privacy), ADR-AI-004 (IA non calculante), A3 (profils), A6 (plan)

## Vision

Étendre le système au collectif (groupe), au multi-jours (trek) et au modèle économique
(plans, pass, entitlements, affiliation transparente), **sans jamais exposer les données
privées détaillées d'un membre**.

## 8.1 Intelligence de groupe — `domain/groupIntelligence.ts`

```ts
export interface GroupMemberInput {
  memberId: string; displayName: string; role: 'owner'|'member'|'guest';
  flatSpeedKmH: number | null; ascentSpeedMPerHour: number | null; descentSpeedMPerHour: number | null;
  packWeightKg: number | null; maxCarryKg: number | null; experienceLevel: 'beginner'|'intermediate'|'advanced';
  limitations?: string[]; isChild?: boolean;
}
export interface GroupSegment { segmentId: number; distanceM: number; gainM: number; lossM: number; }
export interface GroupPlan {
  memberPacesKmH: { memberId: string; paceKmH: number }[];
  groupPaceKmH: number;
  limitingMemberId: string | null;
  limitingReason: string | null;
  perMemberDifficulty: { memberId: string; difficulty: number }[];
  groupDifficulty: number;
  pauseEveryMinutes: number;
  separationRisk: { level: 'low'|'medium'|'high'; spreadKmH: number; reasons: string[] };
  gearRedistribution: { fromMemberId: string; toMemberId: string; weightKg: number; reason: string }[];
}
export function buildGroupPlan(members: GroupMemberInput[], segments: GroupSegment[], options?: { strategy?: 'comfort'|'recommended'|'fast' }): GroupPlan;
export function projectGroupPlanPublic(plan: GroupPlan): { groupPaceKmH: number; groupDifficulty: number; limitingReason: string | null; separationRisk: { level: string; reasons: string[] }; memberCount: number };
```
Règles : allure collective = **membre dimensionnant** (le plus lent, pondéré descente technique
et enfants), jamais une moyenne ; difficulté par membre via A3 ; risque de séparation =
écart d'allure + taille ; redistribution = transfert du portage excédentaire du membre
limitant vers ceux ayant de la marge, plafonné ; `projectGroupPlanPublic` ne contient
**aucun** `memberId`, `displayName`, vitesse individuelle ou donnée de santé.

## 8.2 Trek multi-jours — `domain/multiDayTrek.ts`

```ts
export interface TrekDayInput { dayNumber: number; distanceM: number; gainM: number; lossM: number; packWeightKg: number | null; technicalClass?: number | null; sleepQuality?: number | null; }
export interface TrekDayResult { dayNumber: number; capacityPct: number; loadScore: number; difficulty: number; driftRisk: number; adjustments: TrekAdjustment[]; }
export interface TrekAdjustment { kind: 'shorten'|'move_km'|'change_refuge'|'add_night'|'transfer_gear'|'recovery_day'; label: string; reason: string; }
export function simulateMultiDayTrek(days: TrekDayInput[], options?: { initialCapacityPct?: number; recoveryPerNight?: number; heavyPackKg?: number }): { daily: TrekDayResult[]; worstDay: number; totalDriftRisk: number };
```
Modèle : capacité J1 = 100 % ; charge = f(D+, D−, distance, portage, technicité) ;
récupération nocturne paramétrique ; nuit courte (`sleepQuality < 0.5`) réduit la récupération ;
journée courte (< 60 % de la médiane) améliore la capacité suivante ; dérive = baisse
cumulée non récupérée ; ajustements proposés quand difficulté > 75 ou dérive > 0,5.

## 8.3 Monétisation — `domain/entitlements.ts` et `domain/affiliationRanking.ts`

```ts
export const PLANS = ['free','explorer','expedition','group'] as const;
export type PlanId = (typeof PLANS)[number];
export const PASSES = ['weekend','trip','expedition'] as const;
export const ENTITLEMENTS = ['full_generation','offline','advanced_profile','live_eta','history','terrain_live_advanced','group','trek','monitoring'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];
export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlement[]>;
export function hasEntitlement(plan: PlanId, entitlement: Entitlement): boolean;
export function requiredPlanFor(entitlement: Entitlement): PlanId;
export function effectiveEntitlements(input: { plan: PlanId; activePasses: (typeof PASSES)[number][] }): Entitlement[];
```
Passe `trip` débloque `full_generation` + `live_eta` ; `expedition` ajoute `trek` + `monitoring` ;
`weekend` ajoute `full_generation` + `offline`. Un entitlement inconnu ne donne jamais accès.

```ts
export interface AffiliationOffer { id: string; title: string; category: 'gear'|'stay'|'activity'|'transport'|'rental'; relevanceScore: number; commissionPct: number; priceEur: number; availability: 'available'|'unknown'|'unavailable'; }
export function rankAffiliationOffers(offers: AffiliationOffer[], context: { missingGearCategories: string[]; budgetRemainingEur: number | null }): { offerId: string; score: number; reasons: string[] }[];
```
**Règle absolue** : le classement n'utilise jamais `commissionPct` (test dédié : deux offres
identiques sauf commission → ordre inchangé). `availability='unavailable'` exclut l'offre.

## 8.4 B2B — contrats futurs seulement — `domain/b2bContracts.ts`

```ts
export interface DifficultyApiContract { version: 'v1'; getSegmentDifficulty(segmentId: number, direction: 'forward'|'reverse'): Promise<{ difficulty: number; confidence: Confidence } | null>; }
export interface EtaApiContract { version: 'v1'; predictRoute(input: { segmentIds: number[]; profileRef?: string }): Promise<{ etaP50: string; etaP90: string; confidence: Confidence } | null>; }
export interface ConditionsApiContract { version: 'v1'; getConditions(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }): Promise<{ activeEvents: number; confidence: Confidence } | null>; }
```
Aucune implémentation, aucun endpoint — types + fabriques `b2bContractCatalog()` retournant
les versions disponibles. **Aucune monétisation de données santé** (aucun champ santé).

## Tests (IDs)

- `TEST-A8-GRP-01..06` : membre dimensionnant, jamais la moyenne, difficulté par membre,
  risque de séparation (écart/âge), redistribution plafonnée, projection publique sans identité.
- `TEST-A8-TREK-01..05` : capacité cumulée, récupération, nuit courte, journée courte,
  ajustements et dérive.
- `TEST-A8-ENT-01..05` : gating par plan, passes effectifs, entitlement inconnu refusé,
  `requiredPlanFor` cohérent, aucune fuite entre plans.
- `TEST-A8-AFF-01..03` : pertinence d'abord, **commission ignorée**, indisponible exclu.
- `TEST-A8-B2B-01..02` : catalogue de contrats, aucune donnée santé dans les contrats.

## Commits

1. `feat(a8): intelligence de groupe (membre dimensionnant, separation, redistribution)`
2. `feat(a8): trek multi-jours (fatigue cumulative, recuperation, ajustements)`
3. `feat(a8): entitlements, passes et classement d'affiliation transparent`
4. `feat(a8): contrats B2B futurs (difficulte, ETA, conditions)`

## Gate de sortie

Groupe fonctionnel (moteur + tests), trek multi-jours, fatigue expliquée, paywall cohérent,
entitlements testés, affiliation transparente, aucune monétisation des données santé.
L'UI groupe/trek est montée en Phase 9 (intégration Hub réelle).
