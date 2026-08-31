'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import TachesCard from './TachesCard';
import EquipementCard from './EquipementCard';
import DepensesCard from './DepensesCard';
import DecisionsCard from './DecisionsCard';
import DiscussionCard from './DiscussionCard';
import VoyageursCard from './VoyageursCard';
import ParcoursCard from './ParcoursCard';
import ProgressionCard from './ProgressionCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useToast } from '@/contexts/ToastContext';

interface MobileGroupeViewProps {
  data: any;
  groupId?: string;
  user?: any;
  members?: any[];
  onRefresh?: () => void;
}

export default function MobileGroupeView({ data, groupId, user, members, onRefresh }: MobileGroupeViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'overview' | 'parcours' | 'tasks' | 'equipment' | 'expenses' | 'decisions' | 'discussion' | 'members'>('overview');

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setActiveSection(e.detail);
      }
    };
    window.addEventListener('groupe-cockpit-tab-change', handler);
    return () => window.removeEventListener('groupe-cockpit-tab-change', handler);
  }, []);

  const handleCopyCode = () => {
    triggerHaptic('light');
    if (data.inviteCode && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(data.inviteCode);
      toast(`Code ${data.inviteCode} copié dans le presse-papier !`, 'success');
    }
  };

  const coverUrl = data.cover_url || data.meta?.coverUrl || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80';

  return (
    <div className="md:hidden min-h-screen bg-transparent pb-36 text-[#17402C]">
      {/* IMMERSIVE COVER HERO */}
      <div className="relative w-full h-64 sm:h-72 overflow-hidden bg-[#17402C]">
        <img
          src={coverUrl}
          alt={data.meta?.titlePrefix}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17402C] via-[#17402C]/60 to-transparent" />

        {/* Top Floating Controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <Link
            href="/groupes"
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center font-bold text-lg active:scale-95 transition-transform"
            aria-label="Retour"
          >
            ‹
          </Link>
          <div className="flex items-center gap-2">
            <span className="glass-pill text-white border-white/20 font-mono text-[10px] bg-white/10 backdrop-blur-md">
              {data.meta?.theme || 'Trek'} · {data.meta?.durationDays || 3}J
            </span>
          </div>
        </div>

        {/* Hero Title & Destination */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 block mb-1 font-bold">
            📍 {data.meta?.destination || 'Massif & Aventure'} · DÉPART DANS {data.meta?.daysLeft || 0}J
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white leading-tight">
            {data.meta?.titlePrefix} <em className="font-serif italic font-normal text-emerald-300">{data.meta?.titleSuffix}</em>
          </h1>
        </div>
      </div>

      {/* GROUP STATS & TRAVELERS ROW (Liquid Glass) */}
      <div className="px-4 -mt-3 relative z-20">
        <div className="glass bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Stacked Travelers */}
              <div className="flex -space-x-2">
                {data.travelers?.slice(0, 4).map((t: any, i: number) => (
                  <div
                    key={t.id || i}
                    className="w-8 h-8 rounded-full border-2 border-white bg-[#17402C] text-white flex items-center justify-center font-serif italic text-xs font-bold shadow-2xs"
                    style={{ zIndex: 10 - i }}
                    title={t.name}
                  >
                    {t.name?.charAt(0) || '👤'}
                  </div>
                ))}
                {data.travelers?.length > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#5C6B5E] text-white flex items-center justify-center font-mono font-bold text-[10px]">
                    +{data.travelers.length - 4}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-xs text-[#17402C]">
                  {data.travelers?.length || 1} co-voyageurs
                </h4>
                <span className="text-[10px] font-mono text-[#5C6B5E] font-medium">
                  Cockpit collaboratif
                </span>
              </div>
            </div>

            {/* Quick action: invite */}
            {data.inviteCode && (
              <button
                type="button"
                onClick={handleCopyCode}
                className="glass-capsule-btn py-1.5 px-3 text-[11px] font-mono font-bold"
              >
                <span className="relative z-10">🔑 {data.inviteCode}</span>
              </button>
            )}
          </div>

          {/* Progression gauge */}
          {data.meta?.progression !== undefined && (
            <div className="pt-2 border-t border-[#17402C]/10">
              <div className="flex items-center justify-between text-[10.5px] font-mono mb-1.5 font-bold">
                <span className="text-[#5C6B5E]">Préparation du sac & étapes</span>
                <span className="text-[#17402C]">{data.meta.progression}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#17402C]/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-[#17402C] rounded-full transition-all duration-500"
                  style={{ width: `${data.meta.progression}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION CONTENT WITH ANIMATED TRANSITIONS */}
      <div className="p-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* OVERVIEW */}
            {activeSection === 'overview' && (
              <div className="space-y-4">
                {/* Quick Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="glass bg-white/80 p-3 rounded-2xl text-center border border-white">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Tâches</p>
                    <p className="font-mono font-bold text-xl text-[#17402C]">
                      {data.tasks?.filter((t: any) => !t.completed).length || 0}
                    </p>
                    <p className="text-[9px] text-[#5C6B5E] font-mono">à faire</p>
                  </div>

                  <div className="glass bg-white/80 p-3 rounded-2xl text-center border border-white">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Budget</p>
                    <p className="font-mono font-bold text-xl text-[#17402C]">
                      {data.expenses?.perPerson || data.expenses?.total || 0} €
                    </p>
                    <p className="text-[9px] text-[#5C6B5E] font-mono">par pers.</p>
                  </div>

                  <div className="glass bg-white/80 p-3 rounded-2xl text-center border border-white">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1 font-bold">Matériel</p>
                    <p className="font-mono font-bold text-xl text-[#17402C]">
                      {data.equipment?.length || 0}
                    </p>
                    <p className="text-[9px] text-[#5C6B5E] font-mono">équipements</p>
                  </div>
                </div>

                {/* Parcours preview */}
                {groupId && <ParcoursCard groupId={groupId} trail={data.trail} meta={data.meta} />}

                {/* Tasks and equipment summaries */}
                <TachesCard tasks={data.tasks} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
                <EquipementCard equipment={data.equipment} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
              </div>
            )}

            {/* PARCOURS */}
            {activeSection === 'parcours' && groupId && (
              <ParcoursCard groupId={groupId} trail={data.trail} meta={data.meta} />
            )}

            {/* TÂCHES */}
            {activeSection === 'tasks' && (
              <TachesCard tasks={data.tasks} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
            )}

            {/* ÉQUIPEMENT */}
            {activeSection === 'equipment' && (
              <EquipementCard equipment={data.equipment} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
            )}

            {/* DÉPENSES / BUDGET */}
            {activeSection === 'expenses' && (
              <DepensesCard expenses={data.expenses} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
            )}

            {/* DÉCISIONS / VOTES */}
            {activeSection === 'decisions' && (
              <DecisionsCard decisions={data.decisions} groupId={groupId} onRefresh={onRefresh} user={user} />
            )}

            {/* DISCUSSION / CHAT */}
            {activeSection === 'discussion' && (
              <DiscussionCard discussions={data.discussions} groupId={groupId} onRefresh={onRefresh} user={user} />
            )}

            {/* MEMBRES */}
            {activeSection === 'members' && (
              <VoyageursCard travelers={data.travelers} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

