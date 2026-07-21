'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/lib/hooks/useChat';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'posts' | 'carnets' | 'inventaire' | 'groupes' | 'commandes' | 'documents' | 'securite';

const LOYALTY_LEVELS = [
  { name: 'Explorateur', min: 0, badge: '🥾', color: 'text-stone-600' },
  { name: 'Aventurier', min: 500, badge: '🏕️', color: 'text-emerald-600' },
  { name: 'Randonneur Expert', min: 1500, badge: '🧗', color: 'text-blue-600' },
  { name: 'Guide de Montagne', min: 3500, badge: '🏔️', color: 'text-purple-600' },
  { name: 'Légende du Voyage', min: 7500, badge: '🌍', color: 'text-amber-600' },
];

// ─── Posts Tab ─────────────────────────────────────────────────────────────────
function PostsTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<{ id: string; content: string; post_type: string; likes_count: number; comments_count: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [postType, setPostType] = useState<'post' | 'tip' | 'question' | 'share'>('post');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    supabase.from('community_posts').select('id, content, post_type, likes_count, comments_count, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(12).then(({ data }) => {
      setPosts(data ?? []);
      setLoading(false);
    });
  }, [userId, supabase]);

  const handlePublish = async () => {
    if (!newPost.trim()) return;
    setSubmitting(true);
    const { data } = await supabase.from('community_posts').insert({ author_id: userId, content: newPost.trim(), post_type: postType, likes_count: 0, comments_count: 0 }).select('id, content, post_type, likes_count, comments_count, created_at').single();
    if (data) { setPosts(prev => [data, ...prev]); setNewPost(''); setSuccessMsg('Publié !'); setTimeout(() => setSuccessMsg(''), 2000); }
    setSubmitting(false);
  };

  const TYPE_CFG: Record<string, { label: string; color: string; emoji: string }> = {
    post: { label: 'Post', color: 'bg-[#E7E3D6] text-[#5C6B5E]', emoji: '💬' },
    tip: { label: 'Conseil', color: 'bg-emerald-100 text-emerald-700', emoji: '💡' },
    question: { label: 'Question', color: 'bg-blue-100 text-blue-700', emoji: '❓' },
    share: { label: 'Partage', color: 'bg-purple-100 text-purple-700', emoji: '🔗' },
  };

  return (
    <div className="space-y-4">
      {/* Compose */}
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          {Object.entries(TYPE_CFG).map(([id, cfg]) => (
            <button key={id} onClick={() => setPostType(id as typeof postType)} className={`text-xs font-600 px-3 py-1.5 rounded-full border-2 transition-all ${postType === id ? 'border-[#E4501C] ' + cfg.color : 'border-[#C8C3B0] text-[#5C6B5E]'}`}>
              {cfg.emoji} {cfg.label}
            </button>
          ))}
        </div>
        <textarea rows={3} value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Partagez une astuce, posez une question, racontez votre aventure..." className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-3 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 resize-none mb-3" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#5C6B5E]">{newPost.length}/500</span>
          <div className="flex items-center gap-2">
            {successMsg && <span className="text-xs text-emerald-600 font-600">✓ {successMsg}</span>}
            <button onClick={handlePublish} disabled={submitting || !newPost.trim() || newPost.length > 500} className="flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50">
              <Icon name="PaperAirplaneIcon" size={13} variant="outline" />
              {submitting ? 'Publication...' : 'Publier'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-3xl mb-2">✍️</p>
          <p className="text-sm">Aucune publication. Partagez quelque chose !</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {posts.map(post => {
            const cfg = TYPE_CFG[post.post_type] ?? TYPE_CFG['post'];
            return (
              <div key={post.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:border-[#E4501C]/30 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                  <span className="text-[10px] text-[#5C6B5E] ml-auto">{new Date(post.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <p className="text-sm text-[#1C2620] leading-relaxed line-clamp-3 mb-3">{post.content}</p>
                <div className="flex items-center gap-3 text-xs text-[#5C6B5E]">
                  <span className="flex items-center gap-1"><Icon name="HeartIcon" size={12} /> {post.likes_count}</span>
                  <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={12} /> {post.comments_count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Carnets Tab ───────────────────────────────────────────────────────────────
function CarnetsTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [carnets, setCarnets] = useState<{ id: string; title: string; destination: string; cover_image: string; route_rating: number; likes_count: number; visibility: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('carnets').select('id, title, destination, cover_image, route_rating, likes_count, visibility, created_at').eq('author_id', userId).order('created_at', { ascending: false }).then(({ data }) => {
      setCarnets(data ?? []);
      setLoading(false);
    });
  }, [userId, supabase]);

  if (loading) return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#5C6B5E]">{carnets.length} carnet{carnets.length !== 1 ? 's' : ''}</p>
        <Link href="/carnets" className="flex items-center gap-1.5 text-xs text-[#E4501C] hover:underline font-600">
          <Icon name="PlusIcon" size={12} /> Nouveau carnet
        </Link>
      </div>
      {carnets.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-sm mb-3">Aucun carnet d&apos;expédition</p>
          <Link href="/carnets" className="inline-flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600">
            <Icon name="PlusIcon" size={13} /> Créer un carnet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {carnets.map(c => (
            <Link key={c.id} href="/carnets" className="group relative aspect-square bg-[#C8C3B0] rounded-2xl overflow-hidden hover:opacity-90 transition-opacity">
              {c.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover_image} alt={c.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl bg-[#E7E3D6]">🗺️</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="text-white text-xs font-700 line-clamp-1">{c.title}</p>
                <p className="text-white/70 text-[10px]">{c.destination}</p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="bg-black/50 text-white text-[10px] font-700 px-1.5 py-0.5 rounded-full">{c.route_rating}/10</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inventaire Tab ────────────────────────────────────────────────────────────
function InventaireTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [gear, setGear] = useState<{ id: string; name: string; brand: string; category: string; condition: string; purchase_price: number; weight_g: number; usage_count: number; image: string; alt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('gear_items').select('id, name, brand, category, condition, purchase_price, weight_g, usage_count, image, alt').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => {
      setGear(data ?? []);
      setLoading(false);
    });
  }, [userId, supabase]);

  const CONDITION_CFG: Record<string, { label: string; color: string }> = {
    neuf: { label: 'Neuf', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    excellent: { label: 'Excellent', color: 'text-green-600 bg-green-50 border-green-200' },
    bon: { label: 'Bon', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    usé: { label: 'Usé', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    à_remplacer: { label: 'À remplacer', color: 'text-red-600 bg-red-50 border-red-200' },
  };

  const totalWeight = gear.reduce((s, g) => s + g.weight_g, 0);
  const totalValue = gear.reduce((s, g) => s + g.purchase_price, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'Articles', value: gear.length }, { label: 'Poids total', value: `${(totalWeight / 1000).toFixed(1)} kg` }, { label: 'Valeur', value: `${totalValue.toLocaleString()}€` }].map(s => (
          <div key={s.label} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 text-center">
            <p className="font-display font-700 text-[#1C2620] text-xl">{s.value}</p>
            <p className="text-xs text-[#5C6B5E] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5C6B5E]">{gear.length} équipement{gear.length !== 1 ? 's' : ''}</p>
        <Link href="/inventaire" className="flex items-center gap-1.5 text-xs text-[#E4501C] hover:underline font-600">
          <Icon name="ArrowTopRightOnSquareIcon" size={12} /> Gérer l&apos;inventaire
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : gear.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-3xl mb-2">🎒</p>
          <p className="text-sm mb-3">Aucun équipement</p>
          <Link href="/inventaire" className="inline-flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600">
            <Icon name="PlusIcon" size={13} /> Ajouter du matériel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gear.map(g => {
            const cond = CONDITION_CFG[g.condition] || CONDITION_CFG['bon'];
            return (
              <div key={g.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden flex hover:border-[#E4501C]/30 transition-all">
                <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-[#E7E3D6]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={g.alt || g.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-600 text-sm text-[#1C2620] line-clamp-1">{g.name}</p>
                    <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cond.color}`}>{cond.label}</span>
                  </div>
                  <p className="text-xs text-[#5C6B5E] mt-0.5">{g.brand} · {g.weight_g}g</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[#5C6B5E]">
                    <span>{g.usage_count} utilisations</span>
                    <span className="font-mono font-600 text-[#1C2620]">{g.purchase_price}€</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Groupes Tab ───────────────────────────────────────────────────────────────
function GroupesTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<{ id: string; group_id: string; role: string; group?: { name: string; destination: string; theme: string; visibility: string } }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('group_members').select('id, group_id, role, group:travel_groups(name, destination, theme, visibility)').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).then(({ data }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setGroups((data ?? []) as any[]);
      setLoading(false);
    });
  }, [userId, supabase]);

  const THEME_EMOJI: Record<string, string> = { Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍', Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒' };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5C6B5E]">{groups.length} groupe{groups.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <Link href="/groupes?tab=decouvrir" className="text-xs text-[#5C6B5E] hover:text-[#1C2620] border border-[#C8C3B0] px-3 py-1.5 rounded-xl transition-colors">Découvrir</Link>
          <Link href="/groupe" className="flex items-center gap-1.5 text-xs text-white bg-[#E4501C] hover:bg-[#E4501C]/90 px-3 py-1.5 rounded-xl transition-colors font-600">
            <Icon name="PlusIcon" size={12} /> Créer
          </Link>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-sm mb-3">Aucun groupe de voyage</p>
          <Link href="/groupe" className="inline-flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600">
            <Icon name="PlusIcon" size={13} /> Créer un groupe
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(m => (
            <Link key={m.id} href={`/groupe?group=${m.group_id}`} className="flex items-center gap-3 bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:border-[#E4501C]/30 hover:shadow-sm transition-all">
              <div className="w-11 h-11 rounded-xl bg-[#1C2620] flex items-center justify-center text-xl flex-shrink-0">
                {THEME_EMOJI[m.group?.theme || ''] || '🎒'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-600 text-sm text-[#1C2620] truncate">{m.group?.name || 'Groupe'}</p>
                <p className="text-xs text-[#5C6B5E] truncate">{m.group?.destination}</p>
              </div>
              <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full flex-shrink-0 ${m.role === 'organizer' ? 'bg-amber-100 text-amber-700' : m.role === 'co_organizer' ? 'bg-blue-100 text-blue-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>
                {m.role === 'organizer' ? '👑 Organisateur' : m.role === 'co_organizer' ? '🛡️ Co-org.' : '👤 Membre'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Commandes Tab ─────────────────────────────────────────────────────────────
function CommandesTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<{ id: string; order_number: string; created_at: string; status: string; total_eur: number; items_count: number; tracking_number: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => {
      setOrders(data ?? []);
      setLoading(false);
    });
  }, [userId, supabase]);

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    livré: { label: 'Livré', cls: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
    en_transit: { label: 'En transit', cls: 'text-blue-600 bg-blue-50 border-blue-200' },
    en_preparation: { label: 'En préparation', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    annulé: { label: 'Annulé', cls: 'text-red-500 bg-red-50 border-red-200' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5C6B5E]">{orders.length} commande{orders.length !== 1 ? 's' : ''}</p>
        <Link href="/shop" className="text-xs text-[#E4501C] hover:underline">Boutique →</Link>
      </div>
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-3xl mb-2">🛍️</p>
          <p className="text-sm mb-3">Aucune commande</p>
          <Link href="/shop" className="inline-flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-600">Explorer la boutique</Link>
        </div>
      ) : (
        orders.map(order => {
          const cfg = STATUS_CFG[order.status] ?? STATUS_CFG['en_preparation'];
          return (
            <div key={order.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-mono font-600 text-[#1C2620] text-sm">{order.order_number}</p>
                  <p className="text-xs text-[#5C6B5E] mt-0.5">{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · {order.items_count} article{order.items_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                  <span className="font-mono font-700 text-[#1C2620]">{order.total_eur.toFixed(2)} €</span>
                </div>
              </div>
              {order.tracking_number && (
                <div className="flex items-center gap-2 bg-[#E7E3D6] rounded-xl px-3 py-2">
                  <Icon name="TruckIcon" size={14} className="text-[#5C6B5E]" />
                  <span className="text-xs text-[#5C6B5E]">Suivi : <span className="font-mono font-600 text-[#1C2620]">{order.tracking_number}</span></span>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Documents Tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const typeIcon: Record<string, string> = { passeport: '🛂', visa: '📋', assurance: '🛡️', vaccin: '💉', permis: '🪪', autre: '📄' };
  const [documents, setDocuments] = useState<{ id: string; name: string; type: string; destination: string; expiry: string; file_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'passeport', destination: '', expiry: '', file_name: '' });
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<number>(0);

  useEffect(() => { setNow(Date.now()); }, []);

  const loadDocs = useCallback(async () => {
    const { data } = await supabase.from('user_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setDocuments(data ?? []);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_documents').insert({ user_id: userId, name: form.name, type: form.type, destination: form.destination, expiry: form.expiry || null, file_name: form.file_name || `${form.name.toLowerCase().replace(/\s+/g, '_')}.pdf` });
      if (error) throw error;
      setShowAddModal(false);
      setForm({ name: '', type: 'passeport', destination: '', expiry: '', file_name: '' });
      await loadDocs();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('user_documents').delete().eq('id', id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5C6B5E]">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 text-xs text-white bg-[#E4501C] hover:bg-[#E4501C]/90 px-3 py-1.5 rounded-xl transition-colors font-600">
          <Icon name="PlusIcon" size={12} /> Ajouter
        </button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-3xl mb-2">📁</p>
          <p className="text-sm">Ajoutez votre passeport, visa, assurance...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map(d => {
            const daysLeft = now > 0 && d.expiry ? Math.ceil((new Date(d.expiry).getTime() - now) / 86400000) : 999;
            const urgent = d.expiry ? daysLeft < 90 : false;
            return (
              <div key={d.id} className={`bg-[#EDEAE0] border rounded-2xl p-4 ${urgent ? 'border-amber-300' : 'border-[#C8C3B0]'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeIcon[d.type] || '📄'}</span>
                    <div>
                      <p className="font-600 text-sm text-[#1C2620]">{d.name}</p>
                      <p className="text-xs text-[#5C6B5E]">{d.destination}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(d.id)} className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                    <Icon name="TrashIcon" size={14} className="text-red-400" variant="outline" />
                  </button>
                </div>
                {d.expiry && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-600 ${urgent ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                    <Icon name={urgent ? 'ExclamationTriangleIcon' : 'CheckCircleIcon'} size={12} />
                    Expire le {new Date(d.expiry).toLocaleDateString('fr-FR')} ({daysLeft}j)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#EDEAE0] rounded-2xl border border-[#C8C3B0] w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-700 text-[#1C2620]">Ajouter un document</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[#E7E3D6] rounded-lg"><Icon name="XMarkIcon" size={20} variant="outline" /></button>
            </div>
            <form onSubmit={handleAddDoc} className="space-y-4">
              <div><label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Nom *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Passeport FR" className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" /></div>
              <div><label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]">{Object.entries(typeIcon).map(([k, v]) => <option key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</option>)}</select></div>
              <div><label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Destination</label><input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="Monde entier" className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" /></div>
              <div><label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Expiration</label><input type="date" value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E]">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-medium disabled:opacity-50">{saving ? 'Ajout...' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sécurité Tab ──────────────────────────────────────────────────────────────
function SecuriteTab() {
  const { user, signOut } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPwd: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [changingPwd, setChangingPwd] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPwd !== passwordForm.confirm) { setPasswordMsg('Les mots de passe ne correspondent pas.'); return; }
    if (passwordForm.newPwd.length < 8) { setPasswordMsg('Minimum 8 caractères.'); return; }
    setChangingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPwd });
      if (error) throw error;
      setShowPasswordModal(false);
      setPasswordForm({ newPwd: '', confirm: '' });
      setPasswordMsg('Mot de passe modifié !');
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (err: unknown) { setPasswordMsg(err instanceof Error ? err.message : 'Erreur'); }
    finally { setChangingPwd(false); }
  };

  const handleExport = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    const { data: gear } = await supabase.from('gear_items').select('name, brand, category, condition').eq('user_id', user.id);
    const exportData = { profile, gear: gear ?? [], exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mes_donnees_kdv.json'; a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Données exportées !');
    setTimeout(() => setExportMsg(null), 3000);
  };

  return (
    <div className="space-y-4">
      {passwordMsg && <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm ${passwordMsg.includes('!') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}><Icon name={passwordMsg.includes('!') ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={16} />{passwordMsg}</div>}
      {exportMsg && <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-2 text-sm"><Icon name="CheckCircleIcon" size={16} />{exportMsg}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { icon: 'LockClosedIcon', title: 'Mot de passe', desc: 'Modifier votre mot de passe', action: () => setShowPasswordModal(true), label: 'Modifier', color: 'bg-emerald-100' },
          { icon: 'DocumentArrowDownIcon', title: 'Données personnelles', desc: 'Exporter vos données RGPD', action: handleExport, label: 'Exporter', color: 'bg-blue-100' },
          { icon: 'ArrowRightOnRectangleIcon', title: 'Déconnexion', desc: 'Se déconnecter de l\'application', action: () => signOut(), label: 'Déconnecter', color: 'bg-red-100' },
        ].map(item => (
          <div key={item.title} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
              <Icon name={item.icon} size={18} className="text-[#1C2620]" variant="outline" />
            </div>
            <div className="flex-1">
              <p className="font-600 text-sm text-[#1C2620]">{item.title}</p>
              <p className="text-xs text-[#5C6B5E]">{item.desc}</p>
            </div>
            <button onClick={item.action} className="px-3 py-1.5 border border-[#C8C3B0] rounded-xl text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all flex-shrink-0">{item.label}</button>
          </div>
        ))}
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#EDEAE0] rounded-2xl border border-[#C8C3B0] w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-700 text-[#1C2620]">Modifier le mot de passe</h2>
              <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-[#E7E3D6] rounded-lg"><Icon name="XMarkIcon" size={20} variant="outline" /></button>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div><label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Nouveau mot de passe</label><input required type="password" value={passwordForm.newPwd} onChange={e => setPasswordForm({ ...passwordForm, newPwd: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" /></div>
              <div><label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Confirmer</label><input required type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E]">Annuler</button>
                <button type="submit" disabled={changingPwd} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-medium disabled:opacity-50">{changingPwd ? 'Modification...' : 'Modifier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ComptePage() {
  const { user, signOut, profile: ctxProfile, refreshProfile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  // Profile state
  const [profile, setProfile] = useState({ full_name: '', email: '', trust_score: 50, loyalty_points: 0, loyalty_level: 'Explorateur', bio: '', location: '', avatar_url: '' });
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Stats
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [carnetsCount, setCarnetsCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);

  // AI Conseil
  const [aiConseil, setAiConseil] = useState('');
  const [conseilAsked, setConseilAsked] = useState(false);
  const { response: conseilResponse, isLoading: conseilLoading, sendMessage: sendConseil } = useChat('GEMINI', 'gemini/gemini-2.5-flash', true);

  useEffect(() => {
    if (conseilAsked && conseilResponse) setAiConseil(conseilResponse);
  }, [conseilResponse, conseilAsked]);

  useEffect(() => {
    if (!user) { setProfileLoading(false); return; }
    const load = async () => {
      // Load profile
      if (ctxProfile) {
        setProfile(ctxProfile as typeof profile);
        setEditName(ctxProfile.full_name || '');
        setEditBio((ctxProfile as { bio?: string }).bio || '');
        setEditLocation((ctxProfile as { location?: string }).location || '');
        setProfileLoading(false);
      } else {
        const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
        if (data) {
          setProfile(data);
          setEditName(data.full_name || '');
          setEditBio(data.bio || '');
          setEditLocation(data.location || '');
        }
        setProfileLoading(false);
      }
      // Load stats
      const [fwersRes, fwingRes, postsRes, carnetsRes, groupsRes] = await Promise.all([
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
        supabase.from('community_posts').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
        supabase.from('carnets').select('*', { count: 'exact', head: true }).eq('author_id', user.id),
        supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
      ]);
      setFollowers(fwersRes.count ?? 0);
      setFollowing(fwingRes.count ?? 0);
      setPostsCount(postsRes.count ?? 0);
      setCarnetsCount(carnetsRes.count ?? 0);
      setGroupsCount(groupsRes.count ?? 0);
    };
    load();
  }, [user, supabase, ctxProfile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('user_profiles').upsert({ id: user.id, email: user.email ?? '', full_name: editName, bio: editBio, location: editLocation, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    setProfile(p => ({ ...p, full_name: editName, bio: editBio, location: editLocation }));
    setEditMode(false);
    setSaved(true);
    await refreshProfile?.();
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const handleGenerateConseil = () => {
    if (!user) return;
    const currentLevel = LOYALTY_LEVELS.filter(l => profile.loyalty_points >= l.min).pop()!;
    setAiConseil('');
    setConseilAsked(true);
    sendConseil([
      { role: 'system', content: 'Tu es un expert en voyages d\'aventure et équipement outdoor. Génère des conseils personnalisés, pratiques et motivants pour un voyageur. Réponds en français avec des emojis. Sois concis (3-4 conseils max).' },
      { role: 'user', content: `Génère des conseils personnalisés pour ce voyageur:\n- Niveau: ${currentLevel.name} (${profile.loyalty_points} points)\n- Localisation: ${profile.location || 'Non renseignée'}\n- Bio: ${profile.bio || 'Non renseignée'}\n- Carnets publiés: ${carnetsCount}\n- Groupes rejoints: ${groupsCount}\n\nDonne des conseils pratiques pour progresser dans ses aventures.` }
    ], { temperature: 0.8, max_tokens: 400 });
  };

  const initials = profile.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : (user?.email?.[0] ?? 'U').toUpperCase();
  const currentLevel = LOYALTY_LEVELS.filter(l => profile.loyalty_points >= l.min).pop()!;
  const nextLevel = LOYALTY_LEVELS.find(l => l.min > profile.loyalty_points);
  const loyaltyProgress = nextLevel ? (profile.loyalty_points - currentLevel.min) / (nextLevel.min - currentLevel.min) * 100 : 100;

  const TABS: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: 'posts', label: 'Publications', icon: 'Squares2X2Icon', count: postsCount },
    { id: 'carnets', label: 'Carnets', icon: 'BookOpenIcon', count: carnetsCount },
    { id: 'inventaire', label: 'Inventaire', icon: 'ArchiveBoxIcon' },
    { id: 'groupes', label: 'Groupes', icon: 'UserGroupIcon', count: groupsCount },
    { id: 'commandes', label: 'Commandes', icon: 'ShoppingBagIcon' },
    { id: 'documents', label: 'Documents', icon: 'FolderIcon' },
    { id: 'securite', label: 'Sécurité', icon: 'LockClosedIcon' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F2E8]">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-4xl mb-4">🔒</p>
            <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Connexion requise</h2>
            <p className="text-sm text-[#5C6B5E] mb-4">Connectez-vous pour accéder à votre compte</p>
            <Link href="/connexion" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl font-600 hover:bg-[#E4501C]/90 transition-colors">Se connecter</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />

      {/* Instagram-style profile header */}
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Profile top row */}
          <div className="flex items-start gap-6 sm:gap-10 mb-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#E4501C] to-[#C43A10] flex items-center justify-center border-2 border-[#E4501C]/40 shadow-lg">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="font-display font-800 text-3xl text-white">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#1C2620]" />
            </div>

            {/* Profile info */}
            <div className="flex-1 min-w-0">
              {/* Name + actions */}
              <div className="flex items-center gap-3 flex-wrap mb-2">
                {editMode ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white text-lg font-700 focus:outline-none focus:border-[#E4501C]/60 w-48" />
                ) : (
                  <h1 className="font-display font-800 text-xl sm:text-2xl text-white tracking-tight">{profile.full_name || user.email?.split('@')[0]}</h1>
                )}
                <div className="flex items-center gap-2">
                  {editMode ? (
                    <>
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E4501C] text-white rounded-xl text-xs font-600 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50">
                        {saving ? '...' : '✓ Sauvegarder'}
                      </button>
                      <button onClick={() => setEditMode(false)} className="px-3 py-1.5 border border-white/20 text-white/70 rounded-xl text-xs font-600 hover:border-white/40 transition-colors">Annuler</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-white/70 rounded-xl text-xs font-600 hover:border-white/40 hover:text-white transition-colors">
                        <Icon name="PencilIcon" size={11} /> Modifier
                      </button>
                      {saved && <span className="text-xs text-emerald-400 font-600">✓ Sauvegardé</span>}
                    </>
                  )}
                  <Link href={`/profil/${user.id}`} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-white/70 rounded-xl text-xs font-600 hover:border-white/40 hover:text-white transition-colors">
                    <Icon name="ArrowTopRightOnSquareIcon" size={11} /> Profil public
                  </Link>
                </div>
              </div>

              {/* Stats row — Instagram style */}
              <div className="flex items-center gap-5 sm:gap-8 mb-3">
                {[
                  { label: 'publications', value: postsCount },
                  { label: 'abonnés', value: followers },
                  { label: 'abonnements', value: following },
                  { label: 'carnets', value: carnetsCount },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <p className="font-display font-800 text-white text-lg leading-none">{stat.value}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{currentLevel.badge}</span>
                  <span className={`text-xs font-600 ${currentLevel.color}`}>{currentLevel.name}</span>
                  <span className="text-white/30 text-xs">·</span>
                  <span className="font-mono text-xs text-[#E4501C] font-700">{profile.loyalty_points} pts</span>
                </div>
                {editMode ? (
                  <div className="space-y-2">
                    <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Localisation" className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white/80 text-xs focus:outline-none focus:border-[#E4501C]/60 w-full max-w-xs" />
                    <textarea rows={2} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Votre bio..." className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white/80 text-xs focus:outline-none focus:border-[#E4501C]/60 w-full max-w-xs resize-none" />
                  </div>
                ) : (
                  <>
                    {profile.location && <p className="text-white/50 text-xs flex items-center gap-1"><Icon name="MapPinIcon" size={11} /> {profile.location}</p>}
                    {profile.bio && <p className="text-white/70 text-sm leading-relaxed max-w-sm">{profile.bio}</p>}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Loyalty progress bar */}
          {nextLevel && (
            <div className="mb-5 bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-white/50">{currentLevel.badge} {currentLevel.name}</span>
                <span className="text-white/50">{nextLevel.badge} {nextLevel.name} à {nextLevel.min} pts</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#E4501C] to-[#F07040] rounded-full transition-all" style={{ width: `${loyaltyProgress}%` }} />
              </div>
              <p className="text-[10px] text-white/30 mt-1 text-right">{nextLevel.min - profile.loyalty_points} pts pour le niveau suivant</p>
            </div>
          )}

          {/* Quick action links */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {[
              { label: 'Configurateur IA', href: '/ai-configurator', emoji: '🤖' },
              { label: 'Mes groupes', href: '/groupe', emoji: '🗺️' },
              { label: 'Communauté', href: '/communaute', emoji: '🌍' },
              { label: 'Copilote', href: '/copilote', emoji: '✈️' },
              { label: 'Alertes', href: '/alertes', emoji: '🔔' },
            ].map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs text-white/70 hover:text-white transition-all">
                <span>{item.emoji}</span> {item.label}
              </Link>
            ))}
            <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs text-red-400 hover:text-red-300 transition-all ml-auto">
              <Icon name="ArrowRightOnRectangleIcon" size={11} /> Déconnexion
            </button>
          </div>

          {/* Trust score + AI Conseil row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {/* Trust score */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <svg width={56} height={56} className="-rotate-90">
                  <circle cx={28} cy={28} r={22} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
                  <circle cx={28} cy={28} r={22} fill="none" stroke="#E4501C" strokeWidth={4} strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * (1 - (profile.trust_score || 50) / 100)} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center"><span className="font-mono font-700 text-white text-sm">{profile.trust_score || 50}</span></div>
              </div>
              <div>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-0.5">Trust Score</p>
                <p className="font-display font-700 text-white text-sm">Confirmé 🏔️</p>
                <p className="text-white/40 text-xs">Score de confiance</p>
              </div>
            </div>

            {/* AI Conseil */}
            <div className="bg-gradient-to-br from-[#E4501C]/20 to-[#E4501C]/5 border border-[#E4501C]/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon name="LightBulbIcon" size={14} className="text-[#E4501C]" />
                  <p className="text-xs font-600 text-white">Conseil IA personnalisé</p>
                </div>
                <button onClick={handleGenerateConseil} disabled={conseilLoading} className="text-[10px] text-[#E4501C] hover:underline font-600 disabled:opacity-50 flex items-center gap-1">
                  {conseilLoading ? <div className="w-3 h-3 border border-[#E4501C] border-t-transparent rounded-full animate-spin" /> : <Icon name="SparklesIcon" size={10} />}
                  {conseilLoading ? 'Génération...' : 'Générer'}
                </button>
              </div>
              {aiConseil ? (
                <p className="text-xs text-white/80 leading-relaxed line-clamp-3">
                  {aiConseil}
                  {conseilLoading && <span className="inline-block w-1 h-3 bg-[#E4501C] animate-pulse ml-0.5 rounded-sm" />}
                </p>
              ) : conseilLoading ? (
                <p className="text-xs text-white/40 animate-pulse">Gemini génère vos conseils...</p>
              ) : (
                <p className="text-xs text-white/40">Cliquez sur &quot;Générer&quot; pour obtenir des conseils personnalisés par Gemini.</p>
              )}
            </div>
          </div>

          {/* Tab navigation — Instagram style */}
          <div className="flex border-t border-white/10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-600 whitespace-nowrap border-t-2 transition-all -mt-px ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
              >
                <Icon name={tab.icon} size={13} variant={activeTab === tab.id ? 'solid' : 'outline'} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-700 ${activeTab === tab.id ? 'bg-white text-[#1C2620]' : 'bg-white/10 text-white/50'}`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {profileLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <>
            {activeTab === 'posts' && <PostsTab userId={user.id} />}
            {activeTab === 'carnets' && <CarnetsTab userId={user.id} />}
            {activeTab === 'inventaire' && <InventaireTab userId={user.id} />}
            {activeTab === 'groupes' && <GroupesTab userId={user.id} />}
            {activeTab === 'commandes' && <CommandesTab userId={user.id} />}
            {activeTab === 'documents' && <DocumentsTab userId={user.id} />}
            {activeTab === 'securite' && <SecuriteTab />}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}