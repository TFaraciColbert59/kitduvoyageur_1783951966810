'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import ClubDiscussionCard from '@/components/clubs/ClubDiscussionCard';
import ClubFeaturedEventCard from '@/components/clubs/ClubFeaturedEventCard';
import ClubTeamCard from '@/components/clubs/ClubTeamCard';
import ClubAboutCard from '@/components/clubs/ClubAboutCard';
import ClubGroupsTab from '@/components/clubs/ClubGroupsTab';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card, EmptyState } from '@/components/ui';

interface MobileClubDetailViewProps {
  club: any;
  topics: any[];
  members: any[];
  events: any[];
  groups?: any[];
  user: any;
  isMember: boolean;
  onJoinToggle: () => Promise<void>;
  joining: boolean;
  onOpenCreatePost: () => void;
  onOpenGroup?: (group: any) => void | Promise<void>;
  onCreateGroup?: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onRefresh: () => void;
}

export default function MobileClubDetailView({
  club,
  topics,
  members,
  events,
  groups = [],
  user,
  isMember,
  onJoinToggle,
  joining,
  onOpenCreatePost,
  onOpenGroup,
  onCreateGroup,
  onRefresh,
}: MobileClubDetailViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeSection, setActiveSection] = useState<'overview' | 'events' | 'groups' | 'discussions' | 'members' | 'guides'>('overview');

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setActiveSection(e.detail);
      }
    };
    window.addEventListener('club-detail-tab-change', handler);
    return () => window.removeEventListener('club-detail-tab-change', handler);
  }, []);

  const validEvents = useMemo(() => {
    const future = events.filter((e: any) => {
      if (!e.date) return true;
      const d = new Date(e.date);
      return isNaN(d.getTime()) || d.getTime() >= new Date().setHours(0, 0, 0, 0);
    });
    return Array.from(new Map(future.map((e: any) => [e.id || e.title, e])).values());
  }, [events]);

  const clubDiscussions = useMemo(() => {
    return topics.map((t: any) => ({
      id: t.id,
      author: t.author?.full_name || 'Membre',
      author_id: t.author_id,
      author_avatar: t.author?.avatar_url,
      time: new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      content: t.content,
      likes: t.likes_count || 0,
      replies: t.replies_count || 0,
      is_pinned: t.is_pinned,
      is_guide: t.title?.toLowerCase().includes('guide'),
      title: t.title,
    }));
  }, [topics]);

  const admins = useMemo(() => {
    const list = members.filter((m: any) => m.role === 'admin' || m.role === 'moderator');
    return list.length > 0 ? list : members.slice(0, 3);
  }, [members]);

  const coverUrl = club.cover_image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80';

  return (
    <div className="min-h-full bg-transparent text-[color:var(--lkv-text-primary)] md:hidden">
      <div className="relative h-64 w-full overflow-hidden bg-[color:var(--btn-tint)] sm:h-72">
        <img
          src={coverUrl}
          alt={club.name}
          className="h-full w-full object-cover opacity-60"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[color:var(--lkv-primary)] via-[color:var(--lkv-primary)]/60 to-transparent" />

        <div className="absolute left-4 right-4 top-[calc(max(var(--safe-top),12px)+6px)] z-10 flex items-center justify-between">
          <Link
            href="/clubs"
            onClick={() => triggerHaptic('light')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-title-sm)] text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]"
            aria-label="Retour aux clubs"
          >
            ‹
          </Link>
          <div className="flex items-center gap-[var(--space-2)]">
            <Badge className="border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] font-mono text-[color:var(--lkv-text-inverted)] backdrop-blur-[var(--blur-md)]">
              {club.category || 'Collectif'} · {club.type === 'activite' ? '⚡ Activité' : '🌍 Région'}
            </Badge>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10">
          <span className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-forest-300)]">
            {club.emoji || '🏕️'} COLLECTIF OFFICIEL
          </span>
          <h1 className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold leading-tight text-[color:var(--lkv-text-inverted)] sm:text-[length:var(--lkv-text-title-lg)]">
            {club.name}
          </h1>
        </div>
      </div>

      <div className="relative z-20 -mt-[var(--space-3)] px-[var(--space-4)]">
        <Card className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex -space-x-2">
                {members.slice(0, 4).map((m: any, i: number) => (
                  <div
                    key={m.id || i}
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--lkv-surface-card)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn font-serif text-[length:var(--lkv-text-caption-2)] font-bold italic text-[color:var(--lkv-text-primary)]"
                    style={{ zIndex: 10 - i }}
                  >
                    {m.user?.avatar_url ? (
                      <img src={m.user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      m.user?.full_name?.charAt(0) || '👤'
                    )}
                  </div>
                ))}
                {members.length > 4 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--lkv-surface-card)] bg-[color:var(--lkv-secondary)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-inverted)]">
                    +{members.length - 4}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                  {club.members_count || members.length || 1} membres
                </h4>
                <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {club.active_this_month || 12} actifs ce mois-ci
                </span>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant={isMember ? 'secondary' : 'primary'}
              disabled={joining}
              loading={joining}
              onClick={() => {
                triggerHaptic('selection');
                onJoinToggle();
              }}
            >
              {joining ? '...' : isMember ? '✓ Membre' : '+ Rejoindre'}
            </Button>
          </div>

          {club.description && (
            <p className="border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-1)] text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
              {club.description}
            </p>
          )}
        </Card>
      </div>

      <div className="p-[var(--space-4)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-[var(--space-4)]"
          >
            {activeSection === 'overview' && (
              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-3 gap-[var(--space-2)]">
                  <Card variant="compact" className="text-center">
                    <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Sorties</p>
                    <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{validEvents.length}</p>
                    <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">programmées</p>
                  </Card>
                  <Card variant="compact" className="text-center">
                    <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Échanges</p>
                    <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{topics.length}</p>
                    <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">sujets</p>
                  </Card>
                  <Card variant="compact" className="text-center">
                    <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">Collectif</p>
                    <p className="font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">{members.length}</p>
                    <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">aventuriers</p>
                  </Card>
                </div>

                <ClubAboutCard club={club} />

                {validEvents.length > 0 && (
                  <div className="space-y-[var(--space-2)]">
                    <div className="flex items-center justify-between px-[var(--space-1)]">
                      <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Prochaines sorties</h3>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveSection('events')}
                      >
                        Voir tout →
                      </Button>
                    </div>
                    {validEvents.slice(0, 2).map((ev: any) => (
                      <ClubFeaturedEventCard key={ev.id} event={ev} />
                    ))}
                  </div>
                )}

                <ClubDiscussionCard
                  clubId={club.id}
                  clubName={club.name}
                  discussions={clubDiscussions.slice(0, 4)}
                  onRefresh={onRefresh}
                  user={user}
                  filterType="all"
                />
              </div>
            )}

            {activeSection === 'events' && (
              <div className="space-y-[var(--space-3)]">
                <div className="flex items-center justify-between px-[var(--space-1)]">
                  <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Sorties & Rassemblements</h3>
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{validEvents.length} sorties</span>
                </div>
                {validEvents.length === 0 ? (
                  <Card className="p-[var(--space-6)]">
                    <EmptyState
                      icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>📅</span>}
                      title="Aucune sortie programmée"
                      description="Aucune sortie programmée pour le moment."
                    />
                  </Card>
                ) : (
                  validEvents.map((ev: any) => (
                    <ClubFeaturedEventCard key={ev.id} event={ev} />
                  ))
                )}
              </div>
            )}

            {activeSection === 'groups' && (
              <ClubGroupsTab
                club={club}
                groups={groups}
                members={members}
                user={user}
                isMember={isMember}
                compact
                onCreate={onCreateGroup ?? (async () => ({ ok: false, error: 'Indisponible.' }))}
                onOpenGroup={onOpenGroup ?? (() => {})}
              />
            )}

            {activeSection === 'discussions' && (
              <ClubDiscussionCard
                clubId={club.id}
                clubName={club.name}
                discussions={clubDiscussions}
                onRefresh={onRefresh}
                user={user}
                filterType="all"
              />
            )}

            {activeSection === 'members' && (
              <div className="space-y-[var(--space-3)]">
                <div className="flex items-center justify-between px-[var(--space-1)]">
                  <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Membres du collectif</h3>
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{members.length} membres</span>
                </div>
                <ClubTeamCard admins={admins} />
              </div>
            )}

            {activeSection === 'guides' && (
              <ClubDiscussionCard
                clubId={club.id}
                clubName={club.name}
                discussions={clubDiscussions}
                onRefresh={onRefresh}
                user={user}
                filterType="guides"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
