'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Ambassador {
  id: string;
  name: string;
  handle: string;
  tier: 'Explorer' | 'Trailblazer' | 'Legend';
  followers: string;
  commission_pct: number;
  earnings: number;
  clicks: number;
  conversions: number;
  promo_code: string;
  avatar: string;
  status: string;
}

interface PromoCode {
  id: string;
  code: string;
  uses: number;
  revenue: number;
  status: string;
}

const TIERS = [
  {
    name: 'Explorer',
    commission: '8%',
    minFollowers: '5K',
    perks: ['Code promo personnalisé', 'Kit test offert', 'Dashboard analytics', 'Support dédié'],
    color: 'border-info text-info',
    bg: 'bg-blue-50',
  },
  {
    name: 'Trailblazer',
    commission: '12%',
    minFollowers: '25K',
    perks: ['Tout Explorer +', 'Commission 12%', 'Kits exclusifs avant sortie', 'Co-création de contenu', 'Invitation événements'],
    color: 'border-accent text-accent',
    bg: 'bg-orange-50',
    featured: true,
  },
  {
    name: 'Legend',
    commission: '15%',
    minFollowers: '100K',
    perks: ['Tout Trailblazer +', 'Commission 15%', 'Kit signature co-brandé', 'Partage revenus ventes', 'Accès API partenaire'],
    color: 'border-primary text-primary',
    bg: 'bg-red-50',
  },
];

