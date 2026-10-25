# Nouvelle roadmap canonique — 10 phases

```text
Phase 0 — Audit, architecture et baseline
Phase 1 — Domaine central, BDD et sécurité
Phase 2 — Traitement GPS, segmentation et map-matching
Phase 3 — Profil Terrain, difficulté et prédictions personnelles
Phase 4 — Intelligence collective des sentiers
Phase 5 — Terrain Live
Phase 6 — Adventure Orchestrator et génération complète
Phase 7 — Intégration Hub, cockpit et offline
Phase 8 — Groupe, trek et monétisation
Phase 9 — Hardening, bêta et mise en production
```

Les appareils connectés restent hors périmètre. Seuls leurs contrats futurs sont préparés.

---

# Principes d’exécution

Chaque phase suit obligatoirement :

```text
brainstorming
→ writing-plans
→ using-git-worktrees
→ test-driven-development
→ subagent-driven-development ou executing-plans
→ requesting-code-review
→ verification-before-completion
→ finishing-a-development-branch
```

Chaque phase produit :

1. une spécification ;
2. un plan d’implémentation ;
3. une branche ou un worktree ;
4. des migrations additives ;
5. des moteurs métier testés ;
6. des API validées ;
7. des tests RLS si la BDD change ;
8. un rapport de vérification ;
9. un commit ou une série de commits atomiques ;
10. un état clair : réalisé, partiel ou bloqué.

---

# Phase 0 — Audit, architecture et baseline

## Objectif

Comprendre exactement ce qui existe avant de créer ou modifier quoi que ce soit.

## À réaliser

### 0.1 Audit du code

Auditer :

- `src/features/trips/engine` ;
- `src/features/trips/schemas` ;
- `src/features/hiking/engine` ;
- `src/features/hiking/intelligence` ;
- `src/features/hiking/navigation` ;
- `src/features/hiking/offline` ;
- `src/features/hub` ;
- `src/features/materiel` ;
- `src/lib/ai` ;
- `src/features/affiliation`.

Documenter pour chaque moteur :

- responsabilité ;
- entrées ;
- sorties ;
- dépendances ;
- persistance ;
- constantes ;
- tests ;
- limites ;
- candidats à l’extension ;
- candidats à la suppression future.

### 0.2 Audit BDD

Inventorier :

- toutes les tables ;
- colonnes ;
- clés étrangères ;
- index ;
- RLS ;
- fonctions PostGIS ;
- fonctions `SECURITY DEFINER` ;
- vues ;
- triggers ;
- migrations ;
- tables potentiellement dupliquées.

Vérifier notamment :

- `hike_sessions` ;
- `trail_segments` ;
- `hiking_routes` ;
- `trail_pois` ;
- `trail_metadata` ;
- `trail_scores` ;
- `trips` ;
- `trip_steps` ;
- `crews` ;
- `crew_members` ;
- tables IA ;
- tables matériel ;
- tables affiliation.

### 0.3 Décisions d’architecture

Produire des ADR :

```text
ADR-001 — AdventurePlan comme source de vérité
ADR-002 — trail_segments reste le réseau géographique central
ADR-003 — données privées séparées des agrégats publics
ADR-004 — IA enrichisseur, jamais calculateur primaire
ADR-005 — moteurs purs et versionnés
ADR-006 — traitements lourds via jobs idempotents
ADR-007 — stratégie offline Dexie
ADR-008 — feature flags et rollout progressif
```

### 0.4 Baseline

Exécuter :

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run verify:invariants
npm run verify:icons
npm run test:a11y
```

Enregistrer les erreurs existantes avant le chantier.

## Skills

- `brainstorming`
- `writing-plans`
- `dispatching-parallel-agents`
- `using-git-worktrees`
- `verification-before-completion`

## Agents

- architecte principal ;
- agent PostgreSQL/PostGIS ;
- agent moteurs TypeScript ;
- agent sécurité ;
- agent qualité.

## Livrable

```text
docs/architecture/adventure-intelligence-current-state.md
docs/architecture/adventure-intelligence-decisions.md
docs/superpowers/plans/a0-adventure-baseline.md
```

## Gate de sortie

Aucune fonctionnalité nouvelle. La phase est validée uniquement si l’architecture réelle est documentée et les duplications évitées.

---

# Phase 1 — Domaine central, BDD et sécurité

## Objectif

Créer les contrats partagés et toute la fondation BDD du système.

Cette phase regroupe l’ancien domaine, les migrations, la provenance, la confiance, les événements et les consentements.

## 1.1 Domaine TypeScript

Créer :

```text
src/features/adventure-intelligence/
├── domain/
│   ├── adventurePlan.ts
│   ├── confidence.ts
│   ├── provenance.ts
│   ├── constraints.ts
│   ├── decisions.ts
│   ├── events.ts
│   └── engine.ts
└── schemas/
    ├── adventurePlan.schema.ts
    ├── performance.schema.ts
    ├── terrain.schema.ts
    ├── prediction.schema.ts
    └── live.schema.ts
