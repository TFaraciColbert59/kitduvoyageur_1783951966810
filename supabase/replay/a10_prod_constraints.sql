ALTER TABLE public."kit_reports" -- OWNER TO "postgres";


CREATE MATERIALIZED VIEW public."kit_trust_scores" AS
 SELECT "k"."id" AS "kit_id",
    "k"."lineage_root_id",
    "k"."origin",
    COALESCE("ls"."fork_users_unique", (0)::bigint) AS "fork_users_unique",
    COALESCE("ls"."lineage_depth", 0) AS "lineage_depth",
    COALESCE("ls"."propagation_score", (0)::numeric) AS "propagation_score",
    COALESCE("es"."sessions_count", (0)::bigint) AS "sessions_count",
    COALESCE("es"."total_km", (0)::numeric) AS "total_km",
    COALESCE("es"."season_count", (0)::bigint) AS "season_count",
    COALESCE("es"."region_count", (0)::bigint) AS "region_count",
    COALESCE("es"."essential_count", (0)::bigint) AS "essential_count",
    COALESCE("es"."never_used_count", (0)::bigint) AS "never_used_count",
    COALESCE("es"."essential_ratio", (0)::numeric) AS "essential_ratio",
    COALESCE("es"."endurance_score", (0)::numeric) AS "endurance_score",
    (COALESCE("es"."sessions_count", (0)::bigint) >= 5) AS "has_min_sessions"
   FROM ((public."materiel_kits" "k"
     LEFT JOIN LATERAL ( SELECT "count"(DISTINCT "d"."user_id") AS "fork_users_unique",
            COALESCE((("max"("d"."generation") - "k"."generation"))::integer, 0) AS "lineage_depth",
            COALESCE(( SELECT "sum"("t"."max_decay") AS "sum"
                   FROM ( SELECT "d2"."user_id",
                            "max"((1.0 / "pow"(((EXTRACT(epoch FROM ("now"() - "d2"."created_at")) / 3600.0) + 2.0), 1.5))) AS "max_decay"
                           FROM (public."materiel_kits" "d2"
                             JOIN public."hike_sessions" "s2" ON (("s2"."kit_id" = "d2"."id")))
                          WHERE (("d2"."ancestors" @> ARRAY["k"."id"]) AND ("d2"."id" <> "k"."id") AND ("d2"."user_id" IS DISTINCT FROM "k"."user_id"))
                          GROUP BY "d2"."user_id") "t"), (0)::numeric) AS "propagation_score"
           FROM public."materiel_kits" "d"
          WHERE (("d"."ancestors" @> ARRAY["k"."id"]) AND ("d"."id" <> "k"."id") AND ("d"."user_id" IS DISTINCT FROM "k"."user_id") AND (EXISTS ( SELECT 1
                   FROM public."hike_sessions" "s"
                  WHERE ("s"."kit_id" = "d"."id"))))) "ls" ON (true))
     LEFT JOIN LATERAL ( SELECT "count"(DISTINCT "s"."id") AS "sessions_count",
            COALESCE("sum"("s"."distance_km"), (0)::numeric) AS "total_km",
            "count"(DISTINCT
                CASE EXTRACT(month FROM "s"."started_at")
                    WHEN 12 THEN 'hiver'::"text"
                    WHEN 1 THEN 'hiver'::"text"
                    WHEN 2 THEN 'hiver'::"text"
                    WHEN 3 THEN 'printemps'::"text"
                    WHEN 4 THEN 'printemps'::"text"
                    WHEN 5 THEN 'printemps'::"text"
                    WHEN 6 THEN 'ete'::"text"
                    WHEN 7 THEN 'ete'::"text"
                    WHEN 8 THEN 'ete'::"text"
                    ELSE 'automne'::"text"
                END) AS "season_count",
            "count"(DISTINCT "r"."region") AS "region_count",
            "count"(*) FILTER (WHERE ("fr"."verdict" = 'essentiel'::"text")) AS "essential_count",
            "count"(*) FILTER (WHERE ("fr"."verdict" = 'jamais_servi'::"text")) AS "never_used_count",
                CASE
                    WHEN ("count"(*) FILTER (WHERE ("fr"."verdict" = 'jamais_servi'::"text")) > 0) THEN "round"((("count"(*) FILTER (WHERE ("fr"."verdict" = 'essentiel'::"text")))::numeric / ("count"(*) FILTER (WHERE ("fr"."verdict" = 'jamais_servi'::"text")))::numeric), 2)
                    ELSE (0)::numeric
                END AS "essential_ratio",
            "round"((("sqrt"(("count"(DISTINCT "s"."id"))::numeric) * (1.0 + (0.25 * ("count"(DISTINCT
                CASE EXTRACT(month FROM "s"."started_at")
                    WHEN 12 THEN 'hiver'::"text"
                    WHEN 1 THEN 'hiver'::"text"
                    WHEN 2 THEN 'hiver'::"text"
                    WHEN 3 THEN 'printemps'::"text"
                    WHEN 4 THEN 'printemps'::"text"
                    WHEN 5 THEN 'printemps'::"text"
                    WHEN 6 THEN 'ete'::"text"
                    WHEN 7 THEN 'ete'::"text"
                    WHEN 8 THEN 'ete'::"text"
                    ELSE 'automne'::"text"
                END))::numeric))) * (1.0 + (0.25 * ("count"(DISTINCT "r"."region"))::numeric))), 3) AS "endurance_score"
           FROM ((public."hike_sessions" "s"
             LEFT JOIN public."hiking_routes" "r" ON (("r"."id" = "s"."route_id")))
             LEFT JOIN public."kit_field_reports" "fr" ON ((("fr"."kit_id" = "s"."kit_id") AND ("fr"."hike_session_id" = "s"."id"))))
          GROUP BY "s"."kit_id") "es" ON (true))
  WITH NO DATA;
