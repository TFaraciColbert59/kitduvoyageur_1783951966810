-- A10 — Alignement de replay (indépendant de l'état) : colonnes présentes en
-- production mais absentes des définitions du dépôt, pour les tables communes.
-- ALTERs idempotents et gardés ; sans données, sans FK.

-- admin_regions_geo (8)
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "geoname_id" bigint; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "country_iso_a2" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "admin_code_full" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "name_ascii" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "name_en" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "admin_parent_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.admin_regions_geo ADD COLUMN IF NOT EXISTS "admin1_code_full" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- affiliate_clicks (4)
DO $$ BEGIN ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS "link_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS "trip_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS "session_hash" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS "referrer" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- affiliate_conversions (3)
DO $$ BEGIN ALTER TABLE public.affiliate_conversions ADD COLUMN IF NOT EXISTS "external_sub_id" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_conversions ADD COLUMN IF NOT EXISTS "amount_cents" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_conversions ADD COLUMN IF NOT EXISTS "payload" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;

-- affiliate_partners (2)
DO $$ BEGIN ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS "commission_rate_desc" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.affiliate_partners ADD COLUMN IF NOT EXISTS "website_url" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- badges (6)
DO $$ BEGIN ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS "slug" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS "category" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS "points_reward" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS "requirement_type" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS "requirement_value" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS "active" boolean; EXCEPTION WHEN others THEN NULL; END $$;

-- carnet_moments (5)
DO $$ BEGIN ALTER TABLE public.carnet_moments ADD COLUMN IF NOT EXISTS "auteur_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_moments ADD COLUMN IF NOT EXISTS "moment_timestamp" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_moments ADD COLUMN IF NOT EXISTS "source" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_moments ADD COLUMN IF NOT EXISTS "hike_session_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnet_moments ADD COLUMN IF NOT EXISTS "identified_species" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;

-- carnets (9)
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "distance_km" numeric; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "denivele_m" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "nb_nuits" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "nb_voyageurs" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "lieu_depart" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "lieu_arrivee" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "country_iso" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.carnets ADD COLUMN IF NOT EXISTS "trip_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- club_event_participants (1)
DO $$ BEGIN ALTER TABLE public.club_event_participants ADD COLUMN IF NOT EXISTS "joined_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- club_topic_replies (1)
DO $$ BEGIN ALTER TABLE public.club_topic_replies ADD COLUMN IF NOT EXISTS "parent_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- clubs (1)
DO $$ BEGIN ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS "country_iso" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- community_posts (1)
DO $$ BEGIN ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS "title" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- conversations (4)
DO $$ BEGIN ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "title" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "avatar_url" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "direct_pair_key" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "last_message_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- countries_content (20)
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "country_iso_a2" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "slug" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "status" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "pratique_voyage" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "climat" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "budget" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "sante_securite" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "transport" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "culture" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "outdoor" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "connectivite" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "editorial" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "last_researched_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "data_source" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "staleness_days" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "research_wave" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "research_batch_file" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_content ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- countries_geo (22)
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "geoname_id" bigint; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "iso_a3" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "iso_numeric" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "fips_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "tld" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "phone_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "currency_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "currency_name" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "postal_code_format" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "postal_code_regex" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "languages" "text"[]; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "neighbours" "text"[]; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "area_km2" double precision; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "name_ascii" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "name_en" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "name_short" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "geometry_source" "public"."geo_country_geometry_source"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "is_sovereign" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "timezone" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "subregion" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.countries_geo ADD COLUMN IF NOT EXISTS "sources" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- crews (1)
DO $$ BEGIN ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS "auto_created" boolean; EXCEPTION WHEN others THEN NULL; END $$;

-- custom_kits (1)
DO $$ BEGIN ALTER TABLE public.custom_kits ADD COLUMN IF NOT EXISTS "search" "tsvector"; EXCEPTION WHEN others THEN NULL; END $$;

-- gear_alert_history (7)
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "gear_item_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "alert_type" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "label" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_alert_history ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- gear_items (21)
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "product_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "source" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "origin_order_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "origin_kit_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "is_listed_for_sale" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "acquired_at" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "transferred_to_user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "quantity" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "is_favorite" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "loan_status" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "loan_to_name" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "compartment" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "wear_percentage" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "size_label" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "materials" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "sole_type" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "waterproof_rating" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "ref_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "loan_due_date" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "last_used_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS "sorties_count" integer; EXCEPTION WHEN others THEN NULL; END $$;

-- group_kit_items (2)
DO $$ BEGIN ALTER TABLE public.group_kit_items ADD COLUMN IF NOT EXISTS "start_date" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_kit_items ADD COLUMN IF NOT EXISTS "end_date" "date"; EXCEPTION WHEN others THEN NULL; END $$;

-- group_members (1)
DO $$ BEGIN ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS "invited_by" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- group_messages (2)
DO $$ BEGIN ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS "media_url" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS "location" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;

-- group_reports (9)
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "reporter_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "reported_user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "group_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "category" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "reason" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "severity" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "status" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.group_reports ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_activites (6)
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD COLUMN IF NOT EXISTS "membre_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD COLUMN IF NOT EXISTS "type" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD COLUMN IF NOT EXISTS "description" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_activites ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_depense_parts (5)
DO $$ BEGIN ALTER TABLE public.groupe_depense_parts ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depense_parts ADD COLUMN IF NOT EXISTS "depense_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depense_parts ADD COLUMN IF NOT EXISTS "membre_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depense_parts ADD COLUMN IF NOT EXISTS "montant_cents" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depense_parts ADD COLUMN IF NOT EXISTS "regle" boolean; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_depenses (10)
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "titre" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "montant_cents" integer NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "payeur_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "statut" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "date_depense" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "nb_parts" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "note" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_depenses ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_equipement (8)
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "nom" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "categorie" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "apporte_par" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "poids_g" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "statut" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_equipement ADD COLUMN IF NOT EXISTS "note" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_etapes (16)
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "ordre" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "lieu_depart" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "lieu_arrivee" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "distance_km" numeric; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "denivele_m" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "duree_texte" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "meteo" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "temperature_c" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "jour_numero" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "date_etape" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "recit" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "gpx_url" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "difficulte" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_etapes ADD COLUMN IF NOT EXISTS "points_geojson" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_hebergements (10)
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "apres_jour_numero" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "nom" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "altitude_m" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "type_hebergement" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "hote" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "prix_cents" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "prix_note" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_hebergements ADD COLUMN IF NOT EXISTS "note" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_membres (12)
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "invited_email" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "nom_affichage" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "role" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "role_note" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "statut_preparation" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "pourcentage_pret" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "note_statut" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "confirme" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_membres ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_messages (9)
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "auteur_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "contenu" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "lieu_nom" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "gpx_url" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "likes_count" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "comments_count" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_messages ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_taches (10)
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "titre" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "categorie" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "assigne_a" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "statut" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "echeance" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "note" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_taches ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_vote_choix (5)
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD COLUMN IF NOT EXISTS "vote_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD COLUMN IF NOT EXISTS "option_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD COLUMN IF NOT EXISTS "membre_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_choix ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_vote_options (5)
DO $$ BEGIN ALTER TABLE public.groupe_vote_options ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_options ADD COLUMN IF NOT EXISTS "vote_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_options ADD COLUMN IF NOT EXISTS "libelle" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_options ADD COLUMN IF NOT EXISTS "detail" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_vote_options ADD COLUMN IF NOT EXISTS "ordre" integer; EXCEPTION WHEN others THEN NULL; END $$;

-- groupe_votes (8)
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "groupe_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "question" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "contexte" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "lance_par" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "statut" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "date_cloture" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupe_votes ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- groupes (23)
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "carnet_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "created_by" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "nom" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "sous_titre" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "destination" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "massif" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "description" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "date_debut" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "date_fin" "date"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "lieu_rdv" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "statut" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "etape_courante" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "progression_pct" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "difficulte" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "budget_prevu_cents" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "confidentialite" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "distance_km" numeric; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "denivele_m" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "nb_nuits" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "places_max" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.groupes ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- hike_sessions (1)
DO $$ BEGIN ALTER TABLE public.hike_sessions ADD COLUMN IF NOT EXISTS "kit_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- hiking_routes (1)
DO $$ BEGIN ALTER TABLE public.hiking_routes ADD COLUMN IF NOT EXISTS "region" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- inventory_exports (4)
DO $$ BEGIN ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS "user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS "exported_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inventory_exports ADD COLUMN IF NOT EXISTS "type" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- kit_export_logs (5)
DO $$ BEGIN ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS "kit_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS "user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS "exported_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kit_export_logs ADD COLUMN IF NOT EXISTS "format" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- kit_reports (1)
DO $$ BEGIN ALTER TABLE public.kit_reports ADD COLUMN IF NOT EXISTS "kit_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- loyalty_history (1)
DO $$ BEGIN ALTER TABLE public.loyalty_history ADD COLUMN IF NOT EXISTS "source_id" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- loyalty_redemptions (1)
DO $$ BEGIN ALTER TABLE public.loyalty_redemptions ADD COLUMN IF NOT EXISTS "status" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- materiel_history (8)
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "id" bigint NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "user_id" "uuid" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "action_type" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "entity_type" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "entity_id" "uuid" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "entity_name" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "payload" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_history ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- materiel_kit_items (3)
DO $$ BEGIN ALTER TABLE public.materiel_kit_items ADD COLUMN IF NOT EXISTS "name" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kit_items ADD COLUMN IF NOT EXISTS "product_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kit_items ADD COLUMN IF NOT EXISTS "item_key" "text" GENERATED ALWAYS AS (COALESCE(("product_id")::"text", "regexp_replace"("lower"(COALESCE("name", ''::"text")), '[^a-z0-9]+'::"text", '-'::"text", 'g'::"text"))) STORED; EXCEPTION WHEN others THEN NULL; END $$;

-- materiel_kits (8)
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "consumables" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "forked_from" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "lineage_root_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "generation" smallint; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "ancestors" "uuid"[]; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "origin" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "is_souche" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.materiel_kits ADD COLUMN IF NOT EXISTS "field_proven_count" integer; EXCEPTION WHEN others THEN NULL; END $$;

-- messages (5)
DO $$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "message_type" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "reply_to_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "metadata" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- notifications (6)
DO $$ BEGIN ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "actor_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "related_type" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "related_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "link" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "channels_sent" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- occasion_items (4)
DO $$ BEGIN ALTER TABLE public.occasion_items ADD COLUMN IF NOT EXISTS "gear_item_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.occasion_items ADD COLUMN IF NOT EXISTS "buyer_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.occasion_items ADD COLUMN IF NOT EXISTS "sold_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.occasion_items ADD COLUMN IF NOT EXISTS "payout_released_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- order_items (1)
DO $$ BEGIN ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS "received_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- orders (1)
DO $$ BEGIN ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "stripe_session_id" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- place_reviews (1)
DO $$ BEGIN ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS "trip_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- places_geo (14)
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "geoname_id" bigint; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "country_iso_a2" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "feature_class" "public"."geo_feature_class"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "latitude" double precision; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "longitude" double precision; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "name_ascii" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "population_rank" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "is_capital" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "is_major_city" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "admin1_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "admin2_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "admin3_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.places_geo ADD COLUMN IF NOT EXISTS "admin4_code" "text"; EXCEPTION WHEN others THEN NULL; END $$;

-- post_comments (1)
DO $$ BEGIN ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS "parent_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- product_ownership (1)
DO $$ BEGIN ALTER TABLE public.product_ownership ADD COLUMN IF NOT EXISTS "quantity" integer; EXCEPTION WHEN others THEN NULL; END $$;

-- reward_config (1)
DO $$ BEGIN ALTER TABLE public.reward_config ADD COLUMN IF NOT EXISTS "key" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;

-- share_tokens (1)
DO $$ BEGIN ALTER TABLE public.share_tokens ADD COLUMN IF NOT EXISTS "last_accessed_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- shop_products (40)
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "product_id" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "model" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "category_main" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "category_sub" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "weight_grams" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "dimensions" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "materials" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "warranty" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "description_why" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "advantages_array" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "disadvantages_array" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "alt_premium_id" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "alt_budget_id" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "available_europe" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "available_usa" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "score_quality" numeric(4,1); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "score_price" numeric(4,1); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "score_durability" numeric(4,1); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "source_review" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "score_kdv" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "essentiality" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "versatility_10" numeric(4,1); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "cabin_compatible" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "repairability_10" numeric(4,1); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "travel_types_array" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "climates_array" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "justification_ai" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "import_date" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "is_active" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "stock" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "cost_price_eur" numeric; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "min_stock" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "supplier" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "ean" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "tags" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "variants" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "meta_title" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "meta_description" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS "vat_rate" numeric; EXCEPTION WHEN others THEN NULL; END $$;

-- trail_metadata (4)
DO $$ BEGIN ALTER TABLE public.trail_metadata ADD COLUMN IF NOT EXISTS "id" bigint NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_metadata ADD COLUMN IF NOT EXISTS "max_elevation" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_metadata ADD COLUMN IF NOT EXISTS "min_elevation" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_metadata ADD COLUMN IF NOT EXISTS "created_at" timestamp without time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- trail_pois (1)
DO $$ BEGIN ALTER TABLE public.trail_pois ADD COLUMN IF NOT EXISTS "osm_id" bigint; EXCEPTION WHEN others THEN NULL; END $$;

-- trail_scores (2)
DO $$ BEGIN ALTER TABLE public.trail_scores ADD COLUMN IF NOT EXISTS "id" bigint NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trail_scores ADD COLUMN IF NOT EXISTS "created_at" timestamp without time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- travel_groups (4)
DO $$ BEGIN ALTER TABLE public.travel_groups ADD COLUMN IF NOT EXISTS "country_iso" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.travel_groups ADD COLUMN IF NOT EXISTS "min_trust_score" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.travel_groups ADD COLUMN IF NOT EXISTS "mixite" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.travel_groups ADD COLUMN IF NOT EXISTS "conversation_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- trip_expenses (1)
DO $$ BEGIN ALTER TABLE public.trip_expenses ADD COLUMN IF NOT EXISTS "is_planned" boolean; EXCEPTION WHEN others THEN NULL; END $$;

-- trip_items (9)
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "source" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "shop_product_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "priority" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "is_vital" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "is_worn" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "is_consumable" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "notes" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "purchase_state" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trip_items ADD COLUMN IF NOT EXISTS "day_number" integer; EXCEPTION WHEN others THEN NULL; END $$;

-- trip_steps (1)
DO $$ BEGIN ALTER TABLE public.trip_steps ADD COLUMN IF NOT EXISTS "start_time" time without time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- trips (2)
DO $$ BEGIN ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS "crew_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS "kit_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;

-- user_addresses (9)
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "label" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "full_name" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "street" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "city" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "is_default" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_addresses ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- user_payment_methods (9)
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "user_id" "uuid"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "brand" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "last4" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "holder_name" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "expiry" "text" NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "is_default" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_payment_methods ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;

-- user_profiles (11)
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "xp" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "level" integer; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "role" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "phone" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "website" "text"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "notification_prefs" "jsonb"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "two_fa_enabled" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "is_suspended_groups" boolean; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "age_confirmed_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "suspended_from_groups_at" timestamp with time zone; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "signature_visibility" "text"; EXCEPTION WHEN others THEN NULL; END $$;

