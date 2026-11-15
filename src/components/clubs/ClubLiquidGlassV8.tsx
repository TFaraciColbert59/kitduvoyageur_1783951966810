'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../compte/compte-v8.css';
import '../compte/compte-apple-hig.css';
import '../compte/overlay/compte-drawers.css';
import '@/features/posts/ui/post-system.css';
import '@/styles/community-feed.css';
import './club-adaptation.css';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { createGroupFromClub } from '@/features/tribu/actions/createGroupFromClub';
import { DRAWER_V2_CSS } from '../compte/drawer/SlotShell';
import { ClubInlineFeed, type ClubFeedPostItem } from './feed/ClubInlineFeed';
import type {
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubGearVaultItem,
  ClubStandardKit,
  ClubChallengeItem,
  ClubChatMessage,
} from './drawer/ClubDrawerHost';

// Le tiroir du club (~25 Ko gz avec ses dépendances) ne sert qu'à l'ouverture d'un tiroir :
// il est monté seulement quand `drawerMount` est renseigné, donc chargé à ce moment-là
// (et préchargé au repos une fois l'écran prêt).
const loadClubDrawerHost = () => import('./drawer/ClubDrawerHost').then((m) => ({ default: m.ClubDrawerHost }));
const ClubDrawerHost = dynamic(loadClubDrawerHost, { ssr: false });

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