ALTER TABLE ONLY public."trail_segments" ALTER COLUMN "id" SET DEFAULT "nextval"('public."trail_segments_id_seq"'::"regclass");



ALTER TABLE ONLY public."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."admin_regions_geo"
    ADD CONSTRAINT "admin_regions_geo_geoname_id_key" UNIQUE ("geoname_id");
ALTER TABLE ONLY public."admin_regions_geo"
    ADD CONSTRAINT "admin_regions_geo_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."affiliate_clicks"
    ADD CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."affiliate_conversions"
    ADD CONSTRAINT "affiliate_conversions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."affiliate_links"
    ADD CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."affiliate_links"
    ADD CONSTRAINT "affiliate_links_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."affiliate_offers"
    ADD CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."affiliate_partners"
    ADD CONSTRAINT "affiliate_partners_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."affiliate_partners"
    ADD CONSTRAINT "affiliate_partners_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."affiliate_programs"
    ADD CONSTRAINT "affiliate_programs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."ai_jobs"
    ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."ai_response_cache"
    ADD CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("cache_key");
ALTER TABLE ONLY public."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("user_id", "day");
ALTER TABLE ONLY public."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."ama_questions"
    ADD CONSTRAINT "ama_questions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."ama_sessions"
    ADD CONSTRAINT "ama_sessions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."ama_votes"
    ADD CONSTRAINT "ama_votes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."ambassadors"
    ADD CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."auction_auto_bids"
    ADD CONSTRAINT "auction_auto_bids_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."auction_bids"
    ADD CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_collaborators"
    ADD CONSTRAINT "carnet_collaborators_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_comments"
    ADD CONSTRAINT "carnet_comments_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_favorites"
    ADD CONSTRAINT "carnet_favorites_carnet_id_user_id_key" UNIQUE ("carnet_id", "user_id");
ALTER TABLE ONLY public."carnet_favorites"
    ADD CONSTRAINT "carnet_favorites_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_gear_links"
    ADD CONSTRAINT "carnet_gear_links_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_kit_items"
    ADD CONSTRAINT "carnet_kit_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_likes"
    ADD CONSTRAINT "carnet_likes_carnet_id_user_id_key" UNIQUE ("carnet_id", "user_id");
ALTER TABLE ONLY public."carnet_likes"
    ADD CONSTRAINT "carnet_likes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_media"
    ADD CONSTRAINT "carnet_media_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_moments"
    ADD CONSTRAINT "carnet_moments_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnet_views"
    ADD CONSTRAINT "carnet_views_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."carnets"
    ADD CONSTRAINT "carnets_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."cart_loyalty_discounts"
    ADD CONSTRAINT "cart_loyalty_discounts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."cart_loyalty_discounts"
    ADD CONSTRAINT "cart_loyalty_discounts_user_id_product_id_key" UNIQUE ("user_id", "product_id");
ALTER TABLE ONLY public."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."checkout_intents"
    ADD CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_challenge_entries"
    ADD CONSTRAINT "club_challenge_entries_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_challenges"
    ADD CONSTRAINT "club_challenges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_event_participants"
    ADD CONSTRAINT "club_event_participants_pkey" PRIMARY KEY ("event_id", "user_id");
