'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  Backpack,
  Calendar,
  CalendarPlus,
  Check,
  CloudSun,
  Compass,
  Download,
  Globe,
  Layers,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Mountain,
  Package,
  PlusCircle,
  QrCode,
  Route,
  Scale,
  Search,
  Shield,
  Sliders,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  DrawerShell,
  type DrawerSecondaryItem,
  type DrawerTab,
} from '@/components/compte/drawer/shell/DrawerShell';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';

export interface ClubItemData {
  id: string;
  slug: string;
  name: string;
  massif: string;
  category: string;
  level: string;
  membersCount: number;
  outingsCount: number;
  totalKm: number;
  totalDplus: number;
  joined: boolean;
  role: string;
  visibility: 'public' | 'prive';
  bio: string;
  charter: string;
  nextOutingTitle: string;
  nextOutingDate: string;
  weatherIso: string;
  weatherWind: string;
  weatherTrail: string;
  lat: number;
  lng: number;
  coverUrl?: string;
}

export interface ClubMemberData {
  id: string;
  name: string;
  handle: string;
  role: 'Fondateur' | 'Guide & Sécurité' | 'Encadrant' | 'Membre actif' | 'Nouveau';
  massif: string;
  skills: string[];
  availableWeekend?: boolean;
  seekingObjective?: string;
  followed?: boolean;
  isNew7d?: boolean;
  avatarUrl?: string;
}

export interface ClubOutingData {
  id: string;
  clubId: string;
  title: string;
  date: string;
  massif: string;
  km: number;
  dplus: number;
  maxAlt: number;
  status: 'upcoming' | 'live' | 'completed';
  leaderName: string;
  leaderHandle: string;
  participantsCount: number;
  maxParticipants: number;
  rsvpJoined: boolean;
  carpoolCity: string;
  carpoolSeatsLeft: number;
  requiredGear: string[];
  lat: number;
  lng: number;
}

export interface ClubGearVaultItem {
  id: string;
  clubId: string;
  name: string;
  brand: string;
  category: string;
  weightG: number;
  ownerName: string;
  ownerHandle: string;
  available: boolean;
  reservedByMe?: boolean;
}

export interface ClubStandardKit {
  id: string;
  title: string;
  season: string;
  totalWeightG: number;
  itemsCount: number;
  items: string[];
  cloned?: boolean;
}

export interface ClubChallengeItem {
  id: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  unit: string;
  rewardBadge: string;
}

export interface ClubChatMessage {
  id: string;
  authorName: string;
  authorHandle: string;
  roleBadge?: string;
  text: string;
  time: string;
}

