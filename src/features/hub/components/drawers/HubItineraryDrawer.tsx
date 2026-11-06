'use client';

/**
 * src/features/hub/components/drawers/HubItineraryDrawer.tsx
 *
 * Tiroir Itinéraire Liquid Glass iOS 27 conforme au système de Compte V8 :
 * - Navigation principale par capsule 48px en haut (.lkdv-drawer-tabs avec .sel-lens)
 * - Navigation sous-tiroir par mini-sélecteur flottant en bas à droite (.ig-tabs avec .ig-th)
 * - ZÉRO SCROLL VERTICAL (overflow: hidden) — passage d'une journée ou vue à l'autre par les sélecteurs
 */

import React, { useState } from 'react';
import {
  Compass,
  Mountain,
  Route,
  MapPin,
  Flame,
  Droplets,
  Clock,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';
import { CampMap } from '../CampMap';
import type { TripFull } from '@/features/trips/types/trip.types';

export interface HubItineraryDrawerProps {
  trip?: TripFull | null;
  effectiveRouteCoords: [number, number][];
  effectiveTitle: string;
  onOpenDepart: () => void;
}

const DAYS_DATA = [
  {
    dayNumber: 1,
    title: 'Le sentier du lac',
    place: 'Prairies et rives turquoise',
    distance: '8,4 km',
    time: '3 h 10',
    up: '+420 m',
    steps: ['Départ du camp', 'Point de vue du lac', 'Rives & prairies'],
    altMin: '1 650 m',
    altMax: '2 070 m',
  },
  {
    dayNumber: 2,
    title: 'Le col des Écrins',
    place: 'Traversée en haute altitude',
    distance: '12,6 km',
    time: '5 h 20',
    up: '+870 m',
    steps: ['Montée du vallon', 'Col des Écrins (2 520 m)', 'Pause panorama', 'Descente refuge'],
    altMin: '2 070 m',
    altMax: '2 520 m',
  },
  {
    dayNumber: 3,
    title: 'Le chemin du retour',
    place: 'Lumière dorée sur la crête',
    distance: '6,2 km',
    time: '2 h 15',
    up: '+180 m',
    steps: ['Ranger le bivouac', 'Sentier des mélèzes', 'Arrivée de l’aventure'],
    altMin: '1 650 m',
    altMax: '1 980 m',
  },
];

const SECONDARY_DAYS: DrawerSecondaryItem[] = [
  { id: 'j1', label: 'Jour 1', icon: <span className="text-[11px] font-bold">J1</span> },
  { id: 'j2', label: 'Jour 2', icon: <span className="text-[11px] font-bold">J2</span> },
  { id: 'j3', label: 'Jour 3', icon: <span className="text-[11px] font-bold">J3</span> },
];

const SECONDARY_MAP: DrawerSecondaryItem[] = [
  { id: 'trace', label: 'Tracé GPS', icon: <Route className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'relief', label: 'Relief', icon: <Mountain className="w-3.5 h-3.5" aria-hidden="true" /> },
];

const SECONDARY_POINTS: DrawerSecondaryItem[] = [
  { id: 'bivouac', label: 'Bivouacs', icon: <Flame className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'eau', label: 'Sources', icon: <Droplets className="w-3.5 h-3.5" aria-hidden="true" /> },
];

export function HubItineraryDrawer({
  effectiveRouteCoords,
  effectiveTitle,
  onOpenDepart,
}: HubItineraryDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeMapIndex, setActiveMapIndex] = useState(0);
  const [activePointIndex, setActivePointIndex] = useState(0);

  const currentDay = DAYS_DATA[activeDayIndex] ?? DAYS_DATA[0];

  // ── Volet 1 : Étapes du parcours (navigue via le mini-sélecteur J1/J2/J3 en bas à droite) ──
  const renderStepsPane = () => (
    <div className="h-full flex flex-col justify-between gap-3 p-1 overflow-hidden">
      <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-[var(--hub-action)]">
              JOUR {currentDay.dayNumber} · ÉTAPE OFFICIELLE
            </span>
            <h3 className="text-base font-bold camp-text-title leading-tight mt-0.5">
              {currentDay.title}
            </h3>
            <p className="text-xs camp-text-sub">{currentDay.place}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full camp-badge-forest text-xs font-extrabold shrink-0">
            {currentDay.distance}
          </span>
        </div>

        {/* 3 Métriques clés de l'étape */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-2xl camp-card-cream text-center">
            <span className="text-[10px] font-bold uppercase camp-text-sub flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-[var(--hub-action)]" aria-hidden="true" />
              Durée
            </span>
            <strong className="text-xs font-extrabold camp-text-title mt-0.5 block">
              {currentDay.time}
            </strong>
          </div>
          <div className="p-2.5 rounded-2xl camp-card-cream text-center">
            <span className="text-[10px] font-bold uppercase camp-text-sub flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-[var(--hub-action)]" aria-hidden="true" />
              Dénivelé
            </span>
            <strong className="text-xs font-extrabold text-[var(--hub-action)] mt-0.5 block">
              {currentDay.up}
            </strong>
          </div>
          <div className="p-2.5 rounded-2xl camp-card-cream text-center">
            <span className="text-[10px] font-bold uppercase camp-text-sub flex items-center justify-center gap-1">
              <Mountain className="w-3 h-3 text-[var(--hub-action)]" aria-hidden="true" />
              Altitude
            </span>
            <strong className="text-xs font-extrabold camp-text-title mt-0.5 block">
              {currentDay.altMax}
            </strong>
          </div>
        </div>

        {/* Stepper horizontal compact */}
        <div className="pt-2 border-t camp-border-subtle space-y-1.5">
          <span className="text-xs font-bold camp-text-title block">Points de passage :</span>
          <div className="space-y-1">
            {currentDay.steps.map((st, idx) => (
              <div key={st} className="flex items-center gap-2.5 text-xs camp-text-title">
                <span className="w-5 h-5 rounded-full camp-badge-forest text-[10px] font-bold grid place-items-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium truncate">{st}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenDepart}
          className="w-full min-h-[44px] rounded-2xl camp-btn-action text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-transform"
        >
          <span>Préparer le départ du jour</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  // ── Volet 2 : Carte & Relief (navigue via le mini-sélecteur Tracé / Relief en bas à droite) ──
  const renderMapPane = () => (
    <div className="h-full flex flex-col justify-between gap-2.5 p-1 overflow-hidden">
      {activeMapIndex === 0 ? (
        <div className="p-3 rounded-3xl camp-card-white shadow-xs space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
                TRACÉ MAPLIBRE V8
              </span>
              <h4 className="text-sm font-bold camp-text-title">Parcours haute montagne</h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
              27,2 km total
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border camp-border-subtle flex-1 min-h-[180px]">
            <CampMap routeCoords={effectiveRouteCoords} title={effectiveTitle} />
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
              PROFIL ALTIMÉTRIQUE
            </span>
            <h4 className="text-sm font-bold camp-text-title">Courbe d’élévation & Cols</h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl camp-card-cream space-y-1">
              <span className="text-[10px] uppercase font-bold camp-text-sub">Point culminant</span>
              <p className="text-sm font-extrabold camp-text-title">2 520 m</p>
              <small className="text-[10px] camp-text-sub">Col des Écrins (J2)</small>
            </div>
            <div className="p-3 rounded-2xl camp-card-cream space-y-1">
              <span className="text-[10px] uppercase font-bold camp-text-sub">Camp de base</span>
              <p className="text-sm font-extrabold text-[var(--hub-action)]">1 650 m</p>
              <small className="text-[10px] camp-text-sub">Rives du lac</small>
            </div>
          </div>

          <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between text-xs">
            <span className="font-semibold camp-text-title flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
              Dénivelé positif total
            </span>
            <strong className="text-sm font-extrabold text-[var(--hub-action)]">+1 470 m</strong>
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub text-center">
            Pente moyenne de 11 % · Sentiers balisés FFRandonnée
          </div>
        </div>
      )}
    </div>
  );

  // ── Volet 3 : Points d'intérêt (navigue via le mini-sélecteur Bivouacs / Eau en bas à droite) ──
  const renderPointsPane = () => (
    <div className="h-full flex flex-col justify-between gap-2.5 p-1 overflow-hidden">
      {activePointIndex === 0 ? (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
              ZONES DE BIVOUAC
            </span>
            <h4 className="text-sm font-bold camp-text-title">Emplacements autorisés</h4>
            <p className="text-xs camp-text-sub mt-0.5">Réglementation parc : tentes de 19h à 9h</p>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Bivouac du Lac Turquoise</strong>
                <small className="text-[11px] camp-text-sub">Plat herbeux abrité du vent</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                1 650 m
              </span>
            </div>

            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Refuge des Écrins</strong>
                <small className="text-[11px] camp-text-sub">Zone de repli tempête</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-card-white camp-text-sub">
                2 070 m
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--hub-primary)] shrink-0" aria-hidden="true" />
            <span>Feu au sol interdit · Pratique sans trace recommandée</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
              POINTS D'EAU
            </span>
            <h4 className="text-sm font-bold camp-text-title">Ravitaillement & Filtration</h4>
            <p className="text-xs camp-text-sub mt-0.5">Fiabilité vérifiée par la communauté</p>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Source des Prés d'Alpe</strong>
                <small className="text-[11px] camp-text-sub">Débit permanent · eau limpide</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                Potable
              </span>
            </div>

            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Torrent du Glacier</strong>
                <small className="text-[11px] camp-text-sub">Filtration obligatoire (particules)</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-card-white camp-text-sub">
                À filtrer
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[var(--hub-action)] shrink-0" aria-hidden="true" />
            <span>Filtre à eau disponible dans le kit partagé d'Alex</span>
          </div>
        </div>
      )}
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'steps',
      label: 'Étapes',
      icon: <Compass className="w-4 h-4" aria-hidden="true" />,
      render: renderStepsPane,
    },
    {
      id: 'map',
      label: 'Carte & Relief',
      icon: <Mountain className="w-4 h-4" aria-hidden="true" />,
      render: renderMapPane,
    },
    {
      id: 'points',
      label: 'Bivouacs & Eau',
      icon: <MapPin className="w-4 h-4" aria-hidden="true" />,
      render: renderPointsPane,
    },
  ];

  // Le mini-sélecteur bas-droit s'adapte automatiquement à l'onglet principal actif
  const secondary =
    activeTab === 0
      ? {
          items: SECONDARY_DAYS,
          active: activeDayIndex,
          onChange: setActiveDayIndex,
          label: 'Journées de l’itinéraire',
        }
      : activeTab === 1
        ? {
            items: SECONDARY_MAP,
            active: activeMapIndex,
            onChange: setActiveMapIndex,
            label: 'Affichage de la carte',
          }
        : {
            items: SECONDARY_POINTS,
            active: activePointIndex,
            onChange: setActivePointIndex,
            label: 'Points remarquables',
          };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      <DrawerShell
        tabs={tabs}
        activeIndex={activeTab}
        onIndexChange={setActiveTab}
        secondary={secondary}
      />
    </div>
  );
}

export default HubItineraryDrawer;
