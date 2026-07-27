'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Commande } from '@/lib/mock/compte-marceline';

interface CommandesCardProps {
  commandes: Commande[];
}

export default function CommandesCard({ commandes }: CommandesCardProps) {
  const getStatusBadge = (status: Commande['status']) => {
    switch (status) {
      case 'Expédiée':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-teal-100 text-teal-900 border border-teal-300">Expédiée</span>;
      case 'Préparation':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">Préparation</span>;
      case 'Livrée':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">Livrée</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#1C2620]/5 shadow-sm space-y-6 my-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1C2620]/5 pb-4">
        <div>
          <h3 className="font-display font-800 text-2xl text-[#1C2620]">
            Commandes <span className="font-serif italic font-normal">& abonnements</span>
          </h3>
          <p className="text-xs font-mono text-[#1C2620]/50 mt-0.5">
            3 en cours · abonnement Guide
          </p>
        </div>

        <Link href="/compte/commandes" className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 transition-colors">
          Historique complet →
        </Link>
      </div>

      <p className="text-xs text-[#1C2620]/60 leading-relaxed">
        Les dernières commandes passées sur la boutique, plus l'état de votre abonnement premium.
      </p>

      {/* List */}
      <div className="space-y-3">
        {commandes.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#F5F3ED]/40 hover:bg-[#F5F3ED] border border-[#1C2620]/5 transition-all gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-[#1C2620]/10 shadow-sm bg-white">
                <Image
                  src={item.image_url}
                  alt={item.product_name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-sm sm:text-base text-[#1C2620] truncate">
                  {item.product_name}
                </h4>
                <p className="text-xs font-mono text-[#1C2620]/60 mt-0.5">
                  {item.order_number} · <span className="font-bold text-[#1C2620]">{item.price}</span>
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              {getStatusBadge(item.status)}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
