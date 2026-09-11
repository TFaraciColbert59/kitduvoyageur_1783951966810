# A8 — Groupe, trek et monétisation — Rapport implémenteur (commits 1 à 4)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Spec normative : `docs/superpowers/specs/2026-09-11-a8-group-trek-monetization-design.md`
- Périmètre : commits 1 à 4 (spec intégrale), 4 fichiers domaine purs + 5 fichiers de tests
- Contraintes respectées : aucune I/O dans le domaine, `npm run build` **jamais exécuté**, seuls les 4 fichiers domaine neufs + leurs tests ont été commités.

## Commits (ordre exact de la spec)

1. `a0eb31da` — `feat(a8): intelligence de groupe (membre dimensionnant, separation, redistribution)`
2. `3070548e` — `feat(a8): trek multi-jours (fatigue cumulative, recuperation, ajustements)`
3. `a2e46e4c` — `feat(a8): entitlements, passes et classement d'affiliation transparent`
4. `e4cbf6fe` — `feat(a8): contrats B2B futurs (difficulte, ETA, conditions)`

## Vérifications globales

- `npx vitest run tests/adventure-intelligence` : **40 fichiers / 254 tests passés**, 0 échec (final).
- `npm run type-check` : exit 0 à chaque commit.
- `npm run lint` : exit 0 à chaque commit ; zéro avertissement sur les 9 fichiers A8 (filtre `a8` appliqué). Avertissements préexistants ailleurs uniquement.
- `npm run build` : **jamais exécuté** (contrainte respectée).

---

## Commit 1 — Intelligence de groupe

**Fichiers**
- `src/features/adventure-intelligence/domain/groupIntelligence.ts` (426 lignes)
- `tests/adventure-intelligence/group-intelligence.spec.ts` — `TEST-A8-GRP-01..06` (6 tests)

