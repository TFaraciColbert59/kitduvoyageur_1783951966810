# Journal Kit Studio v2

## 2026-11-05 — démarrage (coordinateur Opus)
- Worktree `.claude/worktrees/kit-studio-v2`, branche `claude/kit-studio-v2` depuis `origin/main` 45d32c936. Bundle copié dans `kit-studio-bundle/`. `npm ci` OK.
- Décision : `bootstrap.sh` refusé par le classifieur (écrit dans `.claude/agents`, `.claude/skills`, `.mcp.json`, `CLAUDE.md`). Pas installé : les règles des profils ks-* sont passées dans chaque brief (general-purpose + modèle/effort imposés). MCP non branchés (inutiles : Playwright via npm).
- Mesure de départ lancée (tsc, vitest, lint) → journaux dans le dossier temporaire de la session, à reporter ici.
- Constat : données et moteur identiques entre `Kit_Studio_actuel.html` et `Kit_Studio_v2.html` (v2 = actuel + 107 lignes avant les données). Plages v2 utiles : CSS 9-509 (tiroir 398-436, finition 437-508), HTML 511-571, vignettes 1195-1236, tiroir 1321-1375, Bilan 1376-1421, fiche 1422-1456, sac/commande 1457-1502, gestes 1519-1621, Apparence 1622-1753, deck 1754-1791.
- Vague 2 lancée (Haiku) : T01 REPO-MAP, T02 three, T03 catalogue (+ MATS/FIN/COLS/SHAPES/ACC/VS/CATN/preset/ALT). Couleurs : clés `m-<hex>` dans catalog.ts, hex seulement dans `domain/palette.ts` (`RAW_MATERIALS`, bloc `// <generated>`).
- Rapports reçus (NON revérifiés par le coordinateur) :
  - T01 : REPO-MAP.md écrit (~110 l.). Constats : `HIDE_CHROME_PREFIXES` n'existe pas (logique inline MobileNavWrapper.tsx l.25-34) ; Playwright `testMatch` (playwright.config.ts l.35) liste les specs, il faut y ajouter tests/e2e-kit-studio ; pas de `transpilePackages` ; thème status bar seulement pour /compas (status-bar.ts l.64-67) ; `traveller_privacy.mjs` tourne en prebuild ; pas de budget bundle pour /kit-studio.
  - T02 : three@0.186.0 + @types/three@0.186.0 exacts, REVISION 186, next.config/csp inchangés.
  - T03 : port-catalog.mjs → catalog.ts + palette.ts (36 matières), 12 tests verts annoncés. Renommages : MATS→MATERIALS, FIN→FINISHES, COLS→SWATCHES, SHAPES→SHAPE_OPTIONS, ACC→ACCESSORIES, VS→VISUAL_PATHS, ALT→ALTERNATIVES, CFG→DEFAULT_CONFIG (retenus). À corriger : preset() renvoie un objet partagé mutable → renvoyer une copie (à faire dans T04/T09).
- Mesure de départ (origin/main 45d32c936, avant tout changement) : `tsc` 0 erreur ; Vitest **33 fichiers / 54 tests rouges** (13 215 verts) — déjà présents, hors chantier (ex. ProfileDrawerBootstrap, CarnetPostSheet, hub-adventures-drawer, MentionPicker) ; `next lint` : avertissements seulement.
- Vérifié par le coordinateur : Vitest kit-studio 12/12 verts ; 0 hex dans catalog.ts ; REPO-MAP 91 lignes. Commit 2a9095f8d.

