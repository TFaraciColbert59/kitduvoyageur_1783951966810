'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

interface Member {
  id: string;
  name: string;
  role: 'chef' | 'membre';
  weight: number;
  capacity: number;
  items: string[];
  avatar: string;
  color: string;
}

interface SharedItem {
  id: string;
  name: string;
  weight: number;
  category: string;
  assignedTo: string;
  quantity: number;
}

const INITIAL_MEMBERS: Member[] = [
  { id: 'm1', name: 'Thomas (Moi)', role: 'chef', weight: 14200, capacity: 18000, items: ['Tente 2P', 'Réchaud', 'Filtre eau'], avatar: 'TH', color: '#E4501C' },
  { id: 'm2', name: 'Marie', role: 'membre', weight: 9800, capacity: 14000, items: ['Trousse médicale', 'Nourriture J1-J3'], avatar: 'MA', color: '#33463C' },
  { id: 'm3', name: 'Lucas', role: 'membre', weight: 11400, capacity: 16000, items: ['Corde 50m', 'Baudrier x2'], avatar: 'LU', color: '#3E6B7A' },
  { id: 'm4', name: 'Sophie', role: 'membre', weight: 8200, capacity: 12000, items: ['Nourriture J4-J7', 'Trépied photo'], avatar: 'SO', color: '#B5652D' },
];

const SHARED_ITEMS: SharedItem[] = [
  { id: 'i1', name: 'Tente 4 saisons', weight: 2800, category: 'Abri', assignedTo: 'm1', quantity: 1 },
  { id: 'i2', name: 'Réchaud MSR', weight: 340, category: 'Cuisine', assignedTo: 'm1', quantity: 1 },
  { id: 'i3', name: 'Filtre eau Sawyer', weight: 85, category: 'Eau', assignedTo: 'm1', quantity: 1 },
  { id: 'i4', name: 'Trousse médicale', weight: 620, category: 'Sécurité', assignedTo: 'm2', quantity: 1 },
  { id: 'i5', name: 'Rations J1-J3', weight: 2100, category: 'Nourriture', assignedTo: 'm2', quantity: 3 },
  { id: 'i6', name: 'Corde 50m', weight: 3200, category: 'Technique', assignedTo: 'm3', quantity: 1 },
  { id: 'i7', name: 'Baudrier', weight: 480, category: 'Technique', assignedTo: 'm3', quantity: 2 },
  { id: 'i8', name: 'Rations J4-J7', weight: 2800, category: 'Nourriture', assignedTo: 'm4', quantity: 4 },
];

