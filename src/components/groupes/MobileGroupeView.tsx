import React, { useState } from 'react';
import Link from 'next/link';
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

interface MobileGroupeViewProps {
  data: any;
  groupId?: string;
  user?: any;
  members?: any[];
  onRefresh?: () => void;
}

export default function MobileGroupeView({ data, groupId, user, members, onRefresh }: MobileGroupeViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeSection, setActiveSection] = useState<'overview' | 'parcours' | 'tasks' | 'equipment' | 'expenses' | 'decisions' | 'discussion' | 'members'>('overview');

  const sections = [
    { id: 'overview', label: 'Cockpit', icon: 'HomeIcon' },
    { id: 'parcours', label: 'Parcours', icon: 'MapIcon' },
    { id: 'tasks', label: `Tâches (${data.tasks?.filter((t: any) => !t.completed).length || 0})`, icon: 'ClipboardDocumentListIcon' },
    { id: 'equipment', label: `Kit (${data.equipment?.length || 0})`, icon: 'BackpackIcon' },
    { id: 'expenses', label: 'Budget', icon: 'CurrencyEuroIcon' },
    { id: 'decisions', label: 'Sondages', icon: 'HandRaisedIcon' },
    { id: 'discussion', label: 'Chat', icon: 'ChatBubbleLeftRightIcon' },
    { id: 'members', label: `Membres (${data.travelers?.length || 0})`, icon: 'UserGroupIcon' },
  ] as const;

  const coverUrl = data.cover_url || data.meta?.coverUrl || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80';

  return (
    <div className="md:hidden min-h-screen bg-[#FBFAF6] pb-24 text-[#1C2620]">
      {/* ── IMMERSIVE COVER HERO (SCREEN 4 REFERENCE) ── */}
      <div className="relative w-full h-72 sm:h-80 overflow-hidden bg-[#17402C]">
        <img
          src={coverUrl}
          alt={data.meta?.titlePrefix}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F17] via-[#17402C]/60 to-transparent" />

        {/* Top Floating Controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <Link
            href="/groupes"
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/25 flex items-center justify-center text-lg active:scale-95 transition-all shadow-md"
            aria-label="Retour"
          >
            ‹
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-mono uppercase tracking-wider text-[#A8C4A2] border border-white/10">
              {data.meta?.theme || 'Trek'} · {data.meta?.durationDays || 3}J
            </span>
          </div>
        </div>

        {/* Hero Title & Destination */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#A8C4A2] block mb-1">
            📍 {data.meta?.destination || 'Massif & Aventure'} · DÉPART DANS {data.meta?.daysLeft || 0}J
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white leading-tight">
            {data.meta?.titlePrefix} <em className="font-serif italic font-normal text-[#A8C4A2]">{data.meta?.titleSuffix}</em>
          </h1>
        </div>
      </div>

      {/* ── GROUP STATS & TRAVELERS ROW ── */}
      <div className="px-4 -mt-3 relative z-20">
        <div className="bg-white rounded-[24px] p-4 border border-[#1C2620]/8 shadow-[0_4px_20px_rgba(11,31,23,0.06)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Stacked Travelers */}
              <div className="flex -space-x-2">
                {data.travelers?.slice(0, 4).map((t: any, i: number) => (
                  <div
                    key={t.id || i}
                    className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-[#17402C] to-[#2D6B4A] text-white flex items-center justify-center font-serif italic text-xs shadow-sm"
                    style={{ zIndex: 10 - i }}
                    title={t.name}
                  >
                    {t.name?.charAt(0) || '👤'}
                  </div>
                ))}
                {data.travelers?.length > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-[#A8C4A2] text-[#17402C] flex items-center justify-center font-mono font-bold text-[10px] shadow-sm">
                    +{data.travelers.length - 4}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-xs text-[#1C2620]">
                  {data.travelers?.length || 1} co-voyageurs
                </h4>
                <span className="text-[10px] font-mono text-[#5C6B5E]">
                  Cockpit collaboratif
                </span>
              </div>
            </div>

            {/* Quick action: invite */}
            {data.inviteCode && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  if (typeof navigator !== 'undefined') {
                    navigator.clipboard.writeText(data.inviteCode);
                    alert(`Code copié : ${data.inviteCode}`);
                  }
                }}
                className="px-3 py-1.5 bg-[#F5F2E8] hover:bg-[#EAE6DF] text-[#17402C] rounded-xl text-[11px] font-mono font-bold border border-[#17402C]/10 flex items-center gap-1.5 transition-colors"
              >
                <span>🔑</span>
                <span>{data.inviteCode}</span>
              </button>
            )}
          </div>

          {/* Progression gauge */}
          {data.meta?.progression !== undefined && (
            <div className="pt-2 border-t border-[#1C2620]/6">
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className="text-[#5C6B5E]">Préparation du sac & étapes</span>
                <span className="font-bold text-[#17402C]">{data.meta.progression}%</span>
              </div>
              <div className="w-full h-2 bg-[#F0EDE1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#17402C] rounded-full transition-all duration-500"
                  style={{ width: `${data.meta.progression}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── HORIZONTAL SCROLLABLE TABS ── */}
      <div className="px-4 pt-4">
        <div className="overflow-x-auto scrollbar-none flex gap-1.5 pb-1">
          {sections.map((s) => {
            const isSelected = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveSection(s.id);
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#17402C] text-white shadow-sm'
                    : 'bg-white text-[#5C6B5E] border border-[#1C2620]/8 hover:bg-[#F5F2E8]'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION CONTENT ── */}
      <div className="p-4 space-y-4">
        {/* OVERVIEW */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white rounded-2xl p-3.5 border border-[#1C2620]/8 shadow-sm text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1">Tâches</p>
                <p className="font-mono font-bold text-xl text-[#1C2620]">
                  {data.tasks?.filter((t: any) => !t.completed).length || 0}
                </p>
                <p className="text-[9px] text-[#5C6B5E]/70 font-mono">à faire</p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#1C2620]/8 shadow-sm text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1">Budget</p>
                <p className="font-mono font-bold text-xl text-[#17402C]">
                  {data.expenses?.perPerson || data.expenses?.total || 0} €
                </p>
                <p className="text-[9px] text-[#5C6B5E]/70 font-mono">par pers.</p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-[#1C2620]/8 shadow-sm text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#5C6B5E] mb-1">Matériel</p>
                <p className="font-mono font-bold text-xl text-[#1C2620]">
                  {data.equipment?.length || 0}
                </p>
                <p className="text-[9px] text-[#5C6B5E]/70 font-mono">équipements</p>
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
      </div>
    </div>
  );
}
