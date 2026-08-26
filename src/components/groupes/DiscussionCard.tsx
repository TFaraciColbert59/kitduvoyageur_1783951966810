import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

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
      alert('Erreur: ' + error.message);
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
      alert('Le fichier est trop volumineux (max 10 Mo)');
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
      alert('Erreur d\'upload : ' + (err.message || 'inconnue'));
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
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
          alert('Erreur: ' + error.message);
        } else {
          if (onRefresh) onRefresh();
          triggerMessageReward(locationMsg);
        }
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err?.message || `Code ${err?.code}` || err);
        alert('Impossible d\'obtenir votre position. Vérifiez les permissions de votre navigateur.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const totalMessages = discussions.length;

  return (
    <div className="glass p-6 flex flex-col h-[600px] transition-all duration-300">
      <div className="flex justify-between items-start mb-2 flex-shrink-0">
        <h2 className="font-display font-bold text-xl text-[#17402C]">Discussion <span className="font-serif italic font-normal text-[#17402C]">du voyage</span></h2>
        <div className="flex items-center gap-2">
          <span className="glass-pill">{totalMessages} messages</span>
        </div>
      </div>
      
      <div className="flex justify-end mb-4 flex-shrink-0">
        <button
          onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); composerInputRef.current?.focus(); }}
          className="glass-capsule-btn py-1 px-3 text-xs font-semibold"
        >
          <span className="relative z-10">Voir tout</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
        {discussions.length === 0 && (
          <p className="text-center text-sm text-[#5C6B5E] py-4">Soyez le premier à lancer la discussion.</p>
        )}
        {discussions.map(msg => (
          <div key={msg.id} className="flex gap-3">
            <Link
              href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
              className="w-10 h-10 rounded-full bg-[#17402C]/10 hover:bg-[#17402C]/20 transition-colors flex items-center justify-center text-[#17402C] font-bold text-sm flex-shrink-0 cursor-pointer"
            >
              {msg.author.charAt(0)}
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href={msg.author_id ? `/profil/${msg.author_id}` : '/communaute'}
                  className="font-bold text-sm text-[#17402C] hover:underline cursor-pointer"
                >
                  {msg.author}
                </Link>
                {msg.tag && (
                  <span className="glass-pill text-[9px]">{msg.tag}</span>
                )}
                <button
                  onClick={() => { setReplyingTo(replyingTo?.id === msg.id ? null : msg); setNewMessage(''); composerInputRef.current?.focus(); }}
                  className="text-[10px] font-bold text-[#17402C] hover:underline ml-1"
                >
                  Répondre
                </button>
                <span className="text-xs text-[#5C6B5E] font-mono ml-auto">{msg.time}</span>
              </div>
              
              {msg.reply_to && (
                <p className="text-[10px] text-[#5C6B5E] italic mb-1">
                  ↩ en réponse à {discussions.find((d) => d.id === msg.reply_to)?.author || 'un message'}
                </p>
              )}
              
              <div className="glass-sub-card p-4 rounded-2xl rounded-tl-none mb-2">
                <p className="text-sm text-[#17402C] font-sans leading-relaxed whitespace-pre-wrap">
                  {msg.content.split(/(#\w+)/g).map((part, i) => 
                    part.startsWith('#') ? <span key={i} className="text-[#3A63B2] font-semibold">{part}</span> : part
                  )}
                </p>
                
                {msg.attachment && (
                  <div className="mt-3 p-3 glass-sub-card rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#17402C]/10 flex items-center justify-center text-[#17402C]">
                      <Icon name="MapIcon" size={20} className="relative z-10" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#17402C]">{msg.attachment}</p>
                      <p className="text-[10px] text-[#5C6B5E] font-mono">Pièce jointe</p>
                    </div>
                    <button
                      onClick={() => {
                        const src = msg.attachment;
                        if (!src) return;
                        const a = document.createElement('a');
                        a.href = src.trim().startsWith('http') ? src.trim() : `https://${src.trim()}`;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                      }}
                      className="glass-capsule-btn ml-auto p-2"
                      title="Ouvrir la pièce jointe"
                    >
                      <Icon name="ArrowDownTrayIcon" size={14} className="relative z-10" />
                    </button>
                  </div>
                )}
                {msg.location && (
                  <a
                    href={`https://www.google.com/maps?q=${typeof msg.location === 'string' ? msg.location : `${(msg.location as any).lat},${(msg.location as any).lng}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 glass-capsule-btn py-1.5 px-3 text-xs font-semibold"
                  >
                    <Icon name="MapPinIcon" size={14} className="relative z-10" />
                    <span className="relative z-10">
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Hidden GPX file input */}
      <input
        ref={gpxInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !groupId || !user) return;
          const fileName = file.name.replace('.gpx', '');
          await handleSendMessage(undefined, undefined, undefined, `🗺️ Trace GPX : ${fileName}`);
        }}
      />

      <div className="relative flex-shrink-0">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 glass-sub-card rounded-xl text-xs text-[#17402C]">
            <span className="font-bold">↩ Répondre à {replyingTo.author}</span>
            <span className="text-[#5C6B5E] truncate flex-1">« {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''} »</span>
            <button onClick={() => setReplyingTo(null)} className="text-[#5C6B5E] hover:text-red-600 font-bold px-1">✕</button>
          </div>
        )}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-[#17402C] flex items-center justify-center text-white text-xs font-bold">
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
          className="glass-input w-full pl-14 pr-[152px] text-sm text-[#17402C] min-h-[48px]"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          <button 
            onClick={() => gpxInputRef.current?.click()}
            disabled={uploading || loading}
            className="glass-capsule-btn p-2 text-xs font-bold"
            title="Partager une trace GPX"
          >
            <span className="relative z-10">🗺️</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            className="glass-capsule-btn p-2"
            title="Envoyer une photo ou vidéo"
          >
            <Icon name="PhotoIcon" size={16} className="relative z-10" />
          </button>
          <button 
            onClick={handleShareLocation}
            disabled={locating || loading}
            className="glass-capsule-btn p-2"
            title="Partager ma position"
          >
            <Icon name="MapPinIcon" size={16} className="relative z-10" />
          </button>
          <button 
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() || loading}
            className="glass-capsule-btn primary p-2 disabled:opacity-50"
          >
            <Icon name="PaperAirplaneIcon" size={14} className="relative z-10" />
          </button>
        </div>
      </div>
    </div>
  );
}
