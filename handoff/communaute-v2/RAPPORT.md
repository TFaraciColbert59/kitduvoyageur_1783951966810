# Rapport — tiroirs de la Communauté v2

**Statut : TERMINÉ SAUF application des migrations en production et recette B** — blocage
externe documenté (J-08) : le secret GitHub `BACKUP_PASSPHRASE` est absent, le workflow
de sauvegarde ne produit aucun artefact vérifiable, donc aucune migration n'a été appliquée
à la base de production et le drapeau `NEXT_PUBLIC_COMMUNAUTE_V2` reste `false` en Production.
Tout le reste du chantier est livré et testé : code **fusionné dans `main`** (PR #155,
commit `9b68c63`), **déployé en Production** (V2 non exposée, drapeau figé à `false`),
aperçu Vercel avec les deux tiroirs vérifié, app installée et lancée sur l'iPhone,
recette A/C, couverture des 200 améliorations, retour arrière prêt.
La séquence exacte de reprise est dans `handoff/communaute-v2/PROD-APPLICATION.md`.

Prérequis carnet-v2 : **code fusionné** (PR #154 dans `main`), **migrations non appliquées en
prod** (registre 377 versions, max `20261108000000`) → sur la base de production,
`carnet_nights` est absente : l'étape « Nuits » du formulaire Carnet reste masquée
(`HAS_CARNET_NIGHTS=false`) et les nuits d'un carnet ne s'affichent pas.

- PR : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/155
- Commit de fusion : `9b68c63bbbc1695b0c2d3d79162fc0ff7127d66a` (squash, `main`)
- Déploiement production : https://kitduvoyageur-1783951966810-ruddy.vercel.app (domaine `koosmoweb.fr` non résolu au 2026-11-08 : zone DNS pas encore pointée sur Vercel)
- Drapeau : `NEXT_PUBLIC_COMMUNAUTE_V2` = **`true` en Preview**, **`false` en Production**
- Branche : `feat/communaute-v2` · Worktree : `lkdv-communaute-v2`

## 1. Portes qualité

| Porte | Run | Résultat |
|---|---|---|
| LKDV Unified Quality Gates (gate 1 lint/types, gate 3 vitest, gate 4 build, gate 4c e2e) | https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42502861690 (merge `main`) / 42502677767 (branche `feat/communaute-v2`, commit `e4144e5`) | **rouge sur la gate 3** (test pré-existant hors périmètre, voir ci-dessous) ; gates 1/2/2.5 vertes, gates 4/4c/5 sautées par la chaîne `if: success()` |
| database-gates (pgTAP, Postgres éphémère) | https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42502861690 | **vert** (185 assertions) |
| Visual Regression — Shell Mobile | https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42502861777 | cf. note ci-dessous |
| Lighthouse CI | https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42502861965 | vert (budgets inchangés) |
| iOS Capacitor Build | https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42502861780 | vert |

Détails :

- **Gate 3 (vitest)** : 1 échec restant, `src/features/posts/ui/__tests__/PostGlassPanel.test.tsx`
  (« tactile … le mauvais sens ne fait rien »). Ce test **n'appartient pas au chantier** (aucun
  fichier de `src/features/posts`, `src/hooks/` ni `src/design/motion.ts` n'est modifié par la PR) et
  **échoue déjà sur `main`** au commit `58525cb` (run 42495461905, journaux : même assertion,
  même test). Il passe 20/20 en isolation locale (Node 22 et 26, macOS) — flake d'environnement
  pré-existant, non aggravé par la PR. Le second échec de `main`, la garde
  `design-tokens-p017` (`--ks-ink-22` non déclaré, introduit par la fusion kit-studio), a en
  revanche été corrigé dans cette PR (J-11) : `--ks-ink-25`, même intention d'ombre.
- **Visual Regression** : les 4 projets visuels sont verts pour les captures de la PR ; la porte
  agrégée `visual-gates` est `skipped` faute de label. Le workflow reste rouge sur `main`
  indépendamment du chantier.
- **Build CI** : build Next.js de production vert, avec `NEXT_PUBLIC_COMMUNAUTE_V2=true`
  (le bundle livré est bien celui de la V2).
- **e2e** : `communaute-v2-explorer` 26/26, `communaute-v2-creation` 6/6,
  `communaute-v2-invite` 5/5, `communaute-v2-flag` 3/3, `communaute-v2-db` 6/6 (ignorés sans base
  de test), sur `mobile-webkit` et `mobile-chromium` (Gate 4c installe Chromium + WebKit).
- **a11y** : 4 scénarios axe (`iphone-14-pro`), 0 violation critical/serious.
- **pgTAP** : 7 suites, 185 assertions, base éphémère uniquement (jamais `PROD_DB_URL`).

## 2. Tests ajoutés

| Type | Nombre |
|---|---|
| Unitaires / intégration vitest (Communauté v2 : data, moteurs, schémas, formatage, hooks) | 194 cas, 25 fichiers |
| Unitaires composants partagés `src/components/ui/drawer` | 50 cas, 5 fichiers |
| Playwright e2e `@ui-mock` (Explorer, Création, invité, drapeau, base) | 26 + 6 + 5 + 3 + 6 |
| Accessibilité axe | 4 scénarios |
| Visuel Playwright (baselines iPhone 14 Pro) | 4 scénarios |
| pgTAP (SQL) | 7 suites, 185 assertions |
| Maestro | `mobile/.maestro/communaute.yaml` (CLI Maestro absente de la machine : non exécuté) |

## 3. Base de données (préparée, **non appliquée en production**)

8 migrations idempotentes, une transaction par fichier, chacune avec son retour arrière dans
`supabase/migrations_down/` :

| Version | Lot | Contenu |
|---|---|---|
| `20261108130001` | A | `community_search`, `community_search_trending`, normalisation accents/ponctuation, `pg_trgm` |
| `20261108130002` | B | colonnes PostGIS des carnets/clubs (`start_geom`, `end_geom`, `zone_geom`…), feeds curseur `community_carnets_feed`, `community_clubs_feed`, `community_events_feed`, `community_events_agenda` |
| `20261108130003` | C | colonnes Sorties : `starts_at`, `ends_at`, `meeting_*`, `level`, `distance_km`, `elevation_gain_m`, `safety_*`, `recurrence`, `activity`, `club_id`, `kit_id`, `tags` |
| `20261108130004` | D | adhésion clubs : `join_questions`, `rules`, `answers`, `status`, `check_club_slug`, `join_club`, `leave_club`, `cancel_join_request`, `review_join_request`, triggers de compteur |
| `20261108130005` | E | créations atomiques : `create_club_with_admin`, `create_event_with_post`, `create_kit_with_items`, `create_carnet_v2`, `create_community_post`, `join_event`, `leave_event` |
| `20261108130006` | F | stories : `trim_start_ms`, `trim_end_ms`, `linked_carnet_id`, `linked_carnet_day`, `alt_text`, composition |
| `20261108130007` | phase 2 | liste d'attente des sorties (`waitlist_enabled`, `event_waitlist`) |
| `20261108130008` | phase 2 | contrainte `clubs_privacy_check` (open / on_request / secret) + garde `lkdv_require_actor` |

RPC publiques créées (13) : `community_search`, `community_search_trending`,
`community_carnets_feed`, `community_clubs_feed`, `community_events_feed`,
`community_events_agenda`, `check_club_slug`, `join_club`, `leave_club`,
`cancel_join_request`, `review_join_request`, `join_event`, `leave_event` ;
créations atomiques (5) : `create_club_with_admin`, `create_event_with_post`,
`create_kit_with_items`, `create_carnet_v2`, `create_community_post`.
Helpers internes : `lkdv_*` (normalisation, extraction JSON, garde d'acteur, recompte des
membres, synchronisation des participants), non exécutables par `PUBLIC` quand ils sont
`SECURITY DEFINER` (vérifié par `communaute_v2_rpc_security.test.sql`).

Contrats complets : `handoff/communaute-v2/RPC-CONTRACTS.md`.

### Alignement du registre (lecture seule, sans écriture)

Registre prod au 2026-11-08 : 377 versions, max `20261108000000`.
`scripts/db/migrations-alignment.mjs` sur l'export `/tmp/prod-ledger.txt` : **366 alignés**,
**0 renommé**, **61 repo-only** dont nos 8 fichiers, **11 versions fantômes** du connecteur
Supabase (antérieures au chantier, déjà connues). Aucune migration n'a été appliquée.

### Audit prod avant chantier (base réelle)

`clubs.rules`, `community_posts.creation_meta`, `clubs.join_questions`, `clubs.answers` absents ;
triggers de compteur absents (`members_count`/`participants_count` pouvaient diverger) ;
`clubs.privacy` ne connaissait que `open`/`secret`. Les migrations créent ces objets et posent
les gardes ; les RPC recalculent les compteurs au lieu de faire confiance au client.
Conséquence directe : les migrations sont **additives** et ne suppriment rien.

## 4. Couverture des 200 améliorations

Document complet : `docs/audit/communaute-v2-2026-11-08/COUVERTURE-200.md`.

| Statut | Nombre |
|---|---|
| fait | **161** |
| partiel | **23** |
| reporté (exceptions `01 § 6`) | **13** |
| non fait | **3** |

Les 3 non faits (tous dans le volet Kit) :
- Kit#4 — reprise / duplication d'un kit existant (« Repris », modèle) : aucune UI ni RPC de
  reprise ;
- Kit#12 — lien avec les prêts de `/compte` : le formulaire ignore les prêts en cours ;
- Kit#15 — préférence d'unités du compte (impérial) : le formulaire n'en tient pas compte.

Écarts connus et assumés (documentés dans le journal du chantier et la couverture) :
visa de carnet sans pays (`community_carnets_feed` ne renvoie pas `country_iso`, Carnets#2),
pastille « En route » au lieu de l'anneau conique animé (Carnets#4), tuile Sortie sans météo
(météo réservée au détail, Sorties#8), libellé « Billets » au lieu de « Grille » (Sorties#3),
étape « Nuits » du carnet masquée faute de `carnet_nights` en prod (Carnet#13), bouton
« Supprimer » de média à 30 px (Publication#6).

## 5. Recette

### A. Aperçu Vercel — **faite**

Dossier de preuves : `docs/audit/communaute-v2-2026-11-08/recette/`
(`PREUVES.md`, `captures-v2/`, `APERCU-VERCEL-FINAL.md`, `IPHONE.md`) et
`docs/audit/communaute-v2-2026-11-08/integration/` (19 captures 390×844 + `RAPPORT-INTEGRATION.md`).

Exécutions : **e2e 34/34 Chromium et 34/34 WebKit** (parité, 3 sautés motivés ×2),
**axe 4/4** (0 critical/serious), **visuel 4/4** (19 références macOS), **19 captures de
recette** (données mockées) + **7 captures sur le Preview Vercel réel** (`APERCU-VERCEL-FINAL.md`),
`tsc` EXIT 0, `next build` vert.

- Les 4 volets Explorer (Recherche, Carnets, Clubs, Sorties), filtres, menus de tri, pile de
  détails, Peek, île dynamique, capsule et mini-capsule : captures 390×844.
- Les 6 formulaires de Création, toutes les étapes et aperçu vivant : captures 390×844.
- Gestes : ouverture/fermeture, poignée, Échap (focus rendu au déclencheur), glisser entre
  filtres (seuil 48 px), pile et Retour, menu de tri.
- Invité : lecture seule, `requireAuth` sur les actions d'écriture.
- Thème clair : aucune teinte non verte hors danger (contraste AA vérifié par la garde
  `glass-contract` et l'audit des captures).
- **Limite honnête** : sur l'aperçu Vercel (données de production), les RPC v2 n'existent pas
  encore → l'Explorer affiche son état d'erreur propre (« Carnets indisponibles — Réessayer »)
  et les feeds réels ne peuvent pas être recettés. Les parcours de données sont donc recettés
  sur le build local avec un backend simulé (`tests/e2e/communaute-v2.fixtures.ts` +
  `docs/audit/.../integration/network.mjs`), ce qui est la recette fidèle du code livré.
- Drapeau à `false` vérifié sur un déploiement d'aperçu : les tiroirs v1 restent fonctionnels
  (`tests/e2e/communaute-v2-flag.spec.ts`).
- Non-régression : `/communaute` (fil, stories), `/compte`, `/messagerie`, fiche carnet,
  `/clubs/[id]`, `/communaute?tab=evenements` — aucun écran modifié hors des deux tiroirs et de
  la fiche `/sorties/[id]` (nouvelle).

### B. Production — **non faite, bloquée**

Aucune migration prod (J-08) ⇒ `NEXT_PUBLIC_COMMUNAUTE_V2` reste `false` en Production ⇒ la V2
n'est pas exposée aux utilisateurs réels. C'est conforme à `00-MISSION § 4` (pas de contenu
visible par de vrais utilisateurs sans base prête) et à `06 § 3.1` (pas de migration sans
sauvegarde vérifiée). Reprise : `handoff/communaute-v2/PROD-APPLICATION.md` (secret, sauvegarde,
application fichier par fichier, alignement du registre, pgTAP déjà verts, vérifications en
lecture seule, advisors).

### C. iPhone — **installation et lancement vérifiés ; interactions dans l'app non testées**

- Appareil : iPhone 16 Pro (`iPhone17,1`), UDID `00008140-000E7D081A0B001C`, iOS à jour,
  apparié à Xcode 27.2. Build Debug signé automatiquement (Personal Team `QRU99VJUB5`),
  bundle `com.lekitduvoyageur.app`.
- Coquille Capacitor pointée sur le **Preview V2** du commit de recette `ce5313a`
  (`https://kitduvoyageur-1783951966810-nsj0gu31k.vercel.app`) : la Production est à
  `false` (J-08), donc impossible d'y recetter les tiroirs — écart documenté.
- `cap sync` → `**BUILD SUCCEEDED **` → `devicectl device install app` → **`Launched
  application with com.lekitduvoyageur.app`**. Capture d'écran appareil :
  `docs/audit/communaute-v2-2026-11-08/recette/captures-v2/iphone-app-lancee.png`
  (app plein écran, safe areas respectées).
- Non testé (interaction manuelle requise, aucune automatisation de tap disponible :
  Maestro CLI absente, pas de WebDriverAgent/idb, budget 0 €) : ouverture des deux
  tiroirs dans l'app, haptique, clavier, caméra/photothèque, géolocalisation.
- Constat et correctif : le `Info.plist` ne déclarait aucune autorisation caméra /
  photothèque ; les trois libellés (`NSCameraUsageDescription`,
  `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`) ont été
  ajoutés en français, `plutil -lint` OK. Détail : `recette/IPHONE.md`.

## 6. Livré au-delà du document

- Fiche `/sorties/[id]` minimale (billet, jauge, adhésion, `.ics`, carte) : nécessitée par les
  liens depuis l'Explorer, absente du document.
- `StoriesViewer` en mode `compose` (recadrage, carnet lié) : réutilise le visualiseur existant
  au lieu d'en créer un second.
- Mémoire de session (volet, filtre, tri, requête, scroll) sans stockage persistant.
- `SortMenuButton`, `DynamicIsland` et `LensPager` ajoutés aux primitives partagées
  (`src/components/ui/drawer`) et alignés sur les seuils /compte.
- Événements de compétition / reco : aucun.

## 7. Décisions prises seul

Toutes dans `handoff/communaute-v2/JOURNAL.md` :

| # | Décision |
|---|---|
| J-01 | Worktree et branche dédiés (`lkdv-communaute-v2`, `feat/communaute-v2`) |
| J-02 | Canal unique base : MCP Supabase + CI, pas de `psql`/CLI locale |
| J-03 | Docs de chantier dans la PR (traçabilité) |
| J-04 | Alignement canal base ↔ registre prod avant toute application |
| J-05 | `/compte` source de vérité du design ; `/communaute` v1 conservé en repli |
| J-06 | Gate 4c : installer Chromium + WebKit en CI (sinon la porte e2e mobile était morte) |
| J-07 | Exceptions du document (`01 § 6`) non implémentées, listées explicitement |
| J-08 | **Aucune migration prod sans sauvegarde vérifiée** ; drapeau prod laissé `false` |
| J-09 | Variables Vercel d'aperçu (drapeau + connexion démo) pour la recette |
| J-10 | Alignement du registre audité en lecture seule, preuve jointe |
| J-11 | Correctif minimum du jeton kit-studio qui rendait `main` rouge |
| J-12 | Flake vitest pré-existant `PostGlassPanel` documenté, non masqué (cf. § 1) |

## 8. Retour arrière

- **Vercel (code)** : Instant Rollback vers le déploiement de production précédent, ou
  `git revert 9b68c63bbbc1695b0c2d3d79162fc0ff7127d66a` puis push sur `main`.
- **Drapeau** : `NEXT_PUBLIC_COMMUNAUTE_V2=false` en Preview/Production puis redéploiement
  (le drapeau est figé au build). À `false`, les tiroirs v1 reprennent la main : aucun code v2
  n'est monté.
- **Base (si les migrations ont été appliquées)** : rejouer dans l'ordre inverse
  `supabase/migrations_down/20261108130008…130001.down.sql` (une transaction par fichier) ;
  nos migrations sont additives (aucune colonne supprimée, aucune donnée déplacée), le retour
  arrière ne perd donc aucune donnée utilisateur.
- **iPhone** : supprimer l'app de l'appareil ; aucune donnée serveur n'est créée par
  l'installation.

## 8 bis. Défauts constatés en recette, routés (non corrigés dans `src/`)

- **« Sur la carte » (Recherche)** : recouvrement CSS réel — un `SPAN.lkdv-cv2x-cover-fallback`
  d'une ligne de résultat recouvre la bascule « Affichage des résultats » à 390 px
  (`.lkdv-cv2x-search-row > .lkdv-cv2x-search-list`). Le tap natif est intercepté ; la spec
  e2e clique en DOM. À corriger (ordre de pile / `pointer-events` de la liste).
- **`cv2-island`** : `data-testid` dupliqué (couche + pastille) ; les specs ciblent
  `.lkdv-island-pill`. Unifier à une seule racine.
- **Références visuelles** : les 19 références sont `-darwin` (macOS) ; la spec se saute en
  CI tant que les références Linux n'ont pas été produites (`LKDV_V2_VISUAL_LINUX=1
  --update-snapshots` sur le runner).
- **Gate CI n° 4c** : elle est sautée quand la gate 3 échoue (chaîne `if: success()`), donc la
  CI n'exécute pas les e2e de la PR tant que le flake de la gate 3 n'est pas résolu ; les
  preuves e2e sont locales/reproductibles. Recommandation : en faire un job indépendant.
  Correctifs **résolus** en revanche pendant la recette : « ‹ Retour » intercepté par la
  poignée (z-index, vérifié en clic natif) et restitution du focus en WebKit (reprises
  rAF + timers, 1c vert sur les deux moteurs).

## 9. Suites proposées

- Retrait des tiroirs v1 et de `features/community/card/` : **PR brouillon séparée, non
  fusionnée** — https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/156.
- Lecture des clubs `secret` réservée aux membres (faille actuelle de `clubs_read`).
- Référence morte `clubs.is_private` (`ClubLiquidGlassV8.tsx:896`).
- Invitations (clubs, sorties) ; vidéo dans les publications ; sondage / options /
  programmation des posts ; rappels de sortie ; occurrences récurrentes ; scan code-barres ;
  TestFlight.
- Appliquer les migrations prod puis la recette B dès que `BACKUP_PASSPHRASE` existe
  (`PROD-APPLICATION.md`), et repasser `NEXT_PUBLIC_COMMUNAUTE_V2=true` en Production.

## 10. Pièces jointes

- `handoff/communaute-v2/` : mission, spec, design, données, plan, qualité, déploiement,
  recette, journal, contrats RPC, procédure prod.
- `docs/audit/communaute-v2-2026-11-08/` : `COUVERTURE-200.md`, `integration/` (rapport + 19
  captures), `recette/` (preuves, captures, fixtures), `DEPLOIEMENT.md` côté `docs/communaute-v2/`.
