-- ═══════════════════════════════════════════════════════════════════════════
-- M03 — crm_commands_registry  (03_MODELE_DE_DONNEES.md § 2)
-- GÉNÉRÉ par crm/scripts/gen-commands.mjs depuis crm/bundle/04_CATALOGUE_ACTIONS.md.
-- NE PAS ÉDITER À LA MAIN : régénérer le script (source unique du registre).
--
-- Le registre pilote tout : la barre de commande, les formulaires, le serveur
-- MCP et les tests. Toute différence entre ce fichier et le catalogue est un
-- écart (07_VERIFICATION.md § 3, crm/scripts/catalog-diff.mjs).
--
-- 144 commandes, 7 pôles.
-- Idempotent : insert … on conflict (id) do update.
-- ═══════════════════════════════════════════════════════════════════════════

insert into admin.commands (
  id, command, label, domain, pole_code, role_min,
  needs_validation, reason_required, undoable, agent_allowed, realtime, sort
) values
  ('ACT-001', 'member_view_360', 'Ouvrir la fiche 360°', 'D1', 'MEMB', 'membre', false, false, false, 'read', 'P2', 10),
  ('ACT-002', 'member_update_profile', 'Modifier nom, pseudo, bio, avatar', 'D1', 'MEMB', 'membre', false, true, true, 'propose', 'P2', 20),
  ('ACT-003', 'member_revoke_sessions', 'Forcer la déconnexion partout', 'D1', 'MEMB', 'membre', false, true, false, 'never', 'P2', 30),
  ('ACT-004', 'member_suspend', 'Suspendre (date de fin)', 'D1', 'MEMB', 'responsable', false, true, true, 'propose', 'P1', 40),
  ('ACT-005', 'member_ban', 'Bannir (connexion refusée)', 'D1', 'MEMB', 'responsable', true, true, false, 'propose', 'P1', 50),
  ('ACT-006', 'member_reactivate', 'Réactiver un compte', 'D1', 'MEMB', 'responsable', false, true, false, 'never', 'P2', 60),
  ('ACT-007', 'member_delete_gdpr', 'Supprimer le compte (RGPD, grâce 30 j)', 'D1', 'MEMB', 'responsable', true, true, false, 'never', 'P2', 70),
  ('ACT-008', 'member_export_gdpr', 'Exporter les données (RGPD)', 'D1', 'MEMB', 'membre', false, true, false, 'never', 'P3', 80),
  ('ACT-009', 'member_set_staff_role', 'Changer le rôle d''équipe', 'D1', 'MEMB', 'super_admin', true, true, false, 'never', 'P2', 90),
  ('ACT-010', 'member_adjust_trust', 'Ajuster le score de confiance', 'D1', 'MEMB', 'responsable', false, true, true, 'propose', 'P3', 100),
  ('ACT-011', 'member_verify_age', 'Vérifier l''âge', 'D1', 'MEMB', 'membre', false, true, false, 'never', 'P3', 110),
  ('ACT-012', 'member_set_demo', 'Marquer comme compte démo', 'D1', 'MEMB', 'responsable', false, true, true, 'never', 'P3', 120),
  ('ACT-013', 'member_revoke_share_links', 'Révoquer les liens de partage du profil', 'D1', 'MEMB', 'membre', false, true, false, 'never', 'P3', 130),
  ('ACT-014', 'member_view_blocks', 'Voir les blocages entre membres', 'D1', 'MEMB', 'membre', false, false, false, 'read', 'P3', 140),
  ('ACT-015', 'post_report_resolve', 'Traiter un signalement de publication', 'D2', 'CONF', 'membre', false, true, true, 'propose', 'P1', 150),
  ('ACT-016', 'post_hide', 'Masquer une publication', 'D2', 'CONF', 'membre', false, true, true, 'propose', 'P1', 160),
  ('ACT-017', 'post_remove', 'Supprimer une publication (état `removed`)', 'D2', 'CONF', 'responsable', false, true, true, 'never', 'P1', 170),
  ('ACT-018', 'post_restore', 'Restaurer une publication', 'D2', 'CONF', 'membre', false, true, true, 'never', 'P2', 180),
  ('ACT-019', 'post_set_trending', 'Mettre en tendance / retirer', 'D2', 'CONF', 'membre', false, false, true, 'propose', 'P3', 190),
  ('ACT-020', 'comment_hide', 'Masquer un commentaire', 'D2', 'CONF', 'membre', false, true, true, 'propose', 'P1', 200),
  ('ACT-021', 'comment_remove', 'Supprimer un commentaire', 'D2', 'CONF', 'responsable', false, true, true, 'never', 'P1', 210),
  ('ACT-022', 'comment_report_resolve', 'Traiter un signalement de commentaire', 'D2', 'CONF', 'membre', false, true, true, 'propose', 'P1', 220),
  ('ACT-023', 'post_media_remove', 'Retirer un média d''une publication', 'D2', 'CONF', 'membre', false, true, true, 'propose', 'P1', 230),
  ('ACT-024', 'story_moderate', 'Approuver ou rejeter une story', 'D3', 'CONF', 'membre', false, true, true, 'propose', 'P1', 240),
  ('ACT-025', 'story_remove', 'Retirer une story', 'D3', 'CONF', 'membre', false, true, true, 'propose', 'P1', 250),
  ('ACT-026', 'story_report_resolve', 'Traiter un signalement de story', 'D3', 'CONF', 'membre', false, true, true, 'propose', 'P1', 260),
  ('ACT-027', 'story_comment_remove', 'Supprimer un commentaire de story', 'D3', 'CONF', 'membre', false, true, true, 'propose', 'P2', 270),
  ('ACT-028', 'story_purge_expired', 'Purger les stories expirées', 'D3', 'CONF', 'responsable', false, false, false, 'never', 'P3', 280),
  ('ACT-029', 'carnet_force_private', 'Forcer un carnet en privé', 'D4', 'CONF', 'membre', false, true, true, 'propose', 'P2', 290),
  ('ACT-030', 'carnet_set_verified', 'Donner ou retirer « vérifié »', 'D4', 'CONF', 'responsable', false, false, true, 'propose', 'P3', 300),
  ('ACT-031', 'carnet_comment_remove', 'Supprimer un commentaire (carnet, jour, moment)', 'D4', 'CONF', 'membre', false, true, true, 'propose', 'P2', 310),
  ('ACT-032', 'carnet_media_remove', 'Retirer un média de carnet', 'D4', 'CONF', 'membre', false, true, true, 'propose', 'P2', 320),
  ('ACT-033', 'carnet_stop_live', 'Couper le partage de position en direct', 'D4', 'CONF', 'membre', false, true, false, 'never', 'P1', 330),
  ('ACT-034', 'carnet_list_reported', 'Voir les carnets signalés', 'D4', 'CONF', 'membre', false, false, false, 'read', 'P2', 340),
  ('ACT-035', 'club_set_verified', 'Vérifier un club', 'D5', 'CONF', 'responsable', false, false, true, 'never', 'P3', 350),
  ('ACT-036', 'club_suspend', 'Suspendre ou fermer un club', 'D5', 'CONF', 'responsable', true, true, false, 'never', 'P2', 360),
  ('ACT-037', 'club_transfer_ownership', 'Transférer la propriété', 'D5', 'CONF', 'responsable', true, true, false, 'never', 'P3', 370),
  ('ACT-038', 'club_topic_moderate', 'Approuver ou retirer un sujet', 'D5', 'CONF', 'membre', false, true, true, 'propose', 'P2', 380),
  ('ACT-039', 'club_topic_pin', 'Épingler ou passer en annonce', 'D5', 'CONF', 'membre', false, false, true, 'never', 'P3', 390),
  ('ACT-040', 'club_reply_moderate', 'Approuver une réponse', 'D5', 'CONF', 'membre', false, true, true, 'propose', 'P2', 400),
  ('ACT-041', 'club_report_resolve', 'Traiter un signalement de club', 'D5', 'CONF', 'membre', false, true, true, 'propose', 'P1', 410),
  ('ACT-042', 'club_member_remove', 'Retirer un membre d''un club', 'D5', 'CONF', 'membre', false, true, true, 'never', 'P2', 420),
  ('ACT-043', 'club_event_cancel', 'Annuler un événement de club', 'D5', 'CONF', 'responsable', false, true, false, 'never', 'P2', 430),
  ('ACT-044', 'group_report_resolve', 'Traiter un signalement de groupe ou de membre', 'D6', 'CONF', 'membre', false, true, true, 'propose', 'P1', 440),
  ('ACT-045', 'member_suspend_groups', 'Suspendre un membre des groupes', 'D6', 'CONF', 'responsable', false, true, true, 'propose', 'P1', 450),
  ('ACT-046', 'group_dissolve', 'Dissoudre un groupe', 'D6', 'CONF', 'responsable', true, true, false, 'never', 'P2', 460),
  ('ACT-047', 'group_member_remove', 'Retirer un membre d''un groupe', 'D6', 'CONF', 'membre', false, true, true, 'never', 'P2', 470),
  ('ACT-048', 'message_remove', 'Supprimer un message (`deleted_at`)', 'D6', 'CONF', 'membre', false, true, true, 'propose', 'P1', 480),
  ('ACT-049', 'conversation_read_reported', 'Lire une conversation signalée (accès motivé, limité, journalisé)', 'D6', 'CONF', 'responsable', false, true, false, 'never', 'P3', 490),
  ('ACT-050', 'attachment_remove', 'Retirer une pièce jointe', 'D6', 'CONF', 'membre', false, true, true, 'propose', 'P1', 500),
  ('ACT-051', 'crew_dissolve', 'Dissoudre une tribu', 'D6', 'CONF', 'responsable', true, true, false, 'never', 'P2', 510),
  ('ACT-052', 'place_set_verified', 'Vérifier un lieu', 'D7', 'CONT', 'membre', false, false, true, 'propose', 'P3', 520),
  ('ACT-053', 'place_merge', 'Fusionner des doublons', 'D7', 'CONT', 'responsable', false, true, false, 'propose', 'P3', 530),
  ('ACT-054', 'place_update', 'Corriger un lieu', 'D7', 'CONT', 'membre', false, true, true, 'propose', 'P3', 540),
  ('ACT-055', 'place_review_remove', 'Supprimer un avis de lieu', 'D7', 'CONT', 'membre', false, true, true, 'propose', 'P2', 550),
  ('ACT-056', 'place_photo_set', 'Retirer ou mettre en avant une photo', 'D7', 'CONT', 'membre', false, true, true, 'propose', 'P2', 560),
  ('ACT-057', 'place_report_resolve', 'Traiter un signalement de lieu (`resolve_place_report`)', 'D7', 'CONT', 'membre', false, true, true, 'propose', 'P2', 570),
  ('ACT-058', 'terrain_report_decide', 'Valider ou expirer un signalement terrain', 'D7', 'CONT', 'membre', false, true, true, 'propose', 'P1', 580),
  ('ACT-059', 'map_point_verify', 'Vérifier refuges, sommets, points d''eau', 'D7', 'CONT', 'membre', false, false, true, 'propose', 'P3', 590),
  ('ACT-060', 'contribution_decide', 'Valider ou refuser une contribution (lot possible)', 'D7', 'CONT', 'membre', false, true, true, 'propose', 'P2', 600),
  ('ACT-061', 'product_review_hide', 'Masquer un avis produit', 'D8', 'CONF', 'membre', false, true, true, 'propose', 'P2', 610),
  ('ACT-062', 'product_review_verify', 'Confirmer « achat vérifié »', 'D8', 'CONF', 'membre', false, false, true, 'propose', 'P3', 620),
  ('ACT-063', 'review_remove', 'Supprimer un avis', 'D8', 'CONF', 'responsable', false, true, true, 'never', 'P2', 630),
  ('ACT-064', 'qa_moderate', 'Modérer une question ou une réponse', 'D8', 'CONF', 'membre', false, true, true, 'propose', 'P2', 640),
  ('ACT-065', 'ama_schedule', 'Programmer un AMA', 'D8', 'CONF', 'membre', false, false, true, 'never', 'P3', 650),
  ('ACT-066', 'ama_question_moderate', 'Modérer une question d''AMA', 'D8', 'CONF', 'membre', false, true, true, 'propose', 'P2', 660),
  ('ACT-067', 'listing_approve', 'Valider une annonce (`marketplace_moderate`)', 'D9', 'COMM', 'membre', false, false, true, 'propose', 'P1', 670),
  ('ACT-068', 'listing_reject', 'Rejeter une annonce', 'D9', 'COMM', 'membre', false, true, true, 'propose', 'P1', 680),
  ('ACT-069', 'listing_withdraw', 'Retirer une annonce', 'D9', 'COMM', 'membre', false, true, true, 'propose', 'P1', 690),
  ('ACT-070', 'marketplace_report_resolve', 'Traiter un signalement marketplace', 'D9', 'COMM', 'membre', false, true, true, 'propose', 'P1', 700),
  ('ACT-071', 'dispute_arbitrate', 'Arbitrer un litige', 'D9', 'COMM', 'responsable', true, true, false, 'propose', 'P1', 710),
  ('ACT-072', 'seller_payout_release', 'Libérer le paiement d''un vendeur', 'D9', 'COMM', 'responsable', true, true, false, 'propose', 'P1', 720),
  ('ACT-073', 'auction_offer_cancel', 'Annuler une enchère ou une offre', 'D9', 'COMM', 'membre', false, true, false, 'never', 'P2', 730),
  ('ACT-074', 'rental_manage', 'Gérer une location (statut, caution)', 'D9', 'COMM', 'membre', false, true, false, 'never', 'P2', 740),
  ('ACT-075', 'product_upsert', 'Créer, modifier, retirer un produit', 'D10', 'COMM', 'membre', false, false, true, 'propose', 'P3', 750),
  ('ACT-076', 'product_price_set', 'Changer un prix ou une promotion', 'D10', 'COMM', 'responsable', true, true, false, 'propose', 'P3', 760),
  ('ACT-077', 'stock_move', 'Enregistrer un mouvement de stock', 'D10', 'COMM', 'membre', false, true, true, 'never', 'P3', 770),
  ('ACT-078', 'product_images_set', 'Gérer les images d''un produit', 'D10', 'COMM', 'membre', false, false, true, 'never', 'P3', 780),
  ('ACT-079', 'product_relations_set', 'Alternatives et compatibilités', 'D10', 'COMM', 'membre', false, false, true, 'propose', 'P3', 790),
  ('ACT-080', 'kit_feature_set', 'Kits en vedette', 'D10', 'COMM', 'membre', false, false, true, 'never', 'P3', 800),
  ('ACT-081', 'gear_function_review', 'Valider les fonctions d''équipement', 'D10', 'COMM', 'membre', false, false, true, 'propose', 'P3', 810),
  ('ACT-082', 'one_catalog_manage', 'Catalogue One (pièces, coloris)', 'D10', 'COMM', 'membre', false, false, true, 'never', 'P3', 820),
  ('ACT-083', 'order_confirm', 'Confirmer une commande', 'D11', 'COMM', 'membre', false, false, true, 'propose', 'P1', 830),
  ('ACT-084', 'order_ship', 'Expédier (transporteur, suivi)', 'D11', 'COMM', 'membre', false, false, true, 'never', 'P2', 840),
  ('ACT-085', 'order_refund', 'Rembourser (Stripe) — tout montant', 'D11', 'COMM', 'membre', true, true, false, 'propose', 'P1', 850),
  ('ACT-086', 'order_cancel', 'Annuler une commande (avec remboursement si payée)', 'D11', 'COMM', 'responsable', true, true, false, 'propose', 'P1', 860),
  ('ACT-087', 'stripe_event_replay', 'Rejouer un webhook Stripe en échec', 'D11', 'COMM', 'responsable', false, true, false, 'never', 'P2', 870),
  ('ACT-088', 'promo_code_manage', 'Créer ou couper un code promo', 'D11', 'COMM', 'responsable', true, true, false, 'never', 'P3', 880),
  ('ACT-089', 'booking_manage', 'Gérer une réservation', 'D11', 'COMM', 'membre', false, true, false, 'propose', 'P2', 890),
  ('ACT-090', 'preorder_manage', 'Gérer une précommande One', 'D11', 'COMM', 'membre', false, true, false, 'never', 'P2', 900),
  ('ACT-091', 'entitlement_grant', 'Attribuer un droit ou un pass', 'D11', 'COMM', 'responsable', true, true, false, 'never', 'P3', 910),
  ('ACT-092', 'withdrawal_decide', 'Valider ou refuser un retrait (`process_withdrawal`)', 'D12', 'CROI', 'membre', true, true, false, 'propose', 'P1', 920),
  ('ACT-093', 'reward_balance_correct', 'Corriger un solde (écriture compensatoire)', 'D12', 'CROI', 'responsable', true, true, false, 'never', 'P2', 930),
  ('ACT-094', 'progression_event_reverse', 'Annuler un événement de progression', 'D12', 'CROI', 'membre', false, true, false, 'propose', 'P3', 940),
  ('ACT-095', 'progression_rules_publish', 'Publier un barème', 'D12', 'CROI', 'responsable', true, true, false, 'never', 'P3', 950),
  ('ACT-096', 'season_open_close', 'Ouvrir ou clore une saison', 'D12', 'CROI', 'responsable', false, true, false, 'never', 'P3', 960),
  ('ACT-097', 'badge_create', 'Créer un badge', 'D12', 'CROI', 'membre', false, false, true, 'never', 'P3', 970),
  ('ACT-098', 'badge_award_revoke', 'Attribuer ou retirer un badge', 'D12', 'CROI', 'membre', false, true, true, 'propose', 'P3', 980),
  ('ACT-099', 'challenge_create', 'Créer un défi', 'D12', 'CROI', 'membre', false, false, true, 'never', 'P3', 990),
  ('ACT-100', 'reward_config_edit', 'Modifier la configuration des récompenses', 'D12', 'CROI', 'responsable', true, true, false, 'never', 'P3', 1000),
  ('ACT-101', 'store_credit_grant', 'Créditer la boutique manuellement', 'D12', 'CROI', 'responsable', true, true, false, 'never', 'P2', 1010),
  ('ACT-102', 'kit_set_souche', 'Désigner un kit souche', 'D13', 'COMM', 'responsable', false, true, true, 'never', 'P3', 1020),
  ('ACT-103', 'kit_unpublish', 'Dépublier un kit', 'D13', 'COMM', 'membre', false, true, true, 'propose', 'P3', 1030),
  ('ACT-104', 'kit_attribution_void', 'Annuler une attribution frauduleuse', 'D13', 'COMM', 'responsable', true, true, false, 'propose', 'P3', 1040),
  ('ACT-105', 'royalty_share_freeze', 'Geler une part créateur', 'D13', 'COMM', 'responsable', false, true, true, 'propose', 'P3', 1050),
  ('ACT-106', 'royalty_config_edit', 'Modifier `royalty_config`', 'D13', 'COMM', 'super_admin', true, true, false, 'never', 'P3', 1060),
  ('ACT-107', 'kit_scores_refresh', 'Recalculer les scores de confiance', 'D13', 'COMM', 'membre', false, false, false, 'never', 'P3', 1070),
  ('ACT-108', 'sos_board', 'Suivre les SOS', 'D14', 'CONF', 'membre', false, false, false, 'read', 'P1', 1080),
  ('ACT-109', 'sos_ack_close', '« Je prends », puis clore un SOS', 'D14', 'CONF', 'membre', false, true, false, 'never', 'P1', 1090),
  ('ACT-110', 'checkpoints_overdue', 'Voir les points de contrôle en retard', 'D14', 'CONF', 'membre', false, false, false, 'read', 'P1', 1100),
  ('ACT-111', 'trip_unpublish', 'Dépublier un voyage public', 'D14', 'CONF', 'membre', false, true, true, 'propose', 'P2', 1110),
  ('ACT-112', 'hike_session_reprocess', 'Relancer le traitement d''une sortie (TECH)', 'D14', 'TECH', 'membre', false, false, false, 'propose', 'P3', 1120),
  ('ACT-113', 'adventure_event_retry', 'Relancer un événement d''aventure en échec (TECH)', 'D14', 'TECH', 'membre', false, false, false, 'propose', 'P3', 1130),
  ('ACT-114', 'country_content_review', 'Relire et valider une fiche pays', 'D15', 'CONT', 'membre', false, false, true, 'propose', 'P3', 1140),
  ('ACT-115', 'country_guide_regenerate', 'Régénérer un guide', 'D15', 'CONT', 'membre', false, false, false, 'propose', 'P3', 1150),
  ('ACT-116', 'guide_publish', 'Publier un guide', 'D15', 'CONT', 'responsable', false, false, true, 'never', 'P3', 1160),
  ('ACT-117', 'content_feature', 'Mettre en avant', 'D15', 'CONT', 'membre', false, false, true, 'never', 'P3', 1170),
  ('ACT-118', 'ambassador_decide', 'Valider un ambassadeur', 'D15', 'CONT', 'responsable', false, true, false, 'never', 'P3', 1180),
  ('ACT-119', 'expert_decide', 'Valider un expert', 'D15', 'CONT', 'responsable', false, true, false, 'never', 'P3', 1190),
  ('ACT-120', 'coverage_dataset_publish', 'Publier ou annuler un jeu de couverture', 'D15', 'CONT', 'responsable', true, true, false, 'never', 'P3', 1200),
  ('ACT-121', 'route_revision_fix', 'Corriger un tracé (nouvelle révision)', 'D15', 'CONT', 'membre', false, true, true, 'propose', 'P3', 1210),
  ('ACT-122', 'affiliate_partner_toggle', 'Activer ou couper un partenaire', 'D16', 'CROI', 'responsable', false, true, true, 'never', 'P3', 1220),
  ('ACT-123', 'affiliate_program_toggle', 'Activer ou couper un programme', 'D16', 'CROI', 'responsable', false, true, true, 'never', 'P3', 1230),
  ('ACT-124', 'affiliate_offer_toggle', 'Activer ou couper une offre', 'D16', 'CROI', 'membre', false, true, true, 'never', 'P3', 1240),
  ('ACT-125', 'affiliate_conversion_validate', 'Valider une conversion', 'D16', 'CROI', 'responsable', true, true, false, 'propose', 'P3', 1250),
  ('ACT-126', 'affiliate_clicks_view', 'Voir les clics', 'D16', 'CROI', 'membre', false, false, false, 'read', 'P3', 1260),
  ('ACT-127', 'ai_usage_view', 'Voir la consommation IA', 'D17', 'PRIA', 'membre', false, false, false, 'read', 'P2', 1270),
  ('ACT-128', 'ai_quota_raise', 'Relever le quota d''une personne', 'D17', 'PRIA', 'responsable', false, true, true, 'never', 'P3', 1280),
  ('ACT-129', 'ai_kill_switch', 'Couper ou rallumer l''IA du site', 'D17', 'PRIA', 'responsable', false, true, false, 'never', 'P1', 1290),
  ('ACT-130', 'ai_cache_clear', 'Vider le cache IA', 'D17', 'PRIA', 'membre', false, true, false, 'never', 'P3', 1300),
  ('ACT-131', 'ai_job_retry', 'Relancer un job IA en échec', 'D17', 'PRIA', 'membre', false, false, false, 'propose', 'P3', 1310),
  ('ACT-132', 'ticket_reply', 'Répondre à un ticket', 'D18', 'MEMB', 'membre', false, false, true, 'propose', 'P1', 1320),
  ('ACT-133', 'ticket_set_status', 'Changer le statut d''un ticket', 'D18', 'MEMB', 'membre', false, false, true, 'propose', 'P2', 1330),
  ('ACT-134', 'announcement_send', 'Envoyer une annonce ciblée (CROI)', 'D18', 'CROI', 'responsable', true, true, false, 'propose', 'P3', 1340),
  ('ACT-135', 'delivery_failures_view', 'Voir les envois en échec', 'D18', 'MEMB', 'membre', false, false, false, 'read', 'P2', 1350),
  ('ACT-136', 'alert_resolve', 'Résoudre une alerte (TECH)', 'D18', 'TECH', 'membre', false, true, false, 'propose', 'P2', 1360),
  ('ACT-137', 'feature_flag_toggle', 'Basculer un indicateur', 'D19', 'TECH', 'responsable', false, true, true, 'never', 'P2', 1370),
  ('ACT-138', 'feature_cohort_manage', 'Gérer une cohorte', 'D19', 'TECH', 'responsable', false, true, true, 'never', 'P3', 1380),
  ('ACT-139', 'errors_view', 'Voir les erreurs', 'D19', 'TECH', 'membre', false, false, false, 'read', 'P2', 1390),
  ('ACT-140', 'daily_report_view', 'Lire le rapport du jour', 'D19', 'TECH', 'membre', false, false, false, 'read', 'P3', 1400),
  ('ACT-141', 'cron_run_now', 'Lancer une tâche planifiée', 'D19', 'TECH', 'responsable', false, true, false, 'propose', 'P2', 1410),
  ('ACT-142', 'rate_limit_lift', 'Lever une limite de débit', 'D19', 'TECH', 'responsable', false, true, false, 'never', 'P3', 1420),
  ('ACT-143', 'audit_log_view', 'Lire le journal d''audit', 'D19', 'TECH', 'responsable', false, false, false, 'never', 'P2', 1430),
  ('ACT-144', 'staff_manage', 'Inviter, changer le rôle, révoquer un membre d''équipe ou un agent (SA)', 'D19', 'TECH', 'super_admin', true, true, false, 'never', 'P2', 1440)
