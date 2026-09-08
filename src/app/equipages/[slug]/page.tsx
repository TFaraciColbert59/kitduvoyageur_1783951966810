import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchCrewBySlug } from '@/lib/queries-crews';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Users,
  Compass,
  Calendar,
  Plus,
  ArrowLeft,
  KeyRound,
  Shield,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

interface CrewDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CrewDetailPage({ params }: CrewDetailPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const crew = await fetchCrewBySlug(slug, user?.id);
  if (!crew) {
    notFound();
  }

  return (
    <AppShell safeTop hasBottomNav>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Navigation retour */}
        <Link
          href="/equipages"
          className="inline-flex items-center gap-2 text-xs font-semibold text-lkv-secondary hover:text-lkv-primary transition-colors"
        >
          <ArrowLeft size={14} />
          Retour aux équipages
        </Link>

        {/* Fiche Équipage Header */}
        <GlassCard tone="sage" blur="md" className="p-6 sm:p-8 rounded-card border border-white/70">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-2xl bg-lkv-primary text-white shadow-md">
                <Users size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone="sage">{crew.theme}</Badge>
                  <span className="text-xs text-lkv-secondary font-medium">
                    Niveau {crew.level} ({crew.xp} XP)
                  </span>
                  <span className="text-xs text-lkv-secondary">·</span>
                  <span className="text-xs text-lkv-secondary font-medium">
                    {crew.members.length} / {crew.max_members} membres
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-lkv-primary mt-1">
                  {crew.name}
                </h1>
                {crew.description && (
                  <p className="text-xs sm:text-sm text-lkv-secondary mt-1.5 max-w-2xl leading-relaxed">
                    {crew.description}
                  </p>
                )}
              </div>
            </div>

            {crew.invite_code && crew.permissions.canInvite && (
              <div className="p-3 rounded-2xl bg-white/70 border border-white/80 shadow-xs text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-lkv-secondary font-bold">
                  Code d&apos;invitation
                </div>
                <div className="text-sm font-mono font-bold text-lkv-primary tracking-widest mt-0.5">
                  {crew.invite_code}
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Grille Principale : Membres & Voyages */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche (2/3) : Expéditions & Voyages du collectif */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-lkv-primary flex items-center gap-2">
                <Compass size={18} className="text-lkv-secondary" />
                Expéditions du collectif ({crew.trips.length})
              </h2>

              <Link href={`/voyages/nouveau?crew_id=${crew.id}`}>
                <LkvButton variant="secondary" size="sm" className="gap-1.5">
                  <Plus size={14} />
                  Nouvelle expédition
                </LkvButton>
              </Link>
            </div>

            {crew.trips.length === 0 ? (
              <EmptyState
                icon={<Compass className="w-8 h-8" />}
                title="Aucune expédition programmée"
                description="Cet équipage n'a pas encore lancé de voyage. Planifiez votre premier itinéraire ensemble."
                actionLabel="Planifier un voyage"
                actionHref={`/voyages/nouveau?crew_id=${crew.id}`}
              />
            ) : (
              <div className="space-y-3">
                {crew.trips.map(trip => (
                  <Link key={trip.id} href={`/voyages/${trip.slug}`} className="block group">
                    <GlassCard
                      tone="neutral"
                      className="p-4 rounded-lg border border-white/70 hover:border-lkv-primary/30 transition-all flex items-center justify-between gap-4"
                    >
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-lkv-primary group-hover:text-lkv-secondary transition-colors">
                          {trip.title}
                        </h3>
                        {trip.destination_name && (
                          <div className="text-xs text-lkv-secondary flex items-center gap-1 mt-0.5">
                            <MapPin size={12} />
                            {trip.destination_name}
                          </div>
                        )}
                        {trip.start_date && (
                          <div className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(trip.start_date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                      </div>

                      <Badge tone="stone">{trip.status}</Badge>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite (1/3) : Membres de l'équipage */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-lkv-primary flex items-center gap-2">
              <Users size={18} className="text-lkv-secondary" />
              Membres ({crew.members.length})
            </h2>

            <GlassCard tone="neutral" className="p-4 rounded-lg border border-white/70 space-y-3">
              {crew.members.map(member => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/40 border border-white/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-lkv-primary text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {member.profile?.full_name?.substring(0, 2) || member.user_id.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-lkv-primary truncate">
                        {member.profile?.full_name || 'Voyageur LKDV'}
                      </div>
                      <div className="text-[10px] text-lkv-secondary truncate">
                        {member.profile?.username ? `@${member.profile.username}` : 'Membre'}
                      </div>
                    </div>
                  </div>

                  <Badge tone={member.role === 'owner' ? 'sage' : 'stone'}>
                    {member.role === 'owner' ? 'Fondateur' : member.role === 'organizer' ? 'Organisateur' : 'Membre'}
                  </Badge>
                </div>
              ))}
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
