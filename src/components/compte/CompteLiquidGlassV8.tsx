'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import { fetchMyTripsCached, getMyTripsSessionGeneration, isMyTripsSessionCurrent } from '@/features/trips/client/fetchMyTrips';
import { initCompteLiquidGlassRuntime } from './compte-liquid-glass-v8-runtime';
import type {
  SlotId,
  Viewer,
  Visibility,
} from './drawer/ProfileDrawerHost';
import { DRAWER_V2_CSS, type SlotContentState } from './drawer/SlotShell';
import { useCompteMapContext } from './map/useCompteMapContext';

class CompteMapBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('[compte-map]', error);
  }
  render() {
    if (this.state.failed) {
      return <div className="lkdv-map-unavailable">Carte momentanément indisponible</div>;
    }
    return this.props.children;
  }
}

import { CompteOverlayHost } from './overlay/CompteOverlayHost';
import './overlay/compte-drawers.css';
import './compte-v8.css';
import './compte-apple-hig.css';
import {
  accountVisibilityUpdate,
  signatureVisibilityForValue,
  toAccountVisibility,
  PROFILE_VISIBILITY_EVENT,
  type ProfileVisibilityEventDetail,
  type SignatureVisibility,
} from '@/features/compte/data/accountVisibility';
import {
  persistProfileVisibility,
  rejectProfileVisibility,
} from '@/features/compte/data/profileVisibilityBridge';
import {
  mapProfileRuntimeVisibility,
  persistSignatureVisibility,
  signatureVisibilityIndex,
} from '@/features/compte/data/accountBootstrap';
import {
  SIGNATURE_VISIBILITY_EVENT,
  type SignatureVisibilityEventDetail,
} from './drawer/slots/VitrineSlot';

const CompteMap = dynamic(
  () => import('./map/CompteMap').then((mod) => mod.CompteMap),
  { ssr: false }
);
const ProfileDrawerHost = dynamic(
  () => import('./drawer/ProfileDrawerHost').then((mod) => mod.ProfileDrawerHost),
  { ssr: false }
);
const ReseauDrawer = dynamic(
  () => import('./drawer/reseau/ReseauDrawer').then((mod) => mod.ReseauDrawer),
  { ssr: false }
);
const SortieDrawer = dynamic(
  () => import('./drawer/sortie/SortieDrawer').then((mod) => mod.SortieDrawer),
  { ssr: false }
);
const HighlightEditDrawer = dynamic(
  () => import('./drawer/compte/HighlightEditDrawer').then((mod) => mod.HighlightEditDrawer),
  { ssr: false, loading: () => <div style={{ padding: 16 }}>Chargement…</div> }
);
const CompteDrawer = dynamic(
  () => import('./drawer/compte/CompteDrawer').then((mod) => mod.CompteDrawer),
  { ssr: false }
);
const FirstRunJourney = dynamic(
  () => import('./onboarding/FirstRunJourney').then((mod) => mod.FirstRunJourney),
  { ssr: false }
);


