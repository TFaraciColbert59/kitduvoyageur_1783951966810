'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
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
      alert('Veuillez vous connecter pour participer aux discussions.');
      return;
    }

    setLoading(true);
    triggerHaptic('medium');

    const contentText = msg || (gpxAttachment ? gpxAttachment : mediaUrl ? '📎 Pièce jointe' : '📍 Position partagée');

    try {
      if (replyingTo) {
        // It's a reply to a topic
        const { error } = await supabase.from('club_topic_replies').insert({
          topic_id: replyingTo.id,
          author_id: user.id,
          content: contentText,
          parent_id: replyingTo.reply_to || null,
        });

        if (!error) {
          // Increment reply counter on the parent topic
          await supabase
            .from('club_topics')
            .update({ replies_count: (replyingTo.replies || 0) + 1 })
            .eq('id', replyingTo.id);
        }
      } else {
        // It's a new topic / discussion post
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
      alert('Le fichier est trop volumineux (max 10 Mo)');
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
      alert('Erreur d\'upload : ' + (err?.message || 'inconnue'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleShareLocation = async () => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      alert('La géolocalisation n\'est pas disponible');
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
        alert('Impossible d\'obtenir votre position. Vérifiez les permissions de votre navigateur.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleToggleLike = async (msg: ClubMessage) => {
    if (!user) {
      alert('Connectez-vous pour aimer ce message');
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
    <div className="glass p-6 rounded-2xl flex flex-col h-[640px] transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="font-display font-bold text-xl text-[#17402C]">
            Discussions <span className="font-serif italic font-normal text-[#17402C]">du club</span>
          </h2>
          <p className="text-xs text-[#5C6B5E]">Échanges, conseils et partages dans {clubName}</p>
        </div>
        <div className="flex items-center gap-2">
          {onFilterChange && (
            <div className="glass-capsule-bar p-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => onFilterChange('all')}
                className={`glass-capsule-segment !py-1 !px-2.5 text-xs font-bold ${filterType === 'all' ? 'active' : ''}`}
              >
                Tous ({safeDiscussions.length})
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('guides')}
                className={`glass-capsule-segment !py-1 !px-2.5 text-xs font-bold ${filterType === 'guides' ? 'active' : ''}`}
              >
                📌 Guides & Astuces
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 custom-scrollbar">
        {filteredDiscussions.length === 0 ? (
          <div className="text-center py-16 text-[#5C6B5E] text-xs">
            <span className="text-3xl block mb-2">💬</span>
            <p className="font-bold text-[#17402C] text-sm">Aucun message pour le moment</p>
            <p className="mt-1">Lancez la première discussion dans le club !</p>
          </div>
        ) : (
          filteredDiscussions.map((msg) => {
            const isUserLiked = !!likedMap[msg.id];
            const msgAuthor = msg.author || 'Voyageur';
            const msgContent = msg.content || '';
            const msgTitle = msg.title || '';

            return (
              <div key={msg.id} className="flex gap-3 items-start group">
                <Link
                  href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
                  onClick={() => triggerHaptic('light')}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-[#17402C] to-[#1E5238] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                >
                  {msg.author_avatar ? (
                    <img src={msg.author_avatar} alt={msgAuthor} className="w-full h-full object-cover" />
                  ) : (
                    (msgAuthor.charAt(0) || 'V').toUpperCase()
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
                      onClick={() => triggerHaptic('light')}
                      className="font-bold text-sm text-[#17402C] hover:underline cursor-pointer"
                    >
                      {msgAuthor}
                    </Link>
                    {msg.tag && (
                      <span className="glass-pill text-[9px] font-mono uppercase">{msg.tag}</span>
                    )}
                    {msg.is_pinned && (
                      <span className="glass-pill text-[9px] bg-amber-500/10 text-amber-800 font-mono">📌 ÉPINGLÉ</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setReplyingTo(replyingTo?.id === msg.id ? null : msg);
                        setNewMessage('');
                        composerInputRef.current?.focus();
                      }}
                      className="text-[10px] font-bold text-[#17402C] hover:underline ml-1"
                    >
                      Répondre
                    </button>
                    <span className="text-xs text-[#5C6B5E] font-mono ml-auto">{msg.time || ''}</span>
                  </div>

                  {msg.reply_to && (
                    <p className="text-[10px] text-[#5C6B5E] italic mb-1">
                      ↩ en réponse à {msg.reply_to_author || 'un message'}
                    </p>
                  )}

                  <div className="glass-sub-card p-4 rounded-2xl rounded-tl-none mb-2">
                    {msgTitle && msgTitle !== msgContent.slice(0, 50) && (
                      <h4 className="font-bold text-sm text-[#17402C] mb-1">{msgTitle}</h4>
                    )}
                    <p className="text-sm text-[#17402C] font-sans leading-relaxed whitespace-pre-wrap">
                      {msgContent.split(/(#\w+)/g).map((part, i) =>
                        part.startsWith('#') ? (
                          <span key={i} className="text-[#3A63B2] font-semibold">
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      )}
                    </p>

                    {/* Image / Media attachment */}
                    {msg.attachment && (
                      <div className="mt-3 rounded-xl overflow-hidden max-h-60 bg-black/5 border border-[#17402C]/10">
                        <img
                          src={msg.attachment}
                          alt="Pièce jointe"
                          className="w-full h-auto max-h-60 object-cover rounded-xl"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Geolocation Pin */}
                    {msg.location && (
                      <a
                        href={`https://www.google.com/maps?q=${
                          typeof msg.location === 'string'
                            ? msg.location
                            : `${(msg.location as any).lat},${(msg.location as any).lng}`
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 glass-capsule-btn py-1.5 px-3 text-xs font-semibold"
                      >
                        <Icon name="MapPinIcon" size={14} className="relative z-10 text-emerald-700" />
                        <span className="relative z-10">
                          {typeof msg.location === 'string'
                            ? msg.location
                            : `📍 ${(msg.location as any).lat?.toFixed(5)}, ${(msg.location as any).lng?.toFixed(5)}`}
                        </span>
                      </a>
                    )}

                    {/* Footer Actions (Likes & Replies count) */}
                    <div className="mt-3 pt-2 border-t border-[#17402C]/6 flex items-center gap-4 text-xs font-medium text-[#5C6B5E]">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(msg)}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer group/like ${
                          isUserLiked ? 'text-rose-600 font-bold' : 'hover:text-[#17402C]'
                        }`}
                      >
                        <motion.svg
                          whileTap={{ scale: 1.3 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          viewBox="0 0 24 24"
                          className="w-4 h-4 transition-transform"
                          fill={isUserLiked ? '#E11D48' : 'none'}
                          stroke={isUserLiked ? '#E11D48' : 'currentColor'}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </motion.svg>
                        <span className="font-mono text-xs">{msg.likes || 0}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(msg);
                          composerInputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 hover:text-[#17402C] transition-colors"
                      >
                        <Icon name="ChatBubbleLeftIcon" size={14} />
                        <span>{msg.replies || 0} réponses</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !clubId || !user) return;
          const fileName = file.name.replace('.gpx', '');
          await handleSendMessage(undefined, undefined, undefined, `🗺️ Trace GPX partagée : ${fileName}`);
        }}
      />

      {/* Interactive Replying Banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 glass-sub-card rounded-xl text-xs text-[#17402C] flex-shrink-0 animate-fade-in">
          <span className="font-bold">↩ Répondre à {replyingTo.author || 'Voyageur'}</span>
          <span className="text-[#5C6B5E] truncate flex-1">
            « {(replyingTo.content || '').slice(0, 60)}{(replyingTo.content || '').length > 60 ? '…' : ''} »
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-[#5C6B5E] hover:text-red-600 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Composer Input Bar in Liquid Glass */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <div className="w-8 h-8 rounded-full bg-[#17402C] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
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
          className="glass-input w-full pl-13 pr-[140px] text-xs text-[#17402C] min-h-[44px] rounded-full bg-white/80 border border-white focus:outline-none focus:ring-1 focus:ring-[#17402C]"
        />
        <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
          <GlassIconButton
            size="sm"
            onClick={() => gpxInputRef.current?.click()}
            disabled={uploading || loading}
            title="Partager une trace GPX"
            icon={<span className="text-[11px]">🗺️</span>}
          />
          <GlassIconButton
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            title="Envoyer une photo"
            icon={<Icon name="PhotoIcon" size={13} />}
          />
          <GlassIconButton
            size="sm"
            onClick={handleShareLocation}
            disabled={locating || loading}
            title="Partager ma position"
            icon={<Icon name="MapPinIcon" size={13} />}
          />
          <GlassIconButton
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() || loading}
            active={Boolean(newMessage.trim())}
            title="Envoyer"
            icon={<Icon name="PaperAirplaneIcon" size={13} className={Boolean(newMessage.trim()) ? 'text-white' : ''} />}
          />
        </div>
      </div>
    </div>
  );
}
