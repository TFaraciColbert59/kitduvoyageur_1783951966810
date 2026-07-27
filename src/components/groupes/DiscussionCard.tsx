import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface Message {
  id: string;
  author: string;
  tag?: string;
  time: string;
  content: string;
  attachment?: string | null;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussions]);

  const handleSendMessage = async (e?: React.FormEvent, mediaUrl?: string, location?: { lat: number; lng: number }) => {
    if (e) e.preventDefault();
    const msg = newMessage.trim();
    if (!msg && !mediaUrl && !location) return;
    if (!groupId || !user) return;
    
    setLoading(true);
    
    const insertData: any = {
      group_id: groupId,
      user_id: user.id,
      content: msg || (mediaUrl ? '📎 Pièce jointe' : `📍 Position partagée`),
    };

    if (mediaUrl) insertData.media_url = mediaUrl;
    if (location) insertData.location = location;

    const { error } = await supabase.from('group_messages').insert(insertData);
    
    if (error) {
      console.error(error);
      alert('Erreur: ' + error.message);
    } else {
      setNewMessage('');
      if (onRefresh) onRefresh();
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

    // Validate file size (max 10MB)
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
        // If bucket doesn't exist, send message with filename reference
        console.warn('Storage upload failed, sending as text reference:', error);
        const msg = newMessage.trim() || `📎 ${file.name}`;
        await supabase.from('group_messages').insert({
          group_id: groupId,
          user_id: user.id,
          content: msg,
        });
        setNewMessage('');
        if (onRefresh) onRefresh();
      } else {
        // Get public URL
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
    // Reset the file input
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
        }
        setLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        alert('Impossible d\'obtenir votre position. Vérifiez les permissions de votre navigateur.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const totalMessages = discussions.length;

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm flex flex-col h-[600px]">
      <div className="flex justify-between items-start mb-2 flex-shrink-0">
        <h2 className="font-display text-xl text-[#1C2620]">Discussion <span className="font-serif italic font-bold">du voyage</span></h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#1C2620]/60 bg-[#1C2620]/5 px-2 py-0.5 rounded-full">{totalMessages} messages</span>
        </div>
      </div>
      
      <div className="flex justify-end mb-4 flex-shrink-0">
        <button className="text-xs font-medium text-[#E4501C] hover:underline font-sans">Voir tout</button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4 custom-scrollbar">
        {discussions.length === 0 && (
          <p className="text-center text-sm text-[#1C2620]/50 py-4">Soyez le premier à lancer la discussion.</p>
        )}
        {discussions.map(msg => (
          <div key={msg.id} className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[#E7E3D6] flex items-center justify-center text-[#1C2620] font-bold text-sm flex-shrink-0">
              {msg.author.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-[#1C2620]">{msg.author}</span>
                {msg.tag && (
                  <span className="text-[9px] font-mono uppercase tracking-widest bg-[#E4501C]/10 text-[#E4501C] px-1.5 py-0.5 rounded-sm">{msg.tag}</span>
                )}
                <span className="text-xs text-[#1C2620]/40 ml-auto">{msg.time}</span>
              </div>
              
              <div className="bg-[#E7E3D6]/30 border border-[#1C2620]/5 rounded-2xl rounded-tl-none p-4 mb-2">
                <p className="text-sm text-[#1C2620] font-sans leading-relaxed whitespace-pre-wrap">
                  {msg.content.split(/(#\w+)/g).map((part, i) => 
                    part.startsWith('#') ? <span key={i} className="text-[#3A6EA5] font-medium">{part}</span> : part
                  )}
                </p>
                
                {msg.attachment && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-[#1C2620]/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E7E3D6]/50 flex items-center justify-center text-[#1C2620]/40">
                      <Icon name="MapIcon" size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#1C2620]">{msg.attachment}</p>
                      <p className="text-[10px] text-[#1C2620]/50 font-mono">Pièce jointe</p>
                    </div>
                    <button className="ml-auto w-8 h-8 rounded-full bg-[#1C2620]/5 flex items-center justify-center text-[#1C2620] hover:bg-[#1C2620]/10">
                      <Icon name="ArrowDownTrayIcon" size={14} />
                    </button>
                  </div>
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

      <div className="relative flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-[#33463C] flex items-center justify-center text-white text-xs font-bold">
            {user?.user_metadata?.first_name ? user.user_metadata.first_name.charAt(0) : (user?.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0) : 'V')}
          </div>
        </div>
        <input 
          type="text" 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || uploading || locating}
          placeholder={uploading ? "Upload en cours..." : locating ? "Localisation..." : "Ajouter un message pour le groupe..."} 
          className="w-full bg-[#E7E3D6]/30 border border-[#1C2620]/10 rounded-full py-3.5 pl-14 pr-28 text-sm text-[#1C2620] placeholder-[#1C2620]/40 focus:outline-none focus:ring-2 focus:ring-[#33463C]/20"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              uploading 
                ? 'text-[#E4501C] animate-pulse bg-[#E4501C]/10' 
                : 'text-[#1C2620]/40 hover:text-[#1C2620] hover:bg-[#1C2620]/5'
            }`}
            title="Envoyer une photo ou vidéo"
          >
            <Icon name="PhotoIcon" size={16} />
          </button>
          <button 
            onClick={handleShareLocation}
            disabled={locating || loading}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              locating 
                ? 'text-[#E4501C] animate-pulse bg-[#E4501C]/10' 
                : 'text-[#1C2620]/40 hover:text-[#1C2620] hover:bg-[#1C2620]/5'
            }`}
            title="Partager ma position"
          >
            <Icon name="MapPinIcon" size={16} />
          </button>
          <button 
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() || loading}
            className="w-8 h-8 rounded-full bg-[#1C2620] text-white flex items-center justify-center hover:bg-[#1C2620]/80 transition-colors disabled:opacity-50"
          >
            <Icon name="PaperAirplaneIcon" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
