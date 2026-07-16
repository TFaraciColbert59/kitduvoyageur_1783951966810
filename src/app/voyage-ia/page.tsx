'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'intro' | 'interview' | 'generating' | 'result';

interface InterviewData {
  age: string;
  niveauSportif: string;
  experienceOutdoor: string;
  experienceRandonnee: string;
  experienceBivouac: string;
  voyageSeul: string;
  nbParticipants: string;
  compositionGroupe: string[];
  objectifs: string[];
  niveauConfort: string;
  budget: string;
  datesSouhaitees: string;
  duree: string;
  paysDepart: string;
  transportDisponible: string[];
  destination: string;
  materielActuel: string;
}

const DEFAULT_DATA: InterviewData = {
  age: '',
  niveauSportif: '',
  experienceOutdoor: '',
  experienceRandonnee: '',
  experienceBivouac: '',
  voyageSeul: '',
  nbParticipants: '1',
  compositionGroupe: [],
  objectifs: [],
  niveauConfort: '',
  budget: '',
  datesSouhaitees: '',
  duree: '',
  paysDepart: '',
  transportDisponible: [],
  destination: '',
  materielActuel: '',
};

// ── Constants ─────────────────────────────────────────────────────────────────
const OBJECTIFS_OPTIONS = [
  { id: 'aventure', label: 'Aventure sportive', icon: 'BoltIcon' },
  { id: 'culture', label: 'Découverte culturelle', icon: 'BuildingLibraryIcon' },
  { id: 'nature', label: 'Nature sauvage', icon: 'GlobeAltIcon' },
  { id: 'detente', label: 'Détente', icon: 'SunIcon' },
  { id: 'depassement', label: 'Dépassement personnel', icon: 'TrophyIcon' },
  { id: 'photo', label: 'Photographie', icon: 'CameraIcon' },
  { id: 'gastronomie', label: 'Gastronomie', icon: 'SparklesIcon' },
  { id: 'exploration', label: 'Exploration', icon: 'MapIcon' },
];

const COMPOSITION_OPTIONS = [
  { id: 'couple', label: 'Couple' },
  { id: 'famille', label: 'Famille' },
  { id: 'amis', label: 'Amis' },
  { id: 'enfants', label: 'Avec enfants' },
  { id: 'chien', label: 'Avec chien' },
];

const TRANSPORT_OPTIONS = [
  { id: 'avion', label: '✈️ Avion' },
  { id: 'train', label: '🚂 Train' },
  { id: 'voiture', label: '🚗 Voiture' },
  { id: 'van', label: '🚐 Van' },
  { id: 'velo', label: '🚲 Vélo' },
];

const EXAMPLE_DESTINATIONS = [
  'Je veux découvrir les Dolomites',
  'Je veux faire le GR20',
  'Je veux partir au Japon',
  'Je veux une aventure sauvage de 5 jours',
  'Je veux faire un road trip en Islande',
  'Je veux gravir le Mont Blanc',
];

