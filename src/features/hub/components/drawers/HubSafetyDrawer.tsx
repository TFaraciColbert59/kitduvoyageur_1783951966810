'use client';

/**
 * src/features/hub/components/drawers/HubSafetyDrawer.tsx
 *
 * Tiroir Sécurité / Urgences Liquid Glass iOS 27 conforme Compte V8 :
 * - Haut : sélecteur à 3 volets (Urgences, Risques météo, Protocoles)
 * - Bas-droite : mini-sélecteur capsule
 * - Strict zéro scroll vertical (overflow-hidden)
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  CloudLightning,
  Radio,
  PhoneCall,
  AlertTriangle,
  Wind,
  Thermometer,
  Compass,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

const EMERGENCY_CONTACTS = [
  {
    id: '112',
    label: '112',
    title: 'Numéro d’urgence européen',
    num: '112 (ou 114 par SMS)',
    desc: 'Accessible même sans carte SIM ou hors réseau de l’opérateur national si une antenne est captée.',
    action: 'Appel d’urgence immédiat',
  },
  {
    id: 'pghm',
    label: 'PGHM',
    title: 'PGHM Chamonix Mont-Blanc',
    num: '04 50 53 00 58',
    desc: 'Secours spécialisé en montagne haute altitude. Transmettre coordonnées GPS et météo locale.',
    action: 'Ligne directe secours montagne',
  },
  {
    id: 'balise',
    label: 'Balise',
    title: 'Balise Satellite Garmin inReach',
    num: 'SOS Iridium Satellite',
    desc: 'Déclenchement du bouton SOS physique en zone blanche totale. Relié au centre de coordination GEOS.',
    action: 'SOS actif en veille',
  },
];

const WEATHER_RISKS = [
  {
    id: 'orage',
    label: 'Orage',
    title: 'Risque d’orage en fin d’après-midi',
    level: 'VIGILANCE JAUNE',
    desc: 'Passage orageux probable dès 16h30. Éviter les arêtes et les sommets dénudés après 15h.',
    advice: 'Passer les cols avant midi et monter le bivouac avant 16h.',
  },
  {
    id: 'vent',
    label: 'Vent',
    title: 'Rafales de vent sur les crêtes',
    level: '45 À 55 KM/H',
    desc: 'Vent de sud-ouest sensible sur les passages de cols au-dessus de 2 200 m.',
    advice: 'Arrimage solide de la tente et renfort des haubans avec des pierres.',
  },
  {
    id: 'gel',
    label: 'Gel',
    title: 'Isotherme 0°C & Températures nocturnes',
    level: '3 200 M / 4°C AU CAMP',
    desc: 'Nuit fraîche en fond de vallon. Rosée abondante prévue au lever du jour.',
    advice: 'Rentrer les chaussures dans l’abside et isoler les batteries du froid.',
  },
];

const PROTOCOLS = [
  {
    id: 'bivouac',
    label: 'Bivouac',
    title: 'Règles du bivouac d’altitude',
    sub: 'Parc National & Réserve Naturelle',
    rules: 'Tente montée après 19h et démontée avant 9h. Feu ouvert interdit. Déchets redescendus.',
  },
  {
    id: 'evac',
    label: 'Évac',
    title: 'Plan d’évacuation & Repli',
    sub: 'Échappatoire Col du Brévent',
    rules: 'En cas de météo dégradée, descente directe par le sentier des Gardes vers la vallée en 1h45.',
  },
];

export function HubSafetyDrawer() {
  const [activeTab, setActiveTab] = useState(0);
  const [emIndex, setEmIndex] = useState(0);
  const [riskIndex, setRiskIndex] = useState(0);
  const [protoIndex, setProtoIndex] = useState(0);

  const curEm = EMERGENCY_CONTACTS[emIndex] ?? EMERGENCY_CONTACTS[0];
  const curRisk = WEATHER_RISKS[riskIndex] ?? WEATHER_RISKS[0];
  const curProto = PROTOCOLS[protoIndex] ?? PROTOCOLS[0];

  const tabs: DrawerTab[] = [
    {
      id: 'urgences',
      label: 'Urgences',
      icon: <PhoneCall className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
              Contact d’urgence
            </span>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curEm.title}</h4>
            <div className="text-xl font-black text-[var(--hub-primary)]">{curEm.num}</div>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed">{curEm.desc}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center justify-between text-xs">
            <span className="camp-text-sub text-[11px]">Canal radio VHF d’urgence :</span>
            <strong className="text-[var(--hub-primary)] font-bold">161.300 MHz</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'risques',
      label: 'Risques météo',
      icon: <CloudLightning className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                Vigilance terrain
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-chip-warning">
                {curRisk.level}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curRisk.title}</h4>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] space-y-2 flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed">{curRisk.desc}</p>
            <div className="pt-1.5 border-t border-[var(--hub-border-subtle)]">
              <span className="text-[10px] font-bold uppercase text-[var(--hub-action)] block">
                Consigne de sécurité :
              </span>
              <p className="text-[11px] font-semibold text-[var(--hub-primary)]">{curRisk.advice}</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex items-center justify-between text-xs">
            <span className="camp-text-sub">Mise à jour bulletin météo :</span>
            <strong className="camp-text-title">Il y a 35 min</strong>
          </div>
        </div>
      ),
    },
    {
      id: 'protocoles',
      label: 'Protocoles',
      icon: <ShieldAlert className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
              {curProto.sub}
            </span>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curProto.title}</h4>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed">{curProto.rules}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center gap-2 text-xs">
            <Compass className="w-4 h-4 text-[var(--hub-primary)] shrink-0" />
            <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
              Point de rassemblement d’urgence défini avec l’équipe.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const secondaryConfig =
    activeTab === 0
      ? {
          items: EMERGENCY_CONTACTS.map((e) => ({
            id: e.id,
            label: e.label,
            icon: <span className="text-[11px] font-bold">{e.label}</span>,
          })),
          active: emIndex,
          onChange: setEmIndex,
          label: 'Contact',
        }
      : activeTab === 1
        ? {
            items: WEATHER_RISKS.map((r) => ({
              id: r.id,
              label: r.label,
              icon: <span className="text-[11px] font-bold">{r.label}</span>,
            })),
            active: riskIndex,
            onChange: setRiskIndex,
            label: 'Risques',
          }
        : {
            items: PROTOCOLS.map((p) => ({
              id: p.id,
              label: p.label,
              icon: <span className="text-[11px] font-bold">{p.label}</span>,
            })),
            active: protoIndex,
            onChange: setProtoIndex,
            label: 'Protocoles',
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

export default HubSafetyDrawer;
