'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  sender: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  type: 'text' | 'gps' | 'system';
  gpsData?: { lat: number; lng: number; label: string; expiresIn: string };
  isMe?: boolean;
}

interface Conversation {
  id: string;
  type: '1to1' | 'group' | 'club' | 'event';
  name: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  online?: boolean;
  members?: number;
  messages: Message[];
}

function GPSBubble({ data }: { data: NonNullable<Message['gpsData']> }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <Icon name="MapPinIcon" size={14} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-700 text-blue-800">{data.label}</p>
          <p className="text-[10px] text-blue-600">Expire dans : {data.expiresIn}</p>
        </div>
      </div>
      <div className="bg-blue-100 rounded-lg p-2 text-[10px] font-mono text-blue-700">
        {data.lat.toFixed(4)}°N, {data.lng.toFixed(4)}°E
      </div>
      <button className="mt-2 w-full py-1.5 bg-blue-500 text-white text-xs font-700 rounded-lg hover:bg-blue-600 transition-colors">
        Ouvrir dans Maps
      </button>
    </div>
  );
}

function NewConversationModal({ onClose, onStart }: { onClose: () => void; onStart: (name: string, type: Conversation['type']) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Conversation['type']>('1to1');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onStart(name.trim(), type);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm  p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-700">Nouveau message</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors"><Icon name="XMarkIcon" size={20} variant="outline" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Destinataire / Nom du groupe</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Thomas Vernet" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type de conversation</label>
            <select value={type} onChange={(e) => setType(e.target.value as Conversation['type'])} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="1to1">Message privé</option>
              <option value="group">Groupe</option>
              <option value="club">Club</option>
              <option value="event">Événement</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">Démarrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (diffDays === 1) return 'Hier';
  return `${d.getDate()} ${d.toLocaleString('fr-FR', { month: 'short' })}`;
}

function getNow() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function MessageriePage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conv = conversations.find((c) => c.id === activeConv) ?? null;

  const loadConversations = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!convData || convData.length === 0) {
        // Seed default conversations for new users
        const defaults = [
          { type: '1to1', name: 'Thomas Vernet', avatar: 'TV', members_count: 2, created_by: user.id },
          { type: 'event', name: 'Sortie GR10 Pyrénées', avatar: '🥾', members_count: 6, created_by: user.id },
          { type: 'club', name: 'Club GR20', avatar: '🏔️', members_count: 3241, created_by: user.id },
        ];
        const { data: inserted } = await supabase.from('conversations').insert(defaults).select();
        if (inserted && inserted.length > 0) {
          const firstConvId = inserted[0].id;
          await supabase.from('messages').insert([
            { conversation_id: firstConvId, sender_id: user.id, content: 'Bienvenue dans votre messagerie ! Envoyez votre premier message.', type: 'text' },
          ]);
          const mapped: Conversation[] = inserted.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            type: c.type as Conversation['type'],
            name: c.name as string,
            avatar: (c.avatar as string) || (c.name as string).slice(0, 2).toUpperCase(),
            lastMessage: 'Bienvenue dans votre messagerie !',
            lastTime: formatTime(c.created_at as string),
            unread: 0,
            members: (c.members_count as number) > 2 ? (c.members_count as number) : undefined,
            messages: [],
          }));
          setConversations(mapped);
          setActiveConv(mapped[0]?.id ?? null);
        }
        setLoading(false);
        return;
      }

      const mapped: Conversation[] = convData.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        type: c.type as Conversation['type'],
        name: c.name as string,
        avatar: (c.avatar as string) || (c.name as string).slice(0, 2).toUpperCase(),
        lastMessage: '',
        lastTime: formatTime(c.created_at as string),
        unread: 0,
        members: (c.members_count as number) > 2 ? (c.members_count as number) : undefined,
        messages: [],
      }));
      setConversations(mapped);
      if (mapped.length > 0) setActiveConv(mapped[0].id);
    } catch (err) {
      console.error('Load conversations error:', err);
      setError('Impossible de charger les conversations.');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, sender:user_profiles!messages_sender_id_fkey(full_name)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (!msgs) return;

      const mapped: Message[] = msgs.map((m: Record<string, unknown>) => {
        const sender = m.sender as { full_name?: string } | null;
        return {
          id: m.id as string,
          sender: sender?.full_name ?? 'Utilisateur',
          senderAvatar: (sender?.full_name ?? 'U').slice(0, 2).toUpperCase(),
          content: m.content as string,
          timestamp: formatTime(m.created_at as string),
          type: (m.type as Message['type']) ?? 'text',
          isMe: m.sender_id === user?.id,
          gpsData: m.type === 'gps' && m.gps_lat ? {
            lat: m.gps_lat as number,
            lng: m.gps_lng as number,
            label: (m.gps_label as string) || 'Position partagée',
            expiresIn: m.gps_expires_at ? formatTime(m.gps_expires_at as string) : '2h',
          } : undefined,
        };
      });

      setConversations((prev) => prev.map((c) =>
        c.id === convId ? { ...c, messages: mapped, lastMessage: mapped[mapped.length - 1]?.content ?? '', unread: 0 } : c
      ));
    } catch (err) {
      console.error('Load messages error:', err);
    }
  }, [user, supabase]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (activeConv) loadMessages(activeConv);
  }, [activeConv, loadMessages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!activeConv || !user) return;

    const channel = supabase
      .channel(`messages:${activeConv}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv}` },
        async (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          if (newMsg.sender_id === user.id) return;

          const { data: senderData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', newMsg.sender_id as string)
            .single();

          const msg: Message = {
            id: newMsg.id as string,
            sender: senderData?.full_name ?? 'Utilisateur',
            senderAvatar: (senderData?.full_name ?? 'U').slice(0, 2).toUpperCase(),
            content: newMsg.content as string,
            timestamp: formatTime(newMsg.created_at as string),
            type: (newMsg.type as Message['type']) ?? 'text',
            isMe: false,
          };

          setConversations((prev) => prev.map((c) =>
            c.id === activeConv ? { ...c, messages: [...c.messages, msg], lastMessage: msg.content } : c
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv, user, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv, conv?.messages.length]);

  const handleSend = async () => {
    if (!message.trim() || !conv || !user) return;
    setSending(true);
    const content = message.trim();
    setMessage('');

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender: 'Moi',
      senderAvatar: 'ME',
      content,
      timestamp: getNow(),
      type: 'text',
      isMe: true,
    };
    setConversations((prev) => prev.map((c) =>
      c.id === conv.id ? { ...c, messages: [...c.messages, tempMsg], lastMessage: content } : c
    ));

    try {
      const { data: saved } = await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content,
        type: 'text',
      }).select().single();

      if (saved) {
        setConversations((prev) => prev.map((c) =>
          c.id === conv.id ? {
            ...c,
            messages: c.messages.map((m) => m.id === tempMsg.id ? { ...m, id: saved.id } : m),
          } : c
        ));
      }
    } catch (err) {
      console.error('Send message error:', err);
      setConversations((prev) => prev.map((c) =>
        c.id === conv.id ? { ...c, messages: c.messages.filter((m) => m.id !== tempMsg.id) } : c
      ));
    } finally {
      setSending(false);
    }
  };

  const handleNewConversation = async (name: string, type: Conversation['type']) => {
    if (!user) return;
    try {
      const { data: newConv } = await supabase.from('conversations').insert({
        type,
        name,
        avatar: name.slice(0, 2).toUpperCase(),
        members_count: type === '1to1' ? 2 : 1,
        created_by: user.id,
      }).select().single();

      if (newConv) {
        const conv: Conversation = {
          id: newConv.id,
          type: newConv.type,
          name: newConv.name,
          avatar: newConv.avatar || name.slice(0, 2).toUpperCase(),
          lastMessage: '',
          lastTime: getNow(),
          unread: 0,
          messages: [],
        };
        setConversations((prev) => [conv, ...prev]);
        setActiveConv(conv.id);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
    }
    setShowNewConvModal(false);
  };

  const filteredConvs = conversations.filter((c) =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const typeIcon: Record<string, string> = { '1to1': '👤', group: '👥', club: '🏕️', event: '📅' };

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background flex flex-col">
          <Header />
          <main className="pt-16 flex-1 flex flex-col">
            <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100dvh - 64px)' }}>
              {/* Sidebar — hidden on mobile when a conversation is active */}
              <div className={`${activeConv ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 border-r border-border flex-col bg-card`}>
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h1 className="font-display font-700 text-lg">Messagerie</h1>
                    <button
                      onClick={() => setShowNewConvModal(true)}
                      className="p-2 rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
                      title="Nouvelle conversation"
                    >
                      <Icon name="PlusIcon" size={16} variant="outline" />
                    </button>
                  </div>
                  <div className="relative">
                    <Icon name="MagnifyingGlassIcon" size={14} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {!user ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Connectez-vous pour accéder à la messagerie</p>
                    </div>
                  ) : loading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
                    </div>
                  ) : error ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <p className="text-3xl mb-2">⚠️</p>
                      <p className="text-sm mb-3">{error}</p>
                      <button onClick={() => { setError(null); loadConversations(); }} className="text-xs text-primary hover:underline cursor-pointer">Réessayer</button>
                    </div>
                  ) : filteredConvs.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucune conversation</p>
                      <button onClick={() => setShowNewConvModal(true)} className="mt-3 text-xs text-primary hover:underline">
                        Démarrer une conversation
                      </button>
                    </div>
                  ) : (
                    filteredConvs.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveConv(c.id)}
                        className={`w-full flex items-center gap-3 p-4 hover:bg-muted transition-colors text-left border-b border-border/50 ${activeConv === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0 text-sm font-700">
                          {c.avatar.length <= 2 ? c.avatar : c.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-600 text-foreground truncate">{c.name}</p>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{c.lastTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{typeIcon[c.type]}</span>
                            <p className="text-xs text-muted-foreground truncate">{c.lastMessage || 'Aucun message'}</p>
                          </div>
                        </div>
                        {c.unread > 0 && (
                          <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-700 flex items-center justify-center flex-shrink-0">
                            {c.unread}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat area — full width on mobile */}
              <div className={`${!activeConv ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0`}>
                {!conv ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Icon name="ChatBubbleLeftRightIcon" size={48} className="mx-auto mb-3 opacity-20" />
                      <p className="font-display font-700 text-foreground mb-1">Sélectionnez une conversation</p>
                      <p className="text-sm">Choisissez une conversation dans la liste ou créez-en une nouvelle.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
                      <button
                        onClick={() => setActiveConv(null)}
                        className="md:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Retour à la liste"
                      >
                        <Icon name="ChevronLeftIcon" size={20} variant="outline" />
                      </button>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-sm font-700">
                        {conv.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="font-600 text-foreground">{conv.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {conv.members ? `${conv.members.toLocaleString()} membres` : typeIcon[conv.type] + ' ' + (conv.type === '1to1' ? 'Message privé' : conv.type === 'group' ? 'Groupe' : conv.type === 'club' ? 'Club' : 'Événement')}
                        </p>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {conv.messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Icon name="ChatBubbleOvalLeftIcon" size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Aucun message. Soyez le premier à écrire !</p>
                          </div>
                        </div>
                      ) : (
                        conv.messages.map((msg) => (
                          <div key={msg.id} className={`flex gap-3 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0 ${msg.isMe ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}>
                              {msg.senderAvatar}
                            </div>
                            <div className={`max-w-[70%] ${msg.isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                              {!msg.isMe && <p className="text-[10px] text-muted-foreground font-medium">{msg.sender}</p>}
                              {msg.type === 'gps' && msg.gpsData ? (
                                <GPSBubble data={msg.gpsData} />
                              ) : (
                                <div className={`px-4 py-2.5 rounded-2xl text-sm ${msg.isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-card border border-border text-foreground rounded-tl-sm'}`}>
                                  {msg.content}
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground">{msg.timestamp}</p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-border bg-card">
                      <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                          <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                            placeholder="Écrivez un message... (Entrée pour envoyer)"
                            rows={1}
                            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            style={{ minHeight: '44px', maxHeight: '120px' }}
                          />
                        </div>
                        <button
                          onClick={handleSend}
                          disabled={sending || !message.trim() || !user}
                          className="p-3 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Icon name="PaperAirplaneIcon" size={18} variant="outline" />
                        </button>
                      </div>
                      {!user && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">Connectez-vous pour envoyer des messages</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            {!activeConv ? (
              /* Conversation List */
              <>
                <div style={{ padding: '16px 16px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#17402C' }}>Messagerie</h1>
                    <button
                      onClick={() => setShowNewConvModal(true)}
                      style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#17402C', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
                      title="Nouvelle conversation"
                    >
                      +
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: '10px', border: '1px solid rgba(23,64,44,0.06)', background: '#FBFAF6', fontSize: '13px', color: '#17402C', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6B7A72', fontSize: '12px' }}>🔍</span>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {!user ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', color: '#6B7A72', marginBottom: '8px', opacity: 0.3 }}>💬</div>
                      <p style={{ fontSize: '13px', color: '#6B7A72' }}>Connectez-vous pour accéder à la messagerie</p>
                    </div>
                  ) : loading ? (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{ height: '64px', borderRadius: '12px', background: '#F4F1EA', opacity: 0.5 }} />
                      ))}
                    </div>
                  ) : error ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <p style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</p>
                      <p style={{ fontSize: '13px', color: '#6B7A72', marginBottom: '12px' }}>{error}</p>
                      <button onClick={() => { setError(null); loadConversations(); }} style={{ fontSize: '12px', color: '#17402C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Réessayer</button>
                    </div>
                  ) : filteredConvs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', color: '#6B7A72', marginBottom: '8px', opacity: 0.3 }}>💬</div>
                      <p style={{ fontSize: '13px', color: '#6B7A72', marginBottom: '12px' }}>Aucune conversation</p>
                      <button onClick={() => setShowNewConvModal(true)} style={{ fontSize: '12px', color: '#17402C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                        Démarrer une conversation
                      </button>
                    </div>
                  ) : (
                    filteredConvs.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveConv(c.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: 'none', borderBottom: '1px solid rgba(23,64,44,0.04)', background: activeConv === c.id ? 'rgba(23,64,44,0.04)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(23,64,44,0.2), rgba(45,107,74,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#17402C', flexShrink: 0 }}>
                          {c.avatar.length <= 2 ? c.avatar : c.avatar.slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#17402C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            <span style={{ fontSize: '10px', color: '#6B7A72', flexShrink: 0, marginLeft: '8px' }}>{c.lastTime}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '10px', color: '#6B7A72' }}>{typeIcon[c.type]}</span>
                            <span style={{ fontSize: '12px', color: '#6B7A72', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || 'Aucun message'}</span>
                          </div>
                        </div>
                        {c.unread > 0 && (
                          <span style={{ minWidth: '20px', height: '20px', borderRadius: '50%', background: '#17402C', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.unread}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : null}

            {activeConv && conv ? (
              /* Chat View */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100dvh - 52px - env(safe-area-inset-top) - 62px - env(safe-area-inset-bottom) - 24px)' }}>
                {/* Chat header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid rgba(23,64,44,0.06)', background: '#FBFAF6' }}>
                  <button onClick={() => setActiveConv(null)} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7A72', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ←
                  </button>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(23,64,44,0.2), rgba(45,107,74,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                    {conv.avatar.length <= 2 ? conv.avatar : conv.avatar.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#17402C' }}>{conv.name}</div>
                    <div style={{ fontSize: '11px', color: '#6B7A72' }}>
                      {conv.members ? `${conv.members.toLocaleString()} membres` : (conv.type === '1to1' ? 'Message privé' : conv.type === 'group' ? 'Groupe' : conv.type === 'club' ? 'Club' : 'Événement')}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {conv.messages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center', color: '#6B7A72' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>💬</div>
                        <p style={{ fontSize: '13px' }}>Aucun message. Soyez le premier à écrire !</p>
                      </div>
                    </div>
                  ) : (
                    conv.messages.map((msg) => (
                      <div key={msg.id} style={{ display: 'flex', gap: '10px', flexDirection: msg.isMe ? 'row-reverse' : 'row' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: msg.isMe ? '#17402C' : '#F4F1EA', color: msg.isMe ? '#fff' : '#17402C' }}>
                          {msg.senderAvatar}
                        </div>
                        <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: msg.isMe ? 'flex-end' : 'flex-start' }}>
                          {!msg.isMe && <p style={{ fontSize: '10px', color: '#6B7A72', fontWeight: 500, margin: 0 }}>{msg.sender}</p>}
                          <div style={{ padding: '10px 14px', borderRadius: msg.isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: '13px', background: msg.isMe ? '#17402C' : '#F4F1EA', color: msg.isMe ? '#fff' : '#17402C', border: msg.isMe ? 'none' : '1px solid rgba(23,64,44,0.06)' }}>
                            {msg.content}
                          </div>
                          <p style={{ fontSize: '10px', color: '#6B7A72', margin: 0 }}>{msg.timestamp}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(23,64,44,0.06)', background: '#FBFAF6' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Écrivez un message..."
                      rows={1}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(23,64,44,0.06)', background: '#F4F1EA', fontSize: '13px', color: '#17402C', outline: 'none', resize: 'none', fontFamily: 'inherit', minHeight: '40px', maxHeight: '100px', boxSizing: 'border-box' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !message.trim() || !user}
                      style={{ padding: '10px', background: '#17402C', color: '#fff', borderRadius: '10px', border: 'none', cursor: sending || !message.trim() || !user ? 'not-allowed' : 'pointer', opacity: sending || !message.trim() || !user ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}
                    >
                      ➤
                    </button>
                  </div>
                  {!user && (
                    <p style={{ fontSize: '11px', color: '#6B7A72', textAlign: 'center', margin: '8px 0 0' }}>Connectez-vous pour envoyer des messages</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
        </MobilePageShell>
        
      </div>

      {/* New Conversation Modal - rendered outside dual-view so it works on both */}
      {showNewConvModal && (
        <NewConversationModal onClose={() => setShowNewConvModal(false)} onStart={handleNewConversation} />
      )}
    </>
  );
}
