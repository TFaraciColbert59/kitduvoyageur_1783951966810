'use client';

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, MapPin, Calendar, Coins, Tag, Sparkles } from 'lucide-react';
import type { Country } from '@/lib/countries';
import { DANGER_META } from '@/lib/pays/danger';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface EarthCountrySheetProps {
  country: Country | null;
  onClose: () => void;
}

function flagEmoji(code: string): string {
  const cps = code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cps);
}

export default function EarthCountrySheet({ country, onClose }: EarthCountrySheetProps) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  const handleExplore = useCallback(() => {
    if (!country) return;
    triggerHaptic('medium');
    router.push(`/pays/${country.code.toLowerCase()}`);
  }, [country, router, triggerHaptic]);

  const handleOpenKitConfigurator = useCallback(() => {
    if (!country) return;
    triggerHaptic('selection');
    router.push(`/ai-configurator?country=${country.code}`);
  }, [country, router, triggerHaptic]);

  const handleClose = useCallback(() => {
    triggerHaptic('light');
    onClose();
  }, [onClose, triggerHaptic]);

  return (
    <AnimatePresence>
      {country && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[980] bg-[#17402C]/25 backdrop-blur-[3px] md:hidden"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Bottom Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Fiche ${country.nom}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                handleClose();
              }
            }}
            className="fixed left-3 right-3 z-[990] md:hidden rounded-[28px] overflow-hidden glass bg-white/95 backdrop-blur-2xl border border-white shadow-2xl max-h-[calc(100dvh-env(safe-area-inset-top,0px)-96px)] overflow-y-auto"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing" onClick={handleClose}>
              <div className="w-9 h-1.5 rounded-full bg-[#17402C]/20" />
            </div>

            <div className="px-4 pb-4 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <span className="text-4xl leading-none flex-shrink-0 drop-shadow-xs">{flagEmoji(country.code)}</span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-[#17402C] text-lg leading-tight truncate">
                    {country.nom}
                  </h2>
                  <p className="text-[11.5px] text-[#5A7064] flex items-center gap-1 truncate font-medium">
                    <MapPin size={11} className="text-[#5B7F55]" />
                    {country.capital} · {country.continent}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Fermer la fiche"
                  className="w-8 h-8 rounded-full bg-[#17402C]/08 hover:bg-[#17402C]/15 flex items-center justify-center text-[#17402C] shrink-0 transition-transform active:scale-90"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Danger badge */}
              <span
                className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold border"
                style={{
                  backgroundColor: DANGER_META[country.danger_level].bg,
                  color: DANGER_META[country.danger_level].text,
                  borderColor: `${DANGER_META[country.danger_level].text}33`,
                }}
              >
                {DANGER_META[country.danger_level].label}
              </span>

              {/* Meta rows */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-white/80 border border-white/90 shadow-2xs flex items-center gap-2.5">
                  <Calendar size={14} className="text-[#17402C] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9.5px] uppercase tracking-wider text-[#5A7064] font-bold">Saison idéale</p>
                    <p className="text-[11.5px] font-mono font-bold text-[#17402C] truncate">{country.meilleure_saison}</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/80 border border-white/90 shadow-2xs flex items-center gap-2.5">
                  <Coins size={14} className="text-[#17402C] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9.5px] uppercase tracking-wider text-[#5A7064] font-bold">Monnaie</p>
                    <p className="text-[11.5px] font-mono font-bold text-[#17402C] truncate">{country.monnaie}</p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {country.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag size={11} className="text-[#5A7064]" />
                  {country.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="glass-pill text-[9.5px] font-mono bg-white/80 border border-white"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* CTAs with Apple 44px touch targets */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExplore}
                  className="flex-1 glass-capsule-btn primary justify-center !min-h-[44px] !font-bold !gap-1.5 shadow-md active:scale-[0.98] transition-transform"
                >
                  <span>Explorer le guide</span>
                  <ChevronRight size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleOpenKitConfigurator}
                  className="glass-capsule-btn !min-h-[44px] !px-4 !font-bold !gap-1.5 shadow-xs active:scale-[0.98] transition-transform"
                  title="Générer un kit pour ce pays"
                >
                  <Sparkles size={14} className="text-[#5B7F55]" />
                  <span>Kit IA</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
