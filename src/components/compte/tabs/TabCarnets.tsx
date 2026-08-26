'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { CompteCarnet } from '@/lib/supabase/queries-compte';
import { CarnetsSkeleton } from '../CompteSkeleton';

interface TabCarnetsProps {
  carnets: CompteCarnet[] | undefined;
  loading?: boolean;
}

export default function TabCarnets({ carnets, loading }: TabCarnetsProps) {
  if (loading) {
    return <CarnetsSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-[#17402C] flex items-center gap-1.5">
            <span>📖</span> Mes Carnets de Voyage
          </h3>
          <p className="text-xs text-[#5A7064]">
            {carnets?.length ?? 0} carnet{(carnets?.length ?? 0) > 1 ? 's' : ''} créé{(carnets?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>

        <Link
          href="/carnets/nouveau"
          className="px-4 py-2 rounded-xl bg-[#17402C] hover:bg-[#17402C] text-white text-xs font-bold  active:scale-95 transition-transform flex items-center gap-1.5"
        >
          <span>+ Nouveau carnet</span>
        </Link>
      </div>

      {!carnets || carnets.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-black/10">
          <p className="text-4xl mb-3">📖</p>
          <h4 className="font-bold text-sm text-[#17402C]">Aucun carnet rédigé</h4>
          <p className="text-xs text-[#5A7064] max-w-sm mx-auto mt-1 mb-5">
            Racontez vos traversées, partagez vos conseils d'itinéraires et inspirez la communauté de randonneurs.
          </p>
          <Link
            href="/carnets/nouveau"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17402C] text-white text-xs font-bold "
          >
            <span>+ Rédiger mon premier carnet</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {carnets.map((c) => (
            <Link
              key={c.id}
              href={`/carnets/${c.id}`}
              className="group bg-white rounded-3xl overflow-hidden border border-black/[0.06] hover:border-[#17402C]/30 shadow-2xs hover: transition-all flex flex-col justify-between"
            >
              <div className="relative aspect-[16/9] bg-[#F4F1EB] overflow-hidden">
                <AppImage
                  src={c.image_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80'}
                  alt={c.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span
                  className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    c.status === 'Publié'
                      ? 'bg-[#E1EBDD] text-[#17402C]'
                      : 'bg-black/60 backdrop-blur-md text-white'
                  }`}
                >
                  {c.status}
                </span>
              </div>

              <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                <h4 className="font-bold text-sm text-[#17402C] group-hover:text-[#17402C] transition-colors line-clamp-2">
                  {c.title}
                </h4>

                <div className="flex items-center gap-3 pt-2 border-t border-black/[0.04] text-[11px] font-mono text-[#5A7064]">
                  <span>👁️ {c.views || 0}</span>
                  <span>·</span>
                  <span>❤️ {c.likes || 0}</span>
                  <span>·</span>
                  <span>💬 {c.comments || 0}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
