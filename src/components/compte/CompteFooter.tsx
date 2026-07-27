'use client';

import React from 'react';
import Link from 'next/link';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface CompteFooterProps {
  profile: UserProfile;
}

export default function CompteFooter({ profile }: CompteFooterProps) {
  return (
    <div className="w-full bg-[#1C2620] text-white pt-16 pb-12 px-6 sm:px-12 mt-16 border-t border-white/10 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col justify-between min-h-[220px]">
        
        {/* Title */}
        <div className="max-w-2xl">
          <h2 className="font-display font-900 text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
            Chaque voyage laisse <br />
            une <span className="font-serif italic font-normal text-emerald-300">trace de vous.</span>
          </h2>
        </div>

        {/* Legal Footer Bottom Row */}
        <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-white/50">
          <div>
            © 2026 Le Kit du Voyageur — Compte de {profile.first_name} {profile.last_name.replace('.', '')} · membre depuis mars 2023
          </div>

          <div className="flex items-center gap-6">
            <Link href="/cgu" className="hover:text-white transition-colors">Charte</Link>
            <Link href="/cookies" className="hover:text-white transition-colors">Confidentialité</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Support</Link>
          </div>
        </div>

      </div>
    </div>
  );
}
