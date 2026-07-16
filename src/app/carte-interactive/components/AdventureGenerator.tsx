'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';

interface AdventureGeneratorProps {
  onAdventureGenerated?: (text: string) => void;
}

interface AdventureIntent {
  freeText: string;
  region: string;
  duration: string;
  difficulty: string;
  activities: string[];
  groupSize: string;
  budget: string;
  conditions: string[];
}

const ACTIVITIES = [
  { id: 'randonnee', label: '🥾 Randonnée' },
  { id: 'trek', label: '🏔 Trek multi-jours' },
  { id: 'bivouac', label: '⛺ Bivouac' },
  { id: 'sommet', label: '▲ Sommet' },
  { id: 'trail', label: '🏃 Trail running' },
  { id: 'velo', label: '🚴 Vélo/VTT' },
  { id: 'kayak', label: '🛶 Kayak' },
  { id: 'alpinisme', label: '🧗 Alpinisme' },
];

const CONDITIONS = [
  { id: 'famille', label: '👨‍👩‍👧 Famille' },
  { id: 'solo', label: '🧍 Solo' },
  { id: 'debutant', label: '🌱 Débutant' },
  { id: 'sportif', label: '💪 Sportif' },
  { id: 'sauvage', label: '🌿 Sauvage' },
  { id: 'extreme', label: '⚡ Extrême' },
];

