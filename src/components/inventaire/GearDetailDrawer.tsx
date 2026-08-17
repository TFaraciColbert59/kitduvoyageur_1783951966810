'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { adaptUserEquipmentToGearItemData, evaluateGearAlerts } from '@/lib/equipmentAdapter';
import ItemHero from '@/components/inventaire/ItemHero';
import HistoryTimeline from '@/components/inventaire/HistoryTimeline';
import LoansList from '@/components/inventaire/LoansList';
import LocationCard from '@/components/inventaire/LocationCard';
import NotesEditor from '@/components/inventaire/NotesEditor';
import TechSpecTable from '@/components/inventaire/TechSpecTable';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GearDetailDrawerProps {
  isOpen: boolean;
  item: UserEquipmentItem | null;
  onClose: () => void;
  onEdit: (item: UserEquipmentItem) => void;
  onDelete: (id: string) => void;
  onUpdateNotes?: (gearId: string, notes: string) => Promise<void>;
  onAddToKit?: (item: UserEquipmentItem) => void;
  onLend?: (item: UserEquipmentItem) => void;
  onToggleFavorite?: (id: string) => void;
  onAddToCart?: (item: any) => void;
}

export default function GearDetailDrawer({
  isOpen,
  item,
  onClose,
  onEdit,
  onDelete,
  onUpdateNotes,
  onAddToKit,
  onLend,
  onToggleFavorite,
  onAddToCart,
}: GearDetailDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeTab, setActiveTab] = useState<'apercu' | 'historique' | 'specs'>('apercu');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Détermination du slug de produit boutique correspondant
  const productSlug = useMemo(() => {
    if (!item) return null;
    if (item.ref_code && item.ref_code.startsWith('prod-')) return item.ref_code.replace('prod-', '') + '-achat';
    const nameLower = item.name.toLowerCase();
    if (nameLower.includes('farpoint')) return 'osprey-farpoint-40-achat';
    if (nameLower.includes('atmos')) return 'osprey-atmos-ag-65-achat';
    if (nameLower.includes('hubba')) return 'msr-hubba-hubba-nx-2-achat';
    if (nameLower.includes('spark')) return 'sea-to-summit-spark-sp1-achat';
    if (nameLower.includes('neoair')) return 'thermarest-neoair-xlite-achat';
    if (nameLower.includes('torrentshell')) return 'patagonia-torrentshell-3l-achat';
    if (nameLower.includes('actik')) return 'petzl-actik-core-achat';
    if (nameLower.includes('sawyer')) return 'sawyer-mini-achat';
    if (nameLower.includes('pocketrocket')) return 'msr-pocketrocket-2-achat';
    if (nameLower.includes('inreach')) return 'garmin-inreach-mini-2-achat';
    if (nameLower.includes('opinel')) return 'opinel-n8-inox-achat';
    if (nameLower.includes('care plus') || nameLower.includes('secours')) return 'care-plus-first-aid-kit-mountaineer-achat';
    if (nameLower.includes('anker') || nameLower.includes('batterie')) return 'anker-powercore-10000-achat';
    return item.product_id || null;
  }, [item]);

  if (!item) return null;

  const adaptedData = adaptUserEquipmentToGearItemData(item);
  const alerts = evaluateGearAlerts(item);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end font-sans">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative z-10 bg-[#FBFAF6] w-full sm:max-w-xl h-[88vh] sm:h-full flex flex-col rounded-t-3xl sm:rounded-none overflow-hidden"
            style={{ boxShadow: '0 20px 48px rgba(11,31,23,0.14)' }}
          >
            {/* Drag handle mobile */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 bg-black/15 rounded-full" />
            </div>

            {/* Header épuré */}
            <div className="px-5 py-3.5 bg-white border-b border-black/[0.04] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    onClose();
                  }}
                  className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#0B1F17] transition-colors shrink-0"
                  aria-label="Fermer"
                >
                  <Icon name="ArrowLeftIcon" size={14} />
                </button>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0B1F17] truncate">
                    {item.name}
                  </h2>
                  <p className="text-[11px] text-[#6B7A72] truncate">
                    {item.brand || 'Équipement'} · {item.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    triggerHaptic('selection');
                    onEdit(item);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#17402C] text-white hover:bg-[#0B1F17] transition-colors"
                >
                  Éditer
                </button>
                <button
                  onClick={() => {
                    triggerHaptic('warning');
                    onDelete(item.id);
                  }}
                  className="p-1.5 rounded-full text-[#6B7A72] hover:text-rose-600 transition-colors"
                  title="Supprimer"
                  aria-label="Supprimer"
                >
                  <Icon name="TrashIcon" size={15} />
                </button>
              </div>
            </div>

            {/* Onglets discrets */}
            <div className="px-5 py-2 bg-white border-b border-black/[0.04] flex gap-1.5 shrink-0">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('apercu');
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTab === 'apercu'
                    ? 'bg-[#17402C] text-white'
                    : 'text-[#6B7A72] hover:text-[#0B1F17]'
                }`}
              >
                Fiche
              </button>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('specs');
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTab === 'specs'
                    ? 'bg-[#17402C] text-white'
                    : 'text-[#6B7A72] hover:text-[#0B1F17]'
                }`}
              >
                Détails & Specs
              </button>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('historique');
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTab === 'historique'
                    ? 'bg-[#17402C] text-white'
                    : 'text-[#6B7A72] hover:text-[#0B1F17]'
                }`}
              >
                Historique
              </button>
            </div>

            {/* Contenu fluide */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-28 sm:pb-8">
              {/* Carte Lien Boutique Officielle */}
              {productSlug && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0B1F17] to-[#17402C] text-white space-y-2.5 shadow-sm border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#9ECB8A] font-semibold">
                      🛍️ Fiche Boutique Officielle
                    </span>
                    <span className="text-xs font-bold text-white font-mono">
                      {item.purchase_price ? `${item.purchase_price} €` : 'LKDV Store'}
                    </span>
                  </div>
                  <p className="text-xs text-white/75 leading-relaxed">
                    Accédez aux caractéristiques détaillées du fabricant, aux avis certifiés des aventuriers et aux pièces détachées.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/produit/${productSlug}`}
                      className="flex-1 py-2 px-3.5 rounded-full bg-white text-[#0B1F17] text-xs font-semibold hover:bg-[#F5F3EC] transition-colors text-center flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Voir la fiche produit</span>
                      <span>➔</span>
                    </Link>
                    {onAddToCart && (
                      <button
                        onClick={() => {
                          triggerHaptic('selection');
                          onAddToCart(item);
                        }}
                        className="py-2 px-3.5 rounded-full bg-[#E4C695] text-[#0B1F17] text-xs font-bold hover:bg-[#D4B685] transition-colors shrink-0"
                      >
                        🛒 Commander
                      </button>
                    )}
                  </div>
                </div>
              )}

              {alerts.totalAlertsCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 text-xs text-[#0B1F17] space-y-1">
                  {alerts.hasMaintenanceDue && (
                    <p>🔧 Entretien recommandé pour cet article.</p>
                  )}
                  {alerts.isLent && (
                    <p>🤝 Actuellement prêté à {alerts.lentToName || 'un ami'}.</p>
                  )}
                  {alerts.hasExpired && (
                    <p>⚠️ Date de péremption dépassée.</p>
                  )}
                </div>
              )}

              {activeTab === 'apercu' && (
                <>
                  <ItemHero
                    item={adaptedData}
                    onEdit={() => onEdit(item)}
                    onAddToKit={() => onAddToKit && onAddToKit(item)}
                    onLend={() => onLend && onLend(item)}
                    onToggleFavorite={() => onToggleFavorite && onToggleFavorite(item.id)}
                  />

                  <LocationCard
                    loanStatus={item.loan_status}
                    borrowerName={item.loan_to_name}
                    attachedPack={item.compartment || 'Sac principal'}
                    onLend={() => onLend && onLend(item)}
                  />

                  <NotesEditor
                    notes={item.notes || ''}
                    onSave={async (val) => {
                      if (onUpdateNotes) await onUpdateNotes(item.id, val);
                    }}
                  />
                </>
              )}

              {activeTab === 'specs' && (
                <TechSpecTable
                  item={adaptedData}
                  onEdit={() => onEdit(item)}
                />
              )}

              {activeTab === 'historique' && (
                <>
                  <HistoryTimeline />
                  {item.loan_to_name && (
                    <LoansList
                      loans={[
                        {
                          id: 'loan-1',
                          item_id: item.id,
                          item_name: item.name,
                          lender_id: item.user_id,
                          borrower_id: '',
                          borrower_name: item.loan_to_name,
                          loan_date: item.acquired_at || 'En cours',
                          status: 'en cours',
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
