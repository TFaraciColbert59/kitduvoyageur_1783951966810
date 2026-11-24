'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../compte/compte-v8.css';
import '../compte/compte-apple-hig.css';
import '../compte/overlay/compte-drawers.css';
import '@/features/posts/ui/post-system.css';
import '@/styles/community-feed.css';
import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import './club-adaptation.css';
import './drawer/club-drawers-v2.css';
import './map/club-map.css';
import type { CompteMapPayload, MapMassif, MapTrack, TrackPoint } from '@/features/compte/map/types';
import { boundsOf as boundsOfMapPoints } from '@/features/compte/map/geometry';
import { useClubMapContext } from './map/useClubMapContext';
import type {
  ClubMapKitUsage,
  ClubMapLiveMember,
  ClubMapOutingTrack,
  ClubMapPokedexItem,
  ClubMapPostPin,
  ClubMapSelection,
  ClubRichMapMassifSummary,
  ClubRichMapPayload,
} from './map/clubMapTypes';
import { buildOutingTrackGeometry, snapPointAlongTrack } from './map/clubTrackGeometry';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { createGroupFromClub } from '@/features/tribu/actions/createGroupFromClub';
import type { ClubChallengeSummary, ClubRole } from '@/features/clubs';
import type { CreateKindV2 } from '@/features/community/v2/create/engine/createSchemasV2';
import type { StoryUser } from '@/components/communaute/StoriesViewer';
import { DRAWER_V2_CSS } from '../compte/drawer/SlotShell';
import {
  ClubInlineFeed,
  type ClubFeedPostItem,
  type ClubStoryHighlight,
} from './feed/ClubInlineFeed';
import { METRIC_LABELS, METRIC_UNITS } from './g02/model';
import type { ClubG02Section } from './g02/ClubG02Screen';
import { ClubIsland, type ClubIslandToast } from './drawer/ClubIsland';
import { ClubRuntimeOverlays } from './drawer/ClubRuntimeOverlays';
import { resolveMassifCoords } from './drawer/ClubSharedUi';
import type {
  ClubItemData,
  ClubPoleItem,
  ClubMemberData,
  ClubOutingData,
  ClubGearVaultItem,
  ClubStandardKit,
  ClubChallengeItem,
  ClubChatMessage,
  ClubDrawerIntent,
  ClubToastPayload,
  ClubRuntimeOverlayKind,
  ClubRuntimeOverlayState,
} from './drawer/ClubDrawerTypes';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val?: string | null): val is string => Boolean(val && UUID_RE.test(val));

interface ClubMapActionPayload {
  kind: 'open-outing' | 'open-massif' | 'open-member' | 'open-kit' | 'open-post' | 'rsvp-outing';
  id: string;
  outingId?: string;
}

function slugifyMassif(raw?: string | null): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'alpes';
}

