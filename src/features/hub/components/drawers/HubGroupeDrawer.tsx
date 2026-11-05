'use client';

/**
 * src/features/hub/components/drawers/HubGroupeDrawer.tsx
 *
 * Tiroir Groupe & Équipage Liquid Glass iOS 27 conforme au système de Compte V8 :
 * - Navigation principale par capsule 48px en haut (.lkdv-drawer-tabs avec .sel-lens)
 * - Navigation sous-tiroir par mini-sélecteur flottant en bas à droite (.ig-tabs avec .ig-th)
 *   « on fait défiler les kits des participants comme les slots du drawer Kit de la page Compte » (KIT_STUDIO_SPEC §8)
 * - ZÉRO SCROLL VERTICAL (overflow: hidden) — passage d'un membre ou vue à l'autre par les sélecteurs
 */

import React, { useState } from 'react';
import {
  Users,
  Package,
  Scale,
  Shield,
  Backpack,
  Flame,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

export interface HubGroupeDrawerProps {
  onEnterStudio: () => void;
}

const MEMBERS = [
  {
    id: 'tf',
    initials: 'TF',
    name: 'Moi (Tony)',
    role: 'Mon kit personnel · propriétaire',
    weight: '4,22 kg',
    sharePct: '35 %',
    items: [
      { name: 'Sac Alpin 40 L', cat: 'Portage' },
      { name: 'Tente ultra-légère 2 places', cat: 'Partagé · Abri' },
      { name: 'Trousse de secours & couverture', cat: 'Sécurité' },
      { name: 'Gourde inox isotherme 1L', cat: 'Hydratation' },
    ],
  },
  {
    id: 'cm',
    initials: 'CM',
    name: 'Camille',
    role: 'Kit partagé · lecture seule',
    weight: '3,86 kg',
    sharePct: '32 %',
    items: [
      { name: 'Sac de randonnée 38 L', cat: 'Portage' },
      { name: 'Réchaud gaz bivouac', cat: 'Partagé · Cuisine' },
      { name: 'Popote duo aluminium', cat: 'Partagé · Cuisine' },
      { name: 'Tasse isotherme & couverts', cat: 'Repas' },
    ],
  },
  {
    id: 'al',
    initials: 'AL',
    name: 'Alex',
    role: 'Kit partagé · lecture seule',
    weight: '4,05 kg',
    sharePct: '33 %',
    items: [
      { name: 'Sac de trekking 45 L', cat: 'Portage' },
      { name: 'Filtre à eau céramique', cat: 'Partagé · Eau' },
      { name: 'Duvet grand froid (-5°C)', cat: 'Bivouac' },
      { name: 'Lampe frontale 450 lm', cat: 'Sécurité' },
    ],
  },
];

const SECONDARY_MEMBERS: DrawerSecondaryItem[] = [
  { id: 'tf', label: 'TF', icon: <span className="text-[11px] font-bold">TF</span> },
  { id: 'cm', label: 'CM', icon: <span className="text-[11px] font-bold">CM</span> },
  { id: 'al', label: 'AL', icon: <span className="text-[11px] font-bold">AL</span> },
];

const SECONDARY_SHARED: DrawerSecondaryItem[] = [
  { id: 'abri', label: 'Abri', icon: <Flame className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'cuisine', label: 'Repas', icon: <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" /> },
];

const SECONDARY_BALANCE: DrawerSecondaryItem[] = [
  { id: 'poids', label: 'Poids', icon: <Scale className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'securite', label: 'Sécurité', icon: <Shield className="w-3.5 h-3.5" aria-hidden="true" /> },
];

export function HubGroupeDrawer({ onEnterStudio }: HubGroupeDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeMemberIndex, setActiveMemberIndex] = useState(0);
  const [activeSharedIndex, setActiveSharedIndex] = useState(0);
  const [activeBalanceIndex, setActiveBalanceIndex] = useState(0);

  const currentMember = MEMBERS[activeMemberIndex] ?? MEMBERS[0];

  // ── Volet 1 : Équipage (défile via le mini-sélecteur TF/CM/AL en bas à droite) ──
  const renderCrewPane = () => (
    <div className="h-full flex flex-col justify-between gap-3 p-1 overflow-hidden">
      <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full camp-badge-forest font-bold text-xs grid place-items-center shrink-0">
              {currentMember.initials}
            </span>
            <div>
              <h3 className="text-sm font-bold camp-text-title leading-tight">
                {currentMember.name}
              </h3>
              <p className="text-[11px] camp-text-sub">{currentMember.role}</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full camp-badge-forest text-xs font-extrabold shrink-0">
            {currentMember.weight}
          </span>
        </div>

        {/* Liste des équipements du membre */}
        <div className="pt-2 border-t camp-border-subtle space-y-1.5">
          <span className="text-xs font-bold camp-text-title block">Équipements emportés :</span>
          <div className="space-y-1">
            {currentMember.items.map((it) => (
              <div
                key={it.name}
                className="flex items-center justify-between p-2 rounded-xl camp-card-cream text-xs"
              >
                <span className="font-semibold camp-text-title flex items-center gap-2 truncate">
                  <Package className="w-3.5 h-3.5 text-[var(--hub-action)] shrink-0" aria-hidden="true" />
                  <span className="truncate">{it.name}</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-card-white camp-text-sub shrink-0">
                  {it.cat}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onEnterStudio}
          className="w-full min-h-[44px] rounded-2xl camp-btn-action text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-transform"
        >
          <Backpack className="w-4 h-4" aria-hidden="true" />
          <span>
            {activeMemberIndex === 0
              ? 'Modifier mon kit dans le Kit Studio'
              : `Inspecter le sac de ${currentMember.name}`}
          </span>
        </button>
      </div>
    </div>
  );

  // ── Volet 2 : Matériel partagé (défile via le mini-sélecteur Abri / Repas en bas à droite) ──
  const renderSharedPane = () => (
    <div className="h-full flex flex-col justify-between gap-2.5 p-1 overflow-hidden">
      {activeSharedIndex === 0 ? (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
              ABRI COLLECTIF
            </span>
            <h4 className="text-sm font-bold camp-text-title">Tente & Couchage de cordée</h4>
            <p className="text-xs camp-text-sub mt-0.5">Répartition optimale des charges volumineuses</p>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Tente 2 places (toile & arceaux)</strong>
                <small className="text-[11px] camp-text-sub">Portée par Tony (TF)</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                1,85 kg
              </span>
            </div>

            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Bâche de sol & sardines</strong>
                <small className="text-[11px] camp-text-sub">Portées par Alex (AL)</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                0,45 kg
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--hub-primary)] shrink-0" aria-hidden="true" />
            <span>Tous les abris sont confirmés pour 3 personnes</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
              CUISINE COLLECTIVE
            </span>
            <h4 className="text-sm font-bold camp-text-title">Réchaud & Ravitaillement</h4>
            <p className="text-xs camp-text-sub mt-0.5">Autonomie 3 jours garantie</p>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Réchaud gaz & cartouche 230g</strong>
                <small className="text-[11px] camp-text-sub">Porté par Camille (CM)</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                0,38 kg
              </span>
            </div>

            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between">
              <div>
                <strong className="text-xs camp-text-title block">Filtre à eau par gravité</strong>
                <small className="text-[11px] camp-text-sub">Porté par Alex (AL)</small>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                0,32 kg
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[var(--hub-action)] shrink-0" aria-hidden="true" />
            <span>Repas lyophilisés répartis équitablement dans chaque sac</span>
          </div>
        </div>
      )}
    </div>
  );

  // ── Volet 3 : Équilibre & Poids (défile via le mini-sélecteur Poids / Sécurité en bas à droite) ──
  const renderBalancePane = () => (
    <div className="h-full flex flex-col justify-between gap-2.5 p-1 overflow-hidden">
      {activeBalanceIndex === 0 ? (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
                ÉQUILIBRE DES CHARGES
              </span>
              <h4 className="text-sm font-bold camp-text-title">Bilan de la cordée</h4>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full camp-badge-forest">
              12,13 kg total
            </span>
          </div>

          {/* Barres horizontales d'équilibre des 3 sacs */}
          <div className="space-y-2">
            {MEMBERS.map((m) => (
              <div key={m.id} className="p-2.5 rounded-2xl camp-card-cream space-y-1">
                <div className="flex justify-between text-xs font-semibold camp-text-title">
                  <span>{m.name}</span>
                  <span className="font-extrabold text-[var(--hub-action)]">
                    {m.weight} ({m.sharePct})
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--hub-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--hub-action)]"
                    style={{ width: m.sharePct }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--hub-primary)] shrink-0" aria-hidden="true" />
            <span>Écart inférieur à 5 % : équilibre de marche optimal</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl camp-card-white shadow-xs space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[var(--hub-action)]">
              MATÉRIEL DE SÉCURITÉ
            </span>
            <h4 className="text-sm font-bold camp-text-title">Survie & Urgences</h4>
            <p className="text-xs camp-text-sub mt-0.5">Conformité haute montagne vérifiée</p>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between text-xs">
              <span className="font-semibold camp-text-title">Trousse de premiers secours</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                Chez Tony
              </span>
            </div>

            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between text-xs">
              <span className="font-semibold camp-text-title">Balise SOS satellite & sifflet</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                Chez Camille
              </span>
            </div>

            <div className="p-3 rounded-2xl camp-card-cream flex items-center justify-between text-xs">
              <span className="font-semibold camp-text-title">Couvertures de survie (×3)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-badge-forest">
                Dans chaque sac
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-[var(--hub-surface)] text-[11px] camp-text-sub text-center">
            Tous les équipements de sécurité sont assignés et contrôlés
          </div>
        </div>
      )}
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'crew',
      label: 'Équipage',
      icon: <Users className="w-4 h-4" aria-hidden="true" />,
      render: renderCrewPane,
    },
    {
      id: 'shared',
      label: 'Matériel partagé',
      icon: <Package className="w-4 h-4" aria-hidden="true" />,
      render: renderSharedPane,
    },
    {
      id: 'balance',
      label: 'Bilan poids',
      icon: <Scale className="w-4 h-4" aria-hidden="true" />,
      render: renderBalancePane,
    },
  ];

  const secondary =
    activeTab === 0
      ? {
          items: SECONDARY_MEMBERS,
          active: activeMemberIndex,
          onChange: setActiveMemberIndex,
          label: 'Membres de l’équipage',
        }
      : activeTab === 1
        ? {
            items: SECONDARY_SHARED,
            active: activeSharedIndex,
            onChange: setActiveSharedIndex,
            label: 'Catégories partagées',
          }
        : {
            items: SECONDARY_BALANCE,
            active: activeBalanceIndex,
            onChange: setActiveBalanceIndex,
            label: 'Analyses d’équilibre',
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

export default HubGroupeDrawer;
