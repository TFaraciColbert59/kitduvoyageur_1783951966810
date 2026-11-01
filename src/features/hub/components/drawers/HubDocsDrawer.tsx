'use client';

/**
 * src/features/hub/components/drawers/HubDocsDrawer.tsx
 *
 * Tiroir Documents Liquid Glass iOS 27 conforme Compte V8 :
 * - Haut : sélecteur à 3 volets (Réservations, Secours & GPX, Assurances)
 * - Bas-droite : mini-sélecteur capsule
 * - Strict zéro scroll vertical (overflow-hidden)
 */

import React, { useState } from 'react';
import {
  FileText,
  Shield,
  Download,
  CheckCircle2,
  PhoneCall,
  ExternalLink,
  Map,
  Building2,
  Calendar,
} from 'lucide-react';
import { DrawerShell, type DrawerSecondaryItem, type DrawerTab } from '@/components/ui/drawer';

const RESERVATIONS = [
  {
    id: 'refuge',
    label: 'Refuge',
    title: 'Halte au Refuge des Écrins',
    sub: 'Réservation 3 personnes · Demi-pension',
    date: '14 Juillet 2026',
    ref: 'REF-ECR-8841',
    status: 'Confirmée & Réglée',
    contact: '04 92 23 46 66',
  },
  {
    id: 'train',
    label: 'Train',
    title: 'SNCF TGV + TER Chamonix',
    sub: 'Aller-retour Paris ↔ Saint-Gervais',
    date: '13-17 Juillet 2026',
    ref: 'SNCF-YK912P',
    status: 'E-billets enregistrés',
    contact: 'Voie A · Wagon 12',
  },
  {
    id: 'navette',
    label: 'Navette',
    title: 'Navette Haute Vallée',
    sub: 'Liaison Chamonix ↔ Départ sentier',
    date: '14 Juillet · 07:15',
    ref: 'NAV-CHAM-04',
    status: 'Pass collectif valide',
    contact: 'Gare routière Chamonix',
  },
];

const SAFETY_DOCS = [
  {
    id: 'fiche',
    label: 'Fiche',
    title: 'Fiche d’itinéraire & Secours',
    sub: 'Déposée auprès des proches et du gardien',
    desc: 'Contient l’itinéraire jour par jour, les horaires prévus, les échappatoires et la composition du groupe.',
    badge: 'À JOUR',
  },
  {
    id: 'gpx',
    label: 'GPX',
    title: 'Tracé GPX Haute Définition IGN',
    sub: 'Compatible Garmin, Suunto & Apple Watch',
    desc: '3 étapes tracées avec waypoints d’eau potable, bivouacs tolérés et zones d’ombre réseau GSM.',
    badge: 'TÉLÉCHARGÉ',
  },
  {
    id: 'pghm',
    label: 'PGHM',
    title: 'Protocole d’alerte PGHM Chamonix',
    sub: 'Procédure en cas d’accident ou égarement',
    desc: 'Numéro direct secours : 112 ou 04 50 53 00 58. Canal VHF Mont-Blanc : 161.300 MHz.',
    badge: 'ESSENTIEL',
  },
];

const INSURANCES = [
  {
    id: 'ffcam',
    label: 'FFCAM',
    title: 'Licence Club Alpin Français (FFCAM)',
    sub: 'Assurance individuelle montagne & secours',
    coverage: 'Frais de recherche et secours en montagne jusqu’à 50 000 € illimité en France.',
    number: 'ADH-2026-049811',
  },
  {
    id: 'rapat',
    label: 'Assistance',
    title: 'Assurance Rapatriement & Hospitalisation',
    sub: 'Contrat assistance 24/7 monde',
    coverage: 'Prise en charge rapatriement sanitaire hélicoptère et transport d’urgence.',
    number: 'EUROP-ASSIST-7712',
  },
];

