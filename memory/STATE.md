# STATE.md — État Vivant & Pile de Pivots LKDV
<!-- Budget max : 80 lignes | Mis à jour automatiquement en fin de tâche ou lors d'un pivot -->
_Dernière mise à jour : 2026-11-28_

## Focus Actuel
- Environnement de développement unifié `~/LKDV/` actif (`repo/`, `worktrees/`, `library/`, `scripts/`).
- `CLAUDE.md`, `AGENTS.md`, `memory/` et nouvelle Bible Design (`Carnets` + `Clubs`) déployés.
- **Prochaine étape prévue** : Construction de la bibliothèque complète LKDV dans `~/LKDV/library/`.

## Tâches en Pause (Reprise Rapide après Pivot)
- **Explorer v2** (en pause volontaire) : 6 onglets + Studio Analyse Avancée 6 volets + Handoff universel livrés & vérifiés. Note cosmétique mineure optionnelle : mapper `'rando'` sans `variantId` dans `resolveActivityProfile` pour éviter le sous-titre `Saisie manuelle & Import`.
- **GitHub push** : Commits locaux propres sur `main` prêts à être poussés sur `origin/main` à la demande.
- **Supabase revue ultérieure** : 5 tables sans appelant `src/` contenant des données (`activity_catalog_metrics`, `user_documents`, `user_addresses`, `segment_condition_buckets`, `club_reports`) + optimisation des 6 GLB lourds dans `bag-models` (208 Mo).

## Slots Multi-Agents Actifs (`~/LKDV/worktrees/`)
- _(Aucun slot parallèle ouvert — utiliser `~/LKDV/scripts/spawn-agent-slot.sh <nom>` pour en créer un.)_
