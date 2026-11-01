'use client';

/**
 * src/features/hub/components/drawers/HubChecklistDrawer.tsx
 *
 * Tiroir Checklist / À ne pas oublier Liquid Glass iOS 27 conforme Compte V8 :
 * - Haut : sélecteur à 3 volets (Éléments Vitaux, Bivouac & Nuit, Vêtements)
 * - Bas-droite : mini-sélecteur capsule
 * - Strict zéro scroll vertical (overflow-hidden)
 */

import React, { useState } from 'react';
import {
  CheckSquare,
  Flame,
  Shirt,
  Check,
  AlertCircle,
  ShieldCheck,
  Backpack,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

const VITAL_ITEMS = [
  {
    id: 'eau',
    label: 'Eau',
    title: 'Hydratation & Ravitaillement',
    items: [
      { name: 'Poche à eau 2 L remplie', ready: true },
      { name: 'Gourde filtrante 1 L prête', ready: true },
      { name: 'Comprimés Micropur de secours', ready: true },
      { name: 'Électrolytes en pastilles', ready: false },
    ],
  },
  {
    id: 'secours',
    label: 'Secours',
    title: 'Trousse médicale d’urgence',
    items: [
      { name: 'Pansements ampoules (Compeed)', ready: true },
      { name: 'Bandes élastiques de contention', ready: true },
      { name: 'Couverture de survie renforcée', ready: true },
      { name: 'Antalgiques & désinfectant', ready: true },
    ],
  },
  {
    id: 'balise',
    label: 'Balise',
    title: 'Communication satellite & Énergie',
    items: [
      { name: 'Balise inReach chargée 100%', ready: true },
      { name: 'Batterie externe 10 000 mAh', ready: true },
      { name: 'Câble USB étanche testé', ready: true },
      { name: 'Lampe frontale piles neuves', ready: true },
    ],
  },
];

const BIVOUAC_ITEMS = [
  {
    id: 'tente',
    label: 'Tente',
    title: 'Abri & Protection sol',
    items: [
      { name: 'Toile tente MSR Hubba Hubba', ready: true },
      { name: 'Jeu complet de 8 piquets alu', ready: true },
      { name: 'Arceaux vérifiés sans fissure', ready: true },
      { name: 'Tapis de sol étanche (footprint)', ready: true },
    ],
  },
  {
    id: 'duvet',
    label: 'Duvet',
    title: 'Système de couchage thermique',
    items: [
      { name: 'Sac de couchage confort 0°C', ready: true },
      { name: 'Matelas isolant gonflable', ready: true },
      { name: 'Sac étanche de compression', ready: true },
      { name: 'Oreiller gonflable compact', ready: true },
    ],
  },
  {
    id: 'rechaud',
    label: 'Réchaud',
    title: 'Cuisine & Feu de camp',
    items: [
      { name: 'Brûleur réchaud à gaz propre', ready: true },
      { name: 'Cartouche de gaz 230 g pleine', ready: true },
      { name: 'Briquet étanche piezo', ready: true },
      { name: 'Popote titane avec couvercle', ready: true },
    ],
  },
];

const CLOTHING_ITEMS = [
  {
    id: 'chaud',
    label: 'Chaud',
    title: 'Couche thermique (Isolant)',
    items: [
      { name: 'Doudoune compressible 800 cuin', ready: true },
      { name: 'Polaire respirante demi-zip', ready: true },
      { name: 'Gants légers coupe-vent', ready: true },
      { name: 'Bonnet thermique en mérinos', ready: true },
    ],
  },
  {
    id: 'pluie',
    label: 'Pluie',
    title: 'Couche externe (Imperméable)',
    items: [
      { name: 'Veste Gore-Tex Pro 3 couches', ready: true },
      { name: 'Surpantalon imper-respirant', ready: true },
      { name: 'Housse de sac de pluie', ready: true },
      { name: 'Sacs étanches pour vêtements', ready: true },
    ],
  },
  {
    id: 'tete',
    label: 'Tête',
    title: 'Protection solaire & Vue',
    items: [
      { name: 'Lunettes de glacier catégorie 4', ready: true },
      { name: 'Casquette respirante avec protège-nuque', ready: true },
      { name: 'Crème solaire indice 50+ compacte', ready: true },
      { name: 'Baume à lèvres protection UV', ready: true },
    ],
  },
];

export function HubChecklistDrawer({ onEnterStudio }: { onEnterStudio?: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [vitalIndex, setVitalIndex] = useState(0);
  const [bivouacIndex, setBivouacIndex] = useState(0);
  const [clothIndex, setClothIndex] = useState(0);

  const curVital = VITAL_ITEMS[vitalIndex] ?? VITAL_ITEMS[0];
  const curBivouac = BIVOUAC_ITEMS[bivouacIndex] ?? BIVOUAC_ITEMS[0];
  const curCloth = CLOTHING_ITEMS[clothIndex] ?? CLOTHING_ITEMS[0];

  const renderItemList = (title: string, items: { name: string; ready: boolean }[]) => (
    <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
      <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
          Vérification d’équipement
        </span>
        <h4 className="text-sm font-bold camp-text-title leading-tight">{title}</h4>
      </div>

      <div className="space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-5 h-5 rounded-full grid place-items-center shrink-0 ${
                  it.ready
                    ? 'bg-[var(--hub-primary-subtle)] text-[var(--hub-primary)]'
                    : 'bg-[var(--hub-warning-bg)] text-[var(--hub-warning)]'
                }`}
              >
                {it.ready ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              </span>
              <span className="text-xs font-semibold camp-text-title truncate">{it.name}</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                it.ready ? 'camp-chip-success' : 'camp-chip-warning'
              }`}
            >
              {it.ready ? 'Prêt' : 'À faire'}
            </span>
          </div>
        ))}
      </div>

      <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center gap-2 text-xs">
        <ShieldCheck className="w-4 h-4 text-[var(--hub-primary)] shrink-0" />
        <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
          95 % des équipements validés pour l’expédition.
        </span>
      </div>
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'vital',
      label: 'Vital',
      icon: <CheckSquare className="w-4 h-4" aria-hidden="true" />,
      render: () => renderItemList(curVital.title, curVital.items),
    },
    {
      id: 'bivouac',
      label: 'Bivouac',
      icon: <Flame className="w-4 h-4" aria-hidden="true" />,
      render: () => renderItemList(curBivouac.title, curBivouac.items),
    },
    {
      id: 'cloth',
      label: 'Vêtements',
      icon: <Shirt className="w-4 h-4" aria-hidden="true" />,
      render: () => renderItemList(curCloth.title, curCloth.items),
    },
  ];

  const secondaryConfig =
    activeTab === 0
      ? {
          items: VITAL_ITEMS.map((v) => ({
            id: v.id,
            label: v.label,
            icon: <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />,
          })),
          active: vitalIndex,
          onChange: setVitalIndex,
          label: 'Catégorie',
        }
      : activeTab === 1
        ? {
            items: BIVOUAC_ITEMS.map((b) => ({
              id: b.id,
              label: b.label,
              icon: <Flame className="w-3.5 h-3.5" aria-hidden="true" />,
            })),
            active: bivouacIndex,
            onChange: setBivouacIndex,
            label: 'Bivouac',
          }
        : {
            items: CLOTHING_ITEMS.map((c) => ({
              id: c.id,
              label: c.label,
              icon: <Shirt className="w-3.5 h-3.5" aria-hidden="true" />,
            })),
            active: clothIndex,
            onChange: setClothIndex,
            label: 'Tenue',
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

export default HubChecklistDrawer;
