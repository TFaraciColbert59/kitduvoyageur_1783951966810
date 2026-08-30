'use client';

import React from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysDestinationsViewProps {
  country: CountryDetail;
  onSelectDestination?: (dest: any) => void;
}

export default function PaysDestinationsView({
  country,
  onSelectDestination,
}: PaysDestinationsViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {country.destinations?.map((d, idx) => (
          <div
            key={idx}
            onClick={() => onSelectDestination?.(d)}
            className="group glass-sub-card rounded-[1.5rem] overflow-hidden border border-white/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            {/* Image Cover */}
            <div className="relative h-48 sm:h-52 w-full overflow-hidden">
              <Image
                src={d.image_url}
                alt={d.titre}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              <div className="absolute top-3 left-3">
                <span className="glass-pill !bg-white/90 text-[#17402C] text-[9.5px] font-mono font-bold uppercase">
                  {d.categorie}
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-white">
                <h3 className="font-display font-bold text-lg sm:text-xl leading-tight">
                  {d.titre}{' '}
                  {d.titre_em && (
                    <span className="font-serif italic font-normal text-[#A6C1A0]">
                      {d.titre_em}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            {/* Meta Footer */}
            <div className="p-4 flex items-center justify-between text-xs font-mono text-[#5A7064] bg-white/40">
              <div className="flex items-center gap-2 truncate">
                <span>{d.meta_1}</span>
                <span>·</span>
                <span>{d.meta_2}</span>
              </div>

              <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-[#17402C] group-hover:bg-[#17402C] group-hover:text-white transition-colors shrink-0">
                <Icon name="ArrowRightIcon" size={13} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
