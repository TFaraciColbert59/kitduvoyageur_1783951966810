# Checklist autonome — chantier nettoyage / perf / Rust

Chaque case coche une **preuve exécutée** (commande, sortie, commit). `BLOCKED`
et `N/A` sont motivés. Dernière mise à jour : 31/10/2026.

## P00 — Bootstrap
- [x] Bon dépôt et bon HEAD de `main` confirmés : `origin/main` = `f89f5665…`,
      remote `TFaraciColbert59/kitduvoyageur_1783951966810`.
- [x] Worktree isolé `/Users/fr168256/lkdv-chantier-cleanup` ; le worktree
      `unified/latest` (100 commits non poussés, 2 fichiers non suivis) n'a pas
      été modifié.
- [x] PR #124 inspectée : 3 commits, `scripts/cleanup/audit.mjs` (lecture seule)
      + test node:test + roadmap. Outil repris et testé ; PR **non fusionnée**.
- [x] Capacités relevées : Node 26.8.2, npm 11.19.1, git, push GitHub OK
      (`--dry-run`), Supabase MCP lecture seule OK ; Rust/cargo **absents** ;
      `gh` CLI absent.
- [x] `preuves` remplacées par `docs/cleanup/` dans le dépôt de travail.

## P01 — Baseline
- [x] Inventaire chiffré : 9 514 fichiers suivis, 276,8 MiB, 5 066 textes
      scannés, 40 groupes de doublons exacts, 35 sources ≥ 800 lignes
      (`docs/cleanup/BASELINE.md`).
- [x] Dépendances : 58 paquets sans import dans `src/` (faux positifs de config
      documentés) — aucun retrait sans build+E2E dédiés (`docs/cleanup/DEPENDANCES.md`).
- [x] `npm ci` cassé sur HEAD (lockfile désynchronisé) → corrigé et testé.
- [x] `npm run type-check` : exit 0 avec `--max-old-space-size=6144` (OOM à 2 Go).
- [x] `npm run build` : `✓ Compiled successfully in 3.0min`, 58 pages
      statiques, exit 0 (branche P0).
- [x] `npm test` (vitest) : 13 059 tests passent, 118 échouent (48 fichiers),
      50 ignorés — échecs **prouvés préexistants** (mêmes fichiers sur `main` :
      9 échecs / 38 succès) ; voir `RAPPORT_FINAL.md` §4.
- [ ] LCP/INP/CLS, FPS mobile, mémoire longue : `BLOCKED` (pas de preview
      autorisée, aucun appareil connecté — voir `BASELINE.md`).

## P02 — Stabilité (2ᵉ passe)
- [x] `resampleTrack` : OOM reproduit (exit 134, trace conservée), corrigé,
      tests rouges/verts (24 cas) — `docs/cleanup/evidence/`.
- [x] Worker géo réel : `new Worker(new URL(...))`, protocole typé corrélé,
      annulation, terminaison, fallback (5 tests de protocole + 5 tests de hook).
- [x] Clé de profil : empreinte FNV du contenu complet + `stepM`/`demZoom`
      (mutation interne détectée, réponse tardive ignorée).
- [x] Simulation GPS : impossible en production, opt-in + armement explicite,
      test d'inertie par défaut.
- [x] **Fallback worker garanti** : `postMessage` en échec, `error` et
      `messageerror` basculent sur le thread principal — plus jamais de
      `loading` éternel. Bootstrap testable (`workerServer.ts`), 44 tests.
- [x] Parcours carte/GPS/GPX : contrats conservés (mêmes nombres de points,
      mêmes champs de réponse API) ; build OK.

## P03 — Nettoyage (2ᵉ passe)
- [x] Scripts `package.json` réconciliés : `cleanup:audit` et
      `cleanup:quarantine` fonctionnels, `design:diff`/`explorer:shots` retirés
      (fichiers absents, casse déjà documentée dans `docs/audit`).
