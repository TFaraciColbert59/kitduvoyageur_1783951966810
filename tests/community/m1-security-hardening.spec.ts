import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type {
  PostReactionType,
  DatabasePostSave,
  DatabaseContentFeedback,
  DatabaseUserFollow,
} from '@/lib/supabase/types';

const M1_REWARD_MIGRATION = 'supabase/migrations/20261003120000_r1_reward_rpc_security_hardening.sql';
const M1_SOCIAL_MIGRATION = 'supabase/migrations/20261003121000_r2_social_interactions_persistence.sql';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Milestone 1 — Durcissement Sécurité & Persistance Sociale (R1 & R2)', () => {
  describe('R1: Hardening sécurité de claim_reward_points et search_path', () => {
    const sql = readRepoFile(M1_REWARD_MIGRATION);

    it('R1-01: claim_reward_points applique un search_path immuable public, pg_temp', () => {
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.claim_reward_points/);
      expect(sql).toMatch(/SECURITY DEFINER/);
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });

    it('R1-02: claim_reward_points rejette formellement l\'usurpation d\'identité (auth.uid() <> p_user_id) avec code 42501', () => {
      expect(sql).toMatch(/IF auth\.uid\(\) IS NOT NULL AND auth\.uid\(\) <> p_user_id THEN/);
      expect(sql).toMatch(/RAISE EXCEPTION 'Non autorisé: usurpation d''identité interdite' USING ERRCODE = '42501';/);
    });

    it('R1-03: claim_reward_points rejette les appels anonymes sans rôle service_role avec code 42501', () => {
      expect(sql).toMatch(/IF auth\.uid\(\) IS NULL AND COALESCE\(current_setting\('request\.jwt\.claim\.role', true\), ''\) <> 'service_role' THEN/);
      expect(sql).toMatch(/RAISE EXCEPTION 'Non autorisé: appel anonyme interdit' USING ERRCODE = '42501';/);
    });

    it('R1-04: claim_reward_points vérifie l\'existence de la cible avant traitement', () => {
      expect(sql).toMatch(/SELECT 1 FROM public\.user_profiles WHERE id = p_user_id/);
      expect(sql).toMatch(/SELECT 1 FROM public\.community_posts WHERE id = p_target_id/);
      expect(sql).toMatch(/SELECT 1 FROM public\.carnets WHERE id = p_target_id/);
      expect(sql).toMatch(/SELECT 1 FROM public\.post_comments WHERE id = p_target_id/);
    });

    it('R1-05: les permissions directes sur claim_reward_points sont révoquées pour PUBLIC, anon, authenticated', () => {
      expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_reward_points\(UUID, TEXT, UUID, TEXT, JSONB\) FROM PUBLIC, anon, authenticated;/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_reward_points\(UUID, TEXT, UUID, TEXT, JSONB\) TO service_role;/);
    });

    it('R1-06: le search_path de l\'ensemble des 34 fonctions SECURITY DEFINER est durci à public, pg_temp', () => {
      const auditedFunctions = [
        'get_admin_role',
        'handle_new_user',
        'update_loyalty_points',
        'can_user_bid',
        'can_user_sell_auction',
        'place_bid',
        'set_auto_bid',
        'get_comparable_sales',
        'get_occasion_listing_for_product',
        'increment_stock',
        'handle_new_user_reward_account',
        'update_reward_account_on_transaction',
        'update_reward_account_on_contribution',
        'claim_reward_points',
        'process_pending_contribution',
        'request_withdrawal',
        'finalize_reward_period',
        'process_withdrawal',
        'notify',
        'trg_on_community_post_like',
        'trg_on_community_post_comment',
        'trg_on_carnet_like',
        'trg_on_carnet_comment',
        'trg_on_group_message',
        'trg_on_group_member_join',
        'trg_on_group_task_assigned',
        'trg_on_group_expense_added',
        'send_digests',
        'cleanup_expired_trash_kits',
        'record_hike_gear_usage',
        'purge_expired_lkv_events',
        'lkv_ensure_auto_crew',
        'lkv_seed_trip_checklist_template',
        'get_user_badges_progress',
        'toggle_community_post_like',
        'decrement_stock_on_order',
      ];

      for (const fn of auditedFunctions) {
        expect(sql).toContain(`'${fn}'`);
      }
      expect(sql).toMatch(/ALTER FUNCTION %s SET search_path = public, pg_temp/);
    });
  });

  describe('R2: Persistance des interactions sociales (post_saves, content_feedback, post_likes, user_follows)', () => {
    const sql = readRepoFile(M1_SOCIAL_MIGRATION);

    it('R2-01: table post_saves créée avec clés étrangères et contrainte d\'unicité', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.post_saves/);
      expect(sql).toMatch(/post_id UUID NOT NULL REFERENCES public\.community_posts\(id\) ON DELETE CASCADE/);
      expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES public\.user_profiles\(id\) ON DELETE CASCADE/);
      expect(sql).toMatch(/CONSTRAINT uq_post_saves_post_user UNIQUE \(post_id, user_id\)/);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_post_saves_post_id/);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_post_saves_user_id/);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_post_saves_user_created/);
    });

    it('R2-02: RLS sur post_saves isole rigoureusement chaque utilisateur via (SELECT auth.uid())', () => {
      expect(sql).toMatch(/ALTER TABLE public\.post_saves ENABLE ROW LEVEL SECURITY;/);
      expect(sql).toMatch(/CREATE POLICY post_saves_select_own ON public\.post_saves\s+FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\);/);
      expect(sql).toMatch(/CREATE POLICY post_saves_insert_own ON public\.post_saves\s+FOR INSERT TO authenticated\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\);/);
      expect(sql).toMatch(/CREATE POLICY post_saves_delete_own ON public\.post_saves\s+FOR DELETE TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\);/);
      expect(sql).toMatch(/REVOKE ALL ON public\.post_saves FROM PUBLIC, anon;/);
      expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON public\.post_saves TO authenticated;/);
    });

    it('R2-03: table content_feedback créée avec contrôles stricts de cible et types', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.content_feedback/);
      expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES public\.user_profiles\(id\) ON DELETE CASCADE/);
      expect(sql).toMatch(/CHECK \(target_type IN \('post', 'author', 'carnet'\)\)/);
      expect(sql).toMatch(/CHECK \(feedback_type IN \('hide', 'less_like_this', 'report'\)\)/);
      expect(sql).toMatch(/CONSTRAINT uq_content_feedback UNIQUE \(user_id, target_type, target_id, feedback_type\)/);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_content_feedback_user_feedback/);
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_content_feedback_target/);
    });

    it('R2-04: RLS sur content_feedback isole rigoureusement chaque utilisateur via (SELECT auth.uid())', () => {
      expect(sql).toMatch(/ALTER TABLE public\.content_feedback ENABLE ROW LEVEL SECURITY;/);
      expect(sql).toMatch(/CREATE POLICY content_feedback_select_own ON public\.content_feedback\s+FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\);/);
      expect(sql).toMatch(/CREATE POLICY content_feedback_insert_own ON public\.content_feedback\s+FOR INSERT TO authenticated\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\);/);
      expect(sql).toMatch(/CREATE POLICY content_feedback_delete_own ON public\.content_feedback\s+FOR DELETE TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\);/);
      expect(sql).toMatch(/REVOKE ALL ON public\.content_feedback FROM PUBLIC, anon;/);
      expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON public\.content_feedback TO authenticated;/);
    });

    it('R2-05: post_likes est étendu avec la colonne reaction et contrainte CHECK de sémantique', () => {
      expect(sql).toMatch(/ADD COLUMN reaction TEXT NOT NULL DEFAULT 'like'/);
      expect(sql).toMatch(/CHECK \(reaction IN \('like', 'useful', 'security', 'bag', 'heart', 'fire'\)\)/);
      expect(sql).toMatch(/post_likes_insert[\s\S]+user_id = \(SELECT auth\.uid\(\)\)/);
      expect(sql).toMatch(/post_likes_delete[\s\S]+user_id = \(SELECT auth\.uid\(\)\)/);
    });

    it('R2-06: user_follows interdit formellement l\'auto-suivi via contrainte CHECK', () => {
      expect(sql).toMatch(/CONSTRAINT user_follows_no_self_follow\s+CHECK \(follower_id <> following_id\)/);
      expect(sql).toMatch(/user_follows_insert[\s\S]+follower_id = \(SELECT auth\.uid\(\)\)/);
      expect(sql).toMatch(/user_follows_delete[\s\S]+follower_id = \(SELECT auth\.uid\(\)\)/);
    });

    it('R2-07: fonctions RPC utilitaires toggle_post_save et submit_content_feedback sécurisées', () => {
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.toggle_post_save\(p_post_id UUID\)/);
      expect(sql).toMatch(/SET search_path = public, pg_temp/);
      expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.toggle_post_save\(UUID\) FROM PUBLIC, anon;/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.toggle_post_save\(UUID\) TO authenticated, service_role;/);

      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.submit_content_feedback/);
      expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.submit_content_feedback\(TEXT, UUID, TEXT, TEXT\) FROM PUBLIC, anon;/);
      expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.submit_content_feedback\(TEXT, UUID, TEXT, TEXT\) TO authenticated, service_role;/);
    });
  });

  describe('Typage TypeScript (src/lib/supabase/types.ts)', () => {
    it('TS-01: les interfaces et types sociaux sont cohérents avec le schéma relationnel', () => {
      const sampleReaction: PostReactionType = 'security';
      expect(['like', 'useful', 'security', 'bag', 'heart', 'fire']).toContain(sampleReaction);

      const sampleSave: DatabasePostSave = {
        id: '11111111-1111-1111-1111-111111111111',
        post_id: '22222222-2222-2222-2222-222222222222',
        user_id: '33333333-3333-3333-3333-333333333333',
        created_at: new Date().toISOString(),
      };
      expect(sampleSave.user_id).toBeDefined();

      const sampleFeedback: DatabaseContentFeedback = {
        id: '11111111-1111-1111-1111-111111111111',
        user_id: '33333333-3333-3333-3333-333333333333',
        target_type: 'post',
        target_id: '22222222-2222-2222-2222-222222222222',
        feedback_type: 'hide',
        reason: 'Contenu inadapté',
        created_at: new Date().toISOString(),
      };
      expect(['post', 'author', 'carnet']).toContain(sampleFeedback.target_type);
      expect(['hide', 'less_like_this', 'report']).toContain(sampleFeedback.feedback_type);

      const sampleFollow: DatabaseUserFollow = {
        id: '11111111-1111-1111-1111-111111111111',
        follower_id: '33333333-3333-3333-3333-333333333333',
        following_id: '44444444-4444-4444-4444-444444444444',
        created_at: new Date().toISOString(),
      };
      expect(sampleFollow.follower_id).not.toBe(sampleFollow.following_id);
    });
  });
});
