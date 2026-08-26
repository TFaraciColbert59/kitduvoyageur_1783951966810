'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useToast } from '@/contexts/ToastContext';

interface CountdownCardProps {
  data: any;
}

export default function CountdownCard({ data }: CountdownCardProps) {
  const { toast } = useToast();
  const inviteCode = data.inviteCode || '';

  const handleInvite = async () => {
    if (!inviteCode) { toast('Aucun code d\'invitation disponible', 'error'); return; }
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast(`Code d'invitation copié : ${inviteCode}`, 'success');
    } catch {
      toast(`Code d'invitation : ${inviteCode}`, 'success');
    }
  };

  return (
    <div className="glass p-3.5 text-[#17402C] relative overflow-hidden transition-all duration-300 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="glass-pill text-[10px] font-mono font-bold shrink-0">
            J-{data.meta.daysLeft}
          </span>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-xs text-[#17402C] truncate">
              {data.meta.startDate} → {data.meta.endDate} ({data.meta.durationDays}J)
            </h3>
          </div>
        </div>

        <button
          onClick={handleInvite}
          className="glass-capsule-btn p-1.5 shrink-0"
          title="Inviter (copier le code)"
        >
          <Icon name="PlusIcon" size={12} className="relative z-10" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-[#5C6B5E] pt-2 border-t border-[#17402C]/10">
        <span className="truncate">📍 {data.meta.meetingPoint}</span>
        <div className="flex -space-x-1.5 shrink-0">
          {data.travelers.slice(0, 3).map((t: any, i: number) => (
            <div key={t.id} className="w-5 h-5 rounded-full border border-white bg-[#17402C] text-white flex items-center justify-center text-[9px] font-bold z-10" style={{ zIndex: 10 - i }}>
              {t.name.charAt(0)}
            </div>
          ))}
          {data.travelers.length > 3 && (
            <div className="w-5 h-5 rounded-full border border-white bg-[#5C6B5E] text-white flex items-center justify-center text-[8px] font-bold z-0">
              +{data.travelers.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
