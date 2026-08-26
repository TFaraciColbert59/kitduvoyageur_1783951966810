'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import WeightGauge from '@/components/WeightGauge';


// ─── TOOL: Poids du sac ───────────────────────────────────────────────────────
interface WeightCategory {
  id: string;
  nom: string;
  icon: string;
  items: { nom: string; poids_g: number }[];
}

function ToolPoidssSac() {
  const [categories, setCategories] = useState<WeightCategory[]>([
    { id: 'vetements', nom: 'Vêtements', icon: '👕', items: [{ nom: 'Veste', poids_g: 420 }] },
    { id: 'bivouac', nom: 'Bivouac', icon: '⛺', items: [{ nom: 'Tente', poids_g: 1800 }] },
    { id: 'cuisine', nom: 'Cuisine', icon: '🍳', items: [] },
    { id: 'securite', nom: 'Sécurité', icon: '🩹', items: [] },
    { id: 'electronique', nom: 'Électronique', icon: '📱', items: [] },
    { id: 'divers', nom: 'Divers', icon: '🎒', items: [] },
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [selectedCat, setSelectedCat] = useState('vetements');

  const totalG = categories.flatMap((c) => c.items).reduce((s, i) => s + i.poids_g, 0);

  const addItem = () => {
    const w = parseInt(newItemWeight);
    if (!newItemName.trim() || isNaN(w) || w <= 0) return;
    setCategories((prev) =>
      prev.map((c) =>
        c.id === selectedCat
          ? { ...c, items: [...c.items, { nom: newItemName.trim(), poids_g: w }] }
          : c
      )
    );
    setNewItemName('');
    setNewItemWeight('');
  };

  const removeItem = (catId: string, idx: number) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, items: c.items.filter((_, i) => i !== idx) } : c))
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>POIDS TOTAL DU SAC</p>
        <WeightGauge weightG={totalG} maxG={20000} size="lg" />
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="bg-background rounded-lg p-2 border border-border">
            <p className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>TOTAL</p>
            <p className="font-mono font-700 text-info" style={{ fontFamily: 'var(--font-mono)' }}>{totalG >= 1000 ? `${(totalG / 1000).toFixed(2)} kg` : `${totalG} g`}</p>
          </div>
          <div className="bg-background rounded-lg p-2 border border-border">
            <p className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>ARTICLES</p>
            <p className="font-mono font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{categories.flatMap((c) => c.items).length}</p>
          </div>
          <div className="bg-background rounded-lg p-2 border border-border">
            <p className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>CATÉGORIES</p>
            <p className="font-mono font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{categories.filter((c) => c.items.length > 0).length}</p>
          </div>
        </div>
      </div>

      {/* Add item */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-display font-700 text-base mb-4" style={{ fontFamily: 'var(--font-display)' }}>Ajouter un article</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
            aria-label="Catégorie"
          >
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.nom}</option>)}
          </select>
          <input
            type="text"
            placeholder="Nom de l'article"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="sm:col-span-2 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
            aria-label="Nom de l'article"
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Poids (g)"
              value={newItemWeight}
              onChange={(e) => setNewItemWeight(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary font-mono"
              aria-label="Poids en grammes"
              style={{ fontFamily: 'var(--font-mono)' }}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
            />
            <button onClick={addItem} className="btn-primary px-4 py-2.5 text-sm" aria-label="Ajouter">+</button>
          </div>
        </div>
      </div>

      {/* Categories breakdown */}
      <div className="space-y-3">
        {categories.filter((c) => c.items.length > 0).map((cat) => {
          const catTotal = cat.items.reduce((s, i) => s + i.poids_g, 0);
          return (
            <div key={cat.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{cat.icon} {cat.nom}</span>
                <span className="font-mono text-xs text-info" style={{ fontFamily: 'var(--font-mono)' }}>{catTotal} g</span>
              </div>
              <WeightGauge weightG={catTotal} maxG={totalG || 1} showLabel={false} size="sm" />
              <div className="mt-3 space-y-1.5">
                {cat.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground">{item.nom}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-info" style={{ fontFamily: 'var(--font-mono)' }}>{item.poids_g} g</span>
                      <button onClick={() => removeItem(cat.id, idx)} className="text-muted-foreground hover:text-red-400 transition-colors" aria-label={`Supprimer ${item.nom}`}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {categories.every((c) => c.items.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">⚖️</p>
            <p>Ajoutez vos premiers articles ci-dessus</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOOL: Budget voyage ──────────────────────────────────────────────────────
function ToolBudget() {
  const [jours, setJours] = useState(7);
  const [personnes, setPersonnes] = useState(1);
  const [postes, setPostes] = useState([
    { nom: 'Hébergement', montant: 50, icon: '🏨' },
    { nom: 'Transport', montant: 20, icon: '🚌' },
    { nom: 'Nourriture', montant: 30, icon: '🍽️' },
    { nom: 'Activités', montant: 25, icon: '🎯' },
    { nom: 'Équipement', montant: 10, icon: '🎒' },
    { nom: 'Divers', montant: 15, icon: '💡' },
  ]);

  const totalParJour = postes.reduce((s, p) => s + p.montant, 0);
  const totalVoyage = totalParJour * jours * personnes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>DURÉE (jours)</label>
          <input type="number" min={1} max={365} value={jours} onChange={(e) => setJours(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-lg font-700 focus:outline-none focus:border-primary" style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>PERSONNES</label>
          <input type="number" min={1} max={20} value={personnes} onChange={(e) => setPersonnes(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-lg font-700 focus:outline-none focus:border-primary" style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-display font-700 text-base mb-4" style={{ fontFamily: 'var(--font-display)' }}>Budget par jour / personne (€)</h3>
        <div className="space-y-3">
          {postes.map((poste, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xl w-8 text-center">{poste.icon}</span>
              <span className="flex-1 text-sm text-foreground">{poste.nom}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} value={poste.montant}
                  onChange={(e) => setPostes((prev) => prev.map((p, i) => i === idx ? { ...p, montant: Math.max(0, parseFloat(e.target.value) || 0) } : p))}
                  className="w-24 px-2 py-1.5 rounded-lg bg-background border border-border font-mono text-sm text-right focus:outline-none focus:border-primary"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  aria-label={`Budget ${poste.nom}`}
                />
                <span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>€/j</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'PAR JOUR / PERS.', value: `${totalParJour.toFixed(0)} €`, color: 'text-info' },
          { label: `PAR JOUR (×${personnes})`, value: `${(totalParJour * personnes).toFixed(0)} €`, color: 'text-accent' },
          { label: `TOTAL ${jours}J`, value: `${totalVoyage.toFixed(0)} €`, color: 'text-primary' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{stat.label}</p>
            <p className={`font-mono font-700 text-2xl ${stat.color}`} style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TOOL: Convertisseur ─────────────────────────────────────────────────────
function ToolConvertisseur() {
  const [tab, setTab] = useState<'distance' | 'poids' | 'temperature' | 'devises'>('distance');
  const [value, setValue] = useState('1');

  const conversions: Record<string, { label: string; units: { from: string; to: string; factor: number; offset?: number }[] }> = {
    distance: {
      label: 'Distance',
      units: [
        { from: 'km', to: 'miles', factor: 0.621371 },
        { from: 'miles', to: 'km', factor: 1.60934 },
        { from: 'm', to: 'ft', factor: 3.28084 },
        { from: 'ft', to: 'm', factor: 0.3048 },
      ],
    },
    poids: {
      label: 'Poids',
      units: [
        { from: 'kg', to: 'lbs', factor: 2.20462 },
        { from: 'lbs', to: 'kg', factor: 0.453592 },
        { from: 'g', to: 'oz', factor: 0.035274 },
        { from: 'oz', to: 'g', factor: 28.3495 },
      ],
    },
    temperature: {
      label: 'Température',
      units: [
        { from: '°C', to: '°F', factor: 9 / 5, offset: 32 },
        { from: '°F', to: '°C', factor: 5 / 9, offset: -160 / 9 },
      ],
    },
    devises: {
      label: 'Devises (indicatif)',
      units: [
        { from: 'EUR', to: 'USD', factor: 1.08 },
        { from: 'EUR', to: 'GBP', factor: 0.86 },
        { from: 'EUR', to: 'JPY', factor: 162 },
        { from: 'EUR', to: 'MAD', factor: 10.8 },
        { from: 'USD', to: 'EUR', factor: 0.93 },
      ],
    },
  };

  const num = parseFloat(value) || 0;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-card rounded-lg p-1 border border-border flex-wrap">
        {(Object.keys(conversions) as (keyof typeof conversions)[]).map((t) => (
          <button key={t} onClick={() => setTab(t as 'distance' | 'poids' | 'temperature' | 'devises')}
            className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-xs font-medium transition-all capitalize ${tab === t ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            {conversions[t].label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>VALEUR À CONVERTIR</label>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-background border border-border font-mono text-xl font-700 focus:outline-none focus:border-primary"
          style={{ fontFamily: 'var(--font-mono)' }} aria-label="Valeur à convertir" />
      </div>

      <div className="space-y-3">
        {conversions[tab].units.map((conv, idx) => {
          const result = conv.offset !== undefined
            ? num * conv.factor + conv.offset
            : num * conv.factor;
          return (
            <div key={idx} className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{num} {conv.from}</span>
                <span className="text-muted-foreground">→</span>
              </div>
              <span className="font-mono font-700 text-lg text-info" style={{ fontFamily: 'var(--font-mono)' }}>
                {result.toFixed(3)} {conv.to}
              </span>
            </div>
          );
        })}
      </div>
      {tab === 'devises' && (
        <p className="text-xs text-muted-foreground text-center">⚠️ Taux indicatifs — vérifiez avant votre départ</p>
      )}
    </div>
  );
}

// ─── TOOL: Checklist ─────────────────────────────────────────────────────────
interface CheckItem {
  id: string;
  text: string;
  checked: boolean;
  categorie: string;
}

function ToolChecklist() {
  const [items, setItems] = useState<CheckItem[]>([
    { id: '1', text: 'Passeport / Carte d\'identité', checked: false, categorie: 'Documents' },
    { id: '2', text: 'Visa (si requis)', checked: false, categorie: 'Documents' },
    { id: '3', text: 'Assurance voyage', checked: false, categorie: 'Documents' },
    { id: '4', text: 'Veste imperméable', checked: false, categorie: 'Vêtements' },
    { id: '5', text: 'Chaussures de marche', checked: false, categorie: 'Vêtements' },
    { id: '6', text: 'Trousse de premiers secours', checked: false, categorie: 'Santé' },
    { id: '7', text: 'Médicaments personnels', checked: false, categorie: 'Santé' },
    { id: '8', text: 'Chargeur universel', checked: false, categorie: 'Électronique' },
    { id: '9', text: 'Powerbank', checked: false, categorie: 'Électronique' },
  ]);
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('Divers');
  const [saved, setSaved] = useState(false);

  const cats = [...new Set(items.map((i) => i.categorie))];
  const checked = items.filter((i) => i.checked).length;

  const addItem = () => {
    if (!newText.trim()) return;
    setItems((prev) => [...prev, { id: Date.now().toString(), text: newText.trim(), checked: false, categorie: newCat }]);
    setNewText('');
  };

  const toggleItem = (id: string) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>PROGRESSION</p>
          <p className="font-mono font-700 text-xl text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{checked}/{items.length}</p>
        </div>
        <div className="flex-1 mx-6">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${items.length ? (checked / items.length) * 100 : 0}%` }} />
          </div>
        </div>
        <button onClick={handleSave} className={`btn-primary py-2 px-4 text-sm transition-all ${saved ? 'bg-emerald-600 border-emerald-600' : ''}`}>
          {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      {/* Add item */}
      <div className="flex gap-2">
        <input type="text" placeholder="Nouvel article..." value={newText} onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          className="flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
          aria-label="Nouvel article de checklist" />
        <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
          aria-label="Catégorie">
          {[...cats, 'Divers'].map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={addItem} className="btn-primary px-4 py-2.5 text-sm">+</button>
      </div>

      {/* Items by category */}
      {cats.map((cat) => (
        <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>{cat}</span>
          </div>
          <div className="divide-y divide-border">
            {items.filter((i) => i.categorie === cat).map((item) => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${item.checked ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                  aria-label={`${item.checked ? 'Décocher' : 'Cocher'} ${item.text}`}
                >
                  {item.checked && <span className="text-white text-[10px]">✓</span>}
                </button>
                <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.text}</span>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-400 transition-colors text-xs" aria-label={`Supprimer ${item.text}`}>×</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TOOL: Tailles ───────────────────────────────────────────────────────────
function ToolTailles() {
  const [type, setType] = useState<'vetements' | 'chaussures'>('vetements');
  const [tailleFR, setTailleFR] = useState('M');

  const vetements: Record<string, Record<string, string>> = {
    XS: { FR: 'XS', EU: '34', UK: '6', US: 'XS', IT: '38', JP: 'SS' },
    S: { FR: 'S', EU: '36', UK: '8', US: 'S', IT: '40', JP: 'S' },
    M: { FR: 'M', EU: '38', UK: '10', US: 'M', IT: '42', JP: 'M' },
    L: { FR: 'L', EU: '40', UK: '12', US: 'L', IT: '44', JP: 'L' },
    XL: { FR: 'XL', EU: '42', UK: '14', US: 'XL', IT: '46', JP: 'LL' },
    XXL: { FR: 'XXL', EU: '44', UK: '16', US: 'XXL', IT: '48', JP: '3L' },
  };

  const chaussures: Record<string, Record<string, string>> = {
    '38': { FR: '38', EU: '38', UK: '5', US: '7', JP: '24' },
    '39': { FR: '39', EU: '39', UK: '6', US: '8', JP: '25' },
    '40': { FR: '40', EU: '40', UK: '6.5', US: '8.5', JP: '25.5' },
    '41': { FR: '41', EU: '41', UK: '7', US: '9', JP: '26' },
    '42': { FR: '42', EU: '42', UK: '8', US: '10', JP: '26.5' },
    '43': { FR: '43', EU: '43', UK: '9', US: '11', JP: '27.5' },
    '44': { FR: '44', EU: '44', UK: '10', US: '12', JP: '28' },
    '45': { FR: '45', EU: '45', UK: '11', US: '13', JP: '29' },
  };

  const data = type === 'vetements' ? vetements : chaussures;
  const keys = Object.keys(data);
  const currentData = data[tailleFR] || data[keys[0]];

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['vetements', 'chaussures'] as const).map((t) => (
          <button key={t} onClick={() => { setType(t); setTailleFR(t === 'vetements' ? 'M' : '42'); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${type === t ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            {t === 'vetements' ? '👕 Vêtements' : '👟 Chaussures'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          TAILLE FR / EU
        </label>
        <div className="flex flex-wrap gap-2">
          {keys.map((k) => (
            <button key={k} onClick={() => setTailleFR(k)}
              className={`px-4 py-2 rounded-lg font-mono text-sm font-600 transition-all ${tailleFR === k ? 'bg-primary text-white' : 'bg-background border border-border text-foreground hover:border-primary'}`}
              style={{ fontFamily: 'var(--font-mono)' }}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {currentData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(currentData).map(([country, size]) => (
            <div key={country} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{country}</p>
              <p className="font-mono font-700 text-2xl text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{size}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TOOL: Fuseaux horaires ───────────────────────────────────────────────────
function ToolFuseaux() {
  const [baseCity, setBaseCity] = useState('Paris');
  const [targetCity, setTargetCity] = useState('Tokyo');
  const [_currentTime, setCurrentTime] = useState('');

  const cities: Record<string, { offset: number; flag: string }> = {
    Paris: { offset: 1, flag: '🇫🇷' },
    Londres: { offset: 0, flag: '🇬🇧' },
    'New York': { offset: -5, flag: '🇺🇸' },
    'Los Angeles': { offset: -8, flag: '🇺🇸' },
    Tokyo: { offset: 9, flag: '🇯🇵' },
    Sydney: { offset: 10, flag: '🇦🇺' },
    Dubaï: { offset: 4, flag: '🇦🇪' },
    Bangkok: { offset: 7, flag: '🇹🇭' },
    Mumbai: { offset: 5.5, flag: '🇮🇳' },
    'São Paulo': { offset: -3, flag: '🇧🇷' },
    Nairobi: { offset: 3, flag: '🇰🇪' },
    Reykjavik: { offset: 0, flag: '🇮🇸' },
  };

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const getLocalTime = (cityName: string) => {
    const city = cities[cityName];
    if (!city) return '--:--';
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const local = new Date(utc + city.offset * 3600000);
    return local.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const diff = cities[targetCity]?.offset - cities[baseCity]?.offset;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {[{ label: 'VOTRE VILLE', value: baseCity, setter: setBaseCity }, { label: 'DESTINATION', value: targetCity, setter: setTargetCity }].map(({ label, value, setter }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{label}</label>
            <select value={value} onChange={(e) => setter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
              aria-label={label}>
              {Object.keys(cities).map((c) => <option key={c}>{c}</option>)}
            </select>
            <p className="font-mono font-700 text-3xl text-info mt-3" style={{ fontFamily: 'var(--font-mono)' }}>{getLocalTime(value)}</p>
            <p className="text-xs text-muted-foreground mt-1">{cities[value]?.flag} UTC{cities[value]?.offset >= 0 ? '+' : ''}{cities[value]?.offset}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-mono)' }}>DÉCALAGE HORAIRE</p>
        <p className="font-mono font-700 text-4xl text-primary" style={{ fontFamily: 'var(--font-mono)' }}>
          {diff >= 0 ? '+' : ''}{diff}h
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {Math.abs(diff) === 0 ? 'Même fuseau horaire' : `${targetCity} est en avance de ${Math.abs(diff)}h sur ${baseCity}`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(cities).map(([city, data]) => (
          <div key={city} className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-lg mb-1">{data.flag}</p>
            <p className="text-xs text-muted-foreground mb-1">{city}</p>
            <p className="font-mono font-600 text-sm text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{getLocalTime(city)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TOOL: Boussole & Niveau ──────────────────────────────────────────────────
function ToolBoussole() {
  const [heading, setHeading] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);

  const startSensors = useCallback(() => {
    if (typeof window === 'undefined') return;
    setActive(true);
    if ('DeviceOrientationEvent' in window) {
      const handler = (e: DeviceOrientationEvent) => {
        if (e.alpha !== null) setHeading(Math.round(e.alpha));
        if (e.beta !== null) setBeta(Math.round(e.beta));
        if (e.gamma !== null) setGamma(Math.round(e.gamma));
      };
      window.addEventListener('deviceorientation', handler);
      return () => window.removeEventListener('deviceorientation', handler);
    } else {
      setError('Capteurs non disponibles sur cet appareil.');
    }
  }, []);

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const dirIndex = heading !== null ? Math.round(heading / 45) % 8 : 0;
  const dirLabel = heading !== null ? directions[dirIndex] : '—';

  const isLevel = beta !== null && gamma !== null && Math.abs(beta) < 5 && Math.abs(gamma) < 5;

  return (
    <div className="space-y-5">
      {!active ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🧭</div>
          <p className="text-muted-foreground mb-6">Activez les capteurs pour utiliser la boussole et le niveau</p>
          <button onClick={startSensors} className="btn-primary px-8 py-3">Activer les capteurs</button>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center text-red-400 text-sm">{error}</div>
          )}

          {/* Compass */}
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)' }}>BOUSSOLE</p>
            <div className="relative w-40 h-40 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-border flex items-center justify-center bg-background">
                <div className="relative w-full h-full" style={{ transform: `rotate(${heading ?? 0}deg)`, transition: 'transform 0.3s ease' }}>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-16 bg-primary rounded-full" />
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-16 bg-muted rounded-full" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono font-700 text-2xl text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{dirLabel}</span>
                </div>
              </div>
            </div>
            <p className="font-mono font-700 text-3xl text-info" style={{ fontFamily: 'var(--font-mono)' }}>{heading ?? '--'}°</p>
          </div>

          {/* Level */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4 text-center" style={{ fontFamily: 'var(--font-mono)' }}>NIVEAU À BULLE</p>
            <div className={`w-32 h-32 mx-auto rounded-full border-4 flex items-center justify-center relative ${isLevel ? 'border-emerald-400' : 'border-border'}`}>
              <div
                className={`w-8 h-8 rounded-full transition-all duration-200 ${isLevel ? 'bg-emerald-400' : 'bg-primary'}`}
                style={{
                  transform: `translate(${Math.min(40, Math.max(-40, (gamma ?? 0) * 1.5))}px, ${Math.min(40, Math.max(-40, (beta ?? 0) * 1.5))}px)`
                }}
              />
            </div>
            <p className="text-center mt-3 text-sm font-medium">{isLevel ? '✅ Niveau' : '⚠️ Incliner pour niveler'}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-center">
                <p className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>INCLINAISON X</p>
                <p className="font-mono font-600 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{beta ?? '--'}°</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>INCLINAISON Y</p>
                <p className="font-mono font-600 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{gamma ?? '--'}°</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── TOOL: Chronomètre ───────────────────────────────────────────────────────
function ToolChronometre() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const [lastLap, setLastLap] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 100), 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const fmt = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 100);
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cs}`;
  };

  const addLap = () => {
    setLaps((prev) => [...prev, elapsed - lastLap]);
    setLastLap(elapsed);
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
    setLastLap(0);
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)' }}>CHRONOMÈTRE</p>
        <p className="font-mono font-700 text-5xl md:text-6xl text-foreground tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {fmt(elapsed)}
        </p>
        {laps.length > 0 && (
          <p className="font-mono text-sm text-muted-foreground mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
            Tour actuel : {fmt(elapsed - lastLap)}
          </p>
        )}
      </div>

      <div className="flex gap-3 justify-center">
        <button onClick={() => setRunning(!running)}
          className={`px-8 py-3 rounded-xl font-medium text-base transition-all ${running ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'btn-primary'}`}>
          {running ? '⏸ Pause' : elapsed > 0 ? '▶ Reprendre' : '▶ Démarrer'}
        </button>
        {running && (
          <button onClick={addLap} className="px-6 py-3 rounded-xl bg-card border border-border text-foreground hover:border-primary transition-all font-medium">
            🏁 Tour
          </button>
        )}
        {elapsed > 0 && !running && (
          <button onClick={reset} className="px-6 py-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-all font-medium">
            ↺ Reset
          </button>
        )}
      </div>

      {laps.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>TOURS</span>
          </div>
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {[...laps].reverse().map((lap, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Tour {laps.length - idx}</span>
                <span className="font-mono font-600 text-sm text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(lap)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOOL: Rations ───────────────────────────────────────────────────────────
function ToolRations() {
  const [personnes, setPersonnes] = useState(1);
  const [jours, setJours] = useState(3);
  const [effort, setEffort] = useState<'léger' | 'modéré' | 'intense'>('modéré');
  const [chaleur, setChaleur] = useState<'froid' | 'tempéré' | 'chaud'>('tempéré');

  const effortFactor = { léger: 1, modéré: 1.3, intense: 1.6 };
  const chaleurFactor = { froid: 1.2, tempéré: 1, chaud: 1.1 };

  const baseEauL = 2.5;
  const baseCalories = 2200;
  const basePoidsG = 600;

  const eauParJourL = baseEauL * effortFactor[effort] * chaleurFactor[chaleur];
  const caloriesParJour = Math.round(baseCalories * effortFactor[effort]);
  const nourritureParJourG = Math.round(basePoidsG * effortFactor[effort]);

  const totalEau = eauParJourL * jours * personnes;
  const totalNourriture = nourritureParJourG * jours * personnes;
  const totalCalories = caloriesParJour * jours * personnes;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>PERSONNES</label>
          <input type="number" min={1} max={20} value={personnes} onChange={(e) => setPersonnes(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-xl font-700 focus:outline-none focus:border-primary" style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>JOURS</label>
          <input type="number" min={1} max={30} value={jours} onChange={(e) => setJours(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-xl font-700 focus:outline-none focus:border-primary" style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-mono)' }}>EFFORT</p>
          <div className="flex flex-col gap-2">
            {(['léger', 'modéré', 'intense'] as const).map((e) => (
              <button key={e} onClick={() => setEffort(e)}
                className={`py-2 rounded-lg text-sm font-medium transition-all capitalize ${effort === e ? 'bg-primary text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'}`}>
                {e === 'léger' ? '🚶 Léger' : e === 'modéré' ? '🏃 Modéré' : '⛰️ Intense'}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-mono)' }}>CLIMAT</p>
          <div className="flex flex-col gap-2">
            {(['froid', 'tempéré', 'chaud'] as const).map((c) => (
              <button key={c} onClick={() => setChaleur(c)}
                className={`py-2 rounded-lg text-sm font-medium transition-all capitalize ${chaleur === c ? 'bg-info text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'}`}>
                {c === 'froid' ? '❄️ Froid' : c === 'tempéré' ? '🌤 Tempéré' : '☀️ Chaud'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'EAU / JOUR / PERS.', value: `${eauParJourL.toFixed(1)} L`, icon: '💧', color: 'text-info' },
          { label: 'NOURRITURE / JOUR', value: `${nourritureParJourG} g`, icon: '🍽️', color: 'text-accent' },
          { label: 'CALORIES / JOUR', value: `${caloriesParJour} kcal`, icon: '⚡', color: 'text-primary' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{stat.label}</p>
            <p className={`font-mono font-700 text-xl ${stat.color}`} style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-info/5 border border-info/20 rounded-xl p-4">
        <p className="font-mono text-[10px] text-info uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          TOTAUX — {jours} JOUR{jours > 1 ? 'S' : ''} × {personnes} PERSONNE{personnes > 1 ? 'S' : ''}
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>EAU TOTALE</p>
            <p className="font-mono font-700 text-lg text-info" style={{ fontFamily: 'var(--font-mono)' }}>{totalEau.toFixed(1)} L</p>
          </div>
          <div>
            <p className="font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>NOURRITURE</p>
            <p className="font-mono font-700 text-lg text-accent" style={{ fontFamily: 'var(--font-mono)' }}>{(totalNourriture / 1000).toFixed(1)} kg</p>
          </div>
          <div>
            <p className="font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>CALORIES</p>
            <p className="font-mono font-700 text-lg text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{totalCalories.toLocaleString()} kcal</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TOOL: Planificateur d'itinéraire ────────────────────────────────────────
function ToolPlanificateur() {
  const [destination, setDestination] = useState('');
  const [duree, setDuree] = useState(7);
  const [budget, setBudget] = useState<'petit' | 'moyen' | 'grand'>('moyen');
  const [style, setStyle] = useState<'aventure' | 'culture' | 'detente' | 'mixte'>('mixte');
  const [etapes, setEtapes] = useState<{ jour: number; activite: string; lieu: string; conseil: string }[]>([]);
  const [generated, setGenerated] = useState(false);

  const TEMPLATES: Record<string, { activite: string; lieu: string; conseil: string }[]> = {
    aventure: [
      { activite: 'Arrivée & acclimatation', lieu: 'Ville principale', conseil: 'Reposez-vous — le décalage horaire est réel' },
      { activite: 'Randonnée d\'orientation', lieu: 'Parc naturel proche', conseil: 'Partez tôt le matin pour éviter la chaleur' },
      { activite: 'Trek en autonomie', lieu: 'Sentier principal', conseil: 'Vérifiez la météo la veille' },
      { activite: 'Bivouac en altitude', lieu: 'Refuge ou camping', conseil: 'Emportez 2L d\'eau minimum' },
      { activite: 'Descente & exploration', lieu: 'Vallée', conseil: 'Profitez des marchés locaux' },
      { activite: 'Activité nautique', lieu: 'Lac ou rivière', conseil: 'Vérifiez les conditions de sécurité' },
      { activite: 'Retour & bilan', lieu: 'Ville principale', conseil: 'Notez vos impressions pour votre carnet' },
    ],
    culture: [
      { activite: 'Arrivée & orientation', lieu: 'Centre historique', conseil: 'Achetez un city pass si disponible' },
      { activite: 'Musées & monuments', lieu: 'Quartier historique', conseil: 'Réservez en ligne pour éviter les files' },
      { activite: 'Gastronomie locale', lieu: 'Marché central', conseil: 'Déjeunez où mangent les locaux' },
      { activite: 'Excursion journée', lieu: 'Site classé UNESCO', conseil: 'Partez tôt, retour avant 17h' },
      { activite: 'Quartiers alternatifs', lieu: 'Quartier artiste', conseil: 'Les meilleures adresses ne sont pas dans les guides' },
      { activite: 'Spectacle ou festival', lieu: 'Salle de spectacle', conseil: 'Réservez à l\'avance en haute saison' },
      { activite: 'Départ & souvenirs', lieu: 'Boutiques artisanales', conseil: 'Privilégiez l\'artisanat local au plastique importé' },
    ],
    detente: [
      { activite: 'Arrivée & check-in', lieu: 'Hébergement', conseil: 'Prenez le temps de vous installer' },
      { activite: 'Plage ou spa', lieu: 'Zone balnéaire', conseil: 'Crème solaire SPF 50+ indispensable' },
      { activite: 'Balade tranquille', lieu: 'Promenade locale', conseil: 'Pas d\'objectif — juste flâner' },
      { activite: 'Gastronomie & repos', lieu: 'Restaurant vue mer', conseil: 'Réservez pour le coucher de soleil' },
      { activite: 'Activité douce', lieu: 'Yoga ou snorkeling', conseil: 'Hydratez-vous régulièrement' },
      { activite: 'Journée libre', lieu: 'Au choix', conseil: 'Laissez-vous guider par l\'envie du moment' },
      { activite: 'Retour serein', lieu: 'Aéroport / gare', conseil: 'Prévoyez 3h avant le départ' },
    ],
    mixte: [
      { activite: 'Arrivée & découverte', lieu: 'Centre-ville', conseil: 'Première impression — notez tout' },
      { activite: 'Nature & randonnée', lieu: 'Parc naturel', conseil: 'Chaussures imperméables recommandées' },
      { activite: 'Culture & histoire', lieu: 'Site historique', conseil: 'Guide local pour le contexte' },
      { activite: 'Gastronomie locale', lieu: 'Marché ou restaurant', conseil: 'Osez les spécialités locales' },
      { activite: 'Aventure douce', lieu: 'Activité outdoor', conseil: 'Vérifiez les conditions météo' },
      { activite: 'Détente & bilan', lieu: 'Café ou parc', conseil: 'Écrivez vos impressions' },
      { activite: 'Retour', lieu: 'Aéroport / gare', conseil: 'Dernier regard sur la ville' },
    ],
  };

  const generate = () => {
    const template = TEMPLATES[style];
    const result = Array.from({ length: duree }, (_, i) => {
      const base = template[i % template.length];
      return {
        jour: i + 1,
        activite: base.activite,
        lieu: destination ? `${base.lieu} — ${destination}` : base.lieu,
        conseil: base.conseil,
      };
    });
    setEtapes(result);
    setGenerated(true);
  };

  const budgetLabels = { petit: '🎒 Petit budget (< 50€/j)', moyen: '🏨 Budget moyen (50–150€/j)', grand: '⭐ Confort (> 150€/j)' };
  const styleLabels = { aventure: '⛰️ Aventure', culture: '🏛️ Culture', detente: '🌴 Détente', mixte: '🗺️ Mixte' };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>DESTINATION</label>
          <input
            type="text"
            placeholder="Ex : Islande, Japon, Maroc..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
            aria-label="Destination"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>DURÉE (jours)</label>
            <input
              type="number" min={1} max={30} value={duree}
              onChange={(e) => setDuree(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-xl font-700 focus:outline-none focus:border-primary"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>BUDGET</label>
            <select value={budget} onChange={(e) => setBudget(e.target.value as 'petit' | 'moyen' | 'grand')}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary"
              aria-label="Budget">
              {(Object.entries(budgetLabels) as [string, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2" style={{ fontFamily: 'var(--font-mono)' }}>STYLE DE VOYAGE</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(styleLabels) as [string, string][]).map(([k, v]) => (
              <button key={k} onClick={() => setStyle(k as 'aventure' | 'culture' | 'detente' | 'mixte')}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all ${style === k ? 'bg-primary text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} className="w-full btn-primary py-3 text-base font-semibold">
          🗺️ Générer mon itinéraire
        </button>
      </div>

      {generated && etapes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
              ITINÉRAIRE — {duree} JOUR{duree > 1 ? 'S' : ''}{destination ? ` · ${destination.toUpperCase()}` : ''}
            </p>
            <span className="text-xs text-muted-foreground">{budgetLabels[budget]}</span>
          </div>
          {etapes.map((etape) => (
            <div key={etape.jour} className="bg-card border border-border rounded-xl p-4 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <span className="font-mono font-700 text-sm text-primary" style={{ fontFamily: 'var(--font-mono)' }}>J{etape.jour}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{etape.activite}</p>
                <p className="text-xs text-muted-foreground mt-0.5">📍 {etape.lieu}</p>
                <p className="text-xs text-info mt-1.5 flex items-start gap-1">
                  <span>💡</span>
                  <span>{etape.conseil}</span>
                </p>
              </div>
            </div>
          ))}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Pour un itinéraire personnalisé avec équipement recommandé :</p>
            <a href="/ai-configurator" className="btn-primary py-2 px-6 text-sm inline-flex items-center gap-2">
              ✨ Configurateur IA complet
            </a>
          </div>
        </div>
      )}

      {!generated && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">🗺️</p>
          <p>Remplissez les informations ci-dessus et cliquez sur &quot;Générer&quot;</p>
        </div>
      )}
    </div>
  );
}

// ─── TOOL REGISTRY ────────────────────────────────────────────────────────────
const toolRegistry: Record<string, { nom: string; icon: string; description: string; component: React.FC }> = {
  'poids-sac': { nom: 'Calculateur de poids du sac', icon: '⚖️', description: 'Pesez votre sac par catégorie avec jauge visuelle.', component: ToolPoidssSac },
  // Sitemap alias
  'poids-du-sac': { nom: 'Calculateur de poids du sac', icon: '⚖️', description: 'Pesez votre sac par catégorie avec jauge visuelle.', component: ToolPoidssSac },
  'budget-voyage': { nom: 'Budget voyage', icon: '💰', description: 'Planifiez votre budget par jour et par poste.', component: ToolBudget },
  'convertisseur': { nom: 'Convertisseur universel', icon: '🔄', description: 'Convertissez distances, poids, températures et devises.', component: ToolConvertisseur },
  // Sitemap alias
  'convertisseur-devises': { nom: 'Convertisseur universel', icon: '🔄', description: 'Convertissez distances, poids, températures et devises.', component: ToolConvertisseur },
  'checklist': { nom: 'Checklist interactive', icon: '✅', description: 'Créez et personnalisez vos listes de voyage.', component: ToolChecklist },
  'tailles': { nom: 'Convertisseur de tailles', icon: '👟', description: 'Vêtements et chaussures par pays.', component: ToolTailles },
  'fuseaux': { nom: 'Fuseaux horaires', icon: '🕐', description: 'Comparez les heures entre pays.', component: ToolFuseaux },
  'boussole': { nom: 'Boussole & Niveau', icon: '🧭', description: 'Boussole et niveau à bulle via capteurs.', component: ToolBoussole },
  'chronometre': { nom: 'Chronomètre rando', icon: '⏱️', description: 'Minuteur et chronomètre pour vos sorties.', component: ToolChronometre },
  'rations': { nom: 'Rations eau & nourriture', icon: '💧', description: 'Calculez vos besoins en eau et nourriture.', component: ToolRations },
  // Sitemap alias for rations
  'calculateur-calories': { nom: 'Rations eau & nourriture', icon: '💧', description: 'Calculez vos besoins en eau, nourriture et calories.', component: ToolRations },
  // Planificateur d'itinéraire — redirects to configurateur
  'planificateur-itineraire': { nom: 'Planificateur d\'itinéraire IA', icon: '🗺️', description: 'Planifiez votre itinéraire avec l\'aide de l\'IA.', component: ToolPlanificateur },
};

// ─── PAGE WRAPPER ─────────────────────────────────────────────────────────────
export default function OutilSlugPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const tool = toolRegistry[slug];

  if (!tool) {
    return (
      <>
        {/* ── DESKTOP ── */}
        <div className="hidden md:block">
          <div className="min-h-screen bg-background text-foreground">
            <Header />
            <div className="max-w-2xl mx-auto px-4 pt-32 text-center">
              <p className="text-6xl mb-4">🔧</p>
              <h1 className="font-display font-700 text-2xl mb-4" style={{ fontFamily: 'var(--font-display)' }}>Outil introuvable</h1>
              <Link href="/outils" className="btn-primary">← Retour aux outils</Link>
            </div>
            <Footer />
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '16px', textAlign: 'center', paddingTop: '80px' }}>
              <p style={{ fontSize: '40px', marginBottom: '16px' }}>🔧</p>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#17402C', marginBottom: '12px' }}>Outil introuvable</h1>
              <Link href="/outils" style={{ display: 'inline-block', padding: '12px 24px', background: '#17402C', color: 'white', borderRadius: '999px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>← Retour aux outils</Link>
            </div>
          </MobilePageShell>
          
        </div>
      </>
    );
  }

  const ToolComponent = tool.component;

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />

          {/* Tool Header */}
          <section className="pt-24 pb-8 bg-dark-bg">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <nav className="flex items-center gap-2 text-xs text-white/50 mb-4" aria-label="Fil d'Ariane">
                <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
                <span>/</span>
                <Link href="/outils" className="hover:text-white transition-colors">Outils</Link>
                <span>/</span>
                <span className="text-white/80">{tool.nom}</span>
              </nav>
              <div className="flex items-center gap-4">
                <span className="text-5xl" role="img" aria-label={tool.nom}>{tool.icon}</span>
                <div>
                  <h1 className="font-display font-800 text-2xl md:text-3xl text-white tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                    {tool.nom}
                  </h1>
                  <p className="text-white/60 text-sm mt-1">{tool.description}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tool Content */}
          <section className="py-8">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <ToolComponent />
            </div>
          </section>

          {/* Nav between tools */}
          <section className="py-8 border-t border-border">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)' }}>AUTRES OUTILS</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(toolRegistry)
                  .filter(([s]) => s !== slug)
                  .map(([s, t]) => (
                    <Link key={s} href={`/outils/${s}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:border-info/50 transition-all">
                      <span>{t.icon}</span>
                      <span>{t.nom}</span>
                    </Link>
                  ))}
              </div>
            </div>
          </section>

          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Tool Header */}
            <div style={{ marginBottom: '20px' }}>
              <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7A72', marginBottom: '12px' }}>
                <Link href="/outils" style={{ color: '#6B7A72', textDecoration: 'none' }}>Outils</Link>
                <span>/</span>
                <span style={{ color: '#17402C' }}>{tool.nom}</span>
              </nav>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '36px' }} role="img" aria-label={tool.nom}>{tool.icon}</span>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#17402C', lineHeight: '1.2', marginBottom: '4px' }}>{tool.nom}</h1>
                  <p style={{ fontSize: '13px', color: '#6B7A72', lineHeight: '1.4' }}>{tool.description}</p>
                </div>
              </div>
            </div>

            {/* Tool Content */}
            <ToolComponent />

            {/* Other tools */}
            <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(23,64,44,0.06)' }}>
              <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>AUTRES OUTILS</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(toolRegistry)
                  .filter(([s]) => s !== slug)
                  .map(([s, t]) => (
                    <Link
                      key={s}
                      href={`/outils/${s}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: '#F4F1EA',
                        border: '1px solid rgba(23,64,44,0.06)',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: '#6B7A72',
                        textDecoration: 'none',
                      }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.nom}</span>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
