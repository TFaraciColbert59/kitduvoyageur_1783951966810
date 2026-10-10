# Handoff Report — LKDV Social Database & Security Architecture

**Agent**: `explorer_social_db_1`  
**Role**: Database & Security Architecture Explorer  
**Date**: 2026-10-04  
**Target Path**: `.agents/teamwork/explorer_social_db_1/handoff.md`  
**Report Type**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

1. **Socle Canonique de Messagerie (`supabase/migrations/20260831000000_messaging_system_canonical.sql`)** :
   - Ligne 30–48 : Table `conversations` avec colonnes `id`, `type CHECK (type IN ('direct', 'group'))`, `title`, `created_by`, `direct_pair_key`, `last_message_at`. Aucune colonne `last_sequence_number` ni typage de contexte conversationnel.
   - Ligne 50–69 : Table `conversation_members` avec `role CHECK (role IN ('member', 'admin', 'owner'))`, `last_read_at`, `unread_count`, `left_at`. Aucune colonne `last_read_sequence`.
   - Ligne 71–93 : Table `messages` avec `conversation_id`, `sender_id`, `content`, `message_type`, `reply_to_id`, `metadata`. Aucune colonne `sequence_number` ni `client_nonce`.
   - Ligne 126–128 : `travel_groups` possède déjà un lien `conversation_id UUID UNIQUE REFERENCES public.conversations(id) ON DELETE SET NULL`.

2. **Faiblesse de Sécurité dans les Helpers (`supabase/migrations/20260830000000_messaging_security_helpers.sql`)** :
   - Ligne 17–33 : La fonction `is_conversation_member(target_conversation_id, target_user_id)` vérifie seulement `WHERE cm.conversation_id = target_conversation_id AND cm.user_id = target_user_id`. Elle **n'exclut pas** les membres ayant quitté (`left_at IS NOT NULL`). Tout utilisateur archivé/sortant peut ainsi continuer à lire et insérer des messages via les politiques RLS.

3. **Optimisation InitPlan Déjà en Place (`supabase/migrations/20260925010000_messaging_rls_auth_initplan.sql`)** :
   - Ligne 20–40 & 73–82 : Toutes les politiques existantes de messagerie ont été converties pour évaluer `(SELECT auth.uid())` une seule fois par instruction plutôt que par ligne scannée. Les nouvelles politiques doivent impérativement respecter cette convention.

4. **Structure Actuelle des Clubs (`supabase/migrations/20260713120000_community_features.sql`)** :
   - Ligne 80–99 : Table `clubs` existante (`slug`, `name`, `type`, `emoji`, `description`, `privacy`, `members_count`).
   - Ligne 110–118 : Table `club_members` avec `role CHECK (role IN ('admin', 'moderator', 'member'))` et `status CHECK (status IN ('active', 'banned', 'pending'))`. Les rôles requis (`guide`, `safety`, `owner`) n'y figurent pas.
   - Ligne 131–162 : Présence de `club_topics` et `club_topic_replies` (forum asynchrone), mais absence totale de salons de messagerie temps réel (`club_channels`).

5. **Entités d'Expéditions & Checklists (`supabase/migrations/20260904050000_trips_core.sql` & `20260909100000_trip_checklist_items.sql`)** :
   - `trips` contient les métadonnées de voyage et `trip_checklist_items` gère les checklists de préparation liées à un `trip_id`.
   - `group_live_sessions` (`20260913200000`) et `group_live_positions` (`20260913210000`) gèrent les coordonnées live éphémères de groupes de voyage. Aucune table unifiée `expedition_rooms` n'existe pour orchestrer la conversation, le tracé GPX et les check-ins terrain.

6. **Absence de Gouvernance Terra AI & Streaks d'Aventure** :
   - Aucune table ne définit les autorisations par conversation de Terra ni le stockage des actions brouillons (`terra_drafted_actions`).
   - Le système de récompense `claim_reward_points` (`20261003120000_r1_reward_rpc_security_hardening.sql`) durci avec `search_path = public, pg_temp` n'inclut pas encore le barème d'utilité réciproque ni le suivi de `adventure_streaks`.

---

## 2. Logic Chain

1. **De l'Observation 1 & 2 au Modèle de Séquencement et RLS** :
   - Les coupures réseau mobiles créent des collisions d'horodatage et des renvois intempestifs.
   - L'ajout de `sequence_number BIGINT` avec trigger `BEFORE INSERT` sur `messages` incrémentant `conversations.last_sequence_number` garantit un ordre monotone strict sans concurrence.
   - L'ajout de `client_nonce TEXT` avec contrainte unique `UNIQUE(conversation_id, client_nonce)` garantit l'idempotence réseau totale : tout renvoi renvoie le message existant au lieu de dupliquer.
   - La correction de `is_conversation_member` en ajoutant la clause `cm.left_at IS NULL` colmate la brèche de fuite d'informations vers d'anciens membres.

