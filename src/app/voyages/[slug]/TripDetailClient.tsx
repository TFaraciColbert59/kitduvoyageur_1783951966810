'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import { TripHero } from '@/features/trips/components/TripHero';
import { TripOverviewTab } from '@/features/trips/components/TripOverviewTab';
import { TripItineraryTab } from '@/features/trips/components/TripItineraryTab';
import { TripPlaceholderTab } from '@/features/trips/components/TripPlaceholderTab';
import { TripBadge } from '@/features/trips/components/TripBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Compass,
  Navigation,
  Users,
  Package,
  CreditCard,
  FileText,
  Shield,
  BookOpen,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';
import { TripAffiliateSection, type AffiliateLink } from '@/features/affiliation';
import { TripKitView } from '@/features/trips/components/TripKitView';
import { TripTeamView } from '@/features/trips/components/TripTeamView';
import { TripBudgetView } from '@/features/trips/components/TripBudgetView';
import { TripDocumentsView } from '@/features/trips/components/TripDocumentsView';
import { TripShareModal } from '@/features/trips/components/TripShareModal';
import { TripOfflineBar } from '@/features/trips/components/TripOfflineBar';

export interface TripDetailClientProps {
  trip: TripFull;
  stats: TripStats;
  affiliateLinks?: AffiliateLink[];
  kitAnalysis?: TripKitAnalysis;
}

