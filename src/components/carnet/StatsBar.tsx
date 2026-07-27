import React from 'react';

interface Stat {
  value: string;
  label: string;
  sublabel?: string;
  hidden?: boolean;
}

interface StatsBarProps {
  stats: Stat[];
}

export default function StatsBar({ stats }: StatsBarProps) {
  const visibleStats = (stats || []).filter(s => !s.hidden && s.value !== undefined && s.value !== null && s.value !== '');
  if (visibleStats.length === 0) return null;

  return (
    <div className="bg-[#E7E3D6] border-b border-[#1C2620]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8">
        <div className="flex flex-wrap items-center justify-around gap-6 md:gap-4">
          {visibleStats.map((stat, i) => (
            <div key={i} className="text-center min-w-[100px]">
              <p className="font-mono text-2xl md:text-3xl font-bold text-[#1C2620] tracking-tight">{stat.value}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1C2620]/50 mt-1">{stat.label}</p>
              {stat.sublabel && (
                <p className="text-[10px] italic text-[#1C2620]/40 mt-0.5">{stat.sublabel}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