```

Contrat central :

```ts
export interface EngineResult<T> {
  value: T;
  confidence: Confidence;
  provenance: DataProvenance[];
  assumptions: Assumption[];
  warnings: EngineWarning[];
  alternatives: Alternative<T>[];
  impacts: PlanImpact[];
  computedAt: string;
  validUntil?: string;
}
```

Contrat moteur :

```ts
export interface AdventureEngine<I, O> {
  readonly id: string;
  readonly version: string;
  readonly dependencies: string[];

  canRun(context: AdventureExecutionContext): boolean;

  run(
    input: I,
    context: AdventureExecutionContext
  ): Promise<EngineResult<O>>;
}
```

## 1.2 Fondations BDD

Créer ou étendre intelligemment les ensembles suivants.

### Consentements

- `adventure_data_consents`

Finalités initiales :

```text
personal_performance
collective_terrain
live_location
group_location
external_readiness
```

`external_readiness` reste désactivé.

### Enrichissement des segments

- conserver `trail_segments` ;
- créer `trail_segment_features`.

Ne jamais recréer une deuxième table de réseau géographique concurrente.

### Données privées d’activité

- étendre `hike_sessions` ;
- créer `session_segment_passages` ;
- créer `performance_observations`.

### Profil personnel

- `user_performance_profiles` ;
- `user_performance_profile_versions`.

### Intelligence collective

- `segment_condition_buckets` ;
- `segment_collective_aggregates` ;
- vue publique filtrée.

### Terrain Live

- `terrain_reports` ;
- `terrain_report_confirmations` ;
- `terrain_events`.

### Prédictions

- `segment_predictions` ;
- `route_predictions`.

### AdventurePlan

- `adventure_plans` ;
- `adventure_plan_versions` ;
- `adventure_plan_decisions` ;
- `adventure_engine_runs`.

### Traitements asynchrones

- `adventure_domain_events` ;
- réutiliser le système de jobs existant s’il est générique ;
- ne créer une nouvelle table de jobs qu’après preuve que l’existante est insuffisante.

## 1.3 Séparation des données

```text
Niveau 1 — traces privées brutes
Niveau 2 — observations privées dérivées
Niveau 3 — agrégats collectifs sans identité
Niveau 4 — vues publiques filtrées
```

## 1.4 RLS

Règles obligatoires :

- session privée accessible seulement par son propriétaire ;
- observations privées inaccessibles publiquement ;
- profil personnel inaccessible aux autres membres ;
- service role uniquement pour les agrégations ;
- rapports publics sans identité du contributeur ;
- agrégats publics seulement au-dessus d’un seuil de contributeurs ;
- AdventurePlan accessible au propriétaire et aux collaborateurs autorisés.

## 1.5 Contrats futurs santé

Créer seulement :

```ts
export interface ExternalReadinessProvider {
  readonly providerId: string;

  isAvailable(): Promise<boolean>;

  requestAuthorization(
    categories: ReadinessDataCategory[]
  ): Promise<AuthorizationResult>;

