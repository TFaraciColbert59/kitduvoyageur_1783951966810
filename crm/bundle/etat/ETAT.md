# État du chantier LKDV Control

Mis à jour : 2026-11-09 05:15 (Europe/Paris) — cycle 1

## En une phrase
Cycle 1 ouvert : bundle lu, dépôt cloné en worktree `lkdv-control-work` (branche `crm/phase-0-preparation`), base et outils relevés, socle en construction.

## Phase en cours
Phase 0 — Préparation et point de référence · branche `crm/phase-0-preparation` · porte : CI verte + aperçu Vercel du CRM + références LKDV rangées + état base relevé

## Compteurs (preuves à l'appui)
| Élément | Fait / total | Bloqué par Tony |
| --- | --- | --- |
| Exigences `EX-…` | 0 / 88 | 0 |
| Actions `ACT-…` | 0 / 144 | 0 |
| Commandes transverses `T-…` | 0 / 10 | 0 |
| Migrations M00–M15 appliquées en production | 0 / 16 | 0 |
| Écrans conformes à la maquette | 0 / 8 | — |
| Écarts ouverts (critique / haute / moyenne / basse) | 0 / 0 / 0 / 0 | — |

## Couches de vérification (dernier passage)
| # | Couche | Statut | Date | Preuve |
| --- | --- | --- | --- | --- |
| 1 | Statique | — | | |
| 2 | Unitaire | — | | |
| 3 | Base | — | | |
| 4 | Contrat d'API | — | | |
| 5 | Accessibilité | — | | |
| 6 | Parité visuelle | — | | |
| 7 | Performance | — | | |
| 8 | Sécurité | — | | |
| 9 | E2E | — | | |
| 10 | Production | — | | |
| 11 | Audit indépendant | — | | |

## Dernière tâche terminée
T-0.01 (en cours) — lecture du bundle, création de `etat/`

## Prochaine tâche
T-0.01 — captures de référence + inventaire base

## En attente de Tony
| Quoi | Pourquoi | Ce qu'il faut faire | Brique concernée | Depuis |
| --- | --- | --- | --- | --- |
| `SUPABASE_DB_URL` + `BACKUP_PASSPHRASE` (P4) | Sauvegarde obligatoire avant migration de production — vérifié : workflow `db-backup` → `ready=false` | Poser les deux secrets GitHub Actions puis relancer le workflow | Toutes les migrations (`crm/docs/MISE_EN_PRODUCTION.md`) | 2026-11-09 |
| Permission Vercel « créer un projet » (P3) | `create_deployment` → 403 « You don't have permission to create a project » | Autoriser la création du projet `lkdv-control` (ou le créer) | Déploiement du CRM | 2026-11-09 |
| `STRIPE_SECRET_KEY` test (P5) | Remboursements testés en mode test seulement | Poser la variable Vercel (Preview) | Remboursements Stripe | 2026-11-09 |
| `NVIDIA_API_KEY` (P7) | Agents IA | Recopier la valeur dans le projet Vercel `lkdv-control` | Agents IA | 2026-11-09 |
| `RESEND_API_KEY` (P8) | Alertes SOS / astreinte | Poser la variable Vercel | Alertes e-mail | 2026-11-09 |

## Production
- CRM : pas encore déployé
- LKDV : inchangé (main `2c22d49`)
- Dernière migration appliquée : aucune par ce chantier