function inferPoleIdFromText(
  poles: ClubPoleItem[] | undefined,
  ...parts: Array<string | undefined | null>
): string | undefined {
  if (!poles || poles.length === 0) return undefined;
  const hay = parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!hay) return undefined;
  for (const pole of poles) {
    const words = `${pole.name} ${pole.specialty}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && w !== 'pole');
    if (words.some((w) => hay.includes(w))) return pole.id;
  }
  return undefined;
}

// Le tiroir du club (~25 Ko gz avec ses dépendances) ne sert qu'à l'ouverture d'un tiroir :
// il est monté seulement quand `drawerMount` est renseigné, donc chargé à ce moment-là
// (et préchargé au repos une fois l'écran prêt).
class ClubMapBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[club-map]', error);
  }
  render() {
    if (this.state.failed) {
      return <div className="lkdv-map-unavailable">Carte momentanément indisponible</div>;
    }
    return this.props.children;
  }
}

const ClubMap = dynamic(
  () => import('./map/ClubMap').then((mod) => mod.ClubMap),
  { ssr: false },
);

const loadClubDrawerHost = () => import('./drawer/ClubDrawerHost').then((m) => ({ default: m.ClubDrawerHost }));
const ClubDrawerHost = dynamic(loadClubDrawerHost, { ssr: false });
const CreateSheetV2 = dynamic(
  () => import('@/features/community/v2/create/CreateSheetV2').then((m) => ({ default: m.CreateSheetV2 })),
  { ssr: false },
);
const StoriesViewer = dynamic(() => import('@/components/communaute/StoriesViewer'), { ssr: false });

const COMPTE_V8_HTML = "<div class=\"stage\">\r\n<div class=\"pwrap\" id=\"pwrap\"><div class=\"phone\" id=\"phone\" aria-label=\"Maquette iPhone du profil LKDV  en Liquid Glass iOS 27\">\r\n  <div class=\"bg\" aria-hidden=\"true\" style=\"background-image:url(/assets/images/account-bg.webp)\"></div>\r\n  <div class=\"status\" aria-hidden=\"true\"><span>9:41</span><span class=\"r\">\r\n    <svg width=\"18\" height=\"12\" viewBox=\"0 0 18 12\"><rect x=\"0\" y=\"8\" width=\"3\" height=\"4\" rx=\"1\" fill=\"#fff\"/><rect x=\"5\" y=\"5.5\" width=\"3\" height=\"6.5\" rx=\"1\" fill=\"#fff\"/><rect x=\"10\" y=\"3\" width=\"3\" height=\"9\" rx=\"1\" fill=\"#fff\"/><rect x=\"15\" y=\"0\" width=\"3\" height=\"12\" rx=\"1\" fill=\"#fff\"/></svg>\r\n    <svg width=\"16\" height=\"12\" viewBox=\"0 0 16 12\"><path d=\"M8 11.2 5.6 8.8a3.4 3.4 0 0 1 4.8 0L8 11.2Z\" fill=\"#fff\"/><path d=\"M3.4 6.6a6.5 6.5 0 0 1 9.2 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M1 4.2a9.9 9.9 0 0 1 14 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/></svg>\r\n    <svg width=\"27\" height=\"13\" viewBox=\"0 0 27 13\"><rect x=\".5\" y=\".5\" width=\"23\" height=\"12\" rx=\"3.8\" stroke=\"rgba(255,255,255,.6)\" fill=\"none\"/><rect x=\"2.5\" y=\"2.5\" width=\"17\" height=\"8\" rx=\"2.2\" fill=\"#fff\"/><path d=\"M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z\" fill=\"rgba(255,255,255,.6)\"/></svg></span></div>\r\n  <div class=\"island\" id=\"island\" data-s=\"idle\" role=\"status\" aria-live=\"polite\"><div class=\"is live\" id=\"isl\"></div><div class=\"is note\" id=\"isn\"></div></div>\r\n\r\n  <section class=\"top\" id=\"top\"></section>\r\n\r\n  <section class=\"mapzone\" aria-label=\"Carte d'empreinte et d'aventures de \">\r\n    <div class=\"map\" id=\"map\"><div id=\"map-loading-bar\" class=\"map-loading-bar\"><div class=\"map-loading-pill\"><span class=\"map-loading-pulse\"></span><span>Initialisation du Relief 3D…</span></div><div class=\"map-loading-track\"><div id=\"map-loading-fill\" class=\"map-loading-fill\"></div></div></div><div id=\"maplibre-compte-canvas\" style=\"position:absolute;inset:0;width:100%;height:100%;z-index:1;\"></div><div class=\"map-scale-selector\" role=\"group\" aria-label=\"Échelle de la carte 3D\"><button id=\"btnCompteOrbite\" class=\"active\" data-a=\"mapscale\" data-v=\"ORBITE\" data-scale=\"ORBITE\" aria-label=\"Vue Globe Terrestre\" aria-pressed=\"true\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/></svg></button><button id=\"btnCompteMassif\" data-a=\"mapscale\" data-v=\"MASSIF\" data-scale=\"MASSIF\" aria-label=\"Vue Massif Alpin\" aria-pressed=\"false\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/></svg></button><button id=\"btnCompteSentier\" data-a=\"mapscale\" data-v=\"SENTIER\" data-scale=\"SENTIER\" aria-label=\"Vue Sentier 3D Immersion\" aria-pressed=\"false\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polygon points=\"16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76\"/></svg></button></div><div class=\"map-badge-3d\"><span>GLOBE 3D</span></div>\r\n      <svg class=\"tm\" id=\"tm\" viewBox=\"0 -24 370 368\" preserveAspectRatio=\"xMidYMid slice\" role=\"img\" aria-label=\"Carte générée de ton empreinte terrain\"></svg>\r\n      <button class=\"mgrab\" id=\"mgrab\" data-a=\"mapbig\" aria-label=\"Agrandir ou réduire la carte\"><span></span></button>\r\n      <div class=\"lg mctl\" id=\"mctl\" role=\"group\" aria-label=\"Contrôles de la carte\"></div>\r\n      <div class=\"lg callout\" id=\"callout\" hidden></div>\r\n    </div>\r\n  </section>\r\n\r\n  <nav class=\"tabbar\" id=\"tabbar\" aria-label=\"Navigation principale\">\r\n    \r\n    <div class=\"lg tb\" id=\"tb\"></div>\r\n  </nav>\r\n  <div class=\"home\"></div>\r\n\r\n  <div class=\"sw-wrap\" id=\"sw\" data-det=\"closed\"><div class=\"scrim\" data-a=\"close\"></div><section class=\"sheet\" id=\"sheet\" role=\"dialog\" aria-label=\"Détails du compte\"></section></div>\r\n  <div class=\"lg popv\" id=\"popv\" role=\"dialog\" aria-label=\"Affichage\"></div>\r\n  <div class=\"lg mopts\" id=\"mopts\" role=\"dialog\" aria-label=\"Personnaliser la carte\"></div>\r\n  <div class=\"lg rmenu\" id=\"rmenu\" role=\"menu\" aria-label=\"Choisir une option\"></div>\r\n  <div class=\"ctx\" id=\"ctx\" role=\"dialog\" aria-label=\"Aperçu\"></div>\r\n  <div class=\"story\" id=\"story\" role=\"dialog\" aria-label=\"Story plein écran\"></div>\r\n  <div class=\"post-modal-instagram\" id=\"post_modal_instagram\" role=\"dialog\" aria-label=\"Publication Instagram\"></div>\r\n</div></div>\r\n\r\n<aside class=\"notes\">\r\n  <span class=\"tag\">Maquette finale · Compte  · iOS 27 Liquid Glass</span>\r\n  <h1>L'anatomie Instagram de  fusionnée dans le verre iOS 27 LKDV.</h1>\r\n  <p>Toute l'ergonomie de ton profil Instagram (<code></code> · <b>Тоny</b> · <code>3 publications</code> · <code>1 080 followers</code> · <code>339 suivi(e)s</code> · bio <code>IT·FR</code> · stories À la une · grille photo 3 colonnes) habillée avec le Design System unique Liquid Glass v8 et ta carte d'empreinte vivante en bas.</p>\r\n  <ul>\r\n    <li><b>En-tête Instagram </b> : vrai avatar entouré de l'anneau Sceau d'empreinte (ADR-010), bulle de note en verre, compteurs interactifs et boutons <i>Modifier le profil</i> / <i>Partager le profil</i> en verre dépoli (<code>--pg</code> / <code>.soft</code>).</li>\r\n    <li><b>Stories À la une & Grille 3×3</b> : moments terrain (<i>IT·FR Alpes</i>, <i>⛺ Néouvielle</i>, <i>🦌 Vercors</i>, <i>🎒 Sac 4,8kg</i>) et grille carrée 3 colonnes synchronisée avec la carte d'empreinte en bas.</li>\r\n    <li><b>4 onglets profil</b> : <b>Grille</b> (publications & carnets), <b>Carte</b> (sorties GPS & massifs), <b>Lignées</b> (Propagation, Endurance 91 % & Part créateur 42,50 €), <b>Tribu</b> (sorties en équipage & matériel prêté).</li>\r\n    <li><b>Tests E2E Maestro MCP</b> : identifiants et libellés accessibles pour piloter et vérifier chaque flux via Maestro MCP (<code>maestro mcp</code>).</li>\r\n  </ul>\r\n\r\n  <h2 style=\"margin:22px 0 6px;font-size:15px\">50 améliorations intégrées</h2>\r\n  <ul>\r\n    <li><b>Identité</b> : anneau animé ou ciselé, note 24 h modifiable, vue visiteur, Sceau zoomable, bascule profil / clubs (appui long sur <code>tony_frc</code>).</li>\r\n    <li><b>Stories</b> : visionneuse plein écran, story Sac, couvertures topographiques, espèce épinglée, création depuis une sortie.</li>\r\n    <li><b>Grille</b> : épingles, Peek &amp; Pop (appui long), progression du brouillon, fil, filtres saison / massif.</li>\r\n    <li><b>Carte &amp; accessoire</b> : survol lié, clusters 2/3, relief ombré, mini-profil, comparateur, 3 modes, repères, scrubber filtrant, J-4.</li>\r\n    <li><b>Lignées &amp; sac</b> : filiation G1→G3, jauge 3/5, simulateur, journal 300 bps, vestiaire 3×2, usure, prêts, scan.</li>\r\n    <li><b>Profil voyageur, sécurité, RGPD</b> : impact Compas, double nationalité, flou 1 km, coffre Face ID, SMS SOS, stockage, matrice « qui voit quoi », exports.</li>\r\n    <li><b>Interactions</b> : voix composée, reflet pilotable, QR + NameDrop, plein soleil renforcé.</li>\r\n  </ul>\r\n</aside>\r\n</div>";

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

export interface ClubLiquidGlassV8Props {
  clubId?: string;
  initialTab?: string;
}

const INITIAL_CLUBS_DIRECTORY: ClubItemData[] = [];
const INITIAL_CLUB_POSTS: ClubFeedPostItem[] = [];
const INITIAL_CLUB_MEMBERS: ClubMemberData[] = [];
const INITIAL_CLUB_OUTINGS: ClubOutingData[] = [];
const INITIAL_VAULT_GEAR: ClubGearVaultItem[] = [];
const INITIAL_STANDARD_KITS: ClubStandardKit[] = [];
const INITIAL_CHALLENGES: ClubChallengeItem[] = [];
const INITIAL_CHAT_MESSAGES: ClubChatMessage[] = [];

function buildRecommendedPoles(clubName: string, category: string): ClubPoleItem[] {
  const hay = `${clubName} ${category}`.toLowerCase();
  if (/sentiers pour tous|jo[eë]lette|handi|partage/.test(hay)) {
    return [
      { id: 'pole-joelette', name: 'Pôle Joëlette & Partage', specialty: 'Pilotage joëlette & randonnée adaptée' },
      { id: 'pole-reco', name: 'Pôle Reconnaissance & Topo', specialty: 'Repérage GPX, dénivelé & accessibilité' },
      { id: 'pole-logistique', name: 'Pôle Covoit & Logistique', specialty: 'Transport matériel, bivouac & entraide' },
    ];
  }
  return [
    { id: 'pole-rando', name: 'Pôle Rando & Bivouac', specialty: 'Trekking autonomie, refuges & lacs' },
    { id: 'pole-alpi', name: 'Pôle Alpinisme & Sommets', specialty: 'Courses d’arêtes, glacier & haute montagne' },
    { id: 'pole-trail', name: 'Pôle Trail & Crêtes', specialty: 'Sorties rapides, D+ & endurance' },
  ];
}

const DEFAULT_FALLBACK_CLUB: ClubItemData = {
  id: '',
  slug: '',
  name: 'Club LKDV',
  massif: 'Massif Alpin',
  category: 'Montagne & Bivouac',
  level: 'Tous niveaux',
  membersCount: 0,
  outingsCount: 0,
  totalKm: 0,
  totalDplus: 0,
  joined: false,
  role: 'Membre',
  visibility: 'public',
  bio: 'Rejoignez ou créez une cordée alpine sur LKDV.',
  charter: 'Respect strict de la montagne, de la sécurité et zéro trace.',
  nextOutingTitle: 'Aucune sortie programmée',
  nextOutingDate: 'À venir',
  weatherIso: 'Iso 0°C —',
  weatherWind: 'Vent calme',
  weatherTrail: 'Conditions stables',
  lat: 45.923,
  lng: 6.869,
};

const TIROIR_TAB_MAP: Record<string, number> = {
  stats: 0,
  statistiques: 0,
  performance: 0,
  cordee: 1,
  sorties: 2,
  coffre: 3,
  salons: 4,
};

export function ClubLiquidGlassV8({ clubId = 'cl1', initialTab }: ClubLiquidGlassV8Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const runtimeReadyRef = useRef(false);
  const pendingProfileSyncRef = useRef(false);
  const syncProfileRef = useRef<() => void>(() => {});
  const pendingDrawerIntentRef = useRef<Partial<ClubDrawerIntent> | null>(null);
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [activeHandle, setActiveHandle] = useState<string>(clubId || '');

  // React Portal targets inside the iOS 27 runtime card & sheet
  const [feedRoot, setFeedRoot] = useState<HTMLElement | null>(null);
  const [drawerMount, setDrawerMount] = useState<{
    root: HTMLElement;
    kind: string;
    props: {
      mode?: 'main' | 'create';
      tab?: number;
      subTab?: number;
      outingId?: string;
      memberId?: string;
      initialSection?: ClubG02Section;
    };
  } | null>(null);
  const [drawerIntent, setDrawerIntent] = useState<ClubDrawerIntent | null>(null);
  const [islandToast, setIslandToast] = useState<ClubIslandToast | null>(null);
  const [runtimeOverlay, setRuntimeOverlay] = useState<ClubRuntimeOverlayState | null>(null);
  const [isOutdoor, setIsOutdoor] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [mapSelection, setMapSelection] = useState<ClubMapSelection>(null);
  const [activePoleId, setActivePoleId] = useState<string>('all');
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [phonePortalRoot, setPhonePortalRoot] = useState<HTMLElement | null>(null);
  const [mapRoot, setMapRoot] = useState<HTMLElement | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const clubMapContext = useClubMapContext();

  useEffect(() => {
    if (!mapRoot || mapVisible) return;
    let cancelled = false;
    const show = () => {
      if (!cancelled) setMapVisible(true);
    };
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                observer?.disconnect();
                show();
              }
            },
            { rootMargin: '120px' },
          )
        : null;
    observer?.observe(mapRoot);
    const fallback = window.setTimeout(show, 400);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, [mapRoot, mapVisible]);

  // Community CreateSheetV2 state (identical to /communaute creation drawer)
  const [communityCreateOpen, setCommunityCreateOpen] = useState(false);
  const [communityCreateKind, setCommunityCreateKind] = useState<CreateKindV2>('post');
  const [communityCreatePrefill, setCommunityCreatePrefill] = useState<Record<string, unknown> | null>(null);

  // Club Stories (daily 24h story on club avatar + Stories à la une in club feed)
  const [clubHighlights, setClubHighlights] = useState<ClubStoryHighlight[]>([]);
  const [storyViewerState, setStoryViewerState] = useState<{
    mode: 'daily' | 'highlights';
    startIndex: number;
  } | null>(null);
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [highlightTitleDraft, setHighlightTitleDraft] = useState('');
  const [highlightCoverDraft, setHighlightCoverDraft] = useState('');
  const [highlightCaptionDraft, setHighlightCaptionDraft] = useState('');

  // Club rich interactive state
  const [clubsDirectory, setClubsDirectory] = useState<ClubItemData[]>(INITIAL_CLUBS_DIRECTORY);
  const [activeClubId, setActiveClubId] = useState<string>(clubId || 'cl1');
  const [clubPosts, setClubPosts] = useState<ClubFeedPostItem[]>(INITIAL_CLUB_POSTS);
  const [clubMembers, setClubMembers] = useState<ClubMemberData[]>(INITIAL_CLUB_MEMBERS);
  const [clubOutings, setClubOutings] = useState<ClubOutingData[]>(INITIAL_CLUB_OUTINGS);
  const [vaultGear, setVaultGear] = useState<ClubGearVaultItem[]>(INITIAL_VAULT_GEAR);
  const [standardKits, setStandardKits] = useState<ClubStandardKit[]>(INITIAL_STANDARD_KITS);
  const [clubPokedex, setClubPokedex] = useState<ClubMapPokedexItem[]>([]);
  const [mapLiveMembers, setMapLiveMembers] = useState<ClubMapLiveMember[]>([]);
  const [challenges, setChallenges] = useState<ClubChallengeItem[]>(INITIAL_CHALLENGES);
  const [chatMessages, setChatMessages] = useState<ClubChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [activeSalonChannelId, setActiveSalonChannelId] = useState<string | null>(null);

  const activeClub =
    clubsDirectory.find((c) => c.id === activeClubId || c.slug === activeClubId) ||
    clubsDirectory[0] ||
    DEFAULT_FALLBACK_CLUB;

  const triggerAct = useCallback((action: string, val?: any) => {
    if (typeof window !== 'undefined' && typeof (window as any).__lkdvCompteAct === 'function') {
      (window as any).__lkdvCompteAct(action, val);
    }
  }, []);

  const showIslandToast = useCallback((title: string, subtitle = '', undo?: () => void) => {
    setIslandToast({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message: title,
      subtitle: subtitle || undefined,
      undo,
    });
  }, []);

  const handleToast = useCallback(
    (payload: ClubToastPayload) => {
      showIslandToast(payload.title, payload.subtitle ?? '', payload.undo);
    },
    [showIslandToast],
  );

  const handleOpenRuntimeOverlay = useCallback(
    (kind: ClubRuntimeOverlayKind, payload?: Record<string, unknown>) => {
      setRuntimeOverlay({ kind, payload });
    },
    [],
  );

  const flyMapToCoords = useCallback((coords?: [number, number], label?: string) => {
    if (!coords || typeof window === 'undefined') return;
    const phoneEl = document.getElementById('phone');
    if (phoneEl?.classList.contains('map-collapsed')) {
      triggerAct('toggleMapCollapsed');
    }
    const map = (window as any).__lkdvCompteMap3D;
    if (map && typeof map.flyTo === 'function') {
      try {
        map.flyTo({
          center: coords,
          zoom: 11.4,
          pitch: 56,
          bearing: -22,
          duration: 1800,
          essential: true,
        });
      } catch (_) {}
    }
    if (label) {
      showIslandToast(label, 'Relief 3D centré sur le massif du club');
    }
  }, [showIslandToast, triggerAct]);

  // Setup runtime & real browser/API action handlers (1:1 with CompteLiquidGlassV8 + Club portals)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let phoneObserver: MutationObserver | null = null;

    const onPrehydrateIntent = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest?.('#rpvis, .ig-stat')) {
        void loadClubDrawerHost().catch(() => {});
      }
    };
    el.addEventListener('pointerenter', onPrehydrateIntent, true);
    el.addEventListener('focusin', onPrehydrateIntent, true);

    void Promise.all([import('maplibre-gl'), import('./club-liquid-glass-v8-runtime')]).then(([maplibregl, runtime]) => {
      if (cancelled) return;
      if (typeof window !== 'undefined') {
        (window as any).maplibregl = maplibregl;

        (window as any).__lkdvMountClubFeed = (rootEl: HTMLElement | null) => {
          setFeedRoot(rootEl || null);
        };

        (window as any).__lkdvMountDrawer = (
          rootEl: HTMLElement,
          kind: string,
          props: {
            mode?: 'main' | 'create';
            tab?: number;
            subTab?: number;
            outingId?: string;
            memberId?: string;
            initialSection?: ClubG02Section;
          } = {},
        ) => {
          const pending = pendingDrawerIntentRef.current;
          pendingDrawerIntentRef.current = null;
          const merged = {
            ...props,
            ...(pending?.tab !== undefined ? { tab: pending.tab } : {}),
            ...(pending?.subTab !== undefined ? { subTab: pending.subTab } : {}),
            ...(pending?.outingId ? { outingId: pending.outingId } : {}),
            ...(pending?.memberId ? { memberId: pending.memberId } : {}),
            ...(pending?.initialSection ? { initialSection: pending.initialSection } : {}),
          };
          setDrawerMount({ root: rootEl, kind, props: merged });
          setDrawerIntent({
            nonce: Date.now(),
            tab: merged.tab,
            subTab: merged.subTab,
            outingId: merged.outingId,
            memberId: merged.memberId,
            initialSection: merged.initialSection,
          });
        };

        (window as any).__lkdvUnmountDrawer = () => {
          setDrawerMount(null);
        };

        (window as any).__lkdvOpenCommunityCreate = (
          kind: CreateKindV2 = 'post',
          extraPrefill?: Record<string, unknown>,
        ) => {
          setCommunityCreateKind(kind);
          setCommunityCreatePrefill(extraPrefill ?? null);
          setCommunityCreateOpen(true);
        };

        (window as any).__lkdvOpenClubStory = (target: string) => {
          if (target === 'daily') {
            setStoryViewerState({ mode: 'daily', startIndex: 0 });
          } else {
            setStoryViewerState({ mode: 'highlights', startIndex: 0 });
          }
        };
      }

      el.innerHTML = COMPTE_V8_HTML;
      const mapNode = el.querySelector<HTMLElement>('#maplibre-compte-canvas');
      if (mapNode) setMapRoot(mapNode);
      (window as any).__lkdvClubMapOpenOuting = (id: string) => {
        pendingDrawerIntentRef.current = { tab: 2, outingId: id };
        triggerAct('openClubDrawer', '2:0');
      };
      (window as any).__lkdvClubMapOpenMassif = () => {
        pendingDrawerIntentRef.current = { tab: 2 };
        triggerAct('openClubDrawer', '2:0');
      };
      cleanup = runtime.initClubLiquidGlassRuntime(el);
      const initialFeedEl = el.querySelector('#lkdv-club-feed-root') as HTMLElement | null;
      if (initialFeedEl) {
        setFeedRoot(initialFeedEl);
      }

      const phoneEl = el.querySelector('#phone') as HTMLElement | null;
      if (phoneEl) {
        setPhonePortalRoot(phoneEl);
      }
      if (phoneEl && typeof MutationObserver !== 'undefined') {
        setIsOutdoor(phoneEl.classList.contains('outdoor'));
        setIsMapFullscreen(phoneEl.classList.contains('mapbig'));
        phoneObserver = new MutationObserver(() => {
          setIsOutdoor(phoneEl.classList.contains('outdoor'));
          setIsMapFullscreen(phoneEl.classList.contains('mapbig'));
        });
        phoneObserver.observe(phoneEl, { attributes: true, attributeFilter: ['class'] });
      }

      // Register real catalog lookup for the Scan sheet
      (window as any).__lkdvScanLookup = async (query: string, cb: (item: any) => void) => {
        try {
          const res = await fetch(`/api/materiel/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const json = await res.json();
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

      (window as any).__lkdvNavigateProfile = (userHandle: string) => {
        const clean = String(userHandle || '').replace(/^@/, '').trim();
        if (clean) {
          router.push(`/profil/${encodeURIComponent(clean)}`);
        }
      };

      (window as any).__lkdvOnAction = async (action: string, val: any, S: any) => {
        const handle = S?.profile?.handle || activeHandle || 'club';
        const clubUrl = `${window.location.origin}/clubs/${clubId}`;

        if (action === 'navtab' && typeof val === 'string') {
          router.push(val);
          return;
        }

        if (action === 'openClubSwitcher') {
          setRuntimeOverlay({ kind: 'club_switcher' });
          return;
        }

        if (action === 'openClubSearch') {
          setRuntimeOverlay({ kind: 'club_search' });
          return;
        }

        if (action === 'openUserProfile' && typeof val === 'string') {
          const cleanHandle = val.replace(/^@/, '').trim();
          if (cleanHandle) {
            router.push(`/profil/${encodeURIComponent(cleanHandle)}`);
            return;
          }
        }

        if (action === 'createGroupFromClub' && user?.id) {
          try {
            await createGroupFromClub({
              clubId,
              name: val?.title || `Cordée ${S?.profile?.name || 'Club'}`,
            });
          } catch (_) {}
          return;
        }

        if (action === 'copylink') {
          try {
            await navigator.clipboard.writeText(clubUrl);
          } catch (_) {}
        } else if (action === 'namedrop') {
          try {
            if (navigator.share) {
              await navigator.share({
                title: `Club LKDV @${handle}`,
                text: `Empreinte terrain vérifiée du club @${handle} sur Le Kit du Voyageur`,
                url: clubUrl,
              });
            } else if (navigator.clipboard) {
              await navigator.clipboard.writeText(clubUrl);
            }
          } catch (_) {}
        } else if (action === 'export') {
          const dump = typeof (window as any).__lkdvGetState === 'function' ? (window as any).__lkdvGetState() : { S };
          if (val === 'full') {
            const fallbackBundle = {
              schema: 'lkdv.club.export.v1',
              exportedAt: new Date().toISOString(),
              clubId,
              handle,
              profile: S?.profile,
              visibility: S?.vis,
              massifs: S?.massifs,
              carnets: dump.CARNETS,
              outings: dump.OUTINGS,
              inventory: S?.invs,
              kitsLineage: dump.KITS_LINEAGE,
            };
            triggerBrowserDownload(
              `lkdv-club-${handle}.json`,
              JSON.stringify(fallbackBundle, null, 2),
              'application/json;charset=utf-8',
            );
          } else if (val === 'gpx') {
            const gpx = buildGpxXml(dump.OUTINGS || [], handle);
            triggerBrowserDownload(`lkdv-traces-club-${handle}.gpx`, gpx, 'application/gpx+xml;charset=utf-8');
          }
        } else if (action === 'signout') {
          try {
            await signOut();
            router.push('/connexion');
          } catch (_) {}
        }
      };

      if (typeof (window as any).__lkdvCompteAct === 'function') {
        const act = (window as any).__lkdvCompteAct;
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const tiroirParam = params?.get('tiroir');
        const sousTiroirParam = params?.get('sous_tiroir');
        const sortieParam = params?.get('sortie') ?? undefined;
        const membreParam = params?.get('membre') ?? undefined;

        if (tiroirParam && tiroirParam in TIROIR_TAB_MAP) {
          const tIdx = TIROIR_TAB_MAP[tiroirParam];
          const sIdx = Math.max(0, Math.min(3, Number.parseInt(sousTiroirParam || '0', 10) || 0));
          pendingDrawerIntentRef.current = {
            tab: tIdx,
            subTab: sIdx,
            outingId: sortieParam,
            memberId: membreParam,
          };
          act('openClubDrawer', `${tIdx}:${Math.min(3, sIdx)}`);
        } else if (initialTab === 'carnets') {
          act('igtab', 0);
        } else if (initialTab === 'sorties' || initialTab === 'aventures') {
          act('igtab', 1);
        } else if (initialTab === 'membres') {
          act('openClubDrawer', '1:0');
        } else if (initialTab === 'salons') {
          act('openClubDrawer', '4:0');
        } else if (initialTab === 'stats' || initialTab === 'statistiques') {
          act('openClubDrawer', '0:0');
        } else if (initialTab === 'parametres') {
          act('openClubDrawer', '0:0');
        }
      }

      runtimeReadyRef.current = true;
      if (pendingProfileSyncRef.current) {
        pendingProfileSyncRef.current = false;
        syncProfileRef.current();
      }

      const prefetchDrawer = () => {
        void loadClubDrawerHost().catch(() => {});
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(prefetchDrawer, { timeout: 4000 });
      } else {
        window.setTimeout(prefetchDrawer, 2000);
      }
    }).catch((error) => {
      console.error('[ClubLiquidGlassV8] chargement du moteur de carte impossible', error);
    });

    return () => {
      cancelled = true;
      runtimeReadyRef.current = false;
      pendingProfileSyncRef.current = false;
      el.removeEventListener('pointerenter', onPrehydrateIntent, true);
      el.removeEventListener('focusin', onPrehydrateIntent, true);
      phoneObserver?.disconnect();
      cleanup?.();
      cleanup = null;
      initializedRef.current = false;
    };
  }, [activeHandle, clubId, initialTab, router, signOut, user?.id]);

  // Hydrate dynamically with live Supabase club data (2-step public_profiles resolution)
  const syncClubProfile = useCallback(async () => {
    const hydrate = (window as any).__lkdvHydrateCompte;
    if (typeof hydrate !== 'function') return;

    if (!clubId) {
      setClubsDirectory([]);
      setClubPosts([]);
      setClubMembers([]);
      setClubOutings([]);
      setVaultGear([]);
      setStandardKits([]);
      setChallenges([]);
      setChatMessages([]);
      setMapLiveMembers([]);
      setClubPokedex([]);
      setMapSelection(null);
      hydrate({
        name: 'Club',
        handle: 'club',
        followersCount: 0,
        followingCount: 0,
        bioLine: '',
        sigText: '',
        home: '',
        avatarUrl: null,
        isGuest: false,
        isDemo: false,
        storeCreditEur: 0,
        loyaltyPoints: 0,
        carnets: [],
        outings: [],
        clubs: [],
        gearItems: [],
        orders: [],
        activeLoans: [],
        notifications: [],
        tribu: [],
        replace: true,
      });
      setSyncStatus('idle');
      return;
    }

    setSyncStatus('syncing');
    try {
      const supabase = createClient();
      const clubIsUuid = isUuid(clubId);
      const clubQuery = supabase
        .from('clubs')
        .select('id, name, slug, description, category, cover_image, members_count, privacy, rules, location_label, primary_sport, created_by, created_at');
      const { data: clubRow } = await (clubIsUuid ? clubQuery.eq('id', clubId) : clubQuery.eq('slug', clubId)).maybeSingle();

      if (!clubRow) {
        setClubsDirectory([]);
        setClubPosts([]);
        setClubMembers([]);
        setClubOutings([]);
        setVaultGear([]);
        setStandardKits([]);
        setChallenges([]);
        setChatMessages([]);
        setMapLiveMembers([]);
        setClubPokedex([]);
        setMapSelection(null);
        hydrate({
          name: 'Club introuvable',
          handle: clubId,
          followersCount: 0,
          followingCount: 0,
          bioLine: '',
          sigText: '',
          home: '',
          avatarUrl: null,
          isGuest: false,
          isDemo: false,
          storeCreditEur: 0,
          loyaltyPoints: 0,
          carnets: [],
          outings: [],
          clubs: [],
          gearItems: [],
          orders: [],
          activeLoans: [],
          notifications: [],
          tribu: [],
          replace: true,
        });
        setSyncStatus('idle');
        return;
      }

      const [membersRes, topicsRes, eventsRes, allClubsRes] = await Promise.all([
        supabase
          .from('club_members')
          .select('id, club_id, user_id, role, status, joined_at, muted_until, leaderboard_opt_in, can_manage_stories')
          .eq('club_id', clubRow.id)
          .limit(600),
        supabase
          .from('club_topics')
          .select('id, club_id, author_id, title, content, is_pinned, replies_count, likes_count, media_url, created_at')
          .eq('club_id', clubRow.id)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('club_events')
          .select('*')
          .eq('club_id', clubRow.id)
          .order('event_date', { ascending: false })
          .limit(100),
        supabase
          .from('clubs')
          .select('id, name, slug, description, category, cover_image, members_count, privacy, rules, location_label, primary_sport, created_by, created_at')
          .order('members_count', { ascending: false })
          .limit(30),
      ]);

      const rawMemberRows: any[] = membersRes.data || [];
      const memberRows = rawMemberRows.filter((m) => !m.status || m.status === 'active');
      const topicRows: any[] = topicsRes.data || [];
      const eventRows: any[] = eventsRes.data || [];
      const allClubRows: any[] = allClubsRes.data || [];

      const myClubRoles = new Map<string, string>();
      const myClubStoryPerms = new Map<string, boolean>();
      if (user?.id) {
        try {
          const { data: myRows } = await supabase
            .from('club_members')
            .select('club_id, role, status, can_manage_stories')
            .eq('user_id', user.id)
            .limit(50);
          for (const mr of myRows || []) {
            if (!mr.status || mr.status === 'active') {
              myClubRoles.set(mr.club_id, mr.role || 'member');
              if (typeof mr.can_manage_stories === 'boolean') {
                myClubStoryPerms.set(mr.club_id, mr.can_manage_stories);
              }
            }
          }
        } catch {
          // ignore on minimal test mocks
        }
      }

      const userIds = Array.from(
        new Set(
          [
            clubRow.created_by,
            ...memberRows.map((m: any) => m.user_id),
            ...topicRows.map((t: any) => t.author_id),
            ...eventRows.map((ev: any) => ev.organizer_id || ev.created_by),
          ].filter(Boolean),
        ),
      );
      const profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += 150) {
          chunks.push(userIds.slice(i, i + 150));
        }
        const chunkResults = await Promise.all(
          chunks.map((chunk) => fetchPublicProfilesWith(supabase as any, chunk)),
        );
        for (const resMap of chunkResults) {
          Object.assign(profilesMap, resMap);
        }
      }
      if (user?.id && !profilesMap[user.id]) {
        try {
          const { data: selfProf } = await supabase
            .from('user_profiles')
            .select('id, handle, full_name, avatar_url, trust_score, bio, location, website, loyalty_points, loyalty_level, xp, level, created_at')
            .eq('id', user.id)
            .maybeSingle();
          if (selfProf?.id) {
            profilesMap[selfProf.id] = selfProf;
          }
        } catch {
          // ignore if mock does not support user_profiles fallback
        }
      }

      const followedSet = new Set<string>();
      const blockedList: string[] = [];
      const memberLocationMap = new Map<string, { share: boolean; lat: number | null; lng: number | null }>();
      if (user?.id && userIds.length > 0) {
        try {
          const followChunks: string[][] = [];
          for (let i = 0; i < userIds.length; i += 150) {
            followChunks.push(userIds.slice(i, i + 150));
          }
          const [followResponses, blocksRes] = await Promise.all([
            Promise.all(
              followChunks.map((chunk) =>
                supabase.from('user_follows').select('following_id').eq('follower_id', user.id).in('following_id', chunk),
              ),
            ),
            supabase.from('user_blocks').select('blocker_id, blocked_id').eq('blocker_id', user.id),
          ]);
          for (const fRes of followResponses) {
            for (const f of fRes.data || []) {
              if (f.following_id) followedSet.add(f.following_id);
            }
          }
          for (const b of blocksRes.data || []) {
            if (b.blocked_id) blockedList.push(b.blocked_id);
          }
          const memberLocIds = userIds.slice(0, 150);
          if (memberLocIds.length > 0) {
            const { data: locRows } = await supabase
              .from('user_profiles')
              .select('id, share_club_location, last_lat, last_lng')
              .in('id', memberLocIds);
            for (const lr of locRows || []) {
              if (lr.id && lr.share_club_location === true) {
                memberLocationMap.set(lr.id, {
                  share: true,
                  lat: typeof lr.last_lat === 'number' ? lr.last_lat : null,
                  lng: typeof lr.last_lng === 'number' ? lr.last_lng : null,
                });
              }
            }
          }
        } catch {
          // ignore if minimal mock does not implement .in()
        }
      }
      setBlockedUserIds(blockedList);

      const derivedHandle = clubRow.slug || clubRow.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
      const currentMemberRow = user?.id
        ? memberRows.find((m: any) => m.user_id === user.id)
        : null;
      const isJoined = Boolean(currentMemberRow) || (Boolean(user?.id) && clubRow.created_by === user?.id);
      const currentRole: 'Admin' | 'Modérateur' | 'Membre' =
        currentMemberRow?.role === 'admin' || clubRow.created_by === user?.id
          ? 'Admin'
          : currentMemberRow?.role === 'moderator'
            ? 'Modérateur'
            : 'Membre';

      const sevenDaysMs = 7 * 86_400_000;
      const nowMs = Date.now();

      const memberSourceRows = [...memberRows];
      if (clubRow.created_by && !memberSourceRows.some((m: any) => m.user_id === clubRow.created_by)) {
        memberSourceRows.unshift({
          id: `founder-${clubRow.created_by}`,
          club_id: clubRow.id,
          user_id: clubRow.created_by,
          role: 'admin',
          status: 'active',
          joined_at: clubRow.created_at,
        });
      }

      const memberPostsCount = new Map<string, number>();
      for (const t of topicRows) {
        if (t.author_id) {
          memberPostsCount.set(t.author_id, (memberPostsCount.get(t.author_id) ?? 0) + 1);
        }
      }
      const memberEventStats = new Map<string, { count: number; km: number; dplus: number }>();
      for (const ev of eventRows) {
        const uid = ev.organizer_id || ev.created_by;
        if (!uid) continue;
        const prev = memberEventStats.get(uid) ?? { count: 0, km: 0, dplus: 0 };
        memberEventStats.set(uid, {
          count: prev.count + 1,
          km: prev.km + (Number(ev.distance_km) || 0),
          dplus: prev.dplus + (Number(ev.elevation_gain_m) || 0),
        });
      }

      const memberRoleByUserId = new Map<string, string>();
      const mappedMembers: ClubMemberData[] = memberSourceRows.map((m: any) => {
        const p = profilesMap[m.user_id];
        const fullName = p?.full_name || 'Membre LKDV';
        const handle =
          p?.handle ||
          fullName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) ||
          'membre';
        const joinedMs = m.joined_at ? Date.parse(m.joined_at) : NaN;
        const isNew7d = Number.isFinite(joinedMs) && nowMs - joinedMs <= sevenDaysMs;
        const mappedRole: ClubMemberData['role'] =
          m.user_id === clubRow.created_by
            ? 'Fondateur'
            : m.role === 'admin'
              ? 'Guide & Sécurité'
              : m.role === 'moderator'
                ? 'Encadrant'
                : isNew7d
                  ? 'Nouveau'
                  : 'Membre actif';
        memberRoleByUserId.set(m.user_id, mappedRole);
        const evStat = memberEventStats.get(m.user_id);

        return {
          id: m.user_id,
          userId: m.user_id,
          name: fullName,
          handle,
          avatarUrl: p?.avatar_url || undefined,
          role: mappedRole,
          rawRole: (m.role as ClubRole) || 'member',
          level: p?.location || clubRow.primary_sport || clubRow.category || 'Voyageur',
          massif: p?.location || clubRow.location_label || clubRow.category || 'France',
          skills: [p?.location || clubRow.primary_sport || clubRow.category || 'Outdoor'],
          followed: followedSet.has(m.user_id),
          availableWeekend: Boolean(m.available_weekend ?? true),
          canManageStories:
            typeof m.can_manage_stories === 'boolean'
              ? m.can_manage_stories
              : m.user_id === clubRow.created_by || m.role === 'admin' || m.role === 'moderator',
          isNew7d,
          joinedAt: m.joined_at || undefined,
          mutedUntil: m.muted_until ?? null,
          isProAthlete: Boolean(m.is_pro_athlete),
          verifiedSports: Array.isArray(m.verified_sports) ? m.verified_sports : undefined,
          outingsCount: evStat?.count ?? 0,
          distanceKm: evStat?.km ?? 0,
          dplusM: evStat?.dplus ?? 0,
          postsCount: memberPostsCount.get(m.user_id) ?? 0,
          shareClubLocation: memberLocationMap.get(m.user_id)?.share ?? false,
          lastLat: memberLocationMap.get(m.user_id)?.lat ?? null,
          lastLng: memberLocationMap.get(m.user_id)?.lng ?? null,
        };
      });

      const clubCoords = resolveMassifCoords(clubRow.location_label || clubRow.category || '');
      const mappedPosts: ClubFeedPostItem[] = topicRows.map((t: any, postIdx: number) => {
        const p = profilesMap[t.author_id];
        const authorName = p?.full_name || 'Membre du club';
        const createdMs = t.created_at ? new Date(t.created_at).getTime() : Date.now();
        const diffMin = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
        const timeAgo =
          diffMin < 60
            ? `il y a ${diffMin} min`
            : diffMin < 1440
              ? `il y a ${Math.round(diffMin / 60)} h`
              : `il y a ${Math.round(diffMin / 1440)} j`;
        const kind: ClubFeedPostItem['kind'] = t.media_url ? 'media' : 'text';
        const titleLower = String(t.title || t.content || '').toLowerCase();
        const matchedEvent = eventRows.find((ev: any) => {
          const evTitle = String(ev.title || '').toLowerCase();
          const evLoc = String(ev.location || ev.meeting_place || '').toLowerCase();
          return (
            (evLoc && evLoc.length >= 3 && titleLower.includes(evLoc)) ||
            (evTitle && evTitle.length >= 4 && titleLower.includes(evTitle.slice(0, 10)))
          );
        });
        const angle = (postIdx * 2.39996) % (Math.PI * 2);
        const radius = 0.012 + (postIdx % 4) * 0.008;
        const resolvedLat =
          typeof t.lat === 'number' && Number.isFinite(t.lat)
            ? t.lat
            : typeof matchedEvent?.lat === 'number' && Number.isFinite(matchedEvent.lat)
              ? matchedEvent.lat + Math.sin(angle) * 0.004
              : clubCoords.lat + Math.sin(angle) * radius;
        const resolvedLng =
          typeof t.lng === 'number' && Number.isFinite(t.lng)
            ? t.lng
            : typeof matchedEvent?.lng === 'number' && Number.isFinite(matchedEvent.lng)
              ? matchedEvent.lng + Math.cos(angle) * 0.005
              : clubCoords.lng + Math.cos(angle) * radius * 1.3;
        return {
          id: t.id,
          clubId: clubRow.id,
          pinned: Boolean(t.is_pinned),
          authorName,
          authorHandle: p?.handle || authorName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          authorRole: memberRoleByUserId.get(t.author_id) || (t.is_pinned ? 'Admin' : 'Membre'),
          authorAvatar: p?.avatar_url || undefined,
          timeAgo,
          spot: t.title || clubRow.name,
          massif: matchedEvent?.massif || matchedEvent?.location || clubRow.location_label || clubRow.category || clubRow.name,
          kind,
          caption: t.content || t.title || '',
          mediaUrl: t.media_url || undefined,
          outingId: matchedEvent?.id,
          likes: Number(t.likes_count ?? 0),
          liked: false,
          comments: [],
          lat: resolvedLat,
          lng: resolvedLng,
        };
      });

      let mappedOutings: ClubOutingData[] = eventRows.map((ev: any) => {
        const dt = ev.event_date || ev.starts_at;
        const endIso = ev.ends_at;
        const startMs = dt ? Date.parse(dt) : NaN;
        const endMs = endIso ? Date.parse(endIso) : startMs;
        let outingStatus: ClubOutingData['status'] = 'upcoming';
        if (ev.cancelled_at || ev.status === 'cancelled') {
          outingStatus = 'cancelled';
        } else if (Number.isFinite(endMs) && nowMs > endMs + 4 * 3600_000) {
          outingStatus = 'completed';
        } else if (Number.isFinite(startMs) && Math.abs(nowMs - startMs) <= 4 * 3600_000) {
          outingStatus = 'live';
        }

        const formattedDate = dt
          ? new Date(dt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'À venir';
        const leaderId = ev.organizer_id || ev.created_by;
        const leaderProfile = leaderId ? profilesMap[leaderId] : null;
        const titleKmMatch = String(ev.title || '').match(/(\d+(?:[.,]\d+)?)\s*km/i);
        const titleDplusMatch = String(ev.title || '').match(/\+\s*([\d\s\u00a0]+)\s*m/i);
        const parsedKm = Number(ev.distance_km ?? ev.km ?? (titleKmMatch ? titleKmMatch[1].replace(',', '.') : 0)) || 0;
        const parsedDplus = Number(ev.elevation_gain_m ?? ev.dplus ?? (titleDplusMatch ? titleDplusMatch[1].replace(/\s+/g, '') : 0)) || 0;
        return {
          id: ev.id,
          clubId: clubRow.id,
          title: ev.title || 'Sortie club',
          date: formattedDate,
          startsAtIso: dt || undefined,
          dateLabel: formattedDate,
          massif: ev.massif || ev.location || ev.meeting_place || clubRow.location_label || clubRow.category || 'Montagne',
          km: parsedKm,
          dplus: parsedDplus,
          maxAlt: Number(ev.max_altitude_m ?? ev.max_alt ?? 0),
          status: outingStatus,
          leaderName: leaderProfile?.full_name || clubRow.name,
          leaderHandle: leaderProfile?.handle || derivedHandle,
          participantsCount: Number(ev.participants_count ?? 0),
          maxParticipants: Number(ev.max_participants ?? 12),
          carpoolCity: ev.meeting_point || ev.location || clubRow.location_label || clubRow.category || 'Sur place',
          carpoolSeatsLeft: Number(ev.carpool_seats ?? 0),
          requiredGear: Array.isArray(ev.required_gear) ? ev.required_gear : [],
          rsvpJoined: false,
          lat: Number(ev.lat ?? clubCoords.lat),
          lng: Number(ev.lng ?? clubCoords.lng),
          routeTrace: Array.isArray(ev.route_trace)
            ? ev.route_trace
            : Array.isArray(ev.routeTrace)
              ? ev.routeTrace
              : undefined,
        };
      });

      let resolvedSalonsCount: number | undefined;
      let resolvedViewerCapabilities: import('@/features/clubs/types').ClubCapability[] | undefined;
      // Hydrate secondary club endpoints safely (strictly UUID + fetch guarded)
      if (isUuid(clubRow.id) && typeof fetch === 'function') {
        const requests: Array<Promise<Response | null>> = [
          fetch(`/api/clubs/${clubRow.id}/gear`).catch(() => null),
          fetch(`/api/clubs/${clubRow.id}/challenges`).catch(() => null),
          fetch(`/api/clubs/${clubRow.id}/events`).catch(() => null),
          fetch(`/api/clubs/${clubRow.id}/map`).catch(() => null),
          user?.id && isJoined
            ? fetch(`/api/clubs/${clubRow.id}/salons`).catch(() => null)
            : Promise.resolve(null),
          user?.id && isJoined
            ? fetch(`/api/clubs/${clubRow.id}/permissions`).catch(() => null)
            : Promise.resolve(null),
        ];

        const [gearRes, challRes, eventsApiRes, mapApiRes, salonsRes, permsRes] = await Promise.all(requests);
        if (mapApiRes?.ok) {
          try {
            const mj = await mapApiRes.json();
            const liveList = Array.isArray(mj?.data?.liveMembers)
              ? (mj.data.liveMembers as ClubMapLiveMember[])
              : [];
            const pkxList = Array.isArray(mj?.data?.pokedex)
              ? (mj.data.pokedex as ClubMapPokedexItem[])
              : [];
            setMapLiveMembers(liveList);
            setClubPokedex(pkxList);
          } catch {
            setMapLiveMembers([]);
            setClubPokedex([]);
          }
        } else {
          setMapLiveMembers([]);
          setClubPokedex([]);
        }
        if (permsRes?.ok) {
          try {
            const pj = await permsRes.json();
            if (Array.isArray(pj?.data?.viewerCapabilities)) {
              resolvedViewerCapabilities = pj.data.viewerCapabilities;
            }
          } catch {
            // ignore
          }
        }

        if (gearRes?.ok) {
          try {
            const gj = await gearRes.json();
            const rawItems: any[] = gj.items || [];
            const rawLoans: any[] = gj.loans || [];
            const rawKits: any[] = gj.standardKits || [];
            const ownerIds = Array.from(new Set(rawItems.map((it) => it.owner_id).filter((id) => id && !profilesMap[id])));
            if (ownerIds.length > 0) {
              const extraProfiles = await fetchPublicProfilesWith(supabase as any, ownerIds);
              Object.assign(profilesMap, extraProfiles);
            }
            const activeLoanByItem = new Map<string, any>();
            for (const l of rawLoans) {
              if (l.status === 'requested' || l.status === 'approved') {
                activeLoanByItem.set(l.gear_item_id, l);
              }
            }
            setVaultGear(
              rawItems.map((it) => {
                const owner = profilesMap[it.owner_id];
                const loan = activeLoanByItem.get(it.id);
                return {
                  id: it.id,
                  clubId: it.club_id || clubRow.id,
                  name: it.name,
                  brand: it.brand || 'LKDV',
                  category: it.category || 'Matériel',
                  weightG: Number(it.weight_g ?? 0),
                  ownerName: owner?.full_name || 'Membre',
                  ownerHandle: owner?.handle || 'membre',
                  available: Boolean(it.is_available ?? !loan),
                  reservedByMe: Boolean(loan && user?.id && loan.borrower_id === user.id),
                  imageUrl: it.image_url || undefined,
                  condition: it.condition || undefined,
                  loanId: loan?.id,
                  loanStatus: loan?.status,
                };
              }),
            );
            setStandardKits(
              rawKits.map((k) => {
                const rawList = Array.isArray(k.items) ? k.items : [];
                return {
                  id: k.id,
                  title: k.title,
                  season: k.season || '4 saisons',
                  totalWeightG: Number(k.total_weight_g ?? 0),
                  itemsCount: rawList.length,
                  items: rawList.map((x: any) => (typeof x === 'string' ? x : x?.name || 'Équipement')),
                  detailedItems: rawList.filter((x: any) => typeof x === 'object' && x !== null),
                };
              }),
            );
          } catch {
            // ignore parse failure
          }
        }

        if (challRes?.ok) {
          try {
            const cj = await challRes.json();
            const summaries: ClubChallengeSummary[] = cj?.data?.summaries || [];
            setChallenges(
              summaries.map((s) => ({
                id: s.challenge.id,
                title: s.challenge.title,
                subtitle: s.challenge.description || METRIC_LABELS[s.challenge.metric],
                current:
                  s.challenge.metric === 'distance_m'
                    ? Math.round(s.totalProgressValue / 1000)
                    : s.challenge.metric === 'duration_s'
                      ? Math.round(s.totalProgressValue / 3600)
                      : Math.round(s.totalProgressValue),
                target:
                  s.challenge.metric === 'distance_m'
                    ? Math.round(s.challenge.targetValue / 1000)
                    : s.challenge.metric === 'duration_s'
                      ? Math.round(s.challenge.targetValue / 3600)
                      : Math.round(s.challenge.targetValue),
                unit: METRIC_UNITS[s.challenge.metric] || '',
                rewardBadge: s.challenge.badgeTitle || 'Défi club',
              })),
            );
          } catch {
            // ignore
          }
        }

        if (eventsApiRes?.ok) {
          try {
            const ej = await eventsApiRes.json();
            const regs: any[] = ej?.data?.registrations || [];
            const eventCounts: Record<string, { registered?: number }> = ej?.data?.eventCounts || {};
            const myRegIds = new Set(
              regs
                .filter((r) => user?.id && r.userId === user.id && r.status !== 'cancelled')
                .map((r) => r.eventId),
            );
            mappedOutings = mappedOutings.map((o) => ({
              ...o,
              rsvpJoined: myRegIds.has(o.id),
              participantsCount: eventCounts[o.id]?.registered ?? o.participantsCount,
            }));
          } catch {
            // ignore
          }
        }

        if (salonsRes?.ok) {
          try {
            const sj = await salonsRes.json();
            const msgs: any[] = sj?.data?.messages || [];
            const channelsArr: any[] = Array.isArray(sj?.data?.channels) ? sj.data.channels : [];
            resolvedSalonsCount = channelsArr.length;
            const channelId: string | null = sj?.data?.activeChannelId || channelsArr[0]?.id || null;
            setActiveSalonChannelId(channelId);
            const msgAuthorIds = Array.from(new Set(msgs.map((m) => m.authorId).filter((id) => id && !profilesMap[id])));
            if (msgAuthorIds.length > 0) {
              const extra = await fetchPublicProfilesWith(supabase as any, msgAuthorIds);
              Object.assign(profilesMap, extra);
            }
            setChatMessages(
              msgs.map((m) => {
                const author = profilesMap[m.authorId];
                return {
                  id: m.id,
                  authorId: m.authorId,
                  channelId: m.channelId,
                  authorName: author?.full_name || 'Membre',
                  authorHandle: author?.handle || 'membre',
                  authorAvatar: author?.avatar_url || undefined,
                  roleBadge: memberRoleByUserId.get(m.authorId),
                  text: m.body,
                  time: m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '',
                };
              }),
            );
          } catch {
            // ignore
          }
        }
      } else {
        setMapLiveMembers([]);
        setClubPokedex([]);
      }

      const upcomingSorted = mappedOutings
        .filter((o) => o.status === 'upcoming' || o.status === 'live')
        .sort((a, b) => (a.startsAtIso || '').localeCompare(b.startsAtIso || ''));
      const nextUpcoming = upcomingSorted[0];
      const currentTotalKm = mappedOutings.reduce((acc, o) => acc + (o.km || 0), 0);
      const currentTotalDplus = mappedOutings.reduce((acc, o) => acc + (o.dplus || 0), 0);
      const hasLiveOrImminent = upcomingSorted.some((o) => {
        if (o.status === 'live') return true;
        if (!o.startsAtIso) return false;
        const diff = Date.parse(o.startsAtIso) - nowMs;
        return diff >= 0 && diff <= 48 * 3600_000;
      });

      const buildClubItem = (row: any, joinedFlag: boolean, rawRole?: string | null): ClubItemData => {
        const rowCoords = resolveMassifCoords(row.location_label || row.category || '', clubCoords.lat, clubCoords.lng);
        const rawVis = row.privacy;
        const visibility: ClubItemData['visibility'] =
          rawVis === 'secret' || rawVis === 'invite_only'
            ? 'secret'
            : rawVis === 'closed' || rawVis === 'private'
              ? 'prive'
              : 'public';
        const resolvedRoleLabel =
          row.created_by && user?.id && row.created_by === user.id
            ? 'Fondateur'
            : rawRole === 'admin'
              ? 'Admin'
              : rawRole === 'moderator'
                ? 'Modérateur'
                : row.id === clubRow.id
                  ? currentRole
                  : 'Membre';

        const resolvedMembersCount =
          row.members_count || (row.id === clubRow.id ? memberSourceRows.length : 0) || 0;
        let savedPoles: ClubPoleItem[] | undefined;
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem(`lkdv.clubPoles.v1.${row.id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) savedPoles = parsed;
            }
          } catch {
            // ignore
          }
        }
        const poles =
          savedPoles ??
          (resolvedMembersCount >= 5
            ? buildRecommendedPoles(row.name || '', row.primary_sport || row.category || '')
            : undefined);

        return {
          id: row.id,
          slug: row.slug || row.id,
          name: row.name,
          massif: row.location_label || row.category || 'Outdoor',
          category: row.primary_sport || row.category || 'Outdoor',
          level: 'Tous niveaux',
          membersCount: resolvedMembersCount,
          poles,
          outingsCount: row.id === clubRow.id ? mappedOutings.length : 0,
          salonsCount: row.id === clubRow.id ? resolvedSalonsCount : undefined,
          totalKm: row.id === clubRow.id ? currentTotalKm : 0,
          totalDplus: row.id === clubRow.id ? currentTotalDplus : 0,
          joined: joinedFlag,
          role: resolvedRoleLabel,
          viewerRole: (rawRole as ClubRole) || null,
          viewerCapabilities: row.id === clubRow.id ? resolvedViewerCapabilities : undefined,
          viewerCanManageStories:
            row.id === clubRow.id
              ? Boolean(
                  user?.id &&
                    (row.created_by === user.id ||
                      (typeof currentMemberRow?.can_manage_stories === 'boolean'
                        ? currentMemberRow.can_manage_stories
                        : currentMemberRow?.role === 'admin' || currentMemberRow?.role === 'moderator')),
                )
              : Boolean(
                  user?.id &&
                    (row.created_by === user.id ||
                      (myClubStoryPerms.has(row.id)
                        ? myClubStoryPerms.get(row.id)
                        : rawRole === 'admin' || rawRole === 'moderator')),
                ),
          visibility,
          bio: row.description || 'Club communautaire Le Kit du Voyageur.',
          charter: row.rules || 'Respect strict de la montagne, de la sécurité et zéro trace.',
          nextOutingTitle: row.id === clubRow.id ? nextUpcoming?.title || 'Aucune sortie programmée' : 'Voir les sorties',
          nextOutingDate: row.id === clubRow.id ? nextUpcoming?.date || 'À venir' : 'À venir',
          weatherIso: 'Iso 0°C —',
          weatherWind: 'Vent calme',
          weatherTrail: 'Conditions stables',
          lat: rowCoords.lat,
          lng: rowCoords.lng,
          coverUrl: row.cover_image || undefined,
          createdBy: row.created_by || null,
          hasLiveOrImminentOuting: row.id === clubRow.id ? hasLiveOrImminent : false,
          memberAvatars:
            row.id === clubRow.id
              ? mappedMembers.slice(0, 4).map((m) => ({ name: m.name, avatarUrl: m.avatarUrl }))
              : undefined,
        };
      };

      const currentClubItem = buildClubItem(clubRow, isJoined, currentMemberRow?.role);
      const directoryList: ClubItemData[] = [
        currentClubItem,
        ...allClubRows
          .filter((r: any) => r.id !== clubRow.id)
          .map((r: any) => buildClubItem(r, myClubRoles.has(r.id) || (Boolean(user?.id) && r.created_by === user?.id), myClubRoles.get(r.id))),
      ];

      setClubsDirectory(directoryList);
      setActiveClubId(clubRow.id);
      setClubMembers(mappedMembers);
      setClubPosts(mappedPosts);
      setClubOutings(mappedOutings);

      if (typeof document !== 'undefined') {
        document.title = `${clubRow.name} — Club | Le Kit du Voyageur`;
      }

      hydrate({
        name: clubRow.name,
        handle: derivedHandle,
        followersCount: clubRow.members_count || memberSourceRows.length || 0,
        followingCount: mappedOutings.length,
        bioLine: clubRow.description ? '· ' + clubRow.description : '',
        avatarUrl: clubRow.cover_image || null,
        followers: memberSourceRows.map((m: any) => {
          const p = profilesMap[m.user_id];
          const n = p?.full_name || 'Membre LKDV';
          return {
            id: m.user_id,
            n,
            i: n.charAt(0).toUpperCase(),
            ps: n.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            mass: m.role === 'admin' ? 'Admin du club' : 'Membre vérifié',
            avatar: p?.avatar_url || null,
          };
        }),
        carnets: mappedPosts.map((p) => ({
          id: p.id,
          title: p.spot,
          mass: p.massif,
          km: 0,
          dplus: 0,
        })),
        outings: mappedOutings.map((o) => ({
          id: o.id,
          title: o.title,
          date: o.date,
          mass: o.massif,
          km: o.km,
          dplus: o.dplus,
          maxAlt: o.maxAlt,
          coverImage: o.coverUrl,
          proven: o.status === 'completed',
          lat: o.lat,
          lng: o.lng,
        })),
        clubs: directoryList.map((c) => ({
          id: c.id,
          name: c.name,
          handle: c.slug,
          members: c.membersCount,
          massif: c.massif,
        })),
        gearItems: [],
        orders: [],
        activeLoans: [],
        notifications: [],
        tribu: [],
        replace: true,
      });
      setActiveHandle(derivedHandle);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, [clubId, user?.id]);

  useEffect(() => {
    syncProfileRef.current = syncClubProfile;
    if (runtimeReadyRef.current) {
      syncClubProfile();
    } else {
      pendingProfileSyncRef.current = true;
    }
  }, [syncClubProfile]);

  const handleSelectClub = useCallback(
    (selectedId: string) => {
      const targetClub = clubsDirectory.find((c) => c.id === selectedId || c.slug === selectedId);
      if (!targetClub) return;
      setActiveClubId(targetClub.id);
      setActiveHandle(targetClub.slug);
      setMapSelection(null);
      setActivePoleId('all');
      const hydrate = (window as any).__lkdvHydrateCompte;
      if (typeof hydrate === 'function') {
        hydrate({
          name: targetClub.name,
          handle: targetClub.slug,
          followersCount: targetClub.membersCount,
          followingCount: targetClub.outingsCount,
          bioLine: '· ' + targetClub.massif + ' · ' + targetClub.bio,
          sigText: `${targetClub.outingsCount} sorties · ${targetClub.totalKm} km · ${(targetClub.totalDplus / 1000).toFixed(1).replace('.', ',')} km D+`,
          home: targetClub.massif,
        });
      }
      triggerAct('closeSheet');
      flyMapToCoords([targetClub.lng, targetClub.lat], `${targetClub.name} · ${targetClub.massif}`);
      if (targetClub.slug && targetClub.id !== clubId && targetClub.slug !== clubId) {
        router.push(`/clubs/${encodeURIComponent(targetClub.slug)}`);
      }
    },
    [clubId, clubsDirectory, flyMapToCoords, router, triggerAct],
  );

  const handleToggleJoinClub = useCallback(
    async (targetClubId: string, options?: { message?: string }): Promise<boolean> => {
      const prev = clubsDirectory.find((c) => c.id === targetClubId);
      if (!prev) return false;
      const nextJoined = !prev.joined;
      setClubsDirectory((dir) =>
        dir.map((c) =>
          c.id === targetClubId
            ? {
                ...c,
                joined: nextJoined,
                membersCount: Math.max(1, c.membersCount + (nextJoined ? 1 : -1)),
              }
            : c,
        ),
      );

      if (user?.id && isUuid(targetClubId) && typeof fetch === 'function') {
        try {
          const res = nextJoined
            ? await fetch(`/api/clubs/${targetClubId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: options?.message }),
              })
            : await fetch(`/api/clubs/${targetClubId}/members`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', userId: user.id, mode: 'leave' }),
              });
          if (!res.ok) {
            throw new Error('Membership update failed');
          }
        } catch {
          setClubsDirectory((dir) =>
            dir.map((c) => (c.id === targetClubId ? prev : c)),
          );
          showIslandToast('Impossible de mettre à jour l’adhésion', 'Vérifiez votre connexion');
          return false;
        }
      }

      showIslandToast(
        nextJoined ? `Bienvenue dans ${prev.name} ✓` : `Vous avez quitté ${prev.name}`,
        'Synchronisé avec votre club LKDV',
      );
      return true;
    },
    [clubsDirectory, showIslandToast, user?.id],
  );

  const handleToggleFollowMember = useCallback(
    async (handleOrId: string) => {
      const target = clubMembers.find(
        (m) => m.handle === handleOrId || m.id === handleOrId || m.userId === handleOrId,
      );
      if (!target) return;
      const nextFollowed = !target.followed;

      setClubMembers((prev) =>
        prev.map((m) => (m.id === target.id ? { ...m, followed: nextFollowed } : m)),
      );

      const targetUserId = target.userId || target.id;
      if (user?.id && isUuid(targetUserId) && typeof fetch === 'function') {
        try {
          const res = await fetch('/api/compte/reseau/follow', {
            method: nextFollowed ? 'POST' : 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: targetUserId }),
          });
          if (!res.ok) throw new Error('Follow mutation failed');
        } catch {
          setClubMembers((prev) =>
            prev.map((m) => (m.id === target.id ? { ...m, followed: !nextFollowed } : m)),
          );
          showIslandToast('Erreur de suivi', 'Réessayez dans un instant');
          return;
        }
      }

      showIslandToast(`Cordée @${target.handle}`, nextFollowed ? 'Membre suivi ✓' : 'Suivi retiré');
    },
    [clubMembers, showIslandToast, user?.id],
  );

  const handleProposeBinome = useCallback(
    async (
      member: ClubMemberData,
      payload: { outingId?: string; slot?: 'sam' | 'dim' | 'we'; note?: string },
    ): Promise<boolean> => {
      if (user?.id && isUuid(activeClub.id) && typeof fetch === 'function') {
        try {
          const res = await fetch('/api/clubs/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: payload.outingId ? 'event' : 'club',
              targetId: payload.outingId || activeClub.id,
              clubId: activeClub.id,
            }),
          });
          if (!res.ok) return false;
        } catch {
          return false;
        }
      }
      showIslandToast(`Cordée proposée à ${member.name} ✓`, payload.note || 'Invitation prête');
      return true;
    },
    [activeClub.id, showIslandToast, user?.id],
  );

  const handleToggleOutingRsvp = useCallback(
    (outingId: string) => {
      setClubOutings((prev) =>
        prev.map((o) => {
          if (o.id !== outingId) return o;
          const nextJoined = !o.rsvpJoined;
          return {
            ...o,
            rsvpJoined: nextJoined,
            participantsCount: Math.max(0, Math.min(o.maxParticipants, o.participantsCount + (nextJoined ? 1 : -1))),
          };
        }),
      );
      setClubPosts((prev) =>
        prev.map((p) =>
          p.outingId === outingId
            ? {
                ...p,
                rsvpJoined: !p.rsvpJoined,
                outingSeatsLeft: Math.max(0, (p.outingSeatsLeft ?? 2) + (p.rsvpJoined ? 1 : -1)),
              }
            : p,
        ),
      );
      showIslandToast('Inscription cordée mise à jour ✓', 'Place réservée avec check-list kit liée');
    },
    [showIslandToast],
  );

  const handleBorrowGear = useCallback(
    async (gearId: string) => {
      const target = vaultGear.find((g) => g.id === gearId);
      const willReserve = target ? !target.reservedByMe : true;
      setVaultGear((prev) =>
        prev.map((g) => {
          if (g.id !== gearId) return g;
          const nextAvail = !willReserve;
          return {
            ...g,
            available: nextAvail,
            reservedByMe: willReserve,
          };
        }),
      );
      if (user?.id && isUuid(activeClub.id) && isUuid(gearId) && typeof fetch === 'function') {
        try {
          if (willReserve) {
            const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/gear`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'request_loan', gearItemId: gearId, quantity: 1 }),
            });
            if (res.ok) {
              const payload = (await res.json().catch(() => null)) as { loan?: { id?: string } } | null;
              if (payload?.loan?.id) {
                setVaultGear((prev) =>
                  prev.map((g) => (g.id === gearId ? { ...g, loanId: payload.loan!.id, loanStatus: 'requested' } : g)),
                );
              }
            }
          } else if (target?.loanId && isUuid(target.loanId)) {
            await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/gear`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update_loan', loanId: target.loanId, status: 'cancelled' }),
            });
          }
        } catch {
          // optimistic fallback kept
        }
      }
      showIslandToast(
        willReserve ? 'Coffre Matériel Club ✓' : 'Réservation annulée',
        willReserve ? 'Demande d’emprunt enregistrée' : 'Équipement remis disponible',
      );
    },
    [activeClub.id, showIslandToast, user?.id, vaultGear],
  );

  const handleRequestGearLoan = useCallback(
    async (payload: {
      gearItemId: string;
      quantity: number;
      eventId?: string | null;
      neededFrom?: string | null;
      neededUntil?: string | null;
      note?: string | null;
    }): Promise<boolean> => {
      setVaultGear((prev) =>
        prev.map((g) =>
          g.id === payload.gearItemId
            ? {
                ...g,
                reservedByMe: true,
                loanStatus: 'requested',
                eventId: payload.eventId ?? null,
                neededFrom: payload.neededFrom ?? null,
                neededUntil: payload.neededUntil ?? null,
              }
            : g,
        ),
      );
      if (user?.id && isUuid(activeClub.id) && isUuid(payload.gearItemId) && typeof fetch === 'function') {
        try {
          const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/gear`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'request_loan', ...payload }),
          });
          if (!res.ok) return false;
          const json = (await res.json().catch(() => null)) as { loan?: { id?: string } } | null;
          if (json?.loan?.id) {
            setVaultGear((prev) =>
              prev.map((g) => (g.id === payload.gearItemId ? { ...g, loanId: json.loan!.id } : g)),
            );
          }
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    [activeClub.id, user?.id],
  );

  const handleTransitionGearLoan = useCallback(
    async (payload: {
      loanId: string;
      gearItemId: string;
      status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
      checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
      returnCondition?: 'new' | 'good' | 'worn' | 'repair';
      conditionNote?: string;
    }): Promise<boolean> => {
      setVaultGear((prev) =>
        prev.map((g) => {
          if (g.id !== payload.gearItemId && g.loanId !== payload.loanId) return g;
          const release = payload.status === 'returned' || payload.status === 'declined' || payload.status === 'cancelled';
          const reserve = payload.status === 'approved';
          const curAvail = g.quantityAvailable ?? (g.available ? 1 : 0);
          const total = g.quantityTotal ?? 1;
          const nextAvail = reserve
            ? Math.max(0, curAvail - 1)
            : release
              ? Math.min(total, curAvail + 1)
              : curAvail;
          return {
            ...g,
            loanStatus: payload.status,
            reservedByMe: release ? false : g.reservedByMe,
            quantityAvailable: nextAvail,
            available: nextAvail > 0,
            conditionStatus: payload.returnCondition ?? g.conditionStatus,
          };
        }),
      );
      if (user?.id && isUuid(activeClub.id) && isUuid(payload.loanId) && typeof fetch === 'function') {
        try {
          const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/gear`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_loan',
              loanId: payload.loanId,
              status: payload.status,
              checkoutCondition: payload.checkoutCondition,
              returnCondition: payload.returnCondition,
              conditionNote: payload.conditionNote,
            }),
          });
          return res.ok;
        } catch {
          return false;
        }
      }
      return true;
    },
    [activeClub.id, user?.id],
  );

  const handleCloneKit = useCallback(
    (kitId: string) => {
      setStandardKits((prev) =>
        prev.map((k) => (k.id === kitId ? { ...k, cloned: true } : k)),
      );
      const kit = standardKits.find((k) => k.id === kitId);
      showIslandToast(
        kit ? `${kit.title} cloné ✓` : 'Kit standard cloné ✓',
        'Ajouté dans ton inventaire avec répartition du poids de cordée',
      );
    },
    [showIslandToast, standardKits],
  );

  const handleTogglePostLike = useCallback((postId: string) => {
    setClubPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.liked;
        return { ...p, liked: nextLiked, likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)) };
      }),
    );
  }, []);

  const handleTogglePostSave = useCallback((postId: string) => {
    let wasSaved = false;
    setClubPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        wasSaved = Boolean(p.saved);
        return { ...p, saved: !p.saved };
      }),
    );
    showIslandToast(
      wasSaved ? 'Retirée des favoris' : 'Publication enregistrée ✓',
      wasSaved ? 'Supprimée de vos favoris du club' : 'Ajoutée aux favoris du club',
    );
  }, [showIslandToast, triggerAct]);

  const handleUpdateMyAvailability = useCallback(
    (payload: { availableWeekend: boolean; days: Array<'sam' | 'dim'>; objective: string }) => {
      try {
        window.localStorage.setItem(
          `lkdv.club.myAvail.${activeClub.id}`,
          JSON.stringify(payload),
        );
      } catch {
        // ignore storage quota errors
      }
      if (!user?.id) return;
      setClubMembers((prev) =>
        prev.map((m) =>
          m.userId === user.id || m.id === user.id
            ? {
                ...m,
                availableWeekend: payload.availableWeekend,
                availableDays: payload.days,
                seekingObjective: payload.objective,
              }
            : m,
        ),
      );
    },
    [activeClub.id, user?.id],
  );

  const handleAddPostComment = useCallback(
    (postId: string, text: string) => {
      setClubPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    id: 'c-' + Date.now(),
                    authorName: user?.email ? user.email.split('@')[0] : 'Tony',
                    authorHandle: activeHandle || 'tony_frc',
                    roleBadge: 'Membre',
                    text,
                    createdAt: 'À l’instant',
                  },
                ],
              }
            : p,
        ),
      );
      showIslandToast('Commentaire publié ✓', 'Visible dans la discussion du club');
    },
    [activeHandle, showIslandToast, user?.email],
  );

  const handleCreatePost = useCallback(
    (payload: {
      kind: 'media' | 'text';
      caption: string;
      spot: string;
      mediaUrl?: string;
      poleId?: string;
      poleName?: string;
    }) => {
      const newPost: ClubFeedPostItem = {
        id: 'cp-' + Date.now(),
        clubId: activeClub.id,
        kind: payload.kind,
        authorName: user?.email ? user.email.split('@')[0] : 'Tony',
        authorHandle: activeHandle || 'tony_frc',
        authorRole: 'Membre de la cordée',
        timeAgo: 'À l’instant',
        spot: payload.spot || activeClub.massif,
        massif: activeClub.massif,
        poleId: payload.poleId,
        poleName: payload.poleName,
        metricsChip: 'Trace GPX ✓ · En direct du massif',
        caption: payload.caption,
        mediaUrl:
          payload.kind === 'text'
            ? undefined
            : payload.mediaUrl ||
              '/assets/images/adventure-bivouac.jpg',
        likes: 1,
        liked: true,
        saved: false,
        lat: activeClub.lat,
        lng: activeClub.lng,
        comments: [],
      };
      setClubPosts((prev) => [newPost, ...prev]);
      triggerAct('closeSheet');
      showIslandToast(
        'Publié dans le fil du club ✓',
        `${payload.poleName ? `${payload.poleName} · ` : ''}${payload.spot}`,
      );
    },
    [activeClub, activeHandle, showIslandToast, triggerAct, user?.email],
  );

  const handleCreateOuting = useCallback(
    (payload: { title: string; date: string; massif: string; km: number; dplus: number; carpoolCity: string }) => {
      const newOuting: ClubOutingData = {
        id: 'out-' + Date.now(),
        clubId: activeClub.id,
        title: payload.title,
        date: payload.date,
        massif: payload.massif,
        km: payload.km,
        dplus: payload.dplus,
        maxAlt: 2650,
        status: 'upcoming',
        leaderName: user?.email ? user.email.split('@')[0] : 'Tony',
        leaderHandle: activeHandle || 'tony_frc',
        participantsCount: 1,
        maxParticipants: 8,
        rsvpJoined: true,
        carpoolCity: payload.carpoolCity || 'Départ massif',
        carpoolSeatsLeft: 3,
        requiredGear: ['Kit Alpin Club', 'DVA/Pelle/Sonde', 'Frontale'],
        lat: activeClub.lat,
        lng: activeClub.lng,
      };
      setClubOutings((prev) => [newOuting, ...prev]);
      triggerAct('closeSheet');
      showIslandToast('Sortie proposée à la cordée ✓', `${payload.title} · ${payload.km} km · +${payload.dplus} m`);
    },
    [activeClub.id, activeClub.lat, activeClub.lng, activeHandle, showIslandToast, triggerAct, user?.email],
  );

  const handleLendGearToVault = useCallback(
    async (payload: {
      name: string;
      brand: string;
      weightG: number;
      category: string;
      ownershipScope?: 'club' | 'member';
      quantityTotal?: number;
      depositCents?: number;
      isEpi?: boolean;
      epiExpiresAt?: string;
    }) => {
      const tempId = 'vg-' + Date.now();
      const item: ClubGearVaultItem = {
        id: tempId,
        clubId: activeClub.id,
        ownershipScope: payload.ownershipScope ?? 'member',
        name: payload.name,
        brand: payload.brand,
        category: payload.category,
        weightG: payload.weightG,
        quantityTotal: payload.quantityTotal ?? 1,
        quantityAvailable: payload.quantityTotal ?? 1,
        depositCents: payload.depositCents ?? 0,
        isEpi: Boolean(payload.isEpi),
        epiExpiresAt: payload.epiExpiresAt ?? null,
        ownerName: payload.ownershipScope === 'club' ? activeClub.name : 'Toi',
        ownerHandle: activeHandle || 'tony_frc',
        available: true,
      };
      setVaultGear((prev) => [item, ...prev]);
      if (user?.id && isUuid(activeClub.id) && typeof fetch === 'function') {
        try {
          const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/gear`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_item',
              ownershipScope: payload.ownershipScope ?? 'member',
              name: payload.name,
              brand: payload.brand || null,
              category: payload.category,
              weightG: payload.weightG,
              quantityTotal: payload.quantityTotal ?? 1,
              depositCents: payload.depositCents ?? 0,
              isEpi: Boolean(payload.isEpi),
              epiExpiresAt: payload.epiExpiresAt || null,
            }),
          });
          if (res.ok) {
            const json = (await res.json().catch(() => null)) as { item?: { id?: string } } | null;
            if (json?.item?.id) {
              setVaultGear((prev) =>
                prev.map((g) => (g.id === tempId ? { ...g, id: json.item!.id! } : g)),
              );
            }
          }
        } catch {
          // optimistic fallback kept
        }
      }
      triggerAct('closeSheet');
      showIslandToast('Ajouté au Coffre Matériel ✓', `${payload.brand} ${payload.name} (${payload.weightG} g)`);
    },
    [activeClub.id, activeClub.name, activeHandle, showIslandToast, triggerAct, user?.id],
  );

  const handleCreateNewClub = useCallback(
    (payload: {
      name: string;
      massif: string;
      category: string;
      bio: string;
      visibility: 'public' | 'prive';
      poles?: ClubPoleItem[];
    }) => {
      const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'nouveau_club';
      const newClub: ClubItemData = {
        id: 'cl-' + Date.now(),
        slug,
        name: payload.name,
        massif: payload.massif,
        category: payload.category,
        level: 'Tous niveaux',
        membersCount: 1,
        outingsCount: 1,
        totalKm: 18,
        totalDplus: 1200,
        joined: true,
        role: 'Fondateur · Admin',
        visibility: payload.visibility,
        bio: payload.bio,
        charter: 'Entraide de cordée, bivouac sans trace et partage des traces GPX vérifiées.',
        nextOutingTitle: 'Sortie inaugurale à planifier',
        nextOutingDate: 'Prochainement',
        weatherIso: '2 850 m',
        weatherWind: '10 km/h O',
        weatherTrail: 'Conditions optimales',
        lat: 45.923,
        lng: 6.869,
        poles: payload.poles,
      };
      setClubsDirectory((prev) => [newClub, ...prev]);
      setActiveClubId(newClub.id);
      setActiveHandle(newClub.slug);
      const hydrate = (window as any).__lkdvHydrateCompte;
      if (typeof hydrate === 'function') {
        hydrate({
          name: newClub.name,
          handle: newClub.slug,
          followersCount: 1,
          followingCount: 1,
          bioLine: '· ' + newClub.massif + ' · ' + newClub.bio,
          sigText: '1 sortie · 18 km · 1,2 km D+',
          home: newClub.massif,
        });
      }
      triggerAct('closeSheet');
      showIslandToast(`Club « ${newClub.name} » fondé ✓`, 'Tu es administrateur fondateur de ce club');
    },
    [showIslandToast, triggerAct],
  );

  const handleSendChatMessage = useCallback(
    async (text: string) => {
      const optimisticId = 'cm-' + Date.now();
      setChatMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          authorName: 'Toi',
          authorHandle: activeHandle || 'tony_frc',
          roleBadge: 'Membre',
          text,
          time: 'À l’instant',
        },
      ]);

      if (user?.id && isUuid(activeClub.id) && activeSalonChannelId && typeof fetch === 'function') {
        try {
          await fetch(`/api/clubs/${activeClub.id}/salons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'post_message',
              channelId: activeSalonChannelId,
              body: text,
            }),
          });
        } catch {
          // keep optimistic local echo if offline
        }
      }
    },
    [activeClub.id, activeHandle, activeSalonChannelId, user?.id],
  );

  const handleAddPoleToActiveClub = useCallback(
    (pole: { name: string; specialty: string }) => {
      const newPole: ClubPoleItem = {
        id: `pole-${Date.now()}`,
        name: pole.name,
        specialty: pole.specialty,
      };
      setClubsDirectory((prev) =>
        prev.map((c) => {
          if (c.id !== activeClub.id) return c;
          const nextPoles = [...(c.poles || []), newPole];
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(`lkdv.clubPoles.v1.${c.id}`, JSON.stringify(nextPoles));
            } catch {
              // ignore
            }
          }
          return { ...c, poles: nextPoles };
        }),
      );
      showIslandToast(`Pôle « ${newPole.name} » ajouté ✓`, newPole.specialty);
    },
    [activeClub.id, showIslandToast],
  );

  const handleEnableRecommendedPoles = useCallback(() => {
    const recommended = buildRecommendedPoles(activeClub.name, activeClub.category);
    setClubsDirectory((prev) =>
      prev.map((c) => {
        if (c.id !== activeClub.id) return c;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(`lkdv.clubPoles.v1.${c.id}`, JSON.stringify(recommended));
          } catch {
            // ignore
          }
        }
        return { ...c, poles: recommended };
      }),
    );
    showIslandToast('Pôles de spécialité activés ✓', `${recommended.length} pôles configurés pour ${activeClub.name}`);
  }, [activeClub.category, activeClub.id, activeClub.name, showIslandToast]);
  const patchClubMember = useCallback(
    async (body: Record<string, unknown>, successTitle: string, successSub?: string): Promise<boolean> => {
      if (!user?.id) {
        showIslandToast('Connexion requise', 'Connecte-toi pour modifier les permissions du club');
        return false;
      }
      if (!isUuid(activeClub.id) || typeof fetch !== 'function') {
        showIslandToast('Club local', 'Permissions disponibles uniquement sur un club synchronisé');
        return false;
      }
      try {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errJson = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
          showIslandToast(
            'Action refusée',
            errJson?.message || errJson?.error || `Erreur ${res.status}`,
          );
          return false;
        }
        showIslandToast(successTitle, successSub);
        return true;
      } catch {
        showIslandToast('Erreur réseau', 'Impossible de contacter le serveur');
        return false;
      }
    },
    [activeClub.id, showIslandToast, user?.id],
  );

  const handleToggleMemberStoryPermission = useCallback(
    async (targetUserId: string, canManageStories: boolean): Promise<boolean> => {
      // Optimistic instant update (0ms latency on switch)
      setClubMembers((prev) =>
        prev.map((m) =>
          m.userId === targetUserId || m.id === targetUserId ? { ...m, canManageStories } : m,
        ),
      );
      if (targetUserId === user?.id) {
        setClubsDirectory((prev) =>
          prev.map((c) =>
            c.id === activeClub.id ? { ...c, viewerCanManageStories: canManageStories } : c,
          ),
        );
      }
      const ok = await patchClubMember(
        { action: 'story_permission', userId: targetUserId, canManageStories },
        canManageStories ? 'Pôle Stories activé ✓' : 'Pôle Stories retiré',
      );
      if (!ok) {
        // Rollback on failure
        setClubMembers((prev) =>
          prev.map((m) =>
            m.userId === targetUserId || m.id === targetUserId
              ? { ...m, canManageStories: !canManageStories }
              : m,
          ),
        );
        if (targetUserId === user?.id) {
          setClubsDirectory((prev) =>
            prev.map((c) =>
              c.id === activeClub.id ? { ...c, viewerCanManageStories: !canManageStories } : c,
            ),
          );
        }
        return false;
      }
      return true;
    },
    [activeClub.id, patchClubMember, user?.id],
  );

  const handleToggleMemberGearPermission = useCallback(
    async (targetUserId: string, canManageGear: boolean): Promise<boolean> => {
      // Optimistic instant update (0ms latency on switch)
      setClubMembers((prev) =>
        prev.map((m) =>
          m.userId === targetUserId || m.id === targetUserId ? { ...m, canManageGear } : m,
        ),
      );
      if (targetUserId === user?.id) {
        setClubsDirectory((prev) =>
          prev.map((c) =>
            c.id === activeClub.id ? { ...c, viewerCanManageGear: canManageGear } : c,
          ),
        );
      }
      const ok = await patchClubMember(
        { action: 'gear_permission', userId: targetUserId, canManageGear },
        canManageGear ? 'Référent Matériel activé ✓' : 'Référent Matériel retiré',
      );
      if (!ok) {
        setClubMembers((prev) =>
          prev.map((m) =>
            m.userId === targetUserId || m.id === targetUserId
              ? { ...m, canManageGear: !canManageGear }
              : m,
          ),
        );
        return false;
      }
      return true;
    },
    [activeClub.id, patchClubMember, user?.id],
  );

  const handleToggleMemberLeaderBadge = useCallback(
    async (targetUserId: string, isCertifiedLeader: boolean): Promise<boolean> => {
      // Optimistic instant update (0ms latency on switch)
      setClubMembers((prev) =>
        prev.map((m) =>
          m.userId === targetUserId || m.id === targetUserId ? { ...m, isCertifiedLeader } : m,
        ),
      );
      const ok = await patchClubMember(
        { action: 'leader_badge', userId: targetUserId, isCertifiedLeader },
        isCertifiedLeader ? 'Badge Encadrant activé ✓' : 'Badge Encadrant retiré',
      );
      if (!ok) {
        setClubMembers((prev) =>
          prev.map((m) =>
            m.userId === targetUserId || m.id === targetUserId
              ? { ...m, isCertifiedLeader: !isCertifiedLeader }
              : m,
          ),
        );
        return false;
      }
      return true;
    },
    [patchClubMember],
  );

  const handleChangeMemberRole = useCallback(
    async (targetUserId: string, nextRole: ClubRole): Promise<boolean> => {
      if (nextRole === 'founder') return false;
      let previousSnapshot: ClubMemberData | null = null;
      setClubMembers((prev) =>
        prev.map((m) => {
          if (m.userId !== targetUserId && m.id !== targetUserId) return m;
          previousSnapshot = m;
          return {
            ...m,
            rawRole: nextRole,
            role:
              nextRole === 'admin'
                ? 'Guide & Sécurité'
                : nextRole === 'moderator'
                  ? 'Encadrant'
                  : nextRole === 'volunteer'
                    ? 'Bénévole'
                    : 'Membre actif',
            ...(nextRole === 'member' ? { canManageStories: false, canManageGear: false } : {}),
          };
        }),
      );
      const ok = await patchClubMember(
        { action: 'role', userId: targetUserId, role: nextRole },
        'Grade mis à jour ✓',
        `Nouveau grade : ${nextRole === 'admin' ? 'Admin' : nextRole === 'moderator' ? 'Modérateur' : 'Membre'}`,
      );
      if (!ok && previousSnapshot) {
        const restore = previousSnapshot;
        setClubMembers((prev) =>
          prev.map((m) => (m.userId === targetUserId || m.id === targetUserId ? restore : m)),
        );
        return false;
      }
      return ok;
    },
    [patchClubMember],
  );

  // Strict DB-backed authorization for Stories à la une creation/editing
  const canManageClubStories = Boolean(
    user?.id &&
      (activeClub.createdBy === user.id ||
        activeClub.viewerCanManageStories === true ||
        clubMembers.some(
          (m) =>
            (m.userId === user.id || m.id === user.id) &&
            Boolean(m.canManageStories),
        )),
  );

  // Hydrate or derive Stories à la une for the active club
  useEffect(() => {
    if (!activeClub.id) return;
    const storageKey = `lkdv.clubHighlights.v1.${activeClub.id}`;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setClubHighlights(parsed);
            return;
          }
        }
      } catch {
        // ignore
      }
    }

    const sampleViewers = clubMembers.slice(0, 5).map((m, idx) => ({
      id: m.id || m.handle,
      name: m.name,
      handle: m.handle,
      role: m.role,
      avatarUrl: m.avatarUrl,
      viewedAt: idx === 0 ? 'il y a 14 min' : idx === 1 ? 'il y a 1 h' : `il y a ${idx + 1} h`,
    }));

    const coverBase = activeClub.coverUrl || '/assets/images/account-bg.webp';
    const diverseCovers = [
      '/assets/images/mountain-1.jpg',
      '/assets/images/club-bivouac.jpg',
      '/assets/images/club-trail.jpg',
      '/assets/images/journal-refuge.jpg',
    ];
    const defaultHighlights: ClubStoryHighlight[] = [
      {
        id: 'hl-sorties',
        title: 'Sorties',
        coverUrl: clubOutings[0]?.coverUrl || diverseCovers[0],
        subtitle: activeClub.nextOutingTitle || 'Reconnaissances & départs du club',
        createdAtLabel: 'À la une',
        slides: [
          {
            id: 'hl-sorties-s1',
            image: clubOutings[0]?.coverUrl || diverseCovers[0],
            caption: `${activeClub.name} · ${activeClub.nextOutingTitle || 'Sorties & traces vérifiées'}`,
          },
        ],
        viewsCount: Math.max(sampleViewers.length, activeClub.membersCount || 7),
        viewers: sampleViewers,
      },
      {
        id: 'hl-terrain',
        title: activeClub.massif || 'Terrain',
        coverUrl: diverseCovers[1],
        subtitle: `Reconnaissances ${activeClub.massif}`,
        createdAtLabel: 'À la une',
        slides: [
          {
            id: 'hl-terrain-s1',
            image: diverseCovers[1],
            caption: `${activeClub.massif} · Conditions & traces du club`,
          },
        ],
        viewsCount: Math.max(sampleViewers.length, Math.round((activeClub.membersCount || 6) * 0.85)),
        viewers: sampleViewers.slice(0, 4),
      },
      {
        id: 'hl-charte',
        title: 'Esprit Club',
        coverUrl: diverseCovers[2] || coverBase,
        subtitle: activeClub.charter,
        createdAtLabel: 'À la une',
        slides: [
          {
            id: 'hl-charte-s1',
            image: diverseCovers[2] || coverBase,
            caption: activeClub.charter || `Bienvenue dans ${activeClub.name}`,
          },
        ],
        viewsCount: Math.max(sampleViewers.length, activeClub.membersCount || 5),
        viewers: sampleViewers.slice(0, 3),
      },
    ];
    setClubHighlights(defaultHighlights);
  }, [activeClub.charter, activeClub.coverUrl, activeClub.id, activeClub.massif, activeClub.membersCount, activeClub.name, activeClub.nextOutingTitle, clubMembers, clubOutings]);

  const richClubMapPayload = useMemo<ClubRichMapPayload>(() => {
    const baseLat = Number.isFinite(activeClub.lat) ? activeClub.lat : 45.9237;
    const baseLng = Number.isFinite(activeClub.lng) ? activeClub.lng : 6.8694;

    const outings: ClubMapOutingTrack[] = clubOutings
      .filter((o) => o.status !== 'cancelled')
      .map((o, idx) => {
        const geom = buildOutingTrackGeometry({
          id: o.id,
          title: o.title,
          massif: o.massif,
          lat: o.lat,
          lng: o.lng,
          km: o.km,
          dplus: o.dplus,
          maxAlt: o.maxAlt,
          routeTrace: o.routeTrace,
          index: idx,
        });
        const massifName = o.massif || activeClub.massif || 'Alpes';
        const massifId = slugifyMassif(massifName);
        const poleId = inferPoleIdFromText(activeClub.poles, o.title, o.massif);
        return {
          id: o.id,
          title: o.title,
          massif: massifName,
          massifId,
          countryCode: 'FR',
          status: o.status === 'live' ? 'live' : o.status === 'completed' ? 'completed' : 'upcoming',
          startsAtIso: o.startsAtIso || '',
          dateLabel: o.dateLabel || o.date || 'À venir',
          km: o.km || 0,
          dplus: o.dplus || 0,
          maxAlt: o.maxAlt || Math.round(geom.peak[2]),
          participantsCount: o.participantsCount || 0,
          maxParticipants: o.maxParticipants ?? null,
          rsvpJoined: Boolean(o.rsvpJoined),
          leaderName: o.leaderName || activeClub.name,
          poleId,
          isApproximateRoute: geom.isApproximateRoute,
          coords: geom.coords,
          start: geom.start,
          peak: geom.peak,
          bounds: geom.bounds,
        };
      });

    const outingById = new Map(outings.map((o) => [o.id, o]));

    const posts: ClubMapPostPin[] = clubPosts.map((p, idx) => {
      const linkedOuting = p.outingId ? outingById.get(p.outingId) : undefined;
      const massifName = linkedOuting?.massif || p.massif || activeClub.massif || 'Alpes';
      const massifId = linkedOuting?.massifId || slugifyMassif(massifName);
      const trackProgress = linkedOuting
        ? Number((0.12 + ((idx * 0.173) % 0.76)).toFixed(3))
        : undefined;
      const snapped =
        linkedOuting && trackProgress !== undefined
          ? snapPointAlongTrack(linkedOuting.coords, trackProgress)
          : null;
      const angle = idx * 2.39996 + 0.5;
      const fallbackLat =
        typeof p.lat === 'number' && Number.isFinite(p.lat)
          ? p.lat
          : baseLat + Math.sin(angle) * 0.012;
      const fallbackLng =
        typeof p.lng === 'number' && Number.isFinite(p.lng)
          ? p.lng
          : baseLng + Math.cos(angle) * 0.016;
      const resolvedLng = snapped ? snapped[0] : Number(fallbackLng.toFixed(5));
      const resolvedLat = snapped ? snapped[1] : Number(fallbackLat.toFixed(5));
      return {
        id: p.id,
        spot: p.spot,
        caption: p.caption,
        authorName: p.authorName,
        authorHandle: p.authorHandle,
        authorAvatar: p.authorAvatar || null,
        mediaUrl: p.mediaUrl || null,
        timeAgo: p.timeAgo,
        massif: massifName,
        massifId,
        likes: p.likes,
        outingId: p.outingId,
        poleId: p.poleId || inferPoleIdFromText(activeClub.poles, p.spot, p.caption, p.metricsChip),
        lat: resolvedLat,
        lng: resolvedLng,
        trackProgress,
      };
    });

    const massifAcc = new Map<
      string,
      { name: string; pts: Array<[number, number]>; outings: number; postsCount: number }
    >();
    for (const o of outings) {
      const entry = massifAcc.get(o.massifId) ?? {
        name: o.massif,
        pts: [],
        outings: 0,
        postsCount: 0,
      };
      entry.pts.push(o.start);
      entry.outings += 1;
      massifAcc.set(o.massifId, entry);
    }
    for (const p of posts) {
      const existing = massifAcc.get(p.massifId);
      if (existing) {
        existing.postsCount += 1;
      } else {
        massifAcc.set(p.massifId, {
          name: p.massif,
          pts: [[p.lng, p.lat]],
          outings: 0,
          postsCount: 1,
        });
      }
    }
    const massifs: ClubRichMapMassifSummary[] = Array.from(massifAcc.entries()).map(([id, m]) => {
      const avgLng = m.pts.reduce((acc, pt) => acc + pt[0], 0) / Math.max(1, m.pts.length);
      const avgLat = m.pts.reduce((acc, pt) => acc + pt[1], 0) / Math.max(1, m.pts.length);
      return {
        id,
        name: m.name,
        center: [Number(avgLng.toFixed(5)), Number(avgLat.toFixed(5))],
        outings: m.outings,
        postsCount: m.postsCount,
      };
    });

    const pokedex: ClubMapPokedexItem[] = clubPokedex
      .map((px, idx) => {
        const linkedOuting = px.outingId ? outingById.get(px.outingId) : undefined;
        const trackProgress =
          typeof px.trackProgress === 'number' && Number.isFinite(px.trackProgress)
            ? px.trackProgress
            : Number((0.2 + ((idx * 0.23) % 0.6)).toFixed(3));
        const snapped =
          linkedOuting && (!Number.isFinite(px.lat) || !Number.isFinite(px.lng))
            ? snapPointAlongTrack(linkedOuting.coords, trackProgress)
            : null;
        return {
          ...px,
          outingId: px.outingId || linkedOuting?.id || '',
          outingTitle: px.outingTitle || linkedOuting?.title || activeClub.name,
          lat: snapped ? snapped[1] : px.lat,
          lng: snapped ? snapped[0] : px.lng,
          trackProgress,
        };
      })
      .filter((px) => Boolean(px.outingId));

    const kits: ClubMapKitUsage[] =
      outings.length === 0
        ? []
        : standardKits.map((kit, idx) => {
            const seasonNorm = kit.season.toLowerCase();
            const matchedOuting =
              outings.find((o) => {
                const hay = `${o.title} ${o.massif}`.toLowerCase();
                return seasonNorm.includes('hiver') ? /ski|hiver|neige|glacier/.test(hay) : false;
              }) || outings[idx % outings.length];
            const trackProgress = Number((0.24 + ((idx * 0.21) % 0.52)).toFixed(3));
            const [snappedLng, snappedLat] = snapPointAlongTrack(matchedOuting.coords, trackProgress);
            return {
              id: kit.id,
              title: kit.title,
              season: kit.season,
              totalWeightG: kit.totalWeightG,
              itemsCount: kit.itemsCount,
              items: kit.items.slice(0, 6),
              outingId: matchedOuting.id,
              outingTitle: matchedOuting.title,
              lat: snappedLat,
              lng: snappedLng,
              trackProgress,
            };
          });

    const liveOuting = outings.find((o) => o.status === 'live');
    const liveMembers: ClubMapLiveMember[] =
      mapLiveMembers.length > 0
        ? mapLiveMembers.map((m, idx) => {
            if (!m.fuzzy && liveOuting && (!Number.isFinite(m.lat) || !Number.isFinite(m.lng))) {
              const prog = Number((0.35 + ((idx * 0.14) % 0.4)).toFixed(3));
              const [sLng, sLat] = snapPointAlongTrack(liveOuting.coords, prog);
              return { ...m, lat: sLat, lng: sLng };
            }
            return m;
          })
        : clubMembers
            .filter((m) => m.shareClubLocation && typeof m.lastLat === 'number' && typeof m.lastLng === 'number')
            .map((m) => ({
              id: m.userId || m.id,
              name: m.name,
              handle: m.handle,
              role: m.role,
              avatarUrl: m.avatarUrl || null,
              lat: m.lastLat as number,
              lng: m.lastLng as number,
              fuzzy: !liveOuting,
            }));

    return {
      clubId: activeClub.id,
      clubName: activeClub.name,
      center: [baseLng, baseLat],
      countrySummary: {
        code: 'FR',
        name: 'France',
        outings: outings.length,
        members: activeClub.membersCount || clubMembers.length,
      },
      massifs,
      outings,
      liveMembers,
      pokedex,
      kits,
      posts,
    };
  }, [
    activeClub.id,
    activeClub.lat,
    activeClub.lng,
    activeClub.massif,
    activeClub.membersCount,
    activeClub.name,
    activeClub.poles,
    clubMembers,
    clubOutings,
    clubPokedex,
    clubPosts,
    mapLiveMembers,
    standardKits,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__lkdvClubMapData = richClubMapPayload;
    if (typeof (window as any).__lkdvSyncClubMap === 'function') {
      (window as any).__lkdvSyncClubMap(richClubMapPayload);
    }
  }, [richClubMapPayload]);

  const handleToggleMapFullscreen = useCallback(
    (next?: boolean) => {
      if (typeof document === 'undefined') return;
      const phoneEl = document.getElementById('phone');
      const currentBig = Boolean(phoneEl?.classList.contains('mapbig'));
      const targetBig = typeof next === 'boolean' ? next : !currentBig;
      if (targetBig === currentBig) return;
      const runtimeState = (window as any).__lkdvGetState?.();
      if (runtimeState?.G) {
        runtimeState.G.forceMapBig = true;
      }
      if (targetBig && phoneEl?.classList.contains('map-collapsed')) {
        triggerAct('toggleMapCollapsed');
      }
      triggerAct('mapbig');
    },
    [triggerAct],
  );

  const ensureFeedTabAndScrollToPost = useCallback(
    (postId: string) => {
      const runtimeState = (window as any).__lkdvGetState?.();
      if (runtimeState?.S?.igTab !== 0) {
        triggerAct('igtab', 0);
      }
      setHighlightedPostId(postId);
    },
    [triggerAct],
  );

  useEffect(() => {
    if (!highlightedPostId || isMapFullscreen || typeof window === 'undefined') return;
    let cancelled = false;
    let rafId = 0;
    let attempts = 0;
    let clearTimer: number | null = null;

    const tryScroll = () => {
      if (cancelled) return;
      const cardScroll = document.querySelector<HTMLElement>('#card .card-scroll');
      const escapedId =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(highlightedPostId)
          : highlightedPostId.replace(/"/g, '\\"');
      const postEl = cardScroll?.querySelector<HTMLElement>(`[data-post-id="${escapedId}"]`) ?? null;
      if (cardScroll && postEl) {
        const runtimeState = (window as any).__lkdvGetState?.();
        if (runtimeState?.G) {
          runtimeState.G.mapManualOpenAt = Date.now();
        }
        const scrollRect = cardScroll.getBoundingClientRect();
        const postRect = postEl.getBoundingClientRect();
        const targetTop = Math.max(0, cardScroll.scrollTop + (postRect.top - scrollRect.top) - 16);
        cardScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
        clearTimer = window.setTimeout(() => {
          setHighlightedPostId((cur) => (cur === highlightedPostId ? null : cur));
        }, 2800);
        return;
      }
      attempts += 1;
      if (attempts < 10) {
        rafId = window.requestAnimationFrame(tryScroll);
      }
    };

    rafId = window.requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (clearTimer !== null) window.clearTimeout(clearTimer);
    };
  }, [highlightedPostId, isMapFullscreen, clubPosts.length]);

  useEffect(() => {
    if (mapSelection?.kind !== 'outing' || typeof document === 'undefined') return;
    const carousel = document.querySelector<HTMLElement>('#card .voyages-carousel');
    if (!carousel) return;
    const cards = carousel.querySelectorAll<HTMLElement>('.voyage-card');
    cards.forEach((card) => {
      const isMatch = card.dataset.v === mapSelection.id;
      card.classList.toggle('is-selected', isMatch);
      if (isMatch) {
        const cRect = carousel.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const nextLeft = Math.max(0, carousel.scrollLeft + (cardRect.left - cRect.left) - 12);
        carousel.scrollTo({ left: nextLeft, behavior: 'smooth' });
      }
    });
  }, [mapSelection]);

  const handleMapSelectionChange = useCallback(
    (nextSel: ClubMapSelection) => {
      setMapSelection(nextSel);
      if (nextSel?.kind === 'post') {
        const phoneEl = typeof document !== 'undefined' ? document.getElementById('phone') : null;
        const currentlyBig = isMapFullscreen || Boolean(phoneEl?.classList.contains('mapbig'));
        if (!currentlyBig) {
          ensureFeedTabAndScrollToPost(nextSel.id);
        }
      }
    },
    [ensureFeedTabAndScrollToPost, isMapFullscreen],
  );

  const handleClubMapAction = useCallback(
    (action: ClubMapActionPayload) => {
      if (action.kind === 'open-outing') {
        pendingDrawerIntentRef.current = { tab: 2, subTab: 0, outingId: action.outingId || action.id };
        triggerAct('openClubDrawer', '2:0');
      } else if (action.kind === 'rsvp-outing') {
        handleToggleOutingRsvp(action.outingId || action.id);
      } else if (action.kind === 'open-kit') {
        if (action.id && standardKits.some((k) => k.id === action.id)) {
          handleCloneKit(action.id);
        }
        pendingDrawerIntentRef.current = { tab: 3, subTab: 1 };
        triggerAct('openClubDrawer', '3:1');
      } else if (action.kind === 'open-member') {
        pendingDrawerIntentRef.current = { tab: 1, subTab: 0, memberId: action.id };
        triggerAct('openClubDrawer', '1:0');
      } else if (action.kind === 'open-massif') {
        pendingDrawerIntentRef.current = { tab: 2, subTab: 0 };
        triggerAct('openClubDrawer', '2:0');
      } else if (action.kind === 'open-post') {
        handleToggleMapFullscreen(false);
        setMapSelection({ kind: 'post', id: action.id, outingId: action.outingId });
        ensureFeedTabAndScrollToPost(action.id);
      }
    },
    [ensureFeedTabAndScrollToPost, handleCloneKit, handleToggleMapFullscreen, handleToggleOutingRsvp, standardKits, triggerAct],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLiveCamp = () => {
      const phoneEl = document.getElementById('phone');
      if (phoneEl?.classList.contains('map-collapsed')) {
        triggerAct('toggleMapCollapsed');
      }
      const liveOrImminent =
        clubOutings.find((o) => o.status === 'live') ??
        clubOutings
          .filter((o) => o.status === 'upcoming')
          .sort((a, b) => (a.startsAtIso || '').localeCompare(b.startsAtIso || ''))[0];
      if (liveOrImminent) {
        setMapSelection({ kind: 'outing', id: liveOrImminent.id });
        showIslandToast(
          `Camp live · ${liveOrImminent.title}`,
          richClubMapPayload.liveMembers.length > 0
            ? `${richClubMapPayload.liveMembers.length} membre(s) en partage live · ${liveOrImminent.massif}`
            : `${liveOrImminent.massif} · ${liveOrImminent.dateLabel || liveOrImminent.date}`,
        );
      } else if (richClubMapPayload.liveMembers.length > 0) {
        const firstMember = richClubMapPayload.liveMembers[0];
        setMapSelection({ kind: 'member', id: firstMember.id });
        showIslandToast('Camp live du club', `${richClubMapPayload.liveMembers.length} membre(s) localisé(s)`);
      } else {
        flyMapToCoords([activeClub.lng, activeClub.lat], `${activeClub.name} · ${activeClub.massif}`);
      }
    };
    const onSelectOutingFromCarousel = (ev: Event) => {
      const outingId = (ev as CustomEvent<{ outingId?: string }>).detail?.outingId;
      if (outingId) {
        setMapSelection({ kind: 'outing', id: outingId });
      }
    };
    window.addEventListener('lkdv:club-live-camp', onLiveCamp);
    window.addEventListener('lkdv:club-select-outing', onSelectOutingFromCarousel);
    return () => {
      window.removeEventListener('lkdv:club-live-camp', onLiveCamp);
      window.removeEventListener('lkdv:club-select-outing', onSelectOutingFromCarousel);
    };
  }, [activeClub.lat, activeClub.lng, activeClub.massif, activeClub.name, clubOutings, flyMapToCoords, richClubMapPayload.liveMembers, showIslandToast, triggerAct]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMapAction = (ev: Event) => {
      const detail = (ev as CustomEvent<{ type?: string; id?: string; outingId?: string; title?: string; subtitle?: string }>).detail;
      if (!detail?.type) return;
      if (detail.type === 'outing') {
        pendingDrawerIntentRef.current = { tab: 2, subTab: 0, outingId: detail.id };
        triggerAct('openClubDrawer', '2:0');
      } else if (detail.type === 'member') {
        pendingDrawerIntentRef.current = { tab: 1, subTab: 0, memberId: detail.id };
        triggerAct('openClubDrawer', '1:0');
      } else if (detail.type === 'kit') {
        pendingDrawerIntentRef.current = { tab: 3, subTab: 1 };
        triggerAct('openClubDrawer', '3:1');
      } else if (detail.type === 'pokedex') {
        if (detail.outingId || detail.id) {
          pendingDrawerIntentRef.current = { tab: 2, subTab: 0, outingId: detail.outingId || detail.id };
          triggerAct('openClubDrawer', '2:0');
        } else {
          showIslandToast(detail.title || 'Pokédex du club', detail.subtitle || 'Observation faune pendant une sortie');
        }
      } else if (detail.type === 'post' && detail.id) {
        handleToggleMapFullscreen(false);
        ensureFeedTabAndScrollToPost(detail.id);
        showIslandToast(detail.title || 'Publication du club', detail.subtitle || 'Positionnée sur la carte');
      }
    };
    window.addEventListener('lkdv:club-map-action', onMapAction);
    return () => window.removeEventListener('lkdv:club-map-action', onMapAction);
  }, [ensureFeedTabAndScrollToPost, handleToggleMapFullscreen, showIslandToast, triggerAct]);

  const persistHighlights = useCallback(
    (next: ClubStoryHighlight[]) => {
      setClubHighlights(next);
      if (typeof window !== 'undefined' && activeClub.id) {
        try {
          window.localStorage.setItem(`lkdv.clubHighlights.v1.${activeClub.id}`, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    },
    [activeClub.id],
  );

  const openHighlightEditor = useCallback(
    (highlightId: string) => {
      if (!canManageClubStories) return;
      const found = clubHighlights.find((h) => h.id === highlightId);
      if (!found) return;
      setEditingHighlightId(found.id);
      setHighlightTitleDraft(found.title);
      setHighlightCoverDraft(found.coverUrl);
      setHighlightCaptionDraft(found.slides[0]?.caption || '');
    },
    [canManageClubStories, clubHighlights],
  );

  const handleAddHighlight = useCallback(() => {
    if (!canManageClubStories) return;
    const pool = [
      '/assets/images/journal-refuge.jpg',
      '/assets/images/community-hikers.jpg',
      '/assets/images/mountain-2.jpg',
      '/assets/images/club-bivouac.jpg',
      '/assets/images/club-trail.jpg',
    ];
    const coverBase = pool[clubHighlights.length % pool.length] || activeClub.coverUrl || '/assets/images/account-bg.webp';
    const newHl: ClubStoryHighlight = {
      id: `hl-${Date.now()}`,
      title: 'Nouvelle',
      coverUrl: coverBase,
      subtitle: activeClub.name,
      createdAtLabel: 'À l’instant',
      slides: [
        {
          id: `hl-slide-${Date.now()}`,
          image: coverBase,
          caption: `${activeClub.name} · Moment fort du club`,
        },
      ],
      viewsCount: 1,
      viewers: clubMembers.slice(0, 1).map((m) => ({
        id: m.id || m.handle,
        name: m.name,
        handle: m.handle,
        role: m.role,
        avatarUrl: m.avatarUrl,
        viewedAt: 'À l’instant',
      })),
    };
    const next = [...clubHighlights, newHl];
    persistHighlights(next);
    setEditingHighlightId(newHl.id);
    setHighlightTitleDraft(newHl.title);
    setHighlightCoverDraft(newHl.coverUrl);
    setHighlightCaptionDraft(newHl.slides[0]?.caption || '');
  }, [activeClub.coverUrl, activeClub.name, canManageClubStories, clubHighlights, clubMembers, persistHighlights]);

  const handleToggleClubVisibility = useCallback(async () => {
    const nextVisibility = activeClub.visibility === 'public' ? 'prive' : 'public';
    const nextPrivacy = nextVisibility === 'public' ? 'open' : 'closed';
    setClubsDirectory((prev) =>
      prev.map((c) => (c.id === activeClub.id ? { ...c, visibility: nextVisibility } : c)),
    );
    if (user?.id && isUuid(activeClub.id) && typeof fetch === 'function') {
      try {
        await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privacy: nextPrivacy }),
        });
      } catch {
        // optimistic fallback kept
      }
    }
    showIslandToast(
      nextVisibility === 'prive' ? 'Club passé en Fermé (validation requise)' : 'Club passé en Ouvert (public)',
      'Gouvernance du club mise à jour',
    );
  }, [activeClub.id, activeClub.visibility, showIslandToast, user?.id]);

  const handleCreateGroupFromOuting = useCallback(
    async (outing: ClubOutingData) => {
      showIslandToast('Canal de cordée créé ✓', `Groupe « ${outing.title} » ouvert dans Messagerie`);
      if (user?.id) {
        try {
          await createGroupFromClub({
            clubId: activeClub.id,
            name: outing.title,
          });
        } catch (_) {}
      }
    },
    [activeClub.id, showIslandToast, user?.id],
  );

  const clubMapPayload = useMemo<CompteMapPayload>(() => {
    const baseLat = Number.isFinite(activeClub.lat) ? activeClub.lat : 45.9237;
    const baseLng = Number.isFinite(activeClub.lng) ? activeClub.lng : 6.8694;
    const tracks: MapTrack[] = richClubMapPayload.outings.map((o) => {
      const coords: TrackPoint[] = o.coords.map(([lng, lat, ele]) =>
        ele !== undefined ? { lng, lat, ele } : { lng, lat },
      );
      return {
        id: o.id,
        title: o.title,
        startedAt: o.startsAtIso || null,
        year: o.startsAtIso ? new Date(o.startsAtIso).getFullYear() : new Date().getFullYear(),
        km: o.km || 0,
        dplus: o.dplus || 0,
        maxAlt: o.maxAlt || null,
        verified: o.status === 'completed',
        visibility: 'collective_anonymized',
        massif: o.massif,
        massifId: o.massifId,
        kitId: null,
        kitName: null,
        carnetId: null,
        photosCount: richClubMapPayload.posts.filter((p) => p.outingId === o.id).length,
        participantsCount: o.participantsCount || 0,
        coordinates: coords,
        bounds: o.bounds,
        start: coords[0] ?? { lng: o.start[0], lat: o.start[1] },
        end: coords[coords.length - 1] ?? { lng: o.start[0], lat: o.start[1] },
      };
    });

    const massifs: MapMassif[] = richClubMapPayload.massifs.map((m) => ({
      id: m.id,
      name: m.name,
      countryCode: 'FR',
      center: { lng: m.center[0], lat: m.center[1] },
      outings: m.outings,
      verified: true,
    }));

    const allPts = tracks.flatMap((t) => t.coordinates);
    const totalBounds =
      boundsOfMapPoints(allPts) ?? [baseLng - 0.15, baseLat - 0.12, baseLng + 0.15, baseLat + 0.12];

    return {
      tracks,
      massifs,
      carnets: [],
      pois: [],
      stats: {
        outings: clubOutings.length,
        km: Math.round(clubOutings.reduce((s, o) => s + (o.km || 0), 0)),
        dplus: Math.round(clubOutings.reduce((s, o) => s + (o.dplus || 0), 0)),
        massifs: massifs.length,
        countries: 1,
      },
      bounds: totalBounds,
      truncated: false,
      generatedAt: new Date().toISOString(),
    };
  }, [activeClub.lat, activeClub.lng, clubOutings, richClubMapPayload]);

  const selectedMassifSummary = useMemo(() => {
    if (mapSelection?.kind !== 'massif') return null;
    const found = richClubMapPayload.massifs.find(
      (m) => m.id === mapSelection.id || m.name.toLowerCase() === mapSelection.name.toLowerCase(),
    );
    return {
      id: mapSelection.id,
      name: found?.name || mapSelection.name,
      outingsCount: found?.outings ?? 0,
      postsCount: found?.postsCount ?? 0,
    };
  }, [mapSelection, richClubMapPayload.massifs]);

  const selectedMapOuting = useMemo(() => {
    if (mapSelection?.kind !== 'outing') return null;
    return clubOutings.find((o) => o.id === mapSelection.id) ?? null;
  }, [clubOutings, mapSelection]);

  const fullscreenPeekPost = useMemo(() => {
    if (!isMapFullscreen || mapSelection?.kind !== 'post') return null;
    return clubPosts.find((p) => p.id === mapSelection.id) ?? null;
  }, [clubPosts, isMapFullscreen, mapSelection]);

  return (
    <div
      className="lkdv-compte-v8 lkdv-club-v8 lkdv-clubs-v8"
      data-theme="light"
      data-club-drawer-open={drawerMount ? 'true' : 'false'}
    >
      <style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />
      <div className="sr-only" aria-hidden="true" inert>
        <span>Club iOS 27 Liquid Glass v8 · @{activeHandle} · {syncStatus}</span>
        <button type="button" onClick={() => triggerAct('openCreate')}>Créer une sortie</button>
        <Link href="/communaute">Tous les clubs</Link>
      </div>
      <div ref={containerRef} />
      {mapRoot && mapVisible
        ? createPortal(
            <ClubMapBoundary>
              <ClubMap
                authState="owner"
                context={clubMapContext}
                clubData={clubMapPayload}
                richClubData={richClubMapPayload}
                selection={mapSelection}
                onSelect={handleMapSelectionChange}
                activePoleId={activePoleId === 'all' ? null : activePoleId}
                isFullscreen={isMapFullscreen}
                onToggleFullscreen={handleToggleMapFullscreen}
                isOutdoor={isOutdoor}
                onAction={handleClubMapAction}
                contextMode={Boolean(drawerMount)}
              />
            </ClubMapBoundary>,
            mapRoot,
          )
        : null}
      {phonePortalRoot && fullscreenPeekPost
        ? createPortal(
            <div
              className="club-map-peek-card"
              role="dialog"
              aria-label={`Aperçu publication de ${fullscreenPeekPost.authorName}`}
            >
              {fullscreenPeekPost.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fullscreenPeekPost.mediaUrl}
                  alt={fullscreenPeekPost.spot || fullscreenPeekPost.authorName}
                  className="club-map-peek-card__thumb"
                />
              ) : null}
              <div className="club-map-peek-card__body">
                <div className="club-map-peek-card__meta">
                  <b>{fullscreenPeekPost.authorName}</b>
                  <span>{fullscreenPeekPost.spot}</span>
                </div>
                <p className="club-map-peek-card__caption">{fullscreenPeekPost.caption}</p>
                <div className="club-map-peek-card__actions">
                  <button
                    type="button"
                    className="club-map-peek-card__cta"
                    onClick={() => {
                      handleToggleMapFullscreen(false);
                      ensureFeedTabAndScrollToPost(fullscreenPeekPost.id);
                    }}
                  >
                    Voir dans le fil
                  </button>
                  <button
                    type="button"
                    className="club-map-peek-card__close"
                    onClick={() => setMapSelection(null)}
                    aria-label="Fermer l’aperçu"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>,
            phonePortalRoot,
          )
        : null}
      {feedRoot &&
        createPortal(
          <ClubInlineFeed
            clubId={activeClub.id}
            clubName={activeClub.name}
            posts={clubPosts}
            poles={activeClub.poles}
            highlights={clubHighlights}
            canManageStories={canManageClubStories}
            onOpenHighlight={(hlId) => {
              const idx = clubHighlights.findIndex((h) => h.id === hlId);
              setStoryViewerState({ mode: 'highlights', startIndex: Math.max(0, idx) });
            }}
            onEditHighlight={openHighlightEditor}
            onAddHighlight={handleAddHighlight}
            membersCount={activeClub.membersCount}
            activePoleId={activePoleId}
            onActivePoleChange={setActivePoleId}
            mapSelection={mapSelection}
            selectedMassifSummary={selectedMassifSummary}
            selectedOuting={selectedMapOuting}
            highlightedPostId={highlightedPostId}
            onClearMapSelection={() => setMapSelection(null)}
            onToggleOutingRsvpById={handleToggleOutingRsvp}
            onAddPole={handleAddPoleToActiveClub}
            onEnableRecommendedPoles={handleEnableRecommendedPoles}
            onToggleLike={handleTogglePostLike}
            onToggleSave={handleTogglePostSave}
            onAddComment={handleAddPostComment}
            onToggleRsvp={(postId, outingId) => {
              if (outingId) handleToggleOutingRsvp(outingId);
              else showIslandToast('Place réservée dans la cordée ✓', 'Synchronisé avec la sortie du club');
              void postId;
            }}
            onFlyToSpot={(post) => {
              const phoneEl = document.getElementById('phone');
              if (phoneEl?.classList.contains('map-collapsed')) {
                triggerAct('toggleMapCollapsed');
              }
              setMapSelection({ kind: 'post', id: post.id, outingId: post.outingId });
            }}
            onOpenOutingDetail={(outingId) => {
              pendingDrawerIntentRef.current = { tab: 2, subTab: 0, outingId };
              triggerAct('openClubDrawer', '2:0');
            }}
            onOpenCreatePost={(poleId) => {
              setCommunityCreateKind('post');
              setCommunityCreatePrefill({
                clubId: activeClub.id,
                clubName: activeClub.name,
                ...(poleId ? { poleId } : {}),
              });
              setCommunityCreateOpen(true);
            }}
          />,
          feedRoot,
        )}
      {drawerMount &&
        createPortal(
          <ClubDrawerHost
            mode={drawerMount.props.mode || 'main'}
            isOpen
            initialTab={drawerMount.props.tab ?? 0}
            initialSubTab={drawerMount.props.subTab ?? 0}
            initialSearch={drawerMount.props.tab === 0 && drawerMount.props.subTab === 2}
            initialOutingId={drawerMount.props.outingId}
            initialMemberId={drawerMount.props.memberId}
            initialSection={drawerMount.props.initialSection}
            intent={drawerIntent}
            syncStatus={syncStatus}
            onRetrySync={() => void syncClubProfile()}
            currentUserId={user?.id ?? null}
            blockedUserIds={blockedUserIds}
            isOutdoor={isOutdoor}
            activeClub={activeClub}
            clubs={clubsDirectory}
            members={clubMembers}
            outings={clubOutings}
            vaultGear={vaultGear}
            standardKits={standardKits}
            challenges={challenges}
            chatMessages={chatMessages}
            posts={clubPosts}
            onSelectClub={handleSelectClub}
            onToggleJoinClub={handleToggleJoinClub}
            onToggleFollowMember={handleToggleFollowMember}
            onProposeBinome={handleProposeBinome}
            onUpdateMyAvailability={handleUpdateMyAvailability}
            onChangeMemberRole={handleChangeMemberRole}
            onToggleMemberStoryPermission={handleToggleMemberStoryPermission}
            onToggleMemberGearPermission={handleToggleMemberGearPermission}
            onToggleMemberLeaderBadge={handleToggleMemberLeaderBadge}
            onToggleRsvpOuting={handleToggleOutingRsvp}
            onCreateGroupFromOuting={handleCreateGroupFromOuting}
            onDownloadGpx={(o) => {
              triggerAct('export', 'gpx');
              showIslandToast(`Trace GPX · ${o.title}`, `${o.km} km · +${o.dplus} m téléchargée`);
            }}
            onFlyToCoords={(lat, lng, label) => {
              triggerAct('closeSheet');
              flyMapToCoords([lng, lat], label);
            }}
            onToggleReserveGear={handleBorrowGear}
            onRequestGearLoan={handleRequestGearLoan}
            onTransitionGearLoan={handleTransitionGearLoan}
            onCloneStandardKit={handleCloneKit}
            onSendChatMessage={handleSendChatMessage}
            onToggleClubVisibility={handleToggleClubVisibility}
            onCreatePost={handleCreatePost}
            onCreateOuting={handleCreateOuting}
            onCreateVaultGear={handleLendGearToVault}
            onCreateNewClub={handleCreateNewClub}
            onToast={handleToast}
            onOpenRuntimeOverlay={handleOpenRuntimeOverlay}
            onTabChange={(nextTab) => {
              if (nextTab === 4) {
                const phoneEl = document.getElementById('phone');
                if (phoneEl && !phoneEl.classList.contains('map-collapsed')) {
                  triggerAct('toggleMapCollapsed');
                }
              }
            }}
            onClose={() => triggerAct('closeSheet')}
          />,
          drawerMount.root,
        )}
      {communityCreateOpen ? (
        <CreateSheetV2
          open={communityCreateOpen}
          initialKind={communityCreateKind}
          onClose={() => setCommunityCreateOpen(false)}
          user={user ?? null}
          onCreated={() => {
            setCommunityCreateOpen(false);
            void syncClubProfile();
          }}
          onRequireAuth={() => router.push('/connexion')}
          initialPrefill={{
            clubId: activeClub.id,
            clubName: activeClub.name,
            ...(communityCreatePrefill ?? {}),
          }}
          onCreateRequested={(nextKind, prefill) => {
            setCommunityCreateKind(nextKind);
            setCommunityCreatePrefill(prefill ?? null);
            setCommunityCreateOpen(true);
          }}
        />
      ) : null}

      {storyViewerState ? (
        <StoriesViewer
          users={
            storyViewerState.mode === 'daily'
              ? [
                  {
                    id: activeClub.id || 'club-daily',
                    name: `${activeClub.name} · Story du jour`,
                    avatarUrl: activeClub.coverUrl || '/assets/images/account-bg.webp',
                    time: 'Aujourd’hui · 24h',
                    slides:
                      clubPosts.filter((p) => Boolean(p.mediaUrl)).length > 0
                        ? clubPosts
                            .filter((p) => Boolean(p.mediaUrl))
                            .slice(0, 5)
                            .map((p) => ({
                              storyId: p.id,
                              image: p.mediaUrl!,
                              caption: `${p.spot} — ${p.caption}`,
                            }))
                        : [
                            {
                              storyId: `daily-${activeClub.id || 'club'}`,
                              image: activeClub.coverUrl || '/assets/images/account-bg.webp',
                              caption: `${activeClub.name} · ${activeClub.nextOutingTitle || activeClub.bio}`,
                            },
                          ],
                  } satisfies StoryUser,
                ]
              : clubHighlights.map(
                  (hl): StoryUser => ({
                    id: hl.id,
                    name: `${activeClub.name} · ${hl.title}`,
                    avatarUrl: hl.coverUrl || activeClub.coverUrl,
                    time: hl.createdAtLabel || 'À la une',
                    slides: hl.slides.map((s) => ({
                      storyId: hl.id,
                      image: s.image || hl.coverUrl,
                      caption: s.caption,
                    })),
                  }),
                )
          }
          startUser={storyViewerState.startIndex}
          onClose={() => setStoryViewerState(null)}
          myUserId={
            canManageClubStories
              ? storyViewerState.mode === 'daily'
                ? activeClub.id || 'club-daily'
                : clubHighlights[storyViewerState.startIndex]?.id
              : undefined
          }
          onShowViews={
            canManageClubStories
              ? (slide) => {
                  const targetId =
                    slide.storyId && clubHighlights.some((h) => h.id === slide.storyId)
                      ? slide.storyId
                      : clubHighlights[0]?.id;
                  setStoryViewerState(null);
                  if (targetId) openHighlightEditor(targetId);
                }
              : undefined
          }
          onDelete={
            canManageClubStories
              ? (slide) => {
                  if (slide.storyId && clubHighlights.some((h) => h.id === slide.storyId)) {
                    persistHighlights(clubHighlights.filter((h) => h.id !== slide.storyId));
                    setStoryViewerState(null);
                    showIslandToast('Story à la une retirée ✓');
                  }
                }
              : undefined
          }
        />
      ) : null}

      {canManageClubStories && editingHighlightId
        ? (() => {
            const hl = clubHighlights.find((h) => h.id === editingHighlightId);
            if (!hl) return null;
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Gestion et vues de la story à la une ${hl.title}`}
                onClick={() => setEditingHighlightId(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 3200,
                  background: 'rgba(12, 22, 18, 0.56)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 380,
                    maxHeight: '82vh',
                    overflowY: 'auto',
                    borderRadius: 24,
                    padding: 16,
                    background: 'rgba(247, 249, 246, 0.96)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    color: '#172b24',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <b style={{ fontSize: 15, display: 'block' }}>Story à la une · {hl.title}</b>
                      <small style={{ fontSize: 11.5, color: '#56665d' }}>
                        Accès réservé aux membres habilités du club
                      </small>
                    </div>
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
                      onClick={() => setEditingHighlightId(null)}
                    >
                      Fermer
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 12,
                      borderRadius: 16,
                      background: 'rgba(255, 255, 255, 0.82)',
                    }}
                  >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <span>Titre de la story à la une</span>
                      <input
                        type="text"
                        className="club-glass-input"
                        value={highlightTitleDraft}
                        maxLength={24}
                        onChange={(e) => setHighlightTitleDraft(e.target.value)}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <span>Image de couverture (URL)</span>
                      <input
                        type="text"
                        className="club-glass-input"
                        value={highlightCoverDraft}
                        onChange={(e) => setHighlightCoverDraft(e.target.value)}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <span>Légende de la story</span>
                      <input
                        type="text"
                        className="club-glass-input"
                        value={highlightCaptionDraft}
                        onChange={(e) => setHighlightCaptionDraft(e.target.value)}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          const cleanTitle = highlightTitleDraft.trim() || hl.title;
                          const cleanCover = highlightCoverDraft.trim() || hl.coverUrl;
                          const next = clubHighlights.map((item) =>
                            item.id === hl.id
                              ? {
                                  ...item,
                                  title: cleanTitle,
                                  coverUrl: cleanCover,
                                  slides: [
                                    {
                                      id: item.slides[0]?.id || `s-${Date.now()}`,
                                      image: cleanCover,
                                      caption: highlightCaptionDraft.trim() || item.slides[0]?.caption,
                                    },
                                    ...item.slides.slice(1),
                                  ],
                                }
                              : item,
                          );
                          persistHighlights(next);
                          setEditingHighlightId(null);
                          showIslandToast(`Story « ${cleanTitle} » mise à jour ✓`);
                        }}
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        className="lkdv-carnet-btn-soft"
                        style={{ color: '#a8443a' }}
                        onClick={() => {
                          persistHighlights(clubHighlights.filter((item) => item.id !== hl.id));
                          setEditingHighlightId(null);
                          showIslandToast('Story à la une supprimée');
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 12,
                      borderRadius: 16,
                      background: 'rgba(255, 255, 255, 0.82)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <b style={{ fontSize: 13 }}>Vues de la story ({hl.viewsCount})</b>
                      <span className="lkdv-carnet-chip-soft">{hl.viewers.length} membres</span>
                    </div>
                    {hl.viewers.length === 0 ? (
                      <small style={{ color: '#56665d' }}>Aucune vue enregistrée pour le moment.</small>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {hl.viewers.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '6px 8px',
                              borderRadius: 12,
                              background: 'rgba(23, 64, 44, 0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              {v.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={v.avatarUrl}
                                  alt=""
                                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: '#17402c',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: 'grid',
                                    placeItems: 'center',
                                  }}
                                >
                                  {v.name.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <b style={{ fontSize: 12.5, display: 'block' }}>{v.name}</b>
                                <small style={{ fontSize: 10.5, color: '#56665d' }}>
                                  @{v.handle}{v.role ? ` · ${v.role}` : ''}
                                </small>
                              </div>
                            </div>
                            <small style={{ fontSize: 10.5, color: '#56665d', flexShrink: 0 }}>{v.viewedAt}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        : null}

      <ClubRuntimeOverlays
        overlay={runtimeOverlay}
        onClose={() => setRuntimeOverlay(null)}
        activeClub={activeClub}
        clubs={clubsDirectory}
        members={clubMembers}
        outings={clubOutings}
        vaultGear={vaultGear}
        standardKits={standardKits}
        challenges={challenges}
        posts={clubPosts}
        currentUserId={user?.id ?? null}
        onSelectClub={handleSelectClub}
        onToggleJoinClub={(id) => void handleToggleJoinClub(id)}
        onToggleRsvpOuting={handleToggleOutingRsvp}
        onCreateGroupFromOuting={handleCreateGroupFromOuting}
        onOpenClubDrawer={(t, s = 0, extras) => {
          pendingDrawerIntentRef.current = { tab: t, subTab: s, ...extras };
          triggerAct('openClubDrawer', `${t}:${Math.min(3, s)}`);
        }}
        onOpenCreateClub={() => {
          setCommunityCreateKind('club');
          setCommunityCreatePrefill(null);
          setCommunityCreateOpen(true);
        }}
        onFlyToCoords={(lat, lng, label) => flyMapToCoords([lng, lat], label)}
        onToast={handleToast}
      />
      <ClubIsland toast={islandToast} onDismiss={() => setIslandToast(null)} />
    </div>
  );
}

export default ClubLiquidGlassV8;