export function HubDocsDrawer() {
  const [activeTab, setActiveTab] = useState(0);
  const [resIndex, setResIndex] = useState(0);
  const [safetyIndex, setSafetyIndex] = useState(0);
  const [insIndex, setInsIndex] = useState(0);

  const curRes = RESERVATIONS[resIndex] ?? RESERVATIONS[0];
  const curSafe = SAFETY_DOCS[safetyIndex] ?? SAFETY_DOCS[0];
  const curIns = INSURANCES[insIndex] ?? INSURANCES[0];

  const tabs: DrawerTab[] = [
    {
      id: 'res',
      label: 'Réservations',
      icon: <Building2 className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                {curRes.ref}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-chip-success">
                {curRes.status}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curRes.title}</h4>
            <p className="text-xs camp-text-sub">{curRes.sub}</p>
          </div>

          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
            <div className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] text-xs">
              <span className="camp-text-sub flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--hub-action)]" /> Date prévue
              </span>
              <strong className="camp-text-title">{curRes.date}</strong>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] text-xs">
              <span className="camp-text-sub flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-[var(--hub-action)]" /> Contact / Accès
              </span>
              <strong className="camp-text-title">{curRes.contact}</strong>
            </div>
          </div>

          <button
            type="button"
            className="w-full min-h-[44px] rounded-xl camp-btn-primary text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Télécharger le justificatif PDF</span>
          </button>
        </div>
      ),
    },
    {
      id: 'safety',
      label: 'Secours & GPX',
      icon: <Shield className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                Sécurité expédition
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-chip-success">
                {curSafe.badge}
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curSafe.title}</h4>
            <p className="text-xs camp-text-sub">{curSafe.sub}</p>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] flex-1 min-h-0 flex flex-col justify-center">
            <p className="text-xs camp-text-title leading-relaxed">{curSafe.desc}</p>
          </div>

          <button
            type="button"
            className="w-full min-h-[44px] rounded-xl camp-btn-primary text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ouvrir ou exporter le document</span>
          </button>
        </div>
      ),
    },
    {
      id: 'ins',
      label: 'Assurances',
      icon: <FileText className="w-4 h-4" aria-hidden="true" />,
      render: () => (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-1 space-y-2">
          <div className="p-3.5 rounded-2xl camp-card-white border border-[var(--hub-border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--hub-action)]">
                Couverture valide
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full camp-chip-success">
                ACTIF
              </span>
            </div>
            <h4 className="text-sm font-bold camp-text-title leading-tight">{curIns.title}</h4>
            <p className="text-xs camp-text-sub">{curIns.sub}</p>
          </div>

          <div className="p-3 rounded-xl camp-card-cream border border-[var(--hub-border-subtle)] space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase text-[var(--hub-action)]">
              Garanties incluses
            </span>
            <p className="text-xs camp-text-title leading-relaxed">{curIns.coverage}</p>
            <div className="pt-1 text-[11px] camp-text-sub border-t border-[var(--hub-border-subtle)]">
              Numéro police : <strong>{curIns.number}</strong>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--hub-primary-subtle)] border border-[var(--hub-primary)]/20 flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-[var(--hub-primary)] shrink-0" />
            <span className="font-semibold text-[var(--hub-primary)] text-[11px]">
              Assistance montagne confirmée pour tous les membres.
            </span>
          </div>
        </div>
      ),
    },
  ];

  const secondaryConfig =
    activeTab === 0
      ? {
          items: RESERVATIONS.map((r) => ({
            id: r.id,
            label: r.label,
            icon: <Building2 className="w-3.5 h-3.5" aria-hidden="true" />,
          })),
          active: resIndex,
          onChange: setResIndex,
          label: 'Réservations',
        }
      : activeTab === 1
        ? {
            items: SAFETY_DOCS.map((s) => ({
              id: s.id,
              label: s.label,
              icon: <Shield className="w-3.5 h-3.5" aria-hidden="true" />,
            })),
            active: safetyIndex,
            onChange: setSafetyIndex,
            label: 'Documents',
          }
        : {
            items: INSURANCES.map((i) => ({
              id: i.id,
              label: i.label,
              icon: <FileText className="w-3.5 h-3.5" aria-hidden="true" />,
            })),
            active: insIndex,
            onChange: setInsIndex,
            label: 'Assurances',
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

export default HubDocsDrawer;
