'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';

interface MapData {
  trails: Array<{ id: string; name: string; difficulty: string; distance_km: number; elevation_gain_m: number; duration_hours: number; region: string; tags: string[] }>;
  refuges: Array<{ id: string; name: string; altitude_m: number; capacity: number; is_staffed: boolean; price_per_night: number; region: string }>;
  waterPoints: Array<{ id: string; name: string; water_type: string; is_potable: boolean; region: string }>;
  summits: Array<{ id: string; name: string; altitude_m: number; difficulty: string; region: string; massif: string }>;
}

interface AdventureGeneratorProps {
  mapData: MapData;
}

interface AdventureParams {
  region: string;
  duration: string;
  difficulty: string;
  objectives: string[];
  groupSize: string;
  budget: string;
}

const OBJECTIVES = [
  { id: 'randonnee', label: '🥾 Randonnée', desc: 'Sentiers et chemins' },
  { id: 'sommet', label: '▲ Sommet', desc: 'Atteindre un pic' },
  { id: 'bivouac', label: '⛺ Bivouac', desc: 'Nuit en pleine nature' },
  { id: 'refuge', label: '🏠 Refuge', desc: 'Nuit en refuge gardé' },
  { id: 'photo', label: '📸 Photo', desc: 'Paysages & nature' },
  { id: 'famille', label: '👨‍👩‍👧 Famille', desc: 'Accessible à tous' },
];

const REGIONS = ['Alpes', 'Pyrénées', 'Vosges', 'Massif Central', 'Corse', 'Jura', 'Provence'];

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-bold text-[#E4501C] mt-4 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-bold text-white mt-5 mb-2 border-b border-white/10 pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} className="text-white/80 text-sm ml-4 list-disc">{formatInline(line.slice(2))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<li key={i} className="text-white/80 text-sm ml-4 list-decimal">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} className="border-l-2 border-[#E4501C] pl-3 text-white/60 text-sm italic my-1">{line.slice(2)}</blockquote>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-white/80 text-sm leading-relaxed">{formatInline(line)}</p>);
    }
    i++;
  }
  return elements;
}

function formatInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="text-white/90">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export default function AdventureGenerator({ mapData }: AdventureGeneratorProps) {
  const { user } = useAuth();
  const [params, setParams] = useState<AdventureParams>({
    region: '',
    duration: '3',
    difficulty: 'moderate',
    objectives: [],
    groupSize: '2',
    budget: 'moyen',
  });
  const [phase, setPhase] = useState<'form' | 'generating' | 'result'>('form');
  const [savedMsg, setSavedMsg] = useState('');
  const [tipIndex, setTipIndex] = useState(0);

  const { response, isLoading, error, sendMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  const TIPS = [
    'Analyse des sentiers disponibles dans la région…',
    'Sélection des refuges et points d\'eau…',
    'Construction de l\'itinéraire jour par jour…',
    'Calcul des dénivelés et distances…',
    'Préparation de la liste d\'équipement…',
    'Estimation du budget et alternatives…',
    'Finalisation de votre aventure personnalisée…',
  ];

  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 2500);
    return () => clearInterval(interval);
  }, [phase, TIPS.length]);

  useEffect(() => {
    if (response && !isLoading && phase === 'generating') {
      setPhase('result');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading, phase]);

  const toggleObjective = (id: string) => {
    setParams(prev => ({
      ...prev,
      objectives: prev.objectives.includes(id)
        ? prev.objectives.filter(o => o !== id)
        : [...prev.objectives, id],
    }));
  };

  const buildContext = () => {
    const regionTrails = mapData.trails.filter(t => !params.region || t.region.toLowerCase().includes(params.region.toLowerCase()));
    const regionRefuges = mapData.refuges.filter(r => !params.region || r.region.toLowerCase().includes(params.region.toLowerCase()));
    const regionSummits = mapData.summits.filter(s => !params.region || s.region.toLowerCase().includes(params.region.toLowerCase()));

    return {
      trails: regionTrails.slice(0, 5).map(t => `${t.name} (${t.difficulty}, ${t.distance_km}km, ${t.elevation_gain_m}m D+, ${t.duration_hours}h)`).join('\n'),
      refuges: regionRefuges.slice(0, 4).map(r => `${r.name} (${r.altitude_m}m, ${r.capacity} places, ${r.is_staffed ? 'gardé' : 'non gardé'}, ${r.price_per_night}€/nuit)`).join('\n'),
      summits: regionSummits.slice(0, 4).map(s => `${s.name} (${s.altitude_m}m, ${s.difficulty}, massif ${s.massif})`).join('\n'),
    };
  };

  const generateAdventure = async () => {
    if (!params.region && !params.objectives.length) return;
    setPhase('generating');
    setTipIndex(0);

    const ctx = buildContext();

    const systemPrompt = `Tu es un guide de montagne expert et planificateur d'aventures outdoor. Tu connais parfaitement les Alpes, Pyrénées, Vosges, Massif Central, Corse et toutes les montagnes françaises. Tu génères des plans d'aventure ultra-détaillés, concrets et réalisables avec des noms réels de lieux, refuges, sentiers et équipements.`;

    const userPrompt = `Génère un plan d'aventure outdoor complet et détaillé avec ces paramètres :

**Région :** ${params.region || 'France (au choix)'}
**Durée :** ${params.duration} jours
**Difficulté :** ${params.difficulty}
**Objectifs :** ${params.objectives.join(', ') || 'randonnée générale'}
**Groupe :** ${params.groupSize} personne(s)
**Budget :** ${params.budget}

**Données cartographiques disponibles :**
Sentiers : ${ctx.trails || 'données générales'}
Refuges : ${ctx.refuges || 'données générales'}
Sommets : ${ctx.summits || 'données générales'}

Génère un plan structuré avec ces sections :

## 🗺️ Vue d'ensemble de l'aventure Résumé de l'aventure, points forts, pourquoi cette région est idéale.

## 📅 Itinéraire jour par jour
Pour chaque jour : matin / après-midi / soir avec distances, dénivelés, durées, noms de lieux réels.

## 🏠 Hébergements & Bivouac
Refuges recommandés avec noms, altitudes, prix, réservation. Spots bivouac si applicable.

## 💧 Points d'eau & Ravitaillement
Sources, fontaines, refuges avec ravitaillement sur le parcours.

## 🎒 Liste d'équipement essentiel
Équipement indispensable avec marques recommandées, poids indicatifs, priorités.

## 💶 Budget détaillé
Transport, hébergement, nourriture, équipement, total estimé.

## ⚠️ Conseils de sécurité & Météo
Précautions, période idéale, numéros d'urgence, équipement de sécurité.

## 🌟 Alternatives & Options
Version plus facile, plus difficile, variantes selon météo.

Sois très concret, utilise des noms réels de lieux, donne des chiffres précis.`;

    sendMessage([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.7, max_tokens: 4000 });
  };

  const saveAdventure = async () => {
    if (!user || !response) return;
    try {
      const res = await fetch('/api/map/adventures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Aventure ${params.region || 'France'} — ${params.duration}j`,
          description: `${params.objectives.join(', ')} · ${params.difficulty}`,
          adventure_data: { content: response, params },
          map_context: { region: params.region },
          duration_days: parseInt(params.duration),
          difficulty: params.difficulty,
          region: params.region,
        }),
      });
      if (res.ok) setSavedMsg('✅ Aventure sauvegardée !');
    } catch {
      setSavedMsg('❌ Erreur lors de la sauvegarde');
    }
    setTimeout(() => setSavedMsg(''), 3000);
  };

  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
        <div className="w-16 h-16 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin mb-6" />
        <h3 className="text-white font-bold text-lg mb-2">Génération en cours…</h3>
        <p className="text-white/60 text-sm animate-pulse">{TIPS[tipIndex]}</p>
        <div className="mt-6 flex gap-1">
          {TIPS.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === tipIndex ? 'bg-[#E4501C] w-4' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'result' && response) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-white font-bold">Votre aventure personnalisée</h3>
            <p className="text-white/50 text-xs">{params.region} · {params.duration} jours · {params.difficulty}</p>
          </div>
          <div className="flex gap-2">
            {user && (
              <button
                onClick={saveAdventure}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E4501C]/20 hover:bg-[#E4501C]/30 text-[#E4501C] rounded-lg text-xs font-medium transition-all"
              >
                <Icon name="BookmarkIcon" className="w-3.5 h-3.5" />
                Sauvegarder
              </button>
            )}
            <button
              onClick={() => setPhase('form')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all"
            >
              <Icon name="ArrowPathIcon" className="w-3.5 h-3.5" />
              Nouvelle
            </button>
          </div>
        </div>
        {savedMsg && (
          <div className="mx-4 mt-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-xs text-center">{savedMsg}</div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {renderMarkdown(response)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="SparklesIcon" className="w-5 h-5 text-[#E4501C]" />
          <h3 className="text-white font-bold">Générateur d&apos;aventures IA</h3>
        </div>
        <p className="text-white/50 text-xs">Gemini analyse les données cartographiques pour créer votre aventure sur mesure</p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Region */}
        <div>
          <label className="text-white/70 text-xs font-semibold uppercase tracking-wider block mb-2">Région</label>
          <div className="grid grid-cols-2 gap-1.5">
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => setParams(p => ({ ...p, region: p.region === r ? '' : r }))}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  params.region === r
                    ? 'bg-[#E4501C] text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-white/70 text-xs font-semibold uppercase tracking-wider block mb-2">
            Durée — <span className="text-[#E4501C]">{params.duration} jours</span>
          </label>
          <input
            type="range" min="1" max="14" value={params.duration}
            onChange={e => setParams(p => ({ ...p, duration: e.target.value }))}
            className="w-full accent-[#E4501C]"
          />
          <div className="flex justify-between text-white/30 text-xs mt-1">
            <span>1j</span><span>7j</span><span>14j</span>
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-white/70 text-xs font-semibold uppercase tracking-wider block mb-2">Difficulté</label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'easy', label: '🟢 Facile' },
              { id: 'moderate', label: '🟡 Modéré' },
              { id: 'hard', label: '🔴 Difficile' },
              { id: 'expert', label: '⚫ Expert' },
            ].map(d => (
              <button
                key={d.id}
                onClick={() => setParams(p => ({ ...p, difficulty: d.id }))}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  params.difficulty === d.id
                    ? 'bg-[#E4501C] text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Objectives */}
        <div>
          <label className="text-white/70 text-xs font-semibold uppercase tracking-wider block mb-2">Objectifs</label>
          <div className="grid grid-cols-2 gap-1.5">
            {OBJECTIVES.map(obj => (
              <button
                key={obj.id}
                onClick={() => toggleObjective(obj.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                  params.objectives.includes(obj.id)
                    ? 'bg-[#E4501C]/20 text-[#E4501C] border border-[#E4501C]/40'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-transparent'
                }`}
              >
                <div>{obj.label}</div>
                <div className="text-white/30 text-[10px] mt-0.5">{obj.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Group size & Budget */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wider block mb-2">Groupe</label>
            <select
              value={params.groupSize}
              onChange={e => setParams(p => ({ ...p, groupSize: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#E4501C]"
            >
              {['1','2','3','4','5','6','8','10'].map(n => (
                <option key={n} value={n} className="bg-[#1C2620]">{n} pers.</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-white/70 text-xs font-semibold uppercase tracking-wider block mb-2">Budget</label>
            <select
              value={params.budget}
              onChange={e => setParams(p => ({ ...p, budget: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#E4501C]"
            >
              <option value="serré" className="bg-[#1C2620]">💰 Serré</option>
              <option value="moyen" className="bg-[#1C2620]">💶 Moyen</option>
              <option value="confortable" className="bg-[#1C2620]">💎 Confortable</option>
            </select>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={generateAdventure}
          disabled={isLoading}
          className="w-full py-3 bg-[#E4501C] hover:bg-[#c43d15] disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#E4501C]/20"
        >
          <Icon name="SparklesIcon" className="w-4 h-4" />
          Générer mon aventure
        </button>

        {error && (
          <p className="text-red-400 text-xs text-center">{error.message}</p>
        )}
      </div>
    </div>
  );
}
