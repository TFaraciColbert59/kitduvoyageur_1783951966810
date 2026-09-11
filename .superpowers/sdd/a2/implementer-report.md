# A2 — Traitement GPS, segmentation et map-matching — Rapport implémenteur (Tasks 1→5)

- Worktree : `C:/Users/Tony/Downloads/LKDV/worktrees/adventure-intelligence`
- Branche : `chantier/adventure-intelligence`
- Date : 2026-09-11
- Plan : `docs/superpowers/plans/a2-gps-segmentation-map-matching.md` (Tasks 1→5 ; Task 6 vérification controller)
- Spec : `docs/superpowers/specs/2026-09-11-a2-gps-segmentation-map-matching-design.md`
- Aucune écriture dans `segment_collective_aggregates` (vérifié par recherche : 0 occurrence dans les nouveaux fichiers). Tâche 6 non traitée.

## Commits (exacts, un par tâche)

| Task | SHA | Sujet |
|---|---|---|
| 1 | `b0d66613` | `feat(a2): normalisation de trace GPS et score qualite (moteurs purs)` |
| 2 | `173e9ae9` | `feat(a2): map-matching progressif et extraction de passages` |
| 3 | `9adc8b66` | `feat(a2): caracteristiques derivees de segment (pente, D+/D-, classe technique)` |
| 4 | `e691f998` | `feat(db): a2 candidats segments et claim de sessions a traiter` |
| 5 | `dde5b9d3` | `feat(a2): orchestrateur de traitement de session + cron protege` |
| Fix revue | `f3fb79d7` | `fix(a2): liaison observations-passages via ids persistes` |

---

## Task 1 — Géométrie et normalisation de trace

**Fichiers**
- Créés : `src/features/adventure-intelligence/domain/geo.ts`, `src/features/adventure-intelligence/domain/trackNormalization.ts`
- Test : `tests/adventure-intelligence/track-normalization.spec.ts`

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/track-normalization.spec.ts` → `Cannot find package '@/features/adventure-intelligence/domain/geo'` (0 test).
- GREEN : 12 tests passés (`TEST-A2-GEO-01..04`, `TEST-A2-NORM-01..08`).
- `npm run type-check` → exit 0.

**Décisions**
- `NORMALIZATION_DEFAULTS` aux valeurs exactes du plan ; `TrackQuality` importé du type A1 existant `schemas/performance.schema.ts` (pas de duplication ; le plan le citait par erreur dans `terrain.schema.ts`).
- Ordre pipeline : validation coordonnées/horodatage → précision > 50 m → tri temporel → doublons d'horodatage (meilleure précision conservée, précision absente = pire) → téléportation (vitesse > 8,34 m/s OU saut > 500 m par rapport au dernier point conservé) → lissage altitude fenêtre 5 (moyenne glissante centrée des valeurs définies, un trou entouré de valeurs est donc comblé ; fenêtre sans valeur → `undefined`) → pauses (segments consécutifs à vitesse < 0,3 m/s dont la durée totale ≥ 60 s ; indices/nés ISO exposés) → métriques → qualité.
- D+/D- par hystérésis 3 m avec déplacement de référence ; pauses exclues de `movingDurationS` (borné ≥ 0).
- Qualité (formules non imposées par la spec, documentées dans le code) : `gpsAccuracy = 1 − moyenne(précision)/50` (précision absente = 25) ; `temporalContinuity = conservés/bruts` ; `altitudeReliability = part de points avec altitude` ; `plausibleMovement = 1 − téléportations/valides` ; `overall = 0.35/0.25/0.2/0.2` ; `reasons` non vide dès qu'une composante < 0.5 (et trace vide).

**Concerns**
- Les pondérations composantes de `gpsAccuracy`/`plausibleMovement` ne sont pas fixées par la spec : choix documentés, à confirmer en Task 6/revue.
- Le lissage peut combler une altitude manquante (moyenne des voisins) — comportement explicite et testé.

---

## Task 2 — Map-matching progressif et passages

**Fichiers**
- Créé : `src/features/adventure-intelligence/domain/mapMatching.ts`
- Test : `tests/adventure-intelligence/map-matching.spec.ts`

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/map-matching.spec.ts` → module introuvable (0 test).
- GREEN : 8 tests passés (`TEST-A2-MATCH-01..08`).
- `npm run type-check` → exit 0.

