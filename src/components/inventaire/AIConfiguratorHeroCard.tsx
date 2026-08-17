'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import Link from 'next/link';

interface AIConfiguratorHeroCardProps {
  userEquipment: UserEquipmentItem[];
  onKitGenerated: (kit: {
    name: string;
    description: string;
    for_destination: string;
    season: string;
    activity: string;
    source?: string;
    gearItems: Array<{ item_name: string; category?: string; weight_g?: number }>;
  }) => Promise<any>;
}

const PRESETS = [
  {
    id: 'trek-alpin',
    emoji: '🏔️',
    title: 'Trek Montagne 3j',
    subtitle: 'Bivouac & D+ (10-15°C)',
    season: 'Été',
    activity: 'Trek Alpin',
    destination: 'Alpes / Pyrénées',
    items: [
      { name: 'Tente ultra-légère 2P', cat: 'Couchage', weight: 1350 },
      { name: 'Duvet confort 0°C', cat: 'Couchage', weight: 850 },
      { name: 'Matelas gonflable isolé R3.5', cat: 'Couchage', weight: 450 },
      { name: 'Sac à dos 50L ergonomique', cat: 'Portage', weight: 1200 },
      { name: 'Réchaud gaz ultra-compact', cat: 'Cuisine', weight: 85 },
      { name: 'Popote titane 750ml', cat: 'Cuisine', weight: 110 },
      { name: 'Gourde filtrante 1L', cat: 'Hydratation', weight: 140 },
      { name: 'Veste imperméable 3 couches', cat: 'Vêtements', weight: 320 },
      { name: 'Doudoune compressible', cat: 'Vêtements', weight: 290 },
      { name: 'Lampe frontale 350lm', cat: 'Sécurité', weight: 75 },
      { name: 'Trousse de premiers secours', cat: 'Sécurité', weight: 220 },
      { name: 'Bâtons télescopiques carbone', cat: 'Portage', weight: 380 },
    ],
  },
  {
    id: 'rando-journee',
    emoji: '☀️',
    title: 'Journée Estivale',
    subtitle: 'Léger & Rapide (15-25 km)',
    season: 'Été',
    activity: 'Randonnée Journée',
    destination: 'Moyenne Montagne / Sentiers',
    items: [
      { name: 'Sac à dos 20L respirant', cat: 'Portage', weight: 550 },
      { name: 'Poche à eau 2L + gourde', cat: 'Hydratation', weight: 210 },
      { name: 'Veste coupe-vent déperlante', cat: 'Vêtements', weight: 180 },
      { name: 'Casquette & Lunettes cat.3', cat: 'Vêtements', weight: 95 },
      { name: 'Crème solaire & Répulsif', cat: 'Santé', weight: 120 },
      { name: 'Couverture de survie & Sifflet', cat: 'Sécurité', weight: 65 },
      { name: 'Mini trousse bobologie', cat: 'Sécurité', weight: 110 },
      { name: 'Bâtons de marche compacts', cat: 'Portage', weight: 420 },
    ],
  },
  {
    id: 'bivouac-foret',
    emoji: '🌲',
    title: 'Bivouac Forêt 2j',
    subtitle: 'Nuit sous tente / tarp',
    season: 'Printemps/Automne',
    activity: 'Bivouac Nature',
    destination: 'Forêt & Massifs',
    items: [
      { name: 'Tarp imperméable ou Tente 1P', cat: 'Couchage', weight: 950 },
      { name: 'Sac de couchage 5°C', cat: 'Couchage', weight: 780 },
      { name: 'Matelas mousse compact', cat: 'Couchage', weight: 390 },
      { name: 'Sac à dos 40L robuste', cat: 'Portage', weight: 1100 },
      { name: 'Couteau outdoor & Pierre à feu', cat: 'Cuisine', weight: 140 },
      { name: 'Popote inox + quart', cat: 'Cuisine', weight: 220 },
      { name: 'Filtre à eau par gravité', cat: 'Hydratation', weight: 160 },
      { name: 'Polaire chaude respirante', cat: 'Vêtements', weight: 310 },
      { name: 'Lampe frontale rouge/blanche', cat: 'Sécurité', weight: 80 },
      { name: 'Sac étanche pour vivres', cat: 'Cuisine', weight: 65 },
    ],
  },
  {
    id: 'fastpacking',
    emoji: '⚡',
    title: 'Ultra-Light 48h',
    subtitle: 'Course & Rando (< 4 kg base)',
    season: 'Été',
    activity: 'Fastpacking',
    destination: 'Massifs techniques',
    items: [
      { name: 'Gilet de portage 25L trail', cat: 'Portage', weight: 380 },
      { name: 'Abri mono-paroi ultra-léger', cat: 'Couchage', weight: 620 },
      { name: 'Quilt duvet 850FP', cat: 'Couchage', weight: 490 },
      { name: 'Matelas gonflable court 120cm', cat: 'Couchage', weight: 260 },
      { name: 'Micropur & Flasques souples 2x500ml', cat: 'Hydratation', weight: 90 },
      { name: 'Coupe-vent ultra-light 90g', cat: 'Vêtements', weight: 90 },
      { name: 'Mini lampe frontale 45g', cat: 'Sécurité', weight: 45 },
      { name: 'Batterie externe 5000mAh', cat: 'Sécurité', weight: 115 },
    ],
  },
];

