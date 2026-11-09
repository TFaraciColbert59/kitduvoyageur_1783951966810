# État du chantier LKDV Control

Mis à jour : 2026-11-09 18:15 (Europe/Paris) — cycle 4 (CI verte)

## En une phrase
Application CRM complète (30 routes) qui compile et se construit ; 18 migrations M00→M15 appliquées sans erreur sur une base locale reproduisant le schéma de production ; moteur de commandes vérifié (masquage + audit + notification + refus). Déploiement bloqué : pas de sauvegarde P4, pas de droit de création de projet Vercel.

## Phase en cours
Phase 0 — Préparation et point de référence · branche `crm/phase-0-preparation` · porte : CI verte + aperçu Vercel du CRM + références LKDV rangées + état base relevé

## Compteurs (preuves à l'appui)
| Élément | Fait / total | Bloqué par Tony |
| --- | --- | --- |
| Exigences `EX-…` | 14 prouvées / 88 ; 53 partielles ; 7 non prouvées (matrice `preuves/exigences/COUVERTURE_EX.md`) | 14 (P3, P4, P5-P8, P10) |
| Actions `ACT-…` | 144 / 144 au registre ; 121 avec effet porté ; 23 `domain_pending` (E-0010) | 0 |
| Commandes transverses `T-…` | 0 / 10 | 0 |
| Migrations M00–M15 appliquées en production | 0 / 19 fichiers (prêtes, testées sur base locale ; CI en cours) | 19 (P4) |
| Écrans conformes à la maquette | 0 / 8 capturés (6 / 48 captures) ; 8 écrans livrés et buildés | — |
| Écarts ouverts (critique / haute / moyenne / basse) | 3 / 5 / 5 / 1 (voir ECARTS.md) | — |

## Couches de vérification (dernier passage)
| # | Couche | Statut | Date | Preuve |
| --- | --- | --- | --- | --- |
| 1 | Statique | **vert (CI)** | 2026-11-09 | `tsc --noEmit` 0 erreur, `next lint` 0 avertissement, `next build` OK |
| 2 | Unitaire | **vert (CI)** | 2026-11-09 | 93 tests Vitest |
| 3 | Base | **vert (CI)** | 2026-11-09 | run [42661132343](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42661132343) : 19 migrations appliquées, 10 suites pgTAP vertes, rollback vert |
| 4 | Contrat d'API | — | | |
| 5 | Accessibilité | partiel | 2026-11-09 | 4 tests rouges corrigés (cibles 44 px) ; rejeu axe non archivé |
| 6 | Parité visuelle | partiel | 2026-11-09 | 6 / 48 captures (3 écrans publics ×2) ; 0 capture des 8 maquettes |
| 7 | Performance | non mesuré | | seuils écrits dans les tests |
| 8 | Sécurité | partiel | 2026-11-09 | grep secrets/écritures, advisors avant relevés ; banc d’injection non exécuté |
| 9 | E2E | non exécuté | | 21 fichiers écrits, 204 skips motivés (base migrée requise) |
| 10 | Production | bloqué | | P3/P4 |
| 11 | Audit indépendant | fait (audit-1) | 2026-11-09 | `preuves/audits/audit-1.md` — verdict NON |

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
