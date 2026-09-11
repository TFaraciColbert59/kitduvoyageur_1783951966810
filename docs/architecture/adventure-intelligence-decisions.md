# Adventure Intelligence — Journal de décisions (ADR-AI)

Date : 2026-09-11 · Statut : acceptées · Portée : Phases 1 à 9

> Namespace `ADR-AI-00x` choisi pour éviter la collision avec les ADR historiques
> `ADR-001..011` de `docs/obsidian/06 — 📋 DÉCISIONS (ADR)/`.
> Chaque décision est contraignante pour les phases suivantes. Toute remise en cause
> passe par un nouvel ADR qui référence celui qu'il remplace.

---

## ADR-AI-001 — `AdventurePlan` comme source de vérité

**Statut** : Accepté (Phase 0)

**Contexte** — Les moteurs existants produisent des sorties juxtaposées (allocations,
étapes, items, warnings) sans artefact unique versionné. Aucune traçabilité des
décisions, de la provenance ou de la fraîcheur.

**Décision** — Toute aventure complète est matérialisée par un `AdventurePlan`
persisté : identité, intention, participants, dates, destinations, transport, étapes,
parcours, hébergements, nourriture/eau, matériel, budget, documents, réglementation,
sécurité, difficulté, allures, ETA, conditions Terrain Live, alternatives, confiance,
décisions, règles de surveillance, versions. Chaque valeur significative porte
provenance, date de calcul, validité, confiance, hypothèses et impacts.
Tables : `adventure_plans`, `adventure_plan_versions`, `adventure_plan_decisions`,
`adventure_engine_runs` (Phase 1).

**Conséquences** — Les phases 3 à 6 écrivent et lisent ce modèle. Les APIs
`/api/adventure/*` exposent des vues du plan. Aucun moteur ne maintient un état
parallèle de l'aventure.

**Alternatives rejetées** — Continuer avec des sorties de moteurs non persistées
(pas d'audit, pas de recalcul différentiel) ; étendre `trips` directement (mélange
planification et exécution, pas de versionnement).

---

## ADR-AI-002 — `trail_segments` reste le réseau géographique central

**Statut** : Accepté (Phase 0)

**Contexte** — Le master plan §27.2 propose `terrain_segments` ; le dépôt possède déjà
`trail_segments` (réseau OSM dense, index GIST, lecture publique) consommé par la carte,
`HikeSessionService` et les RPC PostGIS. Créer une deuxième table de réseau diviserait
les données et les jointures.

**Décision** — `trail_segments` est et reste l'unique référentiel de segments.
L'enrichissement (longueur, pente, D+/D-, technicité, exposition, isolement) vit dans
`trail_segment_features` (1:1, `segment_id → trail_segments.id`). Toute intelligence
collective est indexée par `trail_segments.id`.

**Conséquences** — Les noms du master plan (`terrain_segments`, `segment_passages`)
sont adaptés : `session_segment_passages`, `segment_collective_aggregates`, etc.
Interdiction absolue de recréer un réseau concurrent.

**Alternatives rejetées** — `terrain_segments` parallèle (duplication, désynchronisation
OSM) ; colonnes d'enrichissement directement sur `trail_segments` (table OSM régénérée
par réimport, les features seraient perdues).

---

## ADR-AI-003 — Données privées séparées des agrégats publics

**Statut** : Accepté (Phase 0)

**Contexte** — Le système va collecter traces GPS, observations physiologiques et
consentements. Une fuite d'un agrégat identifiant (ou d'une trace brute) serait
irréversible. Les seuils et gates de la roadmap exigent « aucune donnée individuelle
publique ».

**Décision** — Quatre niveaux de données, avec frontières RLS strictes :

```text
Niveau 1 — traces privées brutes        (hike_sessions, propriétaire uniquement)
Niveau 2 — observations privées dérivées (session_segment_passages, performance_observations)
Niveau 3 — agrégats collectifs anonymes  (segment_collective_aggregates, service_role)
Niveau 4 — vues publiques filtrées       (seuil ≥ 5 contributeurs distincts, sans identité)
```

Règles : profil personnel jamais lisible par un tiers ; agrégations en `service_role` ;
vues publiques avec seuils ; `adventure_data_consents` par finalité avec retrait.

**Conséquences** — Toute nouvelle table du domaine déclare son niveau dans la spec et
sa policy RLS en migration. Les tests pgTAP vérifient l'isolation par rôle.

