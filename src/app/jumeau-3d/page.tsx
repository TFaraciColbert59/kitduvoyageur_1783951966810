'use client';

import React, { useState, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import WeightGauge from '@/components/WeightGauge';

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
}

const CATEGORY_COLORS: Record<string, string> = {
  shelter: '#E4501C',
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

const INITIAL_ITEMS: BagItem[] = [
  { id: 'i1', name: 'Tente MSR Hubba Hubba', category: 'shelter', weightG: 1540, volumeL: 4.5, color: '#E4501C', zone: 'bottom', essential: true, packed: true },
  { id: 'i2', name: 'Sac de couchage -5°C', category: 'sleeping', weightG: 1100, volumeL: 5.0, color: '#3E6B7A', zone: 'bottom', essential: true, packed: true },
  { id: 'i3', name: 'Matelas gonflable', category: 'sleeping', weightG: 450, volumeL: 2.5, color: '#1d6fa4', zone: 'middle', essential: true, packed: true },
  { id: 'i4', name: 'Veste imperméable', category: 'clothing', weightG: 380, volumeL: 1.5, color: '#33463C', zone: 'top', essential: true, packed: true },
  { id: 'i5', name: 'Réchaud + gaz', category: 'food', weightG: 320, volumeL: 1.0, color: '#B5652D', zone: 'middle', essential: true, packed: true },
  { id: 'i6', name: 'Filtre à eau', category: 'water', weightG: 85, volumeL: 0.3, color: '#1d6fa4', zone: 'top', essential: true, packed: true },
  { id: 'i7', name: 'GPS Garmin', category: 'navigation', weightG: 230, volumeL: 0.5, color: '#7c3aed', zone: 'top', essential: false, packed: true },
  { id: 'i8', name: 'Trousse premiers secours', category: 'safety', weightG: 180, volumeL: 0.8, color: '#dc2626', zone: 'top', essential: true, packed: true },
  { id: 'i9', name: 'Lampe frontale', category: 'electronics', weightG: 95, volumeL: 0.3, color: '#d97706', zone: 'top', essential: true, packed: false },
  { id: 'i10', name: 'Nourriture 3 jours', category: 'food', weightG: 1800, volumeL: 3.5, color: '#B5652D', zone: 'middle', essential: true, packed: true },
  { id: 'i11', name: 'Vêtements de rechange', category: 'clothing', weightG: 600, volumeL: 2.0, color: '#33463C', zone: 'middle', essential: true, packed: false },
  { id: 'i12', name: 'Trousse hygiène', category: 'hygiene', weightG: 250, volumeL: 0.8, color: '#059669', zone: 'front', essential: false, packed: true },
];

const BAG_CAPACITY_L = 65;

export default function Jumeau3DPage() {
  const [items, setItems] = useState<BagItem[]>(INITIAL_ITEMS);
  const [selectedItem, setSelectedItem] = useState<BagItem | null>(null);
  const [rotateY, setRotateY] = useState(0);
  const [rotateX, setRotateX] = useState(-10);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'list' | 'zones'>('3d');
  const bagRef = useRef<HTMLDivElement>(null);

  const packedItems = items.filter(i => i.packed);
  const totalWeightG = packedItems.reduce((s, i) => s + i.weightG, 0);
  const totalVolumeL = packedItems.reduce((s, i) => s + i.volumeL, 0);
  const fillPercent = Math.min((totalVolumeL / BAG_CAPACITY_L) * 100, 100);

  const zoneItems = (zone: string) => packedItems.filter(i => i.zone === zone);

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

  const togglePacked = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, packed: !i.packed } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
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
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                        transition: isDragging ? 'none' : 'transform 0.3s ease',
                        position: 'relative',
                        width: 160,
                        height: 280,
                      }}
                    >
                      {/* Bag Body */}
                      <div style={{
                        position: 'absolute',
                        width: 160,
                        height: 280,
                        background: 'linear-gradient(135deg, #243028 0%, #1C2620 100%)',
                        border: '2px solid rgba(228,80,28,0.4)',
                        borderRadius: '12px 12px 8px 8px',
                        boxShadow: '0 0 40px rgba(228,80,28,0.15)',
                        overflow: 'hidden',
                      }}>
                        {/* Fill indicator */}
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${fillPercent}%`,
                          background: 'linear-gradient(to top, rgba(228,80,28,0.3), rgba(228,80,28,0.1))',
                          transition: 'height 0.5s ease',
                        }} />

                        {/* Zone dividers */}
                        <div style={{ position: 'absolute', top: '33%', left: 8, right: 8, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ position: 'absolute', top: '66%', left: 8, right: 8, height: 1, background: 'rgba(255,255,255,0.1)' }} />

                        {/* Zone labels */}
                        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>ACCÈS RAPIDE</div>
                        <div style={{ position: 'absolute', top: '38%', left: 8, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>ZONE CENTRALE</div>
                        <div style={{ position: 'absolute', top: '70%', left: 8, fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>FOND DU SAC</div>

                        {/* Items as colored blocks */}
                        {['top', 'middle', 'bottom'].map((zone, zIdx) => {
                          const zoneItemsList = zoneItems(zone);
                          const yOffset = zIdx * 93 + 20;
                          return zoneItemsList.map((item, iIdx) => (
                            <div
                              key={item.id}
                              onClick={() => setSelectedItem(item)}
                              style={{
                                position: 'absolute',
                                left: 8 + (iIdx % 3) * 46,
                                top: yOffset + Math.floor(iIdx / 3) * 28,
                                width: 40,
                                height: 22,
                                background: item.color,
                                borderRadius: 4,
                                opacity: selectedItem?.id === item.id ? 1 : 0.75,
                                cursor: 'pointer',
                                border: selectedItem?.id === item.id ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 8,
                                color: 'white',
                                fontWeight: 'bold',
                                overflow: 'hidden',
                              }}
                              title={item.name}
                            >
                              {item.name.substring(0, 3)}
                            </div>
                          ));
                        })}
                      </div>

                      {/* Bag straps */}
                      <div style={{
                        position: 'absolute',
                        top: -20,
                        left: 20,
                        width: 30,
                        height: 25,
                        background: '#243028',
                        border: '2px solid rgba(228,80,28,0.3)',
                        borderRadius: '4px 4px 0 0',
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: -20,
                        right: 20,
                        width: 30,
                        height: 25,
                        background: '#243028',
                        border: '2px solid rgba(228,80,28,0.3)',
                        borderRadius: '4px 4px 0 0',
                      }} />

                      {/* Hip belt */}
                      <div style={{
                        position: 'absolute',
                        bottom: -12,
                        left: -20,
                        right: -20,
                        height: 16,
                        background: '#243028',
                        border: '2px solid rgba(228,80,28,0.3)',
                        borderRadius: 8,
                      }} />
                    </div>
                  </div>

                  {/* Fill meter */}
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs text-white/50 font-mono w-20">Remplissage</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${fillPercent}%`,
                          background: fillPercent > 90 ? '#E4501C' : fillPercent > 70 ? '#B5652D' : '#33463C',
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/70 font-mono w-20 text-right">{totalVolumeL.toFixed(1)}L / {BAG_CAPACITY_L}L</span>
                  </div>
                </div>

                {/* Weight Balance */}
                <div className="mt-4 bg-card rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Icon name="ScaleIcon" size={16} variant="outline" className="text-primary" />
                    Répartition du poids
                  </h3>
                  <div className="space-y-2">
                    {[
                      { zone: 'top', label: 'Haut (accès rapide)', pct: balance.top },
                      { zone: 'middle', label: 'Milieu (zone centrale)', pct: balance.middle },
                      { zone: 'bottom', label: 'Bas (fond du sac)', pct: balance.bottom },
                    ].map(({ zone, label, pct }) => (
                      <div key={zone} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-36">{label}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: zone === 'bottom' ? '#E4501C' : zone === 'middle' ? '#33463C' : '#3E6B7A',
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-10 text-right">{Math.round(pct)}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    💡 Idéal : 60% au centre, 30% en bas, 10% en haut
                  </p>
                </div>
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="lg:col-span-2 space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedItem?.id === item.id
                        ? 'border-primary bg-primary/5' :'border-border bg-card hover:border-primary/40'
                    } ${!item.packed ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[item.category] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category]} · {ZONE_LABELS[item.zone]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono font-semibold">{item.weightG}g</p>
                      <p className="text-xs text-muted-foreground">{item.volumeL}L</p>
                    </div>
                    {item.essential && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Essentiel</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePacked(item.id); }}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        item.packed ? 'bg-secondary border-secondary' : 'border-border'
                      }`}
                    >
                      {item.packed && <Icon name="CheckIcon" size={12} variant="outline" className="text-secondary-foreground" />}
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
                  const zWeight = zItems.filter(i => i.packed).reduce((s, i) => s + i.weightG, 0);
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
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              item.packed ? 'text-white' : 'opacity-40 text-foreground border border-border'
                            }`}
                            style={{ background: item.packed ? item.color : 'transparent' }}
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
                    <span className="text-xs text-muted-foreground">Articles emballés</span>
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
                    <div className="flex justify-between"><span className="text-muted-foreground">Zone</span><span>{ZONE_LABELS[selectedItem.zone]}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Poids</span><span className="font-mono">{selectedItem.weightG} g</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Volume</span><span className="font-mono">{selectedItem.volumeL} L</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Essentiel</span><span>{selectedItem.essential ? '✅ Oui' : '❌ Non'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Emballé</span><span>{selectedItem.packed ? '✅ Oui' : '⬜ Non'}</span></div>
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
        </div>
      </main>

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdd={(item) => {
            setItems(prev => [...prev, { ...item, id: `i${Date.now()}` }]);
            setShowAddModal(false);
          }}
        />
      )}

      <Footer />
    </div>
  );
}

function AddItemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Omit<BagItem, 'id'>) => void }) {
  const [form, setForm] = useState({
    name: '',
    category: 'other' as BagItem['category'],
    weightG: 100,
    volumeL: 0.5,
    zone: 'middle' as BagItem['zone'],
    essential: false,
    packed: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({ ...form, color: CATEGORY_COLORS[form.category] });
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
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Volume (L)</label>
              <input
                type="number"
                value={form.volumeL}
                onChange={e => setForm(p => ({ ...p, volumeL: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                min={0.1}
                step={0.1}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.essential}
                onChange={e => setForm(p => ({ ...p, essential: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm">Article essentiel</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.packed}
                onChange={e => setForm(p => ({ ...p, packed: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm">Déjà emballé</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              Annuler
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
