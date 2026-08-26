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
    <div className="glass rounded-[1.25rem] p-6 space-y-6 my-6 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#17402C]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[#17402C] tracking-tight">
            Mes <span className="font-serif italic font-normal">carnets</span> publiés
          </h3>
          <p className="text-xs font-mono text-[#5A7064] mt-0.5">
            12 récits · 3 428 lectures
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/carnets" className="text-xs font-bold text-[#365233] hover:text-[#17402C] transition-colors">
            Brouillons
          </Link>
          <Link
            href="/carnets/nouveau"
            className="glass-capsule-btn primary !py-2 !px-4 !min-h-[0] text-xs font-bold"
          >
            <Icon name="PlusIcon" size={14} />
            <span>+ Nouveau</span>
          </Link>
        </div>
      </div>

      <p className="text-xs text-[#365233]/70 leading-relaxed">
        Vos publications visibles par la communauté. Un carnet peut aussi rester privé, en cours d'édition.
      </p>

      {/* Grid of 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {carnets.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/carnets/${item.id || encodeURIComponent(item.title)}`)}
            className="glass-sub-card rounded-2xl overflow-hidden transition-all flex flex-col justify-between cursor-pointer"
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
                    <span className="glass-pill !bg-[#17402C]/80 !text-white !border-white/20 backdrop-blur-md">
                      Publié
                    </span>
                  ) : (
                    <span className="glass-pill pill-warn backdrop-blur-md">
                      Brouillon
                    </span>
                  )}
                </div>
              </div>

              {/* Title Content */}
              <div className="p-4">
                <h4 className="font-bold text-base text-[#17402C] line-clamp-2 group-hover:text-[#365233] transition-colors">
                  {item.title}
                </h4>
              </div>
            </div>

            {/* Footer Stats */}
            <div className="p-4 pt-0 border-t border-[#17402C]/5 mt-2 flex items-center justify-between text-xs font-mono font-bold text-[#365233]/70">
              {item.status === 'Publié' ? (
                <div className="flex items-center gap-3 w-full justify-between pt-2">
                  <span className="flex items-center gap-1"><Icon name="HeartIcon" size={14} className="text-[#5B7F55]" /> {item.likes}</span>
                  <span className="flex items-center gap-1"><Icon name="EyeIcon" size={14} className="text-[#5A7064]" /> {item.views}</span>
                  <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={14} className="text-[#4B6B7C]" /> {item.comments}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full pt-2 text-[#365233]/60">
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
