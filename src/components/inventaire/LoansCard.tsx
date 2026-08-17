'use client';

import React from 'react';
import Image from 'next/image';
import { LoanItemData } from '@/lib/mock/mon-materiel-marceline';

interface LoansCardProps {
  loans: LoanItemData[];
  onOpenLendModal?: () => void;
  className?: string;
}

export default function LoansCard({
  loans,
  onOpenLendModal,
  className = '',
}: LoansCardProps) {
  return (
    <div
      className={`bg-white rounded-[24px] p-5 md:p-6 border border-[#0B1F17]/[0.08] shadow-[0_2px_8px_rgba(11,31,23,0.04)] ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-[17.5px] font-medium tracking-tight text-[#111614] font-sans">
          Prêts <em className="font-serif italic font-normal text-[#1F4A3A]">en cours</em>
        </h3>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F2ED] text-[#566159]">
          <strong className="text-[#1F4A3A] font-semibold">{loans.length}</strong> prêté{loans.length > 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-[11.5px] text-[#566159] font-sans mb-3.5">
        Matériel qui circule entre membres de vos cercles et clubs.
      </p>

      {loans.length === 0 ? (
        <div className="text-center py-4 bg-[#F8FAF8] rounded-xl border border-dashed border-[#0B1F17]/10">
          <p className="text-[11.5px] text-[#566159]">Aucun matériel actuellement prêté.</p>
          {onOpenLendModal && (
            <button
              type="button"
              onClick={onOpenLendModal}
              className="mt-2 text-[11px] text-[#1F4A3A] font-medium hover:underline"
            >
              + Prêter un article
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#0B1F17]/[0.06]">
          {loans.map((l, idx) => {
            const isLate = Boolean(l.return_date?.includes('retard') || l.notes?.includes('retard'));
            return (
              <div
                key={l.id || idx}
                className="py-2.5 first:pt-0 last:pb-0 grid grid-cols-[28px_24px_1fr_auto] gap-2 items-center text-[12px]"
              >
                {/* Gear thumbnail */}
                <div className="relative w-7 h-7 rounded-md overflow-hidden bg-[#F3F2ED] border border-[#0B1F17]/06 shrink-0">
                  <Image
                    src={l.image || '/assets/images/no_image.png'}
                    alt={l.item_name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Borrower Avatar */}
                <div className="relative w-6 h-6 rounded-full overflow-hidden bg-[#1F4A3A]/10 text-[#1F4A3A] font-medium text-[10px] flex items-center justify-center shrink-0 border border-white">
                  {l.borrower_avatar ? (
                    <Image
                      src={l.borrower_avatar}
                      alt={l.borrower_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    l.borrower_name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 pr-1 truncate text-[11.5px] text-[#2A322E]">
                  <strong className="text-[#111614] font-medium">{l.borrower_name}</strong> ·{' '}
                  <span className="text-[#566159]">{l.item_name}</span>
                </div>

                {/* Date Pill */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                    isLate
                      ? 'bg-[#FBF0DE] text-[#C99B5A]'
                      : 'bg-[#DDEEE5] text-[#1F4A3A]'
                  }`}
                >
                  {l.return_date || "jusqu'au 22"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

