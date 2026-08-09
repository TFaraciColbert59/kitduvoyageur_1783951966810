'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { Carnet } from '@/lib/mock/compte-marceline';

interface MesCarnetsCardProps {
  carnets: Carnet[];
}

export default function MesCarnetsCard({ carnets }: MesCarnetsCardProps) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#1C2620]/5 shadow-sm space-y-6 my-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1C2620]/5 pb-4">
        <div>
          <h3 className="font-display font-800 text-2xl text-[#1C2620]">
            Mes <span className="font-serif italic font-normal">carnets</span> publiés
          </h3>
          <p className="text-xs font-mono text-[#1C2620]/50 mt-0.5">
            12 récits · 3 428 lectures
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/carnets" className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 transition-colors">
            Brouillons
          </Link>
          <Link
            href="/carnets/nouveau"
            className="px-4 py-2 bg-[#1C2620] hover:bg-[#2D3F35] text-white rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md"
          >
            <Icon name="PlusIcon" size={14} />
            <span>+ Nouveau</span>
          </Link>
        </div>
      </div>

      <p className="text-xs text-[#1C2620]/60 leading-relaxed">
        Vos publications visibles par la communauté. Un carnet peut aussi rester privé, en cours d'édition.
      </p>

      {/* Grid of 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {carnets.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/carnets/${item.id || encodeURIComponent(item.title)}`)}
            className="group bg-[#F5F3ED]/40 hover:bg-[#F5F3ED] border border-[#1C2620]/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
          >
            <div>
              {/* Card Image Header */}
              <div className="relative h-44 w-full overflow-hidden">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  {item.status === 'Publié' ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500 text-emerald-950 shadow-md">
                      Publié
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-amber-950 shadow-md">
                      Brouillon
                    </span>
                  )}
                </div>
              </div>

              {/* Title Content */}
              <div className="p-4">
                <h4 className="font-extrabold text-base text-[#1C2620] line-clamp-2 group-hover:text-emerald-800 transition-colors">
                  {item.title}
                </h4>
              </div>
            </div>

            {/* Footer Stats */}
            <div className="p-4 pt-0 border-t border-[#1C2620]/5 mt-2 flex items-center justify-between text-xs font-mono font-bold text-[#1C2620]/70">
              {item.status === 'Publié' ? (
                <div className="flex items-center gap-3 w-full justify-between pt-2">
                  <span className="flex items-center gap-1"><Icon name="HeartIcon" size={14} className="text-rose-500" /> {item.likes}</span>
                  <span className="flex items-center gap-1"><Icon name="EyeIcon" size={14} className="text-emerald-700" /> {item.views}</span>
                  <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={14} className="text-blue-600" /> {item.comments}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full pt-2 text-[#1C2620]/60">
                  <span>{item.edit_status}</span>
                  <span>{item.draft_detail}</span>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
