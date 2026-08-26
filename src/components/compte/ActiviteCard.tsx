'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ActiviteItem } from '@/lib/mock/compte-marceline';

interface ActiviteCardProps {
  activites: ActiviteItem[];
}

export default function ActiviteCard({ activites }: ActiviteCardProps) {
  const getIcon = (type: ActiviteItem['icon_type']) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[#A8443A]/10 text-[#A8443A] flex items-center justify-center shrink-0">
            <Icon name="HeartIcon" size={11} />
          </div>
        );
      case 'badge':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[#5B7F55]/15 text-[#5B7F55] flex items-center justify-center shrink-0">
            <Icon name="SparklesIcon" size={11} />
          </div>
        );
      case 'order':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[#4B6B7C]/15 text-[#4B6B7C] flex items-center justify-center shrink-0">
            <Icon name="ShoppingBagIcon" size={11} />
          </div>
        );
      case 'comment':
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[#C89A3B]/15 text-[#8C6418] flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftIcon" size={11} />
          </div>
        );
      default:
        return (
          <div className="w-5.5 h-5.5 rounded-full bg-[#17402C]/5 text-[#17402C] flex items-center justify-center shrink-0">
            <Icon name="UserIcon" size={11} />
          </div>
        );
    }
  };

  return (
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C] font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xs text-[#17402C]">Activité récente</h3>
        <Link href="/compte?tab=aventures" className="text-[9.5px] font-mono font-bold text-[#5B7F55] hover:text-[#17402C]">
          Tout →
        </Link>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {activites && activites.length > 0 ? (
          activites.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded-xl bg-white/70 hover:bg-white transition-all shadow-2xs border border-white/60 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getIcon(item.icon_type)}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#17402C] truncate">{item.text}</div>
                  <div className="text-[9px] font-mono text-[#5A7064]">{item.time}</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-2 text-[10px] text-[#5A7064]">
            Aucune notification récente
          </div>
        )}
      </div>
    </div>
  );
}
