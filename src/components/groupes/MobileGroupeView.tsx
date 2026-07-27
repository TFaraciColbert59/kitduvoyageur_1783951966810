import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import TachesCard from './TachesCard';
import EquipementCard from './EquipementCard';
import DepensesCard from './DepensesCard';
import DecisionsCard from './DecisionsCard';
import DiscussionCard from './DiscussionCard';
import VoyageursCard from './VoyageursCard';

interface MobileGroupeViewProps {
  data: any;
  groupId?: string;
  user?: any;
  members?: any[];
  onRefresh?: () => void;
}

export default function MobileGroupeView({ data, groupId, user, members, onRefresh }: MobileGroupeViewProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'tasks' | 'equipment' | 'expenses' | 'decisions' | 'discussion' | 'members'>('overview');

  const sections = [
    { id: 'overview', label: 'Aperçu', icon: 'HomeIcon' },
    { id: 'tasks', label: 'Tâches', icon: 'ClipboardDocumentListIcon' },
    { id: 'equipment', label: 'Kit', icon: 'BackpackIcon' },
    { id: 'expenses', label: 'Budget', icon: 'CurrencyEuroIcon' },
    { id: 'decisions', label: 'Votes', icon: 'HandRaisedIcon' },
    { id: 'discussion', label: 'Chat', icon: 'ChatBubbleLeftRightIcon' },
    { id: 'members', label: 'Membres', icon: 'UserGroupIcon' },
  ] as const;

  return (
    <div className="md:hidden min-h-screen bg-[#F5F2E8] pb-24">
      {/* Header compact */}
      <div className="sticky top-0 z-50 bg-[#F5F2E8]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#1C2620]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1C2620] text-white flex items-center justify-center">
            <Icon name="MapIcon" size={18} />
          </div>
          <div>
            <h1 className="font-display font-semibold text-[#1C2620] leading-tight text-sm truncate max-w-[200px]">
              {data.meta.titlePrefix} {data.meta.titleSuffix}
            </h1>
            <p className="text-[10px] font-mono text-[#1C2620]/60">
              {data.meta.startDate} · {data.meta.durationDays}j · {data.travelers.length} voyageurs
            </p>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#1C2620]/70 hover:bg-[#1C2620]/5">
          <Icon name="Bars3Icon" size={24} />
        </button>
      </div>

      {/* Bandeau Countdown */}
      <div className="bg-[#33463C] text-[#E7E3D6] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="ClockIcon" size={16} className="text-[#E4501C]" />
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#E7E3D6]">DÉPART · DANS {data.meta.daysLeft} J</span>
        </div>
        <div className="flex -space-x-2">
          {data.travelers.slice(0, 3).map((t: any, i: number) => (
            <div key={t.id} className="w-6 h-6 rounded-full border border-[#33463C] bg-[#E7E3D6] text-[#1C2620] flex items-center justify-center text-[8px] font-bold z-10" style={{ zIndex: 10 - i }}>
              {t.name.charAt(0)}
            </div>
          ))}
          {data.travelers.length > 3 && (
            <div className="w-6 h-6 rounded-full border border-[#33463C] bg-[#E4501C] text-white flex items-center justify-center text-[8px] font-bold">
              +{data.travelers.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Section Tabs (scrollable) */}
      <div className="overflow-x-auto scrollbar-hide border-b border-[#1C2620]/10 bg-[#F5F2E8]">
        <div className="flex gap-1 px-3 py-2 min-w-max">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeSection === s.id
                  ? 'bg-[#1C2620] text-white'
                  : 'bg-white text-[#1C2620]/70 border border-[#1C2620]/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Overview */}
        {activeSection === 'overview' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-3 border border-[#1C2620]/10 text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/50 mb-1">Tâches</p>
                <p className="font-mono font-bold text-lg text-[#1C2620]">{data.tasks.filter((t: any) => !t.completed).length}</p>
                <p className="text-[9px] text-[#1C2620]/40">restantes</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-[#1C2620]/10 text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/50 mb-1">Budget</p>
                <p className="font-mono font-bold text-lg text-[#1C2620]">{data.expenses.perPerson}€</p>
                <p className="text-[9px] text-[#1C2620]/40">par pers.</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-[#1C2620]/10 text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#1C2620]/50 mb-1">Kit</p>
                <p className="font-mono font-bold text-lg text-[#1C2620]">{data.equipment.length}</p>
                <p className="text-[9px] text-[#1C2620]/40">items</p>
              </div>
            </div>

            {/* Quick Tasks */}
            <TachesCard tasks={data.tasks} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
            <EquipementCard equipment={data.equipment} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
          </>
        )}

        {activeSection === 'tasks' && (
          <TachesCard tasks={data.tasks} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
        )}

        {activeSection === 'equipment' && (
          <EquipementCard equipment={data.equipment} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
        )}

        {activeSection === 'expenses' && (
          <DepensesCard expenses={data.expenses} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
        )}

        {activeSection === 'decisions' && (
          <DecisionsCard decisions={data.decisions} groupId={groupId} onRefresh={onRefresh} user={user} />
        )}

        {activeSection === 'discussion' && (
          <DiscussionCard discussions={data.discussions} groupId={groupId} onRefresh={onRefresh} user={user} />
        )}

        {activeSection === 'members' && (
          <VoyageursCard travelers={data.travelers} groupId={groupId} onRefresh={onRefresh} user={user} members={members} />
        )}
      </div>

      {/* Bottom Nav Mobile */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#1C2620]/10 flex items-center justify-around px-2 pb-safe z-50">
        {[
          { id: 'overview' as const, icon: 'HomeIcon' },
          { id: 'tasks' as const, icon: 'ClipboardDocumentListIcon' },
          { id: 'discussion' as const, icon: 'ChatBubbleLeftRightIcon' },
          { id: 'expenses' as const, icon: 'CurrencyEuroIcon' },
          { id: 'members' as const, icon: 'UserGroupIcon' },
        ].map(nav => (
          <button
            key={nav.id}
            onClick={() => setActiveSection(nav.id)}
            className={`flex flex-col items-center justify-center w-12 h-12 ${
              activeSection === nav.id ? 'text-[#E4501C]' : 'text-[#1C2620]/50'
            }`}
          >
            <Icon name={nav.icon} size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}
