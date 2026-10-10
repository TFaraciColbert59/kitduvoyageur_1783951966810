/**
 * API Route: /api/community/interactions
 *
 * Handles persistent social interactions for LKDV Community (Requirement R2 / R4):
 * - Save / Bookmark toggle (persisted in public.post_saves)
 * - Explicit Content Feedback: 'hide', 'less_like_this', 'report' (persisted in public.content_feedback)
 *
 * Enforces strict user authentication, UUID validation, and idempotent RPC / table mutations.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_TARGET_TYPES = new Set(['post', 'author', 'carnet']);
const VALID_FEEDBACK_TYPES = new Set(['hide', 'less_like_this', 'report']);

export async function POST(request: Request) {
  try {
    // 1. Authenticate session caller
    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      return NextResponse.json(
        { error: 'Configuration serveur indisponible' },
        { status: 503 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: 'Authentification requise pour cette action' },
        { status: 401 }
      );
    }

    // 2. Parse request payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps de requête JSON invalide' },
        { status: 400 }
      );
    }

    const action = body.action || (body.feedbackType ? 'feedback' : undefined);
    const postId = body.postId || body.post_id;
    let targetType = body.targetType || body.target_type;
    let targetId = body.targetId || body.target_id || postId;
    let feedbackType = body.feedbackType || body.feedback_type;
    const reason = body.reason || null;

    if (!action) {
      return NextResponse.json(
        { error: 'Paramètre "action" requis ("save", "feedback", "hide", "less_like_this", "report")' },
        { status: 400 }
      );
    }

    // 3. Handle Save Toggle
    if (action === 'save' || action === 'toggle_save') {
      if (!postId || !UUID_REGEX.test(postId)) {
        return NextResponse.json(
          { error: 'Paramètre "postId" UUID valide requis pour la sauvegarde' },
          { status: 400 }
        );
      }

      // First attempt: atomic RPC toggle_post_save
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_post_save', {
          p_post_id: postId,
        });

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          return NextResponse.json({
            success: true,
            saved: Boolean(rpcData.saved),
            postId,
          });
        }
      } catch {
        // Fallback to direct table mutation if RPC is unavailable in test mocks
      }

      // Fallback: check existing save row and toggle
      const { data: existing, error: selectErr } = await supabase
        .from('post_saves')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (selectErr) {
        console.error('[/api/community/interactions] post_saves select error:', selectErr);
        return NextResponse.json(
          { error: 'Erreur lors de la lecture des favoris' },
          { status: 500 }
        );
      }

      if (existing) {
        const { error: delErr } = await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (delErr) {
          console.error('[/api/community/interactions] post_saves delete error:', delErr);
          return NextResponse.json(
            { error: 'Impossible de retirer des favoris' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          saved: false,
          postId,
        });
      } else {
        const { error: insErr } = await supabase
          .from('post_saves')
          .insert({
            post_id: postId,
            user_id: user.id,
          });

        if (insErr) {
          console.error('[/api/community/interactions] post_saves insert error:', insErr);
          return NextResponse.json(
            { error: 'Impossible d’enregistrer la publication' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          saved: true,
          postId,
        });
      }
    }

    // 4. Handle Feedback ('feedback', 'hide', 'less_like_this', 'report')
    if (action === 'hide') {
      feedbackType = 'hide';
      targetType = targetType || 'post';
    } else if (action === 'less_like_this') {
      feedbackType = 'less_like_this';
      targetType = targetType || 'post';
    } else if (action === 'report') {
      feedbackType = 'report';
      targetType = targetType || 'post';
    }

    if (action === 'feedback' || feedbackType) {
      targetType = targetType || 'post';

      if (!VALID_TARGET_TYPES.has(targetType)) {
        return NextResponse.json(
          { error: `targetType invalide: "${targetType}". Attendu: 'post' | 'author' | 'carnet'` },
          { status: 400 }
        );
      }

      if (!feedbackType || !VALID_FEEDBACK_TYPES.has(feedbackType)) {
        return NextResponse.json(
          { error: `feedbackType invalide: "${feedbackType}". Attendu: 'hide' | 'less_like_this' | 'report'` },
          { status: 400 }
        );
      }

      if (!targetId || !UUID_REGEX.test(targetId)) {
        return NextResponse.json(
          { error: 'Paramètre "targetId" UUID valide requis pour le feedback' },
          { status: 400 }
        );
      }

      // Attempt RPC submit_content_feedback
      try {
        const { data: rpcFeedbackId, error: rpcError } = await supabase.rpc('submit_content_feedback', {
          p_target_type: targetType,
          p_target_id: targetId,
          p_feedback_type: feedbackType,
          p_reason: reason,
        });

        if (!rpcError && rpcFeedbackId) {
          return NextResponse.json({
            success: true,
            feedbackId: rpcFeedbackId,
            feedbackType,
            targetType,
            targetId,
          });
        }
      } catch {
        // Fallback to direct table upsert
      }

      // Fallback: direct upsert into content_feedback
      const { data: feedbackRow, error: upsertErr } = await supabase
        .from('content_feedback')
        .upsert(
          {
            user_id: user.id,
            target_type: targetType,
            target_id: targetId,
            feedback_type: feedbackType,
            reason: reason,
          },
          {
            onConflict: 'user_id,target_type,target_id,feedback_type',
          }
        )
        .select('id')
        .maybeSingle();

      if (upsertErr) {
        console.error('[/api/community/interactions] content_feedback error:', upsertErr);
        return NextResponse.json(
          { error: 'Erreur lors de l’enregistrement du retour utilisateur' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        feedbackId: feedbackRow?.id || 'fb-saved',
        feedbackType,
        targetType,
        targetId,
      });
    }

    return NextResponse.json(
      { error: `Action inconnue: "${action}"` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[/api/community/interactions] Exception non gérée:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la mutation' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId') || searchParams.get('post_id');

    if (!postId || !UUID_REGEX.test(postId)) {
      return NextResponse.json(
        { error: 'Paramètre "postId" UUID valide requis' },
        { status: 400 }
      );
    }

    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      return NextResponse.json({ isSaved: false });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ isSaved: false });
    }

    const { data: saveRow } = await supabase
      .from('post_saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      isSaved: Boolean(saveRow),
      postId,
    });
  } catch {
    return NextResponse.json({ isSaved: false });
  }
}
