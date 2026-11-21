'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
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
  permalinkOverride?: string;
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

export function PostSharePanel({ post, user, onClose, onRequireAuth, permalinkOverride }: PostSharePanelProps) {
  const { toast } = useToast();
  const { conversations, loading, sending, send } = usePostShareTargets(user?.id);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [sentIds, setSentIds] = useState<string[]>([]);
  const filteredConversations = conversations.filter((conversation) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return `${conversation.title || ''} ${conversation.name || ''}`.toLowerCase().includes(text);
  });

  const permalink =
    permalinkOverride ||
    `${typeof window !== 'undefined' ? window.location.origin : ''}/communaute?post=${post.id}`;

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
  const swipeStartRef = useRef<{ pointerId: number; startY: number } | null>(null);
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="lkdv-post-panel lkdv-share-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Partager la publication"
      onPointerDown={(e) => {
        if (e.button > 0) return;
        const body = rootRef.current?.querySelector('.lkdv-share-list') as HTMLElement | null;
        if (body && body.scrollTop > 2) return;
        swipeStartRef.current = { pointerId: e.pointerId, startY: e.clientY };
      }}
      onPointerUp={(e) => {
        const sw = swipeStartRef.current;
        swipeStartRef.current = null;
        if (sw && sw.pointerId === e.pointerId && e.clientY - sw.startY > 48) {
          onClose();
        }
      }}
      onPointerCancel={() => {
        swipeStartRef.current = null;
      }}
    >
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
            const alreadySent = sentIds.includes(conversation.id);
            return (
              <div key={conversation.id} className={`lkdv-share-conv${alreadySent ? ' is-sent' : ''}`}>
                <Avatar url={conversation.avatar_url} name={title} />
                <div>
                  <b>{title}</b>
                  <small>{conversation.type === 'group' ? 'Groupe' : 'Message privé'}</small>
                </div>
                <button
                  type="button"
                  disabled={sending === conversation.id}
                  className={alreadySent ? 'is-sent' : undefined}
                  aria-label={alreadySent ? `Envoyé à ${title}` : `Envoyer à ${title}`}
                  onClick={async () => {
                    const ok = await send(post.id, conversation.id);
                    if (ok) {
                      setSentIds((prev) =>
                        prev.includes(conversation.id) ? prev : [...prev, conversation.id],
                      );
                    }
                    toast(ok ? `Envoyé à ${title}.` : 'Envoi impossible.', ok ? 'success' : 'error');
                  }}
                >
                  {sending === conversation.id ? (
                    '…'
                  ) : alreadySent ? (
                    <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Icon name="send" size={15} aria-hidden="true" />
                  )}
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
