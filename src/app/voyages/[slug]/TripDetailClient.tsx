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
} from 'lucide-react';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';

export interface TripDetailClientProps {
  trip: TripFull;
  stats: TripStats;
}

export default function TripDetailClient({ trip, stats }: TripDetailClientProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28">
        {/* Navigation fil d'Ariane */}
        <div className="flex items-center gap-2 text-xs text-[#5B7F55] mb-4">
          <Link href="/voyages" className="hover:underline flex items-center gap-1 font-medium">
            <ArrowLeft size={13} />
            Voyages
          </Link>
          <span>/</span>
          <span className="text-[#17402C] font-semibold truncate max-w-xs sm:max-w-md">
            {trip.title}
          </span>
        </div>

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
          {/* Onglet 1 : Vue d'ensemble (Complet C1) */}
          {activeTab === 'overview' && (
            <TripOverviewTab trip={trip} stats={stats} onTabChange={setActiveTab} />
          )}

          {/* Onglet 2 : Itinéraire (Complet C2) */}
          {activeTab === 'steps' && (
            <TripItineraryTab trip={trip} stats={stats} />
          )}

          {/* Onglet 3 : Équipe (Chantier 3) */}
          {activeTab === 'team' && (
            <TripPlaceholderTab
              chantierNumber={3}
              chantierTitle="Collaboration & Partage (Membres, invitations, droits)"
              description="Ce module permettra d'inviter des compagnons de voyage, d'attribuer des rôles fins (éditeur, lecteur), et de synchroniser les modifications en temps réel."
              icon={<Users size={24} />}
              hasData={trip.collaborators.length > 0}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trip.collaborators.map(collab => (
                  <GlassCard key={collab.id} tone="neutral" className="p-4 rounded-[20px] border border-white/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-sm">
                          {collab.user_id.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#17402C]">
                            {collab.profile?.full_name || 'Voyageur LKDV'}
                          </div>
                          <div className="text-xs text-[#5B7F55]">
                            Membre depuis le {new Date(collab.joined_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                      <TripBadge type="role" value={collab.role} size="sm" />
                    </div>
                  </GlassCard>
                ))}
              </div>
            </TripPlaceholderTab>
          )}

          {/* Onglet 4 : Équipement (Chantier 4) */}
          {activeTab === 'gear' && (
            <TripPlaceholderTab
              chantierNumber={4}
              chantierTitle="Préparation & Équipement (Liaison Sac à Dos, Poids, Shakedown)"
              description="Ce module synchronisera l'inventaire Mon Matériel de chaque participant avec le voyage pour calculer le poids total du sac à dos, détecter les manques et faire le shakedown."
              icon={<Package size={24} />}
              hasData={trip.items.length > 0}
              emptyMessage="Aucun équipement renseigné dans la liste pour le moment."
            >
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
            </TripPlaceholderTab>
          )}

          {/* Onglet 5 : Budget (Chantier 5) */}
          {activeTab === 'budget' && (
            <TripPlaceholderTab
              chantierNumber={5}
              chantierTitle="Budget & Dépenses (Split, Catégorisation, Multi-devises)"
              description="Ce module permettra d'enregistrer les dépenses partagées, de calculer qui doit combien à qui, et de suivre les dépenses réelles par rapport au budget prévisionnel."
              icon={<CreditCard size={24} />}
              hasData={trip.expenses.length > 0}
              emptyMessage="Aucune dépense enregistrée sur cette expédition."
            >
              <div className="space-y-3">
                {trip.expenses.map(exp => (
                  <GlassCard key={exp.id} tone="neutral" className="p-3.5 rounded-[18px] border border-white/60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#17402C]">{exp.title}</div>
                        <div className="text-xs text-[#5B7F55]">
                          {exp.category || 'Dépense'} · {exp.expense_date}
                        </div>
                      </div>
                      <div className="text-base font-bold text-[#17402C]">
                        {exp.amount} {exp.currency}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </TripPlaceholderTab>
          )}

          {/* Onglet 6 : Documents (Chantier 6) - Uniquement si autorisé */}
          {activeTab === 'docs' && trip.permissions.canViewDocuments && (
            <TripPlaceholderTab
              chantierNumber={6}
              chantierTitle="Documents & Réservations (Storage sécurisé, Offline, Chiffrement)"
              description="Ce module permettra de stocker les passeports, assurances, billets et réservations en mode sécurisé avec accès hors ligne garanti."
              icon={<FileText size={24} />}
              hasData={trip.documents.length > 0}
              emptyMessage="Aucun document attaché à ce voyage."
            >
              <div className="space-y-3">
                {trip.documents.map(doc => (
                  <GlassCard key={doc.id} tone="neutral" className="p-3.5 rounded-[18px] border border-white/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-[#5B7F55]" />
                        <div>
                          <div className="text-sm font-medium text-[#17402C]">{doc.title}</div>
                          <div className="text-xs text-[#5B7F55]">Catégorie : {doc.category}</div>
                        </div>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#5B7F55] underline hover:text-[#17402C]"
                      >
                        Consulter
                      </a>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </TripPlaceholderTab>
          )}

          {/* Onglet 7 : Sécurité (Chantier 7) */}
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
      </div>
    </AppShell>
  );
}
