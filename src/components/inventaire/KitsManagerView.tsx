'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomKit } from '@/hooks/useUserKits';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface KitsManagerViewProps {
  kits: CustomKit[];
  trashKits: CustomKit[];
  userEquipment: UserEquipmentItem[];
  onCreateKit: (data: {
    name: string;
    description?: string;
    for_destination?: string;
    season?: string;
    activity?: string;
    gearItems?: Array<{ item_name: string; category?: string; weight_g?: number }>;
  }) => Promise<any>;
  onUpdateKit: (kitId: string, patch: Partial<CustomKit>) => Promise<any>;
  onMoveToTrash: (kitId: string) => Promise<any>;
  onRestoreFromTrash: (kitId: string) => Promise<any>;
  onPermanentDelete: (kitId: string) => Promise<any>;
  onSelectKitForDeparture: (kit: CustomKit) => void;
}

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function KitsManagerView({
  kits,
  trashKits,
  userEquipment,
  onCreateKit,
  onUpdateKit,
  onMoveToTrash,
  onRestoreFromTrash,
  onPermanentDelete,
  onSelectKitForDeparture,
}: KitsManagerViewProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingKit, setEditingKit] = useState<CustomKit | null>(null);

  // Formulaire Kit
  const [formName, setFormName] = useState('');
  const [formDest, setFormDest] = useState('');
  const [formSeason, setFormSeason] = useState('Été');
  const [formActivity, setFormActivity] = useState('randonnee');
  const [selectedGearIds, setSelectedGearIds] = useState<Set<string>>(new Set());

  const handleOpenCreate = () => {
    triggerHaptic('selection');
    setEditingKit(null);
    setFormName('');
    setFormDest('');
    setFormSeason('Été');
    setFormActivity('randonnee');
    setSelectedGearIds(new Set());
    setShowCreateModal(true);
  };

  const handleOpenEdit = (kit: CustomKit) => {
    triggerHaptic('light');
    setEditingKit(kit);
    setFormName(kit.name);
    setFormDest(kit.for_destination || '');
    setFormSeason(kit.season || 'Été');
    setFormActivity(kit.activity || 'randonnee');
    const existingGearIds = new Set(
      kit.items.map((i) => i.gear_item_id).filter(Boolean) as string[]
    );
    setSelectedGearIds(existingGearIds);
    setShowCreateModal(true);
  };

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    triggerHaptic('selection');

    const selectedItems = Array.from(selectedGearIds).map((id) => {
      const gear = userEquipment.find((g) => g.id === id);
      return {
        gear_item_id: id,
        item_name: gear?.name || 'Article',
        category: gear?.category || 'Autre',
        weight_g: gear?.weight_g || 0,
      };
    });

    if (editingKit) {
      await onUpdateKit(editingKit.id, {
        name: formName.trim(),
        for_destination: formDest.trim(),
        season: formSeason,
        activity: formActivity,
      });
    } else {
      await onCreateKit({
        name: formName.trim(),
        for_destination: formDest.trim(),
        season: formSeason,
        activity: formActivity,
        gearItems: selectedItems,
      });
    }

    setShowCreateModal(false);
  };

  const toggleGearSelection = (gearId: string) => {
    triggerHaptic('light');
    setSelectedGearIds((prev) => {
      const next = new Set(prev);
      if (next.has(gearId)) next.delete(gearId);
      else next.add(gearId);
      return next;
    });
  };

  const sortedActiveKits = React.useMemo(() => {
    return [...kits].sort((a, b) => {
      const isAConfig = a.source === 'configurator' || a.name.toLowerCase().includes('ia') || a.name.toLowerCase().includes('configurateur');
      const isBConfig = b.source === 'configurator' || b.name.toLowerCase().includes('ia') || b.name.toLowerCase().includes('configurateur');
      if (isAConfig && !isBConfig) return -1;
      if (!isAConfig && isBConfig) return 1;
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });
  }, [kits]);

  const currentList = activeTab === 'active' ? sortedActiveKits : trashKits;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('active');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === 'active'
                ? 'bg-[#17402C] text-white shadow-xs'
                : 'bg-black/[0.04] text-[#6B7A72] hover:text-[#0B1F17]'
            }`}
          >
            Kits actifs ({kits.length})
          </button>
          {trashKits.length > 0 && (
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('trash');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeTab === 'trash'
                  ? 'bg-[#17402C] text-white shadow-xs'
                  : 'bg-black/[0.04] text-[#6B7A72] hover:text-[#0B1F17]'
              }`}
            >
              Corbeille ({trashKits.length})
            </button>
          )}
        </div>

        {activeTab === 'active' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('selection');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#17402C] text-white hover:bg-[#0B1F17] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>✨ Générer un kit par IA</span>
            </button>
            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-2 rounded-full text-xs font-semibold bg-black/[0.04] text-[#0B1F17] hover:bg-black/[0.08] transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>+ Manuel</span>
            </button>
          </div>
        )}
      </div>

      {/* Liste des Kits */}
      {currentList.length === 0 ? (
        <div className="p-8 sm:p-10 text-center rounded-3xl bg-white border border-black/[0.06] shadow-2xs space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E1EBDD] text-[#17402C] text-[11px] font-mono font-bold uppercase tracking-wider">
              ✨ Recommandé · Zéro effort
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#0B1F17] tracking-tight font-display">
              {activeTab === 'active'
                ? 'Générez votre premier kit avec l\'IA'
                : 'Corbeille vide'}
            </h3>
            <p className="text-xs text-[#6B7A72]">
              {activeTab === 'active'
                ? 'L\'assistant intelligent analyse votre façon de marcher et compose instantanément le kit idéal en sélectionnant votre équipement.'
                : 'Les kits supprimés restent ici 10 jours avant suppression définitive.'}
            </p>
          </div>

          {activeTab === 'active' && (
            <div className="space-y-4 max-w-xl mx-auto">
              {/* 4 Presets 1-Tap Rapides */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                {[
                  { title: 'Trek Montagne', emoji: '🏔️', sub: '3j Bivouac', cat: 'Trek' },
                  { title: 'Journée Estivale', emoji: '☀️', sub: 'Léger 15-25km', cat: 'Rando' },
                  { title: 'Bivouac Forêt', emoji: '🌲', sub: '2j Nature', cat: 'Bivouac' },
                  { title: 'Ultra-Light', emoji: '⚡', sub: 'Fastpacking 48h', cat: 'Trail' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={async () => {
                      triggerHaptic('selection');
                      await onCreateKit({
                        name: `Kit IA — ${preset.title}`,
                        description: `Généré automatiquement par l'IA (${preset.sub})`,
                        for_destination: 'France / Massifs',
                        season: 'Été',
                        activity: preset.cat,
                        gearItems: userEquipment.slice(0, 8).map((ue) => ({
                          item_name: ue.name,
                          category: ue.category,
                          weight_g: ue.weight_g || 0,
                        })),
                      });
                    }}
                    className="p-3 rounded-2xl bg-[#FBFAF6] hover:bg-[#E1EBDD]/40 border border-black/[0.05] hover:border-[#17402C]/30 transition-all text-left group cursor-pointer"
                  >
                    <span className="text-lg block mb-1">{preset.emoji}</span>
                    <span className="font-bold text-xs text-[#0B1F17] block truncate">{preset.title}</span>
                    <span className="text-[10px] text-[#6B7A72] block truncate">{preset.sub}</span>
                  </button>
                ))}
              </div>

              {/* Bouton Principal de Génération IA */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    triggerHaptic('selection');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold bg-[#17402C] text-white hover:bg-[#0B1F17] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>✨ Utiliser le Configurateur IA N°1</span>
                  <span>➔</span>
                </button>
                <button
                  onClick={handleOpenCreate}
                  className="w-full sm:w-auto px-4 py-3 rounded-full text-xs font-semibold text-[#6B7A72] hover:text-[#0B1F17] transition-colors"
                >
                  Ou créer manuellement
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {currentList.map((kit) => (
              <motion.div
                key={kit.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-5 border border-black/[0.06] flex flex-col justify-between shadow-2xs hover:shadow-md transition-all"
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {kit.source === 'configurator' && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FAF0DC] text-amber-900 border border-amber-200">
                          ✨ IA
                        </span>
                      )}
                      {kit.for_destination && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FBFAF6] text-[#6B7A72] border border-black/[0.06]">
                          📍 {kit.for_destination}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FBFAF6] text-[#6B7A72] border border-black/[0.06]">
                        {kit.season || 'Toutes saisons'}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-[#0B1F17] font-mono">
                      ⚖️ {formatWeight(kit.total_weight_g)}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-bold text-[#0B1F17] leading-snug mb-1">
                    {kit.name}
                  </h4>
                  <p className="text-[11px] text-[#6B7A72] line-clamp-2 mb-3">
                    {kit.description || `${kit.items.length} articles inclus`}
                  </p>

                  {/* Preview articles */}
                  <div className="space-y-1 py-2 border-t border-black/[0.04]">
                    {kit.items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-[11px] text-[#6B7A72]"
                      >
                        <span className="truncate pr-2">• {item.item_name}</span>
                        <span className="font-mono shrink-0">{item.weight_g} g</span>
                      </div>
                    ))}
                    {kit.items.length > 3 && (
                      <p className="text-[10px] text-[#6B7A72]/70 italic pt-0.5">
                        + {kit.items.length - 3} autres articles
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions bottom */}
                <div className="pt-3 mt-3 border-t border-black/[0.04] flex items-center justify-between gap-2">
                  {activeTab === 'active' ? (
                    <>
                      <button
                        onClick={() => {
                          triggerHaptic('selection');
                          onSelectKitForDeparture(kit);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#0B1F17] transition-colors flex items-center gap-1"
                      >
                        <span>⚡ Préparer une sortie</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(kit)}
                          className="p-1.5 text-[#6B7A72] hover:text-[#0B1F17] transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic('warning');
                            onMoveToTrash(kit.id);
                          }}
                          className="p-1.5 text-[#6B7A72] hover:text-rose-600 transition-colors"
                          title="Mettre en corbeille"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          triggerHaptic('selection');
                          onRestoreFromTrash(kit.id);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#17402C] text-white hover:bg-[#0B1F17]"
                      >
                        Restaurer
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('warning');
                          onPermanentDelete(kit.id);
                        }}
                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:underline"
                      >
                        Supprimer définitivement
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal Création / Édition Kit */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
          <div
            className="bg-white rounded-3xl p-6 max-w-lg w-full border border-black/[0.06] space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 12px 36px rgba(11,31,23,0.12)' }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F17]">
                  {editingKit ? 'Modifier le kit' : 'Créer un nouveau kit'}
                </h3>
                <p className="text-[11px] text-[#6B7A72]">
                  Composez un ensemble d'équipements pour vos sorties types
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#6B7A72] hover:text-[#0B1F17] p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                  Nom du kit *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex : Kit Bivouac Léger 3 Saisons"
                  className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                    Destination / Terrain
                  </label>
                  <input
                    type="text"
                    value={formDest}
                    onChange={(e) => setFormDest(e.target.value)}
                    placeholder="Ex : Haute Montagne, Corse..."
                    className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7A72] mb-1">
                    Saison
                  </label>
                  <select
                    value={formSeason}
                    onChange={(e) => setFormSeason(e.target.value)}
                    className="w-full bg-[#FBFAF6] border border-black/[0.06] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  >
                    <option value="Toutes saisons">Toutes saisons</option>
                    <option value="Printemps">Printemps</option>
                    <option value="Été">Été</option>
                    <option value="Automne">Automne</option>
                    <option value="Hiver">Hiver</option>
                  </select>
                </div>
              </div>

              {/* Sélection du matériel de l'utilisateur */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B7A72] mb-1.5">
                  Équipements à inclure ({selectedGearIds.size} sélectionnés)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-xl bg-[#FBFAF6] border border-black/[0.04]">
                  {userEquipment.length === 0 ? (
                    <p className="text-xs text-[#6B7A72] p-2 italic">
                      Aucun matériel enregistré. Ajoutez du matériel dans l'onglet Matériel.
                    </p>
                  ) : (
                    userEquipment.map((gear) => {
                      const isChecked = selectedGearIds.has(gear.id);
                      return (
                        <div
                          key={gear.id}
                          onClick={() => toggleGearSelection(gear.id)}
                          className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-[#17402C]/10 text-[#0B1F17] font-semibold'
                              : 'hover:bg-black/[0.03] text-[#6B7A72]'
                          }`}
                        >
                          <span className="truncate pr-2">
                            {isChecked ? '✓ ' : '○ '} {gear.name}
                          </span>
                          <span className="font-mono text-[10px] shrink-0">
                            {gear.weight_g} g
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium text-[#6B7A72] hover:bg-black/[0.04]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#0B1F17]"
                >
                  {editingKit ? 'Mettre à jour' : 'Créer le kit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
