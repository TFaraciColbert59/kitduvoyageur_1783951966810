'use client';

import React from 'react';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface StatsBandeauProps {
  profile: UserProfile;
}

export default function StatsBandeau({ profile }: StatsBandeauProps) {
  const { level, stats } = profile;
  const progressPercent = Math.round((level.current_pts / level.max_pts) * 100);

  return (
    <div className="w-full bg-[#1C2620] text-white rounded-[2rem] p-5 sm:p-7 shadow-2xl border border-white/10 my-6 font-sans">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        
        {/* Level Badge Card (Left) */}
        <div className="lg:w-2/5 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-400 text-emerald-950 font-black font-mono text-xs sm:text-sm flex items-center justify-center shadow-md shrink-0">
                {level.number}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/50 block">Niveau actuel</span>
                <h4 className="font-extrabold text-sm sm:text-base text-white truncate">{level.title}</h4>
              </div>
            </div>
            <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm shrink-0">
              {level.current_pts} / {level.max_pts} pts
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[9px] font-mono text-white/60 font-semibold uppercase tracking-wider">
              <span>ENCORE {level.next_level_pts} PTS AVANT « {level.next_level_title} »</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* 4 Stats Metrics Row (Right) */}
        <div className="lg:w-3/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left divide-y sm:divide-y-0 sm:divide-x divide-white/10 pt-2 lg:pt-0">
          
          <div className="flex flex-col items-center sm:items-start sm:pl-4 first:pl-0">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-white">{stats.sorties}</span>
            <span className="text-[10px] font-mono font-bold text-white/50 tracking-wider uppercase mt-0.5">
              AVENTURES FAITES
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start sm:pl-4 pt-2 sm:pt-0">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-emerald-400">{stats.carnets}</span>
            <span className="text-[10px] font-mono font-bold text-white/50 tracking-wider uppercase mt-0.5">
              RÉCITS PUBLIÉS
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start sm:pl-4 pt-2 sm:pt-0">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-white">{stats.clubs}</span>
            <span className="text-[10px] font-mono font-bold text-white/50 tracking-wider uppercase mt-0.5">
              COMMUNAUTÉS
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start sm:pl-4 pt-2 sm:pt-0">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-emerald-300">
              {stats.km_this_year} <span className="text-xs font-normal">km</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-white/50 tracking-wider uppercase mt-0.5">
              CETTE ANNÉE
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