  getDailyReadiness(
    date: string
  ): Promise<ExternalReadinessSnapshot | null>;
}
```

Avec un `NoopReadinessProvider`.

Aucun plugin HealthKit, Health Connect ou appareil connecté.

## Skills

- `test-driven-development`
- `subagent-driven-development`
- `requesting-code-review`
- `/icon-programming-review`
- `/icon-security-review`
- `/icon-data-ai-review`

## Gate de sortie

- migrations additives ;
- base vide migrable ;
- base existante migrable ;
- tests RLS ;
- contrats Zod ;
- aucune exposition de données privées ;
- aucun connecteur santé réel.

---

# Phase 2 — Traitement GPS, segmentation et map-matching

## Objectif

Transformer les sessions existantes en passages fiables sur les segments de sentier.

## 2.1 Normalisation des traces

Pipeline :

```text
hike_sessions.positions_geojson
→ validation
→ nettoyage
→ tri temporel
→ suppression des doublons
→ rejet des téléportations
→ lissage altitude
→ détection des pauses
→ métriques
→ score qualité
```

## 2.2 Qualité

```ts
export interface TrackQuality {
  overall: number;
  gpsAccuracy: number;
  temporalContinuity: number;
  altitudeReliability: number;
  plausibleMovement: number;
  reasons: string[];
}
```

## 2.3 Enrichissement des segments

Pour chaque `trail_segment` :

- longueur ;
- sens ;
- pente moyenne ;
- pente maximale ;
- D+ ;
- D- ;
- altitude minimale ;
- altitude maximale ;
- surface ;
- technicité ;
- exposition ;
- isolement.

Ces valeurs sont enregistrées dans `trail_segment_features`.

## 2.4 Map-matching

Algorithme progressif :

```text
candidats PostGIS
→ score proximité
→ score direction
→ continuité avec le segment précédent
→ cohérence de vitesse
→ pénalité de saut
→ segment retenu
```

## 2.5 Passage segmenté

Chaque session produit des `session_segment_passages` contenant :

- segment ;
- sens ;
- entrée ;
- sortie ;
- durée ;
- temps en mouvement ;
- arrêts ;
- distance ;
- D+ ;
- D- ;
- allure ;
- qualité GPS ;
- qualité map-matching ;
- demi-tour ;
- sortie de trace.

## 2.6 Idempotence

Statuts :

```text
pending
→ processing
→ processed
→ failed
```

Même session + même version de traitement = aucun doublon.

## Skills

- `test-driven-development`
- `systematic-debugging`
- `subagent-driven-development`
- `/icon-programming-review`
- `/icon-data-ai-review`
- `/icon-platform-operations-review`

## Agents

- PostGIS ;
- algorithmes ;
- qualité des données ;
- sécurité.

## Gate de sortie

- sessions transformées en passages ;
- map-matching mesurable ;
- score de qualité ;
- sens montée/descente distingué ;
- aucun agrégat collectif encore publié.

---

# Phase 3 — Profil Terrain, difficulté et prédictions personnelles

## Objectif

Construire le cœur de la personnalisation sans données connectées.

Cette phase fusionne Profil Terrain, difficulté personnelle, allure, fatigue, pauses et ETA.

## 3.1 Évolution du moteur actuel

Conserver `HikerProfileEngine` comme fallback V1.

Créer une V2 plus robuste :

- médiane pondérée ;
- rejet des anomalies ;
- qualité des observations ;
- séparation plat/montée/descente ;
- surface ;
- durée ;
- fatigue ;
- portage ;
- récence ;
- versionnement.

## 3.2 Profil Terrain

```ts
export interface PerformanceProfile {
  userId: string;
  activityType: 'hiking';

  flatSpeedKmH: number;
  ascentSpeedMPerHour: number;
  descentSpeedMPerHour: number;

  gradeResponse: ResponseCurve;
  surfaceResponse: ResponseCurve;
  fatigueCurve: FatigueCurve;
  pauseModel: PauseModel;
  packResponse: ResponseCurve;

