import React from 'react';

interface Stat {
  value: string;
  label: string;
  sublabel?: string;
}

interface StatsBarProps {
  stats: Stat[];
}

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="bg-[#E7E3D6] border-b border-[#1C2620]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 md:gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
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
