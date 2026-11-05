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
- Vérifié par le coordinateur : Vitest kit-studio 12/12 verts ; 0 hex dans catalog.ts ; REPO-MAP 91 lignes. Résultats de T01-T03 NON vérifiés. Reprendre : vérifier T01-T03 (tests, diff), remplir le LEDGER, puis vague 3 (T04, T05, T08, T13).
