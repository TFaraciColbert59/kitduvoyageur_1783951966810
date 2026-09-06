import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface Activity {
  id: string;
  content: string;
  time: string;
}

interface ActiviteCardProps {
  activities: Activity[];
}

export default function ActiviteCard({ activities }: ActiviteCardProps) {
  return (
    <div className="glass p-6 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display font-bold text-xl text-lkv-primary">Activité <span className="font-serif italic font-normal text-lkv-primary">récente</span></h2>
        <Link href="/activite" className="glass-capsule-btn py-1 px-3 text-xs font-semibold">
          <span className="relative z-10">Tout →</span>
        </Link>
      </div>
      
      <p className="text-sm text-lkv-text-muted font-sans mb-6">
        Ce qui s'est passé dans le groupe cette semaine
      </p>
      
      <div className="space-y-4">
        {activities.map((activity, idx) => (
          <div key={activity.id} className="flex gap-3 relative">
            {/* Ligne verticale timeline */}
            {idx !== activities.length - 1 && (
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[1px] bg-lkv-primary/10" />
            )}
            
            <div className="w-7 h-7 rounded-full glass-sub-card flex items-center justify-center text-lkv-primary flex-shrink-0 z-10">
              <Icon name="BoltIcon" size={12} className="relative z-10" />
            </div>
            
            <div className="flex-1 pt-1 pb-1">
              <p className="text-xs text-lkv-primary font-sans leading-relaxed">
                {activity.content.split(/(\*\*.*?\*\*)/g).map((part, i) => 
                  part.startsWith('**') && part.endsWith('**') 
                    ? <span key={i} className="font-bold text-lkv-primary">{part.slice(2, -2)}</span> 
                    : part
                )}
              </p>
              <p className="text-[10px] text-lkv-text-muted font-mono mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
