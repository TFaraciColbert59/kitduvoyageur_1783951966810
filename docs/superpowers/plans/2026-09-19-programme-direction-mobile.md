# Programme direction mobile et progression canonique — plan programme

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la progression réelle et serveur-autoritaire, livrer la direction produit mobile à cinq destinations, appliquer la direction visuelle, puis couvrir les exigences de lancement internationales vérifiables.

**Architecture:** Reward Engine unique étendu (gain canonique, décisions, outbox, projections reconstructibles), producteurs vérifiés côté serveur, classements territoriaux calculés hors transaction, navigation et UI honnêtes, i18n et exploitation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase/PostgreSQL 17 + PostGIS, pgTAP, Vitest, Playwright, Capacitor.

**Spec:** `docs/superpowers/specs/2026-09-19-lkdv-progression-canonique-direction-mobile-design.md`

## Global Constraints

- Un seul moteur : Reward Engine étendu ; aucune attribution cliente ; `auth.uid()` pour les appels utilisateur, rôle serveur explicite sinon ; UID nul n'autorise rien.
- Clé d'idempotence `<source>:<source_id>` sans `rules_version` ; décisions refusées conservées.
- Allocations stockées en montants par compétence, somme exacte = gain, arrondi déterministe.
- Outbox consommée de façon atomique (`FOR UPDATE SKIP LOCKED`), reprises et alertes.
- `FRAUD_REVERSAL` dans le ledger canonique, référence le gain original, suit l'outbox.
- Projection par `(user_id, season_id)` ; activité tardive dans la saison de grâce, jamais la courante.
- Aucune donnée de démonstration, aucun faux joueur, aucun défaut géographique ; inconnu ≠ zéro.
- Migrations additives ; soldes, droits et historique préservés ; aucun déploiement sans autorisation.
- Commandes de vérification du dépôt : `npm run type-check`, `npm run lint`, `npm test`, `npm run build`.
- Base de test locale (procédure éprouvée) :
  1. `docker run -d --name lkdv-test-db -e POSTGRES_PASSWORD=postgres -p 55432:5432 public.ecr.aws/supabase/postgres:17.6.1.141`
  2. Appliquer `supabase/baseline/prod_schema_20260911.sql`, puis `auth_integration.sql`, `grants.sql` (psql dans le conteneur).
  3. Appliquer les migrations de `supabase/migrations/` postérieures au baseline, dans l'ordre (dont `20260919_unified_progression_rankings.sql` et les migrations du présent programme).
  4. Tests SQL : `npx supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable" [chemin.test.sql]`
  - La chaîne `supabase start` à froid reste cassée par des migrations 2026-07/28 préexistantes (voir rapport final) ; la base de test locale n'en dépend pas.

## File structure (programme)

| Zone | Fichiers |
|---|---|
| Migrations | `supabase/migrations/20260920100000_progression_canonique.sql` → `20260920106000_*.sql` |
| Tests SQL | `supabase/tests/database/progression_canonique_*.test.sql` |
| Domaine | `src/features/progression/domain/*` (règles, types, classement, formats) |
| Serveur | `src/features/progression/server/*` (award, décisions, outbox, classement, rebuild) |
| Routes | `src/app/api/progression/*`, `src/app/api/cron/progression-outbox/route.ts` |
| UI | `src/components/progression/*`, `src/app/progression/*`, `src/app/materiel/*`, navigation `src/components/mobile-nav/*`, shell `src/components/shell/*` |
| Producteurs | `src/features/hiking/*`, `src/features/trips/*`, `src/features/materiel/*`, `src/features/places/*`, `src/features/community/*` |
| i18n | `src/lib/i18n/*`, `src/lib/i18n/translations/*` |
| Docs | `docs/progression/PRODUCER_MATRIX.md`, `docs/progression/LOCAL_DB_TESTING.md`, `docs/progression/LAUNCH_READINESS.md` |

## Phases

### P1 — Moteur canonique (plan détaillé : `2026-09-19-p1-moteur-canonique.md`)

Livrables : ledger étendu, décisions, outbox atomique, règles versionnées, projections par saison, rebuild, compensation, sécurité RLS/RPC, service et routes honnêtes, cron outbox, matrice producteurs.
Sortie : tests SQL 1–5/7–8 verts sur base locale, vitest service/routes verts, aucune donnée de démo.

### P2 — Producteurs

- Durcir les 3 producteurs existants (post publié, carnet à la publication, message groupe économie inchangée) et brancher les 4 prêts (session traitée, sentier préparé, débrief kit, avis de lieu).
- Compléter carnet publié, checklist complétée, voyage terminé (critères du spec 3.2).
- Tests : un événement = un gain ; somme des allocations ; producteurs désactivés inertes ; double claim concurrent.
- E2E : action réelle → gain unique → cohérence après rechargement.

### P3 — Classement territorial

- Agrégats + file de rafraîchissement idempotente, 5 filtres, pagination et voisins, seuil 5, états honnêtes.
- Territoire public/privé, consentement, verrou, changement plafonné, recherche manuelle de commune.
- 1 km serveur sous flag `local_leaderboard_active` OFF tant que les tests anti-triangulation ne passent pas.
- Tests : score identique selon filtre, confidentialité, sondage répété, comptes multiples.

### P4 — Produit et navigation

- Registre canonique des 5 destinations (Aventures, Explorer, Matériel, Communauté, Moi) ; libellés visibles, `aria-current`, 44 px, sous-nav 44 px, un seul `main`, échelle z-index, prefetch réseau.
- Surface `/materiel` d'entrée ; première vue Aventures à action dominante ; carte de progression compacte ; Ma progression à divulgation progressive ; fusion défis/distinctions/récompenses ; célébration après confirmation serveur.
- Correctifs M02–M10 + audit desktop (dates `/evenements`, DOM communauté, configurateur, accueil).
- Critère : zéro donnée fictive, captures avant/après, a11y des parcours touchés.

### P5 — Direction visuelle

- Tokens clair/sombre complets, typographie système + Manrope display, espacements et rayons, verre réservé au superposé, topographie sans texte essentiel.
- Contrastes mesurés, focus, mouvement réduit, chiffres tabulaires.
- Critère : captures avant/après desktop/mobile inspectées, tests de design existants verts.

### P6 — Internationalisation

- Infrastructure `src/lib/i18n` étendue (contexte locale, pluriels `Intl.PluralRules`, formats), FR défaut, EN complet sur surfaces critiques et clés introduites, pseudo-localisation +40 %, propriétés logiques.
- Critère : parcours critiques navigables FR/EN, rapport de couverture honnête.

### P7 — Lancement

- Budgets perf par route, mesures laboratoire, flags serveur étendus, healthcheck outbox, sauvegarde/restauration locale testée, runbook canari, docs stores.
- Critère : `docs/progression/LAUNCH_READINESS.md` reliant chaque exigence à une preuve ; non vérifié déclaré explicitement.

## Dépendances et règles d'exécution

- P2 dépend de P1 ; P3 dépend de P1 (projections) ; P4 peut démarrer après P1 (les écrans lisent des DTO honnêtes) ; P5 parallélisable après P4 ; P6 en continu ; P7 après P4–P6.
- Chaque phase : tests d'abord (TDD), commit par tâche, revue indépendante, captures et rapport.
- Aucun commit sur `main`, aucune publication, aucune migration distante.
