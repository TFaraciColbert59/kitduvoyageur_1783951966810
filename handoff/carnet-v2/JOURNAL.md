# Journal des décisions — Fiche Carnet v2

Format : Date | Décision | Contexte & Raison | Alternative écartée

---

## 2026-11-07 — Démarrage et initialisation de la mission

- **2026-11-07 23:00 — Création de la branche et initialisation**
  - **Décision :** Branche de travail créée à partir de `main` : `feat/carnet-v2`. Le bundle handoff est importé sous `handoff/carnet-v2/`.
  - **Raison :** Conforme aux consignes de `00-MISSION.md` et `04-PLAN-IMPLEMENTATION.md`.
  - **Alternative écartée :** Travailler directement sur `main` (interdit par les garde-fous).

- **2026-11-07 23:05 — Phase 0 : Audit des portes qualité initiales**
  - **Résultats :**
    - `npx tsc --noEmit -p .` : Vert (0 erreur).
    - `npm run lint` : Vert (0 erreur).
    - `npx vitest run tests/design/unification.spec.ts` : Vert (5/5).
    - `npm run verify:invariants` & `npm run verify:icons` : Vert après alignement de 3 incohérences d'icônes legacy (`StoriesViewer.tsx` share2/trash2, `CarnetTile.tsx` message-square, suppression du SVG path non utilisé dans `MessagesScreen.tsx`).
    - `npm run perf:budget` : Vert sur toutes les surfaces.
    - Tests existants du carnet (`src/components/carnet` & `src/features/carnet`) : 26 fichiers, 287 tests tous verts (dont `CarnetPostSheet.test.tsx` ajusté pour le décodage d'URL Next.js Image).
    - Tests généraux du dépôt : 1164 fichiers / 13752 tests unitaires passent. 38 fichiers de tests plus anciens ou nécessitant Chromium Playwright / base Supabase étaient déjà rouges ou en échec hors carnet.

---

## 2026-11-08 — Déploiement, recette mobile et correctifs production

- **2026-11-08 15:40 — Correction de l'URL du serveur distant Capacitor**
  - **Décision :** Reconfiguration de `CAPACITOR_SERVER_URL` avec l'alias Vercel de production `https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app` au lieu de `https://lekitduvoyageur.fr`.
  - **Raison :** `lekitduvoyageur.fr` n'est pas encore routé/résolu par les DNS publics et est bloqué par Zscaler (403), affichant un écran d'erreur dans la coquille native sur l'iPhone.
  - **Alternative écartée :** Attendre la mise en service DNS de `lekitduvoyageur.fr`.

- **2026-11-08 16:15 — Résolution du 404 sur les fiches carnet (`/carnets/[id]`)**
  - **Diagnostic :** La fonction `getCarnetDetail` incluait dans son `select` la colonne `live_sharing` (table `carnets`) et les colonnes `verdict`, `verdict_note`, `jours_utilises` (table `carnet_kit_items`). Ces colonnes font partie des migrations Lot D/E qui n'ont pas encore été appliquées sur l'instance Supabase distante de production. PostgREST renvoyait un code d'erreur `42703` (colonne inexistante), causant le retour de `null` par `getCarnetDetail`, ce qui déclenchait Next.js `notFound()`.
  - **Décision :** Implémentation d'un mécanisme de repli automatique (graceful fallback) dans `getCarnetDetail.ts` en cas d'erreur `42703` vers un jeu de colonnes compatibles base distante (`CARNET_COLUMNS_BASE`), et fallback sur `carnet_kit_items`. Ajout également de la redirection de la route legacy `/carnets/nouveau` vers `/communaute?creer=carnet`.
  - **Raison :** Tolérance aux bases sans migration D/E sans casser le rendu de la v2. Résout instantanément les 404 sur tous les carnets publics existants (ex: `6cd92273-5309-4c12-aee3-f1f3b1ebc46b`).
  - **Alternative écartée :** Exiger une intervention manuelle d'application de migration en urgence sur la base de production Supabase avant de pouvoir consulter les carnets.

- **2026-11-08 16:26 — Déploiement Vercel Production & relance sur iPhone 16 Pro**
  - **Décision :** Commit `49322e6` poussé sur `origin/main`. Déploiement de production Vercel `dpl_4EvcJVS9tZafBB5eBPmeN6bRTD4i` (`kitduvoyageur-1783951966810-63850bp2k.vercel.app`) passé à l'état Ready. Relance du processus de l'application native sur l'iPhone 16 Pro physique (UDID `00008140-000E7D081A0B001C`).

---

## 2026-11-08 (soir) — Reprise du flambeau : la fiche rentre dans la grammaire /compte

- **2026-11-08 19:20 — Tokens du socle sur la racine de la fiche**
  - **Décision :** déclarer `--label`, `--label2`, `--tint`, `--ga`, `--gb`… sur `.lkdv-carnet-v2-root` (source `compte-v8.css` `.phone` L26-34) et remplacer les 18 usages CSS + 50 usages TSX de `--lkv-text-secondary` / `--lkv-primary` par ces jetons.
  - **Raison :** la fiche ne monte pas `.phone` ; les jetons `--lkv-*` du thème liquide global sont blancs (`rgba(255,255,255,.71)`) et donnaient un texte blanc sur verre clair (contraste ~1,1:1). Mesuré au DOM avant/après.
  - **Alternative écartée :** forcer `color` par sélecteur d'écran ; cela aurait laissé les 50 styles inline du tiroir sur la mauvaise encre.

- **2026-11-08 19:22 — Tiroir = feuille dans la carte, pas plein écran**
  - **Décision :** `.lkdv-carnet-drawer` et `.lkdv-stack-sheet` passent à `406 × 521.9 @ 12,48`, `r24`, verre `--sheet-*` ; `role="dialog"`, `aria-modal`, focus piégé/Échap/retour de focus/scroll lock via `useCarnetDialog` ; injection de `DRAWER_V2_CSS` (le `SlotShell` n'a pas de CSS global).
  - **Raison :** mesure avant : `inset:0`, rayon 32 en haut, capsule de lentilles à `y=1048` (hors feuille). Après : feuille 406 × 521.9, capsule à `y=530`.
  - **Alternative écartée :** réécrire le tiroir avec Radix ; la primitive `SlotShell` existe et respecte le socle, il manquait sa feuille et sa CSS.

- **2026-11-08 19:24 — Barre haute à 3 boutons, popover Affichage**
  - **Décision :** retirer le 4ᵉ bouton rond (réglages) ; « Paramètres et partage » entre dans le menu du titre ; le bouton soleil ouvre un popover famille D à deux interrupteurs (`Plein soleil`, `Réduire les animations`). `reduceMotion` est persisté dans `localStorage` (`lkdv:carnet:reduce-motion`) et appliqué par une règle scopée à la fiche.
  - **Raison :** loi 7 (trois boutons ronds max) + écart maquette #6. Le libellé du bouton devient « Affichage ».
  - **Alternative écartée :** garder le soleil en toggle direct et supprimer le popover ; on perdait le second réglage.

- **2026-11-08 19:25 — Peek & Pop et altitude réelle**
  - **Décision :** `CarnetPeek` (famille D, appui long 460 ms) avec 4 actions réelles : J'aime (par moment), Commenter (ouvre le panneau commentaires via `initialPanel`), Ouvrir le moment, Partager. Pas d'« Enregistrer » ni de « Signaler » : aucun backend par moment (le favori est au niveau carnet, `post_reports` attend un post).
  - **Décision altitude :** `buildElevationProfile` lit `positions_timed[].elevationM`, cumule la distance haversine, ignore les échantillons sans altitude et rend `[]` sous deux mesures. `CarnetAltitude` ne s'affiche qu'avec ≥ 2 points ; le tiroir affiche un état vide honnête au lieu du faux « Trace altimétrique interactive synchronisée ».
  - **Raison :** loi 10 (zéro mock). En démo, les 326 échantillons de `hike_sessions.positions_timed` ont tous `elevationM: null` : l'accessoire ne doit pas apparaître.
  - **Alternative écartée :** dessiner une courbe à partir du D+ total ou d'altitudes d'hébergements absents (invention).

- **2026-11-08 19:26 — Responsive et crash desktop**
  - **Décision :** colonne 430 centrée à ≥768, `100dvh`, `padding:0!important` (le `.lkdv-compte-v8` imposait 16 px), barre flottante retirée quand la fiche est montée, fond de page `#F5F2EC`. `bottomBarOverlap` ignore une barre non flottante (`barTop < 80`) et `fitBoundsSafely` protège les trois `fitBounds`.
  - **Raison :** à 768/1440 la fiche tombait dans `error.tsx` (`cameraForBoxAndBearing` : padding bottom = hauteur d'écran à cause de la barre D-01) ; la carte faisait 1384 px de large.
  - **Alternative écartée :** masquer la carte à ≥768 ; la carte est le contenu principal de la fiche.

- **2026-11-08 19:27 — Preuves**
  - `npx vitest run src/components/carnet/v2 src/features/carnet/detail` : **14 fichiers, 118/118**.
  - `tsc` ciblé (`tsconfig.carnet-audit.json`, carnet + carte) : **0 erreur** ; le `tsc` global du dépôt dépasse 2 Go de heap (OOM environnemental, pré-existant).
  - `eslint` sur les fichiers touchés : **0 erreur**, 8 avertissements pré-existants.
  - Captures : `docs/audit/carnet-v2-2026-11-08/captures/after-{430,768,1440,drawer,peek,display}.png`.
  - Non déployé : l'arbre de travail partagé contient des modifications hors périmètre (messaging/compte) non commitées, dont une erreur de syntaxe dans `ComposerMenuSheet.tsx` qui empêche un build global. Elles ne sont pas de cette reprise et n'ont pas été touchées.

- **2026-11-08 20:07 — Production vérifiée (build final)**
  - **Décision :** `2c7fd90` poussé sur `origin/main`, déploiement
    `dpl_GcKPwwinN814Yr9fVir75epPp8sm` READY, aliasé `koosmoweb.fr` et
    `kitduvoyageur-1783951966810-ruddy.vercel.app`, vérifié avec le compte démo.
  - **Mesures :** 430 → 430×932, carte 406×542, feuille 406×521.9 ; 768 →
    colonne 430 centrée ; 1440 → colonne 430 centrée ; `scrollHeight = innerHeight`.
  - **Note :** `koosmoweb.fr` injoignable depuis la machine (DNS/Zscaler) et
    l'alias `…-git-main…` n'a pas basculé ; le domaine projet et l'URL de
    déploiement servent le nouveau build. Erreurs maplibre `appendChild`
    pré-existantes (identiques sur `c268b3c`).

- **2026-11-08 20:58 — Contre-recette de la production**
  - **Défauts trouvés et corrigés :** like du post décorrélé de l'état carnet ; quatre
    lignes du tiroir en `<div onClick>` ; grille `role=grid` invalide (axe critical) ;
    focus qui sortait du tiroir après la dernière lentille ; fond non `inert` ;
    « 1 jours ».
  - **Décisions :** le like du Peek et du post est le **like carnet** (les tables
    `carnet_moment_likes/saves` n'existent pas en prod) ; libellé explicite
    « J'aime le carnet ». Le tiroir garde ses 5 slots et ses 18 lentilles.
  - **Preuves :** axe 0 critical/serious sur page/tiroir/peek, 25 Tab restent dans le
    tiroir, like post false→true, peek « Retirer mon j'aime · 6 » → « J'aime le carnet · 5 »,
    390/360 sans débordement, `tsc` ciblé 0, 118/118 tests.

- **2026-11-08 21:10 — Vérification finale**
  - **Preuves :** `tsc -p .` EXIT 0, `npm run build` EXIT 0, `perf:budget` 9/9 ok,
    `verify:invariants` vert, 118/118 tests carnet, 5/5 design, axe 0 critical/serious
    (page/tiroir/peek), 25 Tab piégés, prod `411939a` READY et aliasée.
  - **Reste hors périmètre :** erreurs maplibre `appendChild` pré-existantes, jours
    de démo J211/J212, migrations likes/commentaires par moment et verdicts.

- **2026-11-08 22:00 — Refonte 100 % : données et UI**
  - **Migrations prod appliquées** (additives, RLS, vérifiées par advisors) : Lots A à E
    + `post_reports.target_type`. Débloquent likes/saves/commentaires par moment,
    réactions par jour, nuits, verdicts, position live, forks.
  - **UI** : vue Résumé en voyage-cards 144 px + dayhead, vue jour dayhead, carte topo
    + badge + curseur de scrub + drag, profil altimétrique réel Open-Meteo, Peek 5
    actions, post et commentaires par moment, signalement polymorphe, verdicts
    Essentiel/Utile/etc., reprise de lecture, cascade, morphing du titre, grab drag,
    barre masquée sous toutes les feuilles.
  - **Preuves** : 331/331 tests carnet, `tsc` 0, build production 0, perf 9/9,
    axe 0 critical/serious, captures 430/768/1440.
  - **Bloqué par la donnée** : nuits et verdicts vides en démo, J211/J212, km/D+
    par jour manquants. Aucune valeur inventée.
  - **Décision** : signalement carnet/moment dans `comment_reports` (pas de table
    dédiée, `post_reports.post_id` a une FK vers `community_posts`).
