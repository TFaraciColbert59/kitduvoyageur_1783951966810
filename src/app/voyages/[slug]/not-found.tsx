import React from 'react';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import LkvIcon from '@/components/ui/LkvIcon';

export default function TripNotFound() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <GlassCard tone="neutral" blur="md" className="p-8 rounded-[32px] border border-white/70 shadow-lg">
          <div className="inline-flex p-4 rounded-full bg-[#5B7F55]/10 text-[#17402C] mb-4">
            <LkvIcon name="compass" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-[#17402C] mb-2">
            Voyage introuvable
          </h1>
          <p className="text-sm text-[#5B7F55] mb-6 leading-relaxed">
            Ce voyage n’existe pas, a été supprimé ou est privé. Si vous avez reçu un lien de partage, vérifiez qu’il est correct ou connectez-vous avec le compte invité.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/voyages">
              <LkvButton variant="primary">
                <LkvIcon name="arrow-left" size={16} className="mr-2" />
                Retourner aux voyages
              </LkvButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
