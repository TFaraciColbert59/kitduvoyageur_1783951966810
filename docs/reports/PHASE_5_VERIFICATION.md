# PHASE 5 — Vérification (Kit voyageur complet)

**Date :** 2026-09-12
**Branche :** `feat/phase5-kit-complet` (base `59e30946` = main) — commit d'implémentation `5bf5b02`
**Environnement :** Supabase local Docker (`127.0.0.1:54322`) + vitest + pgTAP ; **distant = INSUFFICIENT_DATA** (projet de test Phase 1 non provisionné)
**Responsable :** agent BACKEND/DATABASE/FRONTEND autonome (orchestrateur à valider)
**Décision :** **PASS (périmètre local)** — sous-item « agrégats anonymisés kit » = **INSUFFICIENT_DATA** (non implémenté faute de flux, documenté, jamais inventé)

---

## 1. Audit (existant vs manquant)

### 1.1 Ce qui existait déjà (vérifié dans le code au 59e30946)

| Domaine | Existant vérifié |
|---|---|
| Liaison kit ↔ voyage | `trips.kit_id → materiel_kits` (`20260909120000_trips_kit_id.sql`), sessions `hike_sessions.kit_id` |
| Kit matériel | `materiel_kits` (nom, description, poids cible, `is_public`, `is_trashed`) + `materiel_kit_items` (name, category, `weight_g`, quantity, `product_ownership_id`) ; RLS propriétaire |
| Sac du voyage | `trip_items` : quantity, `weight_grams`, `is_packed`, `status` (enum `packed/needed/optional/missing`), `packed_by`, `priority`, `is_vital/is_worn/is_consumable`, `source`, `purchase_state`, `inventory_item_id`, `day_number` ; RLS `can_edit_trip` |
| Création (Phase 3) | `createTripFromAutogenIntent` crée voyage → plan → parcours navigable → kit + `trip_items` + `trip_expenses` (planned) + checklist + documents attendus (best-effort, avertissements) ; `trips.kit_id` et `estimated_budget` posés |
| Recommandations | `contextualKitEngine` (règles + `reason`, gap analysis, pondérations D3/D4/D7) — **mais uniquement à l'affichage** (`getTripKitDetails`), jamais persistées à la création |
| Budget | `budgetEngine` prévu (`is_planned`) vs réel, plan journalier, provenance ; UI `TripBudgetView` prévu/réel |
| Sécurité | `SafetyEngine` temps réel (immobilité/batterie/hors-trace/météo/nuit), `safetyRedLines` (5 lignes rouges), `trip_safety_checkpoints` ; seeds conformité IA dans la checklist |
| Documents | `trip_documents.file_url NOT NULL` → « documents attendus » via `trip_checklist_items` ; buckets Storage : `user-documents` **privé** (policy dossier = `auth.uid()`), `carnet-media`/`gear-photos` publics |
| Consentement/collectif | `has_active_consent` (service_role), pipeline collectif **par segment** (`segment_collective_aggregates`, `aggregateSegments`, `processHikeSession`) ; `country_practical_guides` (sourcés) |

### 1.2 Manques réels (traités ou actés)

