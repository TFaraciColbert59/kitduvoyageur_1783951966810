'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Handshake,
  Package,
  Shield,
  Users,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import { createClient } from '@/lib/supabase/client';
import {
  StaggerCard,
  StaggerList,
} from './ClubDrawerMotion';
import {
  useLocalStorageState,
} from './ClubSharedUi';
import type {
  ClubCordeeDrawerBodyProps,
  ClubGearVaultItem,
  ClubMemberData,
  ClubOutingData,
} from './ClubDrawerTypes';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';
import { ClubG02Workspace } from '../g02';

function resolveMemberGearImage(name: string, category: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  const hay = `${name} ${category}`.toLowerCase();
  if (hay.includes('tente') || hay.includes('bivouac') || hay.includes('abri')) return '/assets/images/product-tent.jpg';
  if (hay.includes('duvet') || hay.includes('couchage') || hay.includes('matelas')) return '/assets/images/product-sleeping.jpg';
  if (hay.includes('rechaud') || hay.includes('réchaud') || hay.includes('cuisine') || hay.includes('jetboil')) return '/assets/images/gear-stove.jpg';
  if (hay.includes('frontale') || hay.includes('eclairage') || hay.includes('éclairage') || hay.includes('lampe')) return '/assets/images/product-headlamp.jpg';
  if (hay.includes('crampon') || hay.includes('chaussure') || hay.includes('piolet') || hay.includes('baton') || hay.includes('bâton')) return '/assets/images/gear-boots.jpg';
  if (hay.includes('veste') || hay.includes('doudoune') || hay.includes('textile')) return '/assets/images/product-jacket.jpg';
  if (hay.includes('gourde') || hay.includes('hydrat')) return '/assets/images/product-bottle.jpg';
  return '/assets/images/product-backpack.jpg';
}

export function hasClubRole(member: Pick<ClubMemberData, 'role' | 'rawRole'>): boolean {
  if (member.rawRole === 'admin' || member.rawRole === 'moderator') return true;
  return (
    member.role === 'Fondateur' ||
    member.role === 'Guide & Sécurité' ||
    member.role === 'Encadrant'
  );
}

function CordeeMemberList({
  members,
  outings,
  vaultGear,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  onSelectMember,
}: {
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  emptyIcon?: React.ReactNode;
  emptyTitle: string;
  emptySubtitle: string;
  onSelectMember: (member: ClubMemberData) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(35);
  useEffect(() => {
    setVisibleCount(35);
  }, [members.length]);

  const outingsCountByHandle = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of outings) {
      const h = (o.leaderHandle || '').toLowerCase();
      if (h) map.set(h, (map.get(h) ?? 0) + 1);
    }
    return map;
  }, [outings]);

  const gearWeightByHandle = useMemo(() => {
    const map = new Map<string, { count: number; weightG: number }>();
    for (const g of vaultGear) {
      const h = (g.ownerHandle || '').toLowerCase();
      if (!h) continue;
      const cur = map.get(h) ?? { count: 0, weightG: 0 };
      cur.count += 1;
      cur.weightG += g.weightG || 0;
      map.set(h, cur);
    }
    return map;
  }, [vaultGear]);

  if (members.length === 0) {
    return (
      <div className="lkdv-carnet-empty-card">
        {emptyIcon ?? <Users size={22} aria-hidden="true" />}
        <b>{emptyTitle}</b>
        <p>{emptySubtitle}</p>
      </div>
    );
  }

  const visibleMembers = useMemo(() => members.slice(0, visibleCount), [members, visibleCount]);
  const remainingCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <StaggerList className="lkdv-carnet-cards-col">
      {visibleMembers.map((p) => {
        const displayName = p.name?.trim() || p.handle?.trim() || 'Voyageur';
        const initial = displayName.slice(0, 1).toUpperCase();
        const handleKey = (p.handle || '').toLowerCase();
        const outingsCount =
          typeof p.outingsCount === 'number'
            ? p.outingsCount
            : (outingsCountByHandle.get(handleKey) ?? 0);
        const gearStats = gearWeightByHandle.get(handleKey);
        const hasKitItems = (gearStats?.count ?? 0) > 0;
        const kitWeightG = gearStats?.weightG ?? 0;

        return (
          <StaggerCard key={p.id || p.userId || p.handle} className="lkdv-carnet-crew-card">
            <button
              type="button"
              className="lkdv-carnet-crew-main"
              onClick={() => onSelectMember(p)}
            >
              <span className="lkdv-carnet-crew-avatar">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  initial
                )}
              </span>
              <div className="lkdv-carnet-crew-meta">
                <div className="lkdv-carnet-crew-name-row">
                  <b>{displayName}</b>
                  <span className="lkdv-carnet-chip-soft">{p.role}</span>
                </div>
                <div className="lkdv-carnet-crew-stats">
                  <span>
                    {outingsCount} sortie{outingsCount > 1 ? 's' : ''}
                  </span>
                  {hasKitItems && kitWeightG > 0 ? (
                    <span>· Sac {(kitWeightG / 1000).toFixed(1).replace('.', ',')} kg</span>
                  ) : p.massif ? (
                    <span>· {p.massif}</span>
                  ) : null}
                </div>
              </div>
              <ChevronRight size={15} className="lkdv-carnet-chevron" />
            </button>
          </StaggerCard>
        );
      })}
      {remainingCount > 0 ? (
        <button
          type="button"
          className="lkdv-carnet-btn-soft"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          onClick={() => setVisibleCount((c) => c + 50)}
        >
          Afficher 50 de plus ({remainingCount} restants)
        </button>
      ) : null}
    </StaggerList>
  );
}