**Implémentation**
- `buildGroupPlan` : temps par membre = dist/plat + D+/montée + D−/descente (facteur technique 1.25 si pente de descente ≥ 12 %, 1.4 pour un enfant), facteur stratégie A6 (`comfort/recommended/fast`), enfant ×0.85 sur toutes les vitesses, niveaux d'expérience appliqués aux seules valeurs de repli.
- Membre dimensionnant = vitesse minimale (jamais une moyenne) ; `limitingReason` génériquée sans identité (« Allure la plus lente du groupe ; enfant — allure prudente appliquée… »).
- Difficulté par membre via `computeFatigue` A3 (durée du membre, D+/D−, classe technique dérivée, portage) ; `groupDifficulty` = max.
- Séparation = points (écart d'allure 0.8/1.5/2.5 km/h, taille ≥ 6/≥ 9, enfant +3) → low/medium/high + raisons non vides.
- Redistribution = excédent `packWeightKg − maxCarryKg` du membre limitant vers les membres non-enfants à marge, triés par marge, plafonnés à `MAX_GEAR_TRANSFER_KG = 5` par receveur.
- Pauses 60 min resserrées selon difficulté/enfant/stratégie (bornes 20–90).

**TDD**
- RED : module introuvable, 0 test collecté.
- Premier passage : 4/6. Deux échecs dus à des hypothèses de test fausses (route mixte qui écrase l'écart d'allure ; membre limitant non le plus lent sur les trois vitesses) — tests corrigés (route plate dédiée, vitesses du limitant abaissées), pas l'implémentation.
- GREEN : 6/6. Répertoire complet : 36 fichiers / 239 tests.
- Type-check exit 0 ; lint du fichier nettoyé (import `clamp01` inutilisé retiré) avant commit.

**Preuve privacy (TEST-A8-GRP-06)**
- `Object.keys(publicPlan).sort()` = exactement `[groupDifficulty, groupPaceKmH, limitingReason, memberCount, separationRisk]`.
- `JSON.stringify(publicPlan)` ne contient : ni `Alice`/`Bob`, ni `m-alice`/`m-bob`, ni `asthme`, ni les clés `displayName`, `memberId`, `memberPacesKmH`, `perMemberDifficulty`, `gearRedistribution`, `limitations`.
- `JSON.stringify(plan)` (sortie domaine complète) ne contient pas non plus la limitation santé `asthme` : le champ `limitations` est accepté mais jamais recopié ni exploité.

## Commit 2 — Trek multi-jours

**Fichiers**
- `src/features/adventure-intelligence/domain/multiDayTrek.ts` (261 lignes)
- `tests/adventure-intelligence/multi-day-trek.spec.ts` — `TEST-A8-TREK-01..05` (5 tests)

**Implémentation**
- Capacité J1 = `initialCapacityPct` (100 par défaut) ; charge = `computeFatigue` A3 sur durée estimée (4 km/h, 300 m/h montée, 500 m/h descente), D+/D−, technicité, portage.
- Consommation = `loadScore × 0.5` ; récupération nocturne = `recoveryPerNight` (20), ×0.5 si `sleepQuality < 0.5`, ×1.5 si journée < 60 % de la médiane des distances. Capacité bornée [0, 100].
- Difficulté = `loadScore × (2 − capacité/100)` bornée [0, 100] ; dérive = `(capacité initiale − capacité)/100` bornée [0, 1].
- Ajustements si difficulté > 75 (`shorten`, `transfer_gear` si sac > `heavyPackKg`, `move_km` si D+ ≥ 1000) ou dérive > 0.5 (`recovery_day`, `add_night`) ; `change_refuge` si nuit courte — labels et raisons explicites en français.
- `worstDay` = journée de difficulté maximale (première en cas d'égalité) ; `totalDriftRisk` = max des dérives.

**TDD**
- RED : module introuvable, 0 test collecté.
- GREEN direct : 5/5. Répertoire complet : 37 fichiers / 244 tests.
- Type-check exit 0 ; lint sans avertissement sur le fichier.

## Commit 3 — Entitlements, passes et affiliation transparente

**Fichiers**
- `src/features/adventure-intelligence/domain/entitlements.ts` (108 lignes)
- `src/features/adventure-intelligence/domain/affiliationRanking.ts` (90 lignes)
- `tests/adventure-intelligence/entitlements.spec.ts` — `TEST-A8-ENT-01..05` (5 tests)
- `tests/adventure-intelligence/affiliation-ranking.spec.ts` — `TEST-A8-AFF-01..03` (3 tests)

**Implémentation entitlements**
- `PLAN_ENTITLEMENTS` (hiérarchie sans fuite, chaque plan ⊇ précédent) : free ∅ ; explorer `full_generation/advanced_profile/history` ; expedition + `offline/live_eta/terrain_live_advanced/trek` ; group + `group/monitoring`.
- `PASS_ENTITLEMENTS` conformes spec : weekend `full_generation+offline`, trip `full_generation+live_eta`, expedition `+trek+monitoring`.
- `hasEntitlement` : plan/entitlement inconnu ⇒ `false`. `requiredPlanFor` : premier plan de la hiérarchie qui débloque ; inconnu ⇒ `group` (plan le plus restrictif, qui ne débloque rien) ⇒ jamais d'accord par erreur.
- `effectiveEntitlements` : union plan + passes, dédupliquée, ordre canonique, passes inconnus ignorés.

**Implémentation affiliation**
- Score = pertinence [0,1] + ajustements de contexte plafonnés à ±0.05 (équipement manquant +0.03, budget +0.02/−0.04, disponibilité inconnue −0.02) ; `unavailable` exclue ; tri stable (scores égaux ⇒ ordre d'entrée conservé).
- `commissionPct` n'est **jamais** lu dans le module (aucune occurrence dans la logique) ; la sortie ne contient que `offerId/score/reasons`.

**TDD**
- RED : les 2 modules introuvables, 0 test collecté.
- GREEN direct : 8/8. Répertoire complet : 39 fichiers / 252 tests.
- Type-check exit 0 ; lint sans avertissement sur les 4 fichiers.

**Preuve commission ignorée (TEST-A8-AFF-02)**
- Mêmes offres, commission inversée (2 % ⇄ 45 %) : ordre `['a','b']` identique dans les deux exécutions, et score de `a` (resp. `b`) strictement identique entre les deux exécutions.
- `Object.keys(entry).sort()` = `[offerId, reasons, score]` : aucun champ commission exposé.
- Preuve indirecte : deux offres de pertinence 0.9 vs 0.4 gardent l'ordre même quand la moins pertinente cumule tous les bonus contexte/budget et que la meilleure est hors budget (AFF-01).

## Commit 4 — Contrats B2B futurs

**Fichiers**
- `src/features/adventure-intelligence/domain/b2bContracts.ts` (119 lignes)
- `tests/adventure-intelligence/b2b-contracts.spec.ts` — `TEST-A8-B2B-01..02` (2 tests)

**Implémentation**
- Types `DifficultyApiContract`, `EtaApiContract`, `ConditionsApiContract` (version `v1`), `B2bContractMap`, descripteurs et `b2bContractCatalog()` statique retournant `[{ version: 'v1', contracts: [difficulty, eta, conditions] }]`.
- Aucune implémentation, aucun endpoint, aucun accès base, aucun import serveur.
- Champs exposés : difficulty in `segmentId/direction` out `difficulty/confidence` ; eta in `segmentIds/profileRef` out `etaP50/etaP90/confidence` ; conditions in `bbox` out `activeEvents/confidence`. Aucun identifiant utilisateur, aucun champ santé/physiologique.

**TDD**
- RED : module temporairement retiré ⇒ `Cannot find package ...b2bContracts`, 0 test collecté (preuve capturée).
- GREEN : 2/2. Répertoire complet : 40 fichiers / 254 tests.
- Type-check exit 0 ; lint sans avertissement sur les 2 fichiers.

**Preuve absence de données santé (TEST-A8-B2B-02)**
- `JSON.stringify(b2bContractCatalog()).toLowerCase()` ne contient aucun de : `health, santé, sante, heart, cardio, blood, medical, allerg, bpm, vo2, poids, userid, memberid, displayname`.
- Listes de champs verrouillées par assertion exacte (entrées et sorties).

---

## Concerns

1. **`groupPaceKmH` dans la projection publique** est par construction l'allure du membre limitant (spec l'inclut explicitement) : c'est une inférence indirecte possible de la vitesse du plus lent. Conforme à la spec, mais à documenter côté UI (Phase 9).
2. **Contenu de `PLAN_ENTITLEMENTS` non spécifié par la spec** : j'ai choisi free = ∅, échelle monotone explorer ⊂ expedition ⊂ group. Si le produit veut un entitlement offert en free (ex. `history`), il suffit d'ajuster la table, les tests restent structurels.
3. **`optimal requiredPlanFor` inconnu ⇒ `group`** : choix conservateur (le plan le plus cher ne débloque pas un entitlement inconnu). Une variante consisterait à retourner `free`, mais `group` rend toute fuite impossible.
4. **`limitations`** est accepté dans `GroupMemberInput` mais volontairement jamais utilisé ni écho (privacy-first) : il ne pondère ni l'allure ni les raisons. La pondération « descente technique + enfants » demandée par la spec est bien implémentée.
5. **`missingGearCategories`** est un match au niveau catégorie (`gear`) et non article, car `AffiliationOffer.category` est une catégorie large ; un futur mapping article→catégorie pourra affiner sans changer l'API.
6. **Technical class de groupe** dérivée de la pente des `GroupSegment` (pas de champ `technicalClass` dans la spec de `GroupSegment`) ; le seuil 12 % est exporté et testable.
7. **Dérive du trek** modélisée en fraction de capacité initiale (0–1) ; le seuil d'alerte 0.5 est exporté. La sémantique « capacité au départ de la journée » est documentée dans le module.
8. **Pas d'UI** : conforme au gate de sortie (montage Phase 9). Aucun adaptateur serveur ni persistance A8 introduits.