**Décisions**
- Score exact `0.5*proximité + 0.3*direction + 0.2*continuité − pénalité` ; proximité `max(0, 1 − d/35)` ; direction `1 − min(delta/180, 1)`, repli 0,5 sans cap ; continuité `0.25` même segment, `0.125` candidat différent à ≤ 25 m.
- Cap : delta brut > 90° ⇒ sens `reverse` et delta résolu = 180 − delta ; delta résolu > `maxBearingDeltaDeg` (60°) ⇒ candidat écarté (c'est le rôle normatif de la constante). Acceptation : `distance ≤ 35` ET `score ≥ 0.5`.
- `jumpPenalty` (0,4) appliqué quand le point bondit de plus de `JUMP_DISTANCE_M` (500 m, aligné sur `maxJumpM` de la normalisation) **et** change de segment ; un gros saut sur le même segment reste plausible. Les téléportations étant retirées en amont, le saut observable est la distance entre points conservés (limite documentée dans le code).
- `buildPassages` : groupes consécutifs même `(segmentId, direction)` de longueur ≥ 2 ; `gainM/lossM` avec l'hystérésis 3 m partagée ; arrêts = intersection des pauses avec l'intervalle du passage ; `mapMatchQuality` = ratio global points appariés / points conservés (appliqué à chaque passage, utilisé pour le seuil collectif) ; `offRoute` (≥ 2 non appariés entre deux passages du même segment) et `uturnDetected` (sens opposé même segment à ≤ 600 s) marquent les deux passages concernés.

**Concerns**
- « pénalité si le point est rejeté (téléportation) » : non observable dans un moteur recevant des points déjà normalisés ; interprété par le saut > 500 m vers un autre segment (documenté).
- `mapMatchQuality` global (et non par fenêtre) pour que le seuil 0,6 de la Phase 4 ait un sens ; conforme à la formule de la spec.

---

## Task 3 — Caractéristiques de segment

**Fichiers**
- Créé : `src/features/adventure-intelligence/domain/segmentFeatures.ts`
- Test : `tests/adventure-intelligence/segment-features.spec.ts`

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/segment-features.spec.ts` → module introuvable (0 test).
- GREEN : 6 tests passés (`TEST-A2-FEAT-01..06`) après correction d'une fixture de test (fenêtre 20 m : un pas de 0,0001° ne vaut que ~11,1 m ; fixture passée à 0,0002°).
- `npm run type-check` → exit 0.

**Décisions**
- `lengthM` haversine ; `gainM/lossM` = somme des deltas positifs/négatifs (altitudes absentes ignorées) ; `meanGradePct = (gain − loss)/length × 100` (0 si length 0) ; `maxGradePct` = valeur absolue max sur fenêtres glissantes d'au moins 20 m (une variation portant sur < 20 m ne crée pas de pente) ; `altitudeMin/Max` sur altitudes définies sinon `null` ; `surface` recopiée ; `technicalClass` : `sac_scale` prioritaire (hiking 1 → demanding_alpine_hiking 5), sinon `highway` (footway 0, path/track/bridleway 1, steps 2), sinon 1, puis +1 si surface rock/scree (plafonné 5) ; `exposureClass`/`isolationClass` restent `null` (aucune source, assumé) ; `source = 'computed'`.

**Concerns**
- Aucune : `maxGradePct` en valeur absolue (montée ou descente) — choix à valider par la revue.

---

## Task 4 — Migration RPC candidats + claim

**Fichiers**
- Créés : `supabase/migrations/20260911140000_a2_segment_candidates.sql`, `supabase/tests/database/a2_segment_processing.test.sql`

**TDD / vérification**
- Pas de TDD possible (SQL) : migration écrite puis suite pgTAP sur le pattern A1.
- Contrôles statiques : `plan(14)` = 14 appels d'assertion ; dollar-quotes équilibrés (4 paires dans le test, 4 paires dans la migration) ; 2 `CREATE OR REPLACE FUNCTION` ; `REVOKE`/`GRANT` explicites.
- Note : `npx vitest run tests/adventure-intelligence` + `npm run type-check` exécutés avant commit (verts).
- Exécution pgTAP impossible : `npx supabase status` → Docker non démarré (« failed to connect to the docker API »), même contrainte que la Task 6 A1 (ruling a0).

**Décisions**
- `a2_segment_candidates(lat, lng, radius DEFAULT 50)` : `LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp`, `ST_DWithin(geom::geography, point::geography, greatest(radius, 0.1))`, azimut `degrees(ST_Azimuth(ST_StartPoint, ST_EndPoint))`, `ORDER BY distance_m LIMIT 5`. `REVOKE public/anon` + `GRANT EXECUTE authenticated, service_role` (le plan ne liste pas anon).
- `a2_claim_pending_sessions(limit DEFAULT 5)` : `SECURITY DEFINER SET search_path = public, pg_temp`, UPDATE `processing_status='processing'` (et `updated_at`) via sous-requête `ORDER BY started_at LIMIT greatest(limit,1) FOR UPDATE SKIP LOCKED` ; REVOKE public/anon/authenticated (DO guardé) ; GRANT service_role.
- pgTAP : 14 assertions couvrant refus authenticated puis anon, claim(2) exact, statuts, session processed non réclamée, non double-claim, candidats ordonnés/proches, azimut ≈ 90°, exclusion hors rayon, segment lointain jamais retourné.

**Concerns**
- Suite pgTAP non exécutée localement (pas de Docker/base) : à exécuter sur la copie (Task 6).
- Hypothèse A1 conservée : grants SELECT par défaut sur `trail_segments` pour authenticated (la fonction est SECURITY INVOKER) ; si la copie n'a pas ces grants, `permission denied for table trail_segments` au lieu des résultats attendus.

---

## Task 5 — Orchestrateur serveur + route cron

**Fichiers**
- Créés : `src/features/adventure-intelligence/server/processHikeSession.ts`, `src/app/api/cron/process-hike-sessions/route.ts`
- Test : `tests/adventure-intelligence/process-hike-session.spec.ts`

**TDD**
- RED : `npx vitest run tests/adventure-intelligence/process-hike-session.spec.ts` → module introuvable (0 test).
- GREEN : 6 tests passés (`TEST-A2-PROC-01..06`), client factice sans mock Supabase.
- Suite complète avant commit : `npx vitest run tests/adventure-intelligence` → 9 fichiers, 78 tests passés ; `npm run type-check` → exit 0.

**Décisions**
- `PROCESSOR_VERSION = 'a2-v1'` ; `ELIGIBILITY_MIN_QUALITY = 0.6`.
- Validation Zod 4 en union : `{ type:'LineString', coordinates: number[][] (≥ 2 points de ≥ 2 nombres) }` (format réel écrit par `/api/hike-sessions`) OU tableau de `TrackPoint`. Payload invalide/null → `failed` (`invalid_payload`) ; trace < 2 points après normalisation → `failed` (`insufficient_points`).
- GeoJSON sans horodatage : horodatages synthétisés à 10 s d'intervalle (aligné sur la simplification de l'API) en terminant sur `ended_at` — comportement documenté dans le code.
- Candidats pré-chargés séquentiellement pour les coordonnées uniques arrondies à 4 décimales (~11 m) puis injectés au moteur via cache (test PROC-03 : 5 points → 1 appel, rayon 35 m).
- `upsertPassages` (conflit géré par la clé d'idempotence `session_id,segment_id,direction,entered_at,processor_version`) retourne désormais les `id` persistés (`{ id, segment_id }[]`) ; le client Supabase fait `.upsert(rows, { onConflict }).select('id, segment_id')`. Les observations sont ensuite liées par `passage_id` via une file par `segment_id` (les passages aller/retour d'un même segment reçoivent des ids distincts en ordre). 1 observation par passage (métriques, `processor_version`, déclaratifs `null`).
- `eligible_for_collective = gps_quality ≥ 0.6 && map_match_quality ≥ 0.6` ; `markSession(processed)` avec `track_quality` complet. Toute erreur client → `failed` + `markSession(failed)`, sans interrompre le lot.
- Route : `POST`, Bearer `CRON_SECRET`, `dynamic='force-dynamic'`, claim RPC service (`p_limit 5`), traitement séquentiel, réponse `{ processed, skipped, failed }` ; non couverte par vitest conformément au plan.

**Concerns**
- Un duplicate-skip côté base (aucune ligne retournée par l'upsert) laisse `passage_id = null` pour le passage concerné ; le contrat remappe par `segment_id` et les autres passages gardent leur liaison. Cas couvert par le test (repli `null`).
- Route non testée unitairement (décision du plan) : à couvrir en Task 6 (lint/invariants) et en intégration.

---

## Vérifications globales avant clôture des Tasks 1→5

- `npx vitest run tests/adventure-intelligence` → **9 fichiers, 78 tests passés** (dont 32 nouveaux A2 : 12 NORM/GEO, 8 MATCH, 6 FEAT, 6 PROC).
- `npm run type-check` → exit 0.
- `npm run lint` → exit 0 (seuls des warnings préexistants hors périmètre ; aucune alerte sur les fichiers A2).
- Pureté moteurs : aucune occurrence `supabase|fetch|axios` dans `domain/*` (seule la route serveur appelle `getServiceSupabase`).
- Aucune occurrence `segment_collective_aggregates` dans le code A2 (vérifié par `rg`, exit 1).
- `npm run build` jamais exécuté (interdit : régénère les artefacts d'icônes suivis).

## Reste à faire (Task 6, controller)

1. `npm run test`, `npm run lint`, `npm run verify:invariants` complets.
2. Exécution pgTAP `supabase test db` (base requise).
3. `docs/reports/A2_VERIFICATION.md`, commit `docs(a2): rapport de verification phase 2`, tag `a2-done`.

## Correctif revue — liaison observations ↔ passages

- Commit : `f3fb79d7` `fix(a2): liaison observations-passages via ids persistes`
- Fichiers : `src/features/adventure-intelligence/server/processHikeSession.ts`,
  `src/app/api/cron/process-hike-sessions/route.ts`,
  `tests/adventure-intelligence/process-hike-session.spec.ts`.
- Contrat : `upsertPassages(rows): Promise<{ id: string; segment_id: number }[]>`.
- Client Supabase : `.upsert(rows, { onConflict: 'session_id,segment_id,direction,entered_at,processor_version' }).select('id, segment_id')`
  (upsert = ON CONFLICT DO UPDATE : idempotent et retourne les lignes persistées ;
  `ignoreDuplicates` retiré car il ne retourne rien en cas de conflit).
- Orchestrateur : après upsert, file `segment_id → ids[]` ; chaque passage consomme
  son id ; repli `null` uniquement si le segment est absent de la réponse.
  Les allers/retours sur le même segment reçoivent des ids distincts.
- Tests : PROC-03 asserte `passage_id = 'passage-1'` pour un passage, deux ids
  distincts pour un aller/retour sur le même segment, et le repli `null` en cas
  de duplicate-skip (aucune ligne retournée).
- Vérifications : `npx vitest run tests/adventure-intelligence` → 9 fichiers,
  78 tests passés ; `npm run type-check` → exit 0.
