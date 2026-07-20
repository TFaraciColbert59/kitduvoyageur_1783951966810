'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import WeightGauge from '@/components/WeightGauge';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { getCart, saveCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface WizardState {
  step: number;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  season: string;
  activity: string;
  level: string;
  maxWeightG: number;
  budgetEur: number;
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

interface GearInventoryItem {
  id: string;
  name: string;
  category: string;
  condition: string;
  weight_g: number;
}

// ── Altimeter Loader ─────────────────────────────────────────────────────────────
function AltimeterLoader({ active }: { active: boolean }) {
  const [digits, setDigits] = useState([0, 0, 0, 0]);

  useEffect(() => {
    if (!active) return;
    let frame: ReturnType<typeof setTimeout>;
    let count = 0;
    const tick = () => {
      count++;
      setDigits([
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
      ]);
      if (count < 20) {
        frame = setTimeout(tick, 80);
      } else {
        setDigits([2, 4, 5, 0]);
      }
    };
    frame = setTimeout(tick, 80);
    return () => clearTimeout(frame);
  }, [active]);

  if (!active) return null;

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6" role="status" aria-live="polite" aria-label="Génération de votre liste en cours">
      <div className="flex items-center gap-1">
        {digits.map((d, i) => (
          <span key={i} className="font-mono-data text-4xl font-600" style={{ color: 'var(--info)', fontFamily: 'var(--font-mono)' }}>
            {d}
          </span>
        ))}
        <span className="font-mono-data text-2xl text-muted-foreground ml-1" style={{ fontFamily: 'var(--font-mono)' }}>m</span>
      </div>
      <p className="text-sm text-muted-foreground font-mono-data uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
        Analyse IA en cours…
      </p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: `pulseOrange 1.2s ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────────────────────────────
function StepDestination({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string | number | boolean) => void }) {
  const popularDestinations = ['Islande', 'Maroc', 'Japon', 'Pérou', 'Norvège', 'Nouvelle-Zélande'];

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="destination" className="block text-sm font-600 text-foreground mb-2">
          Destination ou région
        </label>
        <div className="relative">
          <Icon name="MagnifyingGlassIcon" size={18} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="destination"
            type="text"
            value={state.destination}
            onChange={(e) => onChange('destination', e.target.value)}
            placeholder="Ex: Islande, GR20, Patagonie…"
            className="input-field pl-10"
            aria-label="Entrez votre destination"
          />
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-3">Destinations populaires :</p>
        <div className="flex flex-wrap gap-2">
          {popularDestinations.map((dest) => (
            <button
              key={dest}
              onClick={() => onChange('destination', dest)}
              className={`category-pill text-sm ${state.destination === dest ? 'active' : ''}`}
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
        </div>
      </div>
    </div>
  );
}

function StepDates({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string | number | boolean) => void }) {
  const seasons = [
    { id: 'printemps', label: 'Printemps', icon: '🌸', months: 'Mar – Mai' },
    { id: 'ete', label: 'Été', icon: '☀️', months: 'Juin – Août' },
    { id: 'automne', label: 'Automne', icon: '🍂', months: 'Sep – Nov' },
    { id: 'hiver', label: 'Hiver', icon: '❄️', months: 'Déc – Fév' },
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange('season', s.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                state.season === s.id
                  ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
              }`}
              aria-pressed={state.season === s.id}
            >
              <span className="text-2xl" aria-hidden="true">{s.icon}</span>
              <span className="font-600 text-sm text-foreground">{s.label}</span>
              <span className="font-mono-data text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{s.months}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepProfile({ state, onChange }: { state: WizardState; onChange: (k: keyof WizardState, v: string | number | boolean) => void }) {
  const activities = ['Randonnée', 'Alpinisme', 'Camping', 'Vanlife', 'Trekking', 'Photo nature', 'Sports eau'];
  const levels = [
    { id: 'debutant', label: 'Débutant', desc: 'Premiers pas en outdoor' },
    { id: 'intermediaire', label: 'Intermédiaire', desc: 'Quelques expériences' },
    { id: 'confirme', label: 'Confirmé', desc: 'Pratique régulière' },
    { id: 'expert', label: 'Expert', desc: 'Expéditions avancées' },
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
              className={`category-pill ${state.activity === act ? 'active' : ''}`}
              aria-pressed={state.activity === act}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-600 text-foreground mb-3">Niveau d&apos;expérience</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {levels.map((lv) => (
            <button
              key={lv.id}
              onClick={() => onChange('level', lv.id)}
              className={`flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                state.level === lv.id
                  ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
              }`}
              aria-pressed={state.level === lv.id}
            >
              <span className="font-600 text-sm text-foreground">{lv.label}</span>
              <span className="text-xs text-muted-foreground">{lv.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="max-weight" className="text-sm font-600 text-foreground">
              Poids max du sac
            </label>
            <span className="font-mono-data text-sm text-info font-600" style={{ fontFamily: 'var(--font-mono)' }}>
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
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="budget" className="text-sm font-600 text-foreground">
              Budget équipement
            </label>
            <span className="font-mono-data text-sm text-info font-600" style={{ fontFamily: 'var(--font-mono)' }}>
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

// ── Step Result with Gemini AI ──────────────────────────────────────────────────
function StepResult({ state }: { state: WizardState }) {
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [autoSaved, setAutoSaved] = useState(false);
  const [userInventory, setUserInventory] = useState<GearInventoryItem[]>([]);
  const { user } = useAuth();

  // Load user inventory before generating
  useEffect(() => {
    const loadInventory = async () => {
      if (!user) return;
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('gear_items')
          .select('id, name, category, condition, weight_g')
          .eq('user_id', user.id)
          .neq('condition', 'à_remplacer');
        setUserInventory(data ?? []);
      } catch {
        // Silent fail
      }
    };
    loadInventory();
  }, [user]);

  const autoSaveKit = async (result: AIResult, selected: Set<string>) => {
    if (!user) return;
    try {
      const supabase = createClient();
      const kitName = `Kit ${state.destination || 'Voyage'} — ${state.season || 'Toutes saisons'}`;
      const { data: kit, error: kitError } = await supabase
        .from('kits')
        .insert({
          user_id: user.id,
          name: kitName,
          destination: state.destination,
          season: state.season,
          activity: state.activity,
          total_weight_g: result.liste_equipement.filter(i => selected.has(i.id) && !i.already_owned).reduce((s, i) => s + i.weightG, 0),
          total_price_eur: result.liste_equipement.filter(i => selected.has(i.id) && !i.already_owned).reduce((s, i) => s + i.priceEur, 0),
          bag_recommended: result.sac_recommande,
          source: 'ai_configurator',
        })
        .select('id')
        .single();

      if (kitError || !kit) return;

      const kitItems = result.liste_equipement
        .filter(i => selected.has(i.id))
        .map(item => ({
          kit_id: kit.id,
          name: item.name,
          category: item.category,
          weight_g: item.weightG,
          price_eur: item.priceEur,
          essential: item.essential,
        }));

      if (kitItems.length > 0) {
        await supabase.from('kit_items').insert(kitItems);
      }
      setAutoSaved(true);
    } catch (_e) {
      // Silent fail — auto-save is best-effort
    }
  };

  useEffect(() => {
    const fetchAI = async () => {
      setLoading(true);
      setAiError(null);
      setAutoSaved(false);

      // Build inventory context for the prompt
      const inventoryContext = userInventory.length > 0
        ? `\n\nL'utilisateur possède déjà ces équipements (ne pas proposer à l'achat si la catégorie correspond) :\n${userInventory.map(g => `- ${g.name} (catégorie: ${g.category}, état: ${g.condition})`).join('\n')}\n\nPour chaque article nécessaire : si un équivalent existe dans cet inventaire (même catégorie, état pas "à_remplacer"), marque-le "already_owned": true. Ne propose à l'achat que ce qui manque réellement.`
        : '';

      const systemPrompt = `Tu es un expert en équipement outdoor et randonnée. Tu génères des listes d'équipement optimisées pour les voyageurs. 
Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans texte avant ou après.
Le JSON doit avoir exactement cette structure:
{
  "sac_recommande": "string",
  "poids_total_g": number,
  "budget_estime_eur": number,
  "alertes": ["string"],
  "liste_equipement": [
    {
      "id": "string",
      "name": "string",
      "category": "string",
      "weightG": number,
      "priceEur": number,
      "essential": boolean,
      "already_owned": boolean
    }
  ]
}`;

      const userPrompt = `Génère une liste d'équipement optimisée pour:
- Destination: ${state.destination}
- Saison: ${state.season}
- Activité: ${state.activity}
- Niveau: ${state.level}
- Poids max du sac: ${(state.maxWeightG / 1000).toFixed(1)} kg
- Budget max: ${state.budgetEur} €
${state.startDate ? `- Dates: ${state.startDate} au ${state.endDate}` : ''}
${inventoryContext}

Génère entre 8 et 14 articles d'équipement pertinents. Inclus des alertes spécifiques à la destination et à la saison. Recommande un sac adapté.`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await getChatCompletion('GEMINI', 'gemini/gemini-2.5-flash', [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], { temperature: 0.7, max_tokens: 4000 }) as any;

        const content = response?.choices?.[0]?.message?.content ?? '';
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let jsonString = cleaned;
        try {
          JSON.parse(jsonString);
        } catch {
          const openBraces = (jsonString.match(/\{/g) || []).length - (jsonString.match(/\}/g) || []).length;
          const openBrackets = (jsonString.match(/\[/g) || []).length - (jsonString.match(/\]/g) || []).length;
          jsonString = jsonString.replace(/,\s*$/, '').replace(/,\s*\{[^}]*$/, '');
          for (let i = 0; i < openBrackets; i++) jsonString += ']';
          for (let i = 0; i < openBraces; i++) jsonString += '}';
        }

        const parsed: AIResult = JSON.parse(jsonString);

        if (!parsed.liste_equipement || !Array.isArray(parsed.liste_equipement)) {
          throw new Error('Format de réponse invalide');
        }

        // Pre-select essential items that are NOT already owned
        const essentialIds = new Set(
          parsed.liste_equipement
            .filter((i) => i.essential && !i.already_owned)
            .map((i) => i.id)
        );
        setAiResult(parsed);
        setSelectedItems(essentialIds);

        // Auto-save for connected users
        await autoSaveKit(parsed, essentialIds);
      } catch (err) {
        console.error('AI configurator error:', err);
        setAiError('Impossible de générer la liste. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };

    fetchAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, userInventory]);

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Only count items NOT already owned for price/weight
  const missingItems = (aiResult?.liste_equipement ?? []).filter((i) => !i.already_owned);
  const ownedItems = (aiResult?.liste_equipement ?? []).filter((i) => i.already_owned);

  const totalWeightG = missingItems
    .filter((i) => selectedItems.has(i.id))
    .reduce((sum, i) => sum + i.weightG, 0);

  const totalPriceEur = missingItems
    .filter((i) => selectedItems.has(i.id))
    .reduce((sum, i) => sum + i.priceEur, 0);

  const categories = Array.from(new Set((aiResult?.liste_equipement ?? []).map((i) => i.category)));

  // Readiness score: owned essentials / total essentials
  const totalEssentials = (aiResult?.liste_equipement ?? []).filter(i => i.essential).length;
  const ownedEssentials = (aiResult?.liste_equipement ?? []).filter(i => i.essential && i.already_owned).length;
  const readinessScore = totalEssentials > 0 ? Math.round((ownedEssentials / totalEssentials) * 100) : 0;
  const missingEssentials = totalEssentials - ownedEssentials;

  const handleAddToCart = () => {
    const itemsToAdd = missingItems.filter((i) => selectedItems.has(i.id));
    if (itemsToAdd.length === 0) return;
    const existing = getCart();
    itemsToAdd.forEach((item) => {
      const idx = existing.findIndex((e) => e.id === item.id);
      if (idx >= 0) {
        existing[idx].quantity += 1;
      } else {
        existing.push({
          id: item.id,
          slug: item.id,
          name: item.name,
          brand: '',
          category: item.category,
          priceEur: item.priceEur,
          weightG: item.weightG,
          image: '',
          imageAlt: item.name,
          quantity: 1,
        });
      }
    });
    saveCart(existing);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  if (loading) return <AltimeterLoader active />;

  if (aiError) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-foreground font-600">{aiError}</p>
        <button
          onClick={() => { setAiError(null); setRetryCount((c) => c + 1); }}
          className="btn-primary px-6 py-2.5"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!aiResult) return null;

  return (
    <div className="space-y-6">
      {/* Auto-save confirmation */}
      {autoSaved && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(51,70,60,0.1)', border: '1px solid rgba(51,70,60,0.2)' }}>
          <Icon name="CheckCircleIcon" size={16} variant="outline" className="text-secondary flex-shrink-0" />
          <p className="text-sm text-secondary font-500">Kit enregistré automatiquement dans vos kits</p>
        </div>
      )}
      {!autoSaved && !user && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(228,80,28,0.06)', border: '1px solid rgba(228,80,28,0.15)' }}>
          <Icon name="InformationCircleIcon" size={16} variant="outline" className="text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <Link href="/connexion" className="text-primary font-600 hover:underline">Connectez-vous</Link> pour sauvegarder ce kit automatiquement.
          </p>
        </div>
      )}

      {/* Inventory context banner */}
      {userInventory.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(62,107,122,0.08)', border: '1px solid rgba(62,107,122,0.2)' }}>
          <Icon name="ArchiveBoxIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            L&apos;IA a analysé vos <span className="font-600 text-foreground">{userInventory.length} équipements</span> existants — les articles déjà possédés sont marqués.
          </p>
        </div>
      )}

      {/* Readiness score */}
      {totalEssentials > 0 && (
        <div className="topo-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-600 text-foreground">Score &quot;Prêt à partir&quot;</p>
              <p className="text-xs text-muted-foreground">
                {readinessScore === 100
                  ? 'Vous avez tout le nécessaire !'
                  : `Il vous manque ${missingEssentials} article${missingEssentials > 1 ? 's' : ''} essentiel${missingEssentials > 1 ? 's' : ''}`}
              </p>
            </div>
            <span className={`text-2xl font-display font-800 ${readinessScore >= 80 ? 'text-emerald-600' : readinessScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}
              style={{ fontFamily: 'var(--font-display)' }}>
              {readinessScore}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${readinessScore >= 80 ? 'bg-emerald-500' : readinessScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${readinessScore}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground font-mono">{ownedEssentials} possédés</span>
            <span className="text-xs text-muted-foreground font-mono">{totalEssentials} essentiels</span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sac recommandé', val: aiResult.sac_recommande, icon: 'ShoppingBagIcon', color: 'var(--secondary)' },
          { label: 'Poids à acheter', val: `${(totalWeightG / 1000).toFixed(2)} kg`, icon: 'ScaleIcon', color: 'var(--info)', mono: true },
          { label: 'Budget manquant', val: `${totalPriceEur} €`, icon: 'BanknotesIcon', color: 'var(--accent)', mono: true },
          { label: 'À acheter', val: `${missingItems.filter(i => selectedItems.has(i.id)).length} / ${missingItems.length}`, icon: 'ListBulletIcon', color: 'var(--primary)', mono: true },
        ].map(({ label, val, icon, color, mono }) => (
          <div key={label} className="topo-card p-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}20` }}>
              <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={16} variant="outline" style={{ color }} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p
              className={`font-700 text-sm text-foreground leading-tight ${mono ? 'font-mono-data' : 'font-display'}`}
              style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)' }}
            >
              {val}
            </p>
          </div>
        ))}
      </div>

      {/* Animated Weight gauge */}
      <div className="topo-card p-4">
        <WeightGauge weightG={totalWeightG} maxG={state.maxWeightG} size="lg" />
        <p className="font-mono-data text-[10px] text-muted-foreground mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
          Limite configurée: {(state.maxWeightG / 1000).toFixed(1)} kg · Poids déjà possédé non compté
        </p>
      </div>

      {/* Alerts */}
      {aiResult.alertes.length > 0 && (
        <div className="space-y-2">
          {aiResult.alertes.map((alert, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(228,80,28,0.08)', border: '1px solid rgba(228,80,28,0.2)' }}>
              <Icon name="ExclamationTriangleIcon" size={16} variant="outline" className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Already owned section */}
      {ownedItems.length > 0 && (
        <div>
          <h3 className="font-display font-700 text-foreground text-base mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <Icon name="CheckCircleIcon" size={18} variant="outline" className="text-emerald-600" />
            Déjà dans ton sac ({ownedItems.length} articles)
          </h3>
          <div className="space-y-2 opacity-70">
            {ownedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-emerald-500">
                  <Icon name="CheckIcon" size={12} variant="outline" className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-500 text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-emerald-600">Déjà possédé · {item.category}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-mono-data text-xs text-info" style={{ fontFamily: 'var(--font-mono)' }}>
                    {item.weightG} g
                  </span>
                  <span className="text-xs text-emerald-600 font-600 line-through">
                    {item.priceEur} €
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment list by category — missing items only */}
      <div>
        <h3 className="font-display font-700 text-foreground text-base mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <Icon name="ShoppingBagIcon" size={18} variant="outline" className="text-primary" />
          Il te manque ({missingItems.length} articles)
        </h3>
        <div className="space-y-4">
          {categories.map((cat) => {
            const catMissingItems = missingItems.filter((i) => i.category === cat);
            if (catMissingItems.length === 0) return null;
            return (
              <div key={cat}>
                <p className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                  {cat}
                </p>
                <div className="space-y-2">
                  {catMissingItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                        selectedItems.has(item.id)
                          ? 'border-secondary/40 bg-secondary/5' : 'border-border opacity-50'
                      }`}
                      onClick={() => toggleItem(item.id)}
                      role="checkbox"
                      aria-checked={selectedItems.has(item.id)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') toggleItem(item.id); }}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                          selectedItems.has(item.id) ? 'bg-secondary border-secondary' : 'border-border'
                        }`}
                      >
                        {selectedItems.has(item.id) && (
                          <Icon name="CheckIcon" size={12} variant="outline" className="text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-500 text-foreground truncate">{item.name}</p>
                          {item.essential && (
                            <span className="tag-badge tag-alert text-[9px] flex-shrink-0">Essentiel</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="font-mono-data text-xs text-info" style={{ fontFamily: 'var(--font-mono)' }}>
                          {item.weightG} g
                        </span>
                        <span className="font-mono-data text-xs text-accent font-600" style={{ fontFamily: 'var(--font-mono)' }}>
                          {item.priceEur} €
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add to cart CTA */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleAddToCart}
          className="btn-primary flex-1 justify-center py-3.5 text-base"
          aria-label={`Ajouter ${missingItems.filter(i => selectedItems.has(i.id)).length} articles au panier pour ${totalPriceEur} €`}
        >
          <Icon name="ShoppingBagIcon" size={18} variant="outline" />
          Ajouter ce qui manque — {totalPriceEur} €
        </button>
        <Link href="/catalogue" className="btn-secondary justify-center py-3.5 text-base px-6">
          Voir le catalogue
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl"
          style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)', border: '1px solid rgba(255,255,255,0.1)' }}
          role="alert"
          aria-live="polite"
        >
          <Icon name="CheckCircleIcon" size={20} variant="outline" className="text-white flex-shrink-0" />
          <p className="text-sm font-500 text-white">{missingItems.filter(i => selectedItems.has(i.id)).length} articles ajoutés au panier</p>
        </div>
      )}
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Destination' },
  { id: 2, label: 'Dates' },
  { id: 3, label: 'Profil' },
  { id: 4, label: 'Résultat IA' },
];

export default function ConfiguratorWizard() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    destination: '',
    country: '',
    startDate: '',
    endDate: '',
    season: '',
    activity: '',
    level: '',
    maxWeightG: 10000,
    budgetEur: 500,
    generated: false,
  });
  const topRef = useRef<HTMLDivElement>(null);

  const update = (key: keyof WizardState, val: string | number | boolean) => {
    setState((prev) => ({ ...prev, [key]: val }));
  };

  const canAdvance = () => {
    if (state.step === 1) return state.destination.trim().length > 0;
    if (state.step === 2) return state.season.length > 0;
    if (state.step === 3) return state.activity.length > 0 && state.level.length > 0;
    return true;
  };

  const advance = () => {
    if (state.step < 4) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const back = () => {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: prev.step - 1 }));
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero banner */}
      <div className="bg-dark-bg py-12 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="topo-conf" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M0,40 C20,20 60,60 80,40" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
                <path d="M0,60 C20,40 60,80 80,60" fill="none" stroke="#E7E3D6" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-conf)" />
          </svg>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="flex items-center gap-2 justify-center mb-4">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-orange" />
            <span className="text-xs font-mono-data text-primary uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
              IA RACE MODE
            </span>
          </div>
          <h1 className="text-section-title text-white mb-3">
            Configurateur IA
          </h1>
          <p className="text-white/60 text-base max-w-md mx-auto">
            Votre liste d&apos;équipement optimisée poids / budget / sécurité en 4 étapes.
          </p>
        </div>
      </div>

      {/* Mono data band */}
      {state.destination && (
        <div
          className="border-b border-border py-2 px-4 sm:px-6 overflow-x-auto"
          style={{ background: 'rgba(62,107,122,0.06)' }}
          aria-label="Données contextuelles de destination"
        >
          <div className="flex items-center gap-6 min-w-max max-w-7xl mx-auto">
            {[
              { label: 'DEST', val: state.destination.toUpperCase() },
              { label: 'SAISON', val: state.season ? state.season.toUpperCase() : '—' },
              { label: 'ACTIVITÉ', val: state.activity || '—' },
              { label: 'MAX POIDS', val: state.maxWeightG >= 1000 ? `${(state.maxWeightG / 1000).toFixed(1)} kg` : `${state.maxWeightG} g` },
              { label: 'BUDGET', val: `${state.budgetEur} €` },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
                  {label}
                </span>
                <span className="font-mono-data text-[10px] text-info font-600" style={{ fontFamily: 'var(--font-mono)' }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div ref={topRef} className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Step indicator */}
        <div className="flex items-center mb-10" role="progressbar" aria-valuenow={state.step} aria-valuemin={1} aria-valuemax={4} aria-label={`Étape ${state.step} sur 4`}>
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`step-dot ${state.step === step.id ? 'active' : state.step > step.id ? 'completed' : ''}`}>
                  {state.step > step.id ? (
                    <Icon name="CheckIcon" size={14} variant="outline" className="text-white" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span className={`text-[10px] font-500 hidden sm:block ${state.step === step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`step-line mx-1 sm:mx-2 ${state.step > step.id ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step card */}
        <div className="topo-card p-6 sm:p-8">
          {/* Step header */}
          <div className="mb-6 pb-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)', color: 'white' }}>
                <Icon
                  name={
                    state.step === 1 ? 'MapPinIcon' :
                    state.step === 2 ? 'CalendarDaysIcon' :
                    state.step === 3 ? 'UserCircleIcon' : 'SparklesIcon'
                  }
                  size={16}
                  variant="outline"
                />
              </div>
              <div>
                <p className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
                  Étape {state.step} / 4
                </p>
                <h2 className="font-display font-700 text-foreground text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                  {STEPS[state.step - 1].label}
                </h2>
              </div>
            </div>
          </div>

          {/* Step content */}
          {state.step === 1 && <StepDestination state={state} onChange={update} />}
          {state.step === 2 && <StepDates state={state} onChange={update} />}
          {state.step === 3 && <StepProfile state={state} onChange={update} />}
          {state.step === 4 && <StepResult state={state} />}

          {/* Navigation buttons */}
          {state.step < 4 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={back}
                disabled={state.step === 1}
                className="btn-secondary py-2.5 px-5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Étape précédente"
              >
                <Icon name="ArrowLeftIcon" size={16} variant="outline" />
                Retour
              </button>
              <button
                onClick={advance}
                disabled={!canAdvance()}
                className="btn-primary py-2.5 px-6 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
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

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          La liste générée est une recommandation IA basée sur votre profil. Adaptez-la selon vos besoins spécifiques.
        </p>
      </div>
    </div>
  );
}