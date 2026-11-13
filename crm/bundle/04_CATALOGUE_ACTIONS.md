# Catalogue des actions — LKDV Control

144 actions métier en 19 domaines, plus 10 commandes transverses. Ce fichier est la **source** du registre `admin.commands` (migration M03) : l'interface, la barre de commande, le serveur MCP et les tests en sont générés. Toute action doit exister ici avant d'être codée.

## Règles communes à toutes les actions

- Chaque action est une commande `admin.cmd_<commande>` (ou une route serveur qui l'appelle, pour les effets externes).
- Chaque exécution écrit une ligne dans `admin.audit_log` (acteur, rôle, cible, motif, avant/après).
- Si la cible est un membre ou son contenu : notification au membre (texte `admin.member_notice`), sans révéler qui a décidé.
- **2 personnes** = demande puis validation par un second humain (`admin.requests`). En mode solo, le super admin valide lui-même en deux temps (EX-ROLE-07).
- **Motif** = code obligatoire de `admin.reason_codes` (ou motif métier pour les actions non disciplinaires).
- **Annul. 10 s** = bouton « Annuler » pendant 10 s (`admin.undo`).
- **Agent** : `propose` = un agent peut préparer l'action, un humain décide ; `lit` = lecture seule ; `—` = jamais.
- **Temps réel** : P1 alerte immédiate, P2 liste qui se met à jour, P3 à la demande.
- Rôle min : `membre` (membre du pôle), `resp.` (responsable du pôle), `SA` (super admin). Le super admin peut tout.

## Pôles

| Code | Pôle | Domaines |
| --- | --- | --- |
| CONF | Confiance | Publications, stories, carnets, clubs, groupes et messagerie, avis, voyages et sécurité, recours |
| MEMB | Membres | Comptes, support et notifications |
| COMM | Commerce | Marketplace, catalogue, commandes et paiements, lignées de kits |
| CONT | Contenus | Lieux et terrain, contenus et pays |
| PRIA | Produit et IA | IA et coûts, réglages |
| CROI | Croissance | Récompenses et progression, affiliation, campagnes |
| TECH | Technique | Système, tâches, erreurs, intégrations |

## D1 — Comptes et identité (MEMB)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-001 | member_view_360 | Ouvrir la fiche 360° | membre | — | — | — | lit | P2 |
| ACT-002 | member_update_profile | Modifier nom, pseudo, bio, avatar | membre | — | oui | oui | propose | P2 |
| ACT-003 | member_revoke_sessions | Forcer la déconnexion partout | membre | — | oui | — | — | P2 |
| ACT-004 | member_suspend | Suspendre (date de fin) | resp. | — | oui | oui | propose | P1 |
| ACT-005 | member_ban | Bannir (connexion refusée) | resp. | oui | oui | — | propose | P1 |
| ACT-006 | member_reactivate | Réactiver un compte | resp. | — | oui | — | — | P2 |
| ACT-007 | member_delete_gdpr | Supprimer le compte (RGPD, grâce 30 j) | resp. | oui | oui | — | — | P2 |
| ACT-008 | member_export_gdpr | Exporter les données (RGPD) | membre | — | oui | — | — | P3 |
| ACT-009 | member_set_staff_role | Changer le rôle d'équipe | SA | oui | oui | — | — | P2 |
| ACT-010 | member_adjust_trust | Ajuster le score de confiance | resp. | — | oui | oui | propose | P3 |
| ACT-011 | member_verify_age | Vérifier l'âge | membre | — | oui | — | — | P3 |
| ACT-012 | member_set_demo | Marquer comme compte démo | resp. | — | oui | oui | — | P3 |
| ACT-013 | member_revoke_share_links | Révoquer les liens de partage du profil | membre | — | oui | — | — | P3 |
| ACT-014 | member_view_blocks | Voir les blocages entre membres | membre | — | — | — | lit | P3 |

## D2 — Publications communauté (CONF)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-015 | post_report_resolve | Traiter un signalement de publication | membre | — | oui | oui | propose | P1 |
| ACT-016 | post_hide | Masquer une publication | membre | — | oui | oui | propose | P1 |
| ACT-017 | post_remove | Supprimer une publication (état `removed`) | resp. | — | oui | oui | — | P1 |
| ACT-018 | post_restore | Restaurer une publication | membre | — | oui | oui | — | P2 |
| ACT-019 | post_set_trending | Mettre en tendance / retirer | membre | — | — | oui | propose | P3 |
| ACT-020 | comment_hide | Masquer un commentaire | membre | — | oui | oui | propose | P1 |
| ACT-021 | comment_remove | Supprimer un commentaire | resp. | — | oui | oui | — | P1 |
| ACT-022 | comment_report_resolve | Traiter un signalement de commentaire | membre | — | oui | oui | propose | P1 |
| ACT-023 | post_media_remove | Retirer un média d'une publication | membre | — | oui | oui | propose | P1 |

## D3 — Stories (CONF)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-024 | story_moderate | Approuver ou rejeter une story | membre | — | oui | oui | propose | P1 |
| ACT-025 | story_remove | Retirer une story | membre | — | oui | oui | propose | P1 |
| ACT-026 | story_report_resolve | Traiter un signalement de story | membre | — | oui | oui | propose | P1 |
| ACT-027 | story_comment_remove | Supprimer un commentaire de story | membre | — | oui | oui | propose | P2 |
| ACT-028 | story_purge_expired | Purger les stories expirées | resp. | — | — | — | — | P3 |

## D4 — Carnets (CONF)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-029 | carnet_force_private | Forcer un carnet en privé | membre | — | oui | oui | propose | P2 |
| ACT-030 | carnet_set_verified | Donner ou retirer « vérifié » | resp. | — | — | oui | propose | P3 |
| ACT-031 | carnet_comment_remove | Supprimer un commentaire (carnet, jour, moment) | membre | — | oui | oui | propose | P2 |
| ACT-032 | carnet_media_remove | Retirer un média de carnet | membre | — | oui | oui | propose | P2 |
| ACT-033 | carnet_stop_live | Couper le partage de position en direct | membre | — | oui | — | — | P1 |
| ACT-034 | carnet_list_reported | Voir les carnets signalés | membre | — | — | — | lit | P2 |

## D5 — Clubs (CONF)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-035 | club_set_verified | Vérifier un club | resp. | — | — | oui | — | P3 |
| ACT-036 | club_suspend | Suspendre ou fermer un club | resp. | oui | oui | — | — | P2 |
| ACT-037 | club_transfer_ownership | Transférer la propriété | resp. | oui | oui | — | — | P3 |
| ACT-038 | club_topic_moderate | Approuver ou retirer un sujet | membre | — | oui | oui | propose | P2 |
| ACT-039 | club_topic_pin | Épingler ou passer en annonce | membre | — | — | oui | — | P3 |
| ACT-040 | club_reply_moderate | Approuver une réponse | membre | — | oui | oui | propose | P2 |
| ACT-041 | club_report_resolve | Traiter un signalement de club | membre | — | oui | oui | propose | P1 |
| ACT-042 | club_member_remove | Retirer un membre d'un club | membre | — | oui | oui | — | P2 |
| ACT-043 | club_event_cancel | Annuler un événement de club | resp. | — | oui | — | — | P2 |

## D6 — Groupes, tribus, messagerie (CONF)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-044 | group_report_resolve | Traiter un signalement de groupe ou de membre | membre | — | oui | oui | propose | P1 |
| ACT-045 | member_suspend_groups | Suspendre un membre des groupes | resp. | — | oui | oui | propose | P1 |
| ACT-046 | group_dissolve | Dissoudre un groupe | resp. | oui | oui | — | — | P2 |
| ACT-047 | group_member_remove | Retirer un membre d'un groupe | membre | — | oui | oui | — | P2 |
| ACT-048 | message_remove | Supprimer un message (`deleted_at`) | membre | — | oui | oui | propose | P1 |
| ACT-049 | conversation_read_reported | Lire une conversation signalée (accès motivé, limité, journalisé) | resp. | — | oui | — | — | P3 |
| ACT-050 | attachment_remove | Retirer une pièce jointe | membre | — | oui | oui | propose | P1 |
| ACT-051 | crew_dissolve | Dissoudre une tribu | resp. | oui | oui | — | — | P2 |

## D7 — Lieux et terrain (CONT)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-052 | place_set_verified | Vérifier un lieu | membre | — | — | oui | propose | P3 |
| ACT-053 | place_merge | Fusionner des doublons | resp. | — | oui | — | propose | P3 |
| ACT-054 | place_update | Corriger un lieu | membre | — | oui | oui | propose | P3 |
| ACT-055 | place_review_remove | Supprimer un avis de lieu | membre | — | oui | oui | propose | P2 |
| ACT-056 | place_photo_set | Retirer ou mettre en avant une photo | membre | — | oui | oui | propose | P2 |
| ACT-057 | place_report_resolve | Traiter un signalement de lieu (`resolve_place_report`) | membre | — | oui | oui | propose | P2 |
| ACT-058 | terrain_report_decide | Valider ou expirer un signalement terrain | membre | — | oui | oui | propose | P1 |
| ACT-059 | map_point_verify | Vérifier refuges, sommets, points d'eau | membre | — | — | oui | propose | P3 |
| ACT-060 | contribution_decide | Valider ou refuser une contribution (lot possible) | membre | — | oui | oui | propose | P2 |

## D8 — Avis et questions (CONF)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-061 | product_review_hide | Masquer un avis produit | membre | — | oui | oui | propose | P2 |
| ACT-062 | product_review_verify | Confirmer « achat vérifié » | membre | — | — | oui | propose | P3 |
| ACT-063 | review_remove | Supprimer un avis | resp. | — | oui | oui | — | P2 |
| ACT-064 | qa_moderate | Modérer une question ou une réponse | membre | — | oui | oui | propose | P2 |
| ACT-065 | ama_schedule | Programmer un AMA | membre | — | — | oui | — | P3 |
| ACT-066 | ama_question_moderate | Modérer une question d'AMA | membre | — | oui | oui | propose | P2 |

## D9 — Marketplace et occasion (COMM)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-067 | listing_approve | Valider une annonce (`marketplace_moderate`) | membre | — | — | oui | propose | P1 |
| ACT-068 | listing_reject | Rejeter une annonce | membre | — | oui | oui | propose | P1 |
| ACT-069 | listing_withdraw | Retirer une annonce | membre | — | oui | oui | propose | P1 |
| ACT-070 | marketplace_report_resolve | Traiter un signalement marketplace | membre | — | oui | oui | propose | P1 |
| ACT-071 | dispute_arbitrate | Arbitrer un litige | resp. | oui | oui | — | propose | P1 |
| ACT-072 | seller_payout_release | Libérer le paiement d'un vendeur | resp. | oui | oui | — | propose | P1 |
| ACT-073 | auction_offer_cancel | Annuler une enchère ou une offre | membre | — | oui | — | — | P2 |
| ACT-074 | rental_manage | Gérer une location (statut, caution) | membre | — | oui | — | — | P2 |

## D10 — Catalogue (COMM)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-075 | product_upsert | Créer, modifier, retirer un produit | membre | — | — | oui | propose | P3 |
| ACT-076 | product_price_set | Changer un prix ou une promotion | resp. | oui | oui | — | propose | P3 |
| ACT-077 | stock_move | Enregistrer un mouvement de stock | membre | — | oui | oui | — | P3 |
| ACT-078 | product_images_set | Gérer les images d'un produit | membre | — | — | oui | — | P3 |
| ACT-079 | product_relations_set | Alternatives et compatibilités | membre | — | — | oui | propose | P3 |
| ACT-080 | kit_feature_set | Kits en vedette | membre | — | — | oui | — | P3 |
| ACT-081 | gear_function_review | Valider les fonctions d'équipement | membre | — | — | oui | propose | P3 |
| ACT-082 | one_catalog_manage | Catalogue One (pièces, coloris) | membre | — | — | oui | — | P3 |

## D11 — Commandes et paiements (COMM)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-083 | order_confirm | Confirmer une commande | membre | — | — | oui | propose | P1 |
| ACT-084 | order_ship | Expédier (transporteur, suivi) | membre | — | — | oui | — | P2 |
| ACT-085 | order_refund | Rembourser (Stripe) — **tout montant** | membre | oui | oui | — | propose | P1 |
| ACT-086 | order_cancel | Annuler une commande (avec remboursement si payée) | resp. | oui | oui | — | propose | P1 |
| ACT-087 | stripe_event_replay | Rejouer un webhook Stripe en échec | resp. | — | oui | — | — | P2 |
| ACT-088 | promo_code_manage | Créer ou couper un code promo | resp. | oui | oui | — | — | P3 |
| ACT-089 | booking_manage | Gérer une réservation | membre | — | oui | — | propose | P2 |
| ACT-090 | preorder_manage | Gérer une précommande One | membre | — | oui | — | — | P2 |
| ACT-091 | entitlement_grant | Attribuer un droit ou un pass | resp. | oui | oui | — | — | P3 |

## D12 — Récompenses et progression (CROI)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-092 | withdrawal_decide | Valider ou refuser un retrait (`process_withdrawal`) | membre | oui | oui | — | propose | P1 |
| ACT-093 | reward_balance_correct | Corriger un solde (écriture compensatoire) | resp. | oui | oui | — | — | P2 |
| ACT-094 | progression_event_reverse | Annuler un événement de progression | membre | — | oui | — | propose | P3 |
| ACT-095 | progression_rules_publish | Publier un barème | resp. | oui | oui | — | — | P3 |
| ACT-096 | season_open_close | Ouvrir ou clore une saison | resp. | — | oui | — | — | P3 |
| ACT-097 | badge_create | Créer un badge | membre | — | — | oui | — | P3 |
| ACT-098 | badge_award_revoke | Attribuer ou retirer un badge | membre | — | oui | oui | propose | P3 |
| ACT-099 | challenge_create | Créer un défi | membre | — | — | oui | — | P3 |
| ACT-100 | reward_config_edit | Modifier la configuration des récompenses | resp. | oui | oui | — | — | P3 |
| ACT-101 | store_credit_grant | Créditer la boutique manuellement | resp. | oui | oui | — | — | P2 |

## D13 — Lignées de kits (COMM)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-102 | kit_set_souche | Désigner un kit souche | resp. | — | oui | oui | — | P3 |
| ACT-103 | kit_unpublish | Dépublier un kit | membre | — | oui | oui | propose | P3 |
| ACT-104 | kit_attribution_void | Annuler une attribution frauduleuse | resp. | oui | oui | — | propose | P3 |
| ACT-105 | royalty_share_freeze | Geler une part créateur | resp. | — | oui | oui | propose | P3 |
| ACT-106 | royalty_config_edit | Modifier `royalty_config` | SA | oui | oui | — | — | P3 |
| ACT-107 | kit_scores_refresh | Recalculer les scores de confiance | membre | — | — | — | — | P3 |

## D14 — Voyages et sécurité (CONF, sauf mention)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-108 | sos_board | Suivre les SOS | membre | — | — | — | lit | P1 |
| ACT-109 | sos_ack_close | « Je prends », puis clore un SOS | membre | — | oui | — | — | P1 |
| ACT-110 | checkpoints_overdue | Voir les points de contrôle en retard | membre | — | — | — | lit | P1 |
| ACT-111 | trip_unpublish | Dépublier un voyage public | membre | — | oui | oui | propose | P2 |
| ACT-112 | hike_session_reprocess | Relancer le traitement d'une sortie (TECH) | membre | — | — | — | propose | P3 |
| ACT-113 | adventure_event_retry | Relancer un événement d'aventure en échec (TECH) | membre | — | — | — | propose | P3 |

## D15 — Contenus et pays (CONT)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-114 | country_content_review | Relire et valider une fiche pays | membre | — | — | oui | propose | P3 |
| ACT-115 | country_guide_regenerate | Régénérer un guide | membre | — | — | — | propose | P3 |
| ACT-116 | guide_publish | Publier un guide | resp. | — | — | oui | — | P3 |
| ACT-117 | content_feature | Mettre en avant | membre | — | — | oui | — | P3 |
| ACT-118 | ambassador_decide | Valider un ambassadeur | resp. | — | oui | — | — | P3 |
| ACT-119 | expert_decide | Valider un expert | resp. | — | oui | — | — | P3 |
| ACT-120 | coverage_dataset_publish | Publier ou annuler un jeu de couverture | resp. | oui | oui | — | — | P3 |
| ACT-121 | route_revision_fix | Corriger un tracé (nouvelle révision) | membre | — | oui | oui | propose | P3 |

## D16 — Affiliation (CROI)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-122 | affiliate_partner_toggle | Activer ou couper un partenaire | resp. | — | oui | oui | — | P3 |
| ACT-123 | affiliate_program_toggle | Activer ou couper un programme | resp. | — | oui | oui | — | P3 |
| ACT-124 | affiliate_offer_toggle | Activer ou couper une offre | membre | — | oui | oui | — | P3 |
| ACT-125 | affiliate_conversion_validate | Valider une conversion | resp. | oui | oui | — | propose | P3 |
| ACT-126 | affiliate_clicks_view | Voir les clics | membre | — | — | — | lit | P3 |

## D17 — IA et coûts (PRIA)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-127 | ai_usage_view | Voir la consommation IA | membre | — | — | — | lit | P2 |
| ACT-128 | ai_quota_raise | Relever le quota d'une personne | resp. | — | oui | oui | — | P3 |
| ACT-129 | ai_kill_switch | Couper ou rallumer l'IA du site | resp. | — | oui | — | — | P1 |
| ACT-130 | ai_cache_clear | Vider le cache IA | membre | — | oui | — | — | P3 |
| ACT-131 | ai_job_retry | Relancer un job IA en échec | membre | — | — | — | propose | P3 |

## D18 — Support et notifications (MEMB)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-132 | ticket_reply | Répondre à un ticket | membre | — | — | oui | propose | P1 |
| ACT-133 | ticket_set_status | Changer le statut d'un ticket | membre | — | — | oui | propose | P2 |
| ACT-134 | announcement_send | Envoyer une annonce ciblée (CROI) | resp. | oui | oui | — | propose | P3 |
| ACT-135 | delivery_failures_view | Voir les envois en échec | membre | — | — | — | lit | P2 |
| ACT-136 | alert_resolve | Résoudre une alerte (TECH) | membre | — | oui | — | propose | P2 |

## D19 — Système et équipe (TECH, sauf mention)

| ID | Commande | Action | Rôle min | 2 personnes | Motif | Annul. 10 s | Agent | Temps réel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-137 | feature_flag_toggle | Basculer un indicateur | resp. | — | oui | oui | — | P2 |
| ACT-138 | feature_cohort_manage | Gérer une cohorte | resp. | — | oui | oui | — | P3 |
| ACT-139 | errors_view | Voir les erreurs | membre | — | — | — | lit | P2 |
| ACT-140 | daily_report_view | Lire le rapport du jour | membre | — | — | — | lit | P3 |
| ACT-141 | cron_run_now | Lancer une tâche planifiée | resp. | — | oui | — | propose | P2 |
| ACT-142 | rate_limit_lift | Lever une limite de débit | resp. | — | oui | — | — | P3 |
| ACT-143 | audit_log_view | Lire le journal d'audit | resp. | — | — | — | — | P2 |
| ACT-144 | staff_manage | Inviter, changer le rôle, révoquer un membre d'équipe ou un agent (SA) | SA | oui | oui | — | — | P2 |

## Commandes transverses

| ID | Commande | Rôle | Usage |
| --- | --- | --- | --- |
| T-01 | approve_request / reject_request | Selon `admin.can` | Valider ou refuser une demande à 2 personnes |
| T-02 | undo | Auteur de l'action | Annuler dans les 10 s |
| T-03 | elevate | Membre de pôle | Droit temporaire hors de son pôle, 1 h, motif |
| T-04 | appeal_decide | Autre que le décideur (solo : SA) | Trancher un recours DSA |
| T-05 | strike_add / strike_expire | Selon l'action | Gestion des avertissements |
| T-06 | reveal_pii | membre (+ journal) | Afficher e-mail, téléphone |
| T-07 | open_identity_document | SA seul | Document d'identité, motif, 15 min |
| T-08 | agent_stop / agent_stop_all | resp. / SA | Arrêt d'un ou de tous les agents |
| T-09 | note_add | membre | Note interne sur un membre |
| T-10 | settings_edit | resp. PRIA / SA | `admin.app_settings` |