const CATEGORY_COLORS: Record<string, string> = {
  Abri: 'bg-blue-100 text-blue-700',
  Cuisine: 'bg-orange-100 text-orange-700',
  Eau: 'bg-cyan-100 text-cyan-700',
  Sécurité: 'bg-red-100 text-red-700',
  Nourriture: 'bg-green-100 text-green-700',
  Technique: 'bg-purple-100 text-purple-700',
};

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function GroupePage() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [items, setItems] = useState<SharedItem[]>(SHARED_ITEMS);
  const [activeTab, setActiveTab] = useState<'repartition' | 'liste' | 'invite'>('repartition');
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', weight: '', category: 'Abri', assignedTo: 'm1', quantity: '1' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  const totalGroupWeight = members.reduce((sum, m) => sum + m.weight, 0);
  const totalGroupCapacity = members.reduce((sum, m) => sum + m.capacity, 0);
  const avgLoad = totalGroupWeight / members.length;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const item: SharedItem = {
      id: `i${Date.now()}`,
      name: newItem.name,
      weight: parseInt(newItem.weight) || 0,
      category: newItem.category,
      assignedTo: newItem.assignedTo,
      quantity: parseInt(newItem.quantity) || 1,
    };
    setItems(prev => [...prev, item]);
    const member = members.find(m => m.id === newItem.assignedTo);
    if (member) {
      setMembers(prev => prev.map(m => m.id === newItem.assignedTo
        ? { ...m, weight: m.weight + item.weight * item.quantity, items: [...m.items, item.name] }
        : m
      ));
    }
    setNewItem({ name: '', weight: '', category: 'Abri', assignedTo: 'm1', quantity: '1' });
    setAddItemOpen(false);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSent(true);
    setTimeout(() => { setInviteSent(false); setInviteEmail(''); }, 2000);
  };

  const getLoadStatus = (weight: number, capacity: number) => {
    const pct = (weight / capacity) * 100;
    if (pct > 90) return { label: 'Surchargé', color: 'text-red-600' };
    if (pct > 75) return { label: 'Chargé', color: 'text-amber-600' };
    return { label: 'Optimal', color: 'text-emerald-600' };
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-20 bg-dark-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>PLANIFICATION GROUPE</p>
          <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Voyagez ensemble,<br />organisez intelligemment
          </h1>
          <p className="text-white/60 text-lg max-w-xl">Kits partagés, répartition du poids équilibrée, coordination en temps réel pour toute l&apos;équipe.</p>

          <div className="flex flex-wrap gap-6 mt-8 pt-8 border-t border-white/10">
            <div>
              <div className="font-mono text-xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{members.length} membres</div>
              <div className="text-xs text-white/40">Équipe active</div>
            </div>
            <div>
              <div className="font-mono text-xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{formatWeight(totalGroupWeight)}</div>
              <div className="text-xs text-white/40">Poids total groupe</div>
            </div>
            <div>
              <div className="font-mono text-xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{items.length} articles</div>
              <div className="text-xs text-white/40">Équipements partagés</div>
            </div>
            <div>
              <div className="font-mono text-xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{formatWeight(Math.round(avgLoad))}</div>
              <div className="text-xs text-white/40">Charge moyenne</div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 w-fit">
          {[
            { id: 'repartition', label: 'Répartition poids', icon: 'ScaleIcon' },
            { id: 'liste', label: 'Liste partagée', icon: 'ListBulletIcon' },
            { id: 'invite', label: 'Inviter membres', icon: 'UserPlusIcon' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={15} variant="outline" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* REPARTITION */}
        {activeTab === 'repartition' && (
          <div className="space-y-4">
            {/* Group overview bar */}
            <div className="topo-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-700 text-base text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Charge totale du groupe</h3>
                <span className="font-mono text-sm font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatWeight(totalGroupWeight)} / {formatWeight(totalGroupCapacity)}
                </span>
              </div>
              <div className="weight-gauge">
                <div className="weight-gauge-fill" style={{ width: `${Math.min((totalGroupWeight / totalGroupCapacity) * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>0 kg</span>
                <span className="text-emerald-600 font-medium">Charge optimale ✓</span>
                <span>{formatWeight(totalGroupCapacity)}</span>
              </div>
            </div>

            {/* Members */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map(member => {
                const pct = Math.min((member.weight / member.capacity) * 100, 100);
                const status = getLoadStatus(member.weight, member.capacity);
                return (
                  <div key={member.id} className="topo-card p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-700 flex-shrink-0" style={{ background: member.color }}>
                        {member.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-700 text-foreground text-sm" style={{ fontFamily: 'var(--font-display)' }}>{member.name}</span>
                          {member.role === 'chef' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase font-700" style={{ fontFamily: 'var(--font-mono)' }}>Chef</span>
                          )}
                        </div>
                        <div className={`text-xs font-medium ${status.color}`}>{status.label}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-700 text-foreground text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{formatWeight(member.weight)}</div>
                        <div className="text-xs text-muted-foreground">/ {formatWeight(member.capacity)}</div>
                      </div>
                    </div>

                    {/* Weight bar */}
                    <div className="weight-gauge mb-3">
                      <div
                        className="weight-gauge-fill"
                        style={{
                          width: `${pct}%`,
                          background: pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : 'var(--primary)',
                        }}
                      />
                    </div>

                    {/* Items */}
                    <div className="flex flex-wrap gap-1.5">
                      {member.items.map(item => (
                        <span key={item} className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">{item}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optimization tip */}
            <div className="topo-card p-4 border border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <Icon name="LightBulbIcon" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" variant="outline" />
                <div>
                  <div className="font-display font-700 text-sm text-amber-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Suggestion d&apos;optimisation</div>
                  <p className="text-sm text-amber-700">Thomas porte 79% de sa capacité. Transférer la corde (3.2 kg) de Lucas à Thomas équilibrerait les charges à ±5%.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LISTE PARTAGÉE */}
        {activeTab === 'liste' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-700 text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Équipements du groupe</h2>
              <button onClick={() => setAddItemOpen(true)} className="btn-primary py-2 px-4 text-sm">
                <Icon name="PlusIcon" size={14} variant="outline" />
                Ajouter un article
              </button>
            </div>

            <div className="topo-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-card/50">
                  <tr className="border-b border-border">
                    {['Article', 'Catégorie', 'Poids', 'Qté', 'Assigné à'].map(h => (
                      <th key={h} className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(item => {
                    const member = members.find(m => m.id === item.assignedTo);
                    return (
                      <tr key={item.id} className="hover:bg-card/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] || 'bg-muted text-muted-foreground'}`}>{item.category}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{formatWeight(item.weight)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>×{item.quantity}</td>
                        <td className="px-4 py-3">
                          {member && (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-700" style={{ background: member.color }}>
                                {member.avatar}
                              </div>
                              <span className="text-sm text-foreground">{member.name}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INVITE */}
        {activeTab === 'invite' && (
          <div className="max-w-lg">
            <div className="topo-card p-6">
              <h2 className="font-display font-700 text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Inviter des membres</h2>
              <p className="text-sm text-muted-foreground mb-6">Partagez le lien de groupe ou invitez par email. Les membres peuvent voir et modifier la liste partagée.</p>

              {/* Share link */}
              <div className="mb-6">
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Lien de partage</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-muted-foreground truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                    kitduvoyageur.com/groupe/abc123
                  </div>
                  <button className="btn-primary py-2.5 px-4 text-sm">
                    <Icon name="ClipboardDocumentIcon" size={14} variant="outline" />
                  </button>
                </div>
              </div>

              {/* Email invite */}
              <form onSubmit={handleInvite}>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Inviter par email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                  <button type="submit" className="btn-primary py-2.5 px-4 text-sm">
                    {inviteSent ? <Icon name="CheckIcon" size={14} variant="outline" /> : 'Inviter'}
                  </button>
                </div>
              </form>

              {/* Current members */}
              <div className="mt-6">
                <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Membres actuels ({members.length})</h3>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700" style={{ background: m.color }}>{m.avatar}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{m.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                      </div>
                      {m.role !== 'chef' && (
                        <button className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                          <Icon name="XMarkIcon" size={14} variant="outline" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {addItemOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Ajouter un article</h3>
              <button onClick={() => setAddItemOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} variant="outline" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Nom de l&apos;article *</label>
                <input type="text" required value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Poids (g)</label>
                  <input type="number" value={newItem.weight} onChange={e => setNewItem({ ...newItem, weight: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Quantité</label>
                  <input type="number" min={1} value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Catégorie</label>
                <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                  {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Assigné à</label>
                <select value={newItem.assignedTo} onChange={e => setNewItem({ ...newItem, assignedTo: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full justify-center">Ajouter l&apos;article</button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
