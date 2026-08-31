'use client';

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Coins, Tag, Sparkles } from 'lucide-react';
import { XIcon as XAnimated } from '@/components/icons/x';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import type { Country } from '@/lib/countries';
import LkvButton from '@/components/ui/LkvButton';
import LkvChip from '@/components/ui/LkvChip';
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
        <div className="fixed inset-0 z-[990] md:hidden pointer-events-none flex flex-col justify-end">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-[#17402C]/25 backdrop-blur-[3px] pointer-events-auto"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Bottom Sheet Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Fiche ${country.nom}`}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="relative z-10 mx-3 rounded-[26px] overflow-hidden glass bg-white/95 backdrop-blur-2xl border border-white shadow-2xl pointer-events-auto max-h-[calc(100dvh-180px)] flex flex-col"
            style={{
              marginBottom: 'calc(var(--bottom-tab-extended-height, 92px) + 8px)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-9 h-1.5 rounded-full bg-[#17402C]/20" />
            </div>

            <div className="px-4 pb-4 overflow-y-auto flex flex-col gap-3">
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
                  className="w-8 h-8 rounded-full bg-[#17402C]/08 hover:bg-[#17402C]/15 flex items-center justify-center text-[#17402C] shrink-0 transition-transform active:scale-90 cursor-pointer"
                >
                  <XAnimated size={15} />
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
                <div className="p-2.5 rounded-2xl bg-white/80 border border-white/90 shadow-2xs flex items-center gap-2.5">
                  <Calendar size={14} className="text-[#17402C] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9.5px] uppercase tracking-wider text-[#5A7064] font-bold">Saison idéale</p>
                    <p className="text-[11.5px] font-mono font-bold text-[#17402C] truncate">{country.meilleure_saison}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/80 border border-white/90 shadow-2xs flex items-center gap-2.5">
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
                  {country.tags.slice(0, 3).map((t) => (
                    <LkvChip key={t} label={t} tone="stone" />
                  ))}
                </div>
              )}

              {/* CTAs with Apple 44px touch targets */}
              <div className="flex items-center gap-2 pt-1">
                <LkvButton
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleExplore}
                  icon={<ChevronRightAnimated size={15} />}
                  iconPosition="right"
                >
                  Explorer le guide
                </LkvButton>

                <LkvButton
                  variant="secondary"
                  size="md"
                  onClick={handleOpenKitConfigurator}
                  icon={<Sparkles size={14} className="text-[#5B7F55]" />}
                  title="Générer un kit pour ce pays"
                >
                  Kit IA
                </LkvButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