on conflict (id) do update set
  command          = excluded.command,
  label            = excluded.label,
  domain           = excluded.domain,
  pole_code        = excluded.pole_code,
  role_min         = excluded.role_min,
  needs_validation = excluded.needs_validation,
  reason_required  = excluded.reason_required,
  undoable         = excluded.undoable,
  agent_allowed    = excluded.agent_allowed,
  realtime         = excluded.realtime,
  sort             = excluded.sort,
  updated_at       = now();

-- Contrôle d'amorçage : le registre doit contenir exactement les 144 actions.
do $$
begin
  if (select count(*) from admin.commands) <> 144 then
    raise exception 'M03 : % commandes en base, 144 attendues',
      (select count(*) from admin.commands);
  end if;
    if (select count(*) from admin.commands where pole_code = 'MEMB') <> 17 then
      raise exception 'M03 : MEMB attendu 17 commandes';
    end if;
    if (select count(*) from admin.commands where pole_code = 'CONF') <> 47 then
      raise exception 'M03 : CONF attendu 47 commandes';
    end if;
    if (select count(*) from admin.commands where pole_code = 'CONT') <> 17 then
      raise exception 'M03 : CONT attendu 17 commandes';
    end if;
    if (select count(*) from admin.commands where pole_code = 'COMM') <> 31 then
      raise exception 'M03 : COMM attendu 31 commandes';
    end if;
    if (select count(*) from admin.commands where pole_code = 'CROI') <> 16 then
      raise exception 'M03 : CROI attendu 16 commandes';
    end if;
    if (select count(*) from admin.commands where pole_code = 'TECH') <> 11 then
      raise exception 'M03 : TECH attendu 11 commandes';
    end if;
    if (select count(*) from admin.commands where pole_code = 'PRIA') <> 5 then
      raise exception 'M03 : PRIA attendu 5 commandes';
    end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Catalogue exposé à l'interface (contrat : admin.commands_catalog())
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.commands_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  return jsonb_build_object(
    'commands', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'command', c.command,
               'label', c.label,
               'domain', c.domain,
               'pole', c.pole_code,
               'roleMin', c.role_min,
               'needsValidation', c.needs_validation,
               'reasonRequired', c.reason_required,
               'undoable', c.undoable,
               'agent', c.agent_allowed,
               'realtime', c.realtime,
               'enabled', c.enabled,
               'allowed', admin.can((select auth.uid()), c.command)
             ) order by c.sort, c.id)
        from admin.commands c
    ), '[]'::jsonb),
    'poles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', p.code,
               'label', p.label,
               'count', (select count(*) from admin.commands c where c.pole_code = p.code),
               'role', (select max(sm.role) from admin.staff_memberships sm
                         where sm.user_id = (select auth.uid()) and sm.revoked_at is null
                           and sm.pole_code = p.code)
             ) order by p.sort)
        from admin.poles p
    ), '[]'::jsonb),
    'count', (select count(*) from admin.commands),
    'reasons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', rc.code, 'label', rc.label, 'severity', rc.severity,
               'zeroTolerance', rc.zero_tolerance)
             order by rc.sort)
        from admin.reason_codes rc where rc.active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function admin.commands_catalog() from public, anon;
grant execute on function admin.commands_catalog() to authenticated, service_role;

comment on table admin.commands is
  'LKDV Control : registre des 144 commandes (source : 04_CATALOGUE_ACTIONS.md). Le registre pilote le moteur (M13), la barre de commande, le serveur MCP et les tests.';
comment on function admin.commands_catalog() is
  'LKDV Control : catalogue + pôles + motifs pour l''interface. Réservé à l''équipe (aucune MFA requise ici : le middleware la vérifie déjà).';
