'use client';

import React, { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';

interface TripPlan {
  destination: string;
  duration: string;
  season: string;
  activity: string;
  groupSize: number;
}

interface Suggestion {
  id: string;
  type: 'gear' | 'weather' | 'route' | 'budget' | 'safety';
  title: string;
  body: string;
  action?: string;
  actionHref?: string;
  priority: 'high' | 'medium' | 'low';
}

const PROACTIVE_SUGGESTIONS: Suggestion[] = [
  {
    id: 's1', type: 'gear', priority: 'high',
    title: 'Votre kit Népal expire dans 14 jours',
    body: 'La lampe frontale Petzl Actik Core a besoin d\'une révision avant votre départ prévu le 24 juillet.',
    action: 'Voir l\'inventaire', actionHref: '/inventaire',
  },
  {
    id: 's2', type: 'weather', priority: 'high',
    title: 'Alerte météo — Patagonie',
    body: 'Vents violents prévus (80 km/h) du 18 au 22 juillet. Votre tente actuelle est homologuée 4 saisons — vous êtes couvert.',
    action: 'Voir les alertes', actionHref: '/alertes',
  },
  {
    id: 's3', type: 'budget', priority: 'medium',
    title: 'Économie détectée : -34%',
    body: 'Le sac Osprey Atmos 65 que vous avez en wishlist est en promotion sur Occasion. Économie estimée : 87€.',
    action: 'Voir l\'offre', actionHref: '/occasion',
  },
  {
    id: 's4', type: 'route', priority: 'medium',
    title: 'Itinéraire optimisé disponible',
    body: 'Basé sur votre profil, le circuit Torres del Paine W en 5 jours correspond mieux à votre condition physique que le O.',
    action: 'Planifier', actionHref: '/pays/cl',
  },
  {
    id: 's5', type: 'safety', priority: 'low',
    title: 'Rappel : assurance rapatriement',
    body: 'Votre destination (altitude > 4000m) nécessite une couverture spécifique. Ajoutez l\'assurance montagne au checkout.',
    action: 'Voir les assurances', actionHref: '/checkout',
  },
];

const QUICK_PROMPTS = [
  'Planifie mon trek au Népal en octobre',
  'Quel matériel pour la Patagonie en hiver ?',
  'Optimise mon kit pour réduire le poids',
  'Quels guides certifiés pour le Kilimandjaro ?',
  'Calcule mon empreinte carbone pour ce voyage',
  'Compare les assurances voyage disponibles',
];

const TRIP_ACTIVITIES = ['Trekking', 'Alpinisme', 'Randonnée', 'Surf', 'Plongée', 'Cyclisme', 'Ski', 'Escalade'];
const TRIP_SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'];

export default function CopilotePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis votre copilote d\'expédition IA. Je peux planifier vos voyages de A à Z, optimiser votre équipement, analyser les conditions météo et vous connecter avec des experts terrain. Comment puis-je vous aider aujourd\'hui ?',
    },
  ]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [_planMode, _setPlanMode] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan>({ destination: '', duration: '7', season: 'Été', activity: 'Trekking', groupSize: 1 });
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'suggestions'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { response, isLoading, sendMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, response]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: msg }];
    setMessages(newMessages);

    const systemPrompt = `Tu es un copilote d'expédition expert pour Kit du Voyageur, une plateforme française de kits de voyage. Tu aides les voyageurs à planifier leurs expéditions, choisir leur matériel, optimiser leur poids, et rester en sécurité. Réponds en français, de façon concise et pratique. Tu peux suggérer des kits, des destinations, des guides certifiés, et calculer des empreintes carbone.`;

    await sendMessage(
      [{ role: 'system', content: systemPrompt }, ...newMessages.map(m => ({ role: m.role, content: m.content }))],
      { max_tokens: 600 }
    );
  };

  useEffect(() => {
    if (response && !isLoading) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === response) return prev;
        if (last?.role === 'assistant' && prev.length > 1) {
          return [...prev.slice(0, -1), { role: 'assistant', content: response }];
        }
        return [...prev, { role: 'assistant', content: response }];
      });
    }
  }, [response, isLoading]);

  useEffect(() => {
    if (isLoading && messages[messages.length - 1]?.role === 'user') {
      setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);
    }
  }, [isLoading, messages]);

  const handlePlanTrip = async () => {
    const prompt = `Planifie un voyage complet pour : destination "${tripPlan.destination}", durée ${tripPlan.duration} jours, saison ${tripPlan.season}, activité principale ${tripPlan.activity}, groupe de ${tripPlan.groupSize} personne(s). Inclus : liste de matériel essentiel, budget estimé, conseils sécurité, meilleure période, et recommandations locales.`;
    setActiveTab('chat');
    handleSend(prompt);
  };

  const activeSuggestions = PROACTIVE_SUGGESTIONS.filter(s => !dismissedSuggestions.includes(s.id));

  const suggestionTypeIcon: Record<Suggestion['type'], string> = {
    gear: 'WrenchScrewdriverIcon',
    weather: 'CloudIcon',
    route: 'MapIcon',
    budget: 'CurrencyEuroIcon',
    safety: 'ShieldCheckIcon',
  };

  const priorityColor: Record<Suggestion['priority'], string> = {
    high: 'text-red-600 bg-red-50 border-red-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    low: 'text-info bg-blue-50 border-blue-200',
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-20 bg-dark-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Icon name="SparklesIcon" size={20} className="text-primary" variant="outline" />
            </div>
            <p className="font-mono text-xs text-primary tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>COPILOTE IA — PHASE 4</p>
          </div>
          <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Votre assistant<br />d&apos;expédition intelligent
          </h1>
          <p className="text-white/60 text-lg max-w-xl">Planification complète, suggestions proactives, optimisation de kit — tout en un.</p>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-6 mt-8 pt-8 border-t border-white/10">
            {[
              { label: 'Voyages planifiés', value: '12 847' },
              { label: 'Kits optimisés', value: '34 291' },
              { label: 'Économie moyenne', value: '127€' },
              { label: 'Satisfaction', value: '98.4%' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="font-mono text-2xl font-700 text-white" style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 w-fit">
          {[
            { id: 'chat', label: 'Assistant IA', icon: 'ChatBubbleLeftRightIcon' },
            { id: 'plan', label: 'Planifier un voyage', icon: 'MapIcon' },
            { id: 'suggestions', label: `Suggestions (${activeSuggestions.length})`, icon: 'BellIcon' },
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main panel */}
          <div className="lg:col-span-2">
            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="topo-card flex flex-col" style={{ height: '600px' }}>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-mono font-700 ${
                        msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-secondary text-white'
                      }`} style={{ fontFamily: 'var(--font-mono)' }}>
                        {msg.role === 'assistant' ? 'IA' : 'Moi'}
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'assistant' ?'bg-card border border-border text-foreground' :'bg-primary text-white'
                      }`}>
                        {msg.content === '...' ? (
                          <div className="flex gap-1 items-center py-1">
                            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick prompts */}
                <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                  {QUICK_PROMPTS.slice(0, 3).map(p => (
                    <button
                      key={p}
                      onClick={() => handleSend(p)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Posez votre question ou décrivez votre voyage..."
                      className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                      className="btn-primary py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="PaperAirplaneIcon" size={16} variant="outline" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PLAN TAB */}
            {activeTab === 'plan' && (
              <div className="topo-card p-6">
                <h2 className="font-display font-700 text-xl text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>Planificateur de voyage complet</h2>
                <p className="text-sm text-muted-foreground mb-6">Renseignez votre projet et l&apos;IA génère un plan détaillé avec matériel, budget et conseils.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Destination *</label>
                    <input
                      type="text"
                      value={tripPlan.destination}
                      onChange={e => setTripPlan({ ...tripPlan, destination: e.target.value })}
                      placeholder="ex: Népal, Patagonie, Islande..."
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Durée (jours)</label>
                    <input
                      type="number"
                      min={1} max={365}
                      value={tripPlan.duration}
                      onChange={e => setTripPlan({ ...tripPlan, duration: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Taille du groupe</label>
                    <input
                      type="number"
                      min={1} max={50}
                      value={tripPlan.groupSize}
                      onChange={e => setTripPlan({ ...tripPlan, groupSize: parseInt(e.target.value) })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Saison</label>
                    <select
                      value={tripPlan.season}
                      onChange={e => setTripPlan({ ...tripPlan, season: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      {TRIP_SEASONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Activité principale</label>
                    <select
                      value={tripPlan.activity}
                      onChange={e => setTripPlan({ ...tripPlan, activity: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      {TRIP_ACTIVITIES.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handlePlanTrip}
                  disabled={!tripPlan.destination}
                  className="btn-primary w-full justify-center mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="SparklesIcon" size={16} variant="outline" />
                  Générer mon plan de voyage complet
                </button>

                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: 'ListBulletIcon', label: 'Liste matériel' },
                    { icon: 'CurrencyEuroIcon', label: 'Budget estimé' },
                    { icon: 'ShieldCheckIcon', label: 'Conseils sécurité' },
                    { icon: 'UserGroupIcon', label: 'Guides locaux' },
                  ].map(f => (
                    <div key={f.label} className="flex flex-col items-center gap-2 p-3 bg-background rounded-xl border border-border text-center">
                      <Icon name={f.icon} size={18} className="text-primary" variant="outline" />
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUGGESTIONS TAB */}
            {activeTab === 'suggestions' && (
              <div className="space-y-3">
                {activeSuggestions.length === 0 ? (
                  <div className="topo-card p-10 text-center">
                    <Icon name="CheckCircleIcon" size={40} className="text-emerald-500 mx-auto mb-3" variant="outline" />
                    <p className="font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Tout est en ordre !</p>
                    <p className="text-sm text-muted-foreground mt-1">Aucune suggestion proactive pour le moment.</p>
                  </div>
                ) : activeSuggestions.map(s => (
                  <div key={s.id} className={`topo-card p-4 border ${priorityColor[s.priority]}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${priorityColor[s.priority]}`}>
                        <Icon name={suggestionTypeIcon[s.type]} size={18} variant="outline" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-700 ${priorityColor[s.priority]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                            {s.priority === 'high' ? 'Urgent' : s.priority === 'medium' ? 'Moyen' : 'Info'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{s.body}</p>
                        {s.action && (
                          <a href={s.actionHref} className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-2 hover:underline">
                            {s.action} <Icon name="ArrowRightIcon" size={12} variant="outline" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => setDismissedSuggestions(prev => [...prev, s.id])}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      >
                        <Icon name="XMarkIcon" size={16} variant="outline" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick prompts */}
            <div className="topo-card p-4">
              <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Suggestions rapides</h3>
              <div className="space-y-2">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => { setActiveTab('chat'); handleSend(p); }}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center gap-2"
                  >
                    <Icon name="ArrowRightIcon" size={12} variant="outline" className="text-primary flex-shrink-0" />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div className="topo-card p-4">
              <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Capacités du copilote</h3>
              <div className="space-y-2.5">
                {[
                  { icon: 'MapIcon', label: 'Planification complète A→Z' },
                  { icon: 'ScaleIcon', label: 'Optimisation poids & budget' },
                  { icon: 'CloudIcon', label: 'Analyse météo en temps réel' },
                  { icon: 'UserGroupIcon', label: 'Mise en relation guides' },
                  { icon: 'LeafIcon', label: 'Calcul empreinte carbone' },
                  { icon: 'ShieldCheckIcon', label: 'Conseils sécurité terrain' },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Icon name={c.icon} size={14} className="text-primary flex-shrink-0" variant="outline" />
                    {c.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Active suggestions count */}
            {activeSuggestions.filter(s => s.priority === 'high').length > 0 && (
              <div className="topo-card p-4 border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600" variant="outline" />
                  <span className="font-display font-700 text-sm text-red-700" style={{ fontFamily: 'var(--font-display)' }}>
                    {activeSuggestions.filter(s => s.priority === 'high').length} alerte(s) urgente(s)
                  </span>
                </div>
                <button onClick={() => setActiveTab('suggestions')} className="text-xs text-red-600 hover:underline font-medium">
                  Voir les suggestions →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
