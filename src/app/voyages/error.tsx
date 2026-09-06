'use client';

import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
        <GlassCard tone="danger" blur="md" className="p-8 rounded-[32px] border border-[#A8443A]/30">
          <div className="inline-flex p-3 rounded-full bg-[#A8443A]/10 text-[#A8443A] mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#17402C] mb-2">
            Impossible de charger les voyages
          </h2>
          <p className="text-sm text-[#5B7F55] mb-6">
            Une erreur inattendue est survenue lors de la récupération des données.
            {error?.message && (
              <span className="block mt-2 font-mono text-xs text-gray-500 bg-white/50 p-2 rounded-lg">
                {error.message}
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <LkvButton variant="primary" onClick={() => reset()}>
              <RotateCcw size={16} className="mr-2" />
              Réessayer
            </LkvButton>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
