'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';

export default function VoyagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <GlassCard
          tone="danger"
          blur="md"
          className="p-8 rounded-[var(--lkv-radius-2xl)] border border-[var(--lkv-danger)]/30"
        >
          <div className="inline-flex p-3 rounded-full bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)] mb-4">
            <Icon name="alert-triangle" size={32} />
          </div>
          <h2 className="text-xl font-bold text-lkv-primary mb-2">
            Impossible de charger les voyages
          </h2>
          <p className="text-sm text-lkv-secondary mb-6">
            Une erreur inattendue est survenue lors de la récupération des données.
            {error?.message && (
              <span className="block mt-2 font-mono text-xs text-[var(--lkv-text-muted)] glass-sub-card p-2 rounded-lg border border-white/60 shadow-2xs">
                {error.message}
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <GlassCapsuleBtn
              variant="primary"
              onClick={() => reset()}
              icon={<Icon name="rotate-ccw" size={16} />}
            >
              Réessayer
            </GlassCapsuleBtn>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
