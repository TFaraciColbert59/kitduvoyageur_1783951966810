# LKDV — Nettoyage technique et préparation Rust/WASM

## Objectif et périmètre

Rationaliser LKDV sans supprimer une fonction, une route, une donnée, une migration, une compatibilité iOS ou un scénario hors ligne. Ce document est un **plan**, et non une affirmation que le nettoyage complet est terminé.

### Constat vérifié le 31 octobre 2026

- Les scripts npm `cleanup:audit` et `cleanup:quarantine` pointaient vers des fichiers absents de `main`. Cette PR restaure seulement **audit**, en lecture seule ; `quarantine` restera à traiter.
- Dans `src/features/explorer-v2/workers/useGeoProfile.ts`, `buildProfile` est importé puis exécuté directement, sans instancier de véritable Web Worker.
- Dans `src/features/explorer-v2/workers/geo.worker.ts`, la boucle de `resampleTrack` peut ne pas progresser lorsqu'un segment dépasse le pas d'échantillonnage. Reproduire par un test avant correction.
- `useGpsTracker.ts` peut injecter des positions GPS de simulation en cas d'absence de fix. L'utilisation de ces données doit rester exclusive aux tests.
- La configuration ESLint désactive notamment `@typescript-eslint/no-explicit-any` : renforcer progressivement, sans désactiver les contrôles de build.
- Le projet possède déjà des calculs PostGIS ; une conversion Rust ne doit jamais remplacer une requête SQL optimisée sans preuve de gain total.

## Lot 0 — Inventaire non destructif (dans cette PR)

Commandes à exécuter depuis le checkout GitHub :

    npm run cleanup:audit
    node scripts/cleanup/audit.mjs --json > /tmp/lkdv-cleanup-audit.json
    node scripts/cleanup/audit.mjs --strict
    node --test tests/cleanup/audit.node-test.mjs

L'outil détecte les scripts locaux référencés mais absents, les doublons textuels **strictement identiques**, les fichiers sources de 800 lignes ou plus, et les dossiers générés suivis par Git. Il ne touche à aucun fichier. Un résultat d'inventaire ne constitue **jamais** une autorisation de suppression. `--strict` échouera tant que des scripts locaux sont manquants.

## Lot 1 — Stabilité et tests avant refactor

- [ ] Tests de reproduction puis correction du rééchantillonnage sur segments longs.
- [ ] Instancier le Worker réel, gérer réponses par identifiant, interruptions et repli quand indisponible.
- [ ] Corriger invalidation du profil géographique (clé basée sur trace complète + paramètres DEM).
- [ ] Bloquer la simulation GPS en production pour les activités réelles.
- [ ] Réconcilier tous les points d'entrée du package.json avec le code suivi par Git.

## Lot 2 — Nettoyage contrôlé

- [ ] Générer une carte de dépendances des imports statiques et dynamiques, routes Next, Swift/Capacitor, scripts, jobs, assets et migrations.
- [ ] Classer chaque candidat : actif / legacy nécessaire / remplacé / candidat à quarantaine / inconnu.
- [ ] Dédupliquer les moteurs de calcul géographique et d'autres utilitaires seulement avec tests de parité.
- [ ] Scinder les modules trop volumineux sans changer les contrats publics.
- [ ] Supprimer les dépendances réellement inutilisées avec synchronisation du lockfile et contrôle bundle.
- [ ] Réduire les avertissements ESLint par lots mesurables ; renforcer les règles après migration.
- [ ] Ne jamais supprimer les migrations historiques, fonctions RLS, données OSM, routes et vues sans preuve d'absence d'usage.

## Lot 3 — Baseline et optimisation

- [ ] Mesurer LCP, INP, TTFB, FPS, CPU, mémoire, volume JS et données sur mobile réel et bureau.
- [ ] Profiler Explorer, Compas, HUB, Kit Studio 3D, Communauté, GPX et navigation hors ligne.
- [ ] Optimiser SQL et tuiles PostGIS avant d'ajouter des serveurs. Contrôler les index supposés redondants.
- [ ] Relever p50/p95, consommation batterie et pics mémoire avant/après chaque changement.

## Lot 4 — Rust/WASM conditionnel

- [ ] Comparer TS optimisé à Rust/WASM (1k/10k/100k points, relief DEM), en incluant coût de chargement, frontière JS/WASM et transferts Worker.
- [ ] N'introduire `crates/lkdv-geo` que si le gain >=2x dans le scénario cible, avec binaire <=150 Ko gzip, conformément au plan Explorer.
- [ ] Fournir fallback TypeScript, tests de parité, buffers typés, limites mémoire, annulation et chargement différé.

## Livraison et critères de réussite

- Une PR ciblée par lot ; aucune fusion si les tests concernés ou les tests obligatoires échouent.
- Valider type-check, lint, Vitest, Playwright web/mobile, rendu iOS/WebKit, sécurité et sécurité SQL avant publication.
- Tout retrait de code doit avoir une preuve d'inutilisation et une procédure de rollback.
- Aucune perte fonctionnelle, aucun impact RLS, aucun changement silencieux de données ou d'API.
- Conserver le moteur original tant que le nouveau n'a pas démontré une amélioration mesurable.

**État du présent lot :** outil inventaire + tests unitaires locaux ; suite complète de LKDV et audit du dépôt complet non exécutés dans cette intervention.