ALTER TABLE ONLY public."club_events"
    ADD CONSTRAINT "club_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_join_requests"
    ADD CONSTRAINT "club_join_requests_club_user_key" UNIQUE ("club_id", "user_id");
ALTER TABLE ONLY public."club_join_requests"
    ADD CONSTRAINT "club_join_requests_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_recommended_kits"
    ADD CONSTRAINT "club_recommended_kits_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_reports"
    ADD CONSTRAINT "club_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_topic_likes"
    ADD CONSTRAINT "club_topic_likes_pkey" PRIMARY KEY ("topic_id", "user_id");
ALTER TABLE ONLY public."club_topic_replies"
    ADD CONSTRAINT "club_topic_replies_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."club_topics"
    ADD CONSTRAINT "club_topics_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."clubs"
    ADD CONSTRAINT "clubs_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."comment_reports"
    ADD CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."configurator_sessions"
    ADD CONSTRAINT "configurator_sessions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");
ALTER TABLE ONLY public."conversation_members"
    ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."countries_content"
    ADD CONSTRAINT "countries_content_country_iso_a2_key" UNIQUE ("country_iso_a2");
ALTER TABLE ONLY public."countries_content"
    ADD CONSTRAINT "countries_content_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."countries_content"
    ADD CONSTRAINT "countries_content_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."countries_geo"
    ADD CONSTRAINT "countries_geo_geoname_id_key" UNIQUE ("geoname_id");
ALTER TABLE ONLY public."countries_geo"
    ADD CONSTRAINT "countries_geo_iso_a2_key" UNIQUE ("iso_a2");
ALTER TABLE ONLY public."countries_geo"
    ADD CONSTRAINT "countries_geo_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."country_content_blocks"
    ADD CONSTRAINT "country_content_blocks_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."country_practical_guides"
    ADD CONSTRAINT "country_practical_guides_country_code_section_key" UNIQUE ("country_code", "section");
ALTER TABLE ONLY public."country_practical_guides"
    ADD CONSTRAINT "country_practical_guides_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."country_sync_log"
    ADD CONSTRAINT "country_sync_log_code_iso_key" UNIQUE ("code_iso");
ALTER TABLE ONLY public."country_sync_log"
    ADD CONSTRAINT "country_sync_log_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."crew_members"
    ADD CONSTRAINT "crew_members_pkey" PRIMARY KEY ("crew_id", "user_id");
ALTER TABLE ONLY public."crews"
    ADD CONSTRAINT "crews_invite_code_key" UNIQUE ("invite_code");
ALTER TABLE ONLY public."crews"
    ADD CONSTRAINT "crews_legacy_group_id_key" UNIQUE ("legacy_group_id");
ALTER TABLE ONLY public."crews"
    ADD CONSTRAINT "crews_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."crews"
    ADD CONSTRAINT "crews_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."custom_kit_items"
    ADD CONSTRAINT "custom_kit_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."custom_kits"
    ADD CONSTRAINT "custom_kits_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."depart_participants"
    ADD CONSTRAINT "depart_participants_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."destination_steps"
    ADD CONSTRAINT "destination_steps_natural_key_key" UNIQUE ("natural_key");
ALTER TABLE ONLY public."destination_steps"
    ADD CONSTRAINT "destination_steps_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."event_expenses"
    ADD CONSTRAINT "event_expenses_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."event_participants"
    ADD CONSTRAINT "event_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id");
ALTER TABLE ONLY public."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."expedition_reports"
    ADD CONSTRAINT "expedition_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."expert_bookings"
    ADD CONSTRAINT "expert_bookings_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."experts"
    ADD CONSTRAINT "experts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."gear_alert_history"
    ADD CONSTRAINT "gear_alert_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."gear_history"
    ADD CONSTRAINT "gear_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."gear_images"
    ADD CONSTRAINT "gear_images_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."gear_items"
    ADD CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_album"
    ADD CONSTRAINT "group_album_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_expenses"
    ADD CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_invitations"
    ADD CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_invitations"
    ADD CONSTRAINT "group_invitations_token_key" UNIQUE ("token");
ALTER TABLE ONLY public."group_kit_items"
    ADD CONSTRAINT "group_kit_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_members"
    ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");
ALTER TABLE ONLY public."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_messages"
    ADD CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_poll_votes"
    ADD CONSTRAINT "group_poll_votes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_poll_votes"
    ADD CONSTRAINT "group_poll_votes_poll_id_user_id_key" UNIQUE ("poll_id", "user_id");
