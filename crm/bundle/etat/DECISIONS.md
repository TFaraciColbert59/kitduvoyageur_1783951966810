# Décisions prises seul (ordinateur de bord)

Format : `templates/DECISION.md`. Les décisions « à montrer à Tony » sont reprises dans le rapport final.

## D-0001 — Worktree séparé pour le chantier CRM

- **Date** : 2026-11-09 · **Par** : orchestrateur · **Tâche** : T-0.01 · **Exigences** : EX-GEN-01
- **Contexte** : la copie de travail principale est sur `fix/carnet-404` avec 4 fichiers modifiés non commités (travail de Tony sur le carnet). Le chantier CRM ne doit pas les toucher ni les embarquer.
- **Options étudiées** :
  1. Travailler dans la copie existante — risque d'embarquer des changements non liés, branches mélangées.
  2. Créer un `git worktree` sur une nouvelle branche depuis `origin/main` — isolation totale, même dépôt, même remote.
- **Choix** : option 2 — worktree `/Users/fr168256/Documents/deepseek-harness/default-workspace/lkdv-control-work`, branche `crm/phase-0-preparation`.
- **Pourquoi** : n'altère pas l'état de Tony ; permet des commits propres par phase ; le bundle est copié dans `crm/bundle/`.
- **Alternative écartée** : travailler sur `main` directement (interdit : PR par phase).
- **Comment défaire** : `git worktree remove lkdv-control-work` et suppression de la branche.
- **À montrer à Tony** : non

## D-0002 — Base Postgres locale de vérification (shim du schéma de production)

- **Date** : 2026-11-09 · **Par** : orchestrateur · **Tâche** : T-1.02 · **Exigences** : EX-SEC-05, 07_VERIFICATION couche 3
- **Contexte** : pas de Docker ni de PostgreSQL sur la machine ; la CI GitHub est la seule base éphémère officielle, mais son cycle est lent et l'application ne peut pas être exercée sans base.
- **Options étudiées** :
  1. Attendre uniquement la CI — correct mais lent, impossible de prouver le moteur de commandes localement.
  2. Monter un PostgreSQL embarqué (paquet `embedded-postgres`) avec une copie **assainie** de la baseline de production (PostGIS remplacé par du texte, vues recréées), plus des doublures pour les tables ajoutées après la baseline.
- **Choix** : option 2, base strictement locale (`127.0.0.1:55432`), aucune donnée réelle, aucun accès réseau.
- **Pourquoi** : permet de prouver M00→M15, les 144 commandes, l'audit et les refus sans toucher la production ; la CI reste la preuve officielle (couche 3).
- **Alternative écartée** : créer un projet Supabase de test (coût et hors bundle).
- **Comment défaire** : supprimer `/tmp/pgtest`.
- **À montrer à Tony** : non

## D-0003 — `public.is_admin()` ne s'élargit pas aux responsables de pôle

- **Date** : 2026-11-09 · **Par** : base-de-donnees · **Tâche** : M02 · **Exigences** : EX-ROLE-03, EX-ROLE-05
- **Contexte** : élargir `is_admin()` aux responsables aurait donné à 7 pôles la lecture de `user_profiles` (e-mail, téléphone) via les policies existantes.
- **Choix** : `is_admin()` reste `admin_roles` (`super_admin`/`admin`) ; le garde-fou de `user_profiles` accepte « admin **ou** membre d'équipe » explicitement.
- **Pourquoi** : moindre privilège ; les responsables gardent leurs droits via `admin.staff_memberships`.
- **Défaire** : modifier la fonction et les policies dans une migration dédiée.
- **À montrer à Tony** : oui

## D-0004 — `public_profiles` reste `SECURITY DEFINER`

- **Date** : 2026-11-09 · **Par** : base-de-donnees · **Tâche** : M00 · **Exigences** : EX-SEC-05 ; contradiction partielle avec 03 § 2
- **Contexte** : `03_MODELE_DE_DONNEES.md` demande `security_invoker` sur `public_profiles` ; la vue est lue par le navigateur et `security_invoker` casserait `/profil/[id]` pour les visiteurs.
- **Choix** : la vue reste `SECURITY DEFINER`, mais elle n'expose plus `auth.users` (colonnes retirées) ; `hub_dashboard_kpis` passe bien en `security_invoker`.
- **Pourquoi** : ne pas casser LKDV (EX-LKDV-06) prime ; l'exposition d'`auth.users` est supprimée autrement.
- **Défaire** : `alter view public.public_profiles set (security_invoker = true)` puis corriger les lecteurs.
- **À montrer à Tony** : oui

## D-0005 — Acteur journalisé d'une action validée

- **Date** : 2026-11-09 · **Par** : base-de-donnees · **Tâche** : M04/M13 · **Exigences** : EX-SEC-01, EX-COM-01
- **Contexte** : une action à deux personnes a un demandeur et un approbateur ; `admin.audit_log` a une seule colonne `actor_id`.
- **Choix** : `actor_id` = demandeur, `second_approver_id` = approbateur, `solo` = true si auto-validation en mode solo.
- **Pourquoi** : trace complète des deux personnes ; le journal reste en ajout seul.
- **Défaire** : migration de renommage/`jsonb` si Tony préfère l'inverse.
- **À montrer à Tony** : non

## D-0006 — M15 ne supprime pas les anciens journaux

- **Date** : 2026-11-09 · **Par** : base-de-donnees · **Tâche** : M15 · **Exigences** : 03 § 2 (M15)
- **Contexte** : `AdminProductsManager.tsx` (LKDV) lit encore `admin_audit_logs`.
- **Choix** : aucune suppression ; pont vers `admin.audit_log`, colonnes marquées dépréciées.
- **Pourquoi** : ne pas casser LKDV ; la suppression attendra la preuve d'absence de lecteur.
- **Défaire** : migration dédiée après retrait du dernier lecteur.
- **À montrer à Tony** : oui