  confidence: Confidence;
  modelVersion: string;
  computedAt: string;
}
```

## 3.3 Niveaux de calibration

```text
Profil froid        : 0 activité
Calibration         : 3–5 activités exploitables
Personnalisation    : 10–20 activités
Contextualisation   : historique suffisamment diversifié
```

Ce sont des seuils produit, pas des vérités médicales.

## 3.4 Fatigue sans santé

Utiliser seulement :

- durée active ;
- D+ ;
- D- ;
- technicité ;
- charge récente dans LKDV ;
- poids du sac déclaré ;
- pauses ;
- fatigue déclarée ;
- difficulté ressentie.

## 3.5 Prédiction segment

```ts
export interface SegmentPrediction {
  durationP50Seconds: number;
  durationP90Seconds: number;
  paceRangeMinPerKm: [number, number];
  effortScore: number;
  personalDifficulty: number;
  recommendedPauseSeconds: number;
  confidence: Confidence;
  factors: PredictionFactor[];
}
```

## 3.6 Prédiction route

Produire :

- temps P50 ;
- temps P90 ;
- allure confort ;
- allure recommandée ;
- allure rapide ;
- pauses ;
- difficulté personnelle ;
- fatigue maximale ;
- heure de demi-tour ;
- segments critiques.

## 3.7 Remplacement progressif du rythme fixe

Remplacer le `15 min/km` du copilote par :

```text
profil personnel
→ profil générique si confiance faible
→ estimation standard si aucune donnée
```

Feature flag :

```text
performance_profile_v2
route_prediction_v2
```

## Tests invariants

- plus de distance ne doit pas produire moins de temps ;
- plus de D+ ne doit pas réduire l’effort ;
- une confiance faible doit élargir P50–P90 ;
- la stratégie rapide ne doit pas être plus lente que confort ;
- un profil froid doit être explicitement marqué comme non personnalisé.

## Skills

- `test-driven-development`
- `ai-engineering-toolkit` pour l’évaluation, pas pour les calculs
- `/icon-data-ai-review`
- `/icon-programming-review`
- `/icon-product-policy-review`

## Gate de sortie

- profil persistant ;
- profil versionné ;
- ETA personnelle ;
- difficulté personnelle ;
- stratégies d’allure ;
- backtesting ;
- fallback sûr.

---

# Phase 4 — Intelligence collective des sentiers

## Objectif

Fusionner les passages de plusieurs utilisateurs afin de produire une difficulté collective par segment.

## 4.1 Consentement

Un passage collectif doit remplir toutes les conditions :

```text
consentement actif
+ session terminée
+ qualité GPS suffisante
+ map-matching suffisant
+ comportement plausible
+ segment suffisamment parcouru
```

## 4.2 Normalisation personnelle

Ne jamais agréger simplement les vitesses.

Calcul principal :

```text
ratio_normalisé =
temps_observé
/
temps_attendu_pour_cette_personne
```

Cela permet de mesurer la difficulté du segment indépendamment du niveau de la personne.

## 4.3 Agrégation robuste

Utiliser :

- médiane pondérée ;
- P25 ;
- P50 ;
- P75 ;
- P90 ;
- récence ;
- qualité ;
- diversité des utilisateurs ;
- conditions ;
- sens ;
- détection d’anomalies.

## 4.4 Conditions

Différencier :

- sec ;
- humide ;
- neige ;
- glace ;
- jour ;
- nuit ;
- montée ;
- descente ;
- sac léger ;
- sac lourd.

## 4.5 Scores

Par segment :

- effort ;
- technicité observée ;
- fatigue ;
- orientation ;
- ralentissement ;
- difficulté collective ;
- confiance.

## 4.6 Confidentialité

Aucune sortie publique si :

- moins de cinq utilisateurs distincts ;
- confiance trop faible ;
- données trop anciennes ;
- diversité insuffisante.

## 4.7 Migration du prototype

Faire évoluer `TrailIntelligenceEngine` :

- route → segment ;
- moyenne → médiane pondérée ;
- allure brute → ratio normalisé ;
- `Math.random()` → identifiants serveur/idempotence ;
- calcul client → traitement serveur ;
- résultat non persistant → agrégats versionnés.

## Skills

- `test-driven-development`
- `ai-engineering-toolkit` pour l’eval harness
- `/icon-data-ai-review`
- `/icon-security-review`
- `/icon-product-policy-review`

## Gate de sortie

- difficulté collective par segment ;
- seuil de confidentialité ;
- confiance ;
- conditions ;
- carte de données agrégées ;
- aucune donnée individuelle publique.

---

# Phase 5 — Terrain Live

## Objectif

Construire le Waze de l’outdoor.

## 5.1 Signalements MVP

Catégories initiales :

1. obstacle ;
2. fermeture ;
3. boue ;
4. neige/glace ;
5. eau ;
6. danger.

Ajouts ultérieurs :

- pont ;
- crue ;
- balisage ;
- refuge ;
- affluence ;
- animal ;
- chute de pierres.

## 5.2 Création

En moins de cinq secondes :

```text
bouton
→ catégorie
→ gravité/passabilité
→ confirmation
```

Automatique :

- position ;
- précision ;
- heure ;
- segment ;
- direction.

Optionnel :

- photo ;
- commentaire.

## 5.3 Déduplication

Fusionner si :

- même catégorie ;
- même segment ;
- distance faible ;
- fenêtre temporelle compatible.

## 5.4 Confirmation

Réponses :

- toujours présent ;
- disparu ;
- inconnu.

Un utilisateur ne compte pas plusieurs fois pour le même événement.

## 5.5 Cycle de vie

```text
pending
→ confirmed
→ active
→ stale
→ verify
→ resolved | expired | rejected
```

## 5.6 Confiance

```text
confirmations
+ récence
+ qualité GPS
+ utilisateurs distincts
+ cohérence traces
+ source officielle
- contradictions
- ancienneté
- suspicion d’abus
```

## 5.7 Détection automatique

À activer après validation du manuel :

- ralentissement collectif ;
- demi-tours ;
- sorties de trace ;
- contournements.

Les détections automatiques restent d’abord en `shadow mode`.

## 5.8 Modération

- rate limiting ;
- cooldown ;
- réputation plafonnée ;
- validation d’upload ;
- historique ;
- suppression ;
- bannissement ;
- source officielle prioritaire.

## Skills

- `test-driven-development`
- `apple-ui-designer`
- `interaction-design`
- `/icon-security-review`
- `/icon-design-review`
- `/icon-product-policy-review`

## Gate de sortie

- création ;
- confirmation ;
- expiration ;
- déduplication ;
- modération ;
- carte ;
- liste verticale ;
- API filtrée ;
- file offline.

---

# Phase 6 — Adventure Orchestrator et génération complète

## Objectif

Relier toutes les briques existantes autour d’un `AdventurePlan`.

## 6.1 AdventurePlan

Le plan doit contenir :

```text
Intent
Participants
Dates
Destinations
Transport
Étapes
Parcours
Hébergements
Nourriture et eau
Matériel
Budget
Documents
Réglementation
Sécurité
Difficulté
Allures
ETA
Terrain Live
Alternatives
Confiance
Décisions
Surveillance
Versions
```

## 6.2 Registre des moteurs

Réutiliser via adaptateurs :

- `tripBriefExtractor` ;
- blueprints ;
- `autoGenPipeline` ;
- `coherenceSolver` ;
- `budgetEngine` ;
- `contextualKitEngine` ;
- itinéraire ;
- météo ;
- profil personnel ;
- prédiction ;
- difficulté ;
- sécurité ;
- documents.

## 6.3 Graphe de dépendances

```text
Intention
→ destination/dates/participants/contraintes
→ itinéraire/transport/hébergements
→ météo/réglementation
→ profil/terrain
→ prédiction/difficulté
→ alimentation/matériel/budget
→ sécurité
→ solveur
→ AdventurePlan
```

## 6.4 Trois candidats

Produire :

- confort ;
- équilibré ;
- aventure/autonomie.

Chaque candidat expose :

- budget ;
- effort ;
- durée ;
- confort ;
- risques ;
- incertitude ;
- raisons.

## 6.5 Verrous

L’utilisateur peut verrouiller :

- dates ;
- budget ;
- trajet ;
- activité ;
- hébergement ;
- étape ;
- matériel.

Le solveur ne modifie jamais un verrou silencieusement.

## 6.6 Versionnement

Tout recalcul crée :

- nouvelle version ;
- raison ;
- diff ;
- impacts ;
- décisions nécessaires.

## 6.7 Niveaux d’autonomie

```text
Conseiller
Copilote
Autopilote encadré
```

Confirmation obligatoire pour :

- paiement ;
- annulation coûteuse ;
- changement de sécurité ;
- partage de localisation ;
- modification touchant tout le groupe.

## 6.8 IA

Flux :

```text
résultats déterministes
→ contexte structuré
→ askAI
→ explication utilisateur
```

L’échec IA ne doit jamais rendre le plan inutilisable.

## Skills

- `brainstorming`
- `writing-plans`
- `subagent-driven-development`
- `test-driven-development`
- `ai-engineering-toolkit`
- `/icon-programming-review`
- `/icon-data-ai-review`
- `/icon-security-review`

## Gate de sortie

Une phrase doit produire :

- un plan complet ;
- trois variantes ;
- provenance ;
- confiance ;
- décisions ;
- version ;
- fallback sans IA.

---

# Phase 7 — Intégration Hub, cockpit et offline

## Objectif

Transformer les moteurs en expérience utilisateur utilisable avant et pendant la sortie.

## 7.1 Hub

Ordre recommandé :

```text
Hero
→ état global
→ décisions requises
→ actions prioritaires
→ alertes Terrain Live
→ difficulté personnelle
→ ETA
→ grille des sections
→ détail dans les drawers
```

## 7.2 Limitation des carrousels

Par écran :

- un Hero ;
- un ActionStack ;
- zéro ou un carrousel ;
- trois indicateurs maximum ;
- trois actions prioritaires ;
- une grille de navigation ;
- alertes verticales.

## 7.3 Cockpit

Ajouter :

- stratégie d’allure ;
- ETA P50/P90 ;
- avance/retard ;
- prochain segment difficile ;
- Terrain Live ;
- heure de demi-tour ;
- confiance ;
- mode offline ;
- raisons de recalcul.

## 7.4 Recalcul live

Déclencheurs :

- nouvelle position ;
- pause ;
- changement d’allure significatif ;
- sortie de trace ;
- nouvelle condition ;
- événement Terrain Live ;
- batterie faible ;
- changement d’itinéraire.

Ne pas recalculer inutilement à chaque rendu React.

## 7.5 Offline V2

Migrer la file de `localStorage` vers Dexie.

Stores :

```text
offline_adventures
offline_routes
offline_segments
offline_predictions
offline_pois
offline_terrain_events
offline_reports_queue
offline_sessions_queue
offline_decisions_queue
sync_metadata
```

Chaque opération possède une clé d’idempotence.

## 7.6 UX mobile

Skills obligatoires :

- `apple-ui-designer`
- `interaction-design`

Tests obligatoires :

- 320 × 568 ;
- 360 × 800 ;
- 390 × 844 ;
- texte 150–200 % ;
- mode hors ligne ;
- luminosité élevée ;
- batterie faible ;
- `prefers-reduced-motion`.

## Gate de sortie

- plan visible dans le Hub ;
- prédiction visible ;
- Terrain Live visible ;
- cockpit recalculé ;
- fonctionnement hors ligne ;
- synchronisation après reconnexion ;
- tests a11y et visuels.

---

# Phase 8 — Groupe, trek et monétisation

## Objectif

Étendre le système au collectif, au multi-jours et au modèle économique.

## 8.1 Groupe

Produire :

- allure de chaque membre ;
- allure collective ;
- membre dimensionnant ;
- difficulté par membre ;
- difficulté du groupe ;
- pauses ;
- risques de séparation ;
- redistribution du matériel.

Ne jamais montrer publiquement les données privées détaillées d’un membre.

## 8.2 Trek multi-jours

Calculer :

- fatigue cumulative ;
- récupération ;
- charge quotidienne ;
- impact du D+/D- ;
- impact du portage ;
- difficulté du lendemain ;
- risque de dérive.

Proposer :

- raccourcir ;
- déplacer des kilomètres ;
- changer de refuge ;
- ajouter une nuit ;
- transférer du matériel ;
- ajouter une étape de récupération.

## 8.3 Monétisation

### Plans

```text
Free
Explorer
Expedition
Group
```

### Pass

```text
Weekend
Voyage
Expédition
```

### Entitlements

- génération complète ;
- offline ;
- profil avancé ;
- ETA live ;
- historique ;
- Terrain Live avancé ;
- groupe ;
- trek ;
- surveillance.

### Affiliation

Relier :

- matériel manquant ;
- hébergements ;
- activités ;
- transport ;
- location.

Classement fondé sur la pertinence, pas sur la commission.

### B2B

Préparer les contrats futurs :

- API difficulté ;
- API ETA ;
- API conditions ;
- tableaux territoriaux.

Ne pas lancer nécessairement l’API commerciale dans cette phase si le produit B2C n’est pas stable.

## Skills

- `brainstorming`
- `test-driven-development`
- `/icon-business-review`
- `/icon-product-policy-review`
- `/icon-security-review`
- `/icon-data-ai-review`

## Gate de sortie

- groupe fonctionnel ;
- trek multi-jours ;
- fatigue expliquée ;
- paywall cohérent ;
- entitlements testés ;
- affiliation transparente ;
- aucune monétisation des données santé.

---

# Phase 9 — Hardening, bêta et mise en production

## Objectif

Valider le système en conditions réelles avant généralisation.

## 9.1 Sécurité

- audit RLS ;
- audit API ;
- validation Zod ;
- rate limiting ;
- upload de photos ;
- GeoJSON malformé ;
- tailles maximales ;
- fonctions SQL ;
- service role ;
- secrets ;
- journalisation ;
- suppression utilisateur.

## 9.2 Performance

- `EXPLAIN ANALYZE` ;
- index GIST ;
- requêtes de proximité ;
- agrégations ;
- pagination ;
- cache ;
- fréquence des jobs ;
- coût des tuiles ;
- coût IA ;
- taille Dexie ;
- consommation batterie.

## 9.3 Backtesting

Mesurer :

- erreur ETA médiane ;
- erreur P90 ;
- calibration ;
- difficulté prévue contre difficulté ressentie ;
- précision du map-matching ;
- faux positifs Terrain Live ;
- temps de confirmation ;
- dérive par type de terrain.

## 9.4 Shadow mode

Flags :

```text
performance_profile_v2_shadow
route_prediction_v2_shadow
collective_intelligence_shadow
terrain_auto_detection_shadow
```

Comparer V1/V2 sans influencer l’utilisateur.

## 9.5 Rollout

```text
interne
→ 1 %
→ 5 %
→ 20 %
→ 50 %
→ 100 %
```

## 9.6 Critères d’arrêt

Rollback si :

- fuite de données ;
- erreur critique de RLS ;
- hausse anormale des erreurs ;
- ETA dangereusement sous-estimée ;
- faux signalements critiques ;
- consommation batterie excessive ;
- coût non maîtrisé ;
- corruption de session ;
- synchronisation offline destructive.

## 9.7 Vérification finale

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run verify:invariants
npm run verify:icons
```

