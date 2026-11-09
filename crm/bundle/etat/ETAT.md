# État du chantier LKDV Control

Mis à jour : 2026-11-09 05:55 (Europe/Paris) — cycle 2

## En une phrase
Application CRM complète (30 routes) qui compile et se construit ; 18 migrations M00→M15 appliquées sans erreur sur une base locale reproduisant le schéma de production ; moteur de commandes vérifié (masquage + audit + notification + refus). Déploiement bloqué : pas de sauvegarde P4, pas de droit de création de projet Vercel.

## Phase en cours
Phase 0 — Préparation et point de référence · branche `crm/phase-0-preparation` · porte : CI verte + aperçu Vercel du CRM + références LKDV rangées + état base relevé

## Compteurs (preuves à l'appui)
| Élément | Fait / total | Bloqué par Tony |
| --- | --- | --- |
| Exigences `EX-…` | 24 / 88 (preuves locales) | 6 (P4, P5, P7, P8, P3, P10) |
| Actions `ACT-…` | 144 / 144 enregistrées et appelables (tests pgTAP/E2E à faire) | 0 |
| Commandes transverses `T-…` | 0 / 10 | 0 |
| Migrations M00–M15 appliquées en production | 0 / 16 (prêtes, testées localement) | 16 |
| Écrans conformes à la maquette | 8 / 8 livrés (captures authentifiées à faire) | — |
| Écarts ouverts (critique / haute / moyenne / basse) | 0 / 0 / 0 / 0 | — |

## Couches de vérification (dernier passage)
| # | Couche | Statut | Date | Preuve |
| --- | --- | --- | --- | --- |
| 1 | Statique | vert local | 2026-11-09 | `tsc --noEmit` 0 erreur, `next lint` 0 avertissement, `next build` OK |
| 2 | Unitaire | vert local | 2026-11-09 | 87+ tests Vitest (lib + serveur + contrat) |
| 3 | Base | vert local (shim) | 2026-11-09 | 18 migrations appliquées, 144 commandes, `run_command` prouvé |
| 4 | Contrat d'API | — | | |
| 5 | Accessibilité | — | | |
| 6 | Parité visuelle | — | | |
| 7 | Performance | — | | |
| 8 | Sécurité | — | | |
| 9 | E2E | — | | |
| 10 | Production | — | | |
| 11 | Audit indépendant | — | | |

## Dernière tâche terminée
T-0.02/0.03/0.04 — captures des 8 maquettes, état base relevé, socle applicatif (UI 30 routes + backend + tests)

## Prochaine tâche
T-1.03 — pgTAP + CI base éphémère ; puis application production après sauvegarde P4

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
