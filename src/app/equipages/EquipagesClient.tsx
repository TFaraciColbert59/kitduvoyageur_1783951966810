'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Sheet } from '@/components/ui/Sheet';
import { Tabs, type TabOption } from '@/components/ui/Tabs';
import {
  Users,
  Compass,
  Plus,
  ArrowRight,
  Shield,
  Crown,
  UserCheck,
  Calendar,
  KeyRound,
  Search,
} from 'lucide-react';
import type { CrewSummary } from '@/features/crews/types/crew.types';
import { joinCrewByCodeAction } from '@/features/crews/actions/crew-actions';

interface EquipagesClientProps {
  userCrews: CrewSummary[];
  publicCrews: CrewSummary[];
  currentUserId?: string | null;
}

const TABS: TabOption[] = [
  { id: 'mes-equipages', label: 'Mes Équipages' },
  { id: 'decouvrir', label: 'Explorer les Équipages' },
];

export function EquipagesClient({
  userCrews,
  publicCrews,
  currentUserId,
}: EquipagesClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('mes-equipages');
  const [search, setSearch] = useState('');
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [hasConsented, setHasConsented] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const filteredPublic = publicCrews.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    if (!hasConsented) {
      setJoinError('Vous devez accepter les conditions pour rejoindre cet équipage.');
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    const res = await joinCrewByCodeAction(joinCode.trim(), hasConsented);
    setJoinLoading(false);

    if (!res.success) {
      setJoinError(res.error || 'Erreur lors du rattachement.');
      return;
    }

    setIsJoinOpen(false);
    setJoinCode('');
    setHasConsented(false);
    if (res.data?.slug) {
      router.push(`/equipages/${res.data.slug}`);
    } else {
      router.refresh();
    }
  }

  return (
    <AppShell safeTop hasBottomNav>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header de la page */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-lkv-secondary uppercase tracking-wider">
                Collectifs & Randonnées
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-lkv-primary mt-1 tracking-tight">
              Équipages de Voyage
            </h1>
            <p className="text-sm text-lkv-text-muted mt-1 max-w-xl">
              Fédérez vos compagnons de route, partagez vos équipements collectifs et lancez vos expéditions à plusieurs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <LkvButton
              variant="secondary"
              size="sm"
              onClick={() => setIsJoinOpen(true)}
              className="gap-2 flex-1 sm:flex-initial"
            >
              <KeyRound size={15} />
              Rejoindre avec code
            </LkvButton>

            <Link href="/equipages/nouveau" className="flex-1 sm:flex-initial">
              <LkvButton variant="primary" size="sm" className="gap-2 w-full">
                <Plus size={16} />
                Créer un équipage
              </LkvButton>
            </Link>
          </div>
        </div>

        {/* Barre d'onglets unifiée */}
        <div className="max-w-md">
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            variant="segmented"
          />
        </div>

        {/* Contenu Onglet 1 : Mes Équipages */}
        {activeTab === 'mes-equipages' && (
          <div className="space-y-4">
            {!currentUserId ? (
              <EmptyState
                icon={<Users className="w-8 h-8" />}
                title="Connectez-vous pour voir vos équipages"
                description="Créez votre cercle de voyage ou rejoignez un groupe d'expédition avec un code d'invitation."
                actionLabel="Se connecter"
                actionHref="/connexion?next=/equipages"
              />
            ) : userCrews.length === 0 ? (
              <EmptyState
                icon={<Users className="w-8 h-8" />}
                title="Vous ne faites partie d'aucun équipage"
                description="Constituez votre premier équipage pour préparer vos randonnées et voyages en toute convivialité."
                actionLabel="Créer un équipage"
                actionHref="/equipages/nouveau"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {userCrews.map(crew => (
                  <Link
                    key={crew.id}
                    href={`/equipages/${crew.slug}`}
                    className="block group"
                  >
                    <GlassCard
                      tone="neutral"
                      className="p-5 rounded-xl border border-white/70 h-full flex flex-col justify-between transition-all duration-200 group-hover:shadow-md group-hover:border-lkv-primary/30"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-2xl bg-lkv-primary/10 text-lkv-primary flex items-center justify-center font-bold">
                              <Users size={18} />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-lkv-primary group-hover:text-lkv-secondary transition-colors">
                                {crew.name}
                              </h3>
                              <p className="text-xs text-lkv-text-muted">
                                {crew.theme} · Niveau {crew.level}
                              </p>
                            </div>
                          </div>

                          {crew.my_role && (
                            <Badge tone={crew.my_role === 'owner' ? 'sage' : 'stone'}>
                              {crew.my_role === 'owner' ? 'Fondateur' : 'Membre'}
                            </Badge>
                          )}
                        </div>

                        {crew.description && (
                          <p className="text-xs text-lkv-secondary mt-2 line-clamp-2 leading-relaxed">
                            {crew.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-lkv-secondary font-medium">
                        <span>{crew.member_count} membre{crew.member_count > 1 ? 's' : ''}</span>
                        {crew.next_trip ? (
                          <span className="text-lkv-primary font-semibold truncate max-w-[140px]">
                            {crew.next_trip.title}
                          </span>
                        ) : (
                          <span className="text-stone-400">Aucun voyage en cours</span>
                        )}
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contenu Onglet 2 : Découvrir */}
        {activeTab === 'decouvrir' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-lkv-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom d'équipage..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-lkv-primary/30"
              />
            </div>

            {filteredPublic.length === 0 ? (
              <EmptyState
                icon={<Compass className="w-8 h-8" />}
                title="Aucun équipage public trouvé"
                description={search ? `Aucun résultat pour "${search}".` : "Il n'y a pas encore d'équipage public disponible."}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPublic.map(crew => (
                  <Link
                    key={crew.id}
                    href={`/equipages/${crew.slug}`}
                    className="block group"
                  >
                    <GlassCard
                      tone="neutral"
                      className="p-5 rounded-xl border border-white/70 h-full flex flex-col justify-between transition-all duration-200 group-hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-base font-bold text-lkv-primary group-hover:text-lkv-secondary transition-colors">
                            {crew.name}
                          </h3>
                          <Badge tone="stone">{crew.theme}</Badge>
                        </div>
                        {crew.description && (
                          <p className="text-xs text-lkv-secondary line-clamp-2 leading-relaxed">
                            {crew.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-lkv-secondary">
                        <span>{crew.member_count} membre{crew.member_count > 1 ? 's' : ''}</span>
                        <span className="text-lkv-primary font-semibold flex items-center gap-1">
                          Voir la fiche <ArrowRight size={13} />
                        </span>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Rejoindre avec Consentement Explicite (D12 Fix) */}
        <Sheet
          isOpen={isJoinOpen}
          onClose={() => {
            setIsJoinOpen(false);
            setJoinError(null);
          }}
          title="Rejoindre un équipage"
          description="Saisissez le code fourni par l'organisateur de l'expédition."
        >
          <form onSubmit={handleJoinSubmit} className="p-6 space-y-4">
            {joinError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
                {joinError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-lkv-primary uppercase tracking-wider mb-1.5">
                Code d&apos;invitation
              </label>
              <input
                type="text"
                placeholder="EX: ALPES-2026"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 text-base font-mono uppercase tracking-widest text-lkv-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-lkv-primary"
              />
            </div>

            {/* Écran de consentement explicite (exigence 4.2) */}
            <div className="p-4 rounded-2xl bg-sand-500/10 border border-sand-500/20 text-xs text-sand-900 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasConsented}
                  onChange={e => setHasConsented(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-sand-400 text-lkv-primary focus:ring-lkv-primary"
                />
                <span className="leading-snug">
                  Je consens à rejoindre cet équipage et accepte de partager mon profil de voyageur (nom, matériel partagé et étapes) avec les autres membres.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <LkvButton
                type="button"
                variant="ghost"
                onClick={() => setIsJoinOpen(false)}
              >
                Annuler
              </LkvButton>

              <LkvButton
                type="submit"
                variant="primary"
                disabled={joinLoading || !joinCode || !hasConsented}
              >
                {joinLoading ? 'Vérification...' : 'Confirmer et rejoindre'}
              </LkvButton>
            </div>
          </form>
        </Sheet>
      </div>
    </AppShell>
  );
}
