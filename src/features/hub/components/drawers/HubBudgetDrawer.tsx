'use client';

/**
 * src/features/hub/components/drawers/HubBudgetDrawer.tsx
 *
 * Tiroir Budget Liquid Glass iOS 27 conforme Compte V8 :
 * - Haut : sélecteur à 3 volets (Répartition, Postes, Équilibre)
 * - Bas-droite : mini-sélecteur capsule
 * - Strict zéro scroll vertical (overflow-hidden)
 */

import React, { useState } from 'react';
import {
  CreditCard,
  PieChart,
  Users2,
  TrendingDown,
  CheckCircle,
  Train,
  Home,
  ShoppingBag,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

const POSTES = [
  {
    id: 'refuge',
    label: 'Refuge',
    title: 'Hébergement & Demi-pension',
    amount: '300 €',
    perPerson: '100 € / pers',
    status: 'Acompte 100 € versé · Solde sur place',
    icon: Home,
  },
  {
    id: 'train',
    label: 'Transport',
    title: 'Train TGV + Navettes locales',
    amount: '270 €',
    perPerson: '90 € / pers',
    status: '100 % réglé (Billets validés)',
    icon: Train,
  },
  {
    id: 'food',
    label: 'Vivres',
    title: 'Nourriture & Ravitaillement',
    amount: '150 €',
    perPerson: '50 € / pers',
    status: 'Courses communes faites',
    icon: ShoppingBag,
  },
];

const EQUILIBRE = [
  {
    id: 'tf',
    label: 'TF',
    name: 'Tony (Moi)',
    advanced: '390 € avancés',
    diff: '+150 €',
    desc: 'Tony a payé les billets de train et le premier approvisionnement.',
    due: 'Doit recevoir 150 € au total',
  },
  {
    id: 'cm',
    label: 'CM',
    name: 'Camille',
    advanced: '230 € avancés',
    diff: '-10 €',
    desc: 'Camille a réglé l’acompte du refuge.',
    due: 'Doit régler 10 € à Tony',
  },
  {
    id: 'al',
    label: 'AL',
    name: 'Alex',
    advanced: '100 € avancés',
    diff: '-140 €',
    desc: 'Alex règlera le solde final au gardien du refuge.',
    due: 'Doit régler 140 € à Tony',
  },
];

export function HubBudgetDrawer() {
  const [activeTab, setActiveTab] = useState(0);
  const [scopeIndex, setScopeIndex] = useState(0);
  const [posteIndex, setPosteIndex] = useState(0);
  const [memberIndex, setMemberIndex] = useState(0);

  const curPoste = POSTES[posteIndex] ?? POSTES[0];
  const curEq = EQUILIBRE[memberIndex] ?? EQUILIBRE[0];
  const PosteIcon = curPoste.icon;

  const tabs: DrawerTab[] = [
    {
      id: 'repart',
      label: 'Synthèse',
      icon: <PieChart className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] text-center space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
              {scopeIndex === 0 ? 'Budget total groupe' : 'Coût par équipier'}
            </span>
            <div className="text-3xl font-black camp-text-title">
              {scopeIndex === 0 ? '720 €' : '240 €'}
            </div>
            <p className="text-[11px] camp-text-sub">
              {scopeIndex === 0
                ? 'Pour 3 personnes · 3 jours en autonomie'
                : 'Tout compris : refuge, train et vivres'}
            </p>
          </div>

          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
            {POSTES.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full camp-btn-action shrink-0" />
                  <span className="camp-text-title font-medium">{p.title}</span>
                </div>
                <strong className="camp-text-title">
                  {scopeIndex === 0 ? p.amount : p.perPerson}
                </strong>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
              Solde restant à régler sur place :
            </span>
            <strong className="text-[var(--hub-primary)] font-bold">200 €</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'postes',
      label: 'Détail postes',
      icon: <CreditCard className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                Poste de dépense
              </span>
              <span className="text-xs font-black text-[var(--hub-primary)] px-2 py-0.5 rounded-full bg-[var(--hub-primary-subtle)]">
                {curPoste.amount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PosteIcon className="w-4 h-4 text-[var(--hub-action)]" />
              <h4 className="text-sm font-bold camp-text-title leading-tight">{curPoste.title}</h4>
            </div>
            <p className="text-xs camp-text-sub">{curPoste.perPerson}</p>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold uppercase text-[var(--hub-action)]">
              État de règlement
            </span>
            <p className="text-xs camp-text-title leading-relaxed">{curPoste.status}</p>
          </div>

          <div className="p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex items-center justify-between text-xs">
            <span className="camp-text-sub">Moyen de paiement :</span>
            <strong className="camp-text-title">CB collective & Espèces</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'equilibre',
      label: 'Équilibre',
      icon: <Users2 className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                {curEq.name}
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  curEq.diff.startsWith('+')
                    ? 'camp-chip-success'
                    : 'camp-chip-warning'
                }`}
              >
                {curEq.diff}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curEq.advanced}</h4>
            <p className="text-xs camp-text-sub">{curEq.desc}</p>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold uppercase text-[var(--hub-action)]">
              Régularisation recommandée
            </span>
            <strong className="text-xs camp-text-title">{curEq.due}</strong>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center gap-2 text-xs">
            <CheckCircle className="w-4 h-4 text-[var(--hub-primary)] shrink-0" />
            <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
              Calcul de péréquation automatique à jour.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const secondaryConfig =
    activeTab === 0
      ? {
          items: [
            { id: 'total', label: 'Total', icon: <span className="text-[11px] font-bold">Total</span> },
            { id: 'pers', label: 'Par pers', icon: <span className="text-[11px] font-bold">Pers</span> },
          ],
          active: scopeIndex,
          onChange: setScopeIndex,
          label: 'Affichage',
        }
      : activeTab === 1
        ? {
            items: POSTES.map((p) => ({
              id: p.id,
              label: p.label,
              icon: <span className="text-[11px] font-bold">{p.label}</span>,
            })),
            active: posteIndex,
            onChange: setPosteIndex,
            label: 'Postes',
          }
        : {
            items: EQUILIBRE.map((e) => ({
              id: e.id,
              label: e.label,
              icon: <span className="text-[11px] font-bold">{e.label}</span>,
            })),
            active: memberIndex,
            onChange: setMemberIndex,
            label: 'Équipiers',
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

export default HubBudgetDrawer;