export default function TripDetailClient({
  trip,
  stats,
  affiliateLinks = [],
  kitAnalysis,
}: TripDetailClientProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isShareOpen, setIsShareOpen] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Vue d’ensemble', Icon: Compass, count: undefined },
    { id: 'steps', label: 'Itinéraire', Icon: Navigation, count: trip.steps.length },
    { id: 'team', label: 'Équipe', Icon: Users, count: trip.collaborators.length },
    { id: 'gear', label: 'Équipement', Icon: Package, count: trip.items.length },
    { id: 'budget', label: 'Budget', Icon: CreditCard, count: trip.expenses.length },
    ...(trip.permissions.canViewDocuments
      ? [{ id: 'docs', label: 'Documents', Icon: FileText, count: trip.documents.length }]
      : []),
    { id: 'safety', label: 'Sécurité', Icon: Shield, count: trip.safety_checkpoints.length },
    { id: 'notes', label: 'Carnet', Icon: BookOpen, count: trip.notes.length },
  ];

  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 space-y-4">
        {/* Navigation fil d'Ariane & Action Partager */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs text-[#5B7F55]">
            <Link href="/voyages" className="hover:underline flex items-center gap-1 font-medium">
              <ArrowLeft size={13} />
              Voyages
            </Link>
            <span>/</span>
            <span className="text-[#17402C] font-semibold truncate max-w-[180px] sm:max-w-md">
              {trip.title}
            </span>
          </div>

          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-semibold text-[#17402C] border border-black/10 shadow-2xs transition-all hover:scale-102"
          >
            <Share2 size={13} className="text-[#5B7F55]" />
            <span>Partager / Exporter</span>
          </button>
        </div>

        {/* Barre de statut Hors-Ligne */}
        <TripOfflineBar trip={trip} />

        {/* 1. Hero Immersif */}
        <TripHero trip={trip} />

        {/* 2. Onglets Navigation Scrollable Liquid Glass */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-md scale-100'
                    : 'bg-white/70 hover:bg-white text-[#17402C] border-white/80 hover:border-black/10 backdrop-blur-sm'
                }`}
              >
                <Icon
                  size={15}
                  className={isActive ? 'text-[#A6C1A0]' : 'text-[#5B7F55]'}
                />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-[#5B7F55]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3. Contenu de l'onglet actif */}
        <main>
          {/* Onglet 1 : Vue d'ensemble (Complet C1 + C5 Affiliation) */}
          {activeTab === 'overview' && (
            <>
              <TripOverviewTab trip={trip} stats={stats} onTabChange={setActiveTab} />
              {affiliateLinks.length > 0 && (
                <TripAffiliateSection
                  links={affiliateLinks}
                  tripId={trip.id}
                  countryNames={trip.destination_name ? [trip.destination_name] : []}
                />
              )}
            </>
          )}

          {/* Onglet 2 : Itinéraire (Complet C2) */}
          {activeTab === 'steps' && (
            <TripItineraryTab trip={trip} stats={stats} />
          )}

          {/* Onglet 3 : Équipe (Chantier 7 - Collaboratif & Rôles) */}
          {activeTab === 'team' && (
            <TripTeamView trip={trip} />
          )}

          {/* Onglet 4 : Équipement & Kit Contextuel (Chantier 6) */}
          {activeTab === 'gear' && kitAnalysis && (
            <TripKitView trip={trip} analysis={kitAnalysis} />
          )}

          {activeTab === 'gear' && !kitAnalysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#17402C]">Équipements du voyage</h3>
                <Link
                  href={`/voyages/${trip.slug}/kit`}
                  className="px-4 py-2 rounded-xl bg-[#17402C] text-white text-xs font-bold hover:bg-[#123323] transition-all"
                >
                  Ouvrir le Kit Contextuel Complet
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trip.items.map(item => (
                  <GlassCard key={item.id} tone="neutral" className="p-3.5 rounded-[18px] border border-white/60">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-[#17402C]">{item.item_name}</div>
                        <div className="text-xs text-[#5B7F55]">
                          {item.category || 'Général'} · Qté : {item.quantity}
                          {item.weight_grams ? ` · ${item.weight_grams}g` : ''}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.is_packed
                            ? 'bg-[#5B7F55]/20 text-[#17402C]'
                            : 'bg-black/5 text-gray-500'
                        }`}
                      >
                        {item.is_packed ? 'Emballé' : 'À préparer'}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Onglet 5 : Budget (Chantier 7 - Budget & Dépenses) */}
          {activeTab === 'budget' && (
            <TripBudgetView trip={trip} />
          )}

          {/* Onglet 6 : Documents (Chantier 7 - Papiers chiffrés & RGPD) */}
          {activeTab === 'docs' && trip.permissions.canViewDocuments && (
            <TripDocumentsView trip={trip} />
          )}

          {/* Onglet 7 : Sécurité (Chantier 7 / 8) */}
          {activeTab === 'safety' && (
            <TripPlaceholderTab
              chantierNumber={7}
              chantierTitle="Intégration IA & Copilote Terrain (Checkpoints, Météo, SOS)"
              description="Ce module surveillera la progression sur le terrain, enverra des alertes météo automatiques et gérera les checkpoints de sécurité avec vos proches."
              icon={<Shield size={24} />}
              hasData={trip.safety_checkpoints.length > 0}
              emptyMessage="Aucun checkpoint de sécurité configuré."
            >
              <div className="space-y-3">
                {trip.safety_checkpoints.map(cp => (
                  <GlassCard key={cp.id} tone="neutral" className="p-3.5 rounded-[18px] border border-white/60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#17402C]">{cp.label}</div>
                        <div className="text-xs text-[#5B7F55]">
                          Prévu le : {new Date(cp.scheduled_at).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-[#5B7F55]">
                        {cp.status}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </TripPlaceholderTab>
          )}

          {/* Onglet 8 : Carnet (Chantier 8) */}
          {activeTab === 'notes' && (
            <TripPlaceholderTab
              chantierNumber={8}
              chantierTitle="Rétrospective & Carnet Communautaire (Récit, Photos, Publication)"
              description="Ce module permettra de rédiger le récit de voyage, d'associer des photos géolocalisées et de publier votre aventure dans la communauté LKDV."
              icon={<BookOpen size={24} />}
              hasData={trip.notes.length > 0}
              emptyMessage="Aucune note enregistrée dans ce carnet de bord."
            >
              <div className="space-y-3">
                {trip.notes.map(note => (
                  <GlassCard key={note.id} tone="neutral" className="p-4 rounded-[20px] border border-white/60">
                    {note.title && <h4 className="font-semibold text-[#17402C] mb-1">{note.title}</h4>}
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                    {note.day_number && (
                      <div className="text-xs text-[#5B7F55] mt-2">Jour {note.day_number}</div>
                    )}
                  </GlassCard>
                ))}
              </div>
            </TripPlaceholderTab>
          )}
        </main>

        {/* Modal de partage & export */}
        <TripShareModal
          trip={trip}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      </div>
    </AppShell>
  );
}
