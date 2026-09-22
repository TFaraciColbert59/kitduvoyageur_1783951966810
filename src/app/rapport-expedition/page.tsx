'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Badge, Button, Card, Chip, EmptyState, IconButton, Modal, Skeleton, Tabs } from '@/components/ui';

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
    <div className="flex gap-1" role="group" aria-label="Note globale">
      {[1, 2, 3, 4, 5].map((star) => (
        <IconButton
          key={star}
          type="button"
          size="sm"
          aria-label={`Note ${star} sur 5`}
          aria-pressed={star <= value}
          onClick={() => onChange(star)}
          className={star <= value ? 'bg-[color:var(--lkv-warning)] text-[color:var(--lkv-text-inverted)]' : 'text-[color:var(--lkv-text-muted)]'}
        >
          <Icon name="StarIcon" size={18} variant="solid" />
        </IconButton>
      ))}
    </div>
  );
}

const FIELD_CLASS =
  'min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LABEL_CLASS =
  'mb-1.5 block text-[length:var(--lkv-text-caption-1)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]';

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
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Nouveau rapport d'expédition"
      description={`Étape ${step} / 3`}
      size="lg"
      footer={
        <div className="flex gap-[var(--space-3)]">
          {step > 1 && (
            <Button variant="secondary" fullWidth onClick={() => setStep(step - 1)}>
              Retour
            </Button>
          )}
          {step < 3 ? (
            <Button fullWidth onClick={() => setStep(step + 1)} disabled={!canNext}>
              Suivant
            </Button>
          ) : (
            <Button fullWidth onClick={() => onSave(form)} icon={<Icon name="CheckIcon" size={16} />}>
              Créer le rapport
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-[var(--space-4)]">
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[color:var(--lkv-primary)]' : 'bg-[color:var(--lkv-border)]'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <div>
              <label htmlFor="report-destination" className={LABEL_CLASS}>Destination *</label>
              <input id="report-destination" type="text" className={FIELD_CLASS} placeholder="ex: Circuit des Annapurnas" value={form.destination} onChange={(e) => update('destination', e.target.value)} />
            </div>
            <div>
              <label htmlFor="report-country" className={LABEL_CLASS}>Pays *</label>
              <input id="report-country" type="text" className={FIELD_CLASS} placeholder="ex: Népal" value={form.country} onChange={(e) => update('country', e.target.value)} />
            </div>
            <div>
              <span className={LABEL_CLASS}>Type d&apos;expédition</span>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                {EXPEDITION_TYPES.map((t) => (
                  <Chip key={t} selected={form.type === t} onClick={() => update('type', t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-[var(--space-4)]">
              <div>
                <label htmlFor="report-start" className={LABEL_CLASS}>Date de départ *</label>
                <input id="report-start" type="date" className={FIELD_CLASS} value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
              </div>
              <div>
                <label htmlFor="report-end" className={LABEL_CLASS}>Date de retour *</label>
                <input id="report-end" type="date" className={FIELD_CLASS} value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
              </div>
            </div>
            <div>
              <span className={`${LABEL_CLASS} mb-2`}>Note globale</span>
              <StarRating value={form.score} onChange={(v) => update('score', v)} />
            </div>
            <div className="grid grid-cols-2 gap-[var(--space-4)]">
              <div>
                <label htmlFor="report-budget-est" className={LABEL_CLASS}>Budget estimé (€)</label>
                <input id="report-budget-est" type="number" min={0} className={FIELD_CLASS} value={form.budget_estimated} onChange={(e) => update('budget_estimated', Number(e.target.value))} />
              </div>
              <div>
                <label htmlFor="report-budget-real" className={LABEL_CLASS}>Budget réel (€)</label>
                <input id="report-budget-real" type="number" min={0} className={FIELD_CLASS} value={form.budget_real} onChange={(e) => update('budget_real', Number(e.target.value))} />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label htmlFor="report-notes" className={LABEL_CLASS}>Notes &amp; impressions</label>
              <textarea id="report-notes" className={`${FIELD_CLASS} resize-none`} rows={5} placeholder="Décrivez votre expédition, les points forts, les difficultés rencontrées..." value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </div>
            <Card variant="compact" tone="info" className="p-[var(--space-4)]">
              <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption-1)] font-medium text-[color:var(--lkv-info)]">Résumé du rapport</p>
              <div className="space-y-1 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
                <p><span className="text-[color:var(--lkv-text-muted)]">Destination :</span> {form.destination}, {form.country}</p>
                <p><span className="text-[color:var(--lkv-text-muted)]">Type :</span> {form.type}</p>
                <p><span className="text-[color:var(--lkv-text-muted)]">Dates :</span> {form.startDate} → {form.endDate}</p>
                <p><span className="text-[color:var(--lkv-text-muted)]">Note :</span> {'⭐'.repeat(form.score)}</p>
                {form.budget_estimated > 0 && <p><span className="text-[color:var(--lkv-text-muted)]">Budget :</span> {form.budget_estimated}€ estimé / {form.budget_real}€ réel</p>}
              </div>
            </Card>
          </>
        )}
      </div>
    </Modal>
  );
}

function ReportDetailModal({ report, onClose }: { report: PastReport; onClose: () => void }) {
  const budgetDelta = (report.budget_real || 0) - (report.budget_estimated || 0);
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={report.destination}
      description={`${report.country} · ${report.date} · ${report.duration}`}
      size="lg"
    >
      <div className="space-y-[var(--space-4)]">
        <div className="relative h-48 overflow-hidden rounded-[var(--lkv-radius-sm)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={report.image} alt={report.alt} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-[var(--space-3)] left-[var(--space-4)] right-[var(--space-4)]">
            <Badge tone="info" className="bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">{report.type}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-[var(--space-3)]">
          <Card variant="compact" className="text-center">
            <p className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">{report.score}</p>
            <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Score</p>
          </Card>
          {report.budget_estimated ? (
            <>
              <Card variant="compact" className="text-center">
                <p className="font-mono text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-secondary)]">{report.budget_estimated}€</p>
                <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Budget estimé</p>
              </Card>
              <Card variant="compact" className="text-center">
                <p className={`font-mono text-[length:var(--lkv-text-body-sm)] font-bold ${budgetDelta > 0 ? 'text-[color:var(--lkv-danger)]' : 'text-[color:var(--lkv-success)]'}`}>
                  {budgetDelta > 0 ? '+' : ''}{budgetDelta}€
                </p>
                <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Delta budget</p>
              </Card>
            </>
          ) : (
            <Card variant="compact" className="col-span-2 text-center">
              <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Budget non renseigné</p>
            </Card>
          )}
        </div>
        {report.notes && (
          <Card variant="compact" className="p-[var(--space-4)]">
            <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption-1)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">Notes</p>
            <p className="text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-secondary)]">{report.notes}</p>
          </Card>
        )}
      </div>
    </Modal>
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
              <Button
                onClick={() => setShowNewReportModal(true)}
                icon={<Icon name="PlusIcon" size={18} variant="outline" />}
                className="shrink-0 whitespace-nowrap"
              >
                Nouveau rapport
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[
                { label: 'Expéditions', value: reports.length.toString(), icon: 'MapIcon', color: 'text-[color:var(--lkv-info)]' },
                { label: 'Score moyen', value: reports.length > 0 ? `${avgScore}/100` : '—', icon: 'TrophyIcon', color: 'text-[color:var(--lkv-warning)]' },
                { label: 'Budget total', value: totalBudgetDelta !== 0 ? `${totalBudgetDelta > 0 ? '+' : ''}${totalBudgetDelta}€` : '—', icon: 'BanknotesIcon', color: totalBudgetDelta > 0 ? 'text-[color:var(--lkv-danger)]' : 'text-[color:var(--lkv-success)]' },
                { label: 'Équipements', value: userGear.length > 0 ? `${(totalWeight / 1000).toFixed(1)} kg` : '—', icon: 'ArchiveBoxIcon', color: 'text-[color:var(--lkv-primary)]' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/8 rounded-[var(--lkv-radius-md)] p-4">
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
            <Tabs
              options={[
                { id: 'historique', label: 'Mes expéditions' },
                { id: 'ia', label: 'Analyse IA' },
              ]}
              value={activeTab}
              onChange={(id) => setActiveTab(id as 'historique' | 'ia')}
              ariaLabel="Sections du rapport"
              className="w-fit"
            />
          </div>
        </section>

        {/* ── HISTORIQUE TAB ── */}
        {activeTab === 'historique' && (
          <section className="px-4 py-6">
            <div className="max-w-5xl mx-auto">
              {savedSuccess && (
                <div className="mb-4 flex items-center gap-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-success)]/30 bg-[color:var(--lkv-success-bg)] px-4 py-3 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-primary)]">
                  <Icon name="CheckCircleIcon" size={16} variant="outline" />
                  Rapport créé avec succès ! +75 points fidélité gagnés.
                </div>
              )}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-700 text-xl text-white">Mes expéditions ({reports.length})</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowNewReportModal(true)}
                  icon={<Icon name="PlusIcon" size={14} variant="outline" />}
                >
                  Nouveau
                </Button>
              </div>

              {!user ? (
                <div className="text-center py-16 text-white/40">
                  <Icon name="DocumentChartBarIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Connectez-vous pour voir vos rapports d&apos;expédition.</p>
                </div>
              ) : loadingReports ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-[var(--lkv-radius-lg)] bg-white/5 animate-pulse" />)}
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/40 gap-4">
                  <Icon name="DocumentChartBarIcon" size={48} className="opacity-20" />
                  <div className="text-center">
                    <p className="font-display font-700 text-white/60 text-lg mb-1">Aucune expédition enregistrée</p>
                    <p className="text-sm">Créez votre premier rapport pour commencer à analyser vos aventures.</p>
                  </div>
                  <Button
                    onClick={() => setShowNewReportModal(true)}
                    icon={<Icon name="PlusIcon" size={16} variant="outline" />}
                  >
                    Créer mon premier rapport
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-card border border-border rounded-[var(--lkv-radius-lg)] overflow-hidden hover:border-cyan-500/20 transition-all cursor-pointer group"
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
                          <div className="w-10 h-10 rounded-[var(--lkv-radius-md)] bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
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
              <div className="bg-card border border-cyan-500/20 rounded-[var(--lkv-radius-lg)] overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-border bg-gradient-to-r from-cyan-500/5 to-transparent">
                  <div className="w-9 h-9 rounded-[var(--lkv-radius-md)] bg-gradient-to-br from-cyan-500 to-primary flex items-center justify-center">
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
                    <div className="bg-white/5 rounded-[var(--lkv-radius-md)] p-3 text-center">
                      <p className="font-display font-700 text-xl text-cyan-400">{reports.length}</p>
                      <p className="text-[10px] text-white/40">Expéditions</p>
                    </div>
                    <div className="bg-white/5 rounded-[var(--lkv-radius-md)] p-3 text-center">
                      <p className="font-display font-700 text-xl text-sand-400">{avgScore > 0 ? `${avgScore}/100` : '—'}</p>
                      <p className="text-[10px] text-white/40">Score moyen</p>
                    </div>
                    <div className="bg-white/5 rounded-[var(--lkv-radius-md)] p-3 text-center">
                      <p className="font-display font-700 text-xl text-white">{userGear.length}</p>
                      <p className="text-[10px] text-white/40">Équipements</p>
                    </div>
                  </div>
                  {reports.length === 0 && (
                    <div className="mt-3 p-3 bg-[color:var(--lkv-sand-500)]/10 border border-[color:var(--lkv-sand-500)]/20 rounded-[var(--lkv-radius-md)]">
                      <p className="text-xs text-sand-400">💡 Créez votre premier rapport d&apos;expédition pour obtenir une analyse personnalisée.</p>
                    </div>
                  )}
                </div>

                {/* Chat Messages */}
                {chatMessages.length > 0 && (
                  <div className="p-5 space-y-4 max-h-80 overflow-y-auto border-b border-border">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-[var(--lkv-radius-sm)] flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary' : 'bg-cyan-500/20'}`}>
                          <Icon name={msg.role === 'user' ? 'UserIcon' : 'SparklesIcon'} size={12} variant="outline" className={msg.role === 'user' ? 'text-white' : 'text-cyan-400'} />
                        </div>
                        <div className={`max-w-[80%] px-4 py-2.5 rounded-[var(--lkv-radius-md)] text-sm ${msg.role === 'user' ? 'bg-primary/20 text-white' : 'bg-white/5 text-white/80'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-[var(--lkv-radius-sm)] bg-cyan-500/20 flex items-center justify-center">
                          <Icon name="SparklesIcon" size={12} variant="outline" className="text-cyan-400" />
                        </div>
                        <div className="px-4 py-2.5 rounded-[var(--lkv-radius-md)] bg-white/5 flex items-center gap-1">
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
                      className="flex-1 bg-dark-bg border border-border rounded-[var(--lkv-radius-md)] px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                    />
                    <IconButton
                      onClick={handleSend}
                      disabled={isLoading || !userInput.trim()}
                      aria-label="Envoyer la question"
                      className="bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]"
                    >
                      <Icon name="PaperAirplaneIcon" size={16} variant="outline" />
                    </IconButton>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['Que retirer de mon kit ?', 'Quelle destination ensuite ?', 'Comment optimiser mon budget ?', 'Analyse mes expéditions'].map((prompt) => (
                      <Chip key={prompt} onClick={() => setUserInput(prompt)}>
                        {prompt}
                      </Chip>
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
          <div className="border-b border-[color:var(--lkv-border-subtle)] p-[var(--space-4)]">
            <div className="mb-[10px] flex w-fit items-center gap-[6px] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[10px] py-1">
              <span className="font-mono text-[10px] tracking-[0.05em] text-[color:var(--lkv-primary)]">
                PHASE 5 &mdash; RAPPORT POST-EXPÉDITION
              </span>
            </div>
            <h1 className="mb-1 text-[22px] font-bold leading-[var(--leading-tight)] text-[color:var(--lkv-primary)]">
              Bilan automatique de chaque aventure
            </h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] leading-[var(--leading-snug)] text-[color:var(--lkv-text-muted)]">
              Équipement utilisé, budget réel vs estimé, retour IA personnalisé.
            </p>
            <Button fullWidth onClick={() => setShowNewReportModal(true)}>
              + Nouveau rapport
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)]">
            <Card variant="standard" className="p-[var(--space-3)]">
              <p className="mb-0.5 text-[10px] text-[color:var(--lkv-text-muted)]">Expéditions</p>
              <p className="m-0 font-mono text-[20px] font-bold text-[color:var(--lkv-primary)]">{reports.length}</p>
            </Card>
            <Card variant="standard" className="p-[var(--space-3)]">
              <p className="mb-0.5 text-[10px] text-[color:var(--lkv-text-muted)]">Score moyen</p>
              <p className="m-0 font-mono text-[20px] font-bold text-[color:var(--lkv-primary)]">{reports.length > 0 ? `${avgScore}/100` : '—'}</p>
            </Card>
            <Card variant="standard" className="p-[var(--space-3)]">
              <p className="mb-0.5 text-[10px] text-[color:var(--lkv-text-muted)]">Budget total</p>
              <p className={`m-0 font-mono text-[20px] font-bold ${totalBudgetDelta > 0 ? 'text-[color:var(--lkv-danger)]' : 'text-[color:var(--lkv-success)]'}`}>
                {totalBudgetDelta !== 0 ? `${totalBudgetDelta > 0 ? '+' : ''}${totalBudgetDelta}€` : '—'}
              </p>
            </Card>
            <Card variant="standard" className="p-[var(--space-3)]">
              <p className="mb-0.5 text-[10px] text-[color:var(--lkv-text-muted)]">Équipements</p>
              <p className="m-0 font-mono text-[20px] font-bold text-[color:var(--lkv-primary)]">
                {userGear.length > 0 ? `${(totalWeight / 1000).toFixed(1)} kg` : '—'}
              </p>
            </Card>
          </div>

          {/* Tabs */}
          <div className="px-[var(--space-4)]">
            <Tabs
              options={[
                { id: 'historique', label: 'Mes expéditions' },
                { id: 'ia', label: 'Analyse IA' },
              ]}
              value={activeTab}
              onChange={(id) => setActiveTab(id as 'historique' | 'ia')}
              ariaLabel="Sections du rapport"
            />
          </div>

          {/* ── HISTORIQUE TAB (Mobile) ── */}
          {activeTab === 'historique' && (
            <div className="p-[var(--space-4)]">
              {savedSuccess && (
                <Card variant="compact" role="status" aria-live="polite" className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)] border-[color:var(--lkv-success)]/40 bg-[color:var(--lkv-success-bg)]">
                  <span className="text-[14px] text-[color:var(--lkv-success)]" aria-hidden="true">✓</span>
                  <p className="m-0 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-primary)]">
                    Rapport créé avec succès ! +75 points fidélité.
                  </p>
                </Card>
              )}

              <div className="mb-[var(--space-3)] flex items-center justify-between">
                <p className="m-0 text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-primary)]">
                  Mes expéditions ({reports.length})
                </p>
                <Button size="sm" onClick={() => setShowNewReportModal(true)}>
                  + Nouveau
                </Button>
              </div>

              {!user && (
                <EmptyState
                  title="Connectez-vous"
                  description="Connectez-vous pour voir vos rapports d'expédition."
                />
              )}

              {loadingReports && (
                <div className="flex flex-col gap-[var(--space-3)]">
                  <Skeleton className="h-[120px] rounded-[var(--lkv-radius-sm)]" />
                  <Skeleton className="h-[120px] rounded-[var(--lkv-radius-sm)]" />
                </div>
              )}

              {!loadingReports && user && reports.length === 0 && (
                <EmptyState
                  title="Aucune expédition enregistrée"
                  description="Créez votre premier rapport."
                  actionLabel="Créer mon premier rapport"
                  onAction={() => setShowNewReportModal(true)}
                />
              )}

              {!loadingReports && user && reports.length > 0 && (
                <div className="flex flex-col gap-[var(--space-3)]">
                  {reports.slice(0, 10).map((report) => (
                    <Card
                      key={report.id}
                      variant="interactive"
                      className="overflow-hidden p-0"
                      onClick={() => setSelectedReport(report)}
                    >
                      <div
                        className="relative h-[120px]"
                        style={{ background: `url(${report.image}) center/cover` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <div className="absolute right-[var(--space-2)] top-[var(--space-2)] rounded-full bg-black/50 px-[var(--space-2)] py-0.5">
                          <span className="text-[10px] text-white/70">{report.type}</span>
                        </div>
                        <div className="absolute inset-x-[var(--space-3)] bottom-[var(--space-2)]">
                          <p className="mb-0.5 text-[14px] font-bold text-white">{report.destination}</p>
                          <p className="m-0 text-[11px] text-white/60">{report.country} · {report.date} · {report.duration}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-[var(--space-3)] py-[10px]">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--lkv-radius-xs)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn">
                            <span className="text-[12px] font-bold text-[color:var(--lkv-primary)]">{report.score}</span>
                          </div>
                          <span className="text-[10px] text-[color:var(--lkv-text-muted)]">Score</span>
                        </div>
                        <span
                          className={`text-[11px] font-medium ${
                            report.budgetDelta > 0
                              ? 'text-[color:var(--lkv-danger)]'
                              : report.budgetDelta < 0
                              ? 'text-[color:var(--lkv-success)]'
                              : 'text-[color:var(--lkv-text-muted)]'
                          }`}
                        >
                          {report.budgetDelta !== 0 ? `${report.budgetDelta > 0 ? '+' : ''}${report.budgetDelta}€ vs budget` : 'Budget non renseigné'}
                        </span>
                      </div>
                    </Card>
                  ))}
                  {reports.length > 10 && (
                    <p className="m-0 text-center font-serif text-[11px] italic text-[color:var(--lkv-text-muted)]">
                      +{reports.length - 10} autre(s) expédition(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── IA TAB (Mobile) ── */}
          {activeTab === 'ia' && (
            <div className="p-[var(--space-4)]">
              <Card variant="standard" className="overflow-hidden p-0">
                {/* Header */}
                <div className="flex items-center gap-[10px] border-b border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[var(--lkv-radius-xs)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[13px] text-[color:var(--lkv-text-primary)]" aria-hidden="true">
                    ✨
                  </div>
                  <div className="flex-1">
                    <p className="m-0 text-[13px] font-semibold text-[color:var(--lkv-primary)]">Analyse IA</p>
                    <p className="m-0 mt-px text-[10px] text-[color:var(--lkv-text-muted)]">Gemini · Analyse personnalisée</p>
                  </div>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--lkv-success)]" aria-hidden="true" />
                </div>

                {/* Profile context */}
                <div className="border-b border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
                  <div className="grid grid-cols-3 gap-[var(--space-2)]">
                    <div className="rounded-[var(--lkv-radius-xs)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)] text-center">
                      <p className="mb-0.5 font-mono text-[16px] font-bold text-[color:var(--lkv-primary)]">{reports.length}</p>
                      <p className="m-0 text-[9px] text-[color:var(--lkv-text-muted)]">Expéditions</p>
                    </div>
                    <div className="rounded-[var(--lkv-radius-xs)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)] text-center">
                      <p className="mb-0.5 font-mono text-[16px] font-bold text-[color:var(--lkv-primary)]">{avgScore > 0 ? `${avgScore}/100` : '—'}</p>
                      <p className="m-0 text-[9px] text-[color:var(--lkv-text-muted)]">Score</p>
                    </div>
                    <div className="rounded-[var(--lkv-radius-xs)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)] text-center">
                      <p className="mb-0.5 font-mono text-[16px] font-bold text-[color:var(--lkv-primary)]">{userGear.length}</p>
                      <p className="m-0 text-[9px] text-[color:var(--lkv-text-muted)]">Équipements</p>
                    </div>
                  </div>
                  {reports.length === 0 && (
                    <div className="mt-[var(--space-2)] rounded-[var(--lkv-radius-xs)] border border-[color:var(--lkv-warning)]/40 bg-[color:var(--lkv-warning-bg)] p-[var(--space-2)]">
                      <p className="m-0 text-[11px] text-[color:var(--lkv-warning-dark)]">Créez votre premier rapport pour obtenir une analyse personnalisée.</p>
                    </div>
                  )}
                </div>

                {/* Chat messages */}
                {chatMessages.length > 0 && (
                  <div className="flex max-h-[240px] flex-col gap-[10px] overflow-y-auto border-b border-[color:var(--lkv-border-subtle)] p-[var(--space-3)]">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-[var(--space-2)] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--lkv-radius-xs)] text-[10px] ${
                            msg.role === 'user'
                              ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
                              : 'bg-[color:var(--btn-tint)]  text-[color:var(--lkv-primary)]'
                          }`}
                          aria-hidden="true"
                        >
                          {msg.role === 'user' ? 'U' : 'AI'}
                        </div>
                        <div
                          className={`max-w-[75%] rounded-[var(--lkv-radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[12px] leading-[var(--leading-snug)] ${
                            msg.role === 'user'
                              ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
                              : 'bg-[color:var(--stone-100)] text-[color:var(--lkv-primary)]'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-[var(--space-2)]">
                        <div className="flex h-6 w-6 items-center justify-center rounded-[var(--lkv-radius-xs)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[10px] text-[color:var(--lkv-primary)]" aria-hidden="true">AI</div>
                        <div className="flex items-center gap-[3px] rounded-[var(--lkv-radius-sm)] bg-[color:var(--stone-100)] px-[var(--space-3)] py-[var(--space-2)]" role="status" aria-label="Analyse en cours">
                          <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[color:var(--lkv-primary)]" />
                          <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[color:var(--lkv-primary)]" />
                          <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[color:var(--lkv-primary)]" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="p-[var(--space-3)]">
                  <div className="flex gap-[var(--space-2)]">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Posez une question..."
                      aria-label="Votre question à l'analyse IA"
                      className="min-h-[var(--lkv-touch-min)] flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--stone-100)] px-[var(--space-3)] py-[10px] text-[12px] text-[color:var(--lkv-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
                    />
                    <IconButton
                      onClick={handleSend}
                      disabled={isLoading || !userInput.trim()}
                      aria-label="Envoyer la question"
                      className="bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]"
                    >
                      ➤
                    </IconButton>
                  </div>
                  <div className="mt-[var(--space-2)] flex flex-wrap gap-[6px]">
                    {['Que retirer de mon kit ?', 'Quelle destination ensuite ?', 'Comment optimiser mon budget ?'].map((prompt) => (
                      <Chip key={prompt} onClick={() => setUserInput(prompt)} className="text-[10px]">
                        {prompt}
                      </Chip>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Footer spacer */}
          <div className="h-[calc(var(--nav-height)+var(--space-6)+var(--safe-bottom))]" />
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