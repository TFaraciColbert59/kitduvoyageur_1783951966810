import React from 'react';
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
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/10 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-display text-xl text-[#1C2620]">Activité <span className="font-serif italic font-bold">récente</span></h2>
        <button className="text-xs font-medium text-[#17402C] hover:underline font-sans">Tout →</button>
      </div>
      
      <p className="text-sm text-[#1C2620]/80 font-sans mb-6">
        Ce qui s'est passé dans le groupe cette semaine
      </p>
      
      <div className="space-y-4">
        {activities.map((activity, idx) => (
          <div key={activity.id} className="flex gap-3 relative">
            {/* Ligne verticale timeline */}
            {idx !== activities.length - 1 && (
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[1px] bg-[#1C2620]/10" />
            )}
            
            <div className="w-7 h-7 rounded-full bg-[#E7E3D6]/50 border border-[#1C2620]/10 flex items-center justify-center text-[#1C2620]/50 flex-shrink-0 z-10">
              <Icon name="BoltIcon" size={12} />
            </div>
            
            <div className="flex-1 pt-1 pb-1">
              <p className="text-xs text-[#1C2620] font-sans leading-relaxed">
                {/* Simple markdown parsing for bold text */}
                {activity.content.split(/(\*\*.*?\*\*)/g).map((part, i) => 
                  part.startsWith('**') && part.endsWith('**') 
                    ? <span key={i} className="font-semibold">{part.slice(2, -2)}</span> 
                    : part
                )}
              </p>
              <p className="text-[10px] text-[#1C2620]/40 font-mono mt-1">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