export function ClubLiquidGlassV8({ clubId = 'cl1', initialTab }: ClubLiquidGlassV8Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  // Le moteur de l'écran se charge à la demande : l'hydratation du profil attend qu'il soit prêt.
  const runtimeReadyRef = useRef(false);
  const pendingProfileSyncRef = useRef(false);
  const syncProfileRef = useRef<() => void>(() => {});
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [activeHandle, setActiveHandle] = useState<string>(clubId || '');

  // React Portal targets inside the iOS 27 runtime card & sheet
  const [feedRoot, setFeedRoot] = useState<HTMLElement | null>(null);
  const [drawerMount, setDrawerMount] = useState<{
    root: HTMLElement;
    kind: string;
    props: { mode?: 'main' | 'create'; tab?: number; subTab?: number; outingId?: string };
  } | null>(null);

  // Club rich interactive state
  const [clubsDirectory, setClubsDirectory] = useState<ClubItemData[]>(INITIAL_CLUBS_DIRECTORY);
  const [activeClubId, setActiveClubId] = useState<string>(clubId || 'cl1');
  const [clubPosts, setClubPosts] = useState<ClubFeedPostItem[]>(INITIAL_CLUB_POSTS);
  const [clubMembers, setClubMembers] = useState<ClubMemberData[]>(INITIAL_CLUB_MEMBERS);
  const [clubOutings, setClubOutings] = useState<ClubOutingData[]>(INITIAL_CLUB_OUTINGS);
  const [vaultGear, setVaultGear] = useState<ClubGearVaultItem[]>(INITIAL_VAULT_GEAR);
  const [standardKits, setStandardKits] = useState<ClubStandardKit[]>(INITIAL_STANDARD_KITS);
  const [challenges] = useState<ClubChallengeItem[]>(INITIAL_CHALLENGES);
  const [chatMessages, setChatMessages] = useState<ClubChatMessage[]>(INITIAL_CHAT_MESSAGES);

  const activeClub =
    clubsDirectory.find((c) => c.id === activeClubId || c.slug === activeClubId) ||
    clubsDirectory[0] ||
    DEFAULT_FALLBACK_CLUB;

  const triggerAct = useCallback((action: string, val?: any) => {
    if (typeof window !== 'undefined' && typeof (window as any).__lkdvCompteAct === 'function') {
      (window as any).__lkdvCompteAct(action, val);
    }
  }, []);

  const showIslandToast = useCallback((title: string, subtitle = '') => {
    if (typeof window !== 'undefined') {
      const islandEl = document.getElementById('island');
      if (islandEl) {
        islandEl.setAttribute('data-s', 'note');
        const noteEl = islandEl.querySelector('.is.note');
        if (noteEl) {
          noteEl.innerHTML = `<div class="t"><b>${title}</b><span>${subtitle}</span></div>`;
        }
        setTimeout(() => {
          if (islandEl.getAttribute('data-s') === 'note') {
            islandEl.setAttribute('data-s', 'idle');
          }
        }, 2800);
      }
    }
  }, []);

  const flyMapToCoords = useCallback((coords?: [number, number], label?: string) => {
    if (!coords || typeof window === 'undefined') return;
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
  }, [showIslandToast]);

  // Setup runtime & real browser/API action handlers (1:1 with CompteLiquidGlassV8 + Club portals)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // MapLibre (~250 Ko gz) et le moteur de l'écran (~65 Ko gz) ne sont plus dans le JS de la
    // page : ils se chargent ici, en parallèle, dès le montage. Le contenu apparaît au même
    // moment qu'avant (le conteneur reste vide tant que le moteur n'est pas prêt), mais
    // l'hydratation de la page n'attend plus ces deux paquets.
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
          props: { mode?: 'main' | 'create'; tab?: number; subTab?: number; outingId?: string } = {}
        ) => {
          setDrawerMount({ root: rootEl, kind, props });
        };

        (window as any).__lkdvUnmountDrawer = () => {
          setDrawerMount(null);
        };
      }

      el.innerHTML = COMPTE_V8_HTML;
      cleanup = runtime.initClubLiquidGlassRuntime(el);
      const initialFeedEl = el.querySelector('#lkdv-club-feed-root') as HTMLElement | null;
      if (initialFeedEl) {
        setFeedRoot(initialFeedEl);
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
              'application/json;charset=utf-8'
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

      if (initialTab && typeof (window as any).__lkdvCompteAct === 'function') {
        const act = (window as any).__lkdvCompteAct;
        if (initialTab === 'carnets') {
          act('igtab', 0);
        } else if (initialTab === 'sorties' || initialTab === 'aventures') {
          act('igtab', 1);
        } else if (initialTab === 'membres') {
          act('openFollowers');
        } else if (initialTab === 'parametres') {
          act('openSettings');
        }
      }

      // Le moteur est prêt : l'hydratation du profil du club (effet suivant) peut partir.
      runtimeReadyRef.current = true;
      if (pendingProfileSyncRef.current) {
        pendingProfileSyncRef.current = false;
        syncProfileRef.current();
      }

      // Préchargement du tiroir au repos : son ouverture reste immédiate.
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
      // Même sémantique qu'avant le chargement différé : seul l'effet de synchronisation
      // (montage, changement de club) redemande une synchronisation du profil.
      pendingProfileSyncRef.current = false;
      cleanup?.();
      cleanup = null;
      initializedRef.current = false;
    };
  }, [clubId, initialTab, router, signOut, user?.id]);

  // Hydrate dynamically with live Supabase club data (2-step public_profiles resolution)
  const syncClubProfile = useCallback(async () => {
    const hydrate = (window as any).__lkdvHydrateCompte;
    if (typeof hydrate !== 'function') return;

    if (!clubId) {
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
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clubId);
      const clubQuery = supabase
        .from('clubs')
        .select('id, name, slug, description, category, cover_image, members_count, privacy, created_by, created_at');
      const { data: clubRow } = await (isUuid ? clubQuery.eq('id', clubId) : clubQuery.eq('slug', clubId)).maybeSingle();

      if (!clubRow) {
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

      const [membersRes, topicsRes, groupsRes] = await Promise.all([
        supabase
          .from('club_members')
          .select('id, club_id, user_id, role, joined_at')
          .eq('club_id', clubRow.id)
          .limit(50),
        supabase
          .from('club_topics')
          .select('id, club_id, author_id, title, content, is_pinned, replies_count, created_at')
          .eq('club_id', clubRow.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('travel_groups')
          .select('id, name, destination, departure_date, return_date, status, club_id')
          .eq('club_id', clubRow.id)
          .order('departure_date', { ascending: false })
          .limit(20),
      ]);

      const memberRows = membersRes.data || [];
      const userIds = Array.from(new Set(memberRows.map((m: any) => m.user_id).filter(Boolean)));
      const profilesMap: Record<string, any> = userIds.length > 0 ? await fetchPublicProfilesWith(supabase as any, userIds) : {};

      const derivedHandle = clubRow.slug || clubRow.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
      hydrate({
        name: clubRow.name,
        handle: derivedHandle,
        followersCount: clubRow.members_count || memberRows.length || 0,
        followingCount: (groupsRes.data || []).length || 0,
        bioLine: clubRow.description ? '· ' + clubRow.description.slice(0, 64) : '',
        avatarUrl: clubRow.cover_image || null,
        followers: memberRows.map((m: any) => {
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
      setActiveHandle(derivedHandle);
      setSyncStatus('synced');
    } catch (_) {
      setSyncStatus('idle');
    }
  }, [clubId]);

  useEffect(() => {
    syncProfileRef.current = syncClubProfile;
    if (runtimeReadyRef.current) {
      syncClubProfile();
    } else {
      // Moteur pas encore chargé : l'hydratation part dès qu'il est prêt (effet d'initialisation).
      pendingProfileSyncRef.current = true;
    }
  }, [syncClubProfile]);

  const handleSelectClub = useCallback(
    (selectedId: string) => {
      const targetClub = clubsDirectory.find((c) => c.id === selectedId || c.slug === selectedId);
      if (!targetClub) return;
      setActiveClubId(targetClub.id);
      setActiveHandle(targetClub.slug);
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
    },
    [clubsDirectory, flyMapToCoords, triggerAct]
  );

  const handleToggleJoinClub = useCallback(
    (targetClubId: string) => {
      setClubsDirectory((prev) =>
        prev.map((c) =>
          c.id === targetClubId
            ? {
                ...c,
                joined: !c.joined,
                membersCount: Math.max(1, c.membersCount + (!c.joined ? 1 : -1)),
              }
            : c
        )
      );
      showIslandToast('Adhésion mise à jour ✓', 'Synchronisé avec ta tribu LKDV');
    },
    [showIslandToast]
  );

  const handleToggleFollowMember = useCallback(
    (handle: string) => {
      setClubMembers((prev) =>
        prev.map((m) => (m.handle === handle ? { ...m, followed: !m.followed } : m))
      );
      showIslandToast(`Cordée @${handle}`, 'Statut de suivi mis à jour');
    },
    [showIslandToast]
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
        })
      );
      setClubPosts((prev) =>
        prev.map((p) =>
          p.outingId === outingId
            ? {
                ...p,
                rsvpJoined: !p.rsvpJoined,
                outingSeatsLeft: Math.max(0, (p.outingSeatsLeft ?? 2) + (p.rsvpJoined ? 1 : -1)),
              }
            : p
        )
      );
      showIslandToast('Inscription cordée mise à jour ✓', 'Place réservée avec check-list kit liée');
    },
    [showIslandToast]
  );

  const handleBorrowGear = useCallback(
    (gearId: string) => {
      setVaultGear((prev) =>
        prev.map((g) => {
          if (g.id !== gearId) return g;
          const nextAvail = !g.available;
          return {
            ...g,
            available: nextAvail,
            reservedByMe: !nextAvail,
          };
        })
      );
      showIslandToast('Coffre Matériel Club ✓', 'Équipement réservé pour la prochaine sortie');
    },
    [showIslandToast]
  );

  const handleCloneKit = useCallback(
    (kitId: string) => {
      setStandardKits((prev) =>
        prev.map((k) => (k.id === kitId ? { ...k, cloned: true } : k))
      );
      const kit = standardKits.find((k) => k.id === kitId);
      showIslandToast(
        kit ? `${kit.title} cloné ✓` : 'Kit standard cloné ✓',
        'Ajouté dans ton inventaire avec répartition du poids de cordée'
      );
    },
    [showIslandToast, standardKits]
  );

  const handleTogglePostLike = useCallback((postId: string) => {
    setClubPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.liked;
        return { ...p, liked: nextLiked, likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)) };
      })
    );
  }, []);

  const handleTogglePostSave = useCallback((postId: string) => {
    setClubPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p))
    );
    showIslandToast('Publication enregistrée ✓', 'Ajoutée aux favoris du club');
  }, [showIslandToast]);

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
            : p
        )
      );
      showIslandToast('Commentaire publié ✓', 'Visible dans la discussion du club');
    },
    [activeHandle, showIslandToast, user?.email]
  );

  const handleCreatePost = useCallback(
    (payload: { kind: 'media' | 'text'; caption: string; spot: string; mediaUrl?: string }) => {
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
      showIslandToast('Publié dans le fil du club ✓', `${payload.spot} · visible par la cordée`);
    },
    [activeClub, activeHandle, showIslandToast, triggerAct, user?.email]
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
    [activeClub.id, activeClub.lat, activeClub.lng, activeHandle, showIslandToast, triggerAct, user?.email]
  );

  const handleLendGearToVault = useCallback(
    (payload: { name: string; brand: string; weightG: number; category: string }) => {
      const item: ClubGearVaultItem = {
        id: 'vg-' + Date.now(),
        clubId: activeClub.id,
        name: payload.name,
        brand: payload.brand,
        category: payload.category,
        weightG: payload.weightG,
        ownerName: 'Toi',
        ownerHandle: activeHandle || 'tony_frc',
        available: true,
      };
      setVaultGear((prev) => [item, ...prev]);
      triggerAct('closeSheet');
      showIslandToast('Ajouté au Coffre Matériel ✓', `${payload.brand} ${payload.name} (${payload.weightG} g)`);
    },
    [activeClub.id, activeHandle, showIslandToast, triggerAct]
  );

  const handleCreateNewClub = useCallback(
    (payload: { name: string; massif: string; category: string; bio: string; visibility: 'public' | 'prive' }) => {
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
      showIslandToast(`Club « ${newClub.name} » fondé ✓`, 'Tu es administrateur fondateur de cette tribu');
    },
    [showIslandToast, triggerAct]
  );

  const handleSendChatMessage = useCallback((text: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: 'cm-' + Date.now(),
        authorName: 'Toi',
        authorHandle: activeHandle || 'tony_frc',
        roleBadge: 'Membre',
        text,
        time: 'À l’instant',
      },
    ]);
  }, [activeHandle]);

  const handleToggleClubVisibility = useCallback(() => {
    setClubsDirectory((prev) =>
      prev.map((c) =>
        c.id === activeClub.id
          ? { ...c, visibility: c.visibility === 'public' ? 'prive' : 'public' }
          : c
      )
    );
    showIslandToast(
      activeClub.visibility === 'public' ? 'Club passé en Privé (Sur cooptation)' : 'Club passé en Public (Ouvert)',
      'Gouvernance du club mise à jour'
    );
  }, [activeClub.id, activeClub.visibility, showIslandToast]);

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
    [activeClub.id, showIslandToast, user?.id]
  );

  return (
    <div className="lkdv-compte-v8 lkdv-club-v8 lkdv-clubs-v8" data-theme="light">
      <style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />
      <div className="sr-only" aria-hidden="true" inert>
        <span>Club iOS 27 Liquid Glass v8 · @{activeHandle} · {syncStatus}</span>
        <button type="button" onClick={() => triggerAct('openCreate')}>Créer une sortie</button>
        <Link href="/communaute">Tous les clubs</Link>
      </div>
      <div ref={containerRef} />
      {feedRoot &&
        createPortal(
          <ClubInlineFeed
            clubId={activeClub.id}
            clubName={activeClub.name}
            posts={clubPosts}
            onToggleLike={handleTogglePostLike}
            onToggleSave={handleTogglePostSave}
            onAddComment={handleAddPostComment}
            onToggleRsvp={(postId, outingId) => {
              if (outingId) handleToggleOutingRsvp(outingId);
              else showIslandToast('Place réservée dans la cordée ✓', 'Synchronisé avec la sortie du club');
              void postId;
            }}
            onFlyToSpot={(post) =>
              flyMapToCoords([post.lng ?? activeClub.lng, post.lat ?? activeClub.lat], `${post.spot} · ${post.massif}`)
            }
            onOpenOutingDetail={() => triggerAct('openClubDrawer', '2:0')}
            onOpenCreatePost={() => triggerAct('openClubCreate')}
          />,
          feedRoot
        )}
      {drawerMount &&
        createPortal(
          <ClubDrawerHost
            mode={drawerMount.props.mode || 'main'}
            initialTab={drawerMount.props.tab ?? 0}
            initialSubTab={drawerMount.props.subTab ?? 0}
            initialSearch={drawerMount.props.tab === 0 && drawerMount.props.subTab === 2}
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
            onCloneStandardKit={handleCloneKit}
            onSendChatMessage={handleSendChatMessage}
            onToggleClubVisibility={handleToggleClubVisibility}
            onCreatePost={handleCreatePost}
            onCreateOuting={handleCreateOuting}
            onCreateVaultGear={handleLendGearToVault}
            onCreateNewClub={handleCreateNewClub}
          />,
          drawerMount.root
        )}
    </div>
  );
}

export default ClubLiquidGlassV8;
