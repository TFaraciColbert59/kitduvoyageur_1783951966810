# MIGRATIONS GELÉES — SÉCURITÉ & PROTOCOLE LKDV

Ce dossier isole physiquement les migrations de base de données dont le déploiement est **strictement gelé** pour des raisons juridiques, fiscales ou de conformité.

## 1. Pourquoi ce dossier existe ?

La commande `supabase db push` applique **l'intégralité** des fichiers `.sql` présents dans `supabase/migrations/` dont le timestamp est manquant sur la base distante (`schema_migrations`). Elle n'offre aucune option d'inclusion ou d'exclusion unitaire de fichier.

Puisque les migrations du chantier « Orientation & Empreinte » (`20260904010000` et `20260904020000`) possèdent des timestamps postérieurs au Lot 6 (`20260903050000`), le maintien de la migration du Lot 6 dans `supabase/migrations/` provoquerait son **application automatique et irréversible** en production lors du premier `supabase db push`.

L'isolation physique dans ce répertoire `migrations_frozen/` est le **seul mécanisme garantissant le gel absolu** vis-à-vis du moteur de déploiement de Supabase CLI.

---

## 2. Contenu gelé : `20260903050000_kit_attributions.sql` (Lot 6)

- **Objet** : Partage de valeur, attribution de commissions, royalties créateurs et `store_credit_ledger`.
- **Motif du gel** :
  1. **Cadre juridique et fiscal non validé** : L'attribution de royalties aux créateurs de kits nécessite un statut légal (micro-entreprise, contrat d'apporteur d'affaires, régime des droits d'auteur ou marketplace agréée) et des déclarations fiscales automatisées qui ne sont pas en place.
  2. **Impossibilité de reversement** : En l'absence de module de paiement Stripe Connect ou de checkout imputant le store credit, la redistribution financière créerait une dette exigible sans moyen d'exécution.
- **Conditions de dégel** :
  - Validation juridique formelle par Tony du modèle de rétribution créateur.
  - Déploiement préalable de l'infrastructure de conformité fiscale.
  - Re-déplacement du fichier vers `supabase/migrations/` sous un timestamp actualisé.
