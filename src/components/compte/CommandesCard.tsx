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
        return <span className="glass-pill">Expédiée</span>;
      case 'Préparation':
        return <span className="glass-pill pill-warn">Préparation</span>;
      case 'Livrée':
        return <span className="glass-pill">Livrée</span>;
      default:
        return <span className="glass-pill" style={{ background: 'rgba(90,112,100,0.10)', color: '#5A7064', borderColor: 'rgba(90,112,100,0.25)' }}>{status}</span>;
    }
  };

  return (
    <div className="glass rounded-[1.25rem] p-6 space-y-6 my-6 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#17402C]/5 pb-4">
        <div>
          <h3 className="font-display font-bold text-2xl text-[#17402C] tracking-tight">
            Commandes <span className="font-serif italic font-normal">& abonnements</span>
          </h3>
          <p className="text-xs font-mono text-[#5A7064] mt-0.5">
            3 en cours · abonnement Guide
          </p>
        </div>

        <Link href="/compte/commandes" className="text-xs font-bold text-[#365233] hover:text-[#17402C] transition-colors">
          Historique complet →
        </Link>
      </div>

      <p className="text-xs text-[#365233]/70 leading-relaxed">
        Les dernières commandes passées sur la boutique, plus l'état de votre abonnement premium.
      </p>

      {/* List */}
      <div className="space-y-3">
        {commandes.map((item) => (
          <div
            key={item.id}
            className="glass-sub-card flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl transition-all gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-[#17402C]/10 bg-white">
                <Image
                  src={item.image_url || '/assets/images/no_image.png'}
                  alt={item.product_name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm sm:text-base text-[#17402C] truncate">
                  {item.product_name}
                </h4>
                <p className="text-xs font-mono text-[#365233]/60 mt-0.5">
                  {item.order_number} · <span className="font-bold text-[#17402C]">{item.price}</span>
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