ALTER TABLE ONLY public."group_polls"
    ADD CONSTRAINT "group_polls_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_reports"
    ADD CONSTRAINT "group_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."group_tasks"
    ADD CONSTRAINT "group_tasks_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_activites"
    ADD CONSTRAINT "groupe_activites_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_depense_parts"
    ADD CONSTRAINT "groupe_depense_parts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_depenses"
    ADD CONSTRAINT "groupe_depenses_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_equipement"
    ADD CONSTRAINT "groupe_equipement_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_etapes"
    ADD CONSTRAINT "groupe_etapes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_hebergements"
    ADD CONSTRAINT "groupe_hebergements_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_membres"
    ADD CONSTRAINT "groupe_membres_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_messages"
    ADD CONSTRAINT "groupe_messages_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_taches"
    ADD CONSTRAINT "groupe_taches_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_vote_choix"
    ADD CONSTRAINT "groupe_vote_choix_vote_id_membre_id_key" UNIQUE ("vote_id", "membre_id");
ALTER TABLE ONLY public."groupe_vote_options"
    ADD CONSTRAINT "groupe_vote_options_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupe_votes"
    ADD CONSTRAINT "groupe_votes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."groupes"
    ADD CONSTRAINT "groupes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."guides"
    ADD CONSTRAINT "guides_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."guides"
    ADD CONSTRAINT "guides_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."hike_sessions"
    ADD CONSTRAINT "hike_sessions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."hiking_routes"
    ADD CONSTRAINT "hiking_routes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."hub_telemetry"
    ADD CONSTRAINT "hub_telemetry_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."inventory_exports"
    ADD CONSTRAINT "inventory_exports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."kit_export_logs"
    ADD CONSTRAINT "kit_export_logs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_hike_session_id_item_key_key" UNIQUE ("hike_session_id", "item_key");
ALTER TABLE ONLY public."kit_field_reports"
    ADD CONSTRAINT "kit_field_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."kit_items"
    ADD CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."kit_reports"
    ADD CONSTRAINT "kit_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."kits"
    ADD CONSTRAINT "kits_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."kits"
    ADD CONSTRAINT "kits_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."lkv_events"
    ADD CONSTRAINT "lkv_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."loans"
    ADD CONSTRAINT "loans_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."loyalty_history"
    ADD CONSTRAINT "loyalty_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."map_refuges"
    ADD CONSTRAINT "map_refuges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."map_summits"
    ADD CONSTRAINT "map_summits_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."map_water_points"
    ADD CONSTRAINT "map_water_points_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."materiel_history"
    ADD CONSTRAINT "materiel_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."materiel_kit_history"
    ADD CONSTRAINT "materiel_kit_history_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."materiel_kit_items"
    ADD CONSTRAINT "materiel_kit_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."materiel_kits"
    ADD CONSTRAINT "materiel_kits_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."materiel_loans"
    ADD CONSTRAINT "materiel_loans_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."message_mentions"
    ADD CONSTRAINT "message_mentions_message_id_mentioned_user_id_key" UNIQUE ("message_id", "mentioned_user_id");
ALTER TABLE ONLY public."message_mentions"
    ADD CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."message_reactions"
    ADD CONSTRAINT "message_reactions_message_id_user_id_reaction_value_key" UNIQUE ("message_id", "user_id", "reaction_value");
ALTER TABLE ONLY public."message_reactions"
    ADD CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."moderation_queue"
    ADD CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id", "notification_type");
ALTER TABLE ONLY public."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."occasion_items"
    ADD CONSTRAINT "occasion_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."occasion_offers"
    ADD CONSTRAINT "occasion_offers_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");
ALTER TABLE ONLY public."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."outdoor_points"
    ADD CONSTRAINT "outdoor_points_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."overpass_sync_log"
    ADD CONSTRAINT "overpass_sync_log_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."pending_contributions"
    ADD CONSTRAINT "pending_contributions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."place_photos"
    ADD CONSTRAINT "place_photos_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."place_reports"
    ADD CONSTRAINT "place_reports_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."place_reviews"
    ADD CONSTRAINT "place_reviews_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."places_geo"
    ADD CONSTRAINT "places_geo_geoname_id_key" UNIQUE ("geoname_id");
ALTER TABLE ONLY public."places_geo"
    ADD CONSTRAINT "places_geo_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."places"
    ADD CONSTRAINT "places_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."product_alternatives"
    ADD CONSTRAINT "product_alternatives_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."product_compatibilities"
    ADD CONSTRAINT "product_compatibilities_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."product_ownership"
    ADD CONSTRAINT "product_ownership_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");
