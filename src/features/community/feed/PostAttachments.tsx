'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { canShowCommunityReproduction } from '@/lib/community/media';
import { useToast } from '@/contexts/ToastContext';
import type { FeedPost } from './useCommunityFeed';

/**
 * Pièces jointes d'un post du fil, sous la carte :
 * - kit public lié : « Importer dans mon matériel » (fork serveur autorisé) ;
 * - carnet lié : instantané figé du carnet publié (jamais de lecture live).
 */
export function PostAttachments({ post, userId }: { post: FeedPost; userId?: string | null }) {
  const { toast } = useToast();
  const [verifiedKitId, setVerifiedKitId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const linkedKit = typeof post.linked_kit_id === 'string' ? post.linked_kit_id : null;
  const snapshot = (post.snapshot_payload ?? null) as Record<string, string | undefined> | null;

  useEffect(() => {
    let alive = true;
    setVerifiedKitId(null);
    setOpen(false);
    if (!canShowCommunityReproduction(linkedKit)) return () => { alive = false; };
    void createClient()
      .from('materiel_kits')
      .select('id')
      .eq('id', linkedKit!)
      .eq('is_public', true)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (alive && !error && data?.id === linkedKit) setVerifiedKitId(linkedKit);
      });
    return () => { alive = false; };
  }, [linkedKit]);

  const fork = async () => {
    if (!verifiedKitId || busy) return;
    if (!userId) {
      toast('Connectez-vous pour importer un kit.', 'info');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/materiel/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: verifiedKitId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Import impossible');
      }
      setDone(true);
      setOpen(false);
      toast('Kit importé dans votre matériel.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Import impossible', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!verifiedKitId && !snapshot) return null;

  return (
    <div className="lkdv-post-attachments">
      {verifiedKitId ? (
        <div className="lkdv-social-reproduce">
          <button
            type="button"
            className="lkdv-social-reproduce-trigger"
            aria-label="Reproduire le kit de cette publication"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Reproduire ce kit
          </button>
          {open ? (
            <div className="lkdv-social-reproduce-menu">
              <p>Kit public partagé</p>
              <button type="button" disabled={busy || done} onClick={() => void fork()}>
                {done ? 'Déjà importé' : busy ? 'Import en cours…' : 'Importer dans mon matériel'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {snapshot ? (
        <div className="lkdv-post-snapshot">
          {snapshot.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element -- couverture distante figée
            <img src={snapshot.cover_image} alt={snapshot.title || 'Carnet publié'} loading="lazy" />
          ) : null}
          <div className="lkdv-post-snapshot-body">
            <span className="lkdv-post-snapshot-tag">Carnet · instantané publié</span>
            <b>{snapshot.title || 'Carnet de voyage'}</b>
            {snapshot.destination ? <small>{snapshot.destination}</small> : null}
            {snapshot.description ? <p>{snapshot.description}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PostAttachments;
