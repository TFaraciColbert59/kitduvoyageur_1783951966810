'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, WifiOff, ShieldCheck } from 'lucide-react';
import { RefreshCwAnimated, ArrowLeftAnimated } from '@/components/icons';
import { GlassCard } from '@/components/ui/GlassCard';

export default function DepartError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    console.error('[DepartError]', error);
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
  }, [error]);

  return (
    <div className="w-full h-full min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <GlassCard tone="danger">
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(168,68,58,0.15)] text-[#8A241B] flex items-center justify-center mx-auto shadow-xs">
              {isOffline ? <WifiOff size={24} /> : <AlertTriangle size={24} />}
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-display font-bold text-[#17402C]">
                {isOffline ? 'Mode hors-ligne détecté' : 'Données du départ indisponibles'}
              </h2>
              <p className="text-xs text-[#5A7064] leading-relaxed">
                {isOffline
                  ? 'Aucune connexion internet active. Vos données de pack pré-chargées restent accessibles.'
                  : 'Une anomalie temporaire empêche le chargement du cockpit. Vos données sont préservées en sécurité.'}
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="glass-capsule-btn primary flex-1 py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <RefreshCwAnimated size={13} />
                <span>Réessayer</span>
              </button>

              <Link
                href="/materiel"
                className="glass-capsule-btn flex-1 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ArrowLeftAnimated size={13} />
                <span>Hub Matériel</span>
              </Link>
            </div>

            {/* Répère sécurité terrain */}
            <div className="pt-3 border-t border-[#17402C]/10 flex items-center justify-center gap-1.5 text-[10.5px] text-[#5A7064]">
              <ShieldCheck size={12} className="text-[#2D6B4A]" />
              <span>Numéro d’urgence européen : <strong>112</strong></span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