## Vague 3 (T04, T05, T08, T13, T10 en parallèle)
- Décision : le coordinateur pose le contrat d'état `domain/types.ts` (KitState immuable : kits vivants, config par sac, jour, own/order, objets ajoutés) et `domain/state.ts` (createInitialState, currentKit/Bag/Config, getItem, zoneOf, withKit) pour que T05/T07/T08/T09 écrivent contre la même forme. Coût si faux : renommages mécaniques.
- Décision : les couleurs littérales de la scène (textures canvas, décor) vivent dans `domain/palette.scene.ts` ; le garde-fou `verify-kit-studio.sh` exclut désormais `domain/palette*` (et non plus seulement `palette.ts`).
- Décision : T10 teste le cycle de vie avec un faux renderer injecté (pas de WebGL en Node) ; `renderer.info.memory` réel et comparaison visuelle reportés en E2E WebKit (T19).
- Décision : T13 livre des composants contrôlés par props ; le branchement au store se fait en T09/T14.
- Constat (T17) : capsule à plus de 4 boutons → cible de 38 px < 44 px (Capsule.tsx:26, kit-studio.css:339). À corriger en T21 : zone tactile étendue par `::after` sans changer le visuel. Contrastes AA non mesurés → T20 (a11y).
- Constat (T10) : PCFSoftShadowMap retiré en three r186 → PCFShadowMap ; `LEGACY_COLOR_LOOK` reproduit le rendu r149, à trancher sur capture en T19.
- Contrôles CI lancés en local avant la PR : `tests/design/unification.spec.ts` 5/5 vert ; `scripts/verify/ci_invariants.mjs` et `verify:icons` en échec **déjà sur main** (7 noms d'icônes non résolus dans StoriesViewer, CarnetTile, MessagesScreen) : 0 occurrence kit-studio, hors périmètre.
- Outils : pas de CLI `gh` sur ce Mac → PR via le serveur MCP GitHub ; `git ls-remote origin` OK, main inchangé (45d32c936) depuis la base du worktree.
- Écarts `setPartOption`/`mutate()` (5) relevés par T14 → tâche T14b, alignement par oracle exécutant la maquette.
- Constat (T06) : le kit TMB initial est « Trop loin du dos » (z ≈ −4e-6) et prêt à 54 % : comportement identique à la maquette, conservé. Résultats de T01-T03 NON vérifiés. Reprendre : vérifier T01-T03 (tests, diff), remplir le LEDGER, puis vague 3 (T04, T05, T08, T13).

## 2026-11-05 — reprise (T14b → T23)
- T14b : `setPartOption` réécrit sur `mutate`/`applyOpt`/`optList`/`simulate` de la maquette (gardes « déjà appliqué » et « plus de place », coloris par rôle, accessoires par slot). Un preset global met aussi à jour le coloris du kit (test store). 264 tests verts.
- Intégration manquante trouvée par T19 : les feuilles (Bilan, Fiche, Sac, Commande) et le deck existaient mais **n'étaient montés nulle part** ; la pilule changeait l'état sans rien afficher. `ui/SheetHost.tsx` les monte dans le tiroir, `kitStore.apply()` applique un état produit par une feuille, `uiStore.deck` porte le deck.
- T19 a aussi révélé trois défauts invisibles aux tests unitaires : la pilule lisait des grammes comme des kilos (10 281 kg), `LEGACY_COLOR_LOOK = true` délavait le sac (vert sauge au lieu de forêt), et les vignettes 3D n'avaient **aucun constructeur enregistré** (repli SVG partout). Corrigés : `LEGACY_COLOR_LOOK = false`, `scene/thumbBuilders.ts` (objets + sac miniature) enregistrés à la première demande, `onBack / 1000`.
- E2E WebKit mobile `tests/e2e-kit-studio/kit-studio.spec.ts` : 6 parcours à 402×874, captures aux quatre tailles (`docs/kit-studio/captures/`). Deux pièges consignés : le squelette de `loading.tsx` porte aussi `.ks-root`, et l'hydratation peut perdre un premier clic — les sélecteurs visent l'écran qui porte la pilule et rejouent le clic.
- `scripts/verify-kit-studio.sh` (T20) : vert. `tsc -p .` complet demande `--max-old-space-size=6144` sur ce Mac de 8 Go (sinon SIGABRT).
- T22 (relecteur indépendant) : 2 bloquants, 6 importants, 8 mineurs (`REVIEW.md`). T23 ferme les deux bloquants (scène branchée au tiroir via `scene/sceneRef.ts` : projection de zone et éclairage ; `disposeThumbnailEngine()` appelé en quittant l'écran) et les importants sauf la conversion euros/centimes de `totals.buy/rent`, consignée comme dette.
- Ce qui n'est **pas** prouvé : rendu sur l'iPhone 16 Pro physique (absent), VoiceOver, contraste AA mesuré, budget de chunk 3D mesuré en gzip.

## 2026-11-05 — production (T24 → T26)
- PR #142 (branche `claude/kit-studio-v2`), CI : `build`, `build-ios`, `lighthouse`, `bundle-analysis`, `database-gates` verts ; `quality-gates`, `visual-tests` et `Workers Builds` en échec **comme sur `main`** avant la fusion (mêmes jobs, mêmes causes).
- Aperçu Vercel de la PR : E2E WebKit 6/6 verts avant fusion.
- Fusion squash dans `main` : `0d6021b4d`. Déploiement de production `dpl_EY42umycVmFQ43VoretDBTrRxzAH` (commit identique).
- Production vérifiée après build : `/kit-studio` HTTP 200, page réelle (pas l'écran « Deployment is building »), **E2E WebKit 6/6 verts sur l'URL de production**. `https://koosmoweb.fr` ne résout pas depuis cet environnement (DNS sortant filtré) : vérification faite sur l'alias `*.vercel.app` du déploiement.
- T25 : l'iPhone 16 Pro est enregistré mais **indisponible** (`xcrun devicectl` : unavailable). L'app Capacitor charge le site déployé : une app déjà installée affiche le Kit Studio sans rebuild. Fiche `ios/RUN-ON-IPHONE.md` ; IPA non signée produite par `build-ios` (CI verte).
- T26 : `RAPPORT-FINAL.md`. Dette ouverte : conversion euros/centimes de `totals.buy/rent`.
