'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    return <img src={url} alt="" width={32} height={32} loading="lazy" decoding="async" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ddebd8] text-[12px] font-bold text-[#17402C]">
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

  // Copier le lien / partager vers une app : en haut à droite de la carte, à
  // la place et au gabarit des « ··· » (même hauteur que la pastille auteur).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [topHost, setTopHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTopHost(rootRef.current?.closest<HTMLElement>('.lkdv-feed-post') ?? null);
  }, []);

  const topActions = (
    <div className="lkdv-share-top" role="group" aria-label="Partager ailleurs">
      <button type="button" aria-label={copied ? 'Lien copié' : 'Copier le lien'} onClick={() => void copy()}>
        <Icon name="link" size={20} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Envoyer vers une autre app" onClick={() => void shareNative()}>
        <Icon name="share" size={20} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className="lkdv-post-panel lkdv-share-panel" role="dialog" aria-modal="true" aria-label="Partager la publication">
      <div id={`share-conv-${post.id}`} className="lkdv-post-panel-body lkdv-share-list">
        {!user?.id ? (
          <button type="button" className="lkdv-section-action" aria-label="Se connecter pour envoyer" onClick={() => onRequireAuth?.('comment')}>
            <Icon name="lock" size={18} aria-hidden="true" />
          </button>
        ) : loading ? (
          <p className="lkdv-section-loading">Chargement des conversations…</p>
        ) : filteredConversations.length === 0 ? (
          <p className="lkdv-section-empty">{query.trim() ? 'Aucun destinataire trouvé.' : 'Aucune conversation pour l’instant.'}</p>
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
                  aria-label={`Envoyer à ${title}`}
                  onClick={async () => {
                    const ok = await send(post.id, conversation.id);
                    toast(ok ? 'Publication envoyée.' : 'Envoi impossible.', ok ? 'success' : 'error');
                    if (ok) onClose();
                  }}
                >
                  {sending === conversation.id ? '…' : <Icon name="send" size={15} aria-hidden="true" />}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Recherche : seule commande du bas, petite, au style de la barre d'action. */}
      <label className="lkdv-share-search">
        <Icon name="search" size={15} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher"
          aria-label="Rechercher une personne ou un groupe"
        />
      </label>

      {topHost ? createPortal(topActions, topHost) : topActions}
    </div>
  );
}

export default PostSharePanel;
