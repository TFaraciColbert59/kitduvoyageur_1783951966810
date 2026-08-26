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
    <div className="glass bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white shadow-sm">
      <div className="flex flex-wrap items-center justify-around gap-4 md:gap-2 divide-y md:divide-y-0 md:divide-x divide-[#17402C]/10">
        {visibleStats.map((stat, i) => (
          <div key={i} className="text-center flex-1 min-w-[100px] pt-2 md:pt-0">
            <p className="font-mono text-2xl sm:text-3xl font-bold text-[#17402C] tracking-tight">
              {stat.value}
            </p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#5C6B5E] font-bold mt-1">
              {stat.label}
            </p>
            {stat.sublabel && (
              <p className="text-[10px] text-[#5C6B5E]/80 mt-0.5">{stat.sublabel}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
