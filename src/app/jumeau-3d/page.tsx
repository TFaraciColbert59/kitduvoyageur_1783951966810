'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import WeightGauge from '@/components/WeightGauge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface BagItem {
  id: string;
  name: string;
  category: 'shelter' | 'sleeping' | 'clothing' | 'food' | 'water' | 'navigation' | 'safety' | 'hygiene' | 'electronics' | 'other';
  weightG: number;
  volumeL: number;
  color: string;
  zone: 'bottom' | 'middle' | 'top' | 'hip' | 'front';
  essential: boolean;
  packed: boolean;
  compartment?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  shelter: '#17402C',
  sleeping: '#3E6B7A',
  clothing: '#33463C',
  food: '#B5652D',
  water: '#1d6fa4',
  navigation: '#7c3aed',
  safety: '#dc2626',
  hygiene: '#059669',
  electronics: '#d97706',
  other: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  shelter: 'Abri',
  sleeping: 'Couchage',
  clothing: 'Vêtements',
  food: 'Alimentation',
  water: 'Eau',
  navigation: 'Navigation',
  safety: 'Sécurité',
  hygiene: 'Hygiène',
  electronics: 'Électronique',
  other: 'Autre',
};

const ZONE_LABELS: Record<string, string> = {
  bottom: 'Fond du sac',
  middle: 'Zone centrale',
  top: 'Accès rapide',
  hip: 'Ceinture',
  front: 'Poche avant',
};

const BAG_CAPACITY_L = 65;

// Map gear_items DB row to BagItem
function dbRowToBagItem(row: Record<string, unknown>): BagItem {
  const zone = (row.compartment as string) || 'middle';
  const validZones = ['bottom', 'middle', 'top', 'hip', 'front'];
  const safeZone = validZones.includes(zone) ? (zone as BagItem['zone']) : 'middle';
  const cat = (row.category as string) || 'other';
  const validCats = ['shelter', 'sleeping', 'clothing', 'food', 'water', 'navigation', 'safety', 'hygiene', 'electronics', 'other'];
  const safeCat = validCats.includes(cat) ? (cat as BagItem['category']) : 'other';
  return {
    id: row.id as string,
    name: row.name as string,
    category: safeCat,
    weightG: (row.weight_grams as number) || 0,
    volumeL: 1,
    color: CATEGORY_COLORS[safeCat] || '#6b7280',
    zone: safeZone,
    essential: false,
    packed: true,
    compartment: row.compartment as string | undefined,
  };
}

