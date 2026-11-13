# Plan par phases — LKDV Control

Neuf phases, dans cet ordre. Une phase ne commence qu'après la porte de la précédente. Chaque phase = une branche `crm/phase-N-<nom>`, une pull request, une fusion dans `main` après la porte, un déploiement de production vérifié. Le détail des tâches est dans `tasks.json`.

## Phase 0 — Préparation et point de référence

1. Lire tout le bundle, `CLAUDE.md`, `DESIGN_SYSTEM.md`, `docs/compas/DESIGN_REFERENCE.md`, `src/styles/tokens.css`.
2. Créer `crm/bundle/etat/` depuis `templates/`.
3. **Point de référence LKDV** : lancer `npm run type-check`, `npm run lint`, `npm run test:unit`, `npm run test:e2e` (sur l'aperçu de `main`) et ranger les rapports dans `etat/preuves/reference/`. Ce sont les résultats « avant », à reproduire à l'identique « après ».
4. Relever l'état réel de la base (tables, policies, fonctions, advisors) et le comparer aux faits de `03_MODELE_DE_DONNEES.md` § 1. Toute différence → `ECARTS.md` + adaptation du plan.
5. Créer `crm/` (Next.js 15.5, mêmes versions que LKDV), le workflow `crm-ci.yml`, le projet Vercel `lkdv-control` (*Root Directory* `crm`), les variables d'environnement disponibles.
6. Mettre en place la base éphémère de CI avec le schéma de production (`supabase db dump --schema-only`) et pgTAP.

**Porte 0** : aperçu Vercel du CRM vide en ligne ; CI verte ; références LKDV rangées ; état de la base relevé.

## Phase 1 — Assainir la sécurité existante (M00)

Migration M00, tests, application en production avec sauvegarde, advisors. Vérifier que LKDV fonctionne (tests de référence identiques).

**Porte 1** : advisors sans erreur ; références LKDV identiques.

## Phase 2 — Socle `admin` (M01 à M04)

Schéma, contrôle d'accès avec MFA, journal immuable, motifs, pôles, agents (tables), registre des 144 commandes, demandes à 2 personnes, mode solo.

**Porte 2** : tests pgTAP de la matrice de droits 100 % verts ; les 6 super admins existants gardent leurs droits ; registre = 144 lignes conformes au catalogue.

## Phase 3 — Modération et statuts côté LKDV (M05, M06, M08, M12 partie LKDV)

États de modération, verrou de colonnes, politiques restrictives, statut des comptes, avertissements, recours ; notifications de modération et écran « Contester » dans LKDV ; abonnement temps réel au masquage.

**Porte 3** : tests RLS par rôle (anonyme, membre, auteur, équipe) verts sur les 8 tables ; tests LKDV de référence identiques ; un post masqué en base disparaît de LKDV en moins de 2 s (E2E).

## Phase 4 — Cœur du CRM

Connexion + double authentification + durées de session ; `AppShell`, navigation, barre de commande ; file « À traiter » temps réel (M07, M12) ; carte de décision ; validations et mode solo ; commandes des domaines D2, D3, D6, D9, D11, D14 (priorité P1) ; remboursement Stripe en mode test.

**Porte 4** : écrans 1, 2, 4, 7 conformes à la maquette (couche 6) ; actions P1 testées de bout en bout ; un remboursement test complet (demande → validation solo → Stripe test → journal → notification).

## Phase 5 — Toutes les autres actions

Fiche membre 360°, notes, consultations sensibles, documents d'identité (M09) ; support (M10) ; réglages, tâches, purge (M11) ; toutes les commandes restantes (M13) et les écrans de pôles, catalogue, contenus, IA, technique, journal.

**Porte 5** : 144/144 actions avec test E2E vert ; écrans 3 et 6 conformes à la maquette.

## Phase 6 — Agents IA

Comptes de service, file de travaux, plafonds, arrêt (M14) ; serveur MCP ; les 6 agents ; écran Équipe et agents ; banc d'injection (couche 8).

**Porte 6** : 0 action déclenchée par les 50 cas d'injection ; agents incapables de valider (tests base) ; écran 5 conforme.

## Phase 7 — Finitions et qualité

SOS et astreinte (écran 8, escalade, e-mail) ; bac à sable ; mesure (indicateurs, UMUX-Lite) ; accessibilité complète ; performance ; parité visuelle des 8 écrans ; checklist des 40 contrôles sur chaque écran.

**Porte 7** : couches 1 à 9 vertes sur l'aperçu.

## Phase 8 — Production, retrait de l'ancien admin, boucle finale

Retrait de `src/app/admin`, `src/app/api/admin`, `ADMIN_ROUTES` ; M15 (nettoyage) ; mise à jour de `CLAUDE.md` (EX-SEC-07, mention du CRM) ; déploiement de production du CRM et de LKDV ; couche 10 (production) et 11 (audit indépendant) ; boucle des écarts jusqu'à deux audits consécutifs sans nouvel écart ; rapport final.

**Porte finale** : `00_PROMPT_MAITRE.md` § 6.