**Alternatives rejetées** — Une table unique avec colonnes de visibilité (politiques
complexes, risque d'erreur) ; anonymisation a posteriori (irréversible et tardive).

---

## ADR-AI-004 — L'IA enrichit, jamais elle ne calcule

**Statut** : Accepté (Phase 0)

**Contexte** — `src/lib/ai` fournit déjà `askAI` avec cache, quotas, fallbacks. La règle
existante documentée est : « L'IA enrichit, mais les moteurs métier déterministes
restent responsables des calculs et des décisions structurées. » L'échec d'un
fournisseur ne doit jamais rendre un plan inutilisable.

**Décision** — Les moteurs du domaine sont déterministes et testés. L'IA intervient
uniquement en aval : explication, reformulation, suggestions non structurantes. Aucun
chiffre faisant autorité (ETA, difficulté, budget, sécurité) ne provient d'un LLM dans
le chemin critique. Toute sortie IA est marquée `suggested` en provenance.

**Conséquences** — Les APIs `/api/adventure/*` restent fonctionnelles avec `askAI` en
panne. Les tests des moteurs ne mockent jamais un LLM.

**Alternatives rejetées** — IA générative comme calculateur principal (non
reproductible, non auditable, dangereuse pour la sécurité) ; IA uniquement côté
client (divergence de résultats, coûts non maîtrisés).

---

## ADR-AI-005 — Moteurs purs et versionnés

**Statut** : Accepté (Phase 0)

**Contexte** — Les moteurs existants sont des fonctions/classes pures (`solveCoherence`,
`runAutoGenPipeline`) sans identité ni version, difficiles à faire évoluer et à
auditer. La roadmap impose un contrat commun et des prédictions traçables.

**Décision** — Contrat unique :

```ts
interface AdventureEngine<I, O> {
  readonly id: string;
  readonly version: string;        // bump obligatoire si le comportement change
  readonly dependencies: string[];
  canRun(context: AdventureExecutionContext): boolean;
  run(input: I, context: AdventureExecutionContext): Promise<EngineResult<O>>;
}
```

`EngineResult<T>` porte valeur, confiance, provenance, hypothèses, warnings,
alternatives, impacts, `computedAt`, `validUntil`. Les moteurs restent purs :
déterminisme, pas d'appel réseau implicite, pas d'accès direct à la BDD.

**Conséquences** — Chaque exécution est enregistrée dans `adventure_engine_runs`
(`engine_id`, `engine_version`, entrées hachées, statut, durée). Les profils/modèles
personnels sont versionnés (`user_performance_profile_versions`). Les tests peuvent
rejouer un moteur sur des fixtures.

**Alternatives rejetées** — Version implicite par commit (intraçable) ; moteurs
impurs avec I/O intégrés (non testables, non réutilisables).

---

## ADR-AI-006 — Traitements lourds via jobs idempotents

**Statut** : Accepté (Phase 0)

**Contexte** — Le dépôt a prouvé le pattern : `ai_jobs` + `claim_pending_ai_jobs`
(SKIP LOCKED, cap 5 tentatives) + route cron protégée par `CRON_SECRET` + client
service-role. Cependant `ai_jobs` est couplé au quota IA et `lkv_events` est un bus
fire-and-forget avec des FK legacy (`travel_groups`).

**Décision** — Les traitements du domaine (normalisation GPS, map-matching,
agrégation collective, recalcul) utilisent une file dédiée `adventure_domain_events`
avec le **même pattern éprouvé** : statuts `pending → processing → processed →
failed`, RPC `claim_pending_adventure_events` (SKIP LOCKED), exécution service-role,
idempotence par clé (`event_type` + `entity_id` + `processor_version`).
`lkv_events` reste réservé aux événements visibles utilisateur (feed, notifications).

**Conséquences** — Pas de nouvelle abstraction générique de queue ; on duplique le
pattern éprouvé, pas les responsabilités. Un même traitement rejoué ne crée pas de
doublon (contrainte d'unicité en base).

**Alternatives rejetées** — Généraliser `ai_jobs` (couplage quota/feature IA) ;
réutiliser `lkv_events` (fire-and-forget, RLS orientée feed, FK legacy).

---

## ADR-AI-007 — Stratégie offline Dexie (V2)

**Statut** : Accepté (Phase 0)

**Contexte** — La file offline actuelle utilise `localStorage` (limité, non
transactionnel, pas de requêtes). La roadmap impose un pack complet par aventure et
une synchronisation robuste sans conflits destructifs.

**Décision** — Migrer la persistance offline vers Dexie (déjà en dépendance) avec les
stores : `offline_adventures`, `offline_routes`, `offline_segments`,
`offline_predictions`, `offline_pois`, `offline_terrain_events`,
`offline_reports_queue`, `offline_sessions_queue`, `offline_decisions_queue`,
`sync_metadata`. Chaque opération porte une clé d'idempotence. La synchronisation est
last-write-wins par opération idempotente, jamais de suppression destructive côté
serveur à partir d'un état local périmé.

**Conséquences** — Phase 7 implémente la migration ; les modules actuels
(`HikeSessionService`, `OfflineManager`) deviennent des façades. Les tests vérifient
la file, la reprise et l'idempotence.

**Alternatives rejetées** — Rester sur `localStorage` (taille, pas de transactions) ;
IndexedDB brut (verbosité, pas de tests simples) ; SQLite/Capacitor (natif, hors
besoin navigateur/PWA).

---

## ADR-AI-008 — Feature flags et rollout progressif

**Statut** : Accepté (Phase 0)

**Contexte** — La table `feature_flags` + RPC `current_feature_flags()` existent et
sont consommées par le hub (fail-open). Les fonctionnalités du domaine (profil V2,
prédictions, collectif, Terrain Live) sont risquées : elles doivent pouvoir être
activées en shadow mode puis déployées par paliers.

**Décision** — Toute fonctionnalité du domaine est derrière un flag `feature_flags` :
`performance_profile_v2`, `route_prediction_v2`, `collective_intelligence`,
`terrain_live`, plus les variantes `*_shadow` (exécution silencieuse, comparaison sans
impact utilisateur). Rollout : interne → 1 % → 5 % → 20 % → 50 % → 100 %.
Critères d'arrêt documentés (Phase 9) : fuite de données, erreur RLS, ETA dangereuse,
faux signalements, batterie, coûts, corruption, sync destructive.

**Conséquences** — Les moteurs acceptent un contexte de flags ; le comportement par
défaut reste le fallback sûr (V1 / pas de personnalisation / pas de collectif).
Chaque flag est déclaré dans la migration des flags + le typage `FeatureFlags`.

**Alternatives rejetées** — Déploiement direct (rollback coûteux, risque sécurité) ;
flags par variables d'environnement uniquement (pas d'activation par cohorte).