2. **De l'Observation 4 au Modèle de Salons de Clubs** :
   - Les clubs ont besoin de canaux instantanés (type Discord/Slack outdoor) tout en réutilisant l'infrastructure de messagerie éprouvée.
   - La création de `club_channels` pointant vers `conversations.id` (avec `context_type = 'club_channel'`) relie naturellement le monde des clubs au moteur de messagerie canonique sans redondance.
   - L'extension de `club_members.role` aux 5 rôles outdoor (`owner`, `admin`, `guide`, `safety`, `member`) permet une gestion granulaire des permissions de lecture/écriture par salon (`min_role_to_read`, `min_role_to_write`).

3. **De l'Observation 5 à la Modélisation des Expedition Rooms** :
   - Une "Expedition Room" regroupe dans une même surface : discussion, tracé GPX, météo, checklist partagée et check-ins terrain.
   - En créant `expedition_rooms` liée 1:1 à une conversation et optionnellement à un `trip_id`, on active le cockpit live. Les tables satellites `expedition_checklist_items` et `expedition_checkins` enrichissent le fil de discussion sans saturer la table des messages de données brutes non indexées.

4. **De l'Observation 6 au Modèle Terra & Réputation Réciproque** :
   - Pour respecter l'exigence de confidentialité et de citations sources, `conversation_terra_settings` garantit que Terra est désactivée par défaut et requiert un consentement explicite.
   - Les propositions de Terra sont stockées dans `terra_drafted_actions` au statut `'draft'`, exigeant une validation humaine par un guide ou administrateur (`review_terra_drafted_action`), avec citation obligatoire des `source_message_ids`.
   - L'interdiction d'attribuer des points pour le volume brut de chat protège contre le spam. Les points sont conditionnés à l'utilité réciproque (réactions `useful`, check-ins terrain certifiés, complétion de tâches).

---

## 3. Caveats

1. **Volume Initial de Données** :
   - Lors de l'exécution de la migration sur une base existante volumineuse, le backfill de `sequence_number` sur `messages` via `ROW_NUMBER() OVER (...)` verrouillera temporairement les tables de messagerie. Le script utilise un bloc idempotent qui ne s'exécute que si des messages ont un `sequence_number IS NULL`.
2. **Synchronisation Offline Avancée** :
   - Si un client offline accumule 50 messages locaux avant reconnexion, l'envoi séquentiel avec `client_nonce` garantira l'ordre d'arrivée serveur, mais les `sequence_number` seront assignés selon l'ordre d'insertion effectif sur PostgreSQL.
3. **Périmètre d'Investigation** :
   - L'enquête s'est concentrée sur le modèle de données, les politiques RLS et les RPCs Supabase. L'adaptation frontend et les composants React feront l'objet des rôles spécialisés (Frontend/Services).

---

## 4. Conclusion

1. L'architecture BDD de « LKDV Social » est entièrement spécifiée dans `survey_report_db.md`.
2. Elle réutilise 100% du domaine canonique `src/features/messaging/` et des tables existantes sans introduire de système parallèle.
3. Le schéma DDL complet (`20261004120000_lkdv_social_core_architecture.sql`) fournit :
   - Séquencement atomique et déduplication `client_nonce`.
   - Isolation RLS hermétique sans fuite de messages.
   - Structure de clubs avec 5 rôles outdoor et salons dédiés.
   - Expedition Rooms avec checklists et check-ins terrain.
   - Isolation et gouvernance humaine pour Terra AI.
   - Streaks collectifs et points d'utilité réciproque anti-spam.

---

## 5. Verification Method

Pour vérifier de manière autonome les conclusions et le schéma proposé :
1. **Inspection des Fichiers** :
   - Consulter le rapport exhaustif : `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_social_db_1\survey_report_db.md`.
   - Vérifier la migration canonique existante : `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\supabase\migrations\20260831000000_messaging_system_canonical.sql`.
   - Vérifier l'optimisation InitPlan existante : `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\supabase\migrations\20260925010000_messaging_rls_auth_initplan.sql`.
2. **Validation des Syntaxes SQL & Typages** :
   - Vérifier la cohérence des types TypeScript définis dans le rapport (Section 9) avec `src/lib/supabase/types.ts`.
   - Vérifier la compatibilité des politiques RLS avec les contraintes Supabase (aucun appel `auth.uid()` non encapsulé dans une sous-requête).
