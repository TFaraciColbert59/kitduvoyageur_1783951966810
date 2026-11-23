'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Backpack,
  BarChart3,
  Calendar,
  Check,
  Compass,
  FileText,
  Layers,
  MapPin,
  Mountain,
  Package,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { normalizeSearchText } from './ClubSharedUi';
import { useClubDialog } from './useClubDialog';
import type { ClubRuntimeOverlaysProps } from './ClubDrawerTypes';

/**
 * Overlays runtime unifiés Carnet V2 Light-Mode Liquid Glass
 * (`seal`, `display`, `map_layers`, `peek`, `story`, `post_modal`,
 * `quick_circle`, `create_group`, `club_switcher`, `club_search`).
 */
export function ClubRuntimeOverlays({
  overlay,
  onClose,
  activeClub,
  clubs,
  members,
  outings,
  vaultGear,
  standardKits = [],
  posts,
  onSelectClub,
  onToggleJoinClub,
  onOpenClubDrawer,
  onOpenCreateClub,
  onFlyToCoords,
  onToast,
}: ClubRuntimeOverlaysProps) {
  const dialogRef = useClubDialog(Boolean(overlay), onClose);
  const [outdoorHighContrast, setOutdoorHighContrast] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'topo3d' | 'ign' | 'sat' | 'pentes'>('topo3d');
  const [groupTitle, setGroupTitle] = useState(`Cordée ${activeClub.name}`);
  const [storyIdx, setStoryIdx] = useState(0);
  const [quickQuery, setQuickQuery] = useState('');

  const myClubs = useMemo(
    () => clubs.filter((c) => c.joined || c.id === activeClub.id),
    [activeClub.id, clubs],
  );

  const searchHits = useMemo(() => {
    const q = normalizeSearchText(quickQuery);
    if (!q) {
      return {
        outings: outings.slice(0, 3),
        members: members.slice(0, 3),
        kits: standardKits.slice(0, 2),
        gear: vaultGear.slice(0, 2),
        posts: posts.slice(0, 2),
      };
    }
    return {
      outings: outings
        .filter((o) => normalizeSearchText(`${o.title} ${o.massif} ${o.leaderName} ${o.carpoolCity}`).includes(q))
        .slice(0, 5),
      members: members
        .filter((m) => normalizeSearchText(`${m.name} ${m.handle} ${m.role} ${m.massif}`).includes(q))
        .slice(0, 5),
      kits: standardKits
        .filter((k) => normalizeSearchText(`${k.title} ${k.season} ${k.items.join(' ')}`).includes(q))
        .slice(0, 4),
      gear: vaultGear
        .filter((g) => normalizeSearchText(`${g.name} ${g.brand} ${g.category} ${g.ownerName}`).includes(q))
        .slice(0, 4),
      posts: posts
        .filter((p) => normalizeSearchText(`${p.spot} ${p.caption} ${p.authorName}`).includes(q))
        .slice(0, 4),
    };
  }, [members, outings, posts, quickQuery, standardKits, vaultGear]);

  if (!overlay) return null;

  const titles: Record<string, string> = {
    seal: `Sceau & Pass Terrain · ${activeClub.name}`,
    display: 'Affichage Mode Extérieur & Verre',
    map_layers: 'Calques Carte 3D & Relief',
    peek: `Navigation Rapide · ${activeClub.name}`,
    story: `Stories Terrain · ${activeClub.name}`,
    post_modal: `Publication · ${activeClub.name}`,
    quick_circle: 'Navigation Rapide Cordée',
    create_group: `Nouveau Groupe de Voyage · ${activeClub.name}`,
    club_switcher: 'Changer de club',
    club_search: `Rechercher dans ${activeClub.name}`,
  };

  const totalHits =
    searchHits.outings.length +
    searchHits.members.length +
    searchHits.kits.length +
    searchHits.gear.length +
    searchHits.posts.length;

  return (
    <div
      className="lkdv-peek club-runtime-overlay-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid={`club-runtime-overlay-${overlay.kind}`}
    >
      <div
        ref={dialogRef}
        className="lkdv-peek-box"
        role="dialog"
        aria-modal="true"
        aria-label={titles[overlay.kind] || `Superposition ${overlay.kind} — ${activeClub.name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={overlay.kind === 'club_search' ? { maxHeight: '78vh', display: 'flex', flexDirection: 'column' } : undefined}
      >
        <div
          className="lkdv-peek-menu"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: overlay.kind === 'club_search' ? '74vh' : undefined,
            overflow: overlay.kind === 'club_search' ? 'hidden' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', flex: 'none' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#172b24' }}>
                {titles[overlay.kind] || activeClub.name}
              </div>
            </div>
            <button
              type="button"
              className="reseau-btn active club-icon-pill"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {overlay.kind === 'club_switcher' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {myClubs.map((c) => {
                  const isActive = c.id === activeClub.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectClub(c.id);
                        onClose();
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 14,
                        border: 0,
                        background: isActive ? 'rgba(23, 64, 44, 0.1)' : 'rgba(255, 255, 255, 0.78)',
                        boxShadow: isActive
                          ? 'inset 0 0 0 1px rgba(23, 64, 44, 0.24)'
                          : 'inset 0 0 0 0.5px rgba(23, 43, 36, 0.08)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {c.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.coverUrl}
                            alt=""
                            style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover', flex: 'none' }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: 'rgba(23, 64, 44, 0.14)',
                              color: '#17402c',
                              fontWeight: 800,
                              fontSize: 13,
                              display: 'grid',
                              placeItems: 'center',
                              flex: 'none',
                            }}
                          >
                            {c.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#56665d' }}>
                            {c.massif} · {c.membersCount} membres
                          </div>
                        </div>
                      </div>
                      {isActive ? <Check size={15} color="#17402c" aria-hidden="true" /> : <ArrowUpRight size={14} color="#56665d" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(23, 64, 44, 0.08)' }}>
                {onOpenCreateClub ? (
                  <button
                    type="button"
                    className="lkdv-carnet-btn-primary"
                    style={{ flex: 1, height: 34, justifyContent: 'center', fontSize: 12 }}
                    onClick={() => {
                      onClose();
                      onOpenCreateClub();
                    }}
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>Fonder un club</span>
                  </button>
                ) : null}
                <Link
                  href="/communaute"
                  className="lkdv-carnet-btn-soft"
                  style={{ flex: 1, height: 34, justifyContent: 'center', fontSize: 12, textDecoration: 'none' }}
                  onClick={onClose}
                >
                  <Compass size={14} aria-hidden="true" />
                  <span>Explorer</span>
                </Link>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'club_search' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 6px 6px', minHeight: 0, flex: 1 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 'none' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
                <input
                  type="search"
                  className="club-glass-input"
                  style={{ paddingLeft: 30, paddingRight: quickQuery ? 28 : 10, width: '100%' }}
                  placeholder="Sortie, membre, kit, matériel, post…"
                  aria-label={`Rechercher dans ${activeClub.name}`}
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  autoFocus
                />
                {quickQuery ? (
                  <button
                    type="button"
                    onClick={() => setQuickQuery('')}
                    aria-label="Effacer la recherche"
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2 }}>
                {totalHits === 0 ? (
                  <div style={{ textAlign: 'center', padding: '18px 8px', fontSize: 12.5, color: '#56665d' }}>
                    Aucun résultat pour « {quickQuery} » dans {activeClub.name}.
                  </div>
                ) : (
                  <>
                    {searchHits.outings.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#56665d', paddingLeft: 4 }}>
                          Sorties ({searchHits.outings.length})
                        </span>
                        {searchHits.outings.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              onOpenClubDrawer(2, 0, { outingId: o.id });
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 12,
                              border: 0,
                              background: 'rgba(255, 255, 255, 0.78)',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {o.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#56665d' }}>
                                {o.date} · {o.massif}
                              </div>
                            </div>
                            <Calendar size={14} color="#17402c" aria-hidden="true" style={{ flex: 'none' }} />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchHits.members.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#56665d', paddingLeft: 4 }}>
                          Membres ({searchHits.members.length})
                        </span>
                        {searchHits.members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              onOpenClubDrawer(1, 0, { memberId: m.userId || m.id });
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 12,
                              border: 0,
                              background: 'rgba(255, 255, 255, 0.78)',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24' }}>{m.name}</div>
                              <div style={{ fontSize: 11, color: '#56665d' }}>
                                @{m.handle} · {m.role}
                              </div>
                            </div>
                            <Users size={14} color="#17402c" aria-hidden="true" style={{ flex: 'none' }} />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {(searchHits.kits.length > 0 || searchHits.gear.length > 0) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#56665d', paddingLeft: 4 }}>
                          Kits & Coffre ({searchHits.kits.length + searchHits.gear.length})
                        </span>
                        {searchHits.kits.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => {
                              onOpenClubDrawer(3, 1);
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 12,
                              border: 0,
                              background: 'rgba(255, 255, 255, 0.78)',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24' }}>{k.title}</div>
                              <div style={{ fontSize: 11, color: '#56665d' }}>
                                Kit club · {(k.totalWeightG / 1000).toFixed(1)} kg
                              </div>
                            </div>
                            <Backpack size={14} color="#17402c" aria-hidden="true" style={{ flex: 'none' }} />
                          </button>
                        ))}
                        {searchHits.gear.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              onOpenClubDrawer(3, 0);
                              onClose();
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 12,
                              border: 0,
                              background: 'rgba(255, 255, 255, 0.78)',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24' }}>{g.name}</div>
                              <div style={{ fontSize: 11, color: '#56665d' }}>
                                {g.brand} · {g.weightG} g
                              </div>
                            </div>
                            <Package size={14} color="#17402c" aria-hidden="true" style={{ flex: 'none' }} />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchHits.posts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#56665d', paddingLeft: 4 }}>
                          Publications ({searchHits.posts.length})
                        </span>
                        {searchHits.posts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              onClose();
                              if (typeof document !== 'undefined') {
                                document.getElementById(`club-feed-post-${p.id}`)?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                });
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 12,
                              border: 0,
                              background: 'rgba(255, 255, 255, 0.78)',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#172b24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.spot || p.authorName}
                              </div>
                              <div style={{ fontSize: 11, color: '#56665d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.caption}
                              </div>
                            </div>
                            <FileText size={14} color="#17402c" aria-hidden="true" style={{ flex: 'none' }} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ) : null}

          {overlay.kind === 'seal' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="li nt club-glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <QrCode size={36} color="#17402C" aria-hidden="true" />
                <div>
                  <div className="ttl"><b>Pass Certifié · {activeClub.name}</b></div>
                  <div className="s2">
                    {activeClub.membersCount} membres · {activeClub.outingsCount} sorties · +{activeClub.totalDplus.toLocaleString('fr-FR')} m D+
                  </div>
                </div>
              </div>
              <div className="club-form-pills">
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={() => {
                    onToggleJoinClub(activeClub.id);
                    onToast({
                      title: activeClub.joined ? 'Statut membre mis à jour' : 'Adhésion confirmée ✓',
                      subtitle: activeClub.name,
                    });
                    onClose();
                  }}
                >
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>{activeClub.joined ? 'Membre actif ✓' : 'Rejoindre le club'}</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(0, 0);
                    onClose();
                  }}
                >
                  <BarChart3 size={14} aria-hidden="true" />
                  <span>Statistiques du club</span>
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'display' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="li nt club-glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="ttl"><b>Lisibilité Plein Soleil (Glacier / Crête)</b></div>
                  <div className="s2">Contraste renforcé AA+ sur fond ivoire Carnet V2</div>
                </div>
                <button
                  type="button"
                  className={`reseau-btn ${outdoorHighContrast ? 'primary' : 'active'}`}
                  onClick={() => {
                    const next = !outdoorHighContrast;
                    setOutdoorHighContrast(next);
                    if (typeof document !== 'undefined') {
                      const phoneEl = document.getElementById('phone');
                      if (phoneEl) {
                        phoneEl.classList.toggle('outdoor', next);
                        phoneEl.setAttribute('data-outdoor', next ? 'true' : 'false');
                      }
                    }
                    onToast({
                      title: next ? 'Mode Plein Soleil activé' : 'Mode Liquid Glass standard',
                      subtitle: activeClub.name,
                    });
                  }}
                >
                  <Sun size={14} aria-hidden="true" />
                  <span>{outdoorHighContrast ? 'Actif ✓' : 'Activer'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'map_layers' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="club-form-pills">
                {(
                  [
                    { id: 'topo3d', label: 'Topo 3D Alpin' },
                    { id: 'ign', label: 'Courbes IGN 25k' },
                    { id: 'sat', label: 'Satellite HD' },
                    { id: 'pentes', label: 'Pentes > 30°' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`reseau-btn ${activeLayer === l.id ? 'primary' : 'active'}`}
                    onClick={() => {
                      setActiveLayer(l.id);
                      onFlyToCoords(activeClub.lat, activeClub.lng, `${activeClub.name} · ${l.label}`);
                      onToast({
                        title: `Calque ${l.label} activé`,
                        subtitle: activeClub.massif,
                      });
                    }}
                  >
                    <Layers size={13} aria-hidden="true" />
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {overlay.kind === 'peek' || overlay.kind === 'quick_circle' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="club-form-pills">
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={() => {
                    onOpenClubDrawer(0, 0);
                    onClose();
                  }}
                >
                  <BarChart3 size={14} aria-hidden="true" />
                  <span>Statistiques</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(1, 0);
                    onClose();
                  }}
                >
                  <Users size={14} aria-hidden="true" />
                  <span>Cordée ({members.length})</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(2, 0);
                    onClose();
                  }}
                >
                  <Mountain size={14} aria-hidden="true" />
                  <span>Sorties ({outings.length})</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(3, 0);
                    onClose();
                  }}
                >
                  <span>Coffre</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(4, 0);
                    onClose();
                  }}
                >
                  <span>Salons</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onFlyToCoords(activeClub.lat, activeClub.lng, activeClub.name);
                    onClose();
                  }}
                >
                  <MapPin size={14} aria-hidden="true" />
                  <span>Carte 3D</span>
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'story' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="li nt club-glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <span className="club-badge-sage">
                  Moment Terrain {storyIdx + 1} / {Math.max(1, outings.length)}
                </span>
                <div className="ttl">
                  <b>{outings[storyIdx]?.title || activeClub.nextOutingTitle}</b>
                </div>
                <div className="s2">
                  📍 {outings[storyIdx]?.massif || activeClub.massif} · Guidé par {outings[storyIdx]?.leaderName || activeClub.name}
                </div>
              </div>
              <div className="club-form-pills">
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => setStoryIdx((i) => (i + 1) % Math.max(1, outings.length))}
                >
                  Story suivante →
                </button>
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={() => {
                    onOpenClubDrawer(2, 0, { outingId: outings[storyIdx]?.id });
                    onClose();
                  }}
                >
                  Voir la fiche sortie
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'create_group' || overlay.kind === 'post_modal' ? (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}
              onSubmit={(e) => {
                e.preventDefault();
                onToast({
                  title: 'Groupe de voyage créé ✓',
                  subtitle: groupTitle.trim() || activeClub.name,
                });
                onClose();
              }}
            >
              <input
                type="text"
                className="club-glass-input"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                aria-label="Nom du groupe de voyage"
              />
              <button type="submit" className="reseau-btn primary">
                <Check size={14} aria-hidden="true" />
                <span>Valider & Inviter la cordée</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ClubRuntimeOverlays;
