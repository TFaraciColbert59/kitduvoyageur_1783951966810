'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface GearItem {
  name: string;
  category: string;
  used: boolean;
  rating?: number;
  note?: string;
  weight: number;
}

interface PastReport {
  id: string;
  destination: string;
  country: string;
  date: string;
  duration: string;
  score: number;
  budgetDelta: number;
  image: string;
  alt: string;
  type: string;
  notes?: string;
  budget_estimated?: number;
  budget_real?: number;
}

interface NewReportForm {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  type: string;
  score: number;
  notes: string;
  budget_estimated: number;
  budget_real: number;
}

const EXPEDITION_TYPES = ['Trekking', 'Randonnée', 'Alpinisme', 'Vanlife', 'Cyclotourisme', 'Kayak', 'Ski de randonnée', 'Autre'];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`transition-colors ${star <= value ? 'text-amber-400' : 'text-white/20 hover:text-amber-300'}`}
        >
          <Icon name="StarIcon" size={20} variant="solid" />
        </button>
      ))}
    </div>
  );
}

function NewReportModal({ onClose, onSave }: { onClose: () => void; onSave: (f: NewReportForm) => void }) {
  const [form, setForm] = useState<NewReportForm>({
    destination: '', country: '', startDate: '', endDate: '', type: 'Trekking', score: 4, notes: '',
    budget_estimated: 0, budget_real: 0,
  });
  const [step, setStep] = useState(1);

  const update = (field: keyof NewReportForm, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canNext = step === 1 ? form.destination && form.country : step === 2 ? form.startDate && form.endDate : true;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display font-700 text-foreground text-lg">Nouveau rapport d&apos;expédition</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Étape {step} / 3</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-cyan-500' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Destination *</label>
                <input type="text" className="input-field w-full" placeholder="ex: Circuit des Annapurnas" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Pays *</label>
                <input type="text" className="input-field w-full" placeholder="ex: Népal" value={form.country} onChange={(e) => update('country', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Type d&apos;expédition</label>
                <div className="flex flex-wrap gap-2">
                  {EXPEDITION_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => update('type', t)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.type === t ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-border text-muted-foreground hover:border-cyan-500/40'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Date de départ *</label>
                  <input type="date" className="input-field w-full" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Date de retour *</label>
                  <input type="date" className="input-field w-full" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-2">Note globale</label>
                <StarRating value={form.score} onChange={(v) => update('score', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Budget estimé (€)</label>
                  <input type="number" min={0} className="input-field w-full" value={form.budget_estimated} onChange={(e) => update('budget_estimated', Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Budget réel (€)</label>
                  <input type="number" min={0} className="input-field w-full" value={form.budget_real} onChange={(e) => update('budget_real', Number(e.target.value))} />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Notes & impressions</label>
                <textarea className="input-field w-full resize-none" rows={5} placeholder="Décrivez votre expédition, les points forts, les difficultés rencontrées..." value={form.notes} onChange={(e) => update('notes', e.target.value)} />
              </div>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
                <p className="text-xs text-cyan-400 font-medium mb-2">📊 Résumé du rapport</p>
                <div className="space-y-1 text-sm text-white/70">
                  <p><span className="text-white/40">Destination :</span> {form.destination}, {form.country}</p>
                  <p><span className="text-white/40">Type :</span> {form.type}</p>
                  <p><span className="text-white/40">Dates :</span> {form.startDate} → {form.endDate}</p>
                  <p><span className="text-white/40">Note :</span> {'⭐'.repeat(form.score)}</p>
                  {form.budget_estimated > 0 && <p><span className="text-white/40">Budget :</span> {form.budget_estimated}€ estimé / {form.budget_real}€ réel</p>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1 justify-center py-3">Retour</button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext} className="btn-primary flex-1 justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">Suivant</button>
          ) : (
            <button onClick={() => onSave(form)} className="btn-primary flex-1 justify-center py-3">
              <Icon name="CheckIcon" size={16} />
              Créer le rapport
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportDetailModal({ report, onClose }: { report: PastReport; onClose: () => void }) {
  const budgetDelta = (report.budget_real || 0) - (report.budget_estimated || 0);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={report.image} alt={report.alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors">
            <Icon name="XMarkIcon" size={18} className="text-white" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <span className="px-2 py-0.5 bg-cyan-500 rounded-full text-xs font-bold text-white">{report.type}</span>
            <h2 className="font-display font-700 text-white text-xl mt-1">{report.destination}</h2>
            <p className="text-white/60 text-xs">{report.country} · {report.date} · {report.duration}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="font-display font-700 text-2xl text-cyan-400">{report.score}</p>
              <p className="text-xs text-white/40">Score</p>
            </div>
            {report.budget_estimated ? (
              <>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="font-mono font-700 text-lg text-white/70">{report.budget_estimated}€</p>
                  <p className="text-xs text-white/40">Budget estimé</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className={`font-mono font-700 text-lg ${budgetDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {budgetDelta > 0 ? '+' : ''}{budgetDelta}€
                  </p>
                  <p className="text-xs text-white/40">Delta budget</p>
                </div>
              </>
            ) : (
              <div className="col-span-2 bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-white/40">Budget non renseigné</p>
              </div>
            )}
          </div>
          {report.notes && (
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-white/70 leading-relaxed">{report.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RapportExpeditionPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<'historique' | 'ia'>('historique');
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<PastReport | null>(null);
  const [reports, setReports] = useState<PastReport[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [userGear, setUserGear] = useState<GearItem[]>([]);
  const { response, isLoading, sendMessage } = useChat('gemini', 'gemini/gemini-2.5-flash');
  const [userInput, setUserInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoadingReports(true);
    try {
      const { data } = await supabase
        .from('kit_reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) {
        const mapped: PastReport[] = data.map((r) => ({
          id: r.id,
          destination: r.destination,
          country: r.country,
          date: new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
          duration: r.duration || '?j',
          score: 0,
          budgetDelta: 0,
          image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b',
          alt: r.destination,
          type: r.type || 'Trekking',
          notes: r.notes,
          budget_estimated: r.budget_estimated,
          budget_real: r.budget_real,
        }));
        setReports(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  }, [user, supabase]);

  const loadGear = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('gear_items')
        .select('name, category, weight_g, condition')
        .eq('user_id', user.id)
        .limit(20);
      if (data) {
        setUserGear(data.map((g) => ({
          name: g.name,
          category: g.category,
          used: true,
          weight: g.weight_g,
        })));
      }
    } catch (err) {
      console.error(err);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadReports();
    loadGear();
  }, [loadReports, loadGear]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);

  useEffect(() => {
    if (response && !isLoading) {
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === response) return prev;
        return [...prev.filter((m) => m.role !== 'assistant' || m.content !== '...'), { role: 'assistant', content: response }];
      });
    }
  }, [response, isLoading]);

  const handleSend = () => {
    if (!userInput.trim()) return;
    const userMsg = userInput;
    setUserInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    const totalReports = reports.length;
    const avgScore = totalReports > 0 ? Math.round(reports.reduce((s, r) => s + r.score, 0) / totalReports) : 0;
    const systemContext = `Tu es un assistant expert en analyse de voyages d'expédition pour un utilisateur de l'application Kit du Voyageur. L'utilisateur a ${totalReports} expédition(s) enregistrée(s) avec un score moyen de ${avgScore}/100. Il possède ${userGear.length} équipements dans son inventaire. Réponds en français de manière concise et actionnable.`;
    sendMessage(
      [
        { role: 'system', content: systemContext },
        ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg },
      ],
      {}
    );
  };

  const handleSaveReport = async (form: NewReportForm) => {
    const duration = form.startDate && form.endDate
      ? `${Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24))}j`
      : '?j';

    if (user) {
      try {
        // Ensure profile exists
        const { data: profile } = await supabase.from('user_profiles').select('id').eq('id', user.id).single();
        if (!profile) {
          await supabase.from('user_profiles').insert({
            id: user.id,
            email: user.email ?? '',
            full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
            loyalty_points: 100,
            trust_score: 50,
          });
        }

                  // Consomme l'API kit-report au lieu de supabase directement
          const res = await fetch('/api/kit-report/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionParams: {
                destination: form.destination,
                country: form.country,
                startDate: form.startDate,
                endDate: form.endDate,
                season: 'Eté',
                activity: form.type,
                level: 'Intermédiaire',
                maxWeightG: 10000,
                budgetEur: form.budget_estimated || form.budget_real || 0
              },
              selectedItems: [] // Simulate empty or add logic to extract from form if needed
            })
          });
          const { reportId } = await res.json();
          if (reportId) {
            await fetch('/api/kit-report/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reportId })
            });
          }

        // Award loyalty points for creating a report
        await supabase.from('loyalty_history').insert({
          user_id: user.id,
          action: `Rapport d'expédition créé : ${form.destination}`,
          points: 75,
          type: 'earned',
        });
        // Update loyalty points using raw SQL increment
        const { data: currentProfile } = await supabase.from('user_profiles').select('loyalty_points').eq('id', user.id).single();
        if (currentProfile) {
          await supabase.from('user_profiles').update({
            loyalty_points: (currentProfile.loyalty_points || 0) + 75,
          }).eq('id', user.id);
        }

        await loadReports();
      } catch (err) {
        console.error('Save report error:', err);
      }
    }

    setShowNewReportModal(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const totalWeight = userGear.reduce((s, g) => s + g.weight, 0);
  const avgScore = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length) : 0;
  const totalBudgetDelta = reports.reduce((s, r) => s + r.budgetDelta, 0);

  return (
    <>
      <div className="hidden md:block">
        <div className="min-h-screen bg-dark-bg text-white">
          <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden py-12 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-dark-bg to-primary/5 pointer-events-none" />
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-4">
                  <Icon name="DocumentChartBarIcon" size={12} variant="outline" />
                  PHASE 5 — RAPPORT POST-EXPÉDITION
                </div>
                <h1 className="font-display font-800 text-3xl sm:text-4xl text-white mb-3 tracking-tight">
                  Bilan automatique<br />
                  <span className="text-cyan-400">de chaque aventure</span>
                </h1>
                <p className="text-white/50 text-base max-w-xl">
                  Équipement utilisé, budget réel vs estimé, retour IA personnalisé. Chaque expédition devient une leçon pour la suivante.
                </p>
              </div>
              <button
                onClick={() => setShowNewReportModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/20 whitespace-nowrap flex-shrink-0"
              >
                <Icon name="PlusIcon" size={18} variant="outline" />
                Nouveau rapport
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[
                { label: 'Expéditions', value: reports.length.toString(), icon: 'MapIcon', color: 'text-cyan-400' },
                { label: 'Score moyen', value: reports.length > 0 ? `${avgScore}/100` : '—', icon: 'TrophyIcon', color: 'text-amber-400' },
                { label: 'Budget total', value: totalBudgetDelta !== 0 ? `${totalBudgetDelta > 0 ? '+' : ''}${totalBudgetDelta}€` : '—', icon: 'BanknotesIcon', color: totalBudgetDelta > 0 ? 'text-red-400' : 'text-green-400' },
                { label: 'Équipements', value: userGear.length > 0 ? `${(totalWeight / 1000).toFixed(1)} kg` : '—', icon: 'ArchiveBoxIcon', color: 'text-primary' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={stat.icon as never} size={14} variant="outline" className={stat.color} />
                    <span className="text-xs text-white/40">{stat.label}</span>
                  </div>
                  <p className={`font-display font-700 text-xl ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="px-4 pb-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
              {([
                { id: 'historique', label: '📁 Mes expéditions' },
                { id: 'ia', label: '🤖 Analyse IA' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-cyan-500 text-white shadow-sm' : 'text-white/50 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── HISTORIQUE TAB ── */}
        {activeTab === 'historique' && (
          <section className="px-4 py-6">
            <div className="max-w-5xl mx-auto">
              {savedSuccess && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
                  <Icon name="CheckCircleIcon" size={16} variant="outline" />
                  Rapport créé avec succès ! +75 points fidélité gagnés.
                </div>
              )}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-700 text-xl text-white">Mes expéditions ({reports.length})</h2>
                <button
                  onClick={() => setShowNewReportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-sm hover:bg-cyan-500/20 transition-all"
                >
                  <Icon name="PlusIcon" size={14} variant="outline" />
                  Nouveau
                </button>
              </div>

              {!user ? (
                <div className="text-center py-16 text-white/40">
                  <Icon name="DocumentChartBarIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Connectez-vous pour voir vos rapports d&apos;expédition.</p>
                </div>
              ) : loadingReports ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse" />)}
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/40 gap-4">
                  <Icon name="DocumentChartBarIcon" size={48} className="opacity-20" />
                  <div className="text-center">
                    <p className="font-display font-700 text-white/60 text-lg mb-1">Aucune expédition enregistrée</p>
                    <p className="text-sm">Créez votre premier rapport pour commencer à analyser vos aventures.</p>
                  </div>
                  <button
                    onClick={() => setShowNewReportModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-medium transition-all"
                  >
                    <Icon name="PlusIcon" size={16} variant="outline" />
                    Créer mon premier rapport
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-cyan-500/20 transition-all cursor-pointer group"
                      onClick={() => setSelectedReport(report)}
                    >
                      <div className="relative h-44">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={report.image} alt={report.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white/70 border border-white/10">{report.type}</span>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="font-display font-700 text-white text-base leading-tight">{report.destination}</h3>
                          <p className="text-xs text-white/50 mt-0.5">{report.country} · {report.date} · {report.duration}</p>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <span className="font-display font-700 text-cyan-400 text-sm">{report.score}</span>
                          </div>
                          <span className="text-xs text-white/40">Score global</span>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${report.budgetDelta > 0 ? 'text-red-400' : report.budgetDelta < 0 ? 'text-green-400' : 'text-white/40'}`}>
                          {report.budgetDelta !== 0 ? (
                            <>
                              <Icon name={report.budgetDelta > 0 ? 'ArrowUpIcon' : 'ArrowDownIcon'} size={12} variant="outline" />
                              {Math.abs(report.budgetDelta)}€ vs budget
                            </>
                          ) : (
                            <span className="text-white/30 text-xs">Budget non renseigné</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── IA TAB ── */}
        {activeTab === 'ia' && (
          <section className="px-4 py-6">
            <div className="max-w-3xl mx-auto">
              <div className="bg-card border border-cyan-500/20 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-border bg-gradient-to-r from-cyan-500/5 to-transparent">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-primary flex items-center justify-center">
                    <Icon name="SparklesIcon" size={16} variant="outline" className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Analyse IA de vos expéditions</p>
                    <p className="text-xs text-white/40">Gemini · Analyse personnalisée basée sur vos données réelles</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">En ligne</span>
                  </div>
                </div>

                {/* Context summary */}
                <div className="p-5 border-b border-border bg-white/2">
                  <p className="text-xs text-white/40 mb-3 uppercase tracking-wider font-mono">Contexte de votre profil</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="font-display font-700 text-xl text-cyan-400">{reports.length}</p>
                      <p className="text-[10px] text-white/40">Expéditions</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="font-display font-700 text-xl text-amber-400">{avgScore > 0 ? `${avgScore}/100` : '—'}</p>
                      <p className="text-[10px] text-white/40">Score moyen</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="font-display font-700 text-xl text-white">{userGear.length}</p>
                      <p className="text-[10px] text-white/40">Équipements</p>
                    </div>
                  </div>
                  {reports.length === 0 && (
                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-xs text-amber-400">💡 Créez votre premier rapport d&apos;expédition pour obtenir une analyse personnalisée.</p>
                    </div>
                  )}
                </div>

                {/* Chat Messages */}
                {chatMessages.length > 0 && (
                  <div className="p-5 space-y-4 max-h-80 overflow-y-auto border-b border-border">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary' : 'bg-cyan-500/20'}`}>
                          <Icon name={msg.role === 'user' ? 'UserIcon' : 'SparklesIcon'} size={12} variant="outline" className={msg.role === 'user' ? 'text-white' : 'text-cyan-400'} />
                        </div>
                        <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm ${msg.role === 'user' ? 'bg-primary/20 text-white' : 'bg-white/5 text-white/80'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <Icon name="SparklesIcon" size={12} variant="outline" className="text-cyan-400" />
                        </div>
                        <div className="px-4 py-2.5 rounded-xl bg-white/5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Input */}
                <div className="p-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Posez une question sur vos expéditions..."
                      className="flex-1 bg-dark-bg border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !userInput.trim()}
                      className="px-4 py-2.5 bg-cyan-500 rounded-xl text-white hover:bg-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Icon name="PaperAirplaneIcon" size={16} variant="outline" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['Que retirer de mon kit ?', 'Quelle destination ensuite ?', 'Comment optimiser mon budget ?', 'Analyse mes expéditions'].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setUserInput(prompt)}
                        className="px-3 py-1.5 bg-white/5 border border-border rounded-full text-xs text-white/50 hover:text-white hover:border-cyan-500/30 transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />

      {showNewReportModal && (
        <NewReportModal onClose={() => setShowNewReportModal(false)} onSave={handleSaveReport} />
      )}

          {selectedReport && (
            <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
          )}
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {/* Hero */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(11,31,23,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(23,64,44,0.08)', borderRadius: '999px', width: 'fit-content', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', color: '#17402C', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>PHASE 5 &mdash; RAPPORT POST-EXP&Eacute;DITION</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0B1F17', margin: '0 0 4px 0', lineHeight: 1.2 }}>
              Bilan automatique de chaque aventure
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7A72', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              &Eacute;quipement utilis&eacute;, budget r&eacute;el vs estim&eacute;, retour IA personnalis&eacute;.
            </p>
            <button
              onClick={() => setShowNewReportModal(true)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#17402C',
                color: '#fff',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              + Nouveau rapport
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 16px' }}>
            <div style={{ padding: '12px', background: '#FBFAF6', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)' }}>
              <p style={{ fontSize: '10px', color: '#6B7A72', margin: '0 0 2px 0' }}>Exp&eacute;ditions</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#17402C', margin: 0, fontFamily: 'ui-monospace, monospace' }}>{reports.length}</p>
            </div>
            <div style={{ padding: '12px', background: '#FBFAF6', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)' }}>
              <p style={{ fontSize: '10px', color: '#6B7A72', margin: '0 0 2px 0' }}>Score moyen</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#0B1F17', margin: 0, fontFamily: 'ui-monospace, monospace' }}>{reports.length > 0 ? `${avgScore}/100` : '\u2014'}</p>
            </div>
            <div style={{ padding: '12px', background: '#FBFAF6', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)' }}>
              <p style={{ fontSize: '10px', color: '#6B7A72', margin: '0 0 2px 0' }}>Budget total</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: totalBudgetDelta > 0 ? '#DC2626' : '#059669', margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                {totalBudgetDelta !== 0 ? `${totalBudgetDelta > 0 ? '+' : ''}${totalBudgetDelta}\u20ac` : '\u2014'}
              </p>
            </div>
            <div style={{ padding: '12px', background: '#FBFAF6', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)' }}>
              <p style={{ fontSize: '10px', color: '#6B7A72', margin: '0 0 2px 0' }}>&Eacute;quipements</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#0B1F17', margin: 0, fontFamily: 'ui-monospace, monospace' }}>
                {userGear.length > 0 ? `${(totalWeight / 1000).toFixed(1)} kg` : '\u2014'}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', padding: '0 16px' }}>
            <button
              onClick={() => setActiveTab('historique')}
              style={{
                flex: 1,
                padding: '10px',
                background: activeTab === 'historique' ? '#17402C' : '#F4F1EA',
                color: activeTab === 'historique' ? '#fff' : '#6B7A72',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Mes exp&eacute;ditions
            </button>
            <button
              onClick={() => setActiveTab('ia')}
              style={{
                flex: 1,
                padding: '10px',
                background: activeTab === 'ia' ? '#17402C' : '#F4F1EA',
                color: activeTab === 'ia' ? '#fff' : '#6B7A72',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Analyse IA
            </button>
          </div>

          {/* ── HISTORIQUE TAB (Mobile) ── */}
          {activeTab === 'historique' && (
            <div style={{ padding: '16px' }}>
              {savedSuccess && (
                <div style={{ marginBottom: '12px', padding: '10px', background: '#ECFDF5', borderRadius: '10px', border: '1px solid #A7F3D0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#059669' }}>&#10003;</span>
                  <p style={{ fontSize: '12px', color: '#065F46', margin: 0 }}>Rapport cr&eacute;&eacute; avec succ&egrave;s ! +75 points fid&eacute;lit&eacute;.</p>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#0B1F17', margin: 0 }}>
                  Mes exp&eacute;ditions ({reports.length})
                </p>
                <button
                  onClick={() => setShowNewReportModal(true)}
                  style={{
                    padding: '8px 14px',
                    background: '#17402C',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  + Nouveau
                </button>
              </div>

              {!user && (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <p style={{ fontSize: '13px', color: '#6B7A72', margin: 0 }}>Connectez-vous pour voir vos rapports d&apos;exp&eacute;dition.</p>
                </div>
              )}

              {loadingReports && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ height: '120px', background: '#F4F1EA', borderRadius: '12px', animation: 'pulse 2s infinite' }} />
                  ))}
                </div>
              )}

              {!loadingReports && user && reports.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#0B1F17', margin: '0 0 4px 0' }}>Aucune exp&eacute;dition enregistr&eacute;e</p>
                  <p style={{ fontSize: '12px', color: '#6B7A72', margin: '0 0 16px 0' }}>Cr&eacute;ez votre premier rapport.</p>
                  <button
                    onClick={() => setShowNewReportModal(true)}
                    style={{
                      padding: '12px 24px',
                      background: '#17402C',
                      color: '#fff',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Cr&eacute;er mon premier rapport
                  </button>
                </div>
              )}

              {!loadingReports && user && reports.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {reports.slice(0, 10).map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      style={{
                        background: '#FBFAF6',
                        borderRadius: '12px',
                        border: '1px solid rgba(11,31,23,0.06)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ height: '120px', background: `url(${report.image}) center/cover`, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                        <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', background: 'rgba(0,0,0,0.5)', borderRadius: '999px' }}>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>{report.type}</span>
                        </div>
                        <div style={{ position: 'absolute', bottom: '8px', left: '12px', right: '12px' }}>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: '0 0 2px 0' }}>{report.destination}</p>
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{report.country} &middot; {report.date} &middot; {report.duration}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(23,64,44,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#17402C' }}>{report.score}</span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#6B7A72' }}>Score</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 500, color: report.budgetDelta > 0 ? '#DC2626' : report.budgetDelta < 0 ? '#059669' : '#6B7A72' }}>
                          {report.budgetDelta !== 0 ? `${report.budgetDelta > 0 ? '+' : ''}${report.budgetDelta}\u20ac vs budget` : 'Budget non renseign\u00e9'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {reports.length > 10 && (
                    <p style={{ fontSize: '11px', color: '#6B7A72', textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', margin: 0 }}>
                      +{reports.length - 10} autre(s) exp&eacute;dition(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── IA TAB (Mobile) ── */}
          {activeTab === 'ia' && (
            <div style={{ padding: '16px' }}>
              <div style={{ background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '12px', borderBottom: '1px solid rgba(11,31,23,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px' }}>
                    &#10024;
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B1F17', margin: 0 }}>Analyse IA</p>
                    <p style={{ fontSize: '10px', color: '#6B7A72', margin: '1px 0 0 0' }}>Gemini &middot; Analyse personnalis&eacute;e</p>
                  </div>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                </div>

                {/* Profile context */}
                <div style={{ padding: '12px', borderBottom: '1px solid rgba(11,31,23,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div style={{ padding: '8px', background: '#F4F1EA', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#17402C', margin: '0 0 2px 0', fontFamily: 'ui-monospace, monospace' }}>{reports.length}</p>
                      <p style={{ fontSize: '9px', color: '#6B7A72', margin: 0 }}>Exp&eacute;ditions</p>
                    </div>
                    <div style={{ padding: '8px', background: '#F4F1EA', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#0B1F17', margin: '0 0 2px 0', fontFamily: 'ui-monospace, monospace' }}>{avgScore > 0 ? `${avgScore}/100` : '\u2014'}</p>
                      <p style={{ fontSize: '9px', color: '#6B7A72', margin: 0 }}>Score</p>
                    </div>
                    <div style={{ padding: '8px', background: '#F4F1EA', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#0B1F17', margin: '0 0 2px 0', fontFamily: 'ui-monospace, monospace' }}>{userGear.length}</p>
                      <p style={{ fontSize: '9px', color: '#6B7A72', margin: 0 }}>&Eacute;quipements</p>
                    </div>
                  </div>
                  {reports.length === 0 && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                      <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>Cr&eacute;ez votre premier rapport pour obtenir une analyse personnalis&eacute;e.</p>
                    </div>
                  )}
                </div>

                {/* Chat messages */}
                {chatMessages.length > 0 && (
                  <div style={{ padding: '12px', maxHeight: '240px', overflowY: 'auto', borderBottom: '1px solid rgba(11,31,23,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: msg.role === 'user' ? '#17402C' : 'rgba(23,64,44,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '10px',
                          color: msg.role === 'user' ? '#fff' : '#17402C',
                        }}>
                          {msg.role === 'user' ? 'U' : 'AI'}
                        </div>
                        <div style={{
                          maxWidth: '75%',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          lineHeight: 1.4,
                          background: msg.role === 'user' ? '#17402C' : '#F4F1EA',
                          color: msg.role === 'user' ? '#fff' : '#0B1F17',
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(23,64,44,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#17402C' }}>AI</div>
                        <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#F4F1EA', display: 'flex', gap: '3px', alignItems: 'center' }}>
                          <span style={{ width: '5px', height: '5px', background: '#17402C', borderRadius: '50%', animation: 'bounce 1s infinite' }} />
                          <span style={{ width: '5px', height: '5px', background: '#17402C', borderRadius: '50%', animation: 'bounce 1s infinite 150ms' }} />
                          <span style={{ width: '5px', height: '5px', background: '#17402C', borderRadius: '50%', animation: 'bounce 1s infinite 300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Posez une question..."
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        background: '#F4F1EA',
                        border: '1px solid rgba(11,31,23,0.06)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#0B1F17',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !userInput.trim()}
                      style={{
                        padding: '10px 14px',
                        background: '#17402C',
                        color: '#fff',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        opacity: isLoading || !userInput.trim() ? 0.5 : 1,
                      }}
                    >
                      &#10148;
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {['Que retirer de mon kit ?', 'Quelle destination ensuite ?', 'Comment optimiser mon budget ?'].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setUserInput(prompt)}
                        style={{
                          padding: '4px 10px',
                          background: '#F4F1EA',
                          border: '1px solid rgba(11,31,23,0.06)',
                          borderRadius: '999px',
                          fontSize: '10px',
                          color: '#6B7A72',
                          cursor: 'pointer',
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer spacer */}
          <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
        </MobilePageShell>
      </div>

      {/* Modals (shown on both views) */}
      {showNewReportModal && (
        <NewReportModal onClose={() => setShowNewReportModal(false)} onSave={handleSaveReport} />
      )}

      {selectedReport && (
        <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </>
  );
}