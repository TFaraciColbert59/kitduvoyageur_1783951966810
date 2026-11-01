'use client';

/**
 * src/features/hub/components/drawers/HubDepartDrawer.tsx
 *
 * Tiroir Mon Départ / Préparation Liquid Glass iOS 27 conforme au système de Compte V8 :
 * - Navigation principale par capsule 48px en haut (.lkdv-drawer-tabs avec .sel-lens)
 * - Navigation sous-tiroir par mini-sélecteur flottant en bas à droite (.ig-tabs avec .ig-th)
 * - ZÉRO SCROLL VERTICAL (overflow: hidden) — passage d'une vérification à l'autre sans scroll
 */

import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  Clock,
  Shield,
  Droplets,
  Backpack,
  ArrowRight,
  Check,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

export interface HubDepartDrawerProps {
  onEnterStudio: () => void;
}

const SECONDARY_CHECKS: DrawerSecondaryItem[] = [
  { id: 'eau', label: 'Eau', icon: <Droplets className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'secours', label: 'Secours', icon: <Shield className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'sac', label: 'Sac', icon: <Backpack className="w-3.5 h-3.5" aria-hidden="true" /> },
];

const SECONDARY_TIMING: DrawerSecondaryItem[] = [
  { id: 'lever', label: 'Matin', icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'marche', label: 'Marche', icon: <Flame className="w-3.5 h-3.5" aria-hidden="true" /> },
];

export function HubDepartDrawer({ onEnterStudio }: HubDepartDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeCheckIndex, setActiveCheckIndex] = useState(0);
  const [activeTimingIndex, setActiveTimingIndex] = useState(0);

  const [waterReady, setWaterReady] = useState(true);
  const [firstAidReady, setFirstAidReady] = useState(true);
  const [bagReady, setBagReady] = useState(false);

  // ── Volet 1 : Vérifications clés d'avant-départ ──
  const renderChecksPane = () => (
    <div className="h-full flex flex-col justify-between gap-3 p-1 overflow-hidden">
      <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-[var(--hub-action)]">
              CHECKLIST ESSENTIELLE · AVANT LE DÉPART
            </span>
            <h3 className="text-base font-bold camp-text-title leading-tight mt-0.5">
              Contrôles de sécurité
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-full camp-badge-forest text-xs font-extrabold shrink-0">
            {waterReady && firstAidReady && bagReady ? 'Prêt' : 'En cours'}
          </span>
        </div>

        {activeCheckIndex === 0 && (
          <div className="p-3.5 rounded-2xl camp-card-cream space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs camp-text-title flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
                Gourdes & Hydratation (2L)
              </span>
              <button
                type="button"
                onClick={() => setWaterReady((prev) => !prev)}
                className={`min-h-[44px] min-w-[44px] rounded-full grid place-items-center transition-colors ${
                  waterReady ? 'camp-badge-forest' : 'camp-chip-warning'
                }`}
              >
                {waterReady ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] camp-text-sub">
              Rempli à 100 % au robinet du refuge. Pastilles de micropur dans la poche latérale.
            </p>
          </div>
        )}

        {activeCheckIndex === 1 && (
          <div className="p-3.5 rounded-2xl camp-card-cream space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs camp-text-title flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
                Trousse de secours & Survie
              </span>
              <button
                type="button"
                onClick={() => setFirstAidReady((prev) => !prev)}
                className={`min-h-[44px] min-w-[44px] rounded-full grid place-items-center transition-colors ${
                  firstAidReady ? 'camp-badge-forest' : 'camp-chip-warning'
                }`}
              >
                {firstAidReady ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] camp-text-sub">
              Désinfectant, pansements ampoules, bande élastique, couverture thermique vérifiée.
            </p>
          </div>
        )}

        {activeCheckIndex === 2 && (
          <div className="p-3.5 rounded-2xl camp-card-cream space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs camp-text-title flex items-center gap-2">
                <Backpack className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
                Répartition du sac & Poids
              </span>
              <button
                type="button"
                onClick={() => setBagReady((prev) => !prev)}
                className={`min-h-[44px] min-w-[44px] rounded-full grid place-items-center transition-colors ${
                  bagReady ? 'camp-badge-forest' : 'camp-chip-warning'
                }`}
              >
                {bagReady ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] camp-text-sub">
              Poids total actuel : 4,22 kg. Toutes les sangles de compression sont ajustées.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onEnterStudio}
          className="w-full min-h-[44px] rounded-2xl camp-btn-action text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-transform"
        >
          <Backpack className="w-4 h-4" aria-hidden="true" />
          <span>Ouvrir l’atelier Kit Studio 3D</span>
        </button>
      </div>
    </div>
  );

  // ── Volet 2 : Horaires & Plan de marche ──
  const renderTimingPane = () => (
    <div className="h-full flex flex-col justify-between gap-3 p-1 overflow-hidden">
      <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
            TIMING DE DÉPART
          </span>
          <h4 className="text-sm font-bold camp-text-title">Horaires & Lever du soleil</h4>
        </div>

        {activeTimingIndex === 0 ? (
          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Lever de camp</strong>
                <small className="text-[11px] camp-text-sub">Petit-déjeuner & rangement tentes</small>
              </div>
              <span className="text-xs font-extrabold text-[var(--hub-action)]">06 h 45</span>
            </div>
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Premières lueurs</strong>
                <small className="text-[11px] camp-text-sub">Conditions de visibilité optimales</small>
              </div>
              <span className="text-xs font-extrabold camp-text-title">07 h 12</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Départ sur les sentiers</strong>
                <small className="text-[11px] camp-text-sub">Passage du premier col avant midi</small>
              </div>
              <span className="text-xs font-extrabold text-[var(--hub-action)]">07 h 45</span>
            </div>
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Arrivée estimée bivouac</strong>
                <small className="text-[11px] camp-text-sub">Pose des tentes avant la nuit</small>
              </div>
              <span className="text-xs font-extrabold camp-text-title">16 h 30</span>
            </div>
          </div>
        )}

        <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--hub-primary)] shrink-0" aria-hidden="true" />
          <span>Créneau météo très stable : vent faible & ciel dégagé</span>
        </div>
      </div>
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'checks',
      label: 'Vérifications',
      icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />,
      render: renderChecksPane,
    },
    {
      id: 'timing',
      label: 'Horaires & Trajet',
      icon: <Clock className="w-4 h-4" aria-hidden="true" />,
      render: renderTimingPane,
    },
  ];

  const secondary =
    activeTab === 0
      ? {
          items: SECONDARY_CHECKS,
          active: activeCheckIndex,
          onChange: setActiveCheckIndex,
          label: 'Points de contrôle',
        }
      : {
          items: SECONDARY_TIMING,
          active: activeTimingIndex,
          onChange: setActiveTimingIndex,
          label: 'Horaires',
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

export default HubDepartDrawer;
