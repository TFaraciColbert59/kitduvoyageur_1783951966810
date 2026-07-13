'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'profil' | 'inventaire' | 'fidelite' | 'gamification' | 'commandes' | 'rapport' | 'documents' | 'securite';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profil', label: 'Profil', icon: 'UserIcon' },
  { id: 'commandes', label: 'Commandes', icon: 'ShoppingBagIcon' },
  { id: 'inventaire', label: 'Inventaire', icon: 'ArchiveBoxIcon' },
  { id: 'fidelite', label: 'Fidélité', icon: 'TrophyIcon' },
  { id: 'gamification', label: 'Défis', icon: 'StarIcon' },
  { id: 'rapport', label: 'Rapport Expé', icon: 'DocumentChartBarIcon' },
  { id: 'documents', label: 'Documents', icon: 'FolderIcon' },
  { id: 'securite', label: 'Sécurité', icon: 'LockClosedIcon' },
];

// Orders and status config moved to CommandesTab component

const LOYALTY_LEVELS = [
  { name: 'Explorateur', min: 0, badge: '🥾', color: 'text-stone-600 bg-stone-100 border-stone-300' },
  { name: 'Aventurier', min: 500, badge: '🏕️', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  { name: 'Randonneur Expert', min: 1500, badge: '🧗', color: 'text-blue-700 bg-blue-50 border-blue-300' },
  { name: 'Guide de Montagne', min: 3500, badge: '🏔️', color: 'text-purple-700 bg-purple-50 border-purple-300' },
  { name: 'Légende du Voyage', min: 7500, badge: '🌍', color: 'text-amber-700 bg-amber-50 border-amber-300' },
];

// Challenges and badges data loaded from Supabase in GamificationTab

// ─── Profile Tab ───────────────────────────────────────────────────────────────
function ProfilTab() {
  const { user, signOut, profile: ctxProfile, refreshProfile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState({ full_name: '', email: '', trust_score: 50, loyalty_points: 0, loyalty_level: 'Explorateur', bio: '', location: '' });
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Use profile from context if available
    if (ctxProfile) {
      setProfile(ctxProfile as typeof profile);
      setEditName(ctxProfile.full_name || '');
      setEditBio(ctxProfile.bio || '');
      setEditLocation(ctxProfile.location || '');
      setLoading(false);
      return;
    }
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setProfile(data);
        setEditName(data.full_name || '');
        setEditBio(data.bio || '');
        setEditLocation(data.location || '');
      } else {
        const name = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '';
        supabase.from('user_profiles').upsert({
          id: user.id,
          email: user.email ?? '',
          full_name: name,
          trust_score: 50,
          loyalty_points: 0,
          loyalty_level: 'Explorateur',
          xp: 0,
          level: 1,
        }, { onConflict: 'id' }).then(() => {
          setProfile((p) => ({ ...p, full_name: name, email: user.email ?? '' }));
          setEditName(name);
        });
      }
      setLoading(false);
    });
  }, [user, supabase, ctxProfile]);

  const handleSave = async () => {
    if (!user) return;
    await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      full_name: editName,
      bio: editBio,
      location: editLocation,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    setProfile((p) => ({ ...p, full_name: editName, bio: editBio, location: editLocation }));
    setEditMode(false);
    setSaved(true);
    await refreshProfile?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const _initials = profile.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-700 text-xl text-[#1C2620]">Informations personnelles</h2>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-600 font-medium">✓ Sauvegardé</span>}
            <button onClick={editMode ? handleSave : () => setEditMode(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${editMode ? 'bg-[#E4501C] text-white' : 'border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620]'}`}>
              <Icon name={editMode ? 'CheckIcon' : 'PencilIcon'} size={14} variant="outline" />
              {editMode ? 'Sauvegarder' : 'Modifier'}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-[#C8C3B0]/30 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5">Nom complet</label>
              {editMode ? (
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              ) : (
                <p className="text-sm text-[#1C2620] py-2.5 border-b border-[#C8C3B0]/60">{profile.full_name || 'Non renseigné'}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5">Email</label>
              <p className="text-sm text-[#1C2620] py-2.5 border-b border-[#C8C3B0]/60">{user?.email}</p>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5">Niveau fidélité</label>
              <p className="text-sm text-[#1C2620] py-2.5 border-b border-[#C8C3B0]/60">{profile.loyalty_level}</p>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5">Points fidélité</label>
              <p className="text-sm text-[#1C2620] py-2.5 border-b border-[#C8C3B0]/60">{profile.loyalty_points} pts</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5">Localisation</label>
              {editMode ? (
                <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Paris, France" className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              ) : (
                <p className="text-sm text-[#1C2620] py-2.5 border-b border-[#C8C3B0]/60">{(profile as { location?: string }).location || 'Non renseigné'}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5">Bio</label>
              {editMode ? (
                <textarea rows={3} value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Parlez de vous, vos aventures..." className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C] resize-none" />
              ) : (
                <p className="text-sm text-[#1C2620] py-2.5 border-b border-[#C8C3B0]/60">{(profile as { bio?: string }).bio || 'Non renseigné'}</p>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="bg-[#1C2620] rounded-2xl p-5">
          <p className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase mb-3">Trust Score</p>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <svg width={72} height={72} className="-rotate-90">
                <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5} />
                <circle cx={36} cy={36} r={30} fill="none" stroke="#E4501C" strokeWidth={5} strokeDasharray={2 * Math.PI * 30} strokeDashoffset={2 * Math.PI * 30 * (1 - (profile.trust_score || 50) / 100)} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="font-mono font-700 text-white text-lg">{profile.trust_score || 50}</span></div>
            </div>
            <div>
              <p className="font-display font-700 text-white text-sm">Confirmé 🏔️</p>
              <p className="text-white/40 text-xs mt-1">Score de confiance</p>
            </div>
          </div>
        </div>
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
          <p className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.2em] uppercase mb-3">Accès rapide</p>
          <div className="flex flex-col gap-1">
            {[{ label: 'Mon profil public', href: user ? `/profil/${user.id}` : '/compte', icon: 'UserCircleIcon' }, { label: 'Configurateur IA', href: '/ai-configurator', icon: 'SparklesIcon' }, { label: 'Mes alertes', href: '/alertes', icon: 'BellIcon' }, { label: 'Copilote IA', href: '/copilote', icon: 'ChatBubbleLeftRightIcon' }].map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#5C6B5E] hover:text-[#1C2620] hover:bg-[#E7E3D6] transition-all">
                <Icon name={item.icon as string} size={14} variant="outline" />{item.label}
              </Link>
            ))}
          </div>
        </div>
        <button onClick={() => signOut()} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all text-sm font-medium">
          <Icon name="ArrowRightOnRectangleIcon" size={15} variant="outline" /> Déconnexion
        </button>
      </div>
    </div>
  );
}

// ─── Commandes Tab ─────────────────────────────────────────────────────────────
function CommandesTab() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<{ id: string; order_number: string; created_at: string; status: string; total_eur: number; items_count: number; tracking_number: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
      setOrders(data ?? []);
      setLoading(false);
    });
  }, [user, supabase]);

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    livré: { label: 'Livré', cls: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
    en_transit: { label: 'En transit', cls: 'text-blue-600 bg-blue-50 border-blue-200' },
    en_preparation: { label: 'En préparation', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    annulé: { label: 'Annulé', cls: 'text-red-500 bg-red-50 border-red-200' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Historique des commandes</h2>
        <span className="text-xs font-mono text-[#5C6B5E]">{orders.length} commandes</span>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <p className="text-sm">Aucune commande pour l&apos;instant.</p>
        </div>
      ) : (
        orders.map((order) => {
          const cfg = STATUS_CFG[order.status] ?? STATUS_CFG['en_preparation'];
          return (
            <div key={order.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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

// ─── Inventaire Tab ────────────────────────────────────────────────────────────
function InventaireTab() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [gear, setGear] = useState<{ id: string; name: string; brand: string; category: string; condition: string; purchase_price: number; weight_g: number; usage_count: number; image: string; alt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('gear_items').select('id, name, brand, category, condition, purchase_price, weight_g, usage_count, image, alt').eq('user_id', user.id).order('created_at', { ascending: false }).limit(6).then(({ data }) => {
      setGear(data ?? []);
      setLoading(false);
    });
  }, [user, supabase]);

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Mon inventaire</h2>
        <Link href="/inventaire" className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><Icon name="ArrowTopRightOnSquareIcon" size={14} /> Gérer l&apos;inventaire</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'Articles', value: gear.length }, { label: 'Poids total', value: `${(totalWeight / 1000).toFixed(1)} kg` }, { label: 'Valeur estimée', value: `${totalValue.toLocaleString()}€` }].map((s) => (
          <div key={s.label} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 text-center">
            <p className="font-display font-700 text-[#1C2620] text-xl">{s.value}</p>
            <p className="text-xs text-[#5C6B5E] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : gear.length === 0 ? (
        <div className="text-center py-8 text-[#5C6B5E]">
          <p className="text-sm">Aucun équipement. <Link href="/inventaire" className="text-[#E4501C] underline">Ajoutez votre premier article</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gear.map((g) => {
            const cond = CONDITION_CFG[g.condition] || CONDITION_CFG['bon'];
            return (
              <div key={g.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden flex">
                <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image || 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30'} alt={g.alt || g.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-600 text-sm text-[#1C2620] line-clamp-1">{g.name}</p>
                    <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cond.color}`}>{cond.label}</span>
                  </div>
                  <p className="text-xs text-[#5C6B5E] mt-0.5">{g.brand} · {g.weight_g}g</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#5C6B5E]">
                    <span>{g.usage_count} utilisations</span>
                    <span>{g.purchase_price}€</span>
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

// ─── Fidélité Tab ──────────────────────────────────────────────────────────────
function FideliteTab() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [userPoints, setUserPoints] = useState(0);
  const [rewards, setRewards] = useState<{ id: string; title: string; points_cost: number; image: string; alt: string }[]>([]);
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);
  const [redeemedMsg, setRedeemedMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: rewardsData } = await supabase.from('loyalty_rewards').select('id, title, points_cost, image, alt').eq('available', true).order('points_cost').limit(3);
      setRewards(rewardsData ?? []);
      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('loyalty_points').eq('id', user.id).single();
        setUserPoints(profile?.loyalty_points ?? 0);
        const { data: redemptions } = await supabase.from('loyalty_redemptions').select('reward_id').eq('user_id', user.id);
        setRedeemedIds(redemptions?.map((r) => r.reward_id) ?? []);
      }
      setLoading(false);
    };
    load();
  }, [user, supabase]);

  const currentLevel = LOYALTY_LEVELS.filter((l) => userPoints >= l.min).pop()!;
  const nextLevel = LOYALTY_LEVELS.find((l) => l.min > userPoints);
  const progress = nextLevel ? (userPoints - currentLevel.min) / (nextLevel.min - currentLevel.min) * 100 : 100;

  const handleRedeem = async (reward: typeof rewards[0]) => {
    if (!user || userPoints < reward.points_cost || redeemedIds.includes(reward.id)) return;
    const newPoints = userPoints - reward.points_cost;
    await supabase.from('user_profiles').update({ loyalty_points: newPoints }).eq('id', user.id);
    await supabase.from('loyalty_redemptions').insert({ user_id: user.id, reward_id: reward.id, points_spent: reward.points_cost });
    await supabase.from('loyalty_history').insert({ user_id: user.id, action: `Récompense: ${reward.title}`, points: -reward.points_cost, type: 'spent' });
    setUserPoints(newPoints);
    setRedeemedIds((prev) => [...prev, reward.id]);
    setRedeemedMsg(`"${reward.title}" échangé ! Le code a été envoyé à votre email.`);
    setTimeout(() => setRedeemedMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {redeemedMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <Icon name="CheckCircleIcon" size={18} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700">{redeemedMsg}</p>
        </div>
      )}
      <div className="bg-[#1C2620] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">Niveau actuel</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentLevel.badge}</span>
              <p className="font-display font-700 text-white text-xl">{currentLevel.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono font-700 text-[#E4501C] text-3xl">{userPoints.toLocaleString()}</p>
            <p className="text-white/40 text-xs">points</p>
          </div>
        </div>
        {nextLevel && (
          <div>
            <div className="flex justify-between text-xs text-white/40 mb-1.5">
              <span>{userPoints} pts</span>
              <span>{nextLevel.name} à {nextLevel.min} pts</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#E4501C] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-700 text-[#1C2620]">Récompenses disponibles</h3>
          <Link href="/fidelite" className="text-xs text-[#E4501C] hover:underline">Voir tout →</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rewards.map((r) => {
              const redeemed = redeemedIds.includes(r.id);
              return (
                <div key={r.id} className={`bg-[#EDEAE0] border rounded-2xl overflow-hidden ${redeemed ? 'border-emerald-300 opacity-70' : 'border-[#C8C3B0]'}`}>
                  <div className="h-28 overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image || 'https://images.unsplash.com/photo-1637044500577-726eac69c2c4'} alt={r.alt || r.title} className="w-full h-full object-cover" />
                    {redeemed && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center"><span className="bg-emerald-500 text-white text-xs font-700 px-3 py-1 rounded-full">✓ Échangé</span></div>}
                  </div>
                  <div className="p-3">
                    <p className="font-600 text-sm text-[#1C2620] mb-2">{r.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-700 text-[#E4501C]">{r.points_cost} pts</span>
                      <button onClick={() => handleRedeem(r)} disabled={userPoints < r.points_cost || redeemed} className={`px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${redeemed ? 'bg-emerald-100 text-emerald-700 cursor-default' : userPoints >= r.points_cost ? 'bg-[#E4501C] text-white hover:opacity-90' : 'bg-[#C8C3B0] text-[#5C6B5E] cursor-not-allowed'}`}>
                        {redeemed ? '✓ Obtenu' : userPoints >= r.points_cost ? 'Échanger' : 'Insuffisant'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Gamification Tab ──────────────────────────────────────────────────────────
function GamificationTab() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [challenges, setChallenges] = useState<{ id: string; title: string; description: string; xp: number; category: string; difficulty: string; total: number; progress?: number; completed?: boolean }[]>([]);
  const [badges, setBadges] = useState<{ id: string; name: string; icon: string; rarity: string; holders_count: number; earned?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true).order('xp', { ascending: false }).limit(4);
      const { data: badgesData } = await supabase.from('badges').select('*').order('holders_count', { ascending: false }).limit(8);

      let userChallengesMap: Record<string, { progress: number; completed: boolean }> = {};
      let earnedBadgeIds: Set<string> = new Set();

      if (user) {
        const { data: uc } = await supabase.from('user_challenges').select('*').eq('user_id', user.id);
        userChallengesMap = Object.fromEntries((uc ?? []).map((c) => [c.challenge_id, { progress: c.progress, completed: c.completed }]));
        const { data: ub } = await supabase.from('user_badges').select('badge_id').eq('user_id', user.id);
        earnedBadgeIds = new Set((ub ?? []).map((b) => b.badge_id));
      }

      setChallenges((challengesData ?? []).map((c) => ({ ...c, progress: userChallengesMap[c.id]?.progress ?? 0, completed: userChallengesMap[c.id]?.completed ?? false })));
      setBadges((badgesData ?? []).map((b) => ({ ...b, earned: earnedBadgeIds.has(b.id) })));
      setLoading(false);
    };
    load();
  }, [user, supabase]);

  const RARITY_CFG: Record<string, string> = { Commun: 'text-stone-600 bg-stone-100', Rare: 'text-blue-600 bg-blue-100', Épique: 'text-purple-600 bg-purple-100', Légendaire: 'text-amber-600 bg-amber-100' };
  const DIFF_CFG: Record<string, string> = { Facile: 'text-emerald-600 bg-emerald-50 border-emerald-200', Moyen: 'text-blue-600 bg-blue-50 border-blue-200', Difficile: 'text-amber-600 bg-amber-50 border-amber-200', Légendaire: 'text-purple-600 bg-purple-50 border-purple-200' };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1, 2].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display font-700 text-[#1C2620] mb-3">Défis actifs</h3>
          <div className="space-y-3">
            {challenges.length === 0 ? (
              <p className="text-sm text-[#5C6B5E]">Aucun défi disponible</p>
            ) : challenges.map((c) => (
              <div key={c.id} className={`bg-[#EDEAE0] border rounded-2xl p-4 ${c.completed ? 'border-emerald-300 bg-emerald-50' : 'border-[#C8C3B0]'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-600 text-sm text-[#1C2620]">{c.title}</p>
                    <p className="text-xs text-[#5C6B5E]">{c.category}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${DIFF_CFG[c.difficulty] ?? DIFF_CFG['Moyen']}`}>{c.difficulty}</span>
                    <span className="font-mono font-700 text-[#E4501C] text-sm">+{c.xp} XP</span>
                  </div>
                </div>
                {!c.completed ? (
                  <div>
                    <div className="flex justify-between text-xs text-[#5C6B5E] mb-1"><span>{c.progress ?? 0}/{c.total}</span><span>{Math.round(((c.progress ?? 0) / c.total) * 100)}%</span></div>
                    <div className="h-1.5 bg-[#C8C3B0] rounded-full overflow-hidden"><div className="h-full bg-[#E4501C] rounded-full" style={{ width: `${((c.progress ?? 0) / c.total) * 100}%` }} /></div>
                  </div>
                ) : <p className="text-xs text-emerald-600 font-600">✓ Complété</p>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-display font-700 text-[#1C2620] mb-3">Badges</h3>
          <div className="grid grid-cols-2 gap-3">
            {badges.length === 0 ? (
              <p className="text-sm text-[#5C6B5E] col-span-2">Aucun badge disponible</p>
            ) : badges.map((b) => (
              <div key={b.id} className={`bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 text-center ${!b.earned ? 'opacity-50' : ''}`}>
                <span className="text-3xl block mb-2">{b.icon}</span>
                <p className="font-600 text-xs text-[#1C2620] mb-1">{b.name}</p>
                <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${RARITY_CFG[b.rarity] ?? RARITY_CFG['Commun']}`}>{b.rarity}</span>
                <p className="text-[10px] text-[#5C6B5E] mt-1">{b.holders_count} détenteurs</p>
                {!b.earned && <p className="text-[10px] text-[#5C6B5E] mt-1">🔒 Non obtenu</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rapport Tab ───────────────────────────────────────────────────────────────
function RapportTab() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState<{ id: string; destination: string; country: string; created_at: string; duration: string; score: number; budget_estimated: number; budget_real: number; image: string; alt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('expedition_reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4).then(({ data }) => {
      setReports(data ?? []);
      setLoading(false);
    });
  }, [user, supabase]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Rapports d&apos;expédition</h2>
        <Link href="/rapport-expedition" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Icon name="PlusIcon" size={14} /> Nouveau rapport
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-[#5C6B5E]">
          <p className="text-sm">Aucun rapport. <Link href="/rapport-expedition" className="text-[#E4501C] underline">Créez votre premier rapport</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r) => {
            const delta = r.budget_real - r.budget_estimated;
            return (
              <div key={r.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden">
                <div className="relative h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa'} alt={r.alt || r.destination} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-[10px] text-white/70">{r.country} · {new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} · {r.duration}</p>
                    <h3 className="font-display font-700 text-white">{r.destination}</h3>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-mono font-700 text-[#E4501C] text-xl">{r.score}</p>
                      <p className="text-[10px] text-[#5C6B5E]">Score</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-mono font-700 text-lg ${delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{delta > 0 ? '+' : ''}{delta}€</p>
                      <p className="text-[10px] text-[#5C6B5E]">Budget delta</p>
                    </div>
                  </div>
                  <Link href="/rapport-expedition" className="border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] px-4 py-2 rounded-xl text-sm transition-colors">Voir rapport</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab ─────────────────────────────────────────────────────────────
function DocumentsTab() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const typeIcon: Record<string, string> = { passeport: '🛂', visa: '📋', assurance: '🛡️', vaccin: '💉', permis: '🪪', autre: '📄' };
  const [documents, setDocuments] = useState<{ id: string; name: string; type: string; destination: string; expiry: string; file_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'passeport', destination: '', expiry: '', file_name: '' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => { setNow(Date.now()); }, []);

  const loadDocs = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('user_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setDocuments(data ?? []);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_documents').insert({
        user_id: user.id,
        name: form.name,
        type: form.type,
        destination: form.destination,
        expiry: form.expiry || null,
        file_name: form.file_name || `${form.name.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      });
      if (error) throw error;
      setShowAddModal(false);
      setForm({ name: '', type: 'passeport', destination: '', expiry: '', file_name: '' });
      setSuccessMsg(`"${form.name}" ajouté avec succès.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadDocs();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('user_documents').delete().eq('id', id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-5">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} className="text-emerald-600" />
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Documents de voyage</h2>
        <button onClick={() => setShowAddModal(true)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Icon name="PlusIcon" size={14} /> Ajouter
        </button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-[#5C6B5E]">
          <Icon name="FolderIcon" size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun document. Ajoutez votre passeport, visa, assurance...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documents.map((d) => {
            const daysLeft = now > 0 && d.expiry ? Math.ceil((new Date(d.expiry).getTime() - now) / 86400000) : 999;
            const urgent = d.expiry ? daysLeft < 90 : false;
            return (
              <div key={d.id} className={`bg-[#EDEAE0] border rounded-2xl p-5 ${urgent ? 'border-amber-300' : 'border-[#C8C3B0]'}`}>
                <div className="flex items-start justify-between mb-3">
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
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-600 mb-2 ${urgent ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                    <Icon name={urgent ? 'ExclamationTriangleIcon' : 'CheckCircleIcon'} size={12} />
                    Expire le {new Date(d.expiry).toLocaleDateString('fr-FR')} ({daysLeft}j)
                  </div>
                )}
                {d.file_name && (
                  <div className="flex items-center gap-2 text-xs text-[#5C6B5E]">
                    <Icon name="DocumentIcon" size={12} variant="outline" />
                    <span className="truncate">{d.file_name}</span>
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
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[#E7E3D6] rounded-lg transition-colors">
                <Icon name="XMarkIcon" size={20} variant="outline" />
              </button>
            </div>
            <form onSubmit={handleAddDoc} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Nom du document *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Passeport FR" className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]">
                  {Object.entries(typeIcon).map(([k, v]) => <option key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Destination</label>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Ex: Népal, Monde entier..." className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Date d&apos;expiration</label>
                <input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Fichier</label>
                <div className="flex gap-2">
                  <input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} placeholder="document.pdf" className="flex-1 bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
                  <label className="flex items-center gap-1 px-3 py-2.5 bg-[#1C2620] text-white rounded-xl text-xs font-600 cursor-pointer hover:opacity-90 transition-opacity">
                    <Icon name="ArrowUpTrayIcon" size={14} variant="outline" />
                    Upload
                    <input type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setForm({ ...form, file_name: e.target.files[0].name }); }} />
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E] hover:text-[#1C2620] transition-colors">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
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
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showTwoFAModal, setShowTwoFAModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPwd: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [changingPwd, setChangingPwd] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPwd !== passwordForm.confirm) {
      setPasswordMsg('Les mots de passe ne correspondent pas.');
      return;
    }
    if (passwordForm.newPwd.length < 8) {
      setPasswordMsg('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setChangingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPwd });
      if (error) throw error;
      setShowPasswordModal(false);
      setPasswordForm({ newPwd: '', confirm: '' });
      setPasswordMsg('Mot de passe modifié avec succès !');
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (err: unknown) {
      setPasswordMsg(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    const { data: gear } = await supabase.from('gear_items').select('name, brand, category, condition').eq('user_id', user.id);
    const { data: docs } = await supabase.from('user_documents').select('name, type, destination').eq('user_id', user.id);
    const exportData = { profile, gear: gear ?? [], documents: docs ?? [], exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mes_donnees_kdv.json';
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Données exportées avec succès.');
    setTimeout(() => setExportMsg(null), 3000);
  };

  return (
    <div className="space-y-5">
      <h2 className="font-display font-700 text-xl text-[#1C2620]">Sécurité du compte</h2>
      {passwordMsg && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm ${passwordMsg.includes('succès') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <Icon name={passwordMsg.includes('succès') ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={16} />
          {passwordMsg}
        </div>
      )}
      {exportMsg && (
        <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-2 text-sm">
          <Icon name="CheckCircleIcon" size={16} />
          {exportMsg}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100">
            <Icon name="LockClosedIcon" size={18} className="text-emerald-600" variant="outline" />
          </div>
          <div className="flex-1">
            <p className="font-600 text-sm text-[#1C2620]">Mot de passe</p>
            <p className="text-xs text-[#5C6B5E]">Modifier votre mot de passe</p>
          </div>
          <button onClick={() => setShowPasswordModal(true)} className="px-3 py-1.5 border border-[#C8C3B0] rounded-xl text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all flex-shrink-0">Modifier</button>
        </div>
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${twoFAEnabled ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <Icon name="ShieldCheckIcon" size={18} className={twoFAEnabled ? 'text-emerald-600' : 'text-amber-600'} variant="outline" />
          </div>
          <div className="flex-1">
            <p className="font-600 text-sm text-[#1C2620]">Double authentification</p>
            <p className="text-xs text-[#5C6B5E]">{twoFAEnabled ? '✓ Activée' : 'Non activée — recommandé'}</p>
          </div>
          <button onClick={() => setShowTwoFAModal(true)} className="px-3 py-1.5 border border-[#C8C3B0] rounded-xl text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all flex-shrink-0">
            {twoFAEnabled ? 'Gérer' : 'Activer'}
          </button>
        </div>
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100">
            <Icon name="DevicePhoneMobileIcon" size={18} className="text-emerald-600" variant="outline" />
          </div>
          <div className="flex-1">
            <p className="font-600 text-sm text-[#1C2620]">Sessions actives</p>
            <p className="text-xs text-[#5C6B5E]">Gérer vos appareils connectés</p>
          </div>
          <button onClick={() => setShowSessionsModal(true)} className="px-3 py-1.5 border border-[#C8C3B0] rounded-xl text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all flex-shrink-0">Gérer</button>
        </div>
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100">
            <Icon name="DocumentArrowDownIcon" size={18} className="text-emerald-600" variant="outline" />
          </div>
          <div className="flex-1">
            <p className="font-600 text-sm text-[#1C2620]">Données personnelles</p>
            <p className="text-xs text-[#5C6B5E]">Exporter vos données</p>
          </div>
          <button onClick={handleExport} className="px-3 py-1.5 border border-[#C8C3B0] rounded-xl text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all flex-shrink-0">Exporter</button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#EDEAE0] rounded-2xl border border-[#C8C3B0] w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-700 text-[#1C2620]">Modifier le mot de passe</h2>
              <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-[#E7E3D6] rounded-lg"><Icon name="XMarkIcon" size={20} variant="outline" /></button>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Nouveau mot de passe</label>
                <input required type="password" value={passwordForm.newPwd} onChange={(e) => setPasswordForm({ ...passwordForm, newPwd: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#5C6B5E] uppercase tracking-wider mb-1">Confirmer le nouveau mot de passe</label>
                <input required type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="w-full bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:border-[#E4501C]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E] hover:text-[#1C2620] transition-colors">Annuler</button>
                <button type="submit" disabled={changingPwd} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{changingPwd ? 'Modification...' : 'Modifier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTwoFAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#EDEAE0] rounded-2xl border border-[#C8C3B0] w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-700 text-[#1C2620]">Double authentification</h2>
              <button onClick={() => setShowTwoFAModal(false)} className="p-2 hover:bg-[#E7E3D6] rounded-lg"><Icon name="XMarkIcon" size={20} variant="outline" /></button>
            </div>
            {!twoFAEnabled ? (
              <div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-amber-700">La double authentification ajoute une couche de sécurité supplémentaire à votre compte.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowTwoFAModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E]">Annuler</button>
                  <button onClick={() => { setTwoFAEnabled(true); setShowTwoFAModal(false); }} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-medium">Activer</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-emerald-700">✓ La double authentification est activée.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowTwoFAModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E]">Fermer</button>
                  <button onClick={() => { setTwoFAEnabled(false); setShowTwoFAModal(false); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium">Désactiver</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSessionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#EDEAE0] rounded-2xl border border-[#C8C3B0] w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-700 text-[#1C2620]">Sessions actives</h2>
              <button onClick={() => setShowSessionsModal(false)} className="p-2 hover:bg-[#E7E3D6] rounded-lg"><Icon name="XMarkIcon" size={20} variant="outline" /></button>
            </div>
            <div className="space-y-3 mb-5">
              {[{ device: 'Navigateur Web — Session actuelle', location: 'Session en cours', time: 'Actif maintenant', current: true }].map((session, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#E7E3D6] rounded-xl border border-[#C8C3B0]">
                  <Icon name="DevicePhoneMobileIcon" size={18} className="text-[#5C6B5E] flex-shrink-0" variant="outline" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-600 text-[#1C2620] truncate">{session.device}</p>
                    <p className="text-xs text-[#5C6B5E]">{session.location} · {session.time}</p>
                  </div>
                  <span className="text-[10px] font-600 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0">Actuel</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSessionsModal(false)} className="w-full py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-medium text-[#5C6B5E] hover:text-[#1C2620] transition-colors">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ComptePage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>('profil');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  useEffect(() => {
    if (!user) return;
    setProfileEmail(user.email ?? '');
    supabase.from('user_profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfileName(data.full_name);
    });
  }, [user, supabase]);

  const initials = profileName ? profileName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : (profileEmail?.[0] ?? 'U').toUpperCase();

  const renderTab = () => {
    switch (activeTab) {
      case 'profil': return <ProfilTab />;
      case 'commandes': return <CommandesTab />;
      case 'inventaire': return <InventaireTab />;
      case 'fidelite': return <FideliteTab />;
      case 'gamification': return <GamificationTab />;
      case 'rapport': return <RapportTab />;
      case 'documents': return <DocumentsTab />;
      case 'securite': return <SecuriteTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#E7E3D6] text-[#1C2620]">
      <Header />
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8">
            <div className="relative">
              <div className="w-[72px] h-[72px] rounded-2xl bg-[#E4501C]/20 border-2 border-[#E4501C]/40 flex items-center justify-center">
                <span className="font-display font-800 text-2xl text-[#E4501C]">{initials}</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#1C2620] flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-1">Mon compte</p>
              <h1 className="font-display font-800 text-white text-2xl sm:text-3xl tracking-tight">{profileName || profileEmail || 'Mon compte'}</h1>
              <p className="text-white/40 text-sm mt-0.5">{profileEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 overflow-x-auto pb-px scrollbar-hide">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#E7E3D6] text-[#1C2620]' : 'text-white/50 hover:text-white hover:bg-white/8'}`}>
                <Icon name={tab.icon as string} size={14} variant="outline" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTab()}
      </div>
      <Footer />
    </div>
  );
}