import { lkvAlert } from '@/components/ui/dialogs';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';

interface Message {
  id: string;
  author: string;
  author_id?: string;
  tag?: string;
  time: string;
  content: string;
  attachment?: string | null;
  location?: { lat: number; lng: number } | string | null;
  reply_to?: string | null;
  likes: number;
  replies: number;
}

interface DiscussionCardProps {
  discussions: Message[];
  groupId?: string;
  onRefresh?: () => void;
  user?: any;
}

export default function DiscussionCard({ discussions, groupId, onRefresh, user }: DiscussionCardProps) {
  const supabase = createClient();
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussions]);

  const triggerMessageReward = async (contentText: string) => {
    try {
      await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'group_message',
          target_id: groupId,
          target_type: 'group',
          metadata: { content: contentText }
        })
      });
    } catch (rewardsErr) {
      console.warn('Group message rewards claim error:', rewardsErr);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, location?: { lat: number; lng: number }, gpxAttachment?: string) => {
    if (e) e.preventDefault();
    const msg = newMessage.trim();
    if (!msg && !mediaUrl && !location && !gpxAttachment) return;
    if (!groupId || !user) return;

    setLoading(true);

    const insertData: any = {
      group_id: groupId,
      user_id: user.id,
      content: msg || (gpxAttachment ? gpxAttachment : mediaUrl ? '📎 Pièce jointe' : `📍 Position partagée`),
      ...(replyingTo ? { reply_to: replyingTo.id } : {}),
    };

    if (mediaUrl) insertData.media_url = mediaUrl;
    if (location) insertData.location = location;

    const { error } = await supabase.from('group_messages').insert(insertData);

    if (error) {
      console.error(error);
      lkvAlert('Erreur: ' + error.message);
    } else {
      setNewMessage('');
      setReplyingTo(null);
      if (onRefresh) onRefresh();
      triggerMessageReward(insertData.content);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      lkvAlert('Le fichier est trop volumineux (max 10 Mo)');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${groupId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('group-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.warn('Storage upload failed, sending as text reference:', error);
        const msg = newMessage.trim() || `📎 ${file.name}`;
        const { error: fallbackErr } = await supabase.from('group_messages').insert({
          group_id: groupId,
          user_id: user.id,
          content: msg,
        });
        if (!fallbackErr) {
          triggerMessageReward(msg);
        }
        setNewMessage('');
        if (onRefresh) onRefresh();
      } else {
        const { data: urlData } = supabase.storage
          .from('group-media')
          .getPublicUrl(data.path);

        await handleSendMessage(undefined, urlData.publicUrl);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      lkvAlert('Erreur d\'upload : ' + (err.message || 'inconnue'));
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      lkvAlert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const locationMsg = `📍 Position partagée : ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;

        const { error } = await supabase.from('group_messages').insert({
          group_id: groupId,
          user_id: user.id,
          content: locationMsg,
          location: location,
        });

        if (error) {
          console.error(error);
          lkvAlert('Erreur: ' + error.message);
        } else {
          if (onRefresh) onRefresh();
          triggerMessageReward(locationMsg);
        }
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err?.message || `Code ${err?.code}` || err);
        lkvAlert('Impossible d\'obtenir votre position. Vérifiez les permissions de votre navigateur.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const totalMessages = discussions.length;

  return (
    <Card className="flex h-[600px] flex-col p-[var(--space-6)] transition-all duration-[var(--motion-control-duration)]">
      <div className="mb-[var(--space-2)] flex shrink-0 items-start justify-between">
        <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          Discussion <span className="font-serif italic font-normal text-[color:var(--lkv-text-primary)]">du voyage</span>
        </h2>
        <Badge>{totalMessages} messages</Badge>
      </div>

      <div className="mb-[var(--space-4)] flex shrink-0 justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); composerInputRef.current?.focus(); }}
        >
          Voir tout
        </Button>
      </div>

      <div className="mb-[var(--space-4)] flex-1 space-y-[var(--space-4)] overflow-y-auto pr-[var(--space-2)]">
        {discussions.length === 0 && (
          <EmptyState
            compact
            icon={<Icon name="ChatBubbleLeftRightIcon" size={22} aria-hidden="true" />}
            title="Soyez le premier à lancer la discussion"
            description="Partagez une info, un point de rendez-vous ou une photo avec l'équipe."
          />
        )}
        {discussions.map(msg => (
          <div key={msg.id} className="flex gap-[var(--space-3)]">
            <Link
              href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-primary)]/10 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] transition-colors hover:bg-[color:var(--lkv-primary)]/20"
              aria-label={`Voir le profil de ${msg.author}`}
            >
              {msg.author.charAt(0)}
            </Link>
            <div className="flex-1">
              <div className="mb-[var(--space-1)] flex items-center gap-[var(--space-2)]">
                <Link
                  href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
                  className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] hover:underline"
                >
                  {msg.author}
                </Link>
                {msg.tag && <Badge>{msg.tag}</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setReplyingTo(replyingTo?.id === msg.id ? null : msg); setNewMessage(''); composerInputRef.current?.focus(); }}
                  className="ml-[var(--space-1)] px-[var(--space-2)] text-[length:var(--lkv-text-caption-2)]"
                  aria-pressed={replyingTo?.id === msg.id}
                >
                  Répondre
                </Button>
                <span className="ml-auto font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{msg.time}</span>
              </div>

              {msg.reply_to && (
                <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] italic text-[color:var(--lkv-text-muted)]">
                  ↩ en réponse à {discussions.find((d) => d.id === msg.reply_to)?.author || 'un message'}
                </p>
              )}

              <div className="mb-[var(--space-2)] rounded-[var(--lkv-radius-md)] rounded-tl-none bg-[color:var(--lkv-surface-muted)] p-[var(--space-4)]">
                <p className="whitespace-pre-wrap font-sans text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-primary)]">
                  {msg.content.split(/(#\w+)/g).map((part, i) =>
                    part.startsWith('#') ? <span key={i} className="font-semibold text-[color:var(--lkv-info)]">{part}</span> : part
                  )}
                </p>

                {msg.attachment && (
                  <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-card)] p-[var(--space-3)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)]/10 text-[color:var(--lkv-text-primary)]">
                      <Icon name="MapIcon" size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{msg.attachment}</p>
                      <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Pièce jointe</p>
                    </div>
                    <IconButton
                      variant="glass"
                      size="sm"
                      className="ml-auto"
                      aria-label="Ouvrir la pièce jointe"
                      onClick={() => {
                        const src = msg.attachment;
                        if (!src) return;
                        const a = document.createElement('a');
                        a.href = src.trim().startsWith('http') ? src.trim() : `https://${src.trim()}`;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                      }}
                    >
                      <Icon name="ArrowDownTrayIcon" size={14} aria-hidden="true" />
                    </IconButton>
                  </div>
                )}
                {msg.location && (
                  <a
                    href={`https://www.google.com/maps?q=${typeof msg.location === 'string' ? msg.location : `${(msg.location as any).lat},${(msg.location as any).lng}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]"
                  >
                    <Icon name="MapPinIcon" size={14} aria-hidden="true" />
                    <span>
                      {typeof msg.location === 'string' ? msg.location : `📍 ${(msg.location as any).lat?.toFixed(5)}, ${(msg.location as any).lng?.toFixed(5)}`}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
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
          if (!file || !groupId || !user) return;
          const fileName = file.name.replace('.gpx', '');
          await handleSendMessage(undefined, undefined, undefined, `🗺️ Trace GPX : ${fileName}`);
        }}
      />

      <div className="relative shrink-0">
        {replyingTo && (
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">
            <span className="font-bold">↩ Répondre à {replyingTo.author}</span>
            <span className="flex-1 truncate text-[color:var(--lkv-text-muted)]">« {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''} »</span>
            <IconButton variant="ghost" size="sm" aria-label="Annuler la réponse" onClick={() => setReplyingTo(null)}>
              <Icon name="XMarkIcon" size={14} aria-hidden="true" />
            </IconButton>
          </div>
        )}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-[var(--space-3)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)]">
            {user?.user_metadata?.first_name ? user.user_metadata.first_name.charAt(0) : (user?.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0) : 'V')}
          </div>
        </div>
        <input
          ref={composerInputRef}
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || uploading || locating}
          placeholder={uploading ? "Upload en cours..." : locating ? "Localisation..." : "Ajouter un message pour le groupe..."}
          aria-label="Ajouter un message pour le groupe"
          className="min-h-[48px] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] pl-14 pr-[152px] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-[var(--space-1)] pr-[var(--space-2)]">
          <IconButton
            variant="glass"
            size="sm"
            onClick={() => gpxInputRef.current?.click()}
            disabled={uploading || loading}
            aria-label="Partager une trace GPX"
          >
            <span aria-hidden>🗺️</span>
          </IconButton>
          <IconButton
            variant="glass"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            aria-label="Envoyer une photo ou vidéo"
          >
            <Icon name="PhotoIcon" size={16} aria-hidden="true" />
          </IconButton>
          <IconButton
            variant="glass"
            size="sm"
            onClick={handleShareLocation}
            disabled={locating || loading}
            aria-label="Partager ma position"
          >
            <Icon name="MapPinIcon" size={16} aria-hidden="true" />
          </IconButton>
          <IconButton
            variant="solid"
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() || loading}
            aria-label="Envoyer le message"
          >
            <Icon name="PaperAirplaneIcon" size={14} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </Card>
  );
}