export default function Jumeau3DPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<BagItem | null>(null);
  const [rotateY, setRotateY] = useState(0);
  const [rotateX, setRotateX] = useState(-10);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'list' | 'zones'>('3d');
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const bagRef = useRef<HTMLDivElement>(null);

  const loadItems = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('gear_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setItems((data ?? []).map(dbRowToBagItem));
    } catch (_e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const packedItems = items.filter(i => i.packed);
  const totalWeightG = packedItems.reduce((s, i) => s + i.weightG, 0);
  const totalVolumeL = packedItems.reduce((s, i) => s + i.volumeL, 0);
  const fillPercent = Math.min((totalVolumeL / BAG_CAPACITY_L) * 100, 100);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setRotateY(prev => prev + dx * 0.5);
    setRotateX(prev => Math.max(-30, Math.min(30, prev + dy * 0.3)));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // ── Touch handlers (mobile) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setIsDragging(true);
    setLastMouse({ x: t.clientX, y: t.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - lastMouse.x;
    const dy = t.clientY - lastMouse.y;
    setRotateY(prev => prev + dx * 0.5);
    setRotateX(prev => Math.max(-30, Math.min(30, prev + dy * 0.3)));
    setLastMouse({ x: t.clientX, y: t.clientY });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const togglePacked = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !user) return;
    const newPacked = !item.packed;
    setItems(prev => prev.map(i => i.id === id ? { ...i, packed: newPacked } : i));
    // No packed field in gear_items — just local toggle
  };

  const removeItem = async (id: string) => {
    if (!user) return;
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
    try {
      const supabase = createClient();
      await supabase.from('gear_items').delete().eq('id', id).eq('user_id', user.id);
    } catch (_e) { /* ignore */ }
  };

  const changeZone = async (id: string, zone: BagItem['zone']) => {
    if (!user) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, zone, compartment: zone } : i));
    try {
      const supabase = createClient();
      await supabase.from('gear_items').update({ compartment: zone }).eq('id', id).eq('user_id', user.id);
    } catch (_e) { /* ignore */ }
  };

  const weightBalance = () => {
    const bottom = items.filter(i => i.packed && i.zone === 'bottom').reduce((s, i) => s + i.weightG, 0);
    const middle = items.filter(i => i.packed && i.zone === 'middle').reduce((s, i) => s + i.weightG, 0);
    const top = items.filter(i => i.packed && i.zone === 'top').reduce((s, i) => s + i.weightG, 0);
    const total = bottom + middle + top || 1;
    return { bottom: (bottom / total) * 100, middle: (middle / total) * 100, top: (top / total) * 100 };
  };

  const balance = weightBalance();

  const optimizationTips = () => {
    const tips: string[] = [];
    const heavyTop = items.filter(i => i.packed && i.zone === 'top' && i.weightG > 500);
    if (heavyTop.length > 0) tips.push(`Déplacer ${heavyTop[0].name} vers la zone centrale pour un meilleur équilibre`);
    if (fillPercent > 90) tips.push('Sac presque plein — envisager de retirer des articles non essentiels');
    if (totalWeightG > 15000) tips.push('Poids total élevé — objectif recommandé : < 12 kg pour la randonnée');
    const unpacked = items.filter(i => !i.packed && i.essential);
    if (unpacked.length > 0) tips.push(`${unpacked.length} article(s) essentiel(s) non emballé(s) : ${unpacked[0].name}`);
    return tips;
  };

  const tips = optimizationTips();

  return (
    <>
      <div className="hidden md:block">
        <div className="min-h-screen bg-background">
          <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon name="CubeTransparentIcon" size={22} variant="outline" className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-mono text-primary/80 tracking-widest uppercase">Phase 3 · Jumeau Numérique</p>
                <h1 className="text-2xl font-display font-800 tracking-tight">Visualiseur 3D du Sac</h1>
              </div>
            </div>
            <p className="text-white/60 text-sm max-w-xl">Organisez et visualisez le contenu de votre sac en 3D. Optimisez le poids et l&apos;équilibre avant votre départ.</p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Not connected state */}
          {!user && !loading && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🎒</div>
              <p className="font-display font-700 text-foreground text-xl mb-2">Connectez-vous pour accéder à votre jumeau 3D</p>
              <p className="text-muted-foreground text-sm mb-6">Votre inventaire est synchronisé avec le visualiseur 3D.</p>
              <a href="/connexion" className="btn-primary inline-flex items-center gap-2 px-6 py-3">Se connecter</a>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-muted animate-pulse rounded-2xl" />
              <div className="space-y-4">
                <div className="h-40 bg-muted animate-pulse rounded-xl" />
                <div className="h-40 bg-muted animate-pulse rounded-xl" />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && user && items.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📦</div>
              <p className="font-display font-700 text-foreground text-xl mb-2">Votre sac est vide</p>
              <p className="text-muted-foreground text-sm mb-6">Ajoutez des articles depuis votre inventaire pour les visualiser ici.</p>
              <div className="flex gap-3 justify-center">
                <a href="/inventaire" className="btn-secondary inline-flex items-center gap-2 px-6 py-3">Voir l&apos;inventaire</a>
                <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex items-center gap-2 px-6 py-3">
                  <Icon name="PlusIcon" size={16} variant="outline" />
                  Ajouter un article
                </button>
              </div>
            </div>
          )}

          {/* Main content */}
          {!loading && user && items.length > 0 && (
            <>
              {/* View Mode Tabs */}
              <div className="flex gap-2 mb-6">
                {(['3d', 'list', 'zones'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === mode
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode === '3d' ? '🎲 Vue 3D' : mode === 'list' ? '📋 Liste' : '🗂️ Zones'}
                  </button>
                ))}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={16} variant="outline" />
                  Ajouter un article
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3D Bag Visualizer */}
                {viewMode === '3d' && (
                  <div className="lg:col-span-2">
                    <div className="bg-dark-bg rounded-2xl p-6 border border-white/10 relative overflow-hidden" style={{ minHeight: 480 }}>
                      <div className="absolute top-4 left-4 text-xs text-white/40 font-mono">
                        Rotation: {Math.round(rotateY)}° · Cliquer-glisser pour tourner
                      </div>

                      {/* 3D Scene */}
                      <div
                        className="flex items-center justify-center"
                        style={{ height: 400, perspective: '800px', cursor: isDragging ? 'grabbing' : 'grab' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        <div
                          ref={bagRef}
                          style={{
                            width: 200,
                            height: 320,
                            transformStyle: 'preserve-3d',
                            transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease',
                            position: 'relative',
                          }}
                        >
                          {/* Bag body */}
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(160deg, #2A3A2E 0%, #1C2620 100%)',
                            borderRadius: '12px 12px 8px 8px',
                            border: '2px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                          }} />

                          {/* Zone sections */}
                          {(['top', 'middle', 'bottom'] as const).map((zone, zi) => {
                            const zItems = packedItems.filter(i => i.zone === zone);
                            const zoneColors = zItems.map(i => i.color);
                            return (
                              <div key={zone} style={{
                                position: 'absolute',
                                left: '8px', right: '8px',
                                top: zi === 0 ? '8px' : zi === 1 ? '110px' : '220px',
                                height: '90px',
                                borderRadius: '6px',
                                background: zoneColors.length > 0
                                  ? `linear-gradient(135deg, ${zoneColors.slice(0, 3).join(', ')})`
                                  : 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden',
                              }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'monospace' }}>
                                  {ZONE_LABELS[zone]} · {zItems.length}
                                </span>
                              </div>
                            );
                          })}

                          {/* Fill indicator */}
                          <div style={{
                            position: 'absolute', bottom: '-30px', left: '50%', transform: 'translateX(-50%)',
                            color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap',
                          }}>
                            {fillPercent.toFixed(0)}% rempli · {(totalWeightG / 1000).toFixed(1)} kg
                          </div>
                        </div>
                      </div>

                      {/* Balance bars */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                          <div style={{ width: `${balance.top}%`, background: '#17402C', transition: 'width 0.3s' }} />
                          <div style={{ width: `${balance.middle}%`, background: '#3E6B7A', transition: 'width 0.3s' }} />
                          <div style={{ width: `${balance.bottom}%`, background: '#33463C', transition: 'width 0.3s' }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-white/30 font-mono">
                          <span>Haut {balance.top.toFixed(0)}%</span>
                          <span>Milieu {balance.middle.toFixed(0)}%</span>
                          <span>Bas {balance.bottom.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* List View */}
                {viewMode === 'list' && (
                  <div className="lg:col-span-2 space-y-2">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedItem?.id === item.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'
                        }`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category]} · {ZONE_LABELS[item.zone]}</p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{item.weightG}g</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          className="p-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Icon name="TrashIcon" size={14} variant="outline" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zones View */}
                {viewMode === 'zones' && (
                  <div className="lg:col-span-2 space-y-4">
                    {(['top', 'middle', 'bottom', 'hip', 'front'] as const).map(zone => {
                      const zItems = items.filter(i => i.zone === zone);
                      const zWeight = zItems.reduce((s, i) => s + i.weightG, 0);
                      return (
                        <div key={zone} className="bg-card rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-sm">{ZONE_LABELS[zone]}</h3>
                            <span className="text-xs font-mono text-muted-foreground">{(zWeight / 1000).toFixed(2)} kg</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {zItems.map(item => (
                              <div
                                key={item.id}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer"
                                style={{ background: item.color }}
                                onClick={() => setSelectedItem(item)}
                              >
                                {item.name}
                                <span className="opacity-70">· {item.weightG}g</span>
                              </div>
                            ))}
                            {zItems.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">Aucun article dans cette zone</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Right Panel */}
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="bg-card rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3">Résumé du sac</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Poids total</span>
                        <span className="text-sm font-mono font-bold text-foreground">{(totalWeightG / 1000).toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Volume utilisé</span>
                        <span className="text-sm font-mono font-bold">{totalVolumeL.toFixed(1)} / {BAG_CAPACITY_L} L</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Articles</span>
                        <span className="text-sm font-mono font-bold">{packedItems.length} / {items.length}</span>
                      </div>
                      <div className="pt-2">
                        <WeightGauge weightG={totalWeightG} maxG={20000} />
                      </div>
                    </div>
                  </div>

                  {/* Selected Item Detail */}
                  {selectedItem && (
                    <div className="bg-card rounded-xl border border-primary/30 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full" style={{ background: selectedItem.color }} />
                          <h3 className="text-sm font-semibold">{selectedItem.name}</h3>
                        </div>
                        <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground">
                          <Icon name="XMarkIcon" size={16} variant="outline" />
                        </button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Catégorie</span><span>{CATEGORY_LABELS[selectedItem.category]}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Poids</span><span className="font-mono">{selectedItem.weightG} g</span></div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Zone</span>
                          <select
                            value={selectedItem.zone}
                            onChange={(e) => changeZone(selectedItem.id, e.target.value as BagItem['zone'])}
                            className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                          >
                            {Object.entries(ZONE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => togglePacked(selectedItem.id)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity"
                        >
                          {selectedItem.packed ? 'Retirer' : 'Emballer'}
                        </button>
                        <button
                          onClick={() => removeItem(selectedItem.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          <Icon name="TrashIcon" size={14} variant="outline" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optimization Tips */}
                  {tips.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                        <Icon name="LightBulbIcon" size={16} variant="outline" className="text-amber-600" />
                        Conseils d&apos;optimisation
                      </h3>
                      <ul className="space-y-1.5">
                        {tips.map((tip, i) => (
                          <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                            <span className="mt-0.5 flex-shrink-0">→</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Category Legend */}
                  <div className="bg-card rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3">Légende des catégories</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[key] }} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Add Item Modal */}
      {showAddModal && user && (
        <AddItemModal
          userId={user.id}
          onClose={() => setShowAddModal(false)}
          onAdd={(item) => {
            setItems(prev => [...prev, item]);
            setShowAddModal(false);
          }}
        />
      )}

        <Footer />
      </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {/* Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(11,31,23,0.06)' }}>
            <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
              Phase 3 &middot; Jumeau Num&eacute;rique
            </p>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0B1F17', margin: 0 }}>
              Visualiseur 3D du Sac
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7A72', margin: '6px 0 0 0', lineHeight: 1.4 }}>
              Organisez et visualisez le contenu de votre sac en 3D.
            </p>
          </div>

          {/* Not connected state */}
          {!user && !loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '36px', marginBottom: '12px' }}>&#127782;</p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: '#0B1F17', marginBottom: '8px' }}>Connectez-vous</p>
              <p style={{ fontSize: '13px', color: '#6B7A72', marginBottom: '20px' }}>Votre inventaire est synchronis&eacute; avec le visualiseur 3D.</p>
              <a href="/connexion" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#17402C', color: '#fff', borderRadius: '12px', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
                Se connecter
              </a>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ padding: '16px' }}>
              <div style={{ height: '180px', background: '#F4F1EA', borderRadius: '12px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
              <div style={{ height: '80px', background: '#F4F1EA', borderRadius: '12px', marginBottom: '12px', animation: 'pulse 2s infinite' }} />
            </div>
          )}

          {/* Empty state */}
          {!loading && user && items.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '36px', marginBottom: '12px' }}>&#128230;</p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: '#0B1F17', marginBottom: '8px' }}>Votre sac est vide</p>
              <p style={{ fontSize: '13px', color: '#6B7A72', marginBottom: '20px' }}>Ajoutez des articles depuis votre inventaire.</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <a href="/inventaire" style={{ padding: '12px 20px', background: '#F4F1EA', color: '#0B1F17', borderRadius: '12px', fontSize: '14px', fontWeight: 500, textDecoration: 'none', border: '1px solid rgba(11,31,23,0.06)' }}>
                  Voir l&apos;inventaire
                </a>
                <button onClick={() => setShowAddModal(true)} style={{ padding: '12px 20px', background: '#17402C', color: '#fff', borderRadius: '12px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  Ajouter un article
                </button>
              </div>
            </div>
          )}

          {/* Main content with items */}
          {!loading && user && items.length > 0 && (
            <>
              {/* Weight Summary Card */}
              <div style={{ margin: '16px', padding: '16px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                  R&Eacute;SUM&Eacute; DU SAC
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#6B7A72', margin: '0 0 2px 0' }}>Poids total</p>
                    <p style={{ fontSize: '24px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0B1F17', margin: 0 }}>
                      {(totalWeightG / 1000).toFixed(2)} <span style={{ fontSize: '13px', fontWeight: 400, color: '#6B7A72' }}>kg</span>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '11px', color: '#6B7A72', margin: '0 0 2px 0' }}>Volume</p>
                    <p style={{ fontSize: '18px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#0B1F17', margin: 0 }}>
                      {totalVolumeL.toFixed(0)} <span style={{ fontSize: '12px', fontWeight: 400, color: '#6B7A72' }}>L</span>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '11px', color: '#6B7A72', margin: '0 0 2px 0' }}>Articles</p>
                    <p style={{ fontSize: '18px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#0B1F17', margin: 0 }}>
                      {packedItems.length}
                    </p>
                  </div>
                </div>

                {/* Fill indicator */}
                <div style={{ background: 'rgba(11,31,23,0.06)', borderRadius: '999px', height: '6px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ width: `${fillPercent}%`, background: '#17402C', height: '100%', borderRadius: '999px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72' }}>{fillPercent.toFixed(0)}% rempli</span>
                  <span style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72' }}>{BAG_CAPACITY_L} L max</span>
                </div>
              </div>

              {/* 3D Visualization — interactive (touch + mouse drag) */}
              <div style={{ margin: '0 16px 16px', padding: '16px', background: '#0B1F17', borderRadius: '16px', position: 'relative', minHeight: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                    Visualisation 3D
                  </p>
                  <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.3)', margin: 0, whiteSpace: 'nowrap' }}>
                    Rotation: {Math.round(rotateY)}&deg; &middot; glisser pour tourner
                  </p>
                </div>

                {/* Drag area — 3D bag, non-zero height */}
                <div
                  style={{
                    height: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    perspective: '800px',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  <div
                    ref={bagRef}
                    style={{
                      width: 130,
                      height: 210,
                      transformStyle: 'preserve-3d',
                      transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
                      transition: isDragging ? 'none' : 'transform 0.1s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Bag body */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(160deg, #2A3A2E 0%, #1C2620 100%)',
                      borderRadius: '10px 10px 8px 8px',
                      border: '2px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    }} />

                    {/* Zone sections — tappable */}
                    {(['top', 'middle', 'bottom'] as const).map((zone, zi) => {
                      const zItems = packedItems.filter(i => i.zone === zone);
                      const zoneColors = zItems.map(i => i.color);
                      const isActive = activeZone === zone;
                      return (
                        <button
                          key={zone}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveZone(prev => prev === zone ? null : zone);
                          }}
                          style={{
                            position: 'absolute',
                            left: '8px', right: '8px',
                            top: zi === 0 ? '8px' : zi === 1 ? '76px' : '144px',
                            height: '60px',
                            borderRadius: '6px',
                            background: zoneColors.length > 0
                              ? `linear-gradient(135deg, ${zoneColors.slice(0, 3).join(', ')})`
                              : 'rgba(255,255,255,0.05)',
                            border: isActive ? '2px solid #A3C4A3' : '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          aria-label={`Zone ${ZONE_LABELS[zone]}`}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontFamily: 'monospace' }}>
                            {ZONE_LABELS[zone]} &middot; {zItems.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active zone items */}
                {activeZone && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                      {ZONE_LABELS[activeZone]}
                    </p>
                    {packedItems.filter(i => i.zone === activeZone).map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>{item.name}</span>
                        <span style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.5)' }}>
                          {item.weightG >= 1000 ? `${(item.weightG / 1000).toFixed(2)} kg` : `${item.weightG} g`}
                        </span>
                      </div>
                    ))}
                    {packedItems.filter(i => i.zone === activeZone).length === 0 && (
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Georgia, serif', fontStyle: 'italic', margin: 0 }}>
                        Aucun article dans cette zone
                      </p>
                    )}
                  </div>
                )}

                {/* Weight balance */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '3px', height: '4px', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${balance.top}%`, background: '#17402C' }} />
                    <div style={{ width: `${balance.middle}%`, background: '#3E6B7A' }} />
                    <div style={{ width: `${balance.bottom}%`, background: '#33463C' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace, monospace' }}>Haut {balance.top.toFixed(0)}%</span>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace, monospace' }}>Mil. {balance.middle.toFixed(0)}%</span>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace, monospace' }}>Bas {balance.bottom.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div style={{ margin: '0 16px 16px', padding: '16px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                  R&Eacute;PARTITION PAR CAT&Eacute;GORIE
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                    const catWeight = packedItems.filter(i => i.category === key).reduce((s, i) => s + i.weightG, 0);
                    const pct = totalWeightG > 0 ? (catWeight / totalWeightG) * 100 : 0;
                    if (catWeight === 0) return null;
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: CATEGORY_COLORS[key], flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#0B1F17' }}>{label}</span>
                          </div>
                          <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72' }}>
                            {catWeight >= 1000 ? `${(catWeight / 1000).toFixed(2)} kg` : `${catWeight} g`} &middot; {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div style={{ background: 'rgba(11,31,23,0.06)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: CATEGORY_COLORS[key], height: '100%', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Items List */}
              <div style={{ margin: '0 16px 16px', padding: '16px', background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                  ARTICLES LES PLUS LOURDS
                </p>
                {packedItems
                  .sort((a, b) => b.weightG - a.weightG)
                  .slice(0, 6)
                  .map((item, i) => (
                    <div key={item.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 0',
                      borderBottom: i < Math.min(packedItems.length, 6) - 1 ? '1px solid rgba(11,31,23,0.06)' : 'none',
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: '#0B1F17', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '11px', color: '#6B7A72', margin: '1px 0 0 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                          {CATEGORY_LABELS[item.category]} &middot; {ZONE_LABELS[item.zone]}
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', color: '#0B1F17', fontWeight: 600, flexShrink: 0 }}>
                        {item.weightG >= 1000 ? `${(item.weightG / 1000).toFixed(2)} kg` : `${item.weightG} g`}
                      </span>
                    </div>
                  ))}
                {packedItems.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#6B7A72', fontFamily: 'Georgia, serif', fontStyle: 'italic', margin: 0 }}>
                    Aucun article emball&eacute;
                  </p>
                )}
              </div>

              {/* Optimization Tips */}
              {tips.length > 0 && (
                <div style={{ margin: '0 16px 16px', padding: '16px', background: '#F4F1EA', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                  <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                    Conseils d&apos;optimisation
                  </p>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
                    {tips.map((tip, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#0B1F17', marginBottom: '6px', lineHeight: 1.4, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <span style={{ color: '#17402C', flexShrink: 0 }}>&rarr;</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Add item button */}
              <div style={{ padding: '0 16px 16px' }}>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#17402C',
                    color: '#fff',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  + Ajouter un article
                </button>
              </div>

              {/* Footer spacer */}
              <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
            </>
          )}

        </MobilePageShell>
      </div>
    </>
  );
}

function AddItemModal({ userId, onClose, onAdd }: { userId: string; onClose: () => void; onAdd: (item: BagItem) => void }) {
  const [form, setForm] = useState({
    name: '',
    category: 'other' as BagItem['category'],
    weightG: 100,
    zone: 'middle' as BagItem['zone'],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('gear_items')
        .insert({
          user_id: userId,
          name: form.name.trim(),
          category: form.category,
          weight_grams: form.weightG,
          compartment: form.zone,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) onAdd(dbRowToBagItem(data as Record<string, unknown>));
    } catch (_e) {
      // fallback: add locally
      onAdd({
        id: `local-${Date.now()}`,
        name: form.name.trim(),
        category: form.category,
        weightG: form.weightG,
        volumeL: 1,
        color: CATEGORY_COLORS[form.category] || '#6b7280',
        zone: form.zone,
        essential: false,
        packed: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-700">Ajouter un article</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={20} variant="outline" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Nom de l&apos;article</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: Tente 2 places"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Catégorie</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value as BagItem['category'] }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Zone</label>
              <select
                value={form.zone}
                onChange={e => setForm(p => ({ ...p, zone: e.target.value as BagItem['zone'] }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.entries(ZONE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Poids (g)</label>
            <input
              type="number"
              value={form.weightG}
              onChange={e => setForm(p => ({ ...p, weightG: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              min={1}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
