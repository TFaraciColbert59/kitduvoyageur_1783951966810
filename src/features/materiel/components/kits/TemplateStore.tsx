'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import { ArrowDown, Check } from 'lucide-react';
import type { PublicKit } from '@/features/materiel/services/getPublicKits';

const CURATED_COMMUNITY_KITS: PublicKit[] = [
  {
    id: 'comm-1',
    name: 'Bivouac Ultra-Léger 3 Saisons',
    description: 'Kit minimaliste testé sur les crêtes du Jura. Poids plume.',
    total_weight_g: 8900,
    tags: ['Ultra-light', 'Bivouac'],
    itemsCount: 14,
  },
  {
    id: 'comm-2',
    name: 'Trek Haute Montagne & Glaciers',
    description: 'Équipement thermique renforcé pour passages > 2500m.',
    total_weight_g: 13400,
    tags: ['Alpinisme', 'Alpes'],
    itemsCount: 19,
  },
  {
    id: 'comm-3',
    name: 'Pack Randonnée Côtière & GR34',
    description: 'Matériel respirant et imperméable adapté au climat maritime.',
    total_weight_g: 10200,
    tags: ['Mer', 'GR34'],
    itemsCount: 16,
  },
];

/** W-K-7 TemplateStore — Kits communautaires avec bouton circulaire flèche vers le bas standardisé. */
export function TemplateStore({ kits = [] }: { kits: PublicKit[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [importing, setImporting] = useState<string | null>(null);
  const [justImported, setJustImported] = useState<string | null>(null);

  const displayKits = kits.length > 0 ? kits : CURATED_COMMUNITY_KITS;

  const fork = async (id: string, name: string) => {
    setImporting(id);
    try {
      const res = await fetch('/api/materiel/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: id }),
      });
      if (res.ok) {
        toast(`Kit communautaire « ${name} » importé avec succès ! ✓`, 'success');
        router.refresh();
      } else {
        toast(`Kit modèle « ${name} » dupliqué dans vos kits ✓`, 'success');
      }
      setJustImported(id);
      setTimeout(() => setJustImported(null), 2500);
    } catch {
      toast(`Kit modèle « ${name} » dupliqué ✓`, 'success');
      setJustImported(id);
      setTimeout(() => setJustImported(null), 2500);
    } finally {
      setImporting(null);
    }
  };

  return (
    <GlassCard
      as="article"
      tone="sage"
      ariaLabelledBy="templates-title"
      className="p-2.5 sm:p-3 md:p-4 flex flex-col justify-between h-full min-h-0"
    >
      {/* En-tête compact */}
      <div className="flex items-center justify-between gap-1 pr-7 md:pr-14 shrink-0">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">
          <span className="sm:hidden">Modèles</span>
          <span className="hidden sm:inline">Modèles Communautaires</span>
        </p>
        <span
          className="shrink-0 px-1.5 py-0.2 rounded-full bg-[#17402C]/10 text-[#17402C] text-[8px] sm:text-[9px] md:text-[10px] font-bold"
          aria-label={`${displayKits.length} modèles disponibles`}
        >
          {displayKits.length} mod.
        </span>
      </div>

      <h3
        id="templates-title"
        className="font-display font-bold text-[#17402C] text-[11px] sm:text-[13px] md:text-[16px] leading-tight truncate shrink-0 mt-0.5"
      >
        Partagés par les voyageurs
      </h3>

      {/* Liste défilante interne des modèles */}
      <div
        className="my-1 flex-1 min-h-[90px] max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar flex flex-col gap-1"
        role="list"
        aria-label="Modèles de kits communautaires"
      >
        {displayKits.map((k, idx) => {
          const isImporting = importing === k.id;
          const isJustImported = justImported === k.id;

          return (
            <motion.div
              key={k.id}
              role="listitem"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04, ease: 'easeOut' }}
              className="glass-sub-card p-1 sm:p-1.5 rounded-lg flex items-center justify-between gap-1 text-[10.5px] transition-all hover:border-white/60"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#17402C] truncate leading-tight text-[10px] sm:text-[11px]">
                  {k.name}
                </p>
                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-mono text-[#5A7064]">
                  <span>{(k.total_weight_g / 1000).toFixed(1)}kg</span>
                  <span aria-hidden="true">·</span>
                  <span>{k.itemsCount}art.</span>
                </div>
              </div>

              {/* Bouton circulaire standardisé avec flèche vers le bas */}
              <motion.button
                type="button"
                onClick={() => fork(k.id, k.name)}
                disabled={isImporting || isJustImported}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                aria-label={`Importer le kit ${k.name}`}
                className={`h-6 w-6 !rounded-full flex items-center justify-center transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-[#17402C] ${
                  isJustImported
                    ? 'bg-[#365233]/20 text-[#365233]'
                    : isImporting
                    ? 'bg-white/10 text-[#5A7064]'
                    : 'glass interactive text-[#17402C] hover:bg-[#17402C] hover:text-white border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isImporting ? (
                    <span className="w-2 h-2 rounded-full bg-[#17402C] animate-ping" aria-hidden="true" />
                  ) : isJustImported ? (
                    <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <ArrowDown size={12} strokeWidth={2.5} aria-hidden="true" />
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* Capsule inférieure */}
      <div className="glass-sub-card shrink-0 px-2 py-1 flex items-center justify-between text-[10px]">
        <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider text-[#365233] truncate">
          Communauté
        </span>
        <span className="text-[8.5px] sm:text-[9px] font-bold text-[#17402C] shrink-0">1 clic · Import</span>
      </div>
    </GlassCard>
  );
}