export interface ClubDrawerHostProps {
  mode: 'main' | 'create';
  initialTab?: number;
  initialSubTab?: number;
  initialSearch?: boolean;
  activeClub: ClubItemData;
  clubs: ClubItemData[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  challenges: ClubChallengeItem[];
  chatMessages: ClubChatMessage[];
  posts: ClubFeedPostItem[];
  onSelectClub: (clubId: string) => void;
  onToggleJoinClub: (clubId: string) => void;
  onToggleFollowMember: (handle: string) => void;
  onToggleRsvpOuting: (outingId: string) => void;
  onCreateGroupFromOuting: (outing: ClubOutingData) => void;
  onDownloadGpx: (outing: ClubOutingData) => void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onToggleReserveGear: (gearId: string) => void;
  onCloneStandardKit: (kitId: string) => void;
  onSendChatMessage: (text: string) => void;
  onToggleClubVisibility: () => void;
  onCreatePost: (payload: { kind: 'media' | 'text'; caption: string; spot: string; mediaUrl?: string }) => void;
  onCreateOuting: (payload: { title: string; date: string; massif: string; km: number; dplus: number; carpoolCity: string }) => void;
  onCreateVaultGear: (payload: { name: string; brand: string; weightG: number; category: string }) => void;
  onCreateNewClub: (payload: { name: string; massif: string; category: string; bio: string; visibility: 'public' | 'prive' }) => void;
}

export function ClubDrawerHost({
  mode,
  initialTab = 0,
  initialSubTab = 0,
  initialSearch = false,
  activeClub,
  clubs,
  members,
  outings,
  vaultGear,
  standardKits,
  challenges,
  chatMessages,
  posts,
  onSelectClub,
  onToggleJoinClub,
  onToggleFollowMember,
  onToggleRsvpOuting,
  onCreateGroupFromOuting,
  onDownloadGpx,
  onFlyToCoords,
  onToggleReserveGear,
  onCloneStandardKit,
  onSendChatMessage,
  onToggleClubVisibility,
  onCreatePost,
  onCreateOuting,
  onCreateVaultGear,
  onCreateNewClub,
}: ClubDrawerHostProps) {
  const [tab, setTab] = useState<number>(initialSearch ? 0 : initialTab);
  const [subTabs, setSubTabs] = useState<Record<number, number>>({
    0: initialSearch ? 2 : initialSubTab,
    1: initialTab === 1 ? initialSubTab : 0,
    2: initialTab === 2 ? initialSubTab : 0,
    3: initialTab === 3 ? initialSubTab : 0,
    4: initialTab === 4 ? initialSubTab : 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedMember, setInspectedMember] = useState<ClubMemberData | null>(null);
  const [inspectedOuting, setInspectedOuting] = useState<ClubOutingData | null>(null);
  const [partnerProposed, setPartnerProposed] = useState<Record<string, boolean>>({});
  const [cordeeCarrier, setCordeeCarrier] = useState<Record<string, string>>({
    tente: 'Тоny (@tony_frc)',
    rechaud: 'Léa (@lea.fontaine)',
    corde: 'Marc (@marc_alpi)',
    secours: 'Clara (@clara.bivouac)',
  });
  const [chatDraft, setChatDraft] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Create form states
  const [postCaption, setPostCaption] = useState('');
  const [postSpot, setPostSpot] = useState(activeClub.massif);
  const [postKind, setPostKind] = useState<'media' | 'text'>('text');
  const [postMediaUrl, setPostMediaUrl] = useState('');

  const [outingTitle, setOutingTitle] = useState('');
  const [outingDate, setOutingDate] = useState('Samedi · 06h30');
  const [outingMassif, setOutingMassif] = useState(activeClub.massif);
  const [outingKm, setOutingKm] = useState('22');
  const [outingDplus, setOutingDplus] = useState('1350');
  const [outingCity, setOutingCity] = useState('Grenoble / Annecy');

  const [gearName, setGearName] = useState('');
  const [gearBrand, setGearBrand] = useState('Petzl / MSR');
  const [gearWeight, setGearWeight] = useState('420');
  const [gearCat, setGearCat] = useState('Bivouac & Sécurité');

  const [newClubName, setNewClubName] = useState('');
  const [newClubMassif, setNewClubMassif] = useState('Mont-Blanc');
  const [newClubCat, setNewClubCat] = useState('Alpinisme & Bivouac');
  const [newClubBio, setNewClubBio] = useState('');
  const [newClubVis, setNewClubVis] = useState<'public' | 'prive'>('public');

  const currentSub = subTabs[tab] ?? 0;
  const setCurrentSub = (idx: number) => {
    setSubTabs((prev) => ({ ...prev, [tab]: idx }));
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { clubs: clubs.slice(0, 3), outings: outings.slice(0, 2), members: members.slice(0, 2), posts: posts.slice(0, 2) };
    return {
      clubs: clubs.filter((c) => `${c.name} ${c.massif} ${c.category}`.toLowerCase().includes(q)),
      outings: outings.filter((o) => `${o.title} ${o.massif} ${o.carpoolCity}`.toLowerCase().includes(q)),
      members: members.filter((m) => `${m.name} ${m.handle} ${m.massif} ${m.skills.join(' ')}`.toLowerCase().includes(q)),
      posts: posts.filter((p) => `${p.caption} ${p.spot} ${p.authorName}`.toLowerCase().includes(q)),
    };
  }, [clubs, members, outings, posts, searchQuery]);

  if (mode === 'create') {
    const createTabs: DrawerTab[] = [
      {
        id: 'create-post',
        label: 'Publier dans le club',
        icon: <MessageSquarePlus size={18} aria-hidden="true" />,
        render: () => (
          <form
            className="club-drawer-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!postCaption.trim()) return;
              onCreatePost({
                kind: postKind,
                caption: postCaption.trim(),
                spot: postSpot.trim() || activeClub.massif,
                mediaUrl: postKind === 'media' ? (postMediaUrl.trim() || '/images/ridge-line.jpg') : undefined,
              });
              setPostCaption('');
            }}
          >
            <div className="club-drawer-sec-head">
              <b>Publier dans {activeClub.name}</b>
              <span>Apparaît immédiatement dans le fil d’actu de la carte</span>
            </div>
            <div className="club-form-pills">
              <button
                type="button"
                className={`reseau-btn ${postKind === 'text' ? 'primary' : 'active'}`}
                onClick={() => setPostKind('text')}
              >
                Annonce / Covoit / Question
              </button>
              <button
                type="button"
                className={`reseau-btn ${postKind === 'media' ? 'primary' : 'active'}`}
                onClick={() => setPostKind('media')}
              >
                Photo Terrain / Trace 1:1
              </button>
            </div>
            <label className="club-field-label">
              <span>Spot ou sommet concerné</span>
              <input
                type="text"
                className="club-glass-input"
                value={postSpot}
                onChange={(e) => setPostSpot(e.target.value)}
                placeholder="Ex : Col du Lautaret, Aiguille du Midi…"
              />
            </label>
            {postKind === 'media' ? (
              <label className="club-field-label">
                <span>Image du spot (URL ou preset terrain)</span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={postMediaUrl}
                  onChange={(e) => setPostMediaUrl(e.target.value)}
                  placeholder="/images/mountain-vista.jpg"
                />
              </label>
            ) : null}
            <label className="club-field-label">
              <span>Message à la tribu</span>
              <textarea
                rows={3}
                className="club-glass-textarea"
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                placeholder="Ex : Départ samedi 06h00 depuis Grenoble, il me reste 2 places dans le van…"
                required
              />
            </label>
            <button type="submit" className="reseau-btn primary club-submit-pill">
              Publier dans le fil du club
            </button>
          </form>
        ),
      },
      {
        id: 'create-outing',
        label: 'Proposer une sortie',
        icon: <CalendarPlus size={18} aria-hidden="true" />,
        render: () => (
          <form
            className="club-drawer-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!outingTitle.trim()) return;
              onCreateOuting({
                title: outingTitle.trim(),
                date: outingDate.trim() || 'Samedi · 07h00',
                massif: outingMassif.trim() || activeClub.massif,
                km: Number(outingKm) || 18,
                dplus: Number(outingDplus) || 1200,
                carpoolCity: outingCity.trim() || 'Camp de base',
              });
              setOutingTitle('');
            }}
          >
            <div className="club-drawer-sec-head">
              <b>Proposer une sortie de cordée</b>
              <span>Ajoute la trace sur la carte 3D et ouvre le covoiturage</span>
            </div>
            <label className="club-field-label">
              <span>Objectif / Sommet</span>
              <input
                type="text"
                className="club-glass-input"
                value={outingTitle}
                onChange={(e) => setOutingTitle(e.target.value)}
                placeholder="Ex : Traversée des Arêtes & Bivouac Lacs"
                required
              />
            </label>
            <div className="club-form-grid-2">
              <label className="club-field-label">
                <span>Créneau</span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={outingDate}
                  onChange={(e) => setOutingDate(e.target.value)}
                />
              </label>
              <label className="club-field-label">
                <span>Massif</span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={outingMassif}
                  onChange={(e) => setOutingMassif(e.target.value)}
                />
              </label>
            </div>
            <div className="club-form-grid-2">
              <label className="club-field-label">
                <span>Distance (km)</span>
                <input
                  type="number"
                  className="club-glass-input"
                  value={outingKm}
                  onChange={(e) => setOutingKm(e.target.value)}
                />
              </label>
              <label className="club-field-label">
                <span>Dénivelé D+ (m)</span>
                <input
                  type="number"
                  className="club-glass-input"
                  value={outingDplus}
                  onChange={(e) => setOutingDplus(e.target.value)}
                />
              </label>
            </div>
            <label className="club-field-label">
              <span>Point de RDV / Covoiturage</span>
              <input
                type="text"
                className="club-glass-input"
                value={outingCity}
                onChange={(e) => setOutingCity(e.target.value)}
              />
            </label>
            <button type="submit" className="reseau-btn primary club-submit-pill">
              Lancer les inscriptions
            </button>
          </form>
        ),
      },
      {
        id: 'create-gear',
        label: 'Mettre un équipement au coffre commun',
        icon: <Backpack size={18} aria-hidden="true" />,
        render: () => (
          <form
            className="club-drawer-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!gearName.trim()) return;
              onCreateVaultGear({
                name: gearName.trim(),
                brand: gearBrand.trim() || 'LKDV',
                weightG: Number(gearWeight) || 350,
                category: gearCat.trim() || 'Matériel',
              });
              setGearName('');
            }}
          >
            <div className="club-drawer-sec-head">
              <b>Mutualiser un équipement dans le coffre</b>
              <span>Prêtable aux membres vérifiés de {activeClub.name}</span>
            </div>
            <label className="club-field-label">
              <span>Pièce d’équipement</span>
              <input
                type="text"
                className="club-glass-input"
                value={gearName}
                onChange={(e) => setGearName(e.target.value)}
                placeholder="Ex : Tente MSR Access 2P, DVA Barryvox…"
                required
              />
            </label>
            <div className="club-form-grid-2">
              <label className="club-field-label">
                <span>Marque</span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={gearBrand}
                  onChange={(e) => setGearBrand(e.target.value)}
                />
              </label>
              <label className="club-field-label">
                <span>Poids (g)</span>
                <input
                  type="number"
                  className="club-glass-input"
                  value={gearWeight}
                  onChange={(e) => setGearWeight(e.target.value)}
                />
              </label>
            </div>
            <label className="club-field-label">
              <span>Catégorie</span>
              <input
                type="text"
                className="club-glass-input"
                value={gearCat}
                onChange={(e) => setGearCat(e.target.value)}
              />
            </label>
            <button type="submit" className="reseau-btn primary club-submit-pill">
              Ajouter au coffre de la tribu
            </button>
          </form>
        ),
      },
      {
        id: 'create-club',
        label: 'Fonder un nouveau club',
        icon: <PlusCircle size={18} aria-hidden="true" />,
        render: () => (
          <form
            className="club-drawer-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newClubName.trim()) return;
              onCreateNewClub({
                name: newClubName.trim(),
                massif: newClubMassif.trim() || 'Alpes',
                category: newClubCat.trim() || 'Trek & Bivouac',
                bio: newClubBio.trim() || 'Tribu outdoor locale connectée aux traces réelles.',
                visibility: newClubVis,
              });
              setNewClubName('');
            }}
          >
            <div className="club-drawer-sec-head">
              <b>Fonder une nouvelle tribu LKDV</b>
              <span>Crée le territoire 3D, le coffre matériel et le fil dédié</span>
            </div>
            <label className="club-field-label">
              <span>Nom du club</span>
              <input
                type="text"
                className="club-glass-input"
                value={newClubName}
                onChange={(e) => setNewClubName(e.target.value)}
                placeholder="Ex : Cordée Écrins & Bivouac Hivernal"
                required
              />
            </label>
            <div className="club-form-grid-2">
              <label className="club-field-label">
                <span>Massif d’ancrage</span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={newClubMassif}
                  onChange={(e) => setNewClubMassif(e.target.value)}
                />
              </label>
              <label className="club-field-label">
                <span>Discipline</span>
                <input
                  type="text"
                  className="club-glass-input"
                  value={newClubCat}
                  onChange={(e) => setNewClubCat(e.target.value)}
                />
              </label>
            </div>
            <label className="club-field-label">
              <span>Manifeste (2 lignes)</span>
              <input
                type="text"
                className="club-glass-input"
                value={newClubBio}
                onChange={(e) => setNewClubBio(e.target.value)}
                placeholder="Sorties engagées, partage de traces GPX et entraide matériel."
              />
            </label>
            <div className="club-form-pills">
              <button
                type="button"
                className={`reseau-btn ${newClubVis === 'public' ? 'primary' : 'active'}`}
                onClick={() => setNewClubVis('public')}
              >
                Club Public (Ouvert)
              </button>
              <button
                type="button"
                className={`reseau-btn ${newClubVis === 'prive' ? 'primary' : 'active'}`}
                onClick={() => setNewClubVis('prive')}
              >
                Sur Cooptation (Privé)
              </button>
            </div>
            <button type="submit" className="reseau-btn primary club-submit-pill">
              Fonder le club et ouvrir sa carte
            </button>
          </form>
        ),
      },
    ];

    return (
      <DrawerShell
        tabs={createTabs}
        activeIndex={tab}
        onIndexChange={setTab}
        state="ready"
      />
    );
  }

  // Secondary sub-drawer items (30px floating icon-only pill at bottom-right) per main tab
  const secondaryByTab: Record<number, DrawerSecondaryItem[]> = {
    0: [
      { id: 'my-clubs', label: 'Mes tribus rejointes', icon: <Users size={14} aria-hidden="true" /> },
      { id: 'discover-clubs', label: 'Découvrir tous les clubs', icon: <Globe size={14} aria-hidden="true" /> },
      { id: 'search-all', label: 'Recherche unifiée', icon: <Search size={14} aria-hidden="true" /> },
    ],
    1: [
      { id: 'members-all', label: 'Tous les membres', icon: <Users size={14} aria-hidden="true" /> },
      { id: 'members-guides', label: 'Encadrants et référents sécurité', icon: <Shield size={14} aria-hidden="true" /> },
      { id: 'members-binomes', label: 'Binômes disponibles ce week-end', icon: <UserCheck size={14} aria-hidden="true" /> },
    ],
    2: [
      { id: 'outings-upcoming', label: 'Prochains départs et covoiturage', icon: <Calendar size={14} aria-hidden="true" /> },
      { id: 'outings-weather', label: 'Météo et conditions massif', icon: <CloudSun size={14} aria-hidden="true" /> },
      { id: 'outings-gpx', label: 'Archives et traces GPX', icon: <Route size={14} aria-hidden="true" /> },
    ],
    3: [
      { id: 'vault-items', label: 'Équipements prêtables du coffre', icon: <Package size={14} aria-hidden="true" /> },
      { id: 'vault-kits', label: 'Kits types du club', icon: <Layers size={14} aria-hidden="true" /> },
      { id: 'vault-weight', label: 'Répartition poids de cordée', icon: <Scale size={14} aria-hidden="true" /> },
    ],
    4: [
      { id: 'tribu-challenges', label: 'Défis collectifs et sommets', icon: <Trophy size={14} aria-hidden="true" /> },
      { id: 'tribu-chat', label: 'Canal live de la tribu', icon: <MessageCircle size={14} aria-hidden="true" /> },
      { id: 'tribu-gov', label: 'Charte, gouvernance et QR Code', icon: <Sliders size={14} aria-hidden="true" /> },
    ],
  };

  const mainTabs: DrawerTab[] = [
    // TAB 0: EXPLORATEUR & SWITCH CLUBS
    {
      id: 'explorer',
      label: 'Explorateur et changement de club',
      icon: <Compass size={18} aria-hidden="true" />,
      render: () => {
        if (currentSub === 2) {
          return (
            <div className="club-drawer-pane-content">
              <div className="club-search-box">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  data-autofocus="true"
                  autoFocus
                  className="club-search-input"
                  placeholder="Chercher un club, une sortie, un membre, un spot…"
                  aria-label="Rechercher dans les clubs et la tribu"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {searchResults.clubs.length > 0 ? (
                <div className="club-drawer-group">
                  <div className="club-drawer-sec-head">
                    <b>Clubs & Tribus</b>
                    <span>{searchResults.clubs.length}</span>
                  </div>
                  {searchResults.clubs.map((c) => (
                    <div key={c.id} className="reseau-user-row club-switch-row">
                      <button
                        type="button"
                        className="club-row-main-btn"
                        onClick={() => onSelectClub(c.id)}
                      >
                        <span className="club-mini-emblem">{c.name.charAt(0)}</span>
                        <span className="reseau-meta">
                          <span className="reseau-name-row">
                            <b>{c.name}</b>
                          </span>
                          <span className="reseau-sub">
                            {c.massif} · {c.membersCount} membres · {c.outingsCount} sorties
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`reseau-btn ${c.id === activeClub.id ? 'active' : 'primary'}`}
                        onClick={() => onSelectClub(c.id)}
                      >
                        {c.id === activeClub.id ? 'Actif ✓' : 'Ouvrir'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {searchResults.outings.length > 0 ? (
                <div className="club-drawer-group">
                  <div className="club-drawer-sec-head">
                    <b>Sorties & Traces GPX</b>
                    <span>{searchResults.outings.length}</span>
                  </div>
                  {searchResults.outings.map((o) => (
                    <div key={o.id} className="li nt club-compact-row">
                      <div>
                        <div className="ttl"><span>{o.title}</span></div>
                        <div className="s2">{o.date} · {o.massif} · {o.km} km · +{o.dplus} m</div>
                      </div>
                      <button
                        type="button"
                        className="reseau-btn primary"
                        onClick={() => {
                          setTab(2);
                          setCurrentSub(0);
                          setInspectedOuting(o);
                        }}
                      >
                        Voir
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {searchResults.members.length > 0 ? (
                <div className="club-drawer-group">
                  <div className="club-drawer-sec-head">
                    <b>Membres de la cordée</b>
                    <span>{searchResults.members.length}</span>
                  </div>
                  {searchResults.members.map((m) => (
                    <div key={m.id} className="reseau-user-row">
                      <div className="reseau-meta">
                        <div className="reseau-name-row">
                          <b>{m.name}</b>
                          <span className="reseau-handle">@{m.handle}</span>
                        </div>
                        <div className="reseau-sub">{m.role} · {m.massif}</div>
                      </div>
                      <button
                        type="button"
                        className="reseau-btn active"
                        onClick={() => {
                          setTab(1);
                          setInspectedMember(m);
                        }}
                      >
                        Fiche
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        const list = currentSub === 0 ? clubs.filter((c) => c.joined || c.id === activeClub.id) : clubs;
        return (
          <div className="club-drawer-pane-content">
            <div className="club-drawer-sec-head">
              <b>{currentSub === 0 ? 'Mes Tribus & Bascule Rapide' : 'Explorer les Clubs par Massif'}</b>
              <span>{list.length} clubs · Tap = bascule carte & relief 3D</span>
            </div>
            <div className="reseau-list">
              {list.map((c) => {
                const isCurrent = c.id === activeClub.id;
                return (
                  <div key={c.id} className="reseau-user-row club-switch-row">
                    <button
                      type="button"
                      className="club-row-main-btn"
                      onClick={() => onSelectClub(c.id)}
                      aria-label={`Basculer sur ${c.name}`}
                    >
                      <span className="club-mini-emblem">
                        {c.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.coverUrl} alt="" loading="lazy" />
                        ) : (
                          c.name.charAt(0)
                        )}
                      </span>
                      <span className="reseau-meta">
                        <span className="reseau-name-row">
                          <b>{c.name}</b>
                          {isCurrent ? <span className="club-comment-badge">Actif</span> : null}
                        </span>
                        <span className="reseau-sub">
                          {c.massif} · {c.membersCount} membres · {c.nextOutingTitle}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`reseau-btn ${c.joined ? 'active' : 'primary'}`}
                      onClick={() => onToggleJoinClub(c.id)}
                    >
                      {c.joined ? 'Membre ✓' : 'Rejoindre'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      },
    },

    // TAB 1: CORDÉE, MEMBRES & RÔLES TERRAIN
    {
      id: 'cordee',
      label: 'Cordée et membres du club',
      icon: <Users size={18} aria-hidden="true" />,
      render: () => {
        if (inspectedMember) {
          return (
            <div className="club-drawer-pane-content">
              <div className="club-drawer-sec-head">
                <b>Aperçu Cordée · {inspectedMember.name}</b>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => setInspectedMember(null)}
                >
                  ← Retour liste
                </button>
              </div>
              <div className="li nt" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div>
                    <b style={{ fontSize: 14, color: 'var(--label)' }}>{inspectedMember.name} (@{inspectedMember.handle})</b>
                    <div className="s2">{inspectedMember.role} · Massif : {inspectedMember.massif}</div>
                  </div>
                  <button
                    type="button"
                    className={`reseau-btn ${inspectedMember.followed ? 'active' : 'primary'}`}
                    onClick={() => onToggleFollowMember(inspectedMember.handle)}
                  >
                    {inspectedMember.followed ? 'Suivi ✓' : 'Suivre'}
                  </button>
                </div>
                <div className="club-skill-tags">
                  {inspectedMember.skills.map((sk) => (
                    <span key={sk} className="club-skill-tag">{sk}</span>
                  ))}
                </div>
                {inspectedMember.seekingObjective ? (
                  <div className="s2" style={{ color: '#17402C', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                    <span>Objectif binôme : {inspectedMember.seekingObjective}</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        }

        const newArrivals = members.filter((m) => m.isNew7d);
        const filteredMembers =
          currentSub === 1
            ? members.filter((m) => m.role === 'Fondateur' || m.role === 'Guide & Sécurité' || m.role === 'Encadrant')
            : currentSub === 2
              ? members.filter((m) => m.availableWeekend)
              : members;

        return (
          <div className="club-drawer-pane-content">
            {currentSub === 0 && newArrivals.length > 0 ? (
              <div className="lkdv-reseau-new" style={{ marginBottom: 8 }}>
                <div className="lkdv-reseau-strip-head">
                  <b>Nouveaux dans la tribu</b>
                  <span>7 derniers jours ({newArrivals.length})</span>
                </div>
                <div className="club-new-pills">
                  {newArrivals.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="club-new-member-pill"
                      onClick={() => setInspectedMember(m)}
                    >
                      <b>{m.name}</b>
                      <span>@{m.handle} · {m.massif}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="club-drawer-sec-head">
              <b>
                {currentSub === 0
                  ? `Membres de ${activeClub.name} (${members.length})`
                  : currentSub === 1
                    ? 'Encadrants, Guides & Référents Sécurité'
                    : 'Binômes de Cordée Disponibles ce Week-End'}
              </b>
              <span>Compétences vérifiées</span>
            </div>

            <div className="reseau-list">
              {filteredMembers.map((m) => {
                const proposed = Boolean(partnerProposed[m.id]);
                return (
                  <div key={m.id} className="reseau-user-row">
                    <button
                      type="button"
                      className="club-row-main-btn"
                      onClick={() => setInspectedMember(m)}
                    >
                      <span className="club-mini-emblem">
                        {m.name.charAt(0)}
                      </span>
                      <span className="reseau-meta">
                        <span className="reseau-name-row">
                          <b>{m.name}</b>
                          <span className="club-comment-badge">{m.role}</span>
                        </span>
                        <span className="reseau-sub">
                          {m.skills.join(' · ')}
                          {m.seekingObjective ? ` · Objectif : ${m.seekingObjective}` : ''}
                        </span>
                      </span>
                    </button>
                    {currentSub === 2 ? (
                      <button
                        type="button"
                        className={`reseau-btn ${proposed ? 'active' : 'primary'}`}
                        onClick={() => setPartnerProposed((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                      >
                        {proposed ? 'Cordée proposée ✓' : 'Binôme'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`reseau-btn ${m.followed ? 'active' : 'primary'}`}
                        onClick={() => onToggleFollowMember(m.handle)}
                      >
                        {m.followed ? 'Suivi ✓' : 'Suivre'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      },
    },

    // TAB 2: SORTIES, CAMPS DE BASE & MÉTÉO MASSIF
    {
      id: 'sorties',
      label: 'Sorties, camps de base et météo massif',
      icon: <Mountain size={18} aria-hidden="true" />,
      render: () => {
        if (inspectedOuting) {
          return (
            <div className="club-drawer-pane-content">
              <div className="club-drawer-sec-head">
                <b>Fiche Sortie & Covoiturage</b>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => setInspectedOuting(null)}
                >
                  ← Toutes les sorties
                </button>
              </div>
              <div className="li nt" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div className="ttl"><b>{inspectedOuting.title}</b></div>
                <div className="s2">
                  📅 {inspectedOuting.date} · 📍 {inspectedOuting.massif} · {inspectedOuting.km} km · +{inspectedOuting.dplus} m D+ · Alt max {inspectedOuting.maxAlt} m
                </div>
                <div className="s2">
                  🧭 Encadrant : <b>{inspectedOuting.leaderName}</b> (@{inspectedOuting.leaderHandle}) · {inspectedOuting.participantsCount}/{inspectedOuting.maxParticipants} inscrits
                </div>
                <div className="s2">
                  🚐 Covoiturage départ <b>{inspectedOuting.carpoolCity}</b> : <b>{inspectedOuting.carpoolSeatsLeft} places restantes</b>
                </div>
                <div className="club-skill-tags">
                  {inspectedOuting.requiredGear.map((g) => (
                    <span key={g} className="club-skill-tag">✓ Kit requis : {g}</span>
                  ))}
                </div>
                <div className="club-form-pills" style={{ width: '100%', marginTop: 4 }}>
                  <button
                    type="button"
                    className={`reseau-btn ${inspectedOuting.rsvpJoined ? 'active' : 'primary'}`}
                    onClick={() => onToggleRsvpOuting(inspectedOuting.id)}
                  >
                    {inspectedOuting.rsvpJoined ? 'Inscrit à la sortie ✓' : 'Participer (1-Tap RSVP)'}
                  </button>
                  <button
                    type="button"
                    className="reseau-btn active"
                    onClick={() => onFlyToCoords(inspectedOuting.lat, inspectedOuting.lng, inspectedOuting.title)}
                  >
                    <MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Trace 3D
                  </button>
                  <button
                    type="button"
                    className="reseau-btn active"
                    onClick={() => onDownloadGpx(inspectedOuting)}
                  >
                    <Download size={13} style={{ display: 'inline', marginRight: 4 }} />
                    GPX
                  </button>
                </div>
              </div>
            </div>
          );
        }

        if (currentSub === 1) {
          return (
            <div className="club-drawer-pane-content">
              <div className="club-drawer-sec-head">
                <b>Bulletin Massif · {activeClub.massif}</b>
                <span>Conditions terrain & sécurité de la tribu</span>
              </div>
              <div className="li nt">
                <div>
                  <div className="ttl"><span>Isotherme 0°C & Plafond</span></div>
                  <div className="s2">{activeClub.weatherIso} · Visibilité crêtes excellente le matin</div>
                </div>
                <span className="tg confirmed">Vérifié</span>
              </div>
              <div className="li nt">
                <div>
                  <div className="ttl"><span>Vent en altitude & Crêtes</span></div>
                  <div className="s2">{activeClub.weatherWind} · Vigilance passages exposés</div>
                </div>
                <span className="tg p">Info</span>
              </div>
              <div className="li nt">
                <div>
                  <div className="ttl"><span>État des sentiers & Refuges (Tribu)</span></div>
                  <div className="s2">{activeClub.weatherTrail}</div>
                </div>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => onFlyToCoords(activeClub.lat, activeClub.lng, `Météo ${activeClub.massif}`)}
                >
                  Carte 3D
                </button>
              </div>
            </div>
          );
        }

        const list =
          currentSub === 2
            ? outings.filter((o) => o.status === 'completed')
            : outings.filter((o) => o.status !== 'completed');

        return (
          <div className="club-drawer-pane-content">
            <div className="club-drawer-sec-head">
              <b>
                {currentSub === 2
                  ? 'Archives & Bibliothèque de Traces GPX'
                  : 'Prochains Départs & Covoiturage'}
              </b>
              <span>{list.length} sorties</span>
            </div>
            <div className="reseau-list">
              {list.map((o) => (
                <div key={o.id} className="li nt club-outing-row">
                  <button
                    type="button"
                    className="club-row-main-btn"
                    onClick={() => {
                      setInspectedOuting(o);
                      onFlyToCoords(o.lat, o.lng, o.title);
                    }}
                  >
                    <span className="reseau-meta">
                      <span className="reseau-name-row">
                        <b>{o.title}</b>
                        <span className="club-comment-badge">{o.km} km · +{o.dplus} m</span>
                      </span>
                      <span className="reseau-sub">
                        {o.date} · 🚐 {o.carpoolCity} ({o.carpoolSeatsLeft} pl.) · Kit : {o.requiredGear.slice(0, 2).join(', ')}
                      </span>
                    </span>
                  </button>
                  {currentSub === 2 ? (
                    <button
                      type="button"
                      className="reseau-btn primary"
                      onClick={() => onDownloadGpx(o)}
                    >
                      GPX ↓
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className={`reseau-btn ${o.rsvpJoined ? 'active' : 'primary'}`}
                        onClick={() => onToggleRsvpOuting(o.id)}
                      >
                        {o.rsvpJoined ? 'Inscrit ✓' : 'RSVP'}
                      </button>
                      <button
                        type="button"
                        className="reseau-btn active"
                        title="Créer un groupe d'expédition depuis cette sortie"
                        onClick={() => onCreateGroupFromOuting(o)}
                      >
                        Groupe
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      },
    },

    // TAB 3: COFFRE MATÉRIEL MUTUALISÉ
    {
      id: 'coffre',
      label: 'Coffre matériel mutualisé du club',
      icon: <Backpack size={18} aria-hidden="true" />,
      render: () => {
        if (currentSub === 1) {
          return (
            <div className="club-drawer-pane-content">
              <div className="club-drawer-sec-head">
                <b>Kits Standards Recommandés par {activeClub.name}</b>
                <span>Clonables en 1 tap dans Mon Matériel</span>
              </div>
              {standardKits.map((k) => (
                <div key={k.id} className="li nt club-outing-row">
                  <div>
                    <div className="ttl">
                      <b>{k.title}</b> · <span className="club-comment-badge">{(k.totalWeightG / 1000).toFixed(1)} kg</span>
                    </div>
                    <div className="s2">{k.season} · {k.items.join(' · ')}</div>
                  </div>
                  <button
                    type="button"
                    className={`reseau-btn ${k.cloned ? 'active' : 'primary'}`}
                    onClick={() => onCloneStandardKit(k.id)}
                  >
                    {k.cloned ? 'Cloné ✓' : 'Cloner'}
                  </button>
                </div>
              ))}
            </div>
          );
        }

        if (currentSub === 2) {
          const collectiveItems = [
            { key: 'tente', name: 'Abri / Tente 3P (1 720 g)' },
            { key: 'rechaud', name: 'Réchaud + Popote Titane (310 g)' },
            { key: 'corde', name: 'Corde Rando 30 m (890 g)' },
            { key: 'secours', name: 'Pharmacie & Bivouac Urgence (420 g)' },
          ];
          const carriers = ['Тоny (@tony_frc)', 'Léa (@lea.fontaine)', 'Marc (@marc_alpi)', 'Clara (@clara.bivouac)'];
          return (
            <div className="club-drawer-pane-content">
              <div className="club-drawer-sec-head">
                <b>Répartition du Poids Collectif de Cordée</b>
                <span>Évite les doublons au départ du parking (Total : 3,34 kg)</span>
              </div>
              {collectiveItems.map((item) => (
                <div key={item.key} className="li nt">
                  <div>
                    <div className="ttl"><span>{item.name}</span></div>
                    <div className="s2">Porté par : <b>{cordeeCarrier[item.key]}</b></div>
                  </div>
                  <button
                    type="button"
                    className="reseau-btn active"
                    onClick={() => {
                      const cur = cordeeCarrier[item.key];
                      const next = carriers[(carriers.indexOf(cur) + 1) % carriers.length];
                      setCordeeCarrier((prev) => ({ ...prev, [item.key]: next }));
                    }}
                  >
                    Changer
                  </button>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div className="club-drawer-pane-content">
            <div className="club-drawer-sec-head">
              <b>Coffre d’Entraide Matériel ({vaultGear.length} pièces)</b>
              <span>Prêt gratuit entre membres vérifiés pour les sorties du club</span>
            </div>
            <div className="reseau-list">
              {vaultGear.map((g) => (
                <div key={g.id} className="li nt club-outing-row">
                  <div>
                    <div className="ttl">
                      <b>{g.name}</b> · <span className="s2">{g.brand} ({g.weightG} g)</span>
                    </div>
                    <div className="s2">
                      Prêté par <b>{g.ownerName}</b> (@{g.ownerHandle}) · {g.category}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`reseau-btn ${g.reservedByMe ? 'active' : 'primary'}`}
                    onClick={() => onToggleReserveGear(g.id)}
                  >
                    {g.reservedByMe ? 'Réservé ✓' : 'Emprunter'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      },
    },

    // TAB 4: DÉFIS COLLECTIFS, CANAL LIVE & GOUVERNANCE
    {
      id: 'tribu',
      label: 'Défis collectifs, canal et gouvernance',
      icon: <Award size={18} aria-hidden="true" />,
      render: () => {
        if (currentSub === 1) {
          return (
            <div className="club-drawer-pane-content club-chat-pane">
              <div className="club-drawer-sec-head">
                <b>Canal Live · {activeClub.name}</b>
                <span>Coordination départs & météo en direct</span>
              </div>
              <div className="club-chat-messages">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="lkdv-comment-row">
                    <span className="lkdv-comment-av" aria-hidden="true">
                      {msg.authorName.charAt(0)}
                    </span>
                    <div className="lkdv-comment-body">
                      <div className="lkdv-comment-meta">
                        <b>{msg.authorName}</b>
                        {msg.roleBadge ? <span className="club-comment-badge">{msg.roleBadge}</span> : null}
                        <span>{msg.time}</span>
                      </div>
                      <p className="lkdv-comment-text">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="lkdv-comments-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatDraft.trim()) return;
                  onSendChatMessage(chatDraft.trim());
                  setChatDraft('');
                }}
              >
                <input
                  type="text"
                  className="lkdv-comments-input"
                  placeholder={`Écrire à la cordée ${activeClub.name}…`}
                  aria-label="Message au canal du club"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="lkdv-comments-send"
                  aria-label="Envoyer au canal"
                  disabled={!chatDraft.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          );
        }

        if (currentSub === 2) {
          return (
            <div className="club-drawer-pane-content">
              <div className="club-drawer-sec-head">
                <b>Charte, Gouvernance & QR Code Terrain</b>
                <span>Rôle : {activeClub.role}</span>
              </div>
              <div className="li nt" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <div className="ttl"><b>Charte & Sécurité du Club</b></div>
                <div className="s2">{activeClub.charter}</div>
              </div>
              <div className="li nt">
                <div>
                  <div className="ttl"><span>Visibilité & Mode d’adhésion</span></div>
                  <div className="s2">
                    {activeClub.visibility === 'public'
                      ? 'Public · Tout voyageur LKDV peut rejoindre'
                      : 'Sur cooptation · Validation par les encadrants'}
                  </div>
                </div>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={onToggleClubVisibility}
                >
                  {activeClub.visibility === 'public' ? 'Public' : 'Privé'}
                </button>
              </div>
              <div className="li nt">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <QrCode size={28} color="#17402C" aria-hidden="true" />
                  <div>
                    <div className="ttl"><span>Pass QR Terrain · {activeClub.name}</span></div>
                    <div className="s2">Recrutement direct au refuge ou au parking</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(`${window.location.origin}/clubs/${activeClub.id}`);
                      setCopiedInvite(true);
                      window.setTimeout(() => setCopiedInvite(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {copiedInvite ? 'Copié ✓' : 'Lien QR'}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="club-drawer-pane-content">
            <div className="club-drawer-sec-head">
              <b>Défis Collectifs & Empreinte du Club</b>
              <span>Cumul vérifié : {activeClub.totalKm} km · +{activeClub.totalDplus.toLocaleString('fr-FR')} m D+</span>
            </div>
            {challenges.map((ch) => {
              const pct = Math.min(100, Math.round((ch.current / ch.target) * 100));
              return (
                <div key={ch.id} className="li nt" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 13, color: 'var(--label)' }}>{ch.title}</b>
                    <span className="club-comment-badge">{ch.rewardBadge}</span>
                  </div>
                  <div className="s2">{ch.subtitle}</div>
                  <div className="club-progress-track" aria-label={`${pct}% complété`}>
                    <div className="club-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="s2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{ch.current.toLocaleString('fr-FR')} / {ch.target.toLocaleString('fr-FR')} {ch.unit}</span>
                    <b>{pct}%</b>
                  </div>
                </div>
              );
            })}
          </div>
        );
      },
    },
  ];

  const activeSecondaryItems = secondaryByTab[tab] ?? [];

  return (
    <DrawerShell
      tabs={mainTabs}
      activeIndex={tab}
      onIndexChange={(nextTab) => {
        setInspectedMember(null);
        setInspectedOuting(null);
        setTab(nextTab);
      }}
      secondary={{
        items: activeSecondaryItems,
        active: currentSub,
        onChange: (idx) => {
          setInspectedMember(null);
          setInspectedOuting(null);
          setCurrentSub(idx);
        },
        label: 'Sous-sections du club',
      }}
      state="ready"
    />
  );
}

export default ClubDrawerHost;
