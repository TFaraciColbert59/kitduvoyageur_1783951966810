# Lancement international — registre de preuves

Mise à jour : 19 septembre 2026 · Branche `feat/mobile-direction-progression` · Worktree `worktrees/lkdv-mobile-direction`.
Statuts : **vérifié** (preuve locale exécutée), **implémenté** (code livré, non mesuré), **partiel**, **non vérifié** (environnement indisponible), **restant**.

## Preuves exécutées

| Preuve | Commande | Résultat |
|---|---|---|
| Tests unitaires/intégration | `npm test` | **2919 passés, 27 skipped, 0 échec** (403 fichiers) |
| Types | `npm run type-check` | **0 erreur** |
| Build production | `npm run build` | **Succès**, First Load JS partagé 104 kB |
| pgTAP moteur + classement | `npx supabase test db --db-url …` (8 suites) | **93/93** |
| Contrastes WCAG | `node scripts/audit/visual-contrast.mjs` | **42/42 paires conformes** (4,5:1 texte / 3:1 UI) |
| Pseudo-localisation | `node scripts/i18n/pseudo-localize.mjs` | 198 clés, **198/198 ≥ +40 %** |
| Couverture i18n | `node scripts/i18n/coverage.mjs` | 668 fichiers scannés, **198 clés FR/EN à parité**, 459 fichiers restants listés |

## Domaine par domaine

| Domaine | Exigence | Statut | Preuve / dépendance |
|---|---|---|---|
| Moteur de progression | Un seul moteur, une action = un gain, idempotence, outbox atomique | **Vérifié** | pgTAP 93/93 ; aucune écriture cliente (REVOKE + RLS testés) |
| Producteurs | 7 producteurs réels (4 prêts + 3 complétés), désactivés documentés | **Vérifié** (preuve serveur), **implémenté** (non observé en production) | `PRODUCER_MATRIX.md` ; 76 tests progression ; aucun producteur fictif |
| Classements | 5 filtres, score identique, seuil 5, 1 km confidentiel sous flag | **Vérifié** pgTAP 46/46 | Flag `local_leaderboard_active` OFF par défaut ; anti-triangulation testée (sondage 30/h, seuil, aucune coordonnée) |
| Navigation et produit | 5 destinations, M01–M10, zéro donnée fictive | **Implémenté + tests** | Registre canonique, `aria-current`, 44 px, z-index unifié ; captures non produites |
| Direction visuelle | Palette, typo, espacements, contraste mesuré | **Implémenté + contrastes vérifiés** | `docs/visual/VISUAL_DIRECTION.md` ; baselines visuelles à régénérer après revue humaine |
| Internationalisation | FR/EN critiques, pluriels, formats, RTL préparé | **Partiel assumé** | Infra + surfaces critiques (connexion, progression, compte, navigation) ; 459 fichiers restants listés dans `docs/i18n/COVERAGE.md` |
| Performance web mobile | LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (terrain p75) | **Non vérifié** | Build mesuré ; aucune mesure terrain possible ici ; budgets non instrumentés |
| Coque native | Démarrage, mémoire, fluidité iPhone/Android | **Non vérifié** | Aucun appareil ni macOS ; `cleartext`/`allowMixedContent` séparés dev/release ; cycle de vie repris |
| Disponibilité 99,9 % / stabilité | Instrumentation et historique | **Non vérifié** | Dépend de la production ; healthcheck outbox livré (`scripts/ops/progression_outbox_health.mjs`) |
| Charge et coûts | Scénario 2× sur environnement de test autorisé | **Restant** | Scripts `ops:a15-load` existants à exécuter sur environnement dédié |
| Accessibilité WCAG 2.2 AA | Web + tests assistifs | **Partiel** | Contrastes mesurés ; tests a11y existants verts ; audit manuel VoiceOver/TalkBack non réalisé |
| Confidentialité | Position exacte exclue, consentement, export/suppression | **Vérifié localement** | `user_territory_private` inaccessible aux clients (pgTAP) ; parcours de consentement implémenté ; export/suppression existants |
| Stores | Règles, permissions, confidentialité, suppression de compte | **Restant** | `docs/mobile/STORES_CHECKLIST.md` à actualiser ; aucun build store produit |
| Déploiement | Flags, migration additive, restauration testée, retour arrière | **Partiel** | Migrations additives appliquées en base locale ; restauration non exécutée ; aucun déploiement |

## Limites déclarées

1. **Aucun déploiement, aucune migration distante, aucun push** n'ont été effectués.
2. Les validations natives iOS/Android, les mesures Web Vitals terrain et les tests de charge n'ont pas été exécutés faute d'environnement.
3. La chaîne `supabase start` à froid reste incomplète (migrations préexistantes 2026-07/28) ; la vérification SQL utilise la baseline officielle + migrations post-cutoff (`LOCAL_DB_TESTING.md`).
4. Deux migrations préexistantes ont été réparées de façon additive (`20260713240000`, `20260715120000`) pour permettre le rejeu ; aucun impact sur les bases déjà conformes.
5. Les baselines de régression visuelle doivent être régénérées après revue humaine des captures (non produites ici).
