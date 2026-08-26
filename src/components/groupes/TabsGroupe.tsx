import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface TabsGroupeProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: any;
  layoutVariant?: 'horizontal' | 'vertical';
}

export default function TabsGroupe({ activeTab, setActiveTab, data, layoutVariant = 'horizontal' }: TabsGroupeProps) {
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: 'HomeIcon' },
    { id: 'tasks', label: 'Tâches', count: data.tasks.length, icon: 'ClipboardDocumentListIcon' },
    { id: 'equipment', label: 'Équipement', count: data.equipment.length, icon: 'BackpackIcon' },
    { id: 'expenses', label: 'Dépenses', count: `${data.expenses.total}€`, icon: 'CurrencyEuroIcon' },
    { id: 'decisions', label: 'Décisions', count: data.decisions.length, icon: 'HandRaisedIcon' },
    { id: 'discussion', label: 'Discussion', count: data.discussions.reduce((acc: number, d: any) => acc + d.replies + 1, 0), icon: 'ChatBubbleLeftRightIcon' },
    { id: 'members', label: 'Membres', count: data.travelers.length, icon: 'UserGroupIcon' }
  ];

  if (layoutVariant === 'vertical') {
    return (
      <nav className="w-full glass p-1.5 rounded-2xl flex flex-col gap-1">
        <div className="px-2 py-0.5 flex items-center justify-between border-b border-[#17402C]/10 mb-0.5">
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5C6B5E]">Cockpit</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold select-none transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-white/95 to-white/75 text-[#17402C] font-bold border border-white/80'
                  : 'text-[#5C6B5E] hover:bg-white/40 hover:text-[#17402C]'
              }`}
            >
              <Icon name={tab.icon} size={13} className="shrink-0 relative z-10" />
              <span className="truncate flex-1 text-left relative z-10">{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 relative z-10 ${
                    isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-[#17402C]/5 text-[#5C6B5E]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="glass-capsule-bar w-full overflow-x-auto scrollbar-hide py-2 px-3 mt-6 border-b border-[#17402C]/10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`glass-capsule-segment ${activeTab === tab.id ? 'active' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span className="relative z-10">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold relative z-10 ${activeTab === tab.id ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-black/5 text-[#5C6B5E]'}`}>
                {tab.count}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