const COMPTE_V8_HTML = "<div class=\"stage\">\r\n<div class=\"pwrap\" id=\"pwrap\"><div class=\"phone\" id=\"phone\" aria-label=\"Maquette iPhone du profil LKDV  en Liquid Glass iOS 27\">\r\n  <div class=\"bg\"><img class=\"bg-img\" alt=\"Aperçu du profil LKDV\" decoding=\"async\" fetchpriority=\"high\" src=\"/assets/images/account-bg.webp\" /></div>\r\n  <div class=\"status\" aria-hidden=\"true\"><span>9:41</span><span class=\"r\">\r\n    <svg width=\"18\" height=\"12\" viewBox=\"0 0 18 12\"><rect x=\"0\" y=\"8\" width=\"3\" height=\"4\" rx=\"1\" fill=\"#fff\"/><rect x=\"5\" y=\"5.5\" width=\"3\" height=\"6.5\" rx=\"1\" fill=\"#fff\"/><rect x=\"10\" y=\"3\" width=\"3\" height=\"9\" rx=\"1\" fill=\"#fff\"/><rect x=\"15\" y=\"0\" width=\"3\" height=\"12\" rx=\"1\" fill=\"#fff\"/></svg>\r\n    <svg width=\"16\" height=\"12\" viewBox=\"0 0 16 12\"><path d=\"M8 11.2 5.6 8.8a3.4 3.4 0 0 1 4.8 0L8 11.2Z\" fill=\"#fff\"/><path d=\"M3.4 6.6a6.5 6.5 0 0 1 9.2 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M1 4.2a9.9 9.9 0 0 1 14 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/></svg>\r\n    <svg width=\"27\" height=\"13\" viewBox=\"0 0 27 13\"><rect x=\".5\" y=\".5\" width=\"23\" height=\"12\" rx=\"3.8\" stroke=\"rgba(255,255,255,.6)\" fill=\"none\"/><rect x=\"2.5\" y=\"2.5\" width=\"17\" height=\"8\" rx=\"2.2\" fill=\"#fff\"/><path d=\"M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z\" fill=\"rgba(255,255,255,.6)\"/></svg></span></div>\r\n  <div class=\"island\" id=\"island\" data-s=\"idle\" role=\"status\" aria-live=\"polite\"><div class=\"is live\" id=\"isl\"></div><div class=\"is note\" id=\"isn\"></div></div>\r\n\r\n  <section class=\"top\" id=\"top\"></section>\r\n\r\n  <section class=\"mapzone\" aria-label=\"Carte d'empreinte et d'aventures de \">\r\n    <div class=\"map\" id=\"map\"><div id=\"map-loading-bar\" class=\"map-loading-bar\"><div class=\"map-loading-pill\"><span class=\"map-loading-pulse\"></span><span>Initialisation du Relief 3D…</span></div><div class=\"map-loading-track\"><div id=\"map-loading-fill\" class=\"map-loading-fill\"></div></div></div><div id=\"maplibre-compte-canvas\" style=\"position:absolute;inset:0;width:100%;height:100%;z-index:1;\"></div><div class=\"map-scale-selector\" role=\"group\" aria-label=\"Échelle de la carte 3D\"><button id=\"btnCompteOrbite\" class=\"active\" data-a=\"mapscale\" data-v=\"ORBITE\" data-scale=\"ORBITE\" aria-label=\"Vue Globe Terrestre\" aria-pressed=\"true\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/></svg></button><button id=\"btnCompteMassif\" data-a=\"mapscale\" data-v=\"MASSIF\" data-scale=\"MASSIF\" aria-label=\"Vue Massif Alpin\" aria-pressed=\"false\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/></svg></button><button id=\"btnCompteSentier\" data-a=\"mapscale\" data-v=\"SENTIER\" data-scale=\"SENTIER\" aria-label=\"Vue Sentier 3D Immersion\" aria-pressed=\"false\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polygon points=\"16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76\"/></svg></button></div><div class=\"map-badge-3d\"><span>GLOBE 3D</span></div>\r\n      <svg class=\"tm\" id=\"tm\" viewBox=\"0 -24 370 368\" preserveAspectRatio=\"xMidYMid slice\" role=\"img\" aria-label=\"Carte générée de ton empreinte terrain\"></svg>\r\n      <button class=\"mgrab\" id=\"mgrab\" data-a=\"mapbig\" aria-label=\"Agrandir ou réduire la carte\"><span></span></button>\r\n      <div class=\"lg mctl\" id=\"mctl\" role=\"group\" aria-label=\"Contrôles de la carte\"></div>\r\n      <div class=\"lg callout\" id=\"callout\" hidden></div>\r\n    </div>\r\n  </section>\r\n\r\n  <nav class=\"tabbar\" id=\"tabbar\" aria-label=\"Navigation principale\">\r\n    \r\n    <div class=\"lg tb\" id=\"tb\"></div>\r\n  </nav>\r\n  <div class=\"home\"></div>\r\n\r\n  <div class=\"sw-wrap\" id=\"sw\" data-det=\"closed\"><div class=\"scrim\" data-a=\"close\"></div><section class=\"sheet\" id=\"sheet\" role=\"dialog\" aria-label=\"Détails du compte\"></section></div>\r\n  <div class=\"lg popv\" id=\"popv\" role=\"dialog\" aria-label=\"Affichage\"></div>\r\n  <div class=\"lg mopts\" id=\"mopts\" role=\"dialog\" aria-label=\"Personnaliser la carte\"></div>\r\n  <div class=\"lg rmenu\" id=\"rmenu\" role=\"menu\" aria-label=\"Choisir une option\"></div>\r\n  <div class=\"ctx\" id=\"ctx\" role=\"dialog\" aria-label=\"Aperçu\"></div>\r\n  <div class=\"story\" id=\"story\" role=\"dialog\" aria-label=\"Story plein écran\"></div>\r\n  <div class=\"post-modal-instagram\" id=\"post_modal_instagram\" role=\"dialog\" aria-label=\"Publication Instagram\"></div>\r\n</div></div>\r\n\r\n<aside class=\"notes\">\r\n  <span class=\"tag\">Maquette finale · Compte  · iOS 27 Liquid Glass</span>\r\n  <h1>L'anatomie Instagram de  fusionnée dans le verre iOS 27 LKDV.</h1>\r\n  <p>Toute l'ergonomie de ton profil Instagram (<code></code> · <b>Тоny</b> · <code>3 publications</code> · <code>1 080 followers</code> · <code>339 suivi(e)s</code> · bio <code>IT·FR</code> · stories À la une · grille photo 3 colonnes) habillée avec le Design System unique Liquid Glass v8 et ta carte d'empreinte vivante en bas.</p>\r\n  <ul>\r\n    <li><b>En-tête Instagram </b> : vrai avatar entouré de l'anneau Sceau d'empreinte (ADR-010), bulle de note en verre, compteurs interactifs et boutons <i>Modifier le profil</i> / <i>Partager le profil</i> en verre dépoli (<code>--pg</code> / <code>.soft</code>).</li>\r\n    <li><b>Stories À la une & Grille 3×3</b> : moments terrain (<i>IT·FR Alpes</i>, <i>⛺ Néouvielle</i>, <i>🦌 Vercors</i>, <i>🎒 Sac 4,8kg</i>) et grille carrée 3 colonnes synchronisée avec la carte d'empreinte en bas.</li>\r\n    <li><b>4 onglets profil</b> : <b>Grille</b> (publications & carnets), <b>Carte</b> (sorties GPS & massifs), <b>Lignées</b> (Propagation, Endurance 91 % & Part créateur 42,50 €), <b>Tribu</b> (sorties en équipage & matériel prêté).</li>\r\n    <li><b>Tests E2E Maestro MCP</b> : identifiants et libellés accessibles pour piloter et vérifier chaque flux via Maestro MCP (<code>maestro mcp</code>).</li>\r\n  </ul>\r\n\r\n  <h2 style=\"margin:22px 0 6px;font-size:15px\">50 améliorations intégrées</h2>\r\n  <ul>\r\n    <li><b>Identité</b> : anneau animé ou ciselé, note 24 h modifiable, vue visiteur, Sceau zoomable, bascule profil / clubs (appui long sur <code>tony_frc</code>).</li>\r\n    <li><b>Stories</b> : visionneuse plein écran, story Sac, couvertures topographiques, espèce épinglée, création depuis une sortie.</li>\r\n    <li><b>Grille</b> : épingles, Peek &amp; Pop (appui long), progression du brouillon, fil, filtres saison / massif.</li>\r\n    <li><b>Carte &amp; accessoire</b> : survol lié, clusters 2/3, relief ombré, mini-profil, comparateur, 3 modes, repères, scrubber filtrant, J-4.</li>\r\n    <li><b>Lignées &amp; sac</b> : filiation G1→G3, jauge 3/5, simulateur, journal 300 bps, vestiaire 3×2, usure, prêts, scan.</li>\r\n    <li><b>Profil voyageur, sécurité, RGPD</b> : impact Compas, double nationalité, flou 1 km, coffre Face ID, SMS SOS, stockage, matrice « qui voit quoi », exports.</li>\r\n    <li><b>Interactions</b> : voix composée, reflet pilotable, QR + NameDrop, plein soleil renforcé.</li>\r\n  </ul>\r\n</aside>\r\n</div>"

