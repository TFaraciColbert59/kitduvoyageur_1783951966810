'use client';

import React from 'react';
import { Card } from '@/components/ui';
import { UserProfile } from '@/lib/types/profile';

interface StatsBandeauProps {
  profile: UserProfile;
}

export default function StatsBandeau({ profile }: StatsBandeauProps) {
  const { level, stats } = profile;
  const progressPercent = Math.round((level.current_pts / level.max_pts) * 100);

  return (
    <Card className="w-full p-4 sm:p-5 font-sans">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">

        {/* Level Badge Card (Left) */}
        <div className="lg:w-2/5 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] p-4 flex flex-col justify-between gap-2.5 shrink-0 border border-white/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] font-black font-mono text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-sm">
                {level.number}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[color:var(--lkv-text-muted)] block">Niveau actuel</span>
                <h4 className="font-bold text-sm sm:text-base text-[color:var(--lkv-primary)] truncate">{level.title}</h4>
              </div>
            </div>
            <span className="font-mono font-bold text-[color:var(--lkv-secondary)] text-xs sm:text-sm shrink-0">
              {level.current_pts} / {level.max_pts} pts
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="w-full h-2 bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn rounded-full overflow-hidden p-0.5 border border-white/20">
              <div
                className="h-full bg-gradient-to-r from-[color:var(--lkv-secondary)] to-[color:var(--lkv-warning)] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[9px] font-mono text-[color:var(--lkv-text-muted)] font-semibold uppercase tracking-wider">
              <span>ENCORE {level.next_level_pts} PTS AVANT « {level.next_level_title} »</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* 4 Stats Metrics Row (Right) */}
        <div className="lg:w-3/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--lkv-primary)]/10 pt-2 lg:pt-0">

          <div className="flex flex-col items-center sm:items-start sm:pl-4 first:pl-0">
            <span className="font-mono font-bold text-2xl sm:text-3xl text-[color:var(--lkv-primary)]">{stats.sorties}</span>
            <span className="text-[10px] font-mono font-bold text-[color:var(--lkv-text-muted)] tracking-wider uppercase mt-0.5">
              AVENTURES FAITES
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start sm:pl-4 pt-2 sm:pt-0">
            <span className="font-mono font-bold text-2xl sm:text-3xl text-[color:var(--lkv-secondary)]">{stats.carnets}</span>
            <span className="text-[10px] font-mono font-bold text-[color:var(--lkv-text-muted)] tracking-wider uppercase mt-0.5">
              RÉCITS PUBLIÉS
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start sm:pl-4 pt-2 sm:pt-0">
            <span className="font-mono font-bold text-2xl sm:text-3xl text-[color:var(--lkv-primary)]">{stats.clubs}</span>
            <span className="text-[10px] font-mono font-bold text-[color:var(--lkv-text-muted)] tracking-wider uppercase mt-0.5">
              COMMUNAUTÉS
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start sm:pl-4 pt-2 sm:pt-0">
            <span className="font-mono font-bold text-2xl sm:text-3xl text-[color:var(--lkv-secondary)]">
              {stats.km_this_year} <span className="text-xs font-normal">km</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-[color:var(--lkv-text-muted)] tracking-wider uppercase mt-0.5">
              CETTE ANNÉE
            </span>
          </div>

        </div>

      </div>
    </Card>
  );
}
