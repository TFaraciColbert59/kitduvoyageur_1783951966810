'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { Button, EmptyState, LoadingState, Tabs } from '@/components/ui';
import Link from 'next/link';
import { UserProfile, Aventure } from '@/lib/mock/compte-marceline';
import { createClient } from '@/lib/supabase/client';

interface AventuresTabProps {
  profile: UserProfile;
}

export default function AventuresTab({ profile }: AventuresTabProps) {
  const [aventures, setAventures] = useState<Aventure[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Toutes');
  const [activeYear, setActiveYear] = useState('Toutes');
  const [activityMetric, setActivityMetric] = useState<'Sorties' | 'Distance' | 'D+'>('Sorties');
  const [visibleCount, setVisibleCount] = useState(5);
  const router = useRouter();

  useEffect(() => {
    async function fetchAventures() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setAventures([]);
          return;
        }

        // Try querying travel_groups (canonical table)
        const { data, error } = await supabase
          .from('travel_groups')
          .select('*')
          .eq('owner_id', user.id)
          .order('departure_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const formatted = data.map((item: any) => ({
            id: item.id,
            title: item.name || item.title || 'Aventure alpine',
            date_detail: item.departure_date
              ? new Date(item.departure_date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Date inconnue',
            duration:
              item.departure_date && item.return_date
                ? `${Math.round(
                    (new Date(item.return_date).getTime() - new Date(item.departure_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )} jours`
                : '3 jours',
            companions: ['Alexandre', 'Camille'],
            distance: `${item.distance_km || item.group_xp || 38} km`,
            elevation: `${item.elevation_gain_m || item.optimization_score || 1840} m D+`,
            status: (item.status as any) || 'Terminée',
            image_url:
              item.cover_url ||
              item.cover_image ||
              'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
          }));
          setAventures(formatted);
        } else {
          // Fallback to sample mock data for rich UX display
          setAventures([
            {
              id: 'adv-1',
              title: 'Traversée des crêtes de Chartreuse',
              date_detail: '12 – 14 oct. 2026',
              duration: '3 jours',
              companions: ['Julien', 'Éléonore', 'Marc'],
              distance: '42 km',
              elevation: '2 850 m D+',
              status: 'Terminée',
              image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
            },
            {
              id: 'adv-2',
              title: 'Bivouac des Sept Laux & Col de la Vache',
              date_detail: '28 – 30 sept. 2026',
              duration: '2 jours',
              companions: ['Sophie', 'Thomas'],
              distance: '26 km',
              elevation: '1 920 m D+',
              status: 'Terminée',
              image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
            },
            {
              id: 'adv-3',
              title: 'Haute Route des Écrins — Étape Glacier',
              date_detail: '15 – 20 juil. 2026',
              duration: '6 jours',
              companions: ['Lucas', 'Alexandre', 'Chloé', 'David'],
              distance: '68 km',
              elevation: '4 400 m D+',
              status: 'Terminée',
              image_url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=600&q=80',
            },
            {
              id: 'adv-4',
              title: 'Tour du Mont Aiguille en autonomie',
              date_detail: '2 – 3 juin 2026',
              duration: '2 jours',
              companions: ['Julien'],
              distance: '22 km',
              elevation: '1 250 m D+',
              status: 'Terminée',
              image_url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=600&q=80',
            },
          ]);
        }
      } catch (err) {
        console.error('Error fetching aventures:', err);
        setAventures([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAventures();
  }, []);

  const filteredAventures = aventures.filter((av) => {
    if (activeYear !== 'Toutes' && !av.date_detail.includes(activeYear)) return false;
    if (activeTab === 'Toutes') return true;
    if (activeTab === 'Terminées') return av.status === 'Terminée';
    if (activeTab === 'Planifiées') return av.status === 'Planifiée';
    if (activeTab === 'Brouillons') return av.status === 'Brouillon';
    return true;
  });

  const handleExport = () => {
    try {
      const headers = ['ID', 'Titre', 'Date', 'Durée', 'Distance', 'Dénivelé', 'Statut'];
      const csvContent = [
        headers.join(','),
        ...aventures.map((av) =>
          [
            av.id,
            `"${av.title.replace(/"/g, '""')}"`,
            `"${av.date_detail}"`,
            av.duration,
            av.distance,
            av.elevation,
            av.status,
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'mes_aventures_lkdv.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur lors de l'exportation:", err);
    }
  };

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[color:var(--lkv-primary)]/5 pb-5">
        <div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-[color:var(--lkv-primary)] tracking-tight">
            Tous vos <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">groupes &amp; sorties</span>
          </h2>
          <p className="text-xs text-[color:var(--lkv-text-muted)] mt-1 font-mono">
            42 sorties enregistrées · 2 584 km cumulés · 148 000 m de D+
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="ArrowDownTrayIcon" size={14} />}
            onClick={handleExport}
            className="font-bold"
          >
            Exporter CSV
          </Button>
          <Link
            href="/groupes"
            className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-transparent bg-[color:var(--btn-tint)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 !py-2 !px-4 text-xs font-bold"
          >
            <Icon name="PlusIcon" size={14} />
            <span>Nouveau groupe</span>
          </Link>
        </div>
      </div>

      {/* STATS ROW (Liquid Glass Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-widest text-[color:var(--lkv-text-muted)] uppercase mb-2">DISTANCE 2026</span>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] backdrop-blur-[var(--blur-md)] text-3xl sm:text-4xl text-[color:var(--lkv-primary)]">786</span>
            <span className="text-sm font-bold text-[color:var(--lkv-text-muted)] font-mono">km</span>
          </div>
          <p className="text-[10px] text-[color:var(--lkv-secondary)] font-semibold flex items-center gap-1">
            <Icon name="ArrowTrendingUpIcon" size={12} />
            <span>+15% vs 2025 · 89% objectif annuel</span>
          </p>
        </div>

        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-widest text-[color:var(--lkv-text-muted)] uppercase mb-2">DÉNIVELÉ POSITIF</span>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] backdrop-blur-[var(--blur-md)] text-3xl sm:text-4xl text-[color:var(--lkv-primary)]">32,4</span>
            <span className="text-sm font-bold text-[color:var(--lkv-text-muted)] font-mono">km D+</span>
          </div>
          <p className="text-[10px] text-[color:var(--lkv-text-muted)] font-mono">
            +2 400 m ce mois · 12 sommets &gt; 2000m
          </p>
        </div>

        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-widest text-[color:var(--lkv-text-muted)] uppercase mb-2">NUITS EN REFUGE</span>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] backdrop-blur-[var(--blur-md)] text-3xl sm:text-4xl text-[color:var(--lkv-primary)]">28</span>
            <span className="text-sm font-bold text-[color:var(--lkv-text-muted)] font-mono">nuits</span>
          </div>
          <p className="text-[10px] text-[color:var(--lkv-text-muted)] font-mono">
            12 refuges différents · 5 bivouacs
          </p>
        </div>

        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-widest text-[color:var(--lkv-text-muted)] uppercase mb-2">CO₂ ÉCONOMISÉ</span>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] backdrop-blur-[var(--blur-md)] text-3xl sm:text-4xl text-[color:var(--lkv-primary)]">142</span>
            <span className="text-sm font-bold text-[color:var(--lkv-text-muted)] font-mono">kg</span>
          </div>
          <p className="text-[10px] text-[color:var(--lkv-forest-600)] font-medium">
            Équivalent mobilité douce vs avion
          </p>
        </div>
      </div>

      {/* MAIN CONTENT STACK */}
      <div className="space-y-6">
        {/* ACTIVITY CHART */}
        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-lg)] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">
                Activité <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">2026</span>
              </h3>
              <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                42 sorties réparties sur l'année · pic d'activité en septembre &amp; octobre
              </p>
            </div>

            {/* Segmented Metric Switcher */}
            <div className="inline-flex gap-[var(--space-1)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-1)] backdrop-blur-[var(--blur-md)]">
              <Tabs
                options={[
                  { id: 'Sorties', label: 'Sorties' },
                  { id: 'Distance', label: 'Distance' },
                  { id: 'D+', label: 'D+' },
                ]}
                value={activityMetric}
                onChange={(id) => setActivityMetric(id as 'Sorties' | 'Distance' | 'D+')}
                ariaLabel="Métrique d'activité"
                className="w-auto"
              />
            </div>
          </div>

          {/* Bars Chart */}
          <div className="h-40 relative flex items-end justify-between px-2 pt-6">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              <div className="border-b border-[color:var(--lkv-primary)]/5 w-full" />
              <div className="border-b border-[color:var(--lkv-primary)]/5 w-full" />
              <div className="border-b border-[color:var(--lkv-primary)]/5 w-full" />
            </div>

            {[
              { label: 'JAN', val: activityMetric === 'Sorties' ? 15 : activityMetric === 'Distance' ? 25 : 10, color: 'var(--sage-200)' },
              { label: 'FÉV', val: activityMetric === 'Sorties' ? 20 : activityMetric === 'Distance' ? 30 : 15, color: 'var(--sage-200)' },
              { label: 'MAR', val: activityMetric === 'Sorties' ? 35 : activityMetric === 'Distance' ? 50 : 25, color: 'var(--sage-300)' },
              { label: 'AVR', val: activityMetric === 'Sorties' ? 45 : activityMetric === 'Distance' ? 65 : 35, color: 'var(--sage-300)' },
              { label: 'MAI', val: activityMetric === 'Sorties' ? 55 : activityMetric === 'Distance' ? 80 : 45, color: 'var(--lkv-secondary)' },
              { label: 'JUN', val: activityMetric === 'Sorties' ? 60 : activityMetric === 'Distance' ? 85 : 50, color: 'var(--lkv-secondary)' },
              { label: 'JUL', val: activityMetric === 'Sorties' ? 55 : activityMetric === 'Distance' ? 75 : 45, color: 'var(--lkv-secondary)' },
              { label: 'AOÛ', val: activityMetric === 'Sorties' ? 65 : activityMetric === 'Distance' ? 90 : 55, color: 'var(--lkv-secondary)' },
              { label: 'SEP', val: activityMetric === 'Sorties' ? 80 : activityMetric === 'Distance' ? 100 : 70, color: 'var(--lkv-forest-600)' },
              { label: 'OCT', val: activityMetric === 'Sorties' ? 85 : activityMetric === 'Distance' ? 120 : 80, color: 'var(--lkv-primary)' },
              { label: 'NOV', val: 0, color: 'var(--sand-300)' },
              { label: 'DÉC', val: 0, color: 'var(--sand-300)' },
            ].map((month, idx) => {
              const normalizedVal = month.val > 100 ? 100 : month.val;
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 relative z-[var(--z-dropdown)] w-full group">
                  <div className="w-full flex justify-center items-end h-28">
                    <div
                      className="w-4 sm:w-6 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      style={{ height: `${normalizedVal}%`, backgroundColor: month.color }}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-[color:var(--lkv-text-muted)]">{month.label}</span>
                  {month.val > 0 && (
                    <span className="absolute -top-3 text-[9px] font-mono font-bold text-[color:var(--lkv-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {month.val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* HISTORIQUE COMPLET */}
        <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-lg)] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">
                Historique <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">des sorties</span>
              </h3>
            </div>
            <div className="text-[11px] text-[color:var(--lkv-text-muted)] font-mono">
              {aventures.length} résultats · triés par date
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--lkv-primary)]/5 pb-3">
            <span className="text-[10px] font-mono text-[color:var(--lkv-text-muted)] mr-1 uppercase font-bold">Année</span>
            <Tabs
              options={['Toutes', '2026', '2025', '2024'].map((year) => ({ id: year, label: year }))}
              value={activeYear}
              onChange={setActiveYear}
              variant="scrollable"
              ariaLabel="Filtrer par année"
              className="w-auto"
            />

            <div className="w-[1px] h-4 bg-[color:var(--lkv-primary)]/10 mx-2" />

            <span className="text-[10px] font-mono text-[color:var(--lkv-text-muted)] mr-1 uppercase font-bold">Statut</span>
            <Tabs
              options={['Toutes', 'Terminées', 'Planifiées', 'Brouillons'].map((tab) => ({ id: tab, label: tab }))}
              value={activeTab}
              onChange={setActiveTab}
              variant="scrollable"
              ariaLabel="Filtrer par statut"
              className="w-auto"
            />
          </div>

          {/* List */}
          <div className="space-y-3">
            {loading ? (
              <LoadingState label="Chargement des sorties…" compact />
            ) : filteredAventures.length === 0 ? (
              <EmptyState compact title="Aucune sortie trouvée" description="Aucune sortie ne correspond à ces critères." />
            ) : (
              filteredAventures.slice(0, visibleCount).map((av) => (
                <div
                  key={av.id}
                  onClick={() => router.push(`/groupes/${av.id}`)}
                  className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/80 transition-all border border-white/40 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white bg-stone-200">
                      <Image
                        src={av.image_url}
                        alt={av.title}
                        fill
                        sizes="56px"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[color:var(--lkv-primary)] truncate group-hover:text-[color:var(--lkv-secondary)] transition-colors">
                        {av.title}
                      </h4>
                      <p className="text-[11px] text-[color:var(--lkv-text-muted)] font-mono mt-0.5">
                        {av.date_detail} · {av.duration}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[color:var(--lkv-text-muted)]">
                        <span>👥 {av.companions.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-[color:var(--lkv-primary)]/5 pt-2 sm:pt-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-[color:var(--lkv-primary)]">{av.distance}</div>
                      <div className="text-[10px] text-[color:var(--lkv-text-muted)] font-mono">{av.elevation}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[9.5px] font-bold ${
                          av.status === 'En cours' ? 'pill-warn' : ''
                        }`}
                      >
                        {av.status}
                      </span>

                      <div className="w-7 h-7 rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] flex items-center justify-center text-[color:var(--lkv-text-muted)] group-hover:text-[color:var(--lkv-primary)] group-hover:brightness-[1.05] transition-colors">
                        <Icon name="ArrowRightIcon" size={12} />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {visibleCount < filteredAventures.length && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + 5)}
                className="font-bold"
              >
                Charger {filteredAventures.length - visibleCount} groupes supplémentaires
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
