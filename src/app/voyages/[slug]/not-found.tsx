import React from 'react';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import LkvIcon from '@/components/ui/LkvIcon';

export default function TripNotFound() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <GlassCard tone="neutral" blur="md" className="p-8 rounded-[var(--lkv-radius-2xl)] border border-white/70 shadow-lg">
          <div className="inline-flex p-4 rounded-full bg-lkv-secondary/10 text-lkv-primary mb-4">
            <LkvIcon name="compass" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-lkv-primary mb-2">
            Voyage introuvable
          </h1>
          <p className="text-sm text-lkv-secondary mb-6 leading-relaxed">
            Ce voyage n’existe pas, a été supprimé ou est privé. Si vous avez reçu un lien de partage, vérifiez qu’il est correct ou connectez-vous avec le compte invité.
          </p>
          <div className="flex items-center justify-center gap-3">
            <GlassCapsuleBtn href="/voyages" variant="primary" icon={<LkvIcon name="arrow-left" size={16} />}>
              Retourner aux voyages
            </GlassCapsuleBtn>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
