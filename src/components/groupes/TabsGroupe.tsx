import React from 'react';

interface TabsGroupeProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: any;
}

export default function TabsGroupe({ activeTab, setActiveTab, data }: TabsGroupeProps) {
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'tasks', label: 'Tâches', count: data.tasks.length },
    { id: 'equipment', label: 'Équipement', count: data.equipment.length },
    { id: 'expenses', label: 'Dépenses', count: `${data.expenses.total}€` },
    { id: 'decisions', label: 'Décisions', count: data.decisions.length },
    { id: 'discussion', label: 'Discussion', count: data.discussions.reduce((acc: number, d: any) => acc + d.replies + 1, 0) },
    { id: 'members', label: 'Membres', count: data.travelers.length }
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-4 mt-4 border-b border-[#1C2620]/10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-all font-sans text-sm font-medium
            ${activeTab === tab.id 
              ? 'text-[#1C2620] border-b-2 border-[#1C2620]' 
              : 'text-[#1C2620]/60 hover:text-[#1C2620] border-b-2 border-transparent'
            }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-[#1C2620]/10' : 'bg-black/5'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
