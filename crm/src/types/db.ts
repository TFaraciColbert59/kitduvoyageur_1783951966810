/**
 * Types de la base LKDV Control (schémas `public` et `admin`).
 *
 * Écrits à la main après M00→M15 (pas de `supabase gen types` disponible hors
 * ligne dans cet environnement). Portée volontairement limitée : les colonnes
 * que le CRM lit ou écrit réellement, plus toutes les fonctions `admin.*` du
 * contrat (crm/CONTRACT.md). Les retours JSON des RPC sont typés `Json`
 * volontairement : leur forme est décrite dans `crm/src/lib/rpc.ts`, qui la
 * valide côté client.
 *
 * Régénération ultérieure : `npm run gen:types`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Rôle d'équipe (public.admin_role conservé pour compatibilité). */
export type AdminRoleLegacy = 'super_admin' | 'admin' | 'moderateur';
/** Rôle effectif dans le plan de contrôle. */
export type StaffRole = 'responsable' | 'membre';
export type PoleCode = 'CONF' | 'MEMB' | 'COMM' | 'CONT' | 'PRIA' | 'CROI' | 'TECH';
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type ModerationState = 'visible' | 'hidden' | 'removed';

type Timestamps = { created_at: string | null };

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          bio: string | null;
          location: string | null;
          phone: string | null;
          website: string | null;
          handle: string | null;
          cover_url: string | null;
          links: Json | null;
          role: string;
          trust_score: number | null;
          loyalty_level: string | null;
          loyalty_points: number | null;
          xp: number | null;
          level: number | null;
          is_demo: boolean;
          signature_visibility: string;
          profile_visibility: string;
          two_fa_enabled: boolean | null;
          is_suspended_groups: boolean | null;
          suspended_from_groups_at: string | null;
          age_confirmed_at: string | null;
          notification_prefs: Json | null;
          created_at: string | null;
          updated_at: string | null;
          account_status: AccountStatus;
          suspended_until: string | null;
          status_reason: string | null;
          status_changed_at: string | null;
          status_changed_by: string | null;
        };
        Insert: { id: string; email: string; full_name?: string } & Partial<
          Database['public']['Tables']['user_profiles']['Row']
        >;
        Update: Partial<Database['public']['Tables']['user_profiles']['Row']>;
        Relationships: [];
      };
      admin_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AdminRoleLegacy;
          created_at: string | null;
          created_by: string | null;
        };
        Insert: { user_id: string; role?: AdminRoleLegacy } & Partial<
          Database['public']['Tables']['admin_roles']['Row']
        >;
        Update: Partial<Database['public']['Tables']['admin_roles']['Row']>;
        Relationships: [];
      };
      community_posts: {
        Row: {
          id: string;
          author_id: string | null;
          content: string;
          title: string | null;
          image_url: string | null;
          image_alt: string | null;
          media_urls: Json;
          post_type: string | null;
          audience: string;
          club_id: string | null;
          linked_carnet_id: string | null;
          linked_kit_id: string | null;
          is_trending: boolean | null;
          likes_count: number | null;
          comments_count: number | null;
          shares_count: number | null;
          created_at: string | null;
          updated_at: string | null;
          moderation_state: ModerationState;
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_reason: string | null;
        };
        Insert: { author_id?: string | null; content: string } & Partial<
          Database['public']['Tables']['community_posts']['Row']
        >;
        Update: Partial<Database['public']['Tables']['community_posts']['Row']>;
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string | null;
          author_id: string | null;
          content: string;
          parent_id: string | null;
          created_at: string | null;
          moderation_state: ModerationState;
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_reason: string | null;
        };
        Insert: { post_id?: string | null; author_id?: string | null; content: string } & Partial<
          Database['public']['Tables']['post_comments']['Row']
        >;
        Update: Partial<Database['public']['Tables']['post_comments']['Row']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string | null;
          link: string | null;
          related_type: string | null;
          related_id: string | null;
          read: boolean | null;
          read_at: string | null;
          actor_id: string | null;
          group: string;
          group_count: number;
          channels_sent: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: { user_id: string; type: string; title: string } & Partial<
          Database['public']['Tables']['notifications']['Row']
        >;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          order_number: string;
          status: string;
          payment_state: string;
          payment_method: string;
          shipping_address: Json;
          items: Json;
          subtotal_eur: number;
          shipping_eur: number;
          total_eur: number;
          paid_merchandise_cents: number;
          refunded_merchandise_cents: number;
          tracking_url: string | null;
          carrier: string | null;
          estimated_delivery: string | null;
          stripe_session_id: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: { order_number: string } & Partial<Database['public']['Tables']['orders']['Row']>;
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          message: string;
          status: string;
          response: string | null;
          assigned_to: string | null;
          priority: number;
          first_reply_at: string | null;
          closed_at: string | null;
          closed_by: string | null;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; subject: string; message: string } & Partial<
          Database['public']['Tables']['support_tickets']['Row']
        >;
        Update: Partial<Database['public']['Tables']['support_tickets']['Row']>;
        Relationships: [];
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string;
          body: string;
          internal: boolean;
          created_at: string;
        };
        Insert: { ticket_id: string; author_id: string; body: string; internal?: boolean } & Partial<
          Database['public']['Tables']['support_messages']['Row']
        >;
        Update: Partial<Database['public']['Tables']['support_messages']['Row']>;
        Relationships: [];
      };
      sos_alerts: {
        Row: {
          id: string;
          user_id: string;
          latitude: number | null;
          longitude: number | null;
          status: string | null;
          accuracy_m: number | null;
          battery: number | null;
          session_id: string | null;
          country_iso_a2: string | null;
          cancelled_at: string | null;
          resolved_at: string | null;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          close_note: string | null;
          created_at: string | null;
          updated_at: string;
        };
        Insert: { user_id: string } & Partial<Database['public']['Tables']['sos_alerts']['Row']>;
        Update: Partial<Database['public']['Tables']['sos_alerts']['Row']>;
        Relationships: [];
      };
      post_reports: {
        Row: {
          id: string;
          post_id: string | null;
          reporter_id: string | null;
          reason: string | null;
          details: string | null;
          target_type: string | null;
          status: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string | null;
        };
        Insert: { post_id?: string | null; reporter_id?: string | null } & Partial<
          Database['public']['Tables']['post_reports']['Row']
        >;
        Update: Partial<Database['public']['Tables']['post_reports']['Row']>;
        Relationships: [];
      };
      comment_reports: {
        Row: {
          id: string;
          comment_id: string | null;
          reporter_id: string | null;
          reason: string | null;
          table_name: string | null;
          status: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string | null;
        };
        Insert: { comment_id?: string | null } & Partial<Database['public']['Tables']['comment_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['comment_reports']['Row']>;
        Relationships: [];
      };
      story_reports: {
        Row: {
          id: string;
          story_id: string | null;
          story_author_id: string | null;
          reporter_id: string | null;
          reason: string | null;
          status: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string | null;
        };
        Insert: { story_id?: string | null } & Partial<Database['public']['Tables']['story_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['story_reports']['Row']>;
        Relationships: [];
      };
      club_reports: {
        Row: {
          id: string;
          club_id: string | null;
          reporter_id: string | null;
          target_type: string | null;
          target_id: string | null;
          reason: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: { club_id?: string | null } & Partial<Database['public']['Tables']['club_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['club_reports']['Row']>;
        Relationships: [];
      };
      group_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          reported_user_id: string | null;
          group_id: string | null;
          category: string | null;
          reason: string | null;
          severity: string | null;
          status: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string | null;
        };
        Insert: { reporter_id?: string | null } & Partial<Database['public']['Tables']['group_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['group_reports']['Row']>;
        Relationships: [];
      };
      place_reports: {
        Row: {
          id: string;
          place_id: string | null;
          reporter_id: string | null;
          reason: string | null;
          details: string | null;
          status: string | null;
          resolution: string | null;
          resolution_reason: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string | null;
        };
        Insert: { place_id?: string | null } & Partial<Database['public']['Tables']['place_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['place_reports']['Row']>;
        Relationships: [];
      };
      marketplace_reports: {
        Row: {
          id: string;
          listing_id: string | null;
          transaction_id: string | null;
          reporter_id: string | null;
          reason: string | null;
          status: string | null;
          resolution_note: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string | null;
        };
        Insert: { listing_id?: string | null } & Partial<Database['public']['Tables']['marketplace_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['marketplace_reports']['Row']>;
        Relationships: [];
      };
      terrain_reports: {
        Row: {
          id: string;
          segment_id: number | null;
          reporter_id: string | null;
          category: string | null;
          severity: string | null;
          passability: string | null;
          description: string | null;
          photo_url: string | null;
          lat: number | null;
          lng: number | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
          expires_at: string | null;
        };
        Insert: { segment_id?: number | null } & Partial<Database['public']['Tables']['terrain_reports']['Row']>;
        Update: Partial<Database['public']['Tables']['terrain_reports']['Row']>;
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          user_id: string | null;
          type: string | null;
          severity: string | null;
          message: string | null;
          is_resolved: boolean | null;
          resolved_at: string | null;
          due_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: { user_id?: string | null } & Partial<Database['public']['Tables']['alerts']['Row']>;
        Update: Partial<Database['public']['Tables']['alerts']['Row']>;
        Relationships: [];
      };
      pending_contributions: {
        Row: {
          id: string;
          user_id: string | null;
          action_type: string | null;
          target_id: string | null;
          target_type: string | null;
          status: string | null;
          final_points: number | null;
          rejection_reason: string | null;
          created_at: string | null;
          validated_at: string | null;
        };
        Insert: { user_id?: string | null } & Partial<Database['public']['Tables']['pending_contributions']['Row']>;
        Update: Partial<Database['public']['Tables']['pending_contributions']['Row']>;
        Relationships: [];
      };
      feature_flags: {
        Row: { id: string; enabled: boolean | null; scope: string | null; updated_at: string | null; updated_by: string | null };
        Insert: { id: string; enabled?: boolean | null; scope?: string | null } & Partial<
          Database['public']['Tables']['feature_flags']['Row']
        >;
        Update: Partial<Database['public']['Tables']['feature_flags']['Row']>;
        Relationships: [];
      };
      app_errors: {
        Row: { id: number; at: string; scope: string | null; code: string | null; message: string | null };
        Insert: { scope?: string | null; code?: string | null; message?: string | null };
        Update: Partial<Database['public']['Tables']['app_errors']['Row']>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string | null;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          location: string | null;
          website: string | null;
          trust_score: number | null;
          loyalty_points: number | null;
          loyalty_level: string | null;
          xp: number | null;
          level: number | null;
          created_at: string | null;
          handle: string | null;
          cover_url: string | null;
          links: Json | null;
        };
        Relationships: [];
      };
      hub_dashboard_kpis: {
        Row: {
          dau_hub_pct_7d: number | null;
          switcher_usage_pct_7d: number | null;
          median_time_to_section_seconds_7d: number | null;
          section_visit_ratio_7d: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_moderateur: { Args: Record<string, never>; Returns: boolean };
      account_can_write: { Args: Record<string, never>; Returns: boolean };
      my_account_status: { Args: Record<string, never>; Returns: Json };
      app_settings_public: { Args: Record<string, never>; Returns: Json };
      /** RPC du plan de contrôle (schéma admin, exposé à PostgREST). */
      my_role: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: {
      admin_role: AdminRoleLegacy;
    };
    CompositeTypes: Record<string, never>;
  };
  admin: {
    Tables: {
      poles: {
        Row: { code: PoleCode; label: string; description: string; sort: number; created_at: string };
        Insert: { code: PoleCode; label: string; description?: string; sort?: number };
        Update: Partial<Database['admin']['Tables']['poles']['Row']>;
        Relationships: [];
      };
      staff_memberships: {
        Row: {
          id: string;
          user_id: string;
          pole_code: PoleCode;
          role: StaffRole;
          created_at: string;
          created_by: string | null;
          revoked_at: string | null;
        };
        Insert: { user_id: string; pole_code: PoleCode; role?: StaffRole; created_by?: string | null };
        Update: Partial<Database['admin']['Tables']['staff_memberships']['Row']>;
        Relationships: [];
      };
      agents: {
        Row: {
          id: string;
          auth_user_id: string | null;
          pole_code: PoleCode;
          name: string;
          objective: string;
          tools: string[];
          hourly_cap: number;
          status: 'active' | 'paused' | 'stopped';
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { pole_code: PoleCode; name: string; objective?: string; tools?: string[]; hourly_cap?: number; status?: 'active' | 'paused' | 'stopped'; auth_user_id?: string | null };
        Update: Partial<Database['admin']['Tables']['agents']['Row']>;
        Relationships: [];
      };
      agent_jobs: {
        Row: {
          id: string;
          agent_id: string;
          job: string;
          idempotency_key: string | null;
          status: 'queued' | 'running' | 'ok' | 'error' | 'cancelled';
          payload: Json;
          result: Json | null;
          error: string | null;
          attempts: number;
          scheduled_for: string;
          locked_until: string | null;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: { agent_id: string; job: string; payload?: Json; idempotency_key?: string | null; scheduled_for?: string };
        Update: Partial<Database['admin']['Tables']['agent_jobs']['Row']>;
        Relationships: [];
      };
      agent_rate: {
        Row: { agent_id: string; hour: string; count: number };
        Insert: { agent_id: string; hour: string; count?: number };
        Update: Partial<Database['admin']['Tables']['agent_rate']['Row']>;
        Relationships: [];
      };
      agent_proposals: {
        Row: {
          id: string;
          agent_id: string | null;
          command: string;
          params: Json;
          target_type: string | null;
          target_id: string | null;
          rationale: string | null;
          status: 'pending' | 'accepted' | 'rejected';
          decided_by: string | null;
          decided_at: string | null;
          decision: string | null;
          created_at: string;
        };
        Insert: { command: string; params?: Json; agent_id?: string | null };
        Update: Partial<Database['admin']['Tables']['agent_proposals']['Row']>;
        Relationships: [];
      };
      commands: {
        Row: {
          id: string;
          command: string;
          label: string;
          domain: string;
          pole_code: PoleCode;
          role_min: 'membre' | 'responsable' | 'super_admin';
          needs_validation: boolean;
          reason_required: boolean;
          undoable: boolean;
          agent_allowed: 'propose' | 'read' | 'never';
          realtime: 'P1' | 'P2' | 'P3';
          enabled: boolean;
          sort: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['admin']['Tables']['commands']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['admin']['Tables']['commands']['Row']>;
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          command: string;
          params: Json;
          fingerprint: string;
          status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executing' | 'executed' | 'failed';
          target_type: string | null;
          target_id: string | null;
          actor_id: string;
          actor_role: string;
          actor_kind: 'human' | 'agent' | 'system';
          solo: boolean;
          reason_code: string | null;
          reason_text: string | null;
          approver_id: string | null;
          approved_at: string | null;
          executed_at: string | null;
          expires_at: string;
          result: Json | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { command: string; params: Json; fingerprint: string; actor_id: string; actor_role: string };
        Update: Partial<Database['admin']['Tables']['requests']['Row']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          at: string;
          actor_id: string;
          actor_kind: 'human' | 'agent' | 'system';
          actor_role: string;
          action: string;
          target_type: string;
          target_id: string;
          reason_code: string | null;
          reason_text: string | null;
          before: Json | null;
          after: Json | null;
          request_id: string | null;
          second_approver_id: string | null;
          solo: boolean;
          undo_of: number | null;
          sensitive_read: boolean;
          request_fingerprint: string | null;
        };
        Insert: Record<string, never>; // ajout seul, écrit par les fonctions admin.*
        Update: Record<string, never>; // refusé par déclencheur
        Relationships: [];
      };
      reason_codes: {
        Row: {
          code: string;
          label: string;
          member_text: string;
          severity: number;
          zero_tolerance: boolean;
          active: boolean;
          sort: number;
        };
        Insert: { code: string; label: string; member_text: string; severity: number };
        Update: Partial<Database['admin']['Tables']['reason_codes']['Row']>;
        Relationships: [];
      };
      strikes: {
        Row: {
          id: string;
          user_id: string;
          reason_code: string | null;
          reason_text: string | null;
          severity: number;
          source_audit_id: number | null;
          issued_by: string | null;
          issued_at: string;
          expires_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          zero_tolerance: boolean;
        };
        Insert: { user_id: string; reason_code?: string | null; reason_text?: string | null; severity?: number };
        Update: Partial<Database['admin']['Tables']['strikes']['Row']>;
        Relationships: [];
      };
      appeals: {
        Row: {
          id: string;
          audit_id: number | null;
          user_id: string;
          reason_text: string;
          status: 'pending' | 'accepted' | 'rejected' | 'expired';
          decided_by: string | null;
          decided_at: string | null;
          decision_text: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: { user_id: string; reason_text: string; audit_id?: number | null };
        Update: Partial<Database['admin']['Tables']['appeals']['Row']>;
        Relationships: [];
      };
      member_notes: {
        Row: { id: string; user_id: string; body: string; author_id: string; created_at: string; updated_at: string; pinned: boolean };
        Insert: { user_id: string; body: string; author_id: string; pinned?: boolean };
        Update: Partial<Database['admin']['Tables']['member_notes']['Row']>;
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: Json; label: string; description: string; is_public: boolean; updated_at: string; updated_by: string | null };
        Insert: { key: string; value: Json; label: string; description?: string; is_public?: boolean };
        Update: Partial<Database['admin']['Tables']['app_settings']['Row']>;
        Relationships: [];
      };
      sla_targets: {
        Row: { source: string; label: string; target_minutes: number; escalation_minutes: number; urgency: number };
        Insert: { source: string; label: string; target_minutes: number; escalation_minutes?: number; urgency?: number };
        Update: Partial<Database['admin']['Tables']['sla_targets']['Row']>;
        Relationships: [];
      };
      elevations: {
        Row: { id: string; user_id: string; command: string; reason: string; granted_by: string | null; created_at: string; expires_at: string; revoked_at: string | null };
        Insert: { user_id: string; command: string; reason: string; granted_by?: string | null; expires_at?: string };
        Update: Partial<Database['admin']['Tables']['elevations']['Row']>;
        Relationships: [];
      };
      stripe_events: {
        Row: { event_id: string; type: string; payload: Json; received_at: string; status: 'received' | 'applied' | 'ignored' | 'error'; order_id: string | null; note: string | null };
        Insert: { event_id: string; type: string; payload?: Json; status?: 'received' | 'applied' | 'ignored' | 'error' };
        Update: Partial<Database['admin']['Tables']['stripe_events']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // ── Contexte et rôles ────────────────────────────────────────────────
      my_role: { Args: Record<string, never>; Returns: string | null };
      my_context: { Args: Record<string, never>; Returns: Json };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      is_team: { Args: Record<string, never>; Returns: boolean };
      is_team_member: { Args: { p_user?: string | null }; Returns: boolean };
      can: { Args: { p_actor: string; p_command: string }; Returns: boolean };
      is_solo_mode: { Args: Record<string, never>; Returns: boolean };
      poles_of: { Args: { p_user?: string | null }; Returns: string[] };
      is_responsable: { Args: { p_pole?: string | null }; Returns: boolean };
      // ── Écrans ──────────────────────────────────────────────────────────
      commands_catalog: { Args: Record<string, never>; Returns: Json };
      inbox: { Args: Record<string, never>; Returns: Json };
      moderation_inbox: { Args: Record<string, never>; Returns: Json };
      inbox_item: { Args: { p_source: string; p_id: string }; Returns: Json };
      member_360: { Args: { p_user: string }; Returns: Json };
      reveal_pii: { Args: { p_user: string; p_reason: string }; Returns: Json };
      open_identity_document: { Args: { p_document: string; p_reason: string }; Returns: Json };
      /**
       * Fournie par la migration backend 20261109093000_crm_context_agent_inbox.sql.
       * Argument définitif : `p_order` (uuid). L'union tolère l'ancien nom côté
       * appelants le temps de l'alignement.
       */
      order_detail: { Args: { p_order: string } | { p_order_id: string }; Returns: Json };
      /** Backend 20261109093000 : file bornée pour un agent (service_role seul). */
      agent_inbox: { Args: { p_pole: string }; Returns: Json };
      requests_pending: { Args: Record<string, never>; Returns: Json };
      request_detail: { Args: { p_request: string }; Returns: Json };
      agents_overview: { Args: Record<string, never>; Returns: Json };
      audit_page: { Args: { p_before?: string | null; p_limit?: number; p_filters?: unknown }; Returns: Json };
      technique_status: { Args: Record<string, never>; Returns: Json };
      realtime_diag: { Args: Record<string, never>; Returns: Json };
      poles_summary: { Args: Record<string, never>; Returns: Json };
      // ── Écritures ───────────────────────────────────────────────────────
      run_command: { Args: { p_command: string; p_params?: unknown }; Returns: Json };
      run_command_as: { Args: { p_auth_user_id: string; p_command: string; p_params?: unknown }; Returns: Json };
      approve_request: { Args: { p_request: string; p_confirmation: string }; Returns: Json };
      reject_request: { Args: { p_request: string; p_reason: string }; Returns: Json };
      complete_request: { Args: { p_request: string; p_result?: unknown; p_error?: string | null }; Returns: Json };
      undo: { Args: { p_audit_id: number | string }; Returns: Json };
      appeal_submit: { Args: { p_audit_id: number; p_reason: string }; Returns: Json };
      appeal_decide: { Args: { p_appeal: string; p_decision: string; p_text: string }; Returns: Json };
      strike_add: { Args: { p_user: string; p_reason_code: string; p_reason_text?: string | null; p_audit_id?: number | string | null }; Returns: Json };
      strike_scale: { Args: { p_user: string }; Returns: Json };
      note_add: { Args: { p_user: string; p_body: string; p_pinned?: boolean }; Returns: Json };
      elevate: { Args: { p_command: string; p_reason: string; p_minutes?: number }; Returns: Json };
      settings_edit: { Args: { p_key: string; p_value: unknown; p_reason?: string | null }; Returns: Json };
      support_thread: { Args: { p_ticket: string }; Returns: Json };
      sos_board: { Args: Record<string, never>; Returns: Json };
      sos_ack: { Args: { p_id: string }; Returns: Json };
      sos_close: { Args: { p_id: string; p_note: string }; Returns: Json };
      sos_overdue: { Args: { p_minutes?: number }; Returns: Json };
      requests_overdue: { Args: Record<string, never>; Returns: Json };
      // ── Agents et tâches ────────────────────────────────────────────────
      agent_authorize: { Args: { p_command: string; p_auth_user_id?: string | null }; Returns: Json };
      agent_rate_consume: { Args: { p_agent: string; p_cost?: number }; Returns: number };
      agent_jobs_enqueue: { Args: { p_agent: string; p_job: string; p_payload?: unknown; p_key?: string | null; p_at?: string | null }; Returns: string };
      agent_jobs_finish: { Args: { p_job: string; p_status: string; p_result?: unknown; p_error?: string | null }; Returns: undefined };
      agent_propose: { Args: { p_agent: string; p_command: string; p_params?: unknown; p_rationale?: string | null }; Returns: Json };
      agent_stop: { Args: { p_agent: string; p_reason?: string | null }; Returns: Json };
      agent_stop_all: { Args: { p_reason?: string | null }; Returns: Json };
      purge_logs: { Args: { p_days?: number }; Returns: Json };
      stripe_event_ingest: { Args: { p_event_id: string; p_type: string; p_payload: unknown }; Returns: Json };
      // ── Les 144 commandes (une entrée par commande du registre) ─────────
      cmd: { Args: { p?: Json }; Returns: Json };
    };
    Enums: {
      admin_role: AdminRoleLegacy;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type AdminTables<T extends keyof Database['admin']['Tables']> = Database['admin']['Tables'][T]['Row'];
export type RpcName = keyof Database['admin']['Functions'];