- [x] Doublons géo : 3 implémentations de haversine/décimation/rééchantillonnage
      → 1 moteur partagé + 1 module DEM, tests de parité.
- [x] Outil de quarantaine avec manifeste/restauration : 8 tests node:test.
- [x] Dépendances inutilisées : **12 retirées avec preuve repo entière**,
      `recharts` conservé car utilisé par le HUB (zone gelée), build exit 0.
      `node_modules` 778 → 771 dossiers ; aucun gain bundle revendiqué.
- [ ] Modules géants (> 800 lignes) : inventoriés, non scindés (hors budget,
      risque visuel) — `N/A` pour ce chantier.
- [ ] `any` (452) / `eslint-disable` (128) : comptés, non migrés (changement
      massif non testable sans E2E complète) — `N/A` motivé.

## P04 — SQL / réseau
- [x] RPC profilés en lecture seule : `trails_in_viewport` 8 994 appels,
      159,8 ms de moyenne, p95 approx. 617 ms ; `get_trail_pois_bbox` 4 425
      appels, 87,7 ms (`docs/cleanup/SQL_AUDIT.md`).
- [x] Index dupliqués identifiés (`hiking_routes.geom` ×2, `trips.slug`,
      `trips.share_token`) ; **aucune suppression**, proposition + rollback.
- [x] Volumétrie/bloat : aucun bloat critique ; `admin_regions_geo` vide mais
      41 Mo → vérification fonctionnelle requise, non touché.
- [ ] RLS multi-comptes : `BLOCKED` (pas de staging autorisé).
- [x] Cache viewport client déjà présent (`200 ms` + AbortController + clé
      3 décimales) : aucune optimisation ajoutée, constat documenté.

## P05 — Rust/WASM
- [x] Moteur TS mesuré (1k/10k/100k points, p50/p95) : `docs/cleanup/RUST_VERDICT.md`.
- [ ] Crate Rust : **non créée** — toolchain absente, installation `curl | bash`
      interdite ; verdict NO-GO documenté avec seuil 2×/150 Ko non atteint
      par la mesure TS.
- [x] Fallback TS : c'est le seul moteur livré, testé (40 tests).

## P06 — Front / 3D / médias / GPX
- [x] Bundle baseline mesuré route par route (`docs/cleanup/BUNDLE.md`) :
      shared 105 kB, Explorer 156 kB, Hub 554–596 kB, Compas 537 kB.
- [ ] Optimisations bundle : aucune retenue — les pistes (dynamic import Hub,
      allègement Compas) exigent une validation visuelle E2E indisponible ici.
- [x] **GPX** : points fantômes supprimés, extraction unifiée (hiking +
      messagerie), optimisation de parsing **mesurée puis rejetée** (x0.26 à
      x0.93) ; après retour, x0.96–x1.03. Banc `npm run perf:gpx` livré.
- [ ] iOS/Android natif, FPS, 3D : `BLOCKED` (aucun appareil/simulateur).

## P07 — QA / livraison (2ᵉ passe)
- [x] Type-check, build, tests unitaires, tests des outils exécutés localement.
- [x] CI GitHub vérifiée : `build`, `lighthouse`, `bundle-analysis`, `build-ios`
      verts sur #125 ; `quality-gates`, `database-gates`, `perf-explorer` rouges
      **pour des causes préexistantes** (tests `design/*`, pgTAP, mesure 600 s).
- [x] PRs ouvertes en brouillon avec preuves, risques, rollback.
- [x] Aucune mutation de `main`, de la production ou de la base.
- [x] **Zones gelées** : aucun fichier HUB/Compas créé, modifié, déplacé ou
      supprimé ; `recharts` et les modules partagés ont été vérifiés.
- [x] Rapport final honnête avec blocages (`docs/cleanup/RAPPORT_FINAL.md`),
      verdict Rust (`RUST_VERDICT.md`), bundle (`BUNDLE.md`).