export default function AmbassadeursPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [myAmbassador, setMyAmbassador] = useState<Ambassador | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'programme' | 'dashboard' | 'codes'>('programme');
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ name: '', handle: '', followers: '', platform: 'Instagram', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ambData } = await supabase.from('ambassadors').select('*').eq('status', 'active').order('earnings', { ascending: false });
      setAmbassadors(ambData ?? []);

      const { data: promoData } = await supabase.from('promo_codes').select('*').order('uses', { ascending: false });
      setPromoCodes(promoData ?? []);

      if (user) {
        const { data: myAmb } = await supabase.from('ambassadors').select('*').eq('user_id', user.id).single();
        setMyAmbassador(myAmb ?? null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const promoCode = applyForm.handle.replace('@', '').toUpperCase().slice(0, 8) + Math.floor(Math.random() * 10);
      await supabase.from('ambassadors').insert({
        user_id: user.id,
        name: applyForm.name,
        handle: applyForm.handle,
        tier: 'Explorer',
        followers: applyForm.followers,
        commission_pct: 8,
        earnings: 0,
        clicks: 0,
        conversions: 0,
        promo_code: promoCode,
        avatar: applyForm.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
        status: 'pending',
      });
      setSubmitted(true);
      setTimeout(() => { setApplyOpen(false); setSubmitted(false); }, 2000);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const tierColor: Record<string, string> = {
    Legend: 'text-primary bg-red-100',
    Trailblazer: 'text-accent bg-orange-100',
    Explorer: 'text-info bg-blue-100',
  };

  const earningsData = myAmbassador ? [
    { month: 'Jan', gains: Math.round(myAmbassador.earnings * 0.25) },
    { month: 'Fév', gains: Math.round(myAmbassador.earnings * 0.37) },
    { month: 'Mar', gains: Math.round(myAmbassador.earnings * 0.50) },
    { month: 'Avr', gains: Math.round(myAmbassador.earnings * 0.43) },
    { month: 'Mai', gains: Math.round(myAmbassador.earnings * 0.66) },
    { month: 'Jun', gains: Math.round(myAmbassador.earnings * 0.85) },
    { month: 'Jul', gains: myAmbassador.earnings },
  ] : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-20 bg-dark-bg overflow-hidden relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 right-20 w-64 h-64 rounded-full border border-white" />
          <div className="absolute top-20 right-40 w-40 h-40 rounded-full border border-white" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative">
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>PROGRAMME AMBASSADEURS</p>
          <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Partagez votre passion,<br />gagnez des commissions
          </h1>
          <p className="text-white/60 text-lg max-w-xl mb-8">Rejoignez {ambassadors.length}+ ambassadeurs qui monétisent leur audience en recommandant des kits d&apos;expédition authentiques.</p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => setApplyOpen(true)} className="btn-primary">
              <Icon name="UserPlusIcon" size={16} variant="outline" />
              Devenir ambassadeur
            </button>
            <button onClick={() => setActiveTab('dashboard')} className="btn-secondary border-white/20 text-white">
              <Icon name="ChartBarIcon" size={16} variant="outline" />
              Mon dashboard
            </button>
          </div>

          <div className="flex flex-wrap gap-8 mt-10 pt-8 border-t border-white/10">
            {[
              { value: ambassadors.length + '+', label: 'Ambassadeurs actifs' },
              { value: ambassadors.reduce((s, a) => s + a.earnings, 0).toLocaleString() + '€', label: 'Commissions versées' },
              { value: '15%', label: 'Commission max' },
              { value: '48h', label: 'Délai de paiement' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-mono text-2xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-8 w-fit">
          {[
            { id: 'programme', label: 'Programme', icon: 'StarIcon' },
            { id: 'dashboard', label: 'Dashboard affiliation', icon: 'ChartBarIcon' },
            { id: 'codes', label: 'Codes promo', icon: 'TagIcon' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon name={tab.icon} size={15} variant="outline" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* PROGRAMME */}
        {activeTab === 'programme' && (
          <div className="space-y-8">
            <div>
              <h2 className="font-display font-700 text-2xl text-foreground mb-6" style={{ fontFamily: 'var(--font-display)' }}>Niveaux ambassadeurs</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {TIERS.map((tier) => (
                  <div key={tier.name} className={`topo-card p-6 border-2 ${tier.color} ${'featured' in tier && tier.featured ? 'scale-105 shadow-lg' : ''}`}>
                    {'featured' in tier && tier.featured && (
                      <div className="text-xs font-mono font-700 text-accent uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-mono)' }}>⭐ Le plus populaire</div>
                    )}
                    <div className={`text-2xl font-display font-800 mb-1 ${tier.color.split(' ')[1]}`} style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>{tier.name}</div>
                    <div className="font-mono text-3xl font-700 text-foreground mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{tier.commission}</div>
                    <div className="text-xs text-muted-foreground mb-4">de commission · dès {tier.minFollowers} abonnés</div>
                    <ul className="space-y-2">
                      {tier.perks.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Icon name="CheckIcon" size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" variant="outline" />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => setApplyOpen(true)} className={`w-full mt-5 py-2.5 rounded-xl text-sm font-600 transition-all ${'featured' in tier && tier.featured ? 'btn-primary justify-center' : 'border border-border text-foreground hover:border-primary hover:text-primary'}`}>
                      Postuler
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Top ambassadors */}
            <div>
              <h2 className="font-display font-700 text-2xl text-foreground mb-6" style={{ fontFamily: 'var(--font-display)' }}>Top ambassadeurs</h2>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
              ) : (
                <div className="space-y-3">
                  {ambassadors.map((amb, i) => (
                    <div key={amb.id} className="topo-card p-4 flex items-center gap-4">
                      <div className="font-mono text-lg font-700 text-muted-foreground w-6 text-center" style={{ fontFamily: 'var(--font-mono)' }}>#{i + 1}</div>
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-700 flex-shrink-0">{amb.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-700 text-foreground text-sm" style={{ fontFamily: 'var(--font-display)' }}>{amb.name}</div>
                        <div className="text-xs text-muted-foreground">{amb.handle} · {amb.followers} abonnés</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColor[amb.tier]}`}>{amb.tier}</span>
                      <div className="text-right hidden sm:block">
                        <div className="font-mono font-700 text-primary text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{amb.earnings.toLocaleString()}€</div>
                        <div className="text-xs text-muted-foreground">{amb.conversions} ventes</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {!user ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="LockClosedIcon" size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-display font-700 text-foreground mb-1">Connectez-vous</p>
                <p className="text-sm">Vous devez être connecté pour accéder à votre dashboard.</p>
              </div>
            ) : !myAmbassador ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="UserPlusIcon" size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-display font-700 text-foreground mb-2">Vous n&apos;êtes pas encore ambassadeur</p>
                <button onClick={() => setApplyOpen(true)} className="btn-primary">Postuler maintenant</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Gains ce mois', value: myAmbassador.earnings.toLocaleString() + '€', icon: 'CurrencyEuroIcon', color: 'text-primary' },
                    { label: 'Clics générés', value: myAmbassador.clicks.toLocaleString(), icon: 'CursorArrowRaysIcon', color: 'text-info' },
                    { label: 'Conversions', value: myAmbassador.conversions.toString(), icon: 'ShoppingBagIcon', color: 'text-emerald-600' },
                    { label: 'Taux conversion', value: myAmbassador.clicks > 0 ? ((myAmbassador.conversions / myAmbassador.clicks) * 100).toFixed(1) + '%' : '0%', icon: 'ArrowTrendingUpIcon', color: 'text-accent' },
                  ].map((stat) => (
                    <div key={stat.label} className="topo-card p-4">
                      <Icon name={stat.icon} size={18} className={`${stat.color} mb-2`} variant="outline" />
                      <div className={`font-mono text-xl font-700 ${stat.color}`} style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {earningsData.length > 0 && (
                  <div className="topo-card p-5">
                    <h3 className="font-display font-700 text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Évolution des gains</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={earningsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}€`} />
                        <Tooltip formatter={(v: number) => [`${v}€`, 'Gains']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="gains" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="topo-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-700 text-base text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Mon lien d&apos;affiliation</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColor[myAmbassador.tier]}`}>{myAmbassador.tier}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                      https://kitduvoyageur.com?ref={myAmbassador.promo_code}
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(`https://kitduvoyageur.com?ref=${myAmbassador.promo_code}`)}
                      className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CODES PROMO */}
        {activeTab === 'codes' && (
          <div className="space-y-4">
            <h2 className="font-display font-700 text-2xl text-foreground mb-6" style={{ fontFamily: 'var(--font-display)' }}>Codes promotionnels</h2>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">Code</th>
                      <th className="text-right py-3 px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">Utilisations</th>
                      <th className="text-right py-3 px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">CA généré</th>
                      <th className="text-right py-3 px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoCodes.map((code) => (
                      <tr key={code.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{code.code}</td>
                        <td className="py-3 px-4 text-right text-sm text-muted-foreground">{code.uses.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-700 text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{code.revenue.toLocaleString()}€</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${code.status === 'active' ? 'text-emerald-600 bg-emerald-100' : 'text-muted-foreground bg-muted'}`}>
                            {code.status === 'active' ? 'Actif' : 'Expiré'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setApplyOpen(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            {!submitted ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Postuler comme ambassadeur</h3>
                  <button onClick={() => setApplyOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Nom complet</label>
                    <input required value={applyForm.name} onChange={(e) => setApplyForm((f) => ({ ...f, name: e.target.value }))} className="input-field w-full" placeholder="Votre nom" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Handle / Pseudo</label>
                    <input required value={applyForm.handle} onChange={(e) => setApplyForm((f) => ({ ...f, handle: e.target.value }))} className="input-field w-full" placeholder="@votre_pseudo" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Nombre d&apos;abonnés</label>
                    <input required value={applyForm.followers} onChange={(e) => setApplyForm((f) => ({ ...f, followers: e.target.value }))} className="input-field w-full" placeholder="Ex: 15K" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Plateforme principale</label>
                    <select value={applyForm.platform} onChange={(e) => setApplyForm((f) => ({ ...f, platform: e.target.value }))} className="input-field w-full">
                      {['Instagram', 'YouTube', 'TikTok', 'Blog', 'Autre'].map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Message de motivation</label>
                    <textarea value={applyForm.message} onChange={(e) => setApplyForm((f) => ({ ...f, message: e.target.value }))} rows={3} className="input-field resize-none w-full" placeholder="Pourquoi souhaitez-vous rejoindre notre programme ?" />
                  </div>
                  {!user && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">Connectez-vous pour postuler.</p>}
                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setApplyOpen(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                    <button type="submit" disabled={!user || submitting} className="btn-primary flex-1 justify-center py-3 disabled:opacity-50">
                      {submitting ? 'Envoi...' : 'Envoyer ma candidature'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Candidature envoyée !</h3>
                <p className="text-sm text-muted-foreground">Nous vous contacterons sous 48h.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
