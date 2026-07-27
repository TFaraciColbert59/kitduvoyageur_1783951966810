'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { getCart, saveCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface WizardState {
  step: number;
  usage: string;
  duree: string;
  meteo: string;
  confort: string;
  destination: string;
  generated: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  weightG: number;
  priceEur: number;
  essential: boolean;
  already_owned?: boolean;
}

interface AIResult {
  sac_recommande: string;
  poids_total_g: number;
  budget_estime_eur: number;
  alertes: string[];
  liste_equipement: EquipmentItem[];
}

// ── Kit items that build up as user answers ──────────────────────────────────
const BASE_KIT_ITEMS = [
  { id: 'sac', name: 'Sac 45 L', priceEur: 340, weightG: 1200 },
];

function getKitItems(state: WizardState): Array<{ id: string; name: string; priceEur: number; weightG: number; active: boolean }> {
  const items = [
    { id: 'sac', name: 'Sac 45 L', priceEur: 340, weightG: 1200, active: true },
    { id: 'duvet', name: 'Duvet 3 saisons', priceEur: 248, weightG: 680, active: state.step >= 2 },
    { id: 'gourde', name: 'Gourde titane 1 L', priceEur: 68, weightG: 120, active: state.step >= 2 },
    { id: 'veste', name: 'Veste 3 couches', priceEur: 0, weightG: 0, active: state.step >= 3 && (state.meteo === 'frais' || state.meteo === 'pluvieux') },
    { id: 'confort', name: 'Confort à choisir', priceEur: 0, weightG: 0, active: state.step >= 4 && state.confort !== '' },
  ];
  return items;
}

function getKitMeta(state: WizardState) {
  const dureeMap: Record<string, string> = {
    weekend: '2 jours',
    semaine: '7 jours',
    long: '14 jours',
    expedition: '30+ jours',
  };
  const meteoMap: Record<string, string> = {
    sec: 'Sec, chaud',
    frais: 'Frais, brumeux',
    pluvieux: 'Pluvieux, venté',
    froid: 'Froid sec',
  };
  return {
    duree: dureeMap[state.duree] || '—',
    meteo: meteoMap[state.meteo] || '—',
  };
}

// ── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Usage' },
  { id: 2, label: 'Durée' },
  { id: 3, label: 'Météo' },
  { id: 4, label: 'Confort' },
  { id: 5, label: 'Récap' },
];

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={5}>
      {STEPS.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-600 transition-all duration-300 ${
                currentStep > step.id
                  ? 'bg-[#1C2620] text-white'
                  : currentStep === step.id
                  ? 'bg-[#1C2620] text-white ring-2 ring-[#1C2620] ring-offset-2'
                  : 'bg-transparent border border-[#C5BFB0] text-[#8A8478]'
              }`}
            >
              {currentStep > step.id ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span>{step.id}</span>
              )}
            </div>
            <span
              className={`text-xs font-500 hidden sm:block transition-colors ${
                currentStep === step.id ? 'text-[#1C2620]' : 'text-[#8A8478]'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`flex-1 h-px mx-3 transition-all duration-300 ${
                currentStep > step.id ? 'bg-[#1C2620]' : 'bg-[#C5BFB0]'
              }`}
              style={{ minWidth: 20 }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Choice Card ──────────────────────────────────────────────────────────────
interface ChoiceCardProps {
  icon: string;
  title: string;
  titleItalic?: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}

function ChoiceCard({ icon, title, titleItalic, desc, selected, onClick }: ChoiceCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${
        selected
          ? 'border-[#1C2620] bg-white shadow-md'
          : 'border-[#E8E4DA] bg-white hover:border-[#1C2620]/40 hover:shadow-sm'
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg transition-all ${
            selected ? 'bg-[#1C2620] text-white' : 'bg-[#F0EDE5] text-[#1C2620]'
          }`}
        >
          {icon}
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-3">Destinations populaires :</p>
        <div className="flex flex-wrap gap-2">
          {popularDestinations.map((dest) => (
            <button
              key={dest}
              onClick={() => onChange('destination', dest)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                state.destination === dest 
                  ? 'bg-[#405247] text-white shadow-sm' 
                  : 'bg-white border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#405247]/50 hover:bg-[#F4F0EB]'
              }`}
              aria-pressed={state.destination === dest}
            >
              {dest}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl" style={{ background: 'rgba(62,107,122,0.08)', border: '1px solid rgba(62,107,122,0.2)' }}>
        <div className="flex items-start gap-3">
          <Icon name="InformationCircleIcon" size={18} variant="outline" className="text-info flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            L&apos;IA analysera le climat, l&apos;altitude, les risques locaux et la saison pour optimiser votre liste d&apos;équipement.
          </p>
          <p className="text-xs text-[#6B6860] leading-relaxed">{desc}</p>
        </div>
      </div>
    </button>
  );
}

// ── Step 1: Usage ─────────────────────────────────────────────────────────────
function StepUsage({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string) => void }) {
  const choices = [
    { id: 'randonnee', icon: '🥾', title: 'Randonnée', titleItalic: 'légère.', desc: 'Journées, sentiers balisés. On privilégie la légèreté.' },
    { id: 'trekking', icon: '⛺', title: 'Trekking', titleItalic: 'multi-jours.', desc: 'Plusieurs nuits en autonomie. Équilibre poids / confort.' },
    { id: 'alpinisme', icon: '🧗', title: 'Alpinisme', titleItalic: 'technique.', desc: 'Haute montagne, glacier. Sécurité avant tout.' },
    { id: 'voyage', icon: '✈️', title: 'Voyage', titleItalic: 'urbain.', desc: 'Villes, transports, mobilité. Compact et polyvalent.' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-600 text-foreground mb-2">
            Date de départ
          </label>
          <input
            id="start-date"
            type="date"
            value={state.startDate}
            onChange={(e) => onChange('startDate', e.target.value)}
            className="input-field"
            aria-label="Date de départ"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-600 text-foreground mb-2">
            Date de retour
          </label>
          <input
            id="end-date"
            type="date"
            value={state.endDate}
            onChange={(e) => onChange('endDate', e.target.value)}
            className="input-field"
            aria-label="Date de retour"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-600 text-foreground mb-3">Saison principale</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange('season', s.id)}
              className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 ${
                state.season === s.id
                  ? 'border-[#405247] bg-[#405247]/5 shadow-sm scale-[1.02]' : 'border-[#C8C3B0] bg-white hover:border-[#405247]/50 hover:bg-[#F4F0EB]/50'
              }`}
              aria-pressed={state.season === s.id}
            >
              <span className="text-3xl" aria-hidden="true">{s.icon}</span>
              <span className={`font-600 text-sm ${state.season === s.id ? 'text-[#2D3A33]' : 'text-[#5C6B5E]'}`}>{s.label}</span>
              <span className="font-mono text-[10px] text-[#5C6B5E] tracking-widest uppercase">{s.months}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Durée ─────────────────────────────────────────────────────────────
function StepDuree({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string) => void }) {
  const choices = [
    { id: 'weekend', icon: '🌅', title: 'Week-end,', titleItalic: '2–3 jours.', desc: 'Sac léger, minimum vital. On revient vite.' },
    { id: 'semaine', icon: '📅', title: 'Une semaine,', titleItalic: '4–7 jours.', desc: 'Équipement complet, quelques extras.' },
    { id: 'long', icon: '🗺️', title: 'Long séjour,', titleItalic: '1–3 semaines.', desc: 'Polyvalence, recharge, entretien du matériel.' },
    { id: 'expedition', icon: '🏔️', title: 'Expédition,', titleItalic: '1 mois+.', desc: 'Autonomie maximale, matériel professionnel.' },
  ];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-600 text-foreground mb-3">Activité principale</p>
        <div className="flex flex-wrap gap-2">
          {activities.map((act) => (
            <button
              key={act}
              onClick={() => onChange('activity', act)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                state.activity === act 
                  ? 'bg-[#405247] text-white shadow-sm' 
                  : 'bg-white border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#405247]/50 hover:bg-[#F4F0EB]'
              }`}
              aria-pressed={state.activity === act}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-600 text-foreground mb-3">Niveau d&apos;expérience</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {levels.map((lv) => (
            <button
              key={lv.id}
              onClick={() => onChange('level', lv.id)}
              className={`flex flex-col gap-2 p-5 rounded-2xl border-2 text-left transition-all duration-300 ${
                state.level === lv.id
                  ? 'border-[#405247] bg-[#405247]/5 shadow-sm scale-[1.02]' : 'border-[#C8C3B0] bg-white hover:border-[#405247]/50 hover:bg-[#F4F0EB]/50'
              }`}
              aria-pressed={state.level === lv.id}
            >
              <span className={`font-600 text-sm ${state.level === lv.id ? 'text-[#2D3A33]' : 'text-[#5C6B5E]'}`}>{lv.label}</span>
              <span className="text-xs text-[#5C6B5E]/80 leading-snug">{lv.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <label htmlFor="max-weight" className="text-sm font-600 text-[#2D3A33]">
              Poids max du sac
            </label>
            <span className="font-mono text-sm text-[#405247] font-bold bg-[#405247]/10 px-3 py-1 rounded-lg">
              {state.maxWeightG >= 1000 ? `${(state.maxWeightG / 1000).toFixed(1)} kg` : `${state.maxWeightG} g`}
            </span>
          </div>
          <input
            id="max-weight"
            type="range"
            min={3000}
            max={20000}
            step={500}
            value={state.maxWeightG}
            onChange={(e) => onChange('maxWeightG', Number(e.target.value))}
            className="range-slider w-full"
            aria-label={`Poids maximum: ${state.maxWeightG} grammes`}
          />
          <div className="flex justify-between mt-1">
            <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>3 kg</span>
            <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>20 kg</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label htmlFor="budget" className="text-sm font-600 text-[#2D3A33]">
              Budget équipement
            </label>
            <span className="font-mono text-sm text-[#405247] font-bold bg-[#405247]/10 px-3 py-1 rounded-lg">
              {state.budgetEur} €
            </span>
          </div>
          <input
            id="budget"
            type="range"
            min={50}
            max={2000}
            step={50}
            value={state.budgetEur}
            onChange={(e) => onChange('budgetEur', Number(e.target.value))}
            className="range-slider w-full"
            aria-label={`Budget: ${state.budgetEur} euros`}
          />
          <div className="flex justify-between mt-1">
            <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>50 €</span>
            <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>2 000 €</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Météo ─────────────────────────────────────────────────────────────
function StepMeteo({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string) => void }) {
  const choices = [
    { id: 'sec', icon: '☀️', title: 'Sec et', titleItalic: 'chaud.', desc: '15 à 25 °C, faible humidité. On priorise la respirabilité.' },
    { id: 'frais', icon: '🌫️', title: 'Frais et', titleItalic: 'brumeux.', desc: '5 à 15 °C avec humidité. Notre configuration par défaut.' },
    { id: 'pluvieux', icon: '🌧️', title: 'Pluvieux et', titleItalic: 'venté.', desc: '0 à 10 °C, précipitations fréquentes. Coques imper renforcées.' },
    { id: 'froid', icon: '❄️', title: 'Froid', titleItalic: 'sec.', desc: '−5 à 5 °C. Duvet gonflant, base couche lourde.' },
  ];
  return (
    <div className="space-y-3">
      {choices.map((c) => (
        <ChoiceCard
          key={c.id}
          icon={c.icon}
          title={c.title}
          titleItalic={c.titleItalic}
          desc={c.desc}
          selected={state.meteo === c.id}
          onClick={() => onChange('meteo', c.id)}
        />
      ))}
    </div>
  );
}

// ── Step 4: Confort ───────────────────────────────────────────────────────────
function StepConfort({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string) => void }) {
  const choices = [
    { id: 'ultralight', icon: '🪶', title: 'Ultra-léger,', titleItalic: 'minimaliste.', desc: 'Chaque gramme compte. On coupe le superflu.' },
    { id: 'equilibre', icon: '⚖️', title: 'Équilibré,', titleItalic: 'confortable.', desc: 'Bon compromis poids / confort. Notre recommandation.' },
    { id: 'confort', icon: '🛋️', title: 'Confort', titleItalic: 'maximal.', desc: 'Matelas épais, cuisine complète. Le poids passe après.' },
    { id: 'securite', icon: '🛡️', title: 'Sécurité', titleItalic: 'renforcée.', desc: 'Trousse médicale complète, équipement de secours.' },
  ];
  return (
    <div className="space-y-3">
      {choices.map((c) => (
        <ChoiceCard
          key={c.id}
          icon={c.icon}
          title={c.title}
          titleItalic={c.titleItalic}
          desc={c.desc}
          selected={state.confort === c.id}
          onClick={() => onChange('confort', c.id)}
        />
      ))}
    </div>
  );
}

// ── Step 5: Récap + AI ────────────────────────────────────────────────────────
function StepRecap({ state }: { state: WizardState }) {
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const fetchAI = async () => {
      setLoading(true);
      setAiError(null);

      const usageMap: Record<string, string> = { randonnee: 'randonnée légère', trekking: 'trekking multi-jours', alpinisme: 'alpinisme technique', voyage: 'voyage urbain' };
      const dureeMap: Record<string, string> = { weekend: '2-3 jours', semaine: '4-7 jours', long: '1-3 semaines', expedition: '1 mois+' };
      const meteoMap: Record<string, string> = { sec: 'sec et chaud (15-25°C)', frais: 'frais et brumeux (5-15°C)', pluvieux: 'pluvieux et venté (0-10°C)', froid: 'froid sec (-5 à 5°C)' };
      const confortMap: Record<string, string> = { ultralight: 'ultra-léger minimaliste', equilibre: 'équilibré confortable', confort: 'confort maximal', securite: 'sécurité renforcée' };

      const systemPrompt = `Tu es un expert en équipement outdoor. Génère une liste d'équipement optimisée. Réponds UNIQUEMENT avec un JSON valide, sans markdown.
Structure exacte:
{"sac_recommande":"string","poids_total_g":number,"budget_estime_eur":number,"alertes":["string"],"liste_equipement":[{"id":"string","name":"string","category":"string","weightG":number,"priceEur":number,"essential":boolean,"already_owned":false}]}`;

      const userPrompt = `Génère une liste pour:
- Usage: ${usageMap[state.usage] || state.usage}
- Durée: ${dureeMap[state.duree] || state.duree}
- Météo: ${meteoMap[state.meteo] || state.meteo}
- Confort: ${confortMap[state.confort] || state.confort}
Génère 8-12 articles pertinents avec prix et poids réalistes.`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await getChatCompletion('GEMINI', 'gemini/gemini-2.5-flash', [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], { temperature: 0.7, max_tokens: 3000 }) as any;

        const content = response?.choices?.[0]?.message?.content ?? '';
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let jsonString = cleaned;
        try { JSON.parse(jsonString); } catch {
          const ob = (jsonString.match(/\{/g) || []).length - (jsonString.match(/\}/g) || []).length;
          const obr = (jsonString.match(/\[/g) || []).length - (jsonString.match(/\]/g) || []).length;
          jsonString = jsonString.replace(/,\s*$/, '');
          for (let i = 0; i < obr; i++) jsonString += ']';
          for (let i = 0; i < ob; i++) jsonString += '}';
        }
        const parsed: AIResult = JSON.parse(jsonString);
        if (!parsed.liste_equipement || !Array.isArray(parsed.liste_equipement)) throw new Error('Format invalide');
        const essentialIds = new Set(parsed.liste_equipement.filter(i => i.essential && !i.already_owned).map(i => i.id));
        setAiResult(parsed);
        setSelectedItems(essentialIds);

        if (user) {
          try {
            const supabase = createClient();
            const { data: kit } = await supabase.from('kits').insert({
              user_id: user.id,
              name: `Kit ${usageMap[state.usage] || 'Voyage'} — ${meteoMap[state.meteo] || ''}`,
              season: state.meteo,
              activity: state.usage,
              total_weight_g: parsed.poids_total_g,
              total_price_eur: parsed.budget_estime_eur,
              bag_recommended: parsed.sac_recommande,
              source: 'ai_configurator',
            }).select('id').single();
            if (kit) {
              const kitItems = parsed.liste_equipement.filter(i => essentialIds.has(i.id)).map(item => ({
                kit_id: kit.id, name: item.name, category: item.category, weight_g: item.weightG, price_eur: item.priceEur, essential: item.essential,
              }));
              if (kitItems.length > 0) await supabase.from('kit_items').insert(kitItems);
            }
          } catch { /* silent */ }
        }
      } catch (err) {
        console.error('AI configurator error:', err);
        setAiError('Impossible de générer la liste. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    fetchAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  const toggleItem = (id: string) => {
    setSelectedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const missingItems = (aiResult?.liste_equipement ?? []).filter(i => !i.already_owned);
  const totalWeightG = missingItems.filter(i => selectedItems.has(i.id)).reduce((s, i) => s + i.weightG, 0);
  const totalPriceEur = missingItems.filter(i => selectedItems.has(i.id)).reduce((s, i) => s + i.priceEur, 0);
  const categories = Array.from(new Set((aiResult?.liste_equipement ?? []).map(i => i.category)));

  const handleAddToCart = () => {
    const itemsToAdd = missingItems.filter(i => selectedItems.has(i.id));
    if (!itemsToAdd.length) return;
    const existing = getCart();
    itemsToAdd.forEach(item => {
      const idx = existing.findIndex(e => e.id === item.id);
      if (idx >= 0) existing[idx].quantity += 1;
      else existing.push({ id: item.id, slug: item.id, name: item.name, brand: '', category: item.category, priceEur: item.priceEur, weightG: item.weightG, image: '', imageAlt: item.name, quantity: 1 });
    });
    saveCart(existing);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-12 h-12 rounded-full border-2 border-[#1C2620] border-t-transparent animate-spin" />
        <p className="text-sm text-[#6B6860] font-500">Composition de votre kit en cours…</p>
      </div>
    );
  }

  if (aiError) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-[#1C2620] font-600">{aiError}</p>
        <button onClick={() => { setAiError(null); setRetryCount(c => c + 1); }} className="px-6 py-3 bg-[#1C2620] text-white rounded-xl text-sm font-600 hover:bg-[#2A3830] transition-colors">
          Réessayer
        </button>
      </div>
    );
  }

  if (!aiResult) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sac recommandé', val: aiResult.sac_recommande },
          { label: 'Poids total', val: `${(totalWeightG / 1000).toFixed(2)} kg` },
          { label: 'Budget', val: `${totalPriceEur} €` },
          { label: 'Articles', val: `${missingItems.filter(i => selectedItems.has(i.id)).length}` },
        ].map(({ label, val }) => (
          <div key={label} className="bg-[#F5F2EC] rounded-xl p-4">
            <p className="text-[10px] text-[#8A8478] uppercase tracking-widest mb-1">{label}</p>
            <p className="font-700 text-[#1C2620] text-sm">{val}</p>
          </div>
        ))}
      </div>

      {aiResult.alertes.length > 0 && (
        <div className="space-y-2">
          {aiResult.alertes.map((alert, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-amber-600 text-sm flex-shrink-0 mt-0.5">⚠</span>
              <p className="text-sm text-[#1C2620]">{alert}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {categories.map(cat => {
          const catItems = missingItems.filter(i => i.category === cat);
          if (!catItems.length) return null;
          return (
            <div key={cat}>
              <p className="text-[10px] text-[#8A8478] uppercase tracking-widest mb-2">{cat}</p>
              <div className="space-y-2">
                {catItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedItems.has(item.id) ? 'border-[#1C2620]/30 bg-[#1C2620]/5' : 'border-[#E8E4DA] opacity-50'
                    }`}
                    onClick={() => toggleItem(item.id)}
                    role="checkbox"
                    aria-checked={selectedItems.has(item.id)}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') toggleItem(item.id); }}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${selectedItems.has(item.id) ? 'bg-[#1C2620] border-[#1C2620]' : 'border-[#C5BFB0]'}`}>
                      {selectedItems.has(item.id) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-500 text-[#1C2620] truncate">{item.name}</p>
                      {item.essential && <span className="text-[9px] text-[#4A6355] font-600 uppercase tracking-wider">Essentiel</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-[#6B6860]">{item.weightG} g</span>
                      <span className="text-xs font-600 text-[#1C2620]">{item.priceEur} €</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button onClick={handleAddToCart} className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#1C2620] text-white rounded-xl font-600 text-sm hover:bg-[#2A3830] transition-colors">
          <Icon name="ShoppingBagIcon" size={18} variant="outline" />
          Ajouter ce qui manque — {totalPriceEur} €
        </button>
        <Link href="/catalogue" className="flex items-center justify-center gap-2 py-4 px-6 border-2 border-[#1C2620] text-[#1C2620] rounded-xl font-600 text-sm hover:bg-[#1C2620]/5 transition-colors">
          Voir le catalogue
        </Link>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl bg-[#1C2620] text-white" role="alert">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p className="text-sm font-500">{missingItems.filter(i => selectedItems.has(i.id)).length} articles ajoutés au panier</p>
        </div>
      )}
    </div>
  );
}

// ── Right Panel: Kit en construction ─────────────────────────────────────────
function KitPanel({ state }: { state: WizardState }) {
  const kitItems = getKitItems(state);
  const meta = getKitMeta(state);
  const activeItems = kitItems.filter(i => i.active && i.priceEur > 0);
  const totalPrice = activeItems.reduce((s, i) => s + i.priceEur, 0);
  const totalWeight = activeItems.reduce((s, i) => s + i.weightG, 0);

  return (
    <div
      className="relative h-full min-h-[500px] rounded-2xl overflow-hidden flex flex-col"
      style={{ background: '#1C2620' }}
    >
      {/* Background texture */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=60')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(40%)',
          }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(28,38,32,0.7) 0%, rgba(28,38,32,0.85) 100%)' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7CB99A] animate-pulse" />
            <span className="text-[10px] font-600 text-[#7CB99A] uppercase tracking-widest">Votre sac en construction</span>
          </div>
          <h2 className="text-white font-700 leading-tight" style={{ fontFamily: 'var(--font-display, Manrope, sans-serif)', fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
            Un kit <em className="text-[#7CB99A]" style={{ fontStyle: 'italic', fontWeight: 400 }}>en cours</em>
            <br />de composition.
          </h2>
          <p className="text-white/50 text-sm mt-3 leading-relaxed">
            On assemble en temps réel. Vous pourrez tout modifier à l&apos;étape finale — ou tout jeter et recommencer.
          </p>
        </div>

        {/* Items list */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Contenu · {activeItems.length} pièces</span>
            <span className="text-[10px] text-white/40 font-600">{(totalWeight / 1000).toFixed(1)} KG</span>
          </div>

          <div className="space-y-2">
            {kitItems.map(item => (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2.5 border-b transition-all duration-300 ${
                  item.active && item.priceEur > 0
                    ? 'border-white/10 opacity-100' :'border-white/5 opacity-25'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${item.active && item.priceEur > 0 ? 'bg-[#4A6355]' : 'bg-white/10'}`}>
                    {item.active && item.priceEur > 0 && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </div>
                  <span className={`text-sm font-500 ${item.active && item.priceEur > 0 ? 'text-white' : 'text-white/30'}`}>{item.name}</span>
                </div>
                {item.priceEur > 0 && (
                  <span className={`text-sm font-600 ${item.active ? 'text-white' : 'text-white/30'}`}>{item.priceEur} €</span>
                )}
                {item.priceEur === 0 && item.active && (
                  <span className="text-xs text-white/40 italic">à choisir</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sous-total */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Sous-total</span>
            <span className="text-2xl font-700 text-white">{totalPrice} <span className="text-[#7CB99A]">€</span></span>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Adapté pour', val: meta.duree || '—', italic: true },
              { label: 'Météo', val: meta.meteo || '—', italic: true },
              { label: 'Poids total', val: totalWeight > 0 ? `${(totalWeight / 1000).toFixed(1)} kg` : '—', italic: false },
              { label: 'Livraison', val: 'Sous 48 h', italic: true },
            ].map(({ label, val, italic }) => (
              <div key={label}>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
                <p className={`text-sm text-white font-500 ${italic ? 'italic' : ''}`}>{val}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-white/30 mt-4 leading-relaxed">
            Le sac se met à jour à chaque étape.<br />Vous pourrez tout retirer avant paiement.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Recap Bottom Sheet ─────────────────────────────────────────────────
function MobileRecapSheet({ state, open, onToggle }: { state: WizardState; open: boolean; onToggle: () => void }) {
  const kitItems = getKitItems(state);
  const activeItems = kitItems.filter(i => i.active && i.priceEur > 0);
  const totalPrice = activeItems.reduce((s, i) => s + i.priceEur, 0);
  const totalWeight = activeItems.reduce((s, i) => s + i.weightG, 0);

  return (
    <>
      {/* Sticky bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        style={{ background: '#1C2620' }}
      >
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-5 py-4"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-600 text-white uppercase tracking-wider">Votre sac</span>
            <span className="text-xs text-white/50">· {activeItems.length} pièces</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-700 text-white">{(totalWeight / 1000).toFixed(1)} KG · {totalPrice} €</span>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              className={`text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            >
              <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Expanded sheet */}
        <div
          className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96' : 'max-h-0'}`}
          style={{ background: '#1C2620' }}
        >
          <div className="px-5 pb-6 space-y-2 border-t border-white/10 pt-4">
            {kitItems.map(item => (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2 border-b border-white/5 transition-all ${item.active && item.priceEur > 0 ? 'opacity-100' : 'opacity-25'}`}
              >
                <span className="text-sm text-white font-500">{item.name}</span>
                {item.priceEur > 0 && <span className="text-sm font-600 text-white">{item.priceEur} €</span>}
              </div>
            ))}
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">Total</span>
              <span className="text-lg font-700 text-white">{totalPrice} €</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Step question labels ──────────────────────────────────────────────────────
const STEP_META = [
  {
    num: '01',
    label: 'USAGE · SÉLECTIONNEZ UNE RÉPONSE',
    title: 'Quel usage',
    titleItalic: 'vous attend ?',
    desc: 'On adapte le volume, la structure et les compartiments. Une seule réponse : votre usage principal.',
  },
  {
    num: '02',
    label: 'DURÉE · SÉLECTIONNEZ UNE RÉPONSE',
    title: 'Combien de temps',
    titleItalic: 'partez-vous ?',
    desc: 'On adapte la quantité de vêtements, la capacité de stockage et l\'autonomie alimentaire.',
  },
  {
    num: '03',
    label: 'MÉTÉO ATTENDUE · SÉLECTIONNEZ UNE RÉPONSE',
    title: 'Quelle météo',
    titleItalic: 'vous attend ?',
    desc: 'On adapte l\'épaisseur du duvet, la respirabilité de la veste et la sensibilité de vos couches. Une seule réponse : la plus fréquente.',
  },
  {
    num: '04',
    label: 'CONFORT · SÉLECTIONNEZ UNE RÉPONSE',
    title: 'Quel niveau de',
    titleItalic: 'confort ?',
    desc: 'On ajuste le matelas, la cuisine de camp et les accessoires de confort selon votre philosophie.',
  },
  {
    num: '05',
    label: 'RÉCAPITULATIF · VOTRE KIT COMPLET',
    title: 'Votre kit',
    titleItalic: 'est prêt.',
    desc: 'L\'IA a composé votre liste sur mesure. Ajustez les articles, puis ajoutez au panier.',
  },
];

// ── Main Wizard ──────────────────────────────────────────────────────────────
export default function ConfiguratorWizard() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    usage: '',
    duree: '',
    meteo: '',
    confort: '',
    destination: '',
    generated: false,
  });
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const update = (key: keyof WizardState, val: string) => {
    setState(prev => ({ ...prev, [key]: val }));
  };

  const canAdvance = () => {
    if (state.step === 1) return state.usage !== '';
    if (state.step === 2) return state.duree !== '';
    if (state.step === 3) return state.meteo !== '';
    if (state.step === 4) return state.confort !== '';
    return true;
  };

  const advance = () => {
    if (state.step < 5) {
      setState(prev => ({ ...prev, step: prev.step + 1 }));
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const back = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: prev.step - 1 }));
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const stepMeta = STEP_META[state.step - 1];
  const nextLabel = state.step === 4 ? 'Générer mon kit' : `Continuer vers ${STEPS[state.step]?.label || ''}`;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F0EB] flex flex-col-reverse lg:flex-row">
      {/* LEFT COLUMN: Steps (Clair) */}
      <div className="flex-1 lg:w-7/12 relative pb-20">
        <div ref={topRef} className="max-w-3xl mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
          
          <div className="mb-10">
            <h1 className="text-3xl font-display font-400 text-[#2D3A33] mb-2 italic">Préparez votre équipement</h1>
            <p className="text-[#5C6B5E]">L&apos;IA génère votre liste en fonction des risques et du climat local.</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center mb-10" role="progressbar" aria-valuenow={state.step} aria-valuemin={1} aria-valuemax={4} aria-label={`Étape ${state.step} sur 4`}>
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs transition-colors ${state.step === step.id ? 'bg-[#405247] text-white border-2 border-[#405247]' : state.step > step.id ? 'bg-[#6B705C] text-white border-2 border-[#6B705C]' : 'bg-transparent border-2 border-[#C8C3B0] text-[#5C6B5E]'}`}>
                    {state.step > step.id ? (
                      <Icon name="CheckIcon" size={14} variant="outline" className="text-white" />
                    ) : (
                      <span>{step.id}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono uppercase tracking-widest hidden sm:block ${state.step === step.id ? 'text-[#405247]' : 'text-[#5C6B5E]'}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${state.step > step.id ? 'bg-[#6B705C]' : 'bg-[#C8C3B0]'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step card */}
          <div className="bg-white border border-[#C8C3B0] rounded-3xl p-6 sm:p-10 shadow-sm">
            {/* Step header */}
            <div className="mb-8 pb-6 border-b border-[#C8C3B0]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#405247]/10 text-[#405247]">
                  <Icon
                    name={
                      state.step === 1 ? 'MapPinIcon' :
                      state.step === 2 ? 'CalendarDaysIcon' :
                      state.step === 3 ? 'UserCircleIcon' : 'SparklesIcon'
                    }
                    size={20}
                    variant="outline"
                  />
                </div>
                <div>
                  <p className="font-mono text-[10px] text-[#5C6B5E] uppercase tracking-widest">
                    Étape {state.step} sur 4
                  </p>
                  <h2 className="font-display font-400 text-[#2D3A33] text-2xl mt-1">
                    {STEPS[state.step - 1].label}
                  </h2>
                </div>
              </div>
            </div>

            {/* Step content */}
            <div className="overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  {state.step === 1 && <StepDestination state={state} onChange={update} />}
                  {state.step === 2 && <StepDates state={state} onChange={update} />}
                  {state.step === 3 && <StepProfile state={state} onChange={update} />}
                  {state.step === 4 && <StepResult state={state} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation buttons */}
            {state.step < 4 && (
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#C8C3B0]">
                <button
                  onClick={back}
                  disabled={state.step === 1}
                  className="flex items-center gap-2 py-3 px-6 text-sm text-[#5C6B5E] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F4F0EB] rounded-xl transition-colors"
                  aria-label="Étape précédente"
                >
                  <Icon name="ArrowLeftIcon" size={16} variant="outline" />
                  Retour
                </button>
                <button
                  onClick={advance}
                  disabled={!canAdvance()}
                  className="flex items-center gap-2 bg-[#2D3A33] text-white py-3 px-8 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#405247] transition-all active:scale-95 shadow-sm"
                  aria-label="Étape suivante"
                >
                  {state.step === 3 ? (
                    <>
                      <Icon name="SparklesIcon" size={16} variant="outline" />
                      Générer ma liste
                    </>
                  ) : (
                    <>
                      Continuer
                      <Icon name="ArrowRightIcon" size={16} variant="outline" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          <p className="text-center text-[10px] font-mono text-[#5C6B5E] mt-8 uppercase tracking-widest">
            IA Propulsée par Gemini 2.5 Flash
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Context Panel (Vert) */}
      <div className="lg:w-5/12 bg-[#2D3A33] lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden relative border-l border-[#405247]">
        {/* Topographic background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="topo-conf" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M0,50 C25,25 75,75 100,50" fill="none" stroke="#E5D7C1" strokeWidth="1" />
                <path d="M0,80 C25,55 75,105 100,80" fill="none" stroke="#E5D7C1" strokeWidth="1" />
                <path d="M0,20 C25,-5 75,45 100,20" fill="none" stroke="#E5D7C1" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-conf)" />
          </svg>
        </div>
        
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 flex-1 flex flex-col">
          <div className="mb-12">
            <div className="w-12 h-12 bg-[#405247] rounded-2xl flex items-center justify-center mb-6 border border-[#6B705C]">
              <Icon name="SparklesIcon" size={24} className="text-[#E5D7C1]" />
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-300 text-[#F4F0EB] leading-[1.1] italic mb-4">
              Intelligence<br/>Outdoor
            </h2>
            <p className="text-[#E5D7C1] font-300">
              Notre algorithme croise la météo historique, l&apos;altimétrie et les recommandations des experts pour construire votre kit parfait.
            </p>
          </div>

          <div className="mt-auto space-y-4">
            {/* Dynamic summary based on state */}
            <div className="bg-[#405247]/40 backdrop-blur-md rounded-2xl p-6 border border-[#6B705C]/30">
              <p className="font-mono text-[10px] text-[#E5D7C1] uppercase tracking-widest mb-4">Configuration en cours</p>
              
              <ul className="space-y-4">
                <li className="flex items-center justify-between">
                  <span className="text-sm text-[#F4F0EB]/70 flex items-center gap-2"><Icon name="MapPinIcon" size={14}/> Destination</span>
                  <span className="font-mono text-sm text-[#F4F0EB] font-bold">{state.destination || '—'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-sm text-[#F4F0EB]/70 flex items-center gap-2"><Icon name="CalendarDaysIcon" size={14}/> Saison</span>
                  <span className="font-mono text-sm text-[#F4F0EB] font-bold">{state.season ? state.season.charAt(0).toUpperCase() + state.season.slice(1) : '—'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-sm text-[#F4F0EB]/70 flex items-center gap-2"><Icon name="UserCircleIcon" size={14}/> Profil</span>
                  <span className="font-mono text-sm text-[#F4F0EB] font-bold">{state.activity || '—'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-sm text-[#F4F0EB]/70 flex items-center gap-2"><Icon name="ScaleIcon" size={14}/> Poids max</span>
                  <span className="font-mono text-sm text-[#E5D7C1] font-bold">{state.maxWeightG >= 1000 ? `${(state.maxWeightG / 1000).toFixed(1)} kg` : `${state.maxWeightG} g`}</span>
                </li>
              </ul>
            </div>
            
            {state.generated && (
              <div className="flex items-center justify-center gap-2 text-[#E5D7C1] mt-4">
                <span className="w-2 h-2 rounded-full bg-[#E5D7C1] animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest">Analyse terminée</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {state.step < 5 && (
        <MobileRecapSheet
          state={state}
          open={mobileSheetOpen}
          onToggle={() => setMobileSheetOpen(o => !o)}
        />
      )}
    </div>
  );
}