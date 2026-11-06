'use client';

/**
 * src/features/hub/components/drawers/HubJournalDrawer.tsx
 *
 * Tiroir Carnet de bord / Journal Liquid Glass iOS 27 conforme Compte V8 :
 * - Haut : sélecteur à 3 volets (Notes de route, Météo constatée, Faune & Flore)
 * - Bas-droite : mini-sélecteur capsule
 * - Strict zéro scroll vertical (overflow-hidden)
 */

import React, { useState } from 'react';
import {
  BookOpen,
  CloudSun,
  Eye,
  Camera,
  Compass,
  Thermometer,
  PenLine,
  CheckCircle2,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

const JOURNAL_DAYS = [
  {
    id: 'j1',
    label: 'J1',
    title: 'Départ du camp vers le Brévent',
    time: '14 Juillet · 08:30',
    notes: 'Départ sous une brume légère qui s’est dissipée dès 1 800 m. Sentier bien balisé, source d’eau vive très active au virage 4.',
    feel: 'Rythme fluide, sacs bien équilibrés.',
  },
  {
    id: 'j2',
    label: 'J2',
    title: 'L’arête du Lac Blanc',
    time: '15 Juillet · 07:15',
    notes: 'Montée soutenue dans les éboulis. Vue spectaculaire sur les Grandes Jorasses. Pause bivouac sur la pelouse alpine en surplomb.',
    feel: 'Effort intense mais moral au plus haut.',
  },
  {
    id: 'j3',
    label: 'J3',
    title: 'Descente vers Les Houches',
    time: '16 Juillet · 09:00',
    notes: 'Descente par la forêt de mélèzes. Traversée du torrent sans encombre sur la passerelle rénovée.',
    feel: 'Clôture de trek parfaite, 0 blessure.',
  },
];

const WEATHER_OBSERVATIONS = [
  {
    id: 'matin',
    label: 'Matin',
    period: 'Relevé de 07:30',
    temp: '11°C',
    conditions: 'Ciel bleu limpide · Léger vent de nord',
    desc: 'Conditions idéales de marche. Pas d’humidité résiduelle sur les tentes.',
  },
  {
    id: 'midi',
    label: 'Midi',
    period: 'Relevé de 12:45',
    temp: '22°C',
    conditions: 'Soleil franc · Chaleur sur les versants sud',
    desc: 'Hydratation régulière nécessaire. Ravitaillement au torrent à mi-parcours.',
  },
  {
    id: 'soir',
    label: 'Soir',
    period: 'Relevé de 19:30',
    temp: '8°C',
    conditions: 'Brume thermique en fond de vallée',
    desc: 'Baisse rapide des températures au coucher du soleil. Doudounes de mise.',
  },
];

const NATURE_SPOTS = [
  {
    id: 'marmotte',
    label: 'Marmotte',
    species: 'Marmotte alpine (Marmota marmota)',
    spot: 'Versant est du col · 2 150 m',
    notes: 'Famille de 4 individus observée sur les pierriers ensoleillés. Cris d’alerte audibles à 300 m.',
  },
  {
    id: 'bouquetin',
    label: 'Bouquetin',
    species: 'Bouquetin des Alpes (Capra ibex)',
    spot: 'Crête rocheuse · 2 480 m',
    notes: 'Deux grands mâles avec cornes imposantes à moins de 50 m du sentier, totalement calmes.',
  },
  {
    id: 'flore',
    label: 'Flore',
    species: 'Gentiane acaule & Edelweiss',
    spot: 'Pelouse calcaire · 2 200 m',
    notes: 'Floraison remarquable en début d’été. Espèces protégées, observation et photos uniquement.',
  },
];

export function HubJournalDrawer() {
  const [activeTab, setActiveTab] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [weatherIndex, setWeatherIndex] = useState(0);
  const [natureIndex, setNatureIndex] = useState(0);

  const curDay = JOURNAL_DAYS[dayIndex] ?? JOURNAL_DAYS[0];
  const curWeather = WEATHER_OBSERVATIONS[weatherIndex] ?? WEATHER_OBSERVATIONS[0];
  const curNature = NATURE_SPOTS[natureIndex] ?? NATURE_SPOTS[0];

  const tabs: DrawerTab[] = [
    {
      id: 'notes',
      label: 'Notes de route',
      icon: <PenLine className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                {curDay.label} · Carnet de bord
              </span>
              <span className="text-[10px] camp-text-sub font-semibold">{curDay.time}</span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curDay.title}</h4>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] space-y-2 flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed italic">« {curDay.notes} »</p>
            <div className="pt-1.5 border-t border-[var(--hub-border-subtle)]">
              <strong className="text-[10px] font-bold uppercase text-[var(--hub-action)] block">
                Ressenti de cordée :
              </strong>
              <p className="text-[11px] font-semibold text-[var(--hub-primary)]">{curDay.feel}</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center justify-between text-xs">
            <span className="camp-text-sub text-[11px]">Dernière synchronisation locale :</span>
            <strong className="text-[var(--hub-primary)] font-bold">Enregistré</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'meteo',
      label: 'Météo constatée',
      icon: <CloudSun className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                {curWeather.period}
              </span>
              <span className="text-sm font-black text-[var(--hub-primary)] px-2 py-0.5 rounded-full bg-[var(--hub-primary-subtle)]">
                {curWeather.temp}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curWeather.conditions}</h4>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed">{curWeather.desc}</p>
          </div>

          <div className="p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex items-center justify-between text-xs">
            <span className="camp-text-sub">Pression atmosphérique :</span>
            <strong className="camp-text-title">1 018 hPa (stable)</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'nature',
      label: 'Faune & Flore',
      icon: <Eye className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
              {curNature.spot}
            </span>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curNature.species}</h4>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed">{curNature.notes}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-[var(--hub-primary)] shrink-0" />
            <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
              Observation inscrite au carnet naturaliste.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const secondaryConfig =
    activeTab === 0
      ? {
          items: JOURNAL_DAYS.map((d) => ({
            id: d.id,
            label: d.label,
            icon: <span className="text-[11px] font-bold">{d.label}</span>,
          })),
          active: dayIndex,
          onChange: setDayIndex,
          label: 'Journée',
        }
      : activeTab === 1
        ? {
            items: WEATHER_OBSERVATIONS.map((w) => ({
              id: w.id,
              label: w.label,
              icon: <span className="text-[11px] font-bold">{w.label}</span>,
            })),
            active: weatherIndex,
            onChange: setWeatherIndex,
            label: 'Période',
          }
        : {
            items: NATURE_SPOTS.map((n) => ({
              id: n.id,
              label: n.label,
              icon: <span className="text-[11px] font-bold">{n.label}</span>,
            })),
            active: natureIndex,
            onChange: setNatureIndex,
            label: 'Espèce',
          };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <DrawerShell
        tabs={tabs}
        activeIndex={activeTab}
        onIndexChange={setActiveTab}
        secondary={secondaryConfig}
      />
    </div>
  );
}

export default HubJournalDrawer;