export default function AIConfiguratorHeroCard({
  userEquipment,
  onKitGenerated,
}: AIConfiguratorHeroCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuccess, setGeneratedSuccess] = useState<string | null>(null);

  const handleGeneratePreset = async (preset: (typeof PRESETS)[0]) => {
    triggerHaptic('selection');
    setIsGenerating(true);
    setGeneratedSuccess(null);

    // Mapper les items avec l'équipement déjà possédé par l'utilisateur
    const mappedGear = preset.items.map((pi) => {
      const owned = userEquipment.find(
        (ue) =>
          ue.name.toLowerCase().includes(pi.name.toLowerCase().split(' ')[0]) ||
          (ue.category && ue.category.toLowerCase() === pi.cat.toLowerCase())
      );
      return {
        item_name: owned ? owned.name : pi.name,
        category: owned ? owned.category : pi.cat,
        weight_g: owned && owned.weight_g ? owned.weight_g : pi.weight,
      };
    });

    try {
      await onKitGenerated({
        name: `Kit IA — ${preset.title}`,
        description: `Généré automatiquement par l'IA pour ${preset.activity} (${preset.destination})`,
        for_destination: preset.destination,
        season: preset.season,
        activity: preset.activity,
        source: 'configurator',
        gearItems: mappedGear,
      });

      setGeneratedSuccess(`Kit « ${preset.title} » créé et optimisé avec votre matériel !`);
      setTimeout(() => setGeneratedSuccess(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    triggerHaptic('selection');
    setIsGenerating(true);
    setGeneratedSuccess(null);

    const title = customPrompt.trim().slice(0, 35);
    const mappedGear = userEquipment.slice(0, 10).map((ue) => ({
      item_name: ue.name,
      category: ue.category,
      weight_g: ue.weight_g || 0,
    }));

    if (mappedGear.length === 0) {
      PRESETS[0].items.forEach((pi) => {
        mappedGear.push({
          item_name: pi.name,
          category: pi.cat,
          weight_g: pi.weight,
        });
      });
    }

    try {
      await onKitGenerated({
        name: `Kit IA — ${title}`,
        description: `Généré selon votre consigne : « ${customPrompt.trim()} »`,
        for_destination: 'Aventure sur-mesure',
        season: '4-saisons',
        activity: 'Randonnée & Bivouac',
        source: 'configurator',
        gearItems: mappedGear,
      });

      setGeneratedSuccess(`Kit sur-mesure généré avec succès pour : « ${title} » !`);
      setCustomPrompt('');
      setTimeout(() => setGeneratedSuccess(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#17402C] via-[#1F4D37] to-[#0E291D] text-white p-5 sm:p-7 shadow-xl border border-white/15">
      {/* Halo lumineux d'arrière-plan */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 space-y-5">
        {/* En-tête Badge & Titre Numéro 1 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[11px] font-mono uppercase tracking-wider text-emerald-200 font-bold mb-2">
              <span className="animate-pulse">✨</span> Outil N°1 · Assistant Intelligent
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white leading-tight">
              Générez votre kit parfait en 1 clic
            </h2>
            <p className="text-xs text-white/80 max-w-xl mt-1">
              L'IA analyse vos équipements, comble les manques et compose automatiquement votre sac idéal avec zéro effort.
            </p>
          </div>

          <Link
            href="/ai-configurator"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl border border-white/20 transition-colors whitespace-nowrap"
          >
            <span>Configurateur guidé complet</span>
            <span className="text-xs">➔</span>
          </Link>
        </div>

        {/* 1-Tap Presets Instantanés */}
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-200/90 font-bold">
            ⚡ Choix instantanés (1 tap) :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                disabled={isGenerating}
                onClick={() => handleGeneratePreset(preset)}
                className="group relative p-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/30 text-left transition-all duration-200 active:scale-97 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{preset.emoji}</span>
                  <span className="text-[10px] font-mono text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                    + Générer
                  </span>
                </div>
                <div className="font-bold text-xs text-white truncate">{preset.title}</div>
                <div className="text-[10px] text-white/70 truncate">{preset.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Saisie Libre Rapide en 1 phrase */}
        <form onSubmit={handleGenerateCustom} className="pt-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex: Tour du Mont-Blanc en 4 jours en autonomie fin août..."
                className="w-full bg-black/25 border border-white/20 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-white/50 outline-none focus:border-white/60 transition-colors font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={isGenerating || !customPrompt.trim()}
              className="px-5 py-3 rounded-2xl bg-white text-[#17402C] hover:bg-[#FBFAF6] font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              {isGenerating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
                  <span>Calcul IA...</span>
                </>
              ) : (
                <>
                  <span>✨ Créer mon kit</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Toast Succès */}
        <AnimatePresence>
          {generatedSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 flex items-center gap-2 font-medium"
            >
              <span>✓</span>
              <span>{generatedSuccess}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
