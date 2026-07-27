'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { ActiviteItem } from '@/lib/mock/compte-marceline';

interface ActiviteCardProps {
  activites: ActiviteItem[];
}

export default function ActiviteCard({ activites }: ActiviteCardProps) {
  const getIcon = (type: ActiviteItem['icon_type']) => {
    switch (type) {
      case 'like':
        return <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><Icon name="HeartIcon" size={14} /></div>;
      case 'badge':
        return <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0"><Icon name="SparklesIcon" size={14} /></div>;
      case 'order':
        return <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Icon name="ShoppingBagIcon" size={14} /></div>;
      case 'comment':
        return <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"><Icon name="ChatBubbleLeftIcon" size={14} /></div>;
      default:
        return <div className="w-7 h-7 rounded-full bg-[#1C2620]/10 text-[#1C2620] flex items-center justify-center shrink-0"><Icon name="UserIcon" size={14} /></div>;
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/5 shadow-sm space-y-4 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1C2620]/5 pb-3">
        <div>
          <h3 className="font-display font-800 text-xl text-[#1C2620]">
            Activité <span className="font-serif italic font-normal">récente</span>
          </h3>
          <p className="text-xs text-[#1C2620]/60 mt-0.5">
            Ce que la communauté a fait sur vos contenus.
          </p>
        </div>

        <button className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 transition-colors">
          Tout →
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {activites.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-2.5 rounded-2xl hover:bg-[#F5F3ED] transition-colors cursor-pointer"
          >
            {getIcon(item.icon_type)}
            <div className="flex-1 text-xs text-[#1C2620]/80 leading-snug">
              <span>{item.text}</span>
              {item.highlight && <strong className="font-bold text-[#1C2620]"> {item.highlight}</strong>}
            </div>
            <span className="text-[10px] font-mono text-[#1C2620]/40 shrink-0">
              {item.time}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
