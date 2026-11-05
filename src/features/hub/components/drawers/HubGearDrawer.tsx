'use client';

/**
 * src/features/hub/components/drawers/HubGearDrawer.tsx
 *
 * Tiroir Équipement / Matériel Liquid Glass iOS 27 conforme Compte V8 :
 * - Haut : sélecteur à 3 volets (Mon sac, Partagé, Bilan poids)
 * - Bas-droite : mini-sélecteur capsule (Fond / Milieu / Haut ou Abri / Popote)
 * - Strict zéro scroll vertical (overflow-hidden)
 */

import React, { useState } from 'react';
import {
  Package,
  Layers,
  Scale,
  Sparkles,
  ShieldCheck,
  Check,
  AlertCircle,
  ArrowRight,
  Flame,
  Tent,
  UtensilsCrossed,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

export interface HubGearDrawerProps {
  onEnterStudio?: () => void;
}

const BAG_ZONES = [
  {
    id: 'bottom',
    label: 'Fond',
    title: 'Fond de sac — Couchage & Bivouac',
    weight: '3,2 kg',
    desc: 'Matériel peu sollicité durant la journée, centre de gravité bas.',
    items: [
      { name: 'Sac de couchage confort 0°C', weight: '980 g', checked: true },
      { name: 'Matelas gonflable isolé R-Value 4.2', weight: '490 g', checked: true },
      { name: 'Tente 2P ultralégère (double toit)', weight: '1 420 g', checked: true },
      { name: 'Drap de soie thermique', weight: '130 g', checked: true },
    ],
  },
  {
    id: 'middle',
    label: 'Milieu',
    title: 'Corps de sac — Vêtements & Vivres',
    weight: '4,8 kg',
    desc: 'Charges denses plaquées contre le dos pour préserver l’équilibre.',
    items: [
      { name: 'Doudoune compressible 800 cuin', weight: '360 g', checked: true },
      { name: 'Veste Gore-Tex 3 couches', weight: '410 g', checked: true },
      { name: 'Ravitaillement 3 jours lyophilisé', weight: '2 100 g', checked: true },
      { name: 'Popote titane & réchaud gaz', weight: '540 g', checked: true },
    ],
  },
  {
    id: 'top',
    label: 'Haut',
    title: 'Haut de sac — Accès immédiat',
    weight: '2,4 kg',
    desc: 'Objets d’urgence, sécurité, hydratation et orientation.',
    items: [
      { name: 'Gourde filtrante 1L + poche 2L', weight: '1 200 g', checked: true },
      { name: 'Trousse de premiers secours', weight: '340 g', checked: true },
      { name: 'Lampe frontale 450 lm + batterie', weight: '210 g', checked: true },
      { name: 'Balise satellite & carte IGN', weight: '180 g', checked: true },
    ],
  },
];

const SHARED_GROUPS = [
  {
    id: 'shelter',
    label: 'Abri',
    carrier: 'Camille (CM)',
    title: 'Pôle Bivouac & Nuit',
    totalWeight: '2,9 kg',
    items: [
      { name: 'Tente MSR Hubba Hubba 3P', weight: '1 720 g' },
      { name: 'Tarp de protection sol & arceaux', weight: '680 g' },
      { name: 'Lampe d’ambiance bivouac', weight: '140 g' },
    ],
  },
  {
    id: 'cooking',
    label: 'Cuisine',
    carrier: 'Alex (AL)',
    title: 'Pôle Cuisine & Eau',
    totalWeight: '3,4 kg',
    items: [
      { name: 'Réchaud bi-feu & cartouches gaz', weight: '820 g' },
      { name: 'Set popote collective 2,5 L', weight: '710 g' },
      { name: 'Filtre par gravité Katadyn Basecamp', weight: '490 g' },
    ],
  },
  {
    id: 'safety',
    label: 'Sécurité',
    carrier: 'Tony (Moi)',
    title: 'Pôle Secours & Navigation',
    totalWeight: '1,8 kg',
    items: [
      { name: 'Balise Garmin inReach Explorer', weight: '240 g' },
      { name: 'Grande trousse médicale cordée', weight: '860 g' },
      { name: 'Cordelette de rappel 30 m', weight: '700 g' },
    ],
  },
];

const WEIGHT_STATS = [
  { label: 'Poids de base (sac nu)', value: '7,8 kg', note: 'Excellente charge' },
  { label: 'Consommables (eau + vivres)', value: '3,4 kg', note: '3 jours d’autonomie' },
  { label: 'Poids total sur le dos', value: '11,2 kg', note: '14 % du poids corporel' },
];

export function HubGearDrawer({ onEnterStudio }: HubGearDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [zoneIndex, setZoneIndex] = useState(0);
  const [sharedIndex, setSharedIndex] = useState(0);
  const [balanceIndex, setBalanceIndex] = useState(0);

  const curZone = BAG_ZONES[zoneIndex] ?? BAG_ZONES[0];
  const curShared = SHARED_GROUPS[sharedIndex] ?? SHARED_GROUPS[0];

  const tabs: DrawerTab[] = [
    {
      id: 'bag',
      label: 'Mon sac',
      icon: <Package className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          {/* Card titre et synthèse de zone */}
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                Zone de portage · {curZone.label}
              </span>
              <span className="text-xs font-black text-[var(--hub-primary)] px-2 py-0.5 rounded-full bg-[var(--hub-primary-subtle)]">
                {curZone.weight}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curZone.title}</h4>
            <p className="text-[11px] camp-text-sub leading-snug">{curZone.desc}</p>
          </div>

          {/* Liste des 4 articles de la zone */}
          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
            {curZone.items.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[var(--hub-primary-subtle)] text-[var(--hub-primary)] grid place-items-center shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                  <span className="text-xs font-semibold camp-text-title truncate">{it.name}</span>
                </div>
                <span className="text-[11px] font-medium camp-text-sub shrink-0 ml-2">{it.weight}</span>
              </div>
            ))}
          </div>

          {/* Bouton rapide Kit Studio */}
          {onEnterStudio ? (
            <button
              type="button"
              onClick={onEnterStudio}
              className="w-full min-h-[44px] rounded-xl camp-btn-primary text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-transform"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ajuster dans Kit Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      ),
    },
    {
      id: 'shared',
      label: 'Partagé',
      icon: <Layers className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          {/* Card groupe partagé */}
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                Porté par {curShared.carrier}
              </span>
              <span className="text-xs font-black text-[var(--hub-primary)] px-2 py-0.5 rounded-full bg-[var(--hub-primary-subtle)]">
                {curShared.totalWeight}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curShared.title}</h4>
          </div>

          {/* Liste matériel collectif */}
          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
            {curShared.items.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[var(--hub-primary-subtle)] text-[var(--hub-primary)] grid place-items-center shrink-0">
                    <Tent className="w-3 h-3" />
                  </span>
                  <span className="text-xs font-semibold camp-text-title truncate">{it.name}</span>
                </div>
                <span className="text-[11px] font-medium camp-text-sub shrink-0 ml-2">{it.weight}</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex items-center justify-between text-xs">
            <span className="camp-text-sub">Total matériel partagé :</span>
            <strong className="camp-text-title">8,1 kg répartis sur 3 pers</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'weight',
      label: 'Bilan poids',
      icon: <Scale className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] text-center space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
              Poids total sur le dos
            </span>
            <div className="text-3xl font-black camp-text-title">11,2 kg</div>
            <p className="text-[11px] camp-text-sub">Charge optimale pour un trek de 3 jours en autonomie</p>
          </div>

          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
            {WEIGHT_STATS.map((st, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)]"
              >
                <div>
                  <strong className="text-xs camp-text-title block">{st.label}</strong>
                  <small className="text-[10px] camp-text-sub">{st.note}</small>
                </div>
                <span className="text-xs font-bold text-[var(--hub-primary)]">{st.value}</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center gap-2 text-xs">
            <ShieldCheck className="w-4 h-4 text-[var(--hub-primary)] shrink-0" />
            <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
              Sac validé : inférieur à la limite recommandée de 15 kg.
            </span>
          </div>
        </div>
      ),
    },
  ];

  // Sélecteur secondaire bas-droite selon l'onglet actif
  const secondaryConfig =
    activeTab === 0
      ? {
          items: BAG_ZONES.map((z) => ({
            id: z.id,
            label: z.label,
            icon: <span className="text-[11px] font-bold">{z.label}</span>,
          })),
          active: zoneIndex,
          onChange: setZoneIndex,
          label: 'Zone de portage',
        }
      : activeTab === 1
        ? {
            items: SHARED_GROUPS.map((g) => ({
              id: g.id,
              label: g.label,
              icon: <span className="text-[11px] font-bold">{g.label}</span>,
            })),
            active: sharedIndex,
            onChange: setSharedIndex,
            label: 'Pôle partagé',
          }
        : {
            items: [
              { id: 'moi', label: 'Moi', icon: <span className="text-[11px] font-bold">Moi</span> },
              { id: 'groupe', label: 'Groupe', icon: <span className="text-[11px] font-bold">Groupe</span> },
            ],
            active: balanceIndex,
            onChange: setBalanceIndex,
            label: 'Répartition',
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

export default HubGearDrawer;
