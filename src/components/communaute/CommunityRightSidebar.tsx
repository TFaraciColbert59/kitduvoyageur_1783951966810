'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';

export default function CommunityRightSidebar() {
  const [joinedOutings, setJoinedOutings] = useState<Record<string, boolean>>({});

  const onlineMembers = [
    { name: 'Marceline Chevrier', role: 'Guide Chartreuse', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200', location: 'Charmant Som', status: 'Bivouac' },
    { name: 'Antoine Duprès', role: 'Marcheur solo', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200', location: 'Vercors', status: 'En marche' },
    { name: 'Léna Moreau', role: 'Traversée Alpe', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200', location: 'Belledonne', status: 'Refuge' },
  ];

  const upcomingOutings = [
    {
      id: 'out-1',
      title: 'Bivouac Crête des Arêtes',
      club: 'Cimes Partagées',
      date: 'Samedi 17 oct.',
      spotsLeft: 3,
      massif: 'Chartreuse',
    },
    {
      id: 'out-2',
      title: 'Traversée des Hauts Plateaux',
      club: 'Vercors Sauvage',
      date: 'Dimanche 18 oct.',
      spotsLeft: 2,
      massif: 'Vercors',
    },
  ];

  const topClubs = [
    { id: 'c-1', name: 'Cimes partagées', members: 48, emoji: '🏔️', category: 'Randonnée', slug: 'cimes-partagees' },
    { id: 'c-2', name: 'Bivouac & Étoiles', members: 36, emoji: '⛺', category: 'Bivouac', slug: 'bivouac-etoiles' },
    { id: 'c-3', name: 'Alpinistes du Dauphiné', members: 29, emoji: '🧗', category: 'Alpinisme', slug: 'alpinistes-dauphine' },
  ];

  const handleToggleOuting = (id: string, title: string) => {
    setJoinedOutings(prev => {
      const next = !prev[id];
      alert(next ? `Vous êtes inscrit à "${title}" !` : `Inscription annulée pour "${title}".`);
      return { ...prev, [id]: next };
    });
  };

  return (
    <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3.5 pb-8">
      {/* WIDGET 1: SUR LES SENTIERS (Membres en direct) */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-display font-bold text-xs text-[#17402C]">Sur les sentiers</h3>
          </div>
          <span className="glass-pill text-[8.5px] font-mono font-bold text-emerald-800">
            {onlineMembers.length} ACTIFS
          </span>
        </div>

        <div className="space-y-1.5">
          {onlineMembers.map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between p-2 rounded-xl bg-white/70 hover:bg-white transition-all shadow-2xs border border-white/60"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="w-8 h-8 rounded-full object-cover border border-[#17402C]/10"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#17402C] truncate">{m.name}</div>
                  <div className="text-[9.5px] text-[#5C6B5E] truncate">📍 {m.location}</div>
                </div>
              </div>

              <span className="text-[9px] font-mono font-bold bg-[#17402C]/8 text-[#17402C] px-1.5 py-0.5 rounded">
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* WIDGET 2: SORTIES CE WEEK-END */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Sorties ce week-end</h3>
          <span className="glass-pill text-[8.5px] font-mono font-bold text-[#17402C]">
            {upcomingOutings.length}
          </span>
        </div>

        <div className="space-y-2">
          {upcomingOutings.map((out) => {
            const isJoined = !!joinedOutings[out.id];
            return (
              <div
                key={out.id}
                className="p-2.5 rounded-xl bg-white/75 hover:bg-white border border-white/70 space-y-2 shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                    📅 {out.date}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-[#D97746]">
                    {out.spotsLeft} places
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-display font-bold text-xs text-[#17402C] leading-snug truncate">
                      {out.title}
                    </h4>
                    <p className="text-[9.5px] text-[#5C6B5E] truncate">Par {out.club}</p>
                  </div>

                  {/* Circular glass button from Image 3 without text */}
                  <GlassIconButton
                    size="sm"
                    title={isJoined ? "Inscrit (cliquer pour annuler)" : "S'inscrire à la sortie"}
                    active={isJoined}
                    onClick={() => handleToggleOuting(out.id, out.title)}
                    icon={
                      <Icon
                        name={isJoined ? "CheckIcon" : "UserPlusIcon"}
                        size={13}
                        className={isJoined ? "text-emerald-700" : "text-[#17402C]"}
                      />
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WIDGET 3: TOP CLUBS */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Clubs populaires</h3>
          <Link href="/communaute?tab=clubs">
            <GlassIconButton
              size="sm"
              title="Voir tous les clubs"
              icon={<Icon name="ArrowRightIcon" size={12} />}
            />
          </Link>
        </div>

        <div className="space-y-1.5">
          {topClubs.map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.slug}`}
              className="flex items-center justify-between p-2 rounded-xl bg-white/70 hover:bg-white transition-all shadow-2xs border border-white/60 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{club.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#17402C] truncate group-hover:text-emerald-800 transition-colors">
                    {club.name}
                  </div>
                  <div className="text-[9px] text-[#5C6B5E] truncate">{club.category}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9.5px] font-mono text-[#5C6B5E]">
                  {club.members}
                </span>
                <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-[#17402C] group-hover:bg-[#17402C] group-hover:text-white transition-colors">
                  <Icon name="ChevronRightIcon" size={11} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* WIDGET 4: CHARTE DE LA MAISON */}
      <div className="glass tone-sand p-3.5 space-y-2 rounded-2xl text-[#17402C] border border-[#C89A3B]/30 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="glass-pill text-[8.5px] font-mono font-bold text-[#8C6418]">
            🌲 ÉTHIQUE TERRAIN
          </span>
          <span className="text-xs">⛺</span>
        </div>
        <h3 className="font-display font-bold text-xs text-[#17402C]">
          L’Esprit de la Maison
        </h3>
        <p className="text-[10.5px] text-[#5C6B5E] leading-relaxed">
          Zéro trace en bivouac, respect du silence des crêtes et entraide sincère entre marcheurs de tous niveaux.
        </p>
      </div>
    </aside>
  );
}