ALTER TABLE ONLY public."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."qa_answers"
    ADD CONSTRAINT "qa_answers_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."qa_questions"
    ADD CONSTRAINT "qa_questions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."qa_votes"
    ADD CONSTRAINT "qa_votes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."rental_items"
    ADD CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."review_helpful_votes"
    ADD CONSTRAINT "review_helpful_votes_review_id_user_id_key" UNIQUE ("review_id", "user_id");
ALTER TABLE ONLY public."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."reward_accounts"
    ADD CONSTRAINT "reward_accounts_pkey" PRIMARY KEY ("user_id");
ALTER TABLE ONLY public."reward_config"
    ADD CONSTRAINT "reward_config_pkey" PRIMARY KEY ("key");
ALTER TABLE ONLY public."reward_periods"
    ADD CONSTRAINT "reward_periods_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."reward_transactions"
    ADD CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."reward_withdrawals"
    ADD CONSTRAINT "reward_withdrawals_idempotency_key_key" UNIQUE ("idempotency_key");
ALTER TABLE ONLY public."reward_withdrawals"
    ADD CONSTRAINT "reward_withdrawals_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."saved_adventures"
    ADD CONSTRAINT "saved_adventures_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."saved_trails"
    ADD CONSTRAINT "saved_trails_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."share_tokens"
    ADD CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."share_tokens"
    ADD CONSTRAINT "share_tokens_token_key" UNIQUE ("token");
ALTER TABLE ONLY public."shop_products"
    ADD CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."shop_products"
    ADD CONSTRAINT "shop_products_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."sos_alerts"
    ADD CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trail_metadata"
    ADD CONSTRAINT "trail_metadata_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trail_pois"
    ADD CONSTRAINT "trail_pois_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trail_scores"
    ADD CONSTRAINT "trail_scores_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trail_segments"
    ADD CONSTRAINT "trail_segments_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trails_raw_v1"
    ADD CONSTRAINT "trails_raw_v1_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."travel_groups"
    ADD CONSTRAINT "travel_groups_conversation_id_key" UNIQUE ("conversation_id");
ALTER TABLE ONLY public."travel_groups"
    ADD CONSTRAINT "travel_groups_invite_code_key" UNIQUE ("invite_code");
ALTER TABLE ONLY public."travel_groups"
    ADD CONSTRAINT "travel_groups_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_checklist_items"
    ADD CONSTRAINT "trip_checklist_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_collaborators"
    ADD CONSTRAINT "trip_collaborators_trip_id_user_id_key" UNIQUE ("trip_id", "user_id");
ALTER TABLE ONLY public."trip_documents"
    ADD CONSTRAINT "trip_documents_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_expenses"
    ADD CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_items"
    ADD CONSTRAINT "trip_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_notes"
    ADD CONSTRAINT "trip_notes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_participants"
    ADD CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("trip_id", "user_id");
ALTER TABLE ONLY public."trip_pois"
    ADD CONSTRAINT "trip_pois_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_safety_checkpoints"
    ADD CONSTRAINT "trip_safety_checkpoints_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_steps"
    ADD CONSTRAINT "trip_steps_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trip_steps"
    ADD CONSTRAINT "trip_steps_trip_id_day_number_order_index_key" UNIQUE ("trip_id", "day_number", "order_index");
ALTER TABLE ONLY public."trips"
    ADD CONSTRAINT "trips_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."trips"
    ADD CONSTRAINT "trips_share_token_key" UNIQUE ("share_token");
ALTER TABLE ONLY public."trips"
    ADD CONSTRAINT "trips_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY public."user_badges"
    ADD CONSTRAINT "unique_user_badge" UNIQUE ("user_id", "badge_id");
ALTER TABLE ONLY public."country_content_blocks"
    ADD CONSTRAINT "uq_country_content_blocks" UNIQUE ("country_code", "block_type");
ALTER TABLE ONLY public."place_reviews"
    ADD CONSTRAINT "uq_place_reviews_place_author" UNIQUE ("place_id", "author_id");
ALTER TABLE ONLY public."user_addresses"
    ADD CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");
ALTER TABLE ONLY public."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_challenges"
    ADD CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_documents"
    ADD CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_orientation"
    ADD CONSTRAINT "user_orientation_pkey" PRIMARY KEY ("user_id");
ALTER TABLE ONLY public."user_payment_methods"
    ADD CONSTRAINT "user_payment_methods_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY public."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");
ALTER TABLE ONLY public."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");