function triggerBrowserDownload(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

function buildGpxXml(outings: any[], handle: string): string {
  const now = new Date().toISOString();
  const trks = (outings || []).map((o: any, idx: number) => {
    const latBase = 45.83 + idx * 0.08;
    const lonBase = 6.86 + idx * 0.12;
    const pts = [
      [latBase, lonBase, 1200],
      [latBase + 0.02, lonBase + 0.03, 1750],
      [latBase + 0.05, lonBase + 0.07, 2400],
      [latBase + 0.08, lonBase + 0.11, 2810],
      [latBase + 0.05, lonBase + 0.14, 2100],
      [latBase, lonBase, 1200],
    ].map(([lat, lon, ele]) => {
      return `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`;
    }).join('\n');
    return `  <trk>
    <name>${String(o.title || 'Sortie LKDV').replace(/[<>&]/g, '')}</name>
    <desc>${o.mass || 'Alpes'} · ${o.km || 20} km · D+ ${o.dplus || 1000} m</desc>
    <trkseg>
${pts}
    </trkseg>
  </trk>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur - iOS 27 Liquid Glass (@${handle})" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Traces GPS vérifiées @${handle}</name>
    <time>${now}</time>
  </metadata>
${trks}
</gpx>`;
}




const DEMO_CARNETS = [
  {
    id: 'ca2',
    title: 'Reflet du Mont-Blanc au Lac Blanc',
    destination: 'Mont-Blanc',
    location: 'Mont-Blanc',
    visibility: 'public',
    views_count: 420,
    likes_count: 64,
    verified: true,
    cover_image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ca1',
    title: 'Trois jours autour du Néouvielle',
    destination: 'Pyrénées',
    location: 'Néouvielle',
    visibility: 'public',
    views_count: 312,
    likes_count: 48,
    verified: true,
    cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ca3',
    title: 'Glacier Blanc & Pré de Mme Carle',
    destination: 'Écrins',
    location: 'Écrins',
    visibility: 'public',
    views_count: 255,
    likes_count: 39,
    verified: true,
    cover_image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ca0',
    title: 'Traversée du Vercors, bivouac',
    destination: 'Vercors',
    location: 'Vercors',
    visibility: 'private',
    views_count: 180,
    likes_count: 27,
    verified: true,
    cover_image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ca5',
    title: 'Aiguilles de Bavella & GR20',
    destination: 'Corse',
    location: 'Bavella',
    visibility: 'public',
    views_count: 290,
    likes_count: 52,
    verified: true,
    cover_image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ca6',
    title: 'Tre Cime di Lavaredo, Dolomites',
    destination: 'Dolomites',
    location: 'Tre Cime',
    visibility: 'public',
    views_count: 340,
    likes_count: 61,
    verified: true,
    cover_image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
  },
];

const DEMO_OUTINGS = [
  {
    id: 'o1',
    title: 'Trek des 3 Vallées, Pyrénées',
    destination: 'Pyrénées',
    mass: 'Pyrénées',
    km: 58,
    dplus: 3420,
    maxAlt: 2640,
    status: 'completed',
  },
  {
    id: 'o2',
    title: 'Boucle du Lac Blanc',
    destination: 'Mont-Blanc',
    mass: 'Mont-Blanc',
    km: 12,
    dplus: 950,
    maxAlt: 2352,
    status: 'completed',
  },
  {
    id: 'o3',
    title: 'Traversée des Hauts Plateaux',
    destination: 'Vercors',
    mass: 'Vercors',
    km: 34,
    dplus: 1600,
    maxAlt: 2020,
    status: 'completed',
  },
  {
    id: 'o4',
    title: 'Tour du Néouvielle',
    destination: 'Pyrénées',
    mass: 'Pyrénées',
    km: 41,
    dplus: 2380,
    maxAlt: 2450,
    status: 'completed',
  },
  {
    id: 'o5',
    title: 'Aiguilles de Bavella (GR20)',
    destination: 'Corse',
    mass: 'Corse',
    km: 28,
    dplus: 1820,
    maxAlt: 1660,
    status: 'completed',
  },
  {
    id: 'o6',
    title: 'Tour du Mont-Blanc (Chamonix → Courmayeur)',
    destination: 'Mont-Blanc',
    mass: 'Mont-Blanc',
    km: 94,
    dplus: 4920,
    maxAlt: 2537,
    status: 'completed',
  },
  {
    id: 'o7',
    title: 'Cirque de Gavarnie & Brèche de Roland',
    destination: 'Pyrénées',
    mass: 'Pyrénées',
    km: 18,
    dplus: 1350,
    maxAlt: 2807,
    status: 'completed',
  },
  {
    id: 'o8',
    title: 'Grand Veymont & Pas de l\'Aiguille',
    destination: 'Vercors',
    mass: 'Vercors',
    km: 22,
    dplus: 1100,
    maxAlt: 2341,
    status: 'completed',
  },
  {
    id: 'o9',
    title: 'Glacier Blanc & Pré de Mme Carle',
    destination: 'Écrins',
    mass: 'Écrins',
    km: 24,
    dplus: 1450,
    maxAlt: 2542,
    status: 'completed',
  },
  {
    id: 'o10',
    title: 'Tre Cime di Lavaredo & Bivouac Locatelli',
    destination: 'Dolomites',
    mass: 'Dolomites',
    km: 20,
    dplus: 1200,
    maxAlt: 2405,
    status: 'completed',
  },
];

const DEMO_CLUBS = [
  {
    slug: 'cl1',
    name: 'Club Alpin Pyrénées',
    role: 'Membre actif',
    membersCount: 142,
  },
  {
    slug: 'cl2',
    name: 'Torino & Chamonix Alpi 🇮🇹🇫🇷',
    role: 'Co-organisateur',
    membersCount: 89,
  },
  {
    slug: 'cl3',
    name: 'Bivouac 4 Saisons & Trek Léger',
    role: 'Membre',
    membersCount: 310,
  },
];

const DEMO_GEAR_ITEMS = [
  { id: 'p11', name: 'Frontale Swift RL 900 lm', brand: 'Petzl', category: 'Sécurité', weight_g: 100, condition: 'excellent', is_lent: true, loaned_to: 'Léa' },
  { id: 'p3', name: 'Sac de couchage Mythic Ultra 180', brand: 'Rab', category: 'Couchage', weight_g: 400, condition: 'neuf', is_lent: false },
  { id: 'p7', name: 'Gourde BeFree 1.0 L Filtre', brand: 'Katadyn', category: 'Eau', weight_g: 63, condition: 'bon', is_lent: false },
  { id: 'p2', name: 'Tente Hubba Hubba NX 2P', brand: 'MSR', category: 'Couchage', weight_g: 1720, condition: 'bon', is_lent: false },
  { id: 'p4', name: 'Matelas NeoAir XLite NXT', brand: 'Therm-a-Rest', category: 'Couchage', weight_g: 370, condition: 'excellent', is_lent: false },
  { id: 'p5', name: 'Veste Beta AR Gore-Tex Pro', brand: "Arc'teryx", category: 'Vêtements', weight_g: 455, condition: 'bon', is_lent: false },
  { id: 'p8', name: 'Réchaud PocketRocket Deluxe', brand: 'MSR', category: 'Cuisine', weight_g: 83, condition: 'bon', is_lent: false },
];

const DEMO_ORDERS = [
  { id: 'b1', order_number: 'RS-9402', total_eur: 188.7, status: 'confirmed' },
  { id: 'b2', order_number: 'DIR-1029', total_eur: 184.0, status: 'pending' },
  { id: 'or1', order_number: 'LK-4829', total_eur: 249.0, status: 'confirmed' },
];

const DEMO_ACTIVE_LOANS = [
  { product_ownership_id: 'p11', borrower_contact: 'Léa' },
];

export interface CompteLiquidGlassV8Props {
  initialTab?: string;
}

type BootstrapPhase = 'idle' | 'loading' | 'ready' | 'error';

interface PendingSlotMount {
  root: HTMLElement | null;
  slotId: string;
  state: any;
}

interface SlotMountSnapshot {
  slotId: SlotId;
  payload: unknown;
  viewer: Viewer;
  visibility: Visibility;
  invited: boolean;
  root: HTMLElement | null;
  state: SlotContentState;
}

/**
 * Dérive l'état de l'hôte à partir du dernier montage runtime et du bootstrap.
 *
 * Le runtime monte le drawer avant que `/api/compte/bootstrap` ne réponde :
 * sans cette dérivation rejouée à la résolution, un propriétaire resterait
 * affiché en visiteur. Tant que le bootstrap est en vol, la coquille montre
 * un squelette ; sur échec, elle montre l'état d'erreur honnête plutôt qu'un
 * drawer vide. Seul `authenticated === true` autorise les entrées propriétaire.
 */
function deriveSlotMount(
  pending: PendingSlotMount,
  boot: any,
  phase: BootstrapPhase
): SlotMountSnapshot {
  // `S.profileVisibility` est l'état exact post-mutation : prioritaire sur
  // le bootstrap chargé au montage, pour refléter un changement sans reload.
  const visibilitySource =
    pending.state?.profileVisibility ||
    boot?.visibility?.profile ||
    pending.state?.profile?.profileVisibility ||
    pending.state?.profile?.profile_visibility;
  const viewerSource = pending.state?.profile?.viewer || pending.state?.viewer;
  // Sans session réelle (démo ou bootstrap indisponible), on reste en mode
  // visiteur : aucune entrée propriétaire ne doit apparaître.
  const authenticated = boot?.authenticated === true;
  const contentState: SlotContentState =
    phase === 'error' ? 'error' : phase === 'loading' ? 'loading' : 'ready';
  return {
    slotId: (pending.slotId || 'vitrine') as SlotId,
    payload: boot ?? pending.state,
    viewer: viewerSource === 'visitor' || !authenticated ? 'visitor' : 'owner',
    visibility: visibilitySource === 'prive' ? 'prive' : 'public',
    invited: Boolean(boot?.visibility?.invited ?? pending.state?.profile?.invited ?? false),
    root: pending.root,
    state: contentState,
  };
}

/** Métadonnées transmises par le runtime avec chaque mutation. */
interface CompteMutationMeta {
  previousProfileVisibility?: unknown;
  previousSignatureVisibility?: unknown;
  preserveSlot?: boolean;
  profileRequestId?: number;
  signatureRequestId?: number;
}

export function CompteLiquidGlassV8({ initialTab }: CompteLiquidGlassV8Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const sessionGeneration = getMyTripsSessionGeneration();
  const identityRef = useRef(user?.id ?? null);
  identityRef.current = user?.id ?? null;
  const runtimeEpochRef = useRef(0);
  const requestEpochRef = useRef(0);
  const pendingLogoutRef = useRef<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [activeHandle, setActiveHandle] = useState<string>('tony_frc');
  const bootstrapPayloadRef = useRef<unknown>(null);
  const bootstrapPhaseRef = useRef<BootstrapPhase>('idle');
  const [bootstrapPhase, setBootstrapPhase] = useState<BootstrapPhase>('idle');
  const lastSlotMountRef = useRef<PendingSlotMount | null>(null);
  const [drawerMount, setDrawerMount] = useState<{ root: HTMLElement | null; kind: string; props: any } | null>(null);
  const initialTabAppliedRef = useRef(false);
  const refreshSlotMountRef = useRef<() => void>(() => {});
  const retryBootstrapRef = useRef<() => void>(() => {});
  /** Dernière confidentialité persistée connue, pour rétablir sur échec. */
  const accountVisibilityRef = useRef<Visibility | null>(null);
  /** Dernière visibilité d'empreinte confirmée (`user_profiles.signature_visibility`). */
  const signatureVisibilityRef = useRef<SignatureVisibility | null>(null);
  const [slotMount, setSlotMount] = useState<SlotMountSnapshot | null>(null);
  const [mapRoot, setMapRoot] = useState<HTMLElement | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const mapContext = useCompteMapContext();

  useEffect(() => {
    if (!mapRoot || mapVisible) return;
    let cancelled = false;
    const show = () => { if (!cancelled) setMapVisible(true); };
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            const idle = (window as any).requestIdleCallback;
            if (typeof idle === 'function') {
              idle(show, { timeout: 1800 });
            } else {
              window.setTimeout(show, 700);
            }
          }
        }, { rootMargin: '120px' })
      : null;
    observer?.observe(mapRoot);
    const fallback = observer ? null : window.setTimeout(show, 2800);
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (fallback) window.clearTimeout(fallback);
    };
  }, [mapRoot, mapVisible]);

  /** Rejoue le dernier montage runtime avec le bootstrap le plus récent. */
  const refreshSlotMount = useCallback(() => {
    const pending = lastSlotMountRef.current;
    if (!pending) return;
    setSlotMount(deriveSlotMount(pending, bootstrapPayloadRef.current, bootstrapPhaseRef.current));
  }, []);
  refreshSlotMountRef.current = refreshSlotMount;

  const setBootstrapPhaseState = useCallback((phase: BootstrapPhase) => {
    bootstrapPhaseRef.current = phase;
    setBootstrapPhase(phase);
  }, []);


  const triggerAct = useCallback((action: string, val?: any) => {
    if (identityRef.current !== (user?.id ?? null) || getMyTripsSessionGeneration() !== sessionGeneration) return;
    if (typeof window !== 'undefined' && typeof (window as any).__lkdvCompteAct === 'function') {
      (window as any).__lkdvCompteAct(action, val);
    }
  }, [user?.id, sessionGeneration]);

  // Rebuild identity-owned DOM before the next account can paint.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || initializedRef.current) return;
    initializedRef.current = true;
    const owner = user?.id ?? null;
    const generation = getMyTripsSessionGeneration();
    const epoch = ++runtimeEpochRef.current;
    const isCurrent = () => runtimeEpochRef.current === epoch && identityRef.current === owner
      && (owner === null || isMyTripsSessionCurrent(owner, generation));
    window.__lkdvCompteMapOpenOuting = (id: string) => {
      if (!isCurrent()) return;
      triggerAct('openOutingDrawer', id);
    };
    bootstrapPayloadRef.current = null;
    bootstrapPhaseRef.current = 'idle';
    accountVisibilityRef.current = null;
    signatureVisibilityRef.current = null;
    lastSlotMountRef.current = null;
    setSlotMount(null);
    setDrawerMount(null);
    setBootstrapPhase('idle');
    setMapVisible(false);
    setActiveHandle('visiteur');
    el.innerHTML = COMPTE_V8_HTML;
    const mapNode = el.querySelector<HTMLElement>('#maplibre-compte-canvas');
    if (mapNode) setMapRoot(mapNode);

    // Drawer Profil v2 : le runtime vanilla rend #lkdv-slot-root et délègue le
    // contenu React (coquille, sélecteur .ig-tabs, swipe) à cet hôte. Le
    // montage est mémorisé : il sera rejoué quand le bootstrap répondra.
    (window as any).__lkdvMountSlot = (root: HTMLElement, slotId: string, S: any) => {
      if (!isCurrent()) return;
      const pending: PendingSlotMount = {
        root: root ?? null,
        slotId: slotId || 'vitrine',
        state: S,
      };
      lastSlotMountRef.current = pending;
      setSlotMount(deriveSlotMount(pending, bootstrapPayloadRef.current, bootstrapPhaseRef.current));
    };
    (window as any).__lkdvUnmountSlot = () => {
      if (!isCurrent()) return;
      lastSlotMountRef.current = null;
      setSlotMount(null);
    };

    // Drawers Réseau, Sortie et Compte : contenu React monté dans la feuille
    // runtime, sans fermer/rouvrir le drawer.
    (window as any).__lkdvMountDrawer = (root: HTMLElement, kind: string, props: any) => {
      if (!isCurrent() || !root) return;
      setDrawerMount({ root, kind, props });
    };
    (window as any).__lkdvUnmountDrawer = () => {
      if (!isCurrent()) return;
      setDrawerMount(null);
    };

    const cleanup = initCompteLiquidGlassRuntime(el, { userId: owner, isCurrent });

    // Register real catalog lookup for the Scan sheet
    (window as any).__lkdvScanLookup = async (query: string, cb: (item: any) => void) => {
      if (!isCurrent()) return;
      try {
        const res = await fetch(`/api/materiel/search?q=${encodeURIComponent(query)}`);
        if (!isCurrent()) return;
        if (res.ok) {
          const json = await res.json();
          if (!isCurrent()) return;
          const hit = (json.items || json.results || json.products || [])[0];
          if (hit) {
            cb({
              id: 'cat_' + (hit.id || Date.now()),
              n: hit.name || hit.product_name || query,
              b: hit.brand || 'LKDV',
              c: hit.category || 'Équipement',
              w: Number(hit.weight_g || hit.weight_grams) || 340,
              paid: Number(hit.price_eur || hit.price) || 119,
              cond: 'neuf',
              lent: null,
              so: 1,
              maint: null,
              verdict: 'utile',
            });
            return;
          }
        }
      } catch (_) {}
      if (!isCurrent()) return;
      cb({
        id: 'scan_' + Date.now(),
        n: query,
        b: 'Catalogue LKDV',
        c: 'Équipement',
        w: 310,
        paid: 95,
        cond: 'neuf',
        lent: null,
        so: 1,
        maint: null,
        verdict: 'utile',
      });
    };

    // Register direct profile navigation helper
    (window as any).__lkdvNavigateProfile = (userHandle: string) => {
      if (!isCurrent()) return;
      const clean = String(userHandle || '').replace(/^@/, '').trim();
      if (clean) {
        router.push(`/profil/${encodeURIComponent(clean)}`);
      }
    };

    // Register real browser & backend action handlers
    (window as any).__lkdvOnAction = async (action: string, val: any, S: any) => {
      if (!isCurrent()) return;
      const handle = S?.profile?.handle || 'visiteur';
      const profileUrl = `${window.location.origin}/u/${handle}`;

      if (action === 'navtab' && typeof val === 'string') {
        router.push(val);
        return;
      }

      if (action === 'openUserProfile' && typeof val === 'string') {
        const cleanHandle = val.replace(/^@/, '').trim();
        if (cleanHandle) {
          router.push(`/profil/${encodeURIComponent(cleanHandle)}`);
          return;
        }
      }

      if (action === 'copylink') {
        try {
          await navigator.clipboard.writeText(profileUrl);
        } catch (_) {}
      } else if (action === 'namedrop') {
        try {
          if (navigator.share) {
            await navigator.share({
              title: `Profil LKDV @${handle}`,
              text: `Empreinte terrain vérifiée de @${handle} sur Le Kit du Voyageur`,
              url: profileUrl,
            });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(profileUrl);
          }
        } catch (_) {}
      } else if (action === 'export') {
        const dump = typeof (window as any).__lkdvGetState === 'function' ? (window as any).__lkdvGetState() : { S };
        if (val === 'full') {
          try {
            const res = await fetch('/api/user/export', { cache: 'no-store' }).catch(() => isCurrent() ? fetch('/api/account/export') : Promise.reject(new Error('stale_account')));
            if (!isCurrent()) return;
            if (res.ok) {
              const text = await res.text();
              if (!isCurrent()) return;
              triggerBrowserDownload(`lkdv-export-rgpd-${handle}.json`, text, 'application/json;charset=utf-8');
              return;
            }
          } catch (_) {}
          if (!isCurrent()) return;
          const fallbackBundle = {
            schema: 'lkdv.gdpr.export.v1',
            exportedAt: new Date().toISOString(),
            handle,
            profile: S?.profile,
            visibility: S?.vis,
            orientation: S?.orient,
            massifs: S?.massifs,
            carnets: dump.CARNETS,
            outings: dump.OUTINGS,
            inventory: S?.invs,
            kitsLineage: dump.KITS_LINEAGE,
            orders: dump.ORDERS,
          };
          triggerBrowserDownload(
            `lkdv-export-rgpd-${handle}.json`,
            JSON.stringify(fallbackBundle, null, 2),
            'application/json;charset=utf-8'
          );
        } else if (val === 'gpx') {
          const latestTrip = (dump.OUTINGS || []).find((o: any) => o.slug);
          if (latestTrip?.slug) {
            window.location.href = `/api/voyages/${latestTrip.slug}/gpx`;
          } else {
            const gpx = buildGpxXml(dump.OUTINGS || [], handle);
            triggerBrowserDownload(`lkdv-traces-${handle}.gpx`, gpx, 'application/gpx+xml;charset=utf-8');
          }
        } else if (val === 'photos') {
          const geojson = {
            type: 'FeatureCollection',
            generatedAt: new Date().toISOString(),
            owner: `@${handle}`,
            features: (dump.CARNETS || []).map((c: any, idx: number) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [6.86 + idx * 0.12, 45.83 + idx * 0.08, 2350] },
              properties: { id: c.id, title: c.title, massif: c.mass, likes: c.likes, views: c.views },
            })),
          };
          triggerBrowserDownload(
            `lkdv-photos-geolocalisees-${handle}.geojson`,
            JSON.stringify(geojson, null, 2),
            'application/geo+json;charset=utf-8'
          );
        }
      } else if (action === 'stgear') {
        try {
          localStorage.setItem(`lkdv_forked_kit_v1:${owner ?? 'guest'}`, JSON.stringify({
            forkedAt: new Date().toISOString(),
            sourceHandle: handle,
            items: S?.invs || [],
          }));
          await fetch('/api/materiel/fork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceHandle: handle }),
          }).catch(() => {});
        } catch (_) {}
      } else if (action === 'toggleFollowUser' && typeof val === 'string') {
        try {
          const supabase = createClient();
          const { data: auth } = await supabase.auth.getUser();
          const me = auth?.user;
          if (!isCurrent() || !me || me.id !== owner) return;
          const clean = val.replace(/^@/, '').trim();
          const { data: target } = await supabase
            .from('public_profiles')
            .select('id')
            .eq('handle', clean)
            .maybeSingle();
          if (!isCurrent() || !target?.id || target.id === me.id) return;
          const { data: existing } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', me.id)
            .eq('following_id', target.id)
            .maybeSingle();
          if (!isCurrent()) return;
          if (existing?.id) {
            await supabase.from('user_follows').delete().eq('id', existing.id);
          } else {
            await supabase.from('user_follows').insert({ follower_id: me.id, following_id: target.id });
          }
        } catch (_) {}
      } else if (action === 'signout') {
        try {
          pendingLogoutRef.current = owner;
          await signOut();
        } catch (_) {}
      }
    };

    return () => {
      ++runtimeEpochRef.current;
      ++requestEpochRef.current;
      for (const key of ['__lkdvCompteMapOpenOuting', '__lkdvScanLookup', '__lkdvNavigateProfile', '__lkdvOnAction', '__lkdvOnMutate', '__lkdvHydrateCompte', '__lkdvGetState', '__lkdvCompteAct', '__lkdvOpenSlot', '__lkdvSetSlot', '__lkdvSetProfileVisibility', '__lkdvSetSignatureVisibility']) delete (window as any)[key];
      delete (window as any).__lkdvMountSlot;
      delete (window as any).__lkdvUnmountSlot;
      delete (window as any).__lkdvMountDrawer;
      delete (window as any).__lkdvUnmountDrawer;
      setDrawerMount(null);
      cleanup();
      lastSlotMountRef.current = null;
      initialTabAppliedRef.current = false;
      initializedRef.current = false;
    };
  }, [router, signOut, user?.id, sessionGeneration, triggerAct]);

  useEffect(() => {
    if (!pendingLogoutRef.current) return;
    if (user && user.id !== pendingLogoutRef.current) pendingLogoutRef.current = null;
    else if (!authLoading && !user) {
      pendingLogoutRef.current = null;
      router.push('/connexion');
    }
  }, [user, authLoading, router]);

  /**
   * Applique le deep link `?tab=` une fois le rôle connu.
   *
   * Un propriétaire dont le bootstrap n'a pas encore répondu est vu comme
   * visiteur : ouvrir le drawer à ce moment-là afficherait la coquille sans
   * ses entrées, puis le rôle arriverait trop tard. L'effet ci-dessous attend
   * donc la fin du chargement d'auth puis celle du bootstrap.
   */
  const applyInitialTab = useCallback(() => {
    if (!initialTab || initialTabAppliedRef.current) return;
    if (typeof window === 'undefined' || typeof (window as any).__lkdvCompteAct !== 'function') {
      return;
    }
    initialTabAppliedRef.current = true;
    const act = (window as any).__lkdvCompteAct;
    if (initialTab === 'carnets') {
      act('igtab', 0);
      act('openStep', '2:0');
    } else if (initialTab === 'aventures') {
      act('igtab', 1);
      act('openStep', '1:0');
    } else if (initialTab === 'clubs') {
      act('igtab', 3);
      (window as any).__lkdvOpenSlot?.('communaute');
    } else if (initialTab === 'commandes') {
      act('openAccountDrawer');
    } else if (initialTab === 'notifications') {
      act('openAccountDrawer', 1);
    } else if (initialTab === 'fidelite') {
      act('openStep', '3:3');
    } else if (initialTab === 'parametres') {
      act('openAccountDrawer', 2);
    } else if (initialTab === 'kits' || initialTab === 'kit') {
      (window as any).__lkdvOpenSlot?.('kit');
    } else if (initialTab === 'progression') {
      act('sealzoom');
    }
  }, [initialTab]);

  useEffect(() => {
    if (authLoading) return;
    if (user && (bootstrapPhase === 'idle' || bootstrapPhase === 'loading')) return;
    applyInitialTab();
  }, [authLoading, user, bootstrapPhase, applyInitialTab]);


  // Hydrate with live Supabase user data
  const syncSupabaseProfile = useCallback(async () => {
    const owner = user?.id ?? null;
    const generation = getMyTripsSessionGeneration();
    const epoch = ++requestEpochRef.current;
    const runtimeEpoch = runtimeEpochRef.current;
    const isCurrent = () => requestEpochRef.current === epoch && runtimeEpochRef.current === runtimeEpoch
      && identityRef.current === owner && (owner === null || isMyTripsSessionCurrent(owner, generation));
    if (!isCurrent()) return;
    const respondProfileVisibilityUnavailable = (
      value: unknown,
      meta?: CompteMutationMeta
    ) => {
      rejectProfileVisibility({
        value,
        previous: toAccountVisibility(meta?.previousProfileVisibility),
        onRollback: (previous) => {
          if (!isCurrent()) return;
          try {
            window.__lkdvSetProfileVisibility?.(previous);
          } catch (_) {}
          setSlotMount((current) =>
            current ? { ...current, visibility: previous } : current
          );
        },
        onFailed: (detail) => {
          if (!isCurrent()) return;
          window.dispatchEvent(
            new CustomEvent<ProfileVisibilityEventDetail>(PROFILE_VISIBILITY_EVENT, {
              detail: {
                ...detail,
                ...(Number.isFinite(meta?.profileRequestId)
                  ? { requestId: meta?.profileRequestId }
                  : {}),
              },
            })
          );
        },
      });
    };

    /* Sans session réelle, une écriture d'empreinte ne peut pas aboutir : on
       rétablit l'index d'avant et on signale `persisted:false`, sans laisser
       la Vitrine sur un bouton gelé. */
    const respondSignatureVisibilityUnavailable = (
      value: unknown,
      meta?: CompteMutationMeta
    ) => {
      const target = signatureVisibilityForValue(value);
      if (!target) return;
      const previous = signatureVisibilityForValue(meta?.previousSignatureVisibility);
      const previousIndex = signatureVisibilityIndex(previous);
      if (previousIndex !== null) {
        try {
          window.__lkdvSetSignatureVisibility?.(previousIndex);
        } catch (_) {}
      }
      window.dispatchEvent(
        new CustomEvent<SignatureVisibilityEventDetail>(SIGNATURE_VISIBILITY_EVENT, {
          detail: {
            value: target,
            persisted: false,
            ...(previous ? { revertedTo: previous } : {}),
            ...(Number.isFinite(meta?.signatureRequestId)
              ? { requestId: meta?.signatureRequestId }
              : {}),
          },
        })
      );
    };

    /* Pont de secours installé avant toute lecture réseau et avant le retour
       démo : sans session (ou si le bootstrap échoue), `profilevis` et `vis`
       reçoivent un échec explicite au lieu de laisser l'écran sur
       « Enregistrement… ». Le pont complet ci-dessous remplace ce secours dès
       que le compte est authentifié et hydraté. */
    (window as any).__lkdvOnMutate = async (
      k: string,
      value: any,
      _S: any,
      meta?: CompteMutationMeta
    ) => {
      if (!isCurrent()) return;
      if (k === 'profilevis') respondProfileVisibilityUnavailable(value, meta);
      else if (k === 'vis') respondSignatureVisibilityUnavailable(value, meta);
    };

    const hydrate = (window as any).__lkdvHydrateCompte;
    if (typeof hydrate !== 'function') {
      // Le runtime n'a pas exposé son hydrate : aucun profil réel ne peut être
      // posé. On l'expose comme un échec, jamais comme un compte vide.
      setBootstrapPhaseState('error');
      refreshSlotMountRef.current();
      return;
    }

    if (!user) {
      hydrate({
        name: 'Тоny',
        handle: 'tony_frc',
        followersCount: 1080,
        followingCount: 142,
        bioLine: '· Massifs alpins & bivouacs légers',
        avatarUrl: null,
        isGuest: false,
        isDemo: true,
        storeCreditEur: 42.50,
        loyaltyPoints: 1450,
        carnets: DEMO_CARNETS,
        outings: DEMO_OUTINGS,
        clubs: DEMO_CLUBS,
        gearItems: DEMO_GEAR_ITEMS,
        orders: DEMO_ORDERS,
        activeLoans: DEMO_ACTIVE_LOANS,
        notifications: [],
        tribu: [],
        replace: true,
      });
      bootstrapPayloadRef.current = null;
      setBootstrapPhaseState('idle');
      setActiveHandle('tony_frc');
      setSyncStatus('idle');
      refreshSlotMountRef.current();
      return;
    }

    setSyncStatus('syncing');
    // Session en cours de chargement : le drawer déjà ouvert montre un
    // squelette, jamais un état propriétaire supposé.
    setBootstrapPhaseState('loading');
    refreshSlotMountRef.current();

    try {
      const supabase = createClient();
      const [
        profileRes,
        followersRes,
        followingRes,
        carnetsRes,
        travelGroupsRes,
        clubsRes,
        gearRes,
        ordersRes,
        tripsRes,
        sigRes,
        rewardRes,
        loansRes,
      ] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, handle, full_name, bio, location, avatar_url, profile_visibility, signature_visibility, trust_score, loyalty_points, role, created_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', user.id),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', user.id),
        supabase
          .from('carnets')
          .select('id, title, destination, visibility, cover_image, description, created_at, views_count, likes_count, comments_count, verified')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('travel_groups')
          .select('id, name, destination, departure_date, return_date')
          .eq('owner_id', user.id)
          .order('departure_date', { ascending: false })
          .limit(10),
        supabase
          .from('club_members')
          .select('role, club:clubs(id, name, slug, description, category, members_count, cover_image, created_at)')
          .eq('user_id', user.id)
          .limit(8),
        supabase
          .from('product_ownership')
          .select('id, name, brand, category, weight_g, price_cents, condition, is_lent, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('orders')
          .select('id, order_number, total_eur, status, created_at, items')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        fetchMyTripsCached(user.id).catch(() => null),
        fetch(`/api/identity/signature?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        supabase
          .from('reward_accounts')
          .select('store_credit_cents, available_cash, available_points')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('materiel_loans')
          .select('id, product_ownership_id, borrower_contact, status, loaned_at')
          .eq('lender_id', user.id)
          .eq('status', 'active'),
      ]);

      if (!isCurrent()) return;
      const hasUserCarnets = Array.isArray(carnetsRes.data) && carnetsRes.data.length > 0;
      const userClubs = (clubsRes.data || [])
        .map((cm: any) => ({
          slug: cm.club?.slug || cm.club?.id,
          name: cm.club?.name || 'Club LKDV',
          role: cm.role,
          membersCount: cm.club?.members_count || 0,
        }))
        .filter((c: any) => c.name);

      const patch: Record<string, any> = {
        isGuest: false,
        followersCount: followersRes.count ?? 0,
        followingCount: followingRes.count ?? 0,
        carnets: hasUserCarnets ? carnetsRes.data : [],
        clubs: userClubs,
        gearItems: gearRes.data || [],
        orders: ordersRes.data || [],
        activeLoans: loansRes.data || [],
        // Le bootstrap complet arrive ensuite ; on ne laisse jamais les
        // tableaux de démonstration visibles sur un compte connecté.
        kits: [],
        species: [],
        massifs: [],
        followers: [],
        following: [],
      };

      if (profileRes.data) {
        const p = profileRes.data;
        const derivedHandle = p.handle || (p.full_name
          ? p.full_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 16)
          : (user.email ? user.email.split('@')[0] : 'voyageur'));
        patch.handle = derivedHandle;
        patch.name = p.full_name || 'Voyageur LKDV';
        patch.loyaltyPoints = Number(p.loyalty_points || 0);
        patch.bioLine = p.bio ? ('· ' + p.bio.split('\n')[0].slice(0, 48)) : '';
        patch.home = p.location || '';
        // `signature_visibility` (private par défaut) et `profile_visibility`
        // arrivent avec la première hydratation : le runtime ne doit jamais
        // rester sur le défaut Communauté de la maquette.
        Object.assign(patch, mapProfileRuntimeVisibility(p));
        if (p.avatar_url && p.avatar_url !== '/assets/images/no_image.png') {
          patch.avatarUrl = p.avatar_url;
        }
        setActiveHandle(derivedHandle);
      }

      if (sigRes && sigRes.signature) {
        patch.sigText = sigRes.signature;
      }

      // Store credit & rewards
      const creditEur = (rewardRes.data?.store_credit_cents ? rewardRes.data.store_credit_cents / 100 : 0) + Number(rewardRes.data?.available_cash || 0);
      patch.storeCreditEur = creditEur;

      // Sorties réelles uniquement : aucun repli démo sur un compte connecté.
      const combinedOutings: any[] = [];
      if (Array.isArray(travelGroupsRes.data) && travelGroupsRes.data.length > 0) {
        combinedOutings.push(...travelGroupsRes.data);
      }
      if (tripsRes && Array.isArray(tripsRes.trips)) {
        combinedOutings.push(...tripsRes.trips);
      }
      patch.outings = combinedOutings;

      hydrate(patch);
      setSyncStatus('synced');

      // Bootstrap complet : remplace les tableaux de démonstration par les
      // données réelles (profil, carnets, sorties, commandes, follows, clubs).
      // C'est aussi lui qui confirme le rôle : tant qu'il n'a pas répondu,
      // l'hôte ne peut pas afficher les entrées propriétaire.
      try {
        const bootRes = await fetch('/api/compte/bootstrap');
        if (!isCurrent()) return;
        if (!bootRes.ok) throw new Error(`bootstrap_http_${bootRes.status}`);
        const payload = await bootRes.json();
        if (!isCurrent()) return;
        bootstrapPayloadRef.current = payload;
        if (payload?.error) throw new Error(String(payload.error));
        const bootVisibility =
          payload?.visibility?.profile === 'prive'
            ? 'prive'
            : payload?.visibility?.profile === 'public'
              ? 'public'
              : null;
        if (bootVisibility) accountVisibilityRef.current = bootVisibility;
        const bootSignatureIndex = signatureVisibilityIndex(payload?.visibility?.signature);
        const bootSignature = signatureVisibilityForValue(bootSignatureIndex);
        if (bootSignature) signatureVisibilityRef.current = bootSignature;
        if (payload?.authenticated) {
          hydrate({
            ...payload.profile,
            profileVisibility: bootVisibility,
            ...(bootSignatureIndex !== null ? { vis: bootSignatureIndex } : {}),
            carnets: payload.carnets || [],
            outings: payload.outings || [],
            orders: payload.orders || [],
            bookings: payload.bookings || [],
            clubs: payload.clubs || [],
            tribu: payload.tribu || [],
            followers: payload.followers || [],
            following: payload.following || [],
            kits: payload.kits || [],
            stories: payload.stories || [],
            highlights: payload.highlights || [],
            species: payload.species || [],
            massifs: payload.massifs || [],
            notifications: payload.notifications || [],
            replace: true,
          });
          if (payload.profile?.handle) setActiveHandle(payload.profile.handle);
        }
        setBootstrapPhaseState('ready');
      } catch (_) {
        if (!isCurrent()) return;
        // Échec explicite : le drawer montre l'erreur et propose de réessayer,
        // il ne se présente jamais comme un compte vide.
        bootstrapPayloadRef.current = null;
        setBootstrapPhaseState('error');
      } finally {
        // Le runtime a pu monter le drawer avant la réponse : on rejoue le
        // dernier montage avec le rôle et le payload désormais connus.
        if (isCurrent()) refreshSlotMountRef.current();
      }
      if (!isCurrent()) return;

      // Hook up mutation callback to persist changes back to Supabase & API routes
      (window as any).__lkdvOnMutate = async (
        k: string,
        v: any,
        S: any,
        meta?: CompteMutationMeta
      ) => {
        if (!isCurrent()) return;
        try {
          if (k === 'profilevis') {
            // Confidentialité du compte : `public` | `prive`, exactement les
            // valeurs du CHECK. Écriture RLS-scopée sur la ligne de l'appelant,
            // confirmée par relecture avant tout succès affiché.
            const update = accountVisibilityUpdate(v);
            if (!update) return;
            const previous =
              accountVisibilityRef.current ?? toAccountVisibility(meta?.previousProfileVisibility);
            await persistProfileVisibility({
              client: supabase,
              userId: user.id,
              value: update.profile_visibility,
              previous,
              onPersisted: (value) => {
                if (!isCurrent()) return;
                accountVisibilityRef.current = value;
                const boot = bootstrapPayloadRef.current as any;
                if (boot) {
                  boot.visibility = {
                    ...(boot.visibility ?? {}),
                    profile: value,
                  };
                }
                setSlotMount((current) =>
                  current ? { ...current, visibility: value } : current
                );
                window.dispatchEvent(
                  new CustomEvent<ProfileVisibilityEventDetail>(PROFILE_VISIBILITY_EVENT, {
                    detail: {
                      value,
                      persisted: true,
                      ...(Number.isFinite(meta?.profileRequestId)
                        ? { requestId: meta?.profileRequestId }
                        : {}),
                    },
                  })
                );
              },
              onRollback: (value) => {
                if (!isCurrent()) return;
                // Retour exact : le runtime ne doit jamais afficher une
                // confidentialité qui n'a pas été écrite.
                try {
                  window.__lkdvSetProfileVisibility?.(value);
                } catch (_) {}
                setSlotMount((current) =>
                  current ? { ...current, visibility: value } : current
                );
              },
              onFailed: (detail) => {
                if (!isCurrent()) return;
                window.dispatchEvent(
                  new CustomEvent<ProfileVisibilityEventDetail>(
                    PROFILE_VISIBILITY_EVENT,
                    {
                      detail: {
                        ...detail,
                        ...(Number.isFinite(meta?.profileRequestId)
                          ? { requestId: meta?.profileRequestId }
                          : {}),
                      },
                    }
                  )
                );
              },
            });
            return;
          }
          if (k === 'vis') {
            // Visibilité de l'empreinte : écriture RLS puis relecture. Aucun
            // succès n'est annoncé avant que la colonne ne porte la cible ;
            // en cas d'échec, le runtime revient à l'index précédent.
            await persistSignatureVisibility({
              client: supabase,
              userId: user.id,
              value: S.vis,
              previous: meta?.previousSignatureVisibility,
              onPersisted: (value) => {
                if (!isCurrent()) return;
                signatureVisibilityRef.current = value;
                const boot = bootstrapPayloadRef.current as any;
                if (boot) {
                  boot.visibility = {
                    ...(boot.visibility ?? {}),
                    signature: value,
                  };
                }
                window.dispatchEvent(
                  new CustomEvent<SignatureVisibilityEventDetail>(
                    SIGNATURE_VISIBILITY_EVENT,
                    {
                      detail: {
                        value,
                        persisted: true,
                        ...(Number.isFinite(meta?.signatureRequestId)
                          ? { requestId: meta?.signatureRequestId }
                          : {}),
                      },
                    }
                  )
                );
              },
              onRollback: (index) => {
                if (!isCurrent()) return;
                try {
                  window.__lkdvSetSignatureVisibility?.(index);
                } catch (_) {}
              },
              onFailed: (detail) => {
                if (!isCurrent()) return;
                window.dispatchEvent(
                  new CustomEvent<SignatureVisibilityEventDetail>(
                    SIGNATURE_VISIBILITY_EVENT,
                    {
                      detail: {
                        ...detail,
                        ...(Number.isFinite(meta?.signatureRequestId)
                          ? { requestId: meta?.signatureRequestId }
                          : {}),
                      },
                    }
                  )
                );
              },
            });
            return;
          } else if (k === 'home') {
            await supabase
              .from('user_profiles')
              .update({ location: S.traveller?.home, updated_at: new Date().toISOString() })
              .eq('id', user.id);
          } else if (k === 'pubdraft') {
            const dump = typeof (window as any).__lkdvGetState === 'function' ? (window as any).__lkdvGetState() : null;
            const draftCarnet = dump?.CARNETS?.find((c: any) => c.id === 'ca0');
            if (draftCarnet?.realId) {
              await supabase
                .from('carnets')
                .update({ visibility: 'public' })
                .eq('id', draftCarnet.realId);
              if (!isCurrent()) return;
              requestCarnetPublicationAward(draftCarnet.realId, user.id);
            }
          } else if (k === 'additem') {
            const latest = S.invs?.[S.invs.length - 1];
            if (latest) {
              await fetch('/api/materiel/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  product_name: latest.n,
                  brand: latest.b,
                  category: latest.c,
                  weight_g: latest.w,
                  purchase_price_eur: latest.paid,
                  condition: latest.cond || 'neuf',
                }),
              }).catch(() => {});
            }
          }
        } catch (_) {}
      };
    } catch {
      if (!isCurrent()) return;
      setSyncStatus('idle');
      // Une lecture Supabase ratée avant le bootstrap ne doit pas laisser la
      // coquille en chargement perpétuel : c'est un échec explicite.
      if (bootstrapPhaseRef.current !== 'ready') {
        setBootstrapPhaseState('error');
        refreshSlotMountRef.current();
      }
    }
  }, [user, setBootstrapPhaseState, sessionGeneration]);

  // Une story à la une a été modifiée dans son tiroir : on relit le profil.
  useEffect(() => {
    const onHighlightsChanged = () => { void syncSupabaseProfile(); };
    window.addEventListener('lkdv:highlights-changed', onHighlightsChanged);
    return () => window.removeEventListener('lkdv:highlights-changed', onHighlightsChanged);
  }, [syncSupabaseProfile]);

  useEffect(() => {
    retryBootstrapRef.current = () => {
      void syncSupabaseProfile();
    };
  }, [syncSupabaseProfile]);

  useEffect(() => {
    syncSupabaseProfile();
  }, [syncSupabaseProfile]);

  return (
    <div className="lkdv-compte-v8" data-theme="light">
      <style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />
      {/* Sub-navigation bar: live Supabase status + direct routes + quick actions (accessible sentinel) */}
      <div className="sr-only" aria-hidden="true" inert>
      <div className="mx-auto flex max-w-[1260px] flex-wrap items-center justify-between gap-2 px-4 pt-2 pb-1 text-xs text-[color:var(--lkv-text-secondary)]">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-2 w-2 rounded-full bg-[#17402C]"
            aria-hidden="true"
          />
          <span className="font-semibold text-[color:var(--lkv-text-primary)]">
            Profil iOS 27 Liquid Glass v8
          </span>
          <span className="rounded-full border border-[#143726]/15 bg-[#EBF2EC] px-2.5 py-0.5 font-medium text-[#17402C]">
            {user
              ? syncStatus === 'syncing'
                ? 'Synchronisation Supabase…'
                : `Connecté · @${activeHandle}`
              : `Mode invité · aperçu de démonstration`}
          </span>
          {user && (
            <button
              type="button"
              onClick={() => syncSupabaseProfile()}
              className="rounded-full border border-[#143726]/15 bg-white/60 px-2.5 py-0.5 font-medium text-[#17402C] transition hover:bg-white"
            >
              Actualiser
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/compte/modifier"
            className="rounded-full border border-[#143726]/20 bg-white/70 px-3 py-1 font-semibold text-[#17402C] backdrop-blur-md transition hover:bg-white"
          >
            Modifier le profil
          </Link>
          <Link
            href="/compte/voyageur"
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Profil voyageur (Lot Z1)
          </Link>
          <button
            type="button"
            onClick={() => triggerAct('openscan')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Scanner matériel
          </button>
          <button
            type="button"
            onClick={() => triggerAct('openStep', '3:2')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Commandes
          </button>
          <button
            type="button"
            onClick={() => triggerAct('openStep', '3:1')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Crédits &amp; Lignées
          </button>
          <button
            type="button"
            onClick={() => triggerAct('export', 'full')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Export RGPD (.json)
          </button>
          <button
            type="button"
            onClick={() => triggerAct('export', 'gpx')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Export GPX (.gpx)
          </button>
          <Link
            href="/progression"
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Progression
          </Link>
          {!user && (
            <Link
              href="/connexion?redirect=/compte"
              className="rounded-full bg-[#17402C] px-3 py-1 font-semibold text-white transition hover:opacity-90"
            >
              Se connecter
            </Link>
          )}
        </div>
      </div>
      </div>
      <div ref={containerRef} />
      {mapRoot && mapVisible ? createPortal(
        <CompteMapBoundary>
        <CompteMap
          authState={
            bootstrapPhase === 'ready'
              ? (bootstrapPayloadRef.current as { authenticated?: boolean } | null)?.authenticated
                ? 'owner'
                : 'guest'
              : bootstrapPhase === 'error'
                ? 'error'
                : authLoading
                  ? 'loading'
                  : !user
                    ? 'guest'
                    : 'loading'
          }
          context={mapContext}
        />
        </CompteMapBoundary>,
        mapRoot
      ) : null}
      {drawerMount?.root ? createPortal(
        drawerMount.kind === 'reseau' ? (
          <ReseauDrawer initialTab={drawerMount.props?.tab === 'followers' ? 1 : 0} />
        ) : drawerMount.kind === 'sortie' ? (
          <SortieDrawer outingId={String(drawerMount.props?.outingId || '')} />
        ) : drawerMount.kind === 'highlight' ? (
          <HighlightEditDrawer hlId={String(drawerMount.props?.hlId || '')} hlTitle={String(drawerMount.props?.hlTitle || '')} />
        ) : drawerMount.kind === 'compte' ? (
          <CompteDrawer initialTab={Number(drawerMount.props?.tab) || 0} />
        ) : (
          <div style={{ padding: 16 }}>Chargement…</div>
        ),
        drawerMount.root
      ) : null}
      {user ? <FirstRunJourney userId={user.id} /> : null}
      <CompteOverlayHost onChanged={() => { void syncSupabaseProfile(); }} />
      {slotMount ? (
        <ProfileDrawerHost
          viewer={slotMount.viewer}
          visibility={slotMount.visibility}
          invited={slotMount.invited}
          activeSlot={slotMount.slotId}
          portalRoot={slotMount.root}
          onSlotChange={(slot) => {
            if (typeof window !== 'undefined') {
              (window as any).__lkdvSetSlot?.(slot);
            }
          }}
          payload={slotMount.payload}
          state={slotMount.state}
          onRetry={
            slotMount.state === 'error'
              ? () => {
                  retryBootstrapRef.current();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

export default CompteLiquidGlassV8;