const EXAMPLE_INTENTS = [
  'Je veux partir 5 jours seul dans un endroit sauvage avec un sac léger',
  'Randonnée de 3 jours en famille avec enfants de 8 ans dans les Alpes',
  'Trek de 7 jours avec bivouac en Norvège, niveau intermédiaire',
  'Aventure de 2 semaines dans les Andes, budget serré',
  'Escapade week-end trail running en montagne, niveau expert',
];

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-[#E4501C] mt-4 mb-1.5 flex items-center gap-1.5">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-white mt-5 mb-2 border-b border-white/10 pb-1.5">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} className="text-white/80 text-xs ml-4 list-disc leading-relaxed">{formatInline(line.slice(2))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<li key={i} className="text-white/80 text-xs ml-4 list-decimal leading-relaxed">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} className="border-l-2 border-[#E4501C] pl-3 text-white/60 text-xs italic my-1">{line.slice(2)}</blockquote>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<p key={i} className="text-white/80 text-xs leading-relaxed">{formatInline(line)}</p>);
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

interface TrailContext {
  trailName: string;
  region: string;
  distance: number;
  elevation: number;
  difficulty: string;
  duration: number;
  trailType: string;
}

export default function AdventureGenerator({ onAdventureGenerated }: AdventureGeneratorProps) {
  const { user } = useAuth();
  const [intent, setIntent] = useState<AdventureIntent>({
    freeText: '',
    region: '',
    duration: '3',
    difficulty: 'moderate',
    activities: [],
    groupSize: '2',
    budget: 'moyen',
    conditions: [],
  });
  const [phase, setPhase] = useState<'intent' | 'params' | 'generating' | 'result'>('intent');
  const [savedMsg, setSavedMsg] = useState('');
  const [tipIndex, setTipIndex] = useState(0);
  const [trailContext, setTrailContext] = useState<TrailContext | null>(null);

  const { response, isLoading, error, sendMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  // Listen for trail selection from map
  useEffect(() => {
    const handleTrailEvent = (e: Event) => {
      const ctx = (e as CustomEvent<TrailContext>).detail;
      setTrailContext(ctx);
      setIntent(prev => ({
        ...prev,
        freeText: `Aventure basée sur le sentier "${ctx.trailName}" — ${ctx.trailType} de ${ctx.distance}km, ${ctx.elevation}m D+, difficulté ${ctx.difficulty}`,
        region: ctx.region || prev.region,
        difficulty: ctx.difficulty || prev.difficulty,
        activities: ctx.trailType ? [ctx.trailType] : prev.activities,
      }));
      setPhase('intent');
    };
    window.addEventListener('createAdventureFromTrail', handleTrailEvent);
    return () => window.removeEventListener('createAdventureFromTrail', handleTrailEvent);
  }, []);

  const TIPS = [
    'Analyse de votre intention de voyage…',
    'Recherche des meilleures régions correspondantes…',
    'Sélection des sentiers et itinéraires…',
    'Identification des refuges et bivouacs…',
    'Calcul des dénivelés et distances…',
    'Préparation de la liste d\'équipement…',
    'Estimation du budget et des transports…',
    'Finalisation de votre aventure sur mesure…',
  ];

  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 2800);
    return () => clearInterval(interval);
  }, [phase, TIPS.length]);

  useEffect(() => {
    if (response && !isLoading && phase === 'generating') {
      setPhase('result');
      onAdventureGenerated?.(response);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading, phase]);

  const toggleActivity = (id: string) => {
    setIntent(prev => ({
      ...prev,
      activities: prev.activities.includes(id)
        ? prev.activities.filter(a => a !== id)
        : [...prev.activities, id],
    }));
  };

  const toggleCondition = (id: string) => {
    setIntent(prev => ({
      ...prev,
      conditions: prev.conditions.includes(id)
        ? prev.conditions.filter(c => c !== id)
        : [...prev.conditions, id],
    }));
  };

  const generateAdventure = async () => {
    setPhase('generating');
    setTipIndex(0);

    const systemPrompt = `Tu es le meilleur guide de montagne et planificateur d'aventures outdoor au monde. Tu connais parfaitement tous les massifs, sentiers, refuges et itinéraires de la planète. Tu génères des plans d'aventure ultra-détaillés, concrets et réalisables avec des noms réels de lieux, refuges, sentiers et équipements. Tu parles toujours en français.`;

    // Build trail-specific context if available
    const trailContextStr = trailContext ? `
SENTIER SÉLECTIONNÉ SUR LA CARTE :
- Nom : ${trailContext.trailName}
- Type : ${trailContext.trailType}
- Distance : ${trailContext.distance} km
- Dénivelé : ${trailContext.elevation}m D+
- Durée estimée : ${trailContext.duration}h
- Difficulté : ${trailContext.difficulty}
- Région : ${trailContext.region}

Construis le plan d'aventure AUTOUR de ce sentier spécifique. Inclus les refuges proches, les points d'eau sur le tracé, les variantes possibles.
` : '';

    const userPrompt = `Génère un plan d'aventure outdoor COMPLET et ULTRA-DÉTAILLÉ basé sur cette demande :

INTENTION DE L'UTILISATEUR : "${intent.freeText || `Aventure ${intent.duration} jours en ${intent.region || 'France'}`}"
${trailContextStr}
PARAMÈTRES DÉTAILLÉS :
- Région souhaitée : ${intent.region || 'Au choix selon la demande'}
- Durée : ${intent.duration} jours
- Difficulté : ${intent.difficulty}
- Activités : ${intent.activities.join(', ') || 'randonnée générale'}
- Groupe : ${intent.groupSize} personne(s)
- Budget : ${intent.budget}
- Conditions : ${intent.conditions.join(', ') || 'standard'}

Génère un plan structuré COMPLET avec ces sections :

## 🌍 Destination recommandée
Pourquoi cette destination est parfaite pour cette demande. Points forts uniques.

## 📅 Itinéraire jour par jour
Pour CHAQUE jour : heure de départ, matin/après-midi/soir, distances précises, dénivelés, noms de lieux réels, durées, points de passage clés.

## 🏠 Hébergements & Bivouac
Refuges avec noms exacts, altitudes, prix, contact/réservation. Spots bivouac GPS si applicable.

## 💧 Points d'eau & Ravitaillement Sources, fontaines, refuges avec ravitaillement. Distances entre chaque point d'eau. ## 🎒 Liste d'équipement complète
Équipement indispensable organisé par catégorie (vêtements, navigation, sécurité, bivouac, nourriture). Poids indicatifs.

## 💶 Budget détaillé
Transport aller/retour, hébergement/nuit, nourriture/jour, équipement, total estimé par personne.

## 🚗 Comment y aller
Transport depuis Paris et depuis les grandes villes proches. Parking, navettes, transports en commun.

## ⚠️ Sécurité & Météo
Période idéale, risques spécifiques, équipement de sécurité obligatoire, numéros d'urgence locaux.

## 🌟 Alternatives
Version plus facile, plus difficile, variante mauvais temps, option week-end court.

Sois TRÈS concret : utilise des noms réels de lieux, donne des chiffres précis, des altitudes exactes, des distances réelles.`;

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
          title: intent.freeText ? intent.freeText.slice(0, 80) : `Aventure ${intent.region || 'France'} — ${intent.duration}j`,
          description: `${intent.activities.join(', ')} · ${intent.difficulty} · ${intent.duration}j`,
          adventure_data: { content: response, intent },
          map_context: { region: intent.region },
          duration_days: parseInt(intent.duration),
          difficulty: intent.difficulty,
          region: intent.region,
        }),
      });
      if (res.ok) setSavedMsg('✅ Aventure sauvegardée !');
    } catch {
      setSavedMsg('❌ Erreur lors de la sauvegarde');
    }
    setTimeout(() => setSavedMsg(''), 3000);
  };

  // ── Generating phase ──────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-[#E4501C]/20 rounded-full" />
          <div className="w-16 h-16 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🌍</div>
        </div>
        <h3 className="text-white font-bold text-base mb-2">Création de votre aventure…</h3>
        <p className="text-white/60 text-xs animate-pulse mb-4">{TIPS[tipIndex]}</p>
        <div className="flex gap-1">
          {TIPS.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === tipIndex ? 'bg-[#E4501C] w-5' : 'bg-white/20 w-1.5'}`} />
          ))}
        </div>
        {intent.freeText && (
          <div className="mt-6 bg-white/5 rounded-xl p-3 max-w-xs">
            <p className="text-white/50 text-xs italic">&ldquo;{intent.freeText}&rdquo;</p>
          </div>
        )}
      </div>
    );
  }

  // ── Result phase ──────────────────────────────────────────────
  if (phase === 'result' && response) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm truncate">Votre aventure personnalisée</h3>
            <p className="text-white/40 text-xs truncate">{intent.freeText || `${intent.region} · ${intent.duration}j · ${intent.difficulty}`}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0 ml-2">
            {user && (
              <button
                onClick={saveAdventure}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#E4501C]/20 hover:bg-[#E4501C]/30 text-[#E4501C] rounded-lg text-xs font-medium transition-all"
              >
                <Icon name="BookmarkIcon" className="w-3 h-3" />
                <span className="hidden sm:inline">Sauver</span>
              </button>
            )}
            <button
              onClick={() => setPhase('intent')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all"
            >
              <Icon name="ArrowPathIcon" className="w-3 h-3" />
              <span className="hidden sm:inline">Nouvelle</span>
            </button>
          </div>
        </div>
        {savedMsg && (
          <div className="mx-3 mt-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-xs text-center flex-shrink-0">{savedMsg}</div>
        )}
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {renderMarkdown(response)}
        </div>
      </div>
    );
  }

  // ── Intent phase (free text) ──────────────────────────────────
  if (phase === 'intent') {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="SparklesIcon" className="w-5 h-5 text-[#E4501C]" />
            <h3 className="text-white font-bold text-sm">Créateur d&apos;aventure IA</h3>
          </div>
          <p className="text-white/40 text-xs">Décrivez votre envie, l&apos;IA construit votre aventure complète</p>
        </div>

        <div className="p-4 space-y-4 flex-1">
          {/* Free text intent */}
          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider block mb-2">Décrivez votre envie</label>
            <textarea
              value={intent.freeText}
              onChange={e => setIntent(p => ({ ...p, freeText: e.target.value }))}
              placeholder="Ex: Je veux partir 5 jours seul dans un endroit sauvage avec un sac léger..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#E4501C] placeholder-white/25 resize-none"
            />
          </div>

          {/* Example intents */}
          <div>
            <label className="text-white/40 text-xs block mb-2">Exemples d&apos;intentions</label>
            <div className="space-y-1.5">
              {EXAMPLE_INTENTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setIntent(p => ({ ...p, freeText: ex }))}
                  className="w-full text-left px-3 py-2 bg-white/3 hover:bg-white/8 border border-white/5 hover:border-[#E4501C]/30 rounded-lg text-white/50 hover:text-white/80 text-xs transition-all"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Quick params */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Durée</label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min="1" max="21" value={intent.duration}
                  onChange={e => setIntent(p => ({ ...p, duration: e.target.value }))}
                  className="flex-1 accent-[#E4501C]"
                />
                <span className="text-[#E4501C] text-xs font-bold w-8 text-right">{intent.duration}j</span>
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Groupe</label>
              <select
                value={intent.groupSize}
                onChange={e => setIntent(p => ({ ...p, groupSize: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#E4501C]"
              >
                {['1','2','3','4','5','6','8','10'].map(n => (
                  <option key={n} value={n} className="bg-[#1C2620]">{n} pers.</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Difficulté</label>
              <select
                value={intent.difficulty}
                onChange={e => setIntent(p => ({ ...p, difficulty: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#E4501C]"
              >
                <option value="easy" className="bg-[#1C2620]">🟢 Facile</option>
                <option value="moderate" className="bg-[#1C2620]">🟡 Modéré</option>
                <option value="hard" className="bg-[#1C2620]">🔴 Difficile</option>
                <option value="expert" className="bg-[#1C2620]">⚫ Expert</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Budget</label>
              <select
                value={intent.budget}
                onChange={e => setIntent(p => ({ ...p, budget: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#E4501C]"
              >
                <option value="serré" className="bg-[#1C2620]">💰 Serré</option>
                <option value="moyen" className="bg-[#1C2620]">💶 Moyen</option>
                <option value="confortable" className="bg-[#1C2620]">💎 Confortable</option>
              </select>
            </div>
          </div>

          {/* Activities */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Activités</label>
            <div className="grid grid-cols-2 gap-1">
              {ACTIVITIES.map(a => (
                <button
                  key={a.id}
                  onClick={() => toggleActivity(a.id)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${intent.activities.includes(a.id) ? 'bg-[#E4501C]/20 text-[#E4501C] border border-[#E4501C]/30' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Conditions</label>
            <div className="grid grid-cols-3 gap-1">
              {CONDITIONS.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCondition(c.id)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${intent.conditions.includes(c.id) ? 'bg-[#E4501C]/20 text-[#E4501C] border border-[#E4501C]/30' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generateAdventure}
            disabled={isLoading || (!intent.freeText && !intent.activities.length)}
            className="w-full py-3 bg-gradient-to-r from-[#E4501C] to-[#c43d15] hover:from-[#c43d15] hover:to-[#a33210] disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#E4501C]/20"
          >
            <Icon name="SparklesIcon" className="w-4 h-4" />
            Créer mon aventure
          </button>

          {error && (
            <p className="text-red-400 text-xs text-center">{error.message}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
