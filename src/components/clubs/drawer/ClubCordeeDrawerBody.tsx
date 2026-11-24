'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  ChevronLeft,
  ChevronRight,
  Handshake,
  Package,
  Shield,
  Users,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { CarnetHorizontalTimeline } from '@/components/carnet/v2/CarnetHorizontalTimeline';
import { generatedProductImage } from '@/components/compte/drawer/cards/productImage';
import type { PickerProduct } from '@/features/community/create/kit/types';
import { createClient } from '@/lib/supabase/client';

const KitProductSheetV2 = dynamic(
  () => import('@/features/community/v2/create/kit/KitProductSheetV2').then((m) => m.KitProductSheetV2),
  { ssr: false },
);
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
          .select('id, title, destination, distance_km')
          .eq('author_id', uid)
          .eq('visibility', 'public')
          .limit(3);
        if (!cancelled && Array.isArray(data)) {
          const mapped: PublicCarnetSummary[] = (
            data as Array<{
              id: string;
              title: string;
              destination?: string | null;
              distance_km?: number | null;
            }>
          ).map((row) => ({
            id: row.id,
            slug: row.id,
            title: row.title,
            massif: row.destination ?? null,
            distance_km: row.distance_km ?? null,
          }));
          publicCarnetsCache.set(uid, mapped);
          setPublicCarnets(mapped);
        }
      } catch {
        // ignore in offline/test env
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, lensId, member.id, member.userId]);

  const [selectedGearIndex, setSelectedGearIndex] = useState<number | null>(null);
  useEffect(() => {
    setSelectedGearIndex(null);
  }, [member.id, lensId]);

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
        </>
      ) : null}

      {lensId === 'm-outings' ? (
        memberOutings.length > 0 || publicCarnets.length > 0 ? (
          <div data-hscroll="true" style={{ marginInline: -10 }}>
            <CarnetHorizontalTimeline
              ariaLabel={`Frise des sorties de ${pName}`}
              groups={[
                {
                  day: 1,
                  groupLabel: 'Sorties',
                  events: [
                    ...memberOutings.map((o) => {
                      const cleanTitle = o.title.replace(/\s*\([^)]*km[^)]*\)\s*$/i, '').trim();
                      return {
                        id: o.id,
                        day: 1,
                        kind: 'perf' as const,
                        badge: o.status === 'live' ? 'En direct 🔴' : 'Sortie',
                        timeLabel: o.date || 'À venir',
                        title: cleanTitle || o.title,
                        subtitle: [
                          o.massif,
                          o.km > 0 ? `${o.km} km` : null,
                          o.dplus > 0 ? `+${o.dplus} m` : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        onClick: () => onSwitchTabAndLens(2, 0, { inspectOuting: o }),
                      };
                    }),
                    ...publicCarnets.map((c) => ({
                      id: `carnet-${c.id}`,
                      day: 1,
                      kind: 'perf' as const,
                      badge: 'Carnet',
                      timeLabel: c.distance_km ? `${Math.round(c.distance_km)} km` : 'Carnet',
                      title: c.title,
                      subtitle: c.massif || '',
                    })),
                  ],
                },
              ]}
            />
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
                      const flatIndex = memberGear.findIndex((g) => g.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="lkdv-carnet-kit-mini-tile"
                          onClick={() => setSelectedGearIndex(flatIndex >= 0 ? flatIndex : 0)}
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

      {selectedGearIndex !== null &&
      memberGear[selectedGearIndex] &&
      typeof document !== 'undefined'
        ? createPortal(
            (() => {
              const g = memberGear[selectedGearIndex];
              const pickerProduct: PickerProduct = {
                key: g.id,
                source: g.available ? 'pret' : 'inventory',
                id: g.id,
                name: g.name,
                brand: g.brand || null,
                category: g.category || null,
                weightG: g.weightG || null,
                image: g.imageUrl || resolveMemberGearImage(g.name, g.category, g.imageUrl),
                wear: null,
                conditionLabel: g.condition || (g.available ? 'Disponible au prêt' : 'Emprunté'),
                description: `Équipement partagé par ${pName}.`,
                priceLabel: null,
                owner: {
                  id: member.userId || member.id,
                  name: pName,
                  avatarUrl: member.avatarUrl || null,
                  trustScore: null,
                },
                cartable: null,
                ownershipId: null,
                productId: null,
              };
              const totalWeightG = memberGear.reduce((s, it) => s + (it.weightG ?? 0), 0);
              return (
                <KitProductSheetV2
                  product={pickerProduct}
                  initialCategory={g.category || undefined}
                  currentKitWeightG={totalWeightG}
                  alreadyInKit={false}
                  positionLabel={`${selectedGearIndex + 1} / ${memberGear.length}`}
                  hasPrev={selectedGearIndex > 0}
                  hasNext={selectedGearIndex < memberGear.length - 1}
                  onPrev={() =>
                    setSelectedGearIndex((idx) => (idx !== null && idx > 0 ? idx - 1 : idx))
                  }
                  onNext={() =>
                    setSelectedGearIndex((idx) =>
                      idx !== null && idx < memberGear.length - 1 ? idx + 1 : idx,
                    )
                  }
                  onAdd={() => {
                    if (onBorrowGear && g.available) {
                      onBorrowGear(g.id);
                    }
                    setSelectedGearIndex(null);
                  }}
                  onClose={() => setSelectedGearIndex(null)}
                />
              );
            })(),
            document.body,
          )
        : null}
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
    Bénévole: 3,
    Nouveau: 4,
    'Membre actif': 5,
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
