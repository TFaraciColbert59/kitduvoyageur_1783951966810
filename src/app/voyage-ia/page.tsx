'use client';

import React, { useState, useRef, useEffect } from 'react';
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

const LOADING_TIPS = [
  "Analyse de votre profil aventurier…",
  // eslint-disable-next-line no-useless-escape
  "Construction de l\'itinéraire jour par jour…",
  "Calcul des options logistiques et transport…",
  // eslint-disable-next-line no-useless-escape
  "Sélection du kit d\'équipement idéal…",
  "Estimation des budgets et alternatives…",
  "Vérification des conditions et saisons…",
  "Finalisation de votre plan complet…",
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

// Robust section parser — strips emojis and accents for matching
function parseSection(raw: string, marker: string): string {
  if (!raw) return '';
  const lines = raw.split('\n');

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normMarker = normalize(marker);

  const idx = lines.findIndex((l) => {
    const norm = normalize(l);
    return norm.includes(normMarker);
  });

  if (idx === -1) return '';

  const section: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at next top-level heading (# or ##) that is NOT the current section
    if (line.match(/^#{1,2}\s/) && i !== idx + 1 && section.length > 0) break;
    section.push(line);
  }
  return section.join('\n').trim();
}

// Render inline bold/italic within a text string
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-white/80">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return <p className="text-sm text-white/40 italic">Aucun contenu disponible pour cette section.</p>;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(<h5 key={i} className="text-xs font-bold text-white/70 uppercase tracking-wider mt-3 mb-1">{trimmed.replace('#### ', '')}</h5>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-sm font-bold text-[#E4501C]/90 mt-4 mb-1.5 flex items-center gap-1.5">{trimmed.replace('### ', '')}</h4>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-bold text-white mt-5 mb-2 border-b border-white/10 pb-1">{trimmed.replace('## ', '')}</h3>);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-lg font-bold text-[#E4501C] mt-5 mb-3">{trimmed.replace('# ', '')}</h2>);
    } else if (trimmed.startsWith('---')) {
      elements.push(<hr key={i} className="border-white/10 my-4" />);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      // Collect consecutive list items
      const listItems: string[] = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (lt.startsWith('- ') || lt.startsWith('• ') || lt.startsWith('* ')) {
          listItems.push(lt.replace(/^[-•*]\s/, ''));
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-2">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-white/75 leading-relaxed">
              <span className="text-[#E4501C] flex-shrink-0 mt-0.5">▸</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (trimmed.match(/^\d+\.\s/)) {
      // Collect consecutive numbered items
      const listItems: string[] = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (lt.match(/^\d+\.\s/)) {
          listItems.push(lt.replace(/^\d+\.\s/, ''));
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-2 list-none">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-white/75 leading-relaxed">
              <span className="text-[#E4501C] font-bold flex-shrink-0 w-5">{j + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-[#E4501C]/50 pl-4 py-1 my-2 bg-white/3 rounded-r-lg">
          <p className="text-sm text-white/70 italic">{renderInline(trimmed.replace('> ', ''))}</p>
        </blockquote>
      );
    } else {
      elements.push(
        <p key={i} className="text-sm text-white/75 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
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
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  // Rotate loading tips
  useEffect(() => {
    if (phase !== 'generating') return;
    const interval = setInterval(() => {
      setLoadingTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [phase]);

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
    setLoadingTipIndex(0);
  };

  const generateAdventure = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setPhase('generating');
    setRawResult('');
    setGenError(null);
    setLoadingTipIndex(0);

    const groupeDesc = data.voyageSeul === 'seul' ?'voyageur solo'
      : `groupe de ${data.nbParticipants} personnes${data.compositionGroupe.length ? ' (' + data.compositionGroupe.join(', ') + ')' : ''}`;

    const experienceDesc = [
      data.experienceOutdoor ? `outdoor: ${data.experienceOutdoor}` : '',
      data.experienceRandonnee ? `randonnée: ${data.experienceRandonnee}` : '',
      data.experienceBivouac ? `bivouac: ${data.experienceBivouac}` : '',
    ].filter(Boolean).join(' | ');

    const systemPrompt = `Tu es un expert voyage, aventure outdoor et équipement de randonnée de niveau mondial. Tu travailles pour "Le Kit du Voyageur", la référence française de l'équipement outdoor.

Ton rôle : créer des plans d'aventure ULTRA-DÉTAILLÉS, personnalisés, pratiques et immédiatement actionnables.

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT en français
- Utilise du markdown structuré avec titres, sous-titres, listes et séparateurs
- Chaque section doit être TRÈS développée — minimum 300 mots par section
- Donne des informations CONCRÈTES : noms de lieux réels, distances en km, dénivelés, durées précises, prix indicatifs en euros, noms d'hébergements ou refuges réels - Pour l'itinéraire : décris chaque journée avec le matin, midi et soir, les points GPS clés, les difficultés, les alternatives
- Pour la logistique : donne des compagnies de transport réelles, des fourchettes de prix, des sites de réservation
- Pour le kit : liste des produits avec marques reconnues, poids, prix indicatifs, et ce qui est disponible sur lekitduvoyageur.fr
- Adapte TOUT au profil exact du voyageur (âge, niveau, budget, groupe)
- Inclus des conseils de sécurité, des alternatives météo, des astuces locales
- Sois précis, exhaustif et enthousiaste`;

    const userPrompt = `Crée un plan d'aventure COMPLET et ULTRA-DÉTAILLÉ pour ce voyageur :

PROFIL COMPLET DU VOYAGEUR
- Âge : ${data.age} ans
- Niveau sportif : ${data.niveauSportif}
- Expériences : ${experienceDesc || 'non précisé'}
- Configuration : ${groupeDesc}
- Objectifs : ${data.objectifs.join(', ')}
- Niveau de confort souhaité : ${data.niveauConfort}
- Budget total : ${data.budget || 'non précisé'}
- Dates souhaitées : ${data.datesSouhaitees || 'flexible'}
- Durée : ${data.duree} jours
- Pays de départ : ${data.paysDepart}
- Transports disponibles : ${data.transportDisponible.join(', ') || 'non précisé'}
- Aventure souhaitée : ${data.destination}
- Matériel déjà possédé : ${data.materielActuel || 'rien de spécifique'}

Génère une réponse TRÈS LONGUE et TRÈS DÉTAILLÉE avec exactement ces 4 sections. Chaque section doit être exhaustive.

# FICHE AVENTURE

## Nom de l'aventure
[Donne un nom inspirant et mémorable à cette aventure]

## Concept & Esprit
[Décris en 3-4 paragraphes l'essence de cette aventure, pourquoi elle correspond parfaitement à ce profil, ce que le voyageur va ressentir, les moments clés qui l'attendent]

## Niveau de difficulté
[Évalue sur 5 étoiles chaque critère : physique, technique, orientation, altitude, météo. Explique pourquoi.]

## Durée idéale & variantes
[Durée recommandée, version courte, version longue, version express]

## Meilleure période & météo
[Mois idéaux, conditions météo typiques, températures min/max, précipitations, risques saisonniers, fenêtres météo]

## Pourquoi cette aventure vous correspond
[Analyse personnalisée basée sur le profil : âge, niveau, objectifs, groupe]

## Points forts incontournables
[Liste de 8-10 highlights avec description de chacun]

## Points d'attention & risques
[Difficultés réelles, risques spécifiques, ce qu'il ne faut pas sous-estimer]

## Réglementation & autorisations
[Permis nécessaires, zones protégées, règles locales, réservations obligatoires]

---

# ITINÉRAIRE DÉTAILLÉ

## Vue d'ensemble
[Carte narrative du trajet, distance totale, dénivelé cumulé, points de passage clés]

## Jour par jour — Programme complet
[Pour CHAQUE jour de ${data.duree} jours, décris en détail :]

### Jour 1 — [Titre évocateur]
**Matin :** [activité, lieu précis, distance, durée]
**Midi :** [pause déjeuner, lieu, options restauration]
**Après-midi :** [activité, lieu précis, distance, durée]
**Soir :** [hébergement précis avec nom, prix indicatif, ambiance]
**Infos pratiques :** [dénivelé, difficulté du jour, points GPS importants]
**Conseil du jour :** [astuce locale ou technique]

[Répète ce format pour chaque jour jusqu'au jour ${data.duree}]

## Hébergements recommandés — Liste complète
[Pour chaque nuit : nom de l'hébergement, type, prix/nuit, contact/réservation, ambiance, alternatives]

## Variantes & alternatives
[Version mauvais temps, version plus facile, version plus sportive, jours de repos possibles]

## Points dangereux & précautions
[Zones à risque, passages techniques, conseils de sécurité spécifiques]

---

# PLAN LOGISTIQUE

## Depuis ${data.paysDepart} — Comment y aller

### Option 1 — La plus économique
[Compagnies, trajets précis, prix indicatifs, durée, sites de réservation]

### Option 2 — La plus rapide
[Compagnies, trajets précis, prix indicatifs, durée, sites de réservation]

### Option 3 — La plus flexible
[Compagnies, trajets précis, prix indicatifs, durée, sites de réservation]

## Transport sur place
[Location voiture, navettes, transports en commun locaux, prix, conseils]

## Formalités & documents
[Visa, assurance voyage recommandée, vaccins si nécessaire, carte européenne santé, documents à emporter]

## Budget détaillé estimé
[Tableau complet : transport aller/retour, hébergements, nourriture/jour, activités/entrées, équipement manquant, imprévus. Total par personne et pour le groupe]

## Ravitaillement & alimentation
[Supermarchés sur le trajet, refuges avec restauration, eau potable, spécialités locales à goûter, régimes alimentaires]

## Connectivité & communication
[Couverture réseau, cartes SIM locales, zones sans réseau, applications utiles hors ligne]

## Santé & urgences
[Hôpitaux/médecins proches, numéros d'urgence locaux, pharmacies, altitude et acclimatation si nécessaire]

---

# KIT IDÉAL RECOMMANDÉ

## Analyse du kit selon votre profil
[Explique la philosophie du kit pour ce profil spécifique : poids cible, priorités, compromis]

## Abri & Couchage
[Pour chaque item : nom du produit avec marque, poids, prix indicatif, pourquoi ce choix, disponible sur lekitduvoyageur.fr]
- Tente / Bivouac
- Sac de couchage
- Matelas / Tapis de sol
- Oreiller de voyage

## Vêtements & Chaussures
[Liste complète adaptée à la saison et au terrain]
- Couche de base
- Couche intermédiaire
- Coupe-vent / Imperméable
- Chaussures de randonnée
- Chaussettes techniques
- Accessoires (bonnet, gants, buff)

## Sac à dos & Organisation
[Sac principal, sac de jour, housses imperméables, organisation interne]

## Navigation & Orientation
[GPS, carte papier, boussole, applications recommandées, points de repère]

## Hydratation & Alimentation
[Gourde, filtre à eau, réchaud, gamelle, nourriture lyophilisée, barres énergétiques]

## Sécurité & Premiers secours
[Trousse de secours détaillée, couverture de survie, sifflet, lampe frontale, batterie externe]

## Hygiène & Confort
[Produits essentiels, poids minimal, solutions légères]

## Electronique & Photo
[Appareil photo, batteries, adaptateurs, protections]

## Poids total estimé
[Poids du sac chargé, poids à vide, répartition par catégorie, conseils pour alléger]

## Ce que vous possédez déjà
[Analyse de : ${data.materielActuel || 'rien de précisé'} — ce qui est réutilisable, ce qui doit être remplacé]

## Budget équipement
[Total estimé pour compléter le kit, priorités d'achat, où trouver les meilleures offres]`;

    try {
      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-2.5-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, max_tokens: 4000 }
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
            Donnez une idée, un rêve ou une destination. L&apos;IA construit l&apos;intégralité de votre expérience — itinéraire détaillé, logistique, kit idéal.
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
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center gap-8">
              {/* Animated rings */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-2 border-[#E4501C]/10 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-[#E4501C]/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                <div className="absolute inset-0 rounded-full border-2 border-[#E4501C]/30 border-t-[#E4501C] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="SparklesIcon" size={28} variant="solid" className="text-[#E4501C]" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">Création de votre aventure…</h3>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  Gemini analyse votre profil et construit un plan complet et personnalisé. Cela peut prendre 20 à 40 secondes.
                </p>
              </div>

              {/* Rotating tips */}
              <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 max-w-sm w-full">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">En cours</p>
                <p className="text-sm text-white/80 transition-all duration-500">{LOADING_TIPS[loadingTipIndex]}</p>
              </div>

              {/* Progress dots */}
              <div className="flex gap-2">
                {LOADING_TIPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      i === loadingTipIndex ? 'bg-[#E4501C] w-4' : 'bg-white/20'
                    }`}
                  />
                ))}
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
                <p className="text-sm text-white/50 mt-0.5">Plan complet et détaillé généré par Gemini AI</p>
              </div>
              <button
                onClick={resetToIntro}
                className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-white/70 hover:text-white px-4 py-2 rounded-lg text-sm transition-all"
              >
                <Icon name="ArrowPathIcon" size={14} variant="outline" />
                Nouvelle aventure
              </button>
            </div>

            {/* Tabs */}
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

            {/* Content */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-96">
              {activeResultTab === 'fiche' && (
                <div>
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                    <Icon name="DocumentTextIcon" size={18} variant="outline" className="text-[#E4501C]" />
                    <h3 className="text-base font-bold text-white">Fiche Aventure</h3>
                  </div>
                  <MarkdownBlock text={parseSection(rawResult, 'FICHE AVENTURE')} />
                </div>
              )}
              {activeResultTab === 'itineraire' && (
                <div>
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                    <Icon name="MapIcon" size={18} variant="outline" className="text-[#E4501C]" />
                    <h3 className="text-base font-bold text-white">Itinéraire Détaillé</h3>
                  </div>
                  <MarkdownBlock text={parseSection(rawResult, 'ITINERAIRE DETAILLE') || parseSection(rawResult, 'ITINERAIRE')} />
                </div>
              )}
              {activeResultTab === 'logistique' && (
                <div>
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                    <Icon name="TruckIcon" size={18} variant="outline" className="text-[#E4501C]" />
                    <h3 className="text-base font-bold text-white">Plan Logistique</h3>
                  </div>
                  <MarkdownBlock text={parseSection(rawResult, 'PLAN LOGISTIQUE') || parseSection(rawResult, 'LOGISTIQUE')} />
                </div>
              )}
              {activeResultTab === 'kit' && (
                <div>
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                    <Icon name="ArchiveBoxIcon" size={18} variant="outline" className="text-[#E4501C]" />
                    <h3 className="text-base font-bold text-white">Kit Idéal Recommandé</h3>
                  </div>
                  <MarkdownBlock text={parseSection(rawResult, 'KIT IDEAL RECOMMANDE') || parseSection(rawResult, 'KIT IDEAL') || parseSection(rawResult, 'KIT')} />
                  <div className="mt-8 p-5 bg-[#E4501C]/10 border border-[#E4501C]/20 rounded-xl">
                    <p className="text-sm font-semibold text-white mb-1">🛒 Trouvez tout l&apos;équipement sur Le Kit du Voyageur</p>
                    <p className="text-xs text-white/50 mb-4">Tous les produits recommandés sont disponibles dans notre boutique.</p>
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

            {/* Raw output (collapsed) */}
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

            {/* Quick links */}
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