// ── Sub-components ────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.min(100, Math.max(0, (step / total) * 100));
  return (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#E4501C] rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  max,
}: {
  options: { id: string; label: string; icon?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, id]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
              active
                ? 'bg-[#E4501C] border-[#E4501C] text-white'
                : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white'
            }`}
          >
            {opt.icon && <Icon name={opt.icon} size={14} variant="outline" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E4501C] transition-colors"
      >
        <option value="" disabled>Choisir…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#1C2620]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#E4501C] transition-colors"
      />
    </div>
  );
}

function parseSection(raw: string, marker: string): string {
  const lines = raw.split('\n');
  const idx = lines.findIndex((l) => l.toLowerCase().includes(marker.toLowerCase()));
  if (idx === -1) return '';
  const section: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^#{1,3}\s/) && i !== idx + 1) break;
    section.push(line);
  }
  return section.join('\n').trim();
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-semibold text-white/90 mt-3">{line.replace('### ', '')}</h4>;
        if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-white mt-4">{line.replace('## ', '')}</h3>;
        if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-[#E4501C] mt-4">{line.replace('# ', '')}</h2>;
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-white">{line.replace(/\*\*/g, '')}</p>;
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <p key={i} className="text-sm text-white/75 pl-3 flex gap-2">
            <span className="text-[#E4501C] flex-shrink-0">•</span>
            <span>{line.replace(/^[-•]\s/, '')}</span>
          </p>
        );
        if (line.match(/^\d+\.\s/)) return <p key={i} className="text-sm text-white/75 pl-3">{line}</p>;
        return <p key={i} className="text-sm text-white/75 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VoyageIAPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [interviewStep, setInterviewStep] = useState(0);
  const [data, setData] = useState<InterviewData>(DEFAULT_DATA);
  const [rawResult, setRawResult] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'fiche' | 'itineraire' | 'logistique' | 'kit'>('fiche');
  const resultRef = useRef<HTMLDivElement>(null);

  const update = (field: keyof InterviewData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceedStep = (): boolean => {
    if (interviewStep === 0) return !!(data.age && data.niveauSportif && data.voyageSeul);
    if (interviewStep === 1) return data.objectifs.length > 0 && !!data.niveauConfort;
    if (interviewStep === 2) return !!(data.duree && data.paysDepart);
    if (interviewStep === 3) return data.destination.trim().length > 2;
    return true;
  };

  const resetToIntro = () => {
    setPhase('intro');
    setRawResult('');
    setGenError(null);
    setIsGenerating(false);
    setInterviewStep(0);
    setData(DEFAULT_DATA);
  };

  const generateAdventure = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setPhase('generating');
    setRawResult('');
    setGenError(null);

    const systemPrompt = `Tu es un expert voyage et aventure. Tu crées des plans d'aventure complets et personnalisés. Réponds UNIQUEMENT en français avec du markdown structuré. Sois concis et précis.`;

    const userPrompt = `Crée un plan d'aventure pour ce voyageur :

PROFIL : ${data.age} ans, niveau ${data.niveauSportif}, ${data.voyageSeul === 'seul' ? 'seul(e)' : `groupe de ${data.nbParticipants}${data.compositionGroupe.length ? ' (' + data.compositionGroupe.join(', ') + ')' : ''}`}
OBJECTIFS : ${data.objectifs.join(', ')} | CONFORT : ${data.niveauConfort}
CONTRAINTES : ${data.duree} jours, départ ${data.paysDepart}${data.budget ? ', budget ' + data.budget : ''}${data.datesSouhaitees ? ', ' + data.datesSouhaitees : ''}
AVENTURE : ${data.destination}
${data.materielActuel ? 'MATÉRIEL EXISTANT : ' + data.materielActuel : ''}

Structure ta réponse avec ces 4 sections exactes :

# 🏔️ FICHE AVENTURE
## Nom de l'aventure
## Concept
## Niveau de difficulté
## Durée idéale
## Meilleure période
## Pourquoi cette aventure vous correspond
## Points forts
## Points d'attention

---

# 🗺️ ITINÉRAIRE DÉTAILLÉ
## Vue d'ensemble
## Jour par jour
### Jour 1 — [Titre]
## Hébergements recommandés
## Points dangereux / Précautions

---

# ✈️ PLAN LOGISTIQUE
## Depuis ${data.paysDepart}
### Option économique
### Option rapide
### Option liberté
## Formalités essentielles
## Budget estimé total

---

# 🎒 KIT IDÉAL RECOMMANDÉ
## Abri & Couchage
## Vêtements
## Navigation
## Hydratation & Alimentation
## Sécurité
## Poids total estimé
## Produits disponibles sur Le Kit du Voyageur (/boutique)`;

    try {
      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-2.5-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.7, max_tokens: 3000 }
      );

      const content: string = (response as any)?.choices?.[0]?.message?.content ?? '';

      if (!content.trim()) {
        setGenError("La génération n'a produit aucun contenu. Veuillez réessayer.");
        setPhase('interview');
        setIsGenerating(false);
        return;
      }

      setRawResult(content);
      setIsGenerating(false);
      setPhase('result');
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setGenError(msg);
      setIsGenerating(false);
      setPhase('interview');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1C2620] text-white">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-10 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#E4501C]/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#2A3F35]/60 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#E4501C]/15 border border-[#E4501C]/30 rounded-full px-4 py-1.5 mb-6">
            <Icon name="SparklesIcon" size={14} variant="solid" className="text-[#E4501C]" />
            <span className="text-xs font-medium text-[#E4501C] uppercase tracking-wider">Créateur de Voyage IA</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Transformez votre envie<br />
            <span className="text-[#E4501C]">en aventure complète</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Donnez une idée, un rêve ou une destination. L&apos;IA construit l&apos;intégralité de votre expérience — itinéraire, logistique, kit idéal.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 pb-20">

        {/* ── INTRO PHASE ── */}
        {phase === 'intro' && (
          <div className="space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Quelle est votre aventure ?</h2>
              <p className="text-sm text-white/50 mb-4">Entrez votre destination, une activité ou une simple intention.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={data.destination}
                  onChange={(e) => update('destination', e.target.value)}
                  placeholder="Ex: Je veux faire le GR20, Je veux partir au Japon…"
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#E4501C] transition-colors text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && data.destination.trim().length > 2) setPhase('interview');
                  }}
                />
                <button
                  onClick={() => { if (data.destination.trim().length > 2) setPhase('interview'); }}
                  disabled={data.destination.trim().length < 3}
                  className="bg-[#E4501C] hover:bg-[#c93d14] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
                >
                  <Icon name="ArrowRightIcon" size={16} variant="outline" />
                  Commencer
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Exemples d&apos;aventures</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_DESTINATIONS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => { update('destination', ex); setPhase('interview'); }}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-sm px-4 py-2 rounded-lg transition-all duration-150"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: 'UserIcon', label: 'Interview intelligente', desc: 'Profil personnalisé' },
                { icon: 'MapIcon', label: 'Itinéraire jour/jour', desc: 'Détaillé & adapté' },
                { icon: 'TruckIcon', label: 'Plan logistique', desc: 'Transport & budget' },
                { icon: 'ArchiveBoxIcon', label: 'Kit idéal auto', desc: 'Lié à la boutique KDV' },
              ].map((f) => (
                <div key={f.label} className="bg-white/5 border border-white/8 rounded-xl p-4 text-center">
                  <Icon name={f.icon} size={20} variant="outline" className="text-[#E4501C] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white">{f.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INTERVIEW PHASE ── */}
        {phase === 'interview' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {genError && (
              <div className="mx-6 mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{genError}</p>
              </div>
            )}
            <div className="px-6 pt-6 pb-4 border-b border-white/8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#E4501C]/20 rounded-lg flex items-center justify-center">
                    <Icon name="SparklesIcon" size={16} variant="solid" className="text-[#E4501C]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider">Étape {interviewStep + 1} / 4</p>
                    <p className="text-sm font-semibold text-white">
                      {['Votre profil', 'Vos objectifs', 'Vos contraintes', 'Destination & matériel'][interviewStep]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPhase('intro')}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <Icon name="XMarkIcon" size={18} variant="outline" />
                </button>
              </div>
              <ProgressBar step={interviewStep + 1} total={4} />
            </div>

            <div className="p-6 space-y-5">
              {interviewStep === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Votre âge" value={data.age} onChange={(v) => update('age', v)} placeholder="Ex: 32" type="number" />
                    <SelectField
                      label="Niveau sportif"
                      value={data.niveauSportif}
                      onChange={(v) => update('niveauSportif', v)}
                      options={[
                        { value: 'débutant', label: 'Débutant' },
                        { value: 'intermédiaire', label: 'Intermédiaire' },
                        { value: 'avancé', label: 'Avancé' },
                        { value: 'expert', label: 'Expert / Athlète' },
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <SelectField
                      label="Expérience outdoor"
                      value={data.experienceOutdoor}
                      onChange={(v) => update('experienceOutdoor', v)}
                      options={[
                        { value: 'aucune', label: 'Aucune' },
                        { value: 'quelques sorties', label: 'Quelques sorties' },
                        { value: 'régulière', label: 'Régulière' },
                        { value: 'confirmée', label: 'Confirmée' },
                      ]}
                    />
                    <SelectField
                      label="Expérience randonnée"
                      value={data.experienceRandonnee}
                      onChange={(v) => update('experienceRandonnee', v)}
                      options={[
                        { value: 'aucune', label: 'Aucune' },
                        { value: 'débutant', label: 'Débutant' },
                        { value: 'intermédiaire', label: 'Intermédiaire' },
                        { value: 'confirmé', label: 'Confirmé' },
                      ]}
                    />
                    <SelectField
                      label="Expérience bivouac"
                      value={data.experienceBivouac}
                      onChange={(v) => update('experienceBivouac', v)}
                      options={[
                        { value: 'aucune', label: 'Aucune' },
                        { value: 'quelques nuits', label: 'Quelques nuits' },
                        { value: 'régulier', label: 'Régulier' },
                        { value: 'expert', label: 'Expert' },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Voyage seul ou accompagné ?</p>
                    <div className="flex gap-3">
                      {[
                        { value: 'seul', label: '🧍 Seul(e)' },
                        { value: 'groupe', label: '👥 En groupe' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => update('voyageSeul', opt.value)}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                            data.voyageSeul === opt.value
                              ? 'bg-[#E4501C] border-[#E4501C] text-white'
                              : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {data.voyageSeul === 'groupe' && (
                    <div className="space-y-4">
                      <InputField label="Nombre de participants" value={data.nbParticipants} onChange={(v) => update('nbParticipants', v)} placeholder="Ex: 4" type="number" />
                      <div>
                        <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Composition du groupe</p>
                        <MultiSelect options={COMPOSITION_OPTIONS} selected={data.compositionGroupe} onChange={(v) => update('compositionGroupe', v)} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {interviewStep === 1 && (
                <>
                  <div>
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Que recherchez-vous ? (plusieurs choix)</p>
                    <MultiSelect options={OBJECTIFS_OPTIONS} selected={data.objectifs} onChange={(v) => update('objectifs', v)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Niveau de confort souhaité</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'minimaliste', label: '🏕️ Minimaliste', desc: 'Bivouac, autonomie totale' },
                        { value: 'équilibré', label: '⚖️ Équilibré', desc: 'Mix refuges & bivouac' },
                        { value: 'premium', label: '🏨 Premium', desc: 'Hébergements confort' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => update('niveauConfort', opt.value)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            data.niveauConfort === opt.value
                              ? 'bg-[#E4501C]/20 border-[#E4501C] text-white'
                              : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30'
                          }`}
                        >
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-white/40 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {interviewStep === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Budget disponible (€)" value={data.budget} onChange={(v) => update('budget', v)} placeholder="Ex: 1500€" />
                    <InputField label="Dates souhaitées" value={data.datesSouhaitees} onChange={(v) => update('datesSouhaitees', v)} placeholder="Ex: Juillet 2025" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Durée (jours)" value={data.duree} onChange={(v) => update('duree', v)} placeholder="Ex: 7" type="number" />
                    <InputField label="Pays de départ" value={data.paysDepart} onChange={(v) => update('paysDepart', v)} placeholder="Ex: France" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Moyens de transport disponibles</p>
                    <MultiSelect options={TRANSPORT_OPTIONS} selected={data.transportDisponible} onChange={(v) => update('transportDisponible', v)} />
                  </div>
                </>
              )}

              {interviewStep === 3 && (
                <>
                  <div>
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Votre aventure souhaitée</p>
                    <textarea
                      value={data.destination}
                      onChange={(e) => update('destination', e.target.value)}
                      placeholder="Ex: Je veux faire le GR20 en Corse, Je veux découvrir les Dolomites…"
                      rows={3}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#E4501C] transition-colors text-sm resize-none"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Matériel que vous possédez déjà</p>
                    <textarea
                      value={data.materielActuel}
                      onChange={(e) => update('materielActuel', e.target.value)}
                      placeholder="Ex: J'ai déjà une tente 3 saisons, des chaussures de randonnée…"
                      rows={3}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#E4501C] transition-colors text-sm resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 pb-6 flex items-center justify-between">
              <button
                onClick={() => {
                  if (interviewStep === 0) setPhase('intro');
                  else setInterviewStep((s) => s - 1);
                }}
                className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
              >
                <Icon name="ArrowLeftIcon" size={14} variant="outline" />
                Retour
              </button>
              {interviewStep < 3 ? (
                <button
                  onClick={() => setInterviewStep((s) => s + 1)}
                  disabled={!canProceedStep()}
                  className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#c93d14] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
                >
                  Suivant
                  <Icon name="ArrowRightIcon" size={14} variant="outline" />
                </button>
              ) : (
                <button
                  onClick={generateAdventure}
                  disabled={!canProceedStep() || isGenerating}
                  className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#c93d14] disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  <Icon name="SparklesIcon" size={14} variant="solid" />
                  Générer mon aventure
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── GENERATING PHASE ── */}
        {phase === 'generating' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-[#E4501C]/30 border-t-[#E4501C] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="SparklesIcon" size={20} variant="solid" className="text-[#E4501C]" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Création de votre aventure en cours…</h3>
                <p className="text-sm text-white/50">L&apos;IA analyse votre profil et construit votre plan complet</p>
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT PHASE ── */}
        {phase === 'result' && rawResult && (
          <div ref={resultRef} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Votre aventure est prête ✨</h2>
                <p className="text-sm text-white/50 mt-0.5">Plan complet généré par Gemini AI</p>
              </div>
              <button
                onClick={resetToIntro}
                className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-white/70 hover:text-white px-4 py-2 rounded-lg text-sm transition-all"
              >
                <Icon name="ArrowPathIcon" size={14} variant="outline" />
                Nouvelle aventure
              </button>
            </div>

            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              {[
                { id: 'fiche', label: '📋 Fiche' },
                { id: 'itineraire', label: '🗺️ Itinéraire' },
                { id: 'logistique', label: '✈️ Logistique' },
                { id: 'kit', label: '🎒 Kit idéal' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveResultTab(tab.id as typeof activeResultTab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    activeResultTab === tab.id
                      ? 'bg-[#E4501C] text-white'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-64">
              {activeResultTab === 'fiche' && (
                <div>
                  <h3 className="text-base font-bold text-[#E4501C] mb-4 flex items-center gap-2">
                    <Icon name="DocumentTextIcon" size={16} variant="outline" />
                    Fiche Aventure
                  </h3>
                  <MarkdownBlock text={parseSection(rawResult, 'FICHE AVENTURE') || rawResult.split('ITINÉRAIRE')[0] || rawResult} />
                </div>
              )}
              {activeResultTab === 'itineraire' && (
                <div>
                  <h3 className="text-base font-bold text-[#E4501C] mb-4 flex items-center gap-2">
                    <Icon name="MapIcon" size={16} variant="outline" />
                    Itinéraire Détaillé
                  </h3>
                  <MarkdownBlock text={parseSection(rawResult, 'ITINÉRAIRE DÉTAILLÉ') || parseSection(rawResult, 'ITINERAIRE')} />
                </div>
              )}
              {activeResultTab === 'logistique' && (
                <div>
                  <h3 className="text-base font-bold text-[#E4501C] mb-4 flex items-center gap-2">
                    <Icon name="TruckIcon" size={16} variant="outline" />
                    Plan Logistique
                  </h3>
                  <MarkdownBlock text={parseSection(rawResult, 'PLAN LOGISTIQUE') || parseSection(rawResult, 'LOGISTIQUE')} />
                </div>
              )}
              {activeResultTab === 'kit' && (
                <div>
                  <h3 className="text-base font-bold text-[#E4501C] mb-4 flex items-center gap-2">
                    <Icon name="ArchiveBoxIcon" size={16} variant="outline" />
                    Kit Idéal Recommandé
                  </h3>
                  <MarkdownBlock text={parseSection(rawResult, 'KIT IDÉAL') || parseSection(rawResult, 'KIT IDEAL')} />
                  <div className="mt-6 p-4 bg-[#E4501C]/10 border border-[#E4501C]/20 rounded-xl">
                    <p className="text-sm text-white/80 mb-3">
                      🛒 Trouvez tous ces équipements sur la boutique <strong>Le Kit du Voyageur</strong>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/boutique" className="bg-[#E4501C] hover:bg-[#c93d14] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Voir la boutique
                      </Link>
                      <Link href="/kits" className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Kits assemblés
                      </Link>
                      <Link href="/ai-configurator" className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Configurateur IA
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <details className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
              <summary className="px-5 py-3 text-sm text-white/40 cursor-pointer hover:text-white/60 transition-colors select-none">
                Voir le plan complet brut
              </summary>
              <div className="px-5 pb-5">
                <div className="bg-black/20 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed">{rawResult}</pre>
                </div>
              </div>
            </details>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: '/copilote', label: 'Copilote IA', icon: 'SparklesIcon', desc: "Affiner avec l'IA" },
                { href: '/pays', label: 'Destinations', icon: 'GlobeAltIcon', desc: 'Fiches pays' },
                { href: '/guides', label: 'Guides terrain', icon: 'BookOpenIcon', desc: 'Conseils experts' },
                { href: '/inventaire', label: 'Mon inventaire', icon: 'ArchiveBoxIcon', desc: 'Gérer mon kit' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl p-4 text-center transition-all group"
                >
                  <Icon name={link.icon} size={18} variant="outline" className="text-[#E4501C] mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-white">{link.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
