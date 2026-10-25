'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/contexts/ToastContext';
import { usePostShareTargets } from './usePostShareTargets';
import type { FeedPost } from './useCommunityFeed';
import type { CommunityAuthReason } from './usePostInteractions';

export interface PostSharePanelProps {
  post: FeedPost;
  user: any;
  onClose: () => void;
  onRequireAuth?: (reason: CommunityAuthReason) => void;
}

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar distant
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ddebd8] text-[11px] font-bold text-[#17402C]">
      {(name || 'V').charAt(0).toUpperCase()}
    </span>
  );
}

export function PostSharePanel({ post, user, onClose, onRequireAuth }: PostSharePanelProps) {
  const { toast } = useToast();
  const { conversations, loading, sending, send } = usePostShareTargets(user?.id);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const filteredConversations = conversations.filter((conversation) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${conversation.title || ''} ${conversation.name || ''}`.toLowerCase().includes(text);
  });

  const permalink = `${typeof window !== 'undefined' ? window.location.origin : ''}/communaute?post=${post.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      toast('Lien copié.', 'success');
    } catch {
      toast('Copie impossible.', 'error');
    }
  };

  const shareNative = async () => {
    if (!user?.id) {
      onRequireAuth?.('comment');
      return;
    }
    try {
      if (navigator.share) await navigator.share({ title: 'Publication LKDV', url: permalink });
      else await copy();
    } catch {
      /* annulé */
    }
  };

  return (
    <div className="lkdv-post-panel" role="dialog" aria-modal="true" aria-label="Partager la publication">
      <div className="lkdv-panel-grab" aria-hidden="true"><span /></div>

      <div className="lkdv-post-panel-body">
        <div className="lkdv-search-box">
          <Icon name="search" size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une personne ou un groupe…"
            aria-label="Rechercher un destinataire"
          />
        </div>
        <div className="lkdv-share-actions">
          <button type="button" className="lkdv-share-action" onClick={() => document.getElementById(`share-conv-${post.id}`)?.scrollIntoView({ behavior: 'smooth' })}>
            <span className="ico"><Icon name="send" size={18} aria-hidden="true" /></span>
            Envoyer
          </button>
          <button type="button" className="lkdv-share-action" onClick={() => void copy()}>
            <span className="ico"><Icon name="link" size={18} aria-hidden="true" /></span>
            {copied ? 'Copié' : 'Copier'}
          </button>
          <button type="button" className="lkdv-share-action" onClick={() => void shareNative()}>
            <span className="ico">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
              </svg>
            </span>
            Partager
          </button>
        </div>

        <div id={`share-conv-${post.id}`} className="mt-1">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#56665D]">Envoyer en message</p>
          {!user?.id ? (
            <button type="button" className="lkdv-section-action" onClick={() => onRequireAuth?.('comment')}>
              Se connecter pour envoyer
            </button>
          ) : loading ? (
            <p className="lkdv-section-loading">Chargement des conversations…</p>
          ) : filteredConversations.length === 0 ? (
            <p className="lkdv-section-empty">Aucun destinataire trouvé.</p>
          ) : (
            filteredConversations.map((conversation) => {
              const title = conversation.title || conversation.name || 'Conversation';
              return (
                <div key={conversation.id} className="lkdv-share-conv">
                  <Avatar url={conversation.avatar_url} name={title} />
                  <div>
                    <b>{title}</b>
                    <small>{conversation.type === 'group' ? 'Groupe' : 'Message privé'}</small>
                  </div>
                  <button
                    type="button"
                    disabled={sending === conversation.id}
                    onClick={async () => {
                      const ok = await send(post.id, conversation.id);
                      toast(ok ? 'Publication envoyée.' : 'Envoi impossible.', ok ? 'success' : 'error');
                      if (ok) onClose();
                    }}
                  >
                    {sending === conversation.id ? '…' : 'Envoyer'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="lkdv-share-mini" role="group" aria-label="Actions de partage">
        <button type="button" aria-label="Envoyer en message" onClick={() => document.getElementById(`share-conv-${post.id}`)?.scrollIntoView({ behavior: 'smooth' })}>
          <Icon name="send" size={15} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Copier le lien" onClick={() => void copy()}>
          <Icon name="link" size={15} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Partager via l’appareil" onClick={() => void shareNative()}>
          <Icon name="share" size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default PostSharePanel;