interface PublicCarnetSummary {
  id: string;
  slug: string;
  title: string;
  massif?: string | null;
  distance_km?: number | null;
}

const publicCarnetsCache = new Map<string, PublicCarnetSummary[]>();

function InspectedMemberPane({
  lensId,
  active,
  member,
  outings,
  posts,
  vaultGear,
  canManageStoryPermissions,
  onToggleStoryPermission,
  onInspectMember,
  onBorrowGear,
  onSwitchTabAndLens,
  onToast,
  onClose,
}: {
  lensId: 'm-stats' | 'm-outings' | 'm-gear' | 'm-media';
  active: boolean;
  member: ClubMemberData;
  outings: ClubOutingData[];
  posts: ClubFeedPostItem[];
  vaultGear: ClubGearVaultItem[];
  canManageStoryPermissions?: boolean;
  onToggleStoryPermission?: ClubCordeeDrawerBodyProps['onToggleMemberStoryPermission'];
  onInspectMember: (member: ClubMemberData | null) => void;
  onBorrowGear?: ClubCordeeDrawerBodyProps['onBorrowGear'];
  onSwitchTabAndLens: ClubCordeeDrawerBodyProps['onSwitchTabAndLens'];
  onToast: ClubCordeeDrawerBodyProps['onToast'];
  onClose: () => void;
}) {
  const backBtnRef = useRef<HTMLButtonElement | null>(null);
  const [publicCarnets, setPublicCarnets] = useState<PublicCarnetSummary[]>([]);
  const [storyPermBusy, setStoryPermBusy] = useState(false);
  const [storyPermLocal, setStoryPermLocal] = useState<boolean>(Boolean(member.canManageStories));

  useEffect(() => {
    setStoryPermLocal(Boolean(member.canManageStories));
  }, [member.canManageStories, member.id]);

  useEffect(() => {
    if (!active) return;
    backBtnRef.current?.focus({ preventScroll: true });
  }, [active, member.id]);

  useEffect(() => {
    if (lensId !== 'm-outings' || !active) return;
    const uid = member.userId || member.id;
    if (!uid || !/^[0-9a-f]{8}-/i.test(uid)) return;
    const cached = publicCarnetsCache.get(uid);
    if (cached) {
      setPublicCarnets(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('carnets')
          .select('id, slug, title, massif, distance_km')
          .eq('user_id', uid)
          .eq('visibility', 'public')
          .limit(3);
        if (!cancelled && Array.isArray(data)) {
          publicCarnetsCache.set(uid, data as PublicCarnetSummary[]);
          setPublicCarnets(data as PublicCarnetSummary[]);
        }
      } catch {
        // ignore in offline/test env
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, lensId, member.id, member.userId]);

  const pName = member.name?.trim() || member.handle?.trim() || 'Voyageur';
  const normHandle = (member.handle || '').trim().toLowerCase();
  const normName = (member.name || '').trim().toLowerCase();

  const matchesMember = (handle?: string | null, name?: string | null) => {
    const h = (handle || '').trim().toLowerCase();
    const n = (name || '').trim().toLowerCase();
    if (normHandle && (h === normHandle || n === normHandle)) return true;
    if (normName && (n === normName || h === normName)) return true;
    return false;
  };

  const memberOutings = useMemo(
    () => outings.filter((o) => matchesMember(o.leaderHandle, o.leaderName)),
    [normHandle, normName, outings],
  );
  const memberGear = useMemo(
    () => vaultGear.filter((g) => matchesMember(g.ownerHandle, g.ownerName)),
    [normHandle, normName, vaultGear],
  );
  const memberPosts = useMemo(
    () => posts.filter((p) => matchesMember(p.authorHandle, p.authorName)),
    [normHandle, normName, posts],
  );
  const photoPosts = useMemo(() => memberPosts.filter((p) => Boolean(p.mediaUrl)), [memberPosts]);
  const textPosts = useMemo(() => memberPosts.filter((p) => !p.mediaUrl), [memberPosts]);

  const totalKm = useMemo(
    () =>
      member.distanceKm && member.distanceKm > 0
        ? member.distanceKm
        : memberOutings.reduce((sum, o) => sum + (Number(o.km) || 0), 0),
    [member.distanceKm, memberOutings],
  );
  const totalDplus = useMemo(
    () =>
      member.dplusM && member.dplusM > 0
        ? member.dplusM
        : memberOutings.reduce((sum, o) => sum + (Number(o.dplus) || 0), 0),
    [member.dplusM, memberOutings],
  );
  const outingsCount = Math.max(member.outingsCount ?? 0, memberOutings.length);
  const hasAnySharedContent = memberPosts.length > 0 || memberGear.length > 0;

  return (
    <div
      className="lkdv-carnet-drawer-pane"
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {lensId === 'm-stats' ? (
        <>
          <div className="lkdv-carnet-kpi-grid-3">
            <div className="lkdv-carnet-kpi-mini">
              <small>Distance</small>
              <b>{totalKm > 0 ? `${Math.round(totalKm)} km` : '0 km'}</b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Dénivelé +</small>
              <b>{totalDplus > 0 ? `+${Math.round(totalDplus)} m` : '0 m'}</b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Sorties</small>
              <b>{outingsCount}</b>
            </div>
          </div>
          {photoPosts.length > 0 ? (
            <>
              <span className="lkdv-carnet-kit-eyebrow">
                Médias publiés ({photoPosts.length})
              </span>
              <div className="lkdv-ig-grid" style={{ gap: 6 }}>
                {photoPosts.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="lkdv-ig-tile"
                    style={{ borderRadius: 14, overflow: 'hidden' }}
                    onClick={() => {
                      onClose();
                      document
                        .getElementById(`club-feed-post-${m.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    {m.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.mediaUrl} alt="" loading="lazy" />
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {textPosts.length > 0 ? (
            <>
              <span className="lkdv-carnet-kit-eyebrow">
                Publications ({textPosts.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {textPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className="club-glass-card"
                    style={{ textAlign: 'left', width: '100%', border: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
                    onClick={() => {
                      onClose();
                      document
                        .getElementById(`club-feed-post-${post.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ fontSize: 13, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.spot || 'Publication club'}
                      </b>
                      {post.timeAgo ? (
                        <span className="club-badge-soft" style={{ whiteSpace: 'nowrap', flex: 'none' }}>
                          {post.timeAgo}
                        </span>
                      ) : null}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: 1.4,
                        color: 'var(--label2)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {post.caption || post.spot || 'Publication dans le club'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {memberGear.length > 0 ? (
            <>
              <span className="lkdv-carnet-kit-eyebrow">
                Matériel mutualisé ({memberGear.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {memberGear.map((g) => {
                  const weightLabel = g.weightG
                    ? g.weightG >= 1000
                      ? `${(g.weightG / 1000).toFixed(1).replace('.', ',')} kg`
                      : `${g.weightG} g`
                    : null;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className="club-glass-card"
                      style={{
                        width: '100%',
                        border: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                      onClick={() => onSwitchTabAndLens(3, 0, { highlightGearId: g.id })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMemberGearImage(g.name, g.category, g.imageUrl)}
                          alt={g.name}
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            objectFit: 'cover',
                            background: 'rgba(23, 64, 44, 0.06)',
                            flex: 'none',
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <b style={{ display: 'block', fontSize: 13, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.name}
                          </b>
                          <div style={{ fontSize: 11.5, color: 'var(--label2)', marginTop: 2 }}>
                            {[g.category, weightLabel].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                      <span className={g.available ? 'club-badge-sage' : 'club-badge-soft'} style={{ whiteSpace: 'nowrap', flex: 'none' }}>
                        {g.available ? 'Disponible' : 'Emprunté'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          {!hasAnySharedContent ? (
            <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>
              Aucun contenu partagé par ce membre dans ce club.
            </p>
          ) : null}
        </>
      ) : null}

      {lensId === 'm-outings' ? (
        memberOutings.length > 0 || publicCarnets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memberOutings.map((o) => (
              <button
                key={o.id}
                type="button"
                className="club-glass-card"
                style={{
                  width: '100%',
                  border: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
                onClick={() => onSwitchTabAndLens(2, 0, { inspectOuting: o })}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="club-badge-sage" style={{ whiteSpace: 'nowrap' }}>
                    {o.date || 'À venir'}
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
                    {o.km > 0 ? (
                      <span className="club-badge-soft" style={{ whiteSpace: 'nowrap' }}>
                        {o.km} km
                      </span>
                    ) : null}
                    {o.dplus > 0 ? (
                      <span className="club-badge-soft" style={{ whiteSpace: 'nowrap' }}>
                        +{o.dplus} m
                      </span>
                    ) : null}
                  </div>
                </div>
                <b style={{ fontSize: 13.5, lineHeight: 1.3, color: 'var(--label)' }}>{o.title}</b>
                {o.massif ? (
                  <small style={{ fontSize: 11.5, color: 'var(--label2)' }}>{o.massif}</small>
                ) : null}
              </button>
            ))}
            {publicCarnets.map((c) => (
              <div key={c.id} className="club-glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13, color: 'var(--label)' }}>{c.title}</b>
                  {c.massif ? <small style={{ fontSize: 11.5, color: 'var(--label2)' }}>{c.massif}</small> : null}
                </div>
                <span className="club-badge-soft" style={{ whiteSpace: 'nowrap' }}>
                  {c.distance_km ? `${Math.round(c.distance_km)} km` : 'Carnet'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>
            Aucune sortie enregistrée pour ce voyageur.
          </p>
        )
      ) : null}

      {lensId === 'm-gear' ? (
        memberGear.length > 0 ? (
          <div className="lkdv-carnet-kit-groups">
            {Array.from(
              memberGear.reduce((acc, item) => {
                const cat = item.category?.trim() || 'Divers';
                const arr = acc.get(cat) ?? [];
                arr.push(item);
                acc.set(cat, arr);
                return acc;
              }, new Map<string, typeof memberGear>()),
            ).map(([category, groupItems]) => {
              const catWeightG = groupItems.reduce((sum, item) => sum + (item.weightG ?? 0), 0);
              return (
                <section key={category} className="lkdv-carnet-kit-group">
                  <div className="lkdv-carnet-kit-group-head">
                    <Package size={14} aria-hidden="true" />
                    <span>{category}</span>
                    <small>
                      {groupItems.length} ·{' '}
                      {catWeightG >= 1000
                        ? `${(catWeightG / 1000).toFixed(1).replace('.', ',')} kg`
                        : `${Math.round(catWeightG)} g`}
                    </small>
                  </div>
                  <div className="lkdv-carnet-kit-plus-row">
                    {groupItems.map((item) => {
                      const wG = item.weightG ?? 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="lkdv-carnet-kit-mini-tile"
                          onClick={() => {
                            if (onBorrowGear && item.available) {
                              onBorrowGear(item.id);
                            } else {
                              onSwitchTabAndLens(3, 0, { highlightGearId: item.id });
                            }
                          }}
                        >
                          <div className="lkdv-carnet-kit-mini-tile-top">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl || generatedProductImage(item.name, category)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                objectFit: 'cover',
                                background: 'rgba(23, 64, 44, 0.06)',
                              }}
                            />
                          </div>
                          <b title={item.name}>{item.name}</b>
                          <div className="lkdv-carnet-kit-mini-tile-foot">
                            <small>
                              {wG > 0
                                ? wG >= 1000
                                  ? `${(wG / 1000).toFixed(1).replace('.', ',')} kg`
                                  : `${Math.round(wG)} g`
                                : '—'}
                            </small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>
            Aucun kit partagé pour ce voyageur.
          </p>
        )
      ) : null}

      {lensId === 'm-media' ? (
        <>
          <div className="lkdv-carnet-kpi-grid-3">
            <div className="lkdv-carnet-kpi-mini">
              <small>Sorties</small>
              <b>{outingsCount}</b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Publications</small>
              <b>{memberPosts.length}</b>
            </div>
            <div className="lkdv-carnet-kpi-mini">
              <small>Matériel</small>
              <b>{memberGear.length}</b>
            </div>
          </div>
          {memberPosts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {memberPosts.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  className="club-glass-card"
                  style={{
                    width: '100%',
                    border: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                  onClick={() => {
                    onClose();
                    document
                      .getElementById(`club-feed-post-${exp.id}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  {exp.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={exp.mediaUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        objectFit: 'cover',
                        flex: 'none',
                      }}
                    />
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <b
                        style={{
                          fontSize: 13,
                          color: 'var(--label)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {exp.spot || 'Publication club'}
                      </b>
                      <span className="club-badge-soft" style={{ whiteSpace: 'nowrap', flex: 'none' }}>
                        {exp.timeAgo || 'Club'}
                      </span>
                    </div>
                    {exp.caption ? (
                      <p
                        style={{
                          margin: '3px 0 0',
                          fontSize: 11.5,
                          lineHeight: 1.35,
                          color: 'var(--label2)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {exp.caption}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: '8px 0', fontSize: 12.5, color: 'var(--label2)' }}>
              Aucune publication partagée par ce voyageur.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

export function ClubCordeeDrawerBody(props: ClubCordeeDrawerBodyProps) {
  const blockedSet = useMemo(() => {
    if (!props.blockedUserIds) return new Set<string>();
    return props.blockedUserIds instanceof Set
      ? props.blockedUserIds
      : new Set(props.blockedUserIds);
  }, [props.blockedUserIds]);

  const unblockedMembers = useMemo(
    () => props.members.filter((m) => !blockedSet.has(m.userId || m.id)),
    [blockedSet, props.members],
  );

  const availKey = `lkdv.clubBinomeAvail.${props.activeClub.id || 'default'}.${props.currentUserId || 'guest'}`;
  const [myAvail, setMyAvail] = useLocalStorageState<{
    availableWeekend: boolean;
    days: Array<'sam' | 'dim'>;
    objective: string;
  }>(availKey, {
    availableWeekend: true,
    days: ['sam', 'dim'],
    objective: '',
  });

  const handleSelectMember = useCallback(
    (member: ClubMemberData, sourceLens = 0) => {
      if (hasClubRole(member)) {
        props.onInspectMember(member, sourceLens);
      } else {
        props.onOpenMemberProfile(member.handle);
      }
    },
    [props],
  );

  if (props.inspectedMember) {
    const memberLens =
      props.lensId === 'm-outings' ||
      props.lensId === 'm-gear' ||
      props.lensId === 'm-media'
        ? props.lensId
        : 'm-stats';

    const viewerIsClubAdmin = Boolean(
      props.currentUserId &&
        (props.activeClub.createdBy === props.currentUserId ||
          props.activeClub.viewerRole === 'admin'),
    );

    return (
      <InspectedMemberPane
        lensId={memberLens}
        active={props.active}
        member={props.inspectedMember}
        outings={props.outings}
        posts={props.posts}
        vaultGear={props.vaultGear}
        canManageStoryPermissions={viewerIsClubAdmin}
        onToggleStoryPermission={props.onToggleMemberStoryPermission}
        onInspectMember={(m) => props.onInspectMember(m)}
        onBorrowGear={props.onBorrowGear}
        onSwitchTabAndLens={props.onSwitchTabAndLens}
        onToast={props.onToast}
        onClose={props.onClose}
      />
    );
  }

  if (props.lensId === 'members-guides') {
    const rank: Record<string, number> = { Fondateur: 0, 'Guide & Sécurité': 1, Encadrant: 2 };
    const guides = unblockedMembers
      .filter((m) => hasClubRole(m))
      .sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name, 'fr'));

    return (
      <div className="lkdv-carnet-drawer-pane" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <CordeeMemberList
          members={guides}
          outings={props.outings}
          vaultGear={props.vaultGear}
          emptyIcon={<Shield size={22} aria-hidden="true" />}
          emptyTitle="Aucun encadrant"
          emptySubtitle="Les référents et encadrants du club apparaîtront ici."
          onSelectMember={(m) => handleSelectMember(m, 1)}
        />
        {props.active ? (
          <ClubG02Workspace clubId={props.activeClub.id} initialSection="invites" lockedSection />
        ) : null}
      </div>
    );
  }

  if (props.lensId === 'members-binomes') {
    const partners = unblockedMembers.filter(
      (m) =>
        m.availableWeekend &&
        (!props.currentUserId || (m.userId !== props.currentUserId && m.id !== props.currentUserId)),
    );

    return (
      <div className="lkdv-carnet-drawer-pane" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="lkdv-carnet-follow-card" style={{ padding: 12 }}>
          <Switch
            checked={myAvail.availableWeekend}
            onCheckedChange={(checked) => {
              const next = { ...myAvail, availableWeekend: checked };
              setMyAvail(next);
              void props.onUpdateMyAvailability(next);
              props.onToast({
                title: checked ? 'Disponible ce week-end ✓' : 'Disponibilité masquée',
                subtitle: checked ? `Visible dans ${props.activeClub.name}` : undefined,
              });
            }}
            label="Je suis disponible ce week-end"
            aria-label="Basculer ma disponibilité pour ce week-end"
          />
        </div>

        <CordeeMemberList
          members={partners}
          outings={props.outings}
          vaultGear={props.vaultGear}
          emptyIcon={<Handshake size={22} aria-hidden="true" />}
          emptyTitle="Aucun binôme disponible"
          emptySubtitle="Les membres disponibles ce week-end apparaîtront ici."
          onSelectMember={(m) => handleSelectMember(m, 2)}
        />
        {props.active ? (
          <ClubG02Workspace clubId={props.activeClub.id} initialSection="matching" lockedSection />
        ) : null}
      </div>
    );
  }

  const roleRank: Record<ClubMemberData['role'], number> = {
    Fondateur: 0,
    'Guide & Sécurité': 1,
    Encadrant: 2,
    Nouveau: 3,
    'Membre actif': 4,
  };
  const sortedMembers = [...unblockedMembers].sort(
    (a, b) => (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9) || a.name.localeCompare(b.name, 'fr'),
  );

  return (
    <CordeeMemberList
      members={sortedMembers}
      outings={props.outings}
      vaultGear={props.vaultGear}
      emptyIcon={<Users size={22} aria-hidden="true" />}
      emptyTitle="Aucun membre"
      emptySubtitle="Les membres de la cordée apparaîtront ici."
      onSelectMember={(m) => handleSelectMember(m, 0)}
    />
  );
}

export default ClubCordeeDrawerBody;