Revues :

```text
/icon-review
/icon-programming-review
/icon-security-review
/icon-design-review
/icon-business-review
/icon-data-ai-review
/icon-product-policy-review
/icon-platform-operations-review
```

## Gate de sortie

- tests complets ;
- migrations validées ;
- rollback documenté ;
- observabilité ;
- alertes ;
- bêta mesurée ;
- validation humaine avant généralisation.

---

# Vue synthétique des dépendances

| Phase | Dépend de | Résultat principal |
|---|---|---|
| 0 | Rien | Audit et décisions |
| 1 | 0 | Domaine + BDD + RLS |
| 2 | 1 | Sessions transformées en passages |
| 3 | 2 | Profil + ETA + difficulté personnelle |
| 4 | 2 et 3 | Difficulté collective |
| 5 | 1, 2 et 4 | Terrain Live |
| 6 | 3, 4 et 5 | AdventurePlan orchestré |
| 7 | 5 et 6 | Hub, cockpit, offline |
| 8 | 3, 6 et 7 | Groupe, trek, revenus |
| 9 | Toutes | Bêta et production |

---

# Fichiers de plans à créer

Un seul plan par phase :

```text
docs/superpowers/plans/
├── a0-baseline-architecture.md
├── a1-domain-database-security.md
├── a2-gps-segmentation-map-matching.md
├── a3-personal-profile-prediction.md
├── a4-collective-trail-intelligence.md
├── a5-terrain-live.md
├── a6-adventure-orchestrator.md
├── a7-hub-cockpit-offline.md
├── a8-group-trek-monetization.md
└── a9-hardening-beta-production.md
```

Chaque plan peut contenir plusieurs tâches TDD, mais il est interdit de recréer des phases supplémentaires.

---

# Ordre final canonique

```text
0. Comprendre et sécuriser l’existant
1. Installer le domaine et toute la BDD
2. Transformer les traces en passages
3. Apprendre la personne et prédire
4. Apprendre collectivement le terrain
5. Faire vivre le terrain en temps réel
6. Générer et orchestrer l’aventure complète
7. Intégrer l’expérience Hub/cockpit/offline
8. Étendre au groupe, au trek et aux revenus
9. Tester, calibrer et déployer progressivement
```

Cette version conserve **tout le système**, mais dans une structure beaucoup plus lisible : **10 phases exactement, de 0 à 9**, avec une vraie livraison fonctionnelle à la fin de chacune.