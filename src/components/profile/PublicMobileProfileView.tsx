'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import Icon from '@/components/ui/AppIcon';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListItem,
  PageHeader,
  Sheet,
  Tabs,
} from '@/components/ui';
import SmartImage from '@/components/ui/SmartImage';
import {
  type CompteUserProfile,
  type CompteCarnet,
  type CompteClubItem,
  type CompteBadgeItem,
  type CompteActiviteItem,
} from '@/lib/supabase/queries-compte';

interface PublicMobileProfileViewProps {
  profile: CompteUserProfile;
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  badges: CompteBadgeItem[];
  activite: CompteActiviteItem[];
  onShare: () => void;
}

type TabKey = 'tout' | 'carnets' | 'clubs' | 'badges';
type ViewMode = 'grid' | 'list';

const ACTIVITY_ICONS: Record<CompteActiviteItem['icon_type'], string> = {
  like: 'heart',
  badge: 'award',
  order: 'shopping-bag',
  comment: 'message-square',
  follow: 'user-plus',
};

export default function PublicMobileProfileView({
  profile,
  carnets,
  clubs,
  badges,
  activite,
  onShare,
}: PublicMobileProfileViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [tab, setTab] = useState<TabKey>('tout');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [following, setFollowing] = useState(false);
  const [trustModalOpen, setTrustModalOpen] = useState(false);

  const fullName = `${profile.first_name || 'Voyageur'} ${profile.last_name || ''}`.trim();
  const handleName = `@${profile.first_name?.toLowerCase() || 'voyageur'}`;
  const trustScore = profile.trust_score ?? 50;
  const levelNum = profile.level?.number ?? 'I';
  const levelTitle = profile.level?.title ?? 'Explorateur';
  const sortiesCount = profile.stats?.sorties ?? profile.sorties_count ?? 0;
  const carnetsCount = carnets.length || (profile.stats?.carnets ?? 0);
  const clubsCount = clubs.length || (profile.stats?.clubs ?? 0);

  const highlights = carnets.slice(0, 5).map((c, i) => ({
    id: c.id,
    label: c.title?.split(' ')[0] || `Étape 0${i + 1}`,
    cover: c.image_url,
  }));

  const handleFollowToggle = () => {
    triggerHaptic(following ? 'selection' : 'success');
    setFollowing(!following);
  };

  return (
    <div className="min-h-screen pb-36 font-sans selection:bg-[color:var(--lkv-primary)]/10 bg-transparent">
      <PageHeader
        sticky
        back
        backHref="/communaute"
        backLabel="Communauté"
        title={handleName}
        subtitle={`Niv.${levelNum} · ${levelTitle}`}
        className="px-4 pt-[var(--safe-top)] pb-2.5"
        actions={
          <IconButton
            variant="glass"
            size="sm"
            aria-label="Partager ce profil"
            onClick={() => {
              triggerHaptic('light');
              onShare();
            }}
          >
            <Icon name="share2" size={15} />
          </IconButton>
        }
      />

      <section className="px-3 pt-3 pb-1">
        <Card variant="featured" className="p-4 sm:p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative shrink-0">
              <div className="w-[76px] h-[76px] rounded-full overflow-hidden flex items-center justify-center p-[2px] relative shadow-xs bg-gradient-to-br from-[color:var(--sage-300)] to-[color:var(--lkv-primary)]">
                <div className="w-full h-full rounded-full overflow-hidden bg-[color:var(--lkv-surface-card)] flex items-center justify-center">
                  {profile.avatar_url ? (
                    <SmartImage
                      src={profile.avatar_url}
                      alt={fullName}
                      fill
                      className="w-full h-full"
                      fallbackIcon={<Icon name="user" size={22} />}
                    />
                  ) : (
                    <span className="text-2xl font-bold font-serif text-[color:var(--lkv-primary)]">
                      {profile.first_name?.charAt(0) || 'V'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  triggerHaptic('selection');
                  setTab('carnets');
                }}
                className="h-auto flex-col gap-0 py-1.5"
              >
                <span className="text-lg font-bold tracking-tight leading-none text-[color:var(--lkv-primary)]">
                  {carnetsCount}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[color:var(--lkv-text-muted)]">
                  Carnets
                </span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  triggerHaptic('selection');
                  setTab('clubs');
                }}
                className="h-auto flex-col gap-0 py-1.5"
              >
                <span className="text-lg font-bold tracking-tight leading-none text-[color:var(--lkv-primary)]">
                  {sortiesCount || clubsCount}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[color:var(--lkv-text-muted)]">
                  Sorties
                </span>
              </Button>

              <div className="flex flex-col items-center py-1.5">
                <span className="text-lg font-bold tracking-tight leading-none text-[color:var(--lkv-primary)]">
                  {badges.length}
                </span>
                <span className="text-[11px] mt-1 font-medium text-[color:var(--lkv-text-muted)]">
                  Badges
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-[19px] font-display font-bold tracking-tight text-[color:var(--lkv-primary)]">
                {fullName}
              </h2>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--lkv-primary)" aria-hidden="true">
                <path d="M12 1l2.4 2.2 3.2-.4.8 3.2 3 1.4-1.2 3 1.2 3-3 1.4-.8 3.2-3.2-.4L12 20l-2.4-1.4-3.2.4-.8-3.2-3-1.4 1.2-3-1.2-3 3-1.4.8-3.2 3.2.4L12 1zm-1.2 12.6l6-6-1.4-1.4-4.6 4.6-2-2-1.4 1.4 3.4 3.4z" />
              </svg>
              <Chip
                onClick={() => {
                  triggerHaptic('light');
                  setTrustModalOpen(true);
                }}
                className="px-2.5 text-[10px] font-mono font-bold"
              >
                🛡️ Trust {trustScore}/100
              </Chip>
            </div>

            <p className="text-xs font-mono text-[color:var(--lkv-text-muted)]">
              {handleName} · {levelTitle}
            </p>

            {profile.bio && (
              <p className="text-sm font-serif italic leading-snug pt-1 text-[color:var(--lkv-primary)]">
                {profile.bio}
              </p>
            )}

            {profile.location && (
              <div className="flex items-center gap-1 text-xs pt-1 text-[color:var(--lkv-text-muted)] font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{profile.location}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button
              variant={following ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleFollowToggle}
              className="flex-1 font-bold"
            >
              {following ? '✓ Abonné' : "+ S'abonner"}
            </Button>

            <Link
              href={`/messagerie?dest=${profile.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-[var(--space-2)] min-h-[var(--control-height-sm)] rounded-full px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-semibold border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
            >
              <Icon name="message-square" size={13} />
              Message
            </Link>

            <IconButton
              variant="glass"
              size="md"
              aria-label="Partager"
              onClick={() => {
                triggerHaptic('light');
                onShare();
              }}
            >
              <Icon name="share2" size={14} />
            </IconButton>
          </div>
        </Card>
      </section>

      {highlights.length > 0 && (
        <section className="px-3 py-1.5">
          <Card variant="featured" className="p-3">
            <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x">
              {highlights.map((h) => (
                <Link
                  key={h.id}
                  href={`/carnets/${h.id}`}
                        className="flex w-[62px] flex-col items-center gap-1 shrink-0 snap-start active:scale-95 transition-transform cursor-pointer"
                >
                  <div className="w-[54px] h-[54px] rounded-full p-[2px] relative flex items-center justify-center shadow-2xs bg-gradient-to-br from-[color:var(--sage-300)] to-[color:var(--lkv-primary)]">
                    <div className="w-full h-full rounded-full overflow-hidden border border-[color:var(--lkv-surface-card)]">
                      <SmartImage
                        src={h.cover}
                        alt={h.label}
                        fill
                        className="w-full h-full"
                        fallbackIcon={<Icon name="book-open" size={16} />}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center text-[color:var(--lkv-primary)]">
                    {h.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      )}

      <div className="sticky top-[var(--safe-top)] z-[var(--z-sticky)] px-3 py-1.5">
        <Card variant="featured" className="p-1 flex items-center justify-between gap-1">
          <div className="flex min-w-0 flex-1 items-center">
            <Tabs
              options={[
                { id: 'tout', label: 'Récits', icon: '⚡' },
                { id: 'carnets', label: 'Carnets', icon: '📖' },
                { id: 'clubs', label: 'Clubs', icon: '⛺' },
                { id: 'badges', label: 'Badges', icon: '🛡️' },
              ]}
              value={tab}
              onChange={(id) => {
                triggerHaptic('selection');
                setTab(id as TabKey);
              }}
              variant="scrollable"
              ariaLabel="Sections du profil"
              className="w-auto pb-0"
            />
          </div>

          {tab !== 'badges' && (
            <div className="flex items-center gap-0.5 pl-1.5 pr-0.5 border-l border-[color:var(--lkv-primary)]/10">
              <IconButton
                variant={viewMode === 'grid' ? 'solid' : 'ghost'}
                size="sm"
                aria-label="Vue Grille"
                aria-pressed={viewMode === 'grid'}
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('grid');
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </IconButton>
              <IconButton
                variant={viewMode === 'list' ? 'solid' : 'ghost'}
                size="sm"
                aria-label="Vue Liste"
                aria-pressed={viewMode === 'list'}
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('list');
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <circle cx="4" cy="6" r="1.2" fill="currentColor" />
                  <circle cx="4" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="4" cy="18" r="1.2" fill="currentColor" />
                </svg>
              </IconButton>
            </div>
          )}
        </Card>
      </div>

      {tab === 'badges' && (
        <section className="p-3 space-y-3">
          <Card variant="featured" className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">🛡️</span>
              <div>
                <h3 className="text-sm font-bold text-[color:var(--lkv-primary)]">
                  Indice de Confiance Voyageur
                </h3>
                <p className="text-xs text-[color:var(--lkv-text-muted)]">
                  Vérification d&apos;identité et sorties certifiées.
                </p>
              </div>
            </div>
            <span className="font-mono text-base font-bold text-[color:var(--lkv-primary)]">
              {trustScore}/100
            </span>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {badges.length === 0 ? (
              <div className="col-span-3">
                <EmptyState compact title="Aucun badge" description="Aucun badge débloqué pour le moment." />
              </div>
            ) : (
              badges.map((b) => (
                <Card key={b.id} variant="featured" className="p-3 text-center">
                  <span className="text-2xl" aria-hidden="true">🏅</span>
                  <p className="text-[11px] font-bold mt-1 text-[color:var(--lkv-primary)] truncate">
                    {b.title}
                  </p>
                  <p className="text-[9px] text-[color:var(--lkv-text-muted)] truncate">
                    Badge certifié
                  </p>
                </Card>
              ))
            )}
          </div>
        </section>
      )}

      {tab === 'clubs' && (
        <section className="p-3 space-y-2.5">
          {clubs.length === 0 ? (
            <EmptyState compact title="Aucun club" description="Aucun club rejoint pour le moment." />
          ) : (
            clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug || club.id}`}
                    className="block active:scale-[0.98] transition-transform"
              >
                <Card variant="featured" className="flex items-center gap-3.5 p-3">
                  <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-[color:var(--lkv-border)] shadow-2xs">
                    <SmartImage
                      src={club.logo_url}
                      alt={club.name}
                      fill
                      className="w-full h-full"
                      fallbackIcon={<Icon name="tent" size={16} />}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[color:var(--lkv-primary)] truncate">{club.name}</h4>
                    <p className="text-[11px] text-[color:var(--lkv-text-muted)] truncate">📍 {club.detail || 'Outdoor Club'}</p>
                  </div>
                  <Badge tone="stone" className="text-[10px]">
                    {club.members_count ?? 1} membres
                  </Badge>
                </Card>
              </Link>
            ))
          )}
        </section>
      )}

      {(tab === 'tout' || tab === 'carnets') && (
        <section>
          {carnets.length === 0 ? (
            <div className="m-3">
              <EmptyState
                title="Aucun carnet public"
                description="Ce voyageur n'a pas encore publié d'expédition publique."
              />
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-2.5 p-3">
              {carnets.map((c) => (
                <Link
                  key={c.id}
                  href={`/carnets/${c.id}`}
                        className="aspect-square relative overflow-hidden rounded-2xl border border-[color:var(--lkv-border)] shadow-2xs block active:scale-95 transition-transform cursor-pointer"
                >
                  <SmartImage
                    src={c.image_url}
                    alt={c.title}
                    fill
                    className="absolute inset-0"
                    fallbackIcon={<Icon name="book-open" size={16} />}
                  />
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-md bg-black/40 backdrop-blur-md flex items-center justify-center text-white text-[10px]">
                    📖
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <p className="text-[10px] font-bold text-white drop-shadow-sm truncate">{c.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-2.5">
              {carnets.map((c) => (
                <Link
                  key={c.id}
                  href={`/carnets/${c.id}`}
                        className="block active:scale-[0.98] transition-transform"
                >
                  <Card variant="featured" className="flex gap-3.5 p-3">
                    <div className="w-20 h-20 rounded-xl shrink-0 overflow-hidden border border-[color:var(--lkv-border)] shadow-2xs">
                      <SmartImage
                        src={c.image_url}
                        alt={c.title}
                        fill
                        className="w-full h-full"
                        fallbackIcon={<Icon name="book-open" size={16} />}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-[color:var(--lkv-primary)]">
                          Carnet d&apos;aventure
                        </span>
                        <h4 className="text-sm font-bold leading-tight mt-0.5 text-[color:var(--lkv-primary)]">
                          {c.title}
                        </h4>
                        <p className="text-xs mt-0.5 font-medium text-[color:var(--lkv-text-muted)]">
                          📍 Expédition outdoor
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge tone="stone" className="text-[10px]">
                          {c.status || 'Publié'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {tab === 'tout' && (
            <div className="p-3">
              <h3 className="mb-[var(--space-2)] text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
                Activité récente
              </h3>
              {activite.length === 0 ? (
                <EmptyState compact title="Aucune activité" description="Ce voyageur n'a pas encore d'activité publique." />
              ) : (
                <Card variant="standard" className="p-0 divide-y divide-[color:var(--lkv-border)]">
                  {activite.slice(0, 5).map((item) => (
                    <ListItem
                      key={item.id}
                      leading={
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lkv-surface-muted)] text-[color:var(--lkv-primary)]">
                          <Icon name={ACTIVITY_ICONS[item.icon_type] ?? 'compass'} size={14} />
                        </span>
                      }
                      title={item.text}
                      subtitle={item.highlight}
                      metadata={item.time}
                    />
                  ))}
                </Card>
              )}
            </div>
          )}

          <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-subtle)]">
            — fin · {carnets.length} carnet{carnets.length > 1 ? 's' : ''} —
          </div>
        </section>
      )}

      {trustModalOpen && (
        <Sheet
          open
          onOpenChange={(next) => {
            if (!next) setTrustModalOpen(false);
          }}
          title="Indice de Confiance"
          description={`Score de Confiance : ${trustScore}/100`}
          detent="medium"
        >
          <div className="space-y-4">
            <p className="text-xs text-[color:var(--lkv-text-muted)] leading-relaxed">
              Ce score certifie la fiabilité de <strong>{fullName}</strong> au sein de la communauté Le Kit du Voyageur (sorties réalisées, avis vérifiés et respect de la charte outdoor).
            </p>

            <Button
              variant="primary"
              fullWidth
              onClick={() => setTrustModalOpen(false)}
              className="font-bold"
            >
              Fermer
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
