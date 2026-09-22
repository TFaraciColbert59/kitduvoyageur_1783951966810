'use client';
import { lkvAlert } from '@/components/ui/dialogs';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, IconButton, Tabs } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ClubMessage {
  id: string;
  author: string;
  author_id?: string;
  author_avatar?: string;
  tag?: string;
  time: string;
  content: string;
  attachment?: string | null;
  location?: { lat: number; lng: number } | string | null;
  reply_to?: string | null;
  reply_to_author?: string | null;
  likes: number;
  replies: number;
  is_pinned?: boolean;
  is_guide?: boolean;
  title?: string;
}

interface ClubDiscussionCardProps {
  clubId?: string;
  clubName?: string;
  discussions?: ClubMessage[];
  onRefresh?: () => void;
  user?: any;
  filterType?: 'all' | 'guides';
  onFilterChange?: (filter: 'all' | 'guides') => void;
}

export default function ClubDiscussionCard({
  clubId,
  clubName = 'le club',
  discussions = [],
  onRefresh,
  user,
  filterType = 'all',
  onFilterChange,
}: ClubDiscussionCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const { triggerHaptic } = useHapticFeedback();
  const [newMessage, setNewMessage] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ClubMessage | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  const safeDiscussions = Array.isArray(discussions) ? discussions : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeDiscussions.length]);

  const handleSendMessage = async (
    e?: React.FormEvent,
    mediaUrl?: string,
    locationData?: { lat: number; lng: number },
    gpxAttachment?: string
  ) => {
    if (e) e.preventDefault();
    const msg = newMessage.trim();
    if (!msg && !mediaUrl && !locationData && !gpxAttachment) return;
    if (!clubId || !user) {
      lkvAlert('Veuillez vous connecter pour participer aux discussions.');
      return;
    }

    setLoading(true);
    triggerHaptic('medium');

    const contentText = msg || (gpxAttachment ? gpxAttachment : mediaUrl ? '📎 Pièce jointe' : '📍 Position partagée');

    try {
      if (replyingTo) {
        const { error } = await supabase.from('club_topic_replies').insert({
          topic_id: replyingTo.id,
          author_id: user.id,
          content: contentText,
          parent_id: replyingTo.reply_to || null,
        });

        if (!error) {
          await supabase
            .from('club_topics')
            .update({ replies_count: (replyingTo.replies || 0) + 1 })
            .eq('id', replyingTo.id);
        }
      } else {
        const titleText = newTitle.trim() || msg.slice(0, 50) || (gpxAttachment ? 'Trace GPX partagée' : 'Message');
        await supabase.from('club_topics').insert({
          club_id: clubId,
          author_id: user.id,
          title: titleText,
          content: contentText,
          is_pinned: filterType === 'guides',
          image_url: mediaUrl || null,
        });
      }

      setNewMessage('');
      setNewTitle('');
      setReplyingTo(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clubId || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      lkvAlert('Le fichier est trop volumineux (max 10 Mo)');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clubId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('group-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        const fallbackMsg = newMessage.trim() || `📎 ${file.name}`;
        await handleSendMessage(undefined, undefined, undefined, fallbackMsg);
      } else {
        const { data: urlData } = supabase.storage
          .from('group-media')
          .getPublicUrl(data.path);

        await handleSendMessage(undefined, urlData.publicUrl);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      lkvAlert('Erreur d\'upload : ' + (err?.message || 'inconnue'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleShareLocation = async () => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      lkvAlert('La géolocalisation n\'est pas disponible');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const locationMsg = `📍 Position partagée : ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
        await handleSendMessage(undefined, undefined, loc, locationMsg);
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err?.message || err);
        lkvAlert('Impossible d\'obtenir votre position. Vérifiez les permissions de votre navigateur.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleToggleLike = async (msg: ClubMessage) => {
    if (!user) {
      lkvAlert('Connectez-vous pour aimer ce message');
      return;
    }

    triggerHaptic('selection');
    const isLiked = likedMap[msg.id];
    setLikedMap((prev) => ({ ...prev, [msg.id]: !isLiked }));

    try {
      if (isLiked) {
        await supabase.from('club_topic_likes').delete().eq('topic_id', msg.id).eq('user_id', user.id);
        await supabase.from('club_topics').update({ likes_count: Math.max(0, (msg.likes || 0) - 1) }).eq('id', msg.id);
      } else {
        await supabase.from('club_topic_likes').insert({ topic_id: msg.id, user_id: user.id });
        await supabase.from('club_topics').update({ likes_count: (msg.likes || 0) + 1 }).eq('id', msg.id);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('Like toggle error:', err);
    }
  };

  const filteredDiscussions = filterType === 'guides'
    ? safeDiscussions.filter((d) => d.is_pinned || d.is_guide)
    : safeDiscussions;

  return (
    <Card className="flex h-[640px] flex-col p-[var(--space-6)] transition-all duration-[var(--motion-control-duration)]">
      <div className="mb-[var(--space-4)] flex shrink-0 items-center justify-between">
        <div>
          <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            Discussions <span className="font-serif font-normal italic text-[color:var(--lkv-text-primary)]">du club</span>
          </h2>
          <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Échanges, conseils et partages dans {clubName}</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          {onFilterChange && (
            <Tabs
              variant="segmented"
              ariaLabel="Filtrer les discussions"
              value={filterType}
              onChange={(id) => onFilterChange(id as 'all' | 'guides')}
              options={[
                { id: 'all', label: `Tous (${safeDiscussions.length})` },
                { id: 'guides', label: '📌 Guides & Astuces' },
              ]}
              className="w-auto"
            />
          )}
        </div>
      </div>

      <div className="mb-[var(--space-4)] flex-1 space-y-[var(--space-4)] overflow-y-auto pr-[var(--space-2)]">
        {filteredDiscussions.length === 0 ? (
          <EmptyState
            icon={<Icon name="ChatBubbleLeftRightIcon" size={22} aria-hidden="true" />}
            title="Aucun message pour le moment"
            description="Lancez la première discussion dans le club !"
          />
        ) : (
          filteredDiscussions.map((msg) => {
            const isUserLiked = !!likedMap[msg.id];
            const msgAuthor = msg.author || 'Voyageur';
            const msgContent = msg.content || '';
            const msgTitle = msg.title || '';

            return (
              <div key={msg.id} className="group flex items-start gap-[var(--space-3)]">
                <Link
                  href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
                  onClick={() => triggerHaptic('light')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] transition-transform hover:scale-105"
                  aria-label={`Voir le profil de ${msgAuthor}`}
                >
                  {msg.author_avatar ? (
                    <img src={msg.author_avatar} alt={msgAuthor} className="h-full w-full object-cover" />
                  ) : (
                    (msgAuthor.charAt(0) || 'V').toUpperCase()
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="mb-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-2)]">
                    <Link
                      href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
                      onClick={() => triggerHaptic('light')}
                      className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] hover:underline"
                    >
                      {msgAuthor}
                    </Link>
                    {msg.tag && (
                      <Badge className="font-mono uppercase">{msg.tag}</Badge>
                    )}
                    {msg.is_pinned && (
                      <Badge tone="warn" className="font-mono">📌 ÉPINGLÉ</Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        triggerHaptic('light');
                        setReplyingTo(replyingTo?.id === msg.id ? null : msg);
                        setNewMessage('');
                        composerInputRef.current?.focus();
                      }}
                      className="ml-[var(--space-1)] px-[var(--space-2)] text-[length:var(--lkv-text-caption-2)]"
                      aria-pressed={replyingTo?.id === msg.id}
                    >
                      Répondre
                    </Button>
                    <span className="ml-auto font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{msg.time || ''}</span>
                  </div>

                  {msg.reply_to && (
                    <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] italic text-[color:var(--lkv-text-muted)]">
                      ↩ en réponse à {msg.reply_to_author || 'un message'}
                    </p>
                  )}

                  <div className="mb-[var(--space-2)] rounded-[var(--lkv-radius-md)] rounded-tl-none bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-4)]">
                    {msgTitle && msgTitle !== msgContent.slice(0, 50) && (
                      <h4 className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{msgTitle}</h4>
                    )}
                    <p className="whitespace-pre-wrap font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">
                      {msgContent.split(/(#\w+)/g).map((part, i) =>
                        part.startsWith('#') ? (
                          <span key={i} className="font-semibold text-[color:var(--lkv-info)]">
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      )}
                    </p>

                    {msg.attachment && (
                      <div className="mt-[var(--space-3)] max-h-60 overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--btn-tint)]">
                        <img
                          src={msg.attachment}
                          alt="Pièce jointe"
                          className="h-auto max-h-60 w-full rounded-[var(--lkv-radius-md)] object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {msg.location && (
                      <a
                        href={`https://www.google.com/maps?q=${
                          typeof msg.location === 'string'
                            ? msg.location
                            : `${(msg.location as any).lat},${(msg.location as any).lng}`
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]"
                      >
                        <Icon name="MapPinIcon" size={14} className="text-[color:var(--lkv-forest-700)]" aria-hidden="true" />
                        <span>
                          {typeof msg.location === 'string'
                            ? msg.location
                            : `📍 ${(msg.location as any).lat?.toFixed(5)}, ${(msg.location as any).lng?.toFixed(5)}`}
                        </span>
                      </a>
                    )}

                    <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={isUserLiked ? "Je n'aime plus" : "J'aime"}
                        onClick={() => handleToggleLike(msg)}
                        aria-pressed={isUserLiked}
                        className="px-[var(--space-3)]"
                      >
                        <motion.svg
                          whileTap={{ scale: 1.3 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          viewBox="0 0 24 24"
                          className="h-4 w-4 transition-transform motion-reduce:transition-none"
                          fill={isUserLiked ? 'var(--lkv-danger)' : 'none'}
                          stroke={isUserLiked ? 'var(--lkv-danger)' : 'currentColor'}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </motion.svg>
                        <span className="font-mono">{msg.likes || 0}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Répondre au message"
                        onClick={() => {
                          setReplyingTo(msg);
                          composerInputRef.current?.focus();
                        }}
                        className="px-[var(--space-3)]"
                      >
                        <Icon name="message-square" size={13} aria-hidden="true" />
                        <span>{msg.replies || 0} réponses</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        aria-label="Envoyer une photo ou vidéo"
        onChange={handleFileUpload}
      />
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        aria-label="Partager une trace GPX"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !clubId || !user) return;
          const fileName = file.name.replace('.gpx', '');
          await handleSendMessage(undefined, undefined, undefined, `🗺️ Trace GPX partagée : ${fileName}`);
        }}
      />

      {replyingTo && (
        <div className="mb-[var(--space-2)] flex shrink-0 items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">
          <span className="font-bold">↩ Répondre à {replyingTo.author || 'Voyageur'}</span>
          <span className="flex-1 truncate text-[color:var(--lkv-text-muted)]">
            « {(replyingTo.content || '').slice(0, 60)}{(replyingTo.content || '').length > 60 ? '…' : ''} »
          </span>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Annuler la réponse"
            onClick={() => setReplyingTo(null)}
          >
            <Icon name="XMarkIcon" size={14} aria-hidden="true" />
          </IconButton>
        </div>
      )}

      <div className="relative shrink-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-[var(--space-3)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
            {user?.user_metadata?.first_name
              ? user.user_metadata.first_name.charAt(0)
              : user?.user_metadata?.full_name
              ? user.user_metadata.full_name.charAt(0)
              : 'V'}
          </div>
        </div>
        <input
          ref={composerInputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || uploading || locating}
          placeholder={
            uploading
              ? 'Upload en cours...'
              : locating
              ? 'Localisation...'
              : replyingTo
              ? `Répondre à ${replyingTo.author || 'Voyageur'}...`
              : 'Ajouter un message pour le club...'
          }
          aria-label="Ajouter un message pour le club"
          className="min-h-[44px] w-full rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] pl-14 pr-[140px] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-[var(--space-1)] pr-[var(--space-2)]">
          <IconButton
            size="sm"
            variant="glass"
            onClick={() => gpxInputRef.current?.click()}
            disabled={uploading || loading}
            aria-label="Partager une trace GPX"
          >
            <span className="text-[length:var(--lkv-text-caption-2)]" aria-hidden>🗺️</span>
          </IconButton>
          <IconButton
            size="sm"
            variant="glass"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            aria-label="Envoyer une photo"
          >
            <Icon name="PhotoIcon" size={13} aria-hidden="true" />
          </IconButton>
          <IconButton
            size="sm"
            variant="glass"
            onClick={handleShareLocation}
            disabled={locating || loading}
            aria-label="Partager ma position"
          >
            <Icon name="MapPinIcon" size={13} aria-hidden="true" />
          </IconButton>
          <IconButton
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() || loading}
            aria-label="Envoyer"
            variant={Boolean(newMessage.trim()) ? 'solid' : 'glass'}
          >
            <Icon name="PaperAirplaneIcon" size={13} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </Card>
  );
}