1. Kit créé sans **propriété** (perso/partagé), **état**, **propriétaire** ni **raison** par item ; poids `0`/`null` même quand l'objet est possédé.
2. Recommandations **non contextualisées par le parcours réel** (distance/D+/difficulté) et non persistées avec leur raison.
3. Aucun état **manquant** fiable (pas de rapprochement avec l'inventaire possédé).
4. Documents par pays/activité limités (identité/visa/billets avion/hébergement).
5. Pas de contrôles sécurité **pré-trip pays/activité** (au-delà de la couche IA conformité).
6. `MediaUpload` (composant non monté) générait une **URL publique pour le bucket privé** `user-documents` → inutilisable.
7. **Agrégats anonymisés de kit** : inexistants (pas de table/RPC/finalité de consentement kit) et **non consommés** par `generateAdventure` (le collectif est segment-level, batch).
8. Météo à la création : aucun champ météo dans les couches AutoGen → non exploitable au moment du choix du plan (disponible plus tard dans le cockpit départ).

## 2. Ce qui a changé

- **Migration additive** `20260911540000_phase5_kit_completeness.sql` : `trip_items.ownership/owner_id/condition/reason` ; `materiel_kit_items.ownership/owner_id/condition/reason/priority/is_vital` ; défauts `personal`/`recommended`/`false` ; contraintes de domaine ; index ; commentaires. RLS inchangée. Idempotente (`{"applied":[]}` au rejeu).
- **Moteur pur** `kitCompletenessEngine.ts` : recommandations déterministes avec **raison vérifiable** (règle citée ou donnée réelle), personnel/partagé, poids `null` sauf source réelle, classification personnel/partagé/manquant + poids connus, rapprochement inventaire conservateur (anti-faux-positif).
- **Moteur pur** `preTripSafetyRules.ts` : contrôles sécurité pays/activité/durée/groupe/parcours, libellés citant la donnée déclenchante — persistés dans la **checklist existante** (pas de nouvel écran).
- **`autogenPreparation.ts`** : recommandations contextuelles fusionnées sans doublon (`flattenPreparationKitItems`), documents enrichis (assurance, fiche contacts d'urgence, permis locaux, billets tout mode), contrôles sécurité, provenance/raison budget.
- **`createTripFromAutogenIntent.ts`** : contexte réel passé aux règles (activité, pays, durée, saison, distance/D+/difficulté du parcours sélectionné) ; lecture bornée de `product_ownership` ; `trip_items` = `missing` si non possédé, relié à l'inventaire + poids/état réels sinon ; `materiel_kit_items` complets ; métadonnées de traçabilité (`kit_owned_items_count`, `kit_recommendations_count`, `safety_controls_count`) ; budget planned avec `reason`/règle.
- **UI** `TripKitView` : chips Personnel/Partagé/Manquant/Poids connu, badges partagé/manquant, raison affichée, case emballé, **modale d'édition complète** (quantité, poids, type, état, propriétaire, priorité) + action serveur `updateTripItemDetailsAction` (propriétaire limité à soi/collaborateur réel) ; `queries-trip-kit` étendu.
- **Documents/Storage** : `mediaUploadPath.ts` (bucket privé ⇒ chemin `<userId>/…` + **URL signée 3600 s**, buckets publics inchangés), `MediaUpload` corrigé.
- **Tests** : 4 fichiers vitest (16 tests) + pgTAP phase5 (24 assertions).

## 3. Preuves brutes (commandes exactes)

| Commande | Résultat brut |
|---|---|
| `npx supabase migration up --local` | applique `20260911520000`, `…530000`, `20260911540000` ; rejeu = `{"applied":[]}` |
| `npx supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` | **Files=18, Tests=340, PASS** (baseline Phase 7 : 17/316 ; +24 assertions Phase 5) |
| `npx vitest run tests/trips/phase5-kit-completeness.spec.ts tests/trips/pre-trip-safety.spec.ts tests/trips/phase5-kit-chain.spec.ts tests/components/mediaUploadPath.spec.ts` | **4 fichiers, 16 tests, PASS** |
| `npm run test` | **292 fichiers passed / 4 skipped ; 2084 tests passed / 27 skipped ; 0 failed** (baseline Phase 7 : 288/2068/27) |
| `npm run type-check` (`tsc --noEmit`) | **exit 0**, aucune sortie |
| `npm run lint` (`next lint`) | **exit 0 — 0 erreur** (warnings préexistants ; 1 warning préexistant dans TripKitView : `<img>` ligne 990) |
| `npx vitest run tests/design/x-d70.spec.ts` | **63/63 PASS** (garde-fou design 9 surfaces Voyage) |

**Nouveaux tests couvrant les livrables :**
- Kit cohérent + raisons vérifiables + zéro valeur inventée : `TEST-PHASE5-KIT-01..06`.
- Sécurité pays/activité : `TEST-PHASE5-SAFE-01..04`.
- Chaîne serveur (possédé/manquant, raisons, budget tracé, contrôle sécurité) : `TEST-PHASE5-CHAIN-01..03`.
- Bucket privé/URL signée : `TEST-PHASE5-DOC-01..03`.
- Contraintes BDD : `phase5_kit_completeness.test.sql` (24 assertions).

## 4. Gate Phase 5 (doc §Phase 5)

- [x] Kit construit depuis le voyage/plan/route **réellement retenus** (activité, durée, groupe, distance, D+, difficulté du parcours sélectionné).
- [x] Équipement **personnel / partagé / manquant** distingué et persisté (`ownership`, `status='missing'`).
- [x] Chaque recommandation porte une **raison vérifiable** (colonne `reason`, cite la règle ou la donnée réelle) — aucun `D+`/`km` affirmé sans parcours réel (test dédié).
- [x] Poids (réel inventaire sinon `null`), quantité, propriétaire, état présents et **entièrement modifiables** (UI + action + RLS).
- [x] Documents attendus pays/activité dans la **checklist existante** (identité, billets, réservations, assurance, contacts, permis locaux) ; `trip_documents.file_url NOT NULL` respecté (aucune ligne sans fichier).
- [x] Bucket privé `user-documents` : chemin propriétaire + URL signée **1 h** si le flux d'upload est branché (corrige le bug d'URL publique) ; aucun flux d'upload n'existe aujourd'hui pour `trip_documents`.
- [x] Budget prévisionnel vs réel via l'engine existant (planned exempté des totaux réels) + provenance/règle/raison tracées.
- [x] Contrôles sécurité pays/activité branchés sur la checklist (aucun écran parallèle) ; `SafetyEngine` temps réel inchangé.
- [~] Agrégats anonymisés des anciens voyageurs : **INSUFFICIENT_DATA** — pipeline collectif existant = segments uniquement, non consommé par la génération de voyage/kit ; aucune table/RPC/finalité kit. Non inventé (cf. §6).
- [x] Aucune exposition d'un kit sans consentement : rien de nouveau n'expose de kit ; le collectif existant reste derrière `has_active_consent` (service_role).
- [x] Kit prêt immédiatement après sélection du plan, sans écran parallèle, et modifiable ensuite.

## 5. Captures / artefacts

- Aucune capture nouvelle (pas d'E2E visuel exécuté dans cette phase).
- **Baselines visuelles probablement impactées (NON régénérées)** : `/hub/kit-voyage` rend `TripKitView` pour une sortie ⇒
  `tests/visual/voyages-y-profiles-visual.spec.ts-snapshots/y-long-group-kit-{desktop-chrome,ipad-portrait,iphone-14-pro}-{linux,win32}.png` (**6 fichiers**).
  Aucune autre route capturée ne rend `TripKitView` (`/hub` home, `/materiel`, `/voyages`, `/communaute`, `/carte-interactive` inchangés).

## 6. Limites (honnêtes)

1. **Agrégats anonymisés kit non livrés** : le collectif vérifié (`segment_collective_aggregates`) est par segment, alimenté en batch (`aggregateSegments`/`processHikeSession`) et **non lu** par `generateAdventure`/le kit. Créer un agrégat kit exigerait table + RPC + finalité de consentement + job d'agrégation : hors preuve disponible, documenté au lieu d'être simulé.
2. **Météo absente à la création** : les couches AutoGen n'en fournissent pas ; les règles se limitent aux données réellement présentes (le cockpit départ garde la météo existante).
3. **Distant = INSUFFICIENT_DATA** : migrations/pgTAP non poussés sur un projet de test (Phase 1 non provisionnée) ; sans migration, les inserts enrichis échouent en best-effort (avertissements) et le kit reste celui de Phase 3.
4. **Pas de flux d'upload `trip_documents`** : la correction `user-documents` prépare le terrain mais n'ajoute pas d'écran d'upload (aucun n'existe).
5. Le rapprochement inventaire est volontairement conservateur : un objet possédé au libellé très différent reste `missing` (aucun faux « possédé »).
6. E2E Playwright non exécuté sur cette phase (stack E2E non relancée) ; couverture locale = vitest + pgTAP.

## 7. Risques résiduels

- Qualité des libellés d'inventaire : un rapprochement manqué crée un faux « manquant » (sans gravité : l'utilisateur peut éditer).
- Les colonnes additives non appliquées en distant rendent la persistance enrichie best-effort (warnings explicites, jamais de crash).
- La modale d'édition est couverte par le garde-fou design + tests composants, pas par un test navigateur.

## 8. Décision

**PASS (périmètre local)** — gate « kit prêt immédiatement après sélection du plan et entièrement modifiable » vérifié en local.
**INSUFFICIENT_DATA** pour le sous-item agrégats anonymisés kit et pour le distant (documenté, non revendiqué).
