'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  PlannedHike,
  getPlannedHikes,
  getActivePlannedHike,
  updatePlannedHike,
} from '@/lib/preparation/plannedHikes';
import {
  DepartureHikeContext,
  resolveDeparturePlan,
} from '@/lib/preparation/SmartDepartureEngine';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Constants ---
type CardId = 'depart' | 'kits' | 'alertes' | 'oublier' | 'equipements' | 'actions';
const DEFAULT_ORDER: CardId[] = ['depart', 'kits', 'alertes', 'oublier', 'equipements', 'actions'];

const CATEGORIES = ['Couchage', 'Portage', 'Cuisine', 'Vêtement', 'Navigation', 'Autre'];

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  return `${g} g`;
}

function daysUntil(targetDate?: string): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function buildHikeContext(h: PlannedHike): DepartureHikeContext {
  const days = (h.isOvernight && h.nightsCount ? h.nightsCount : 0) + (h.isOvernight ? 1 : 0);
  return {
    id: h.routeId || h.id,
    name: h.name,
    distanceKm: h.distanceKm,
    elevationGain: h.elevationGain,
    elevationLoss: h.elevationLoss,
    difficulty: h.difficulty,
    season: h.season,
    terrain: h.terrain,
    hasWaterPoints: h.hasWaterPoints,
    waterPointsCount: h.waterPointsCount,
    hasRefuges: h.hasRefuges,
    isOvernight: h.isOvernight,
    nightsCount: h.nightsCount,
    weather: h.weather || null,
    startDate: h.targetDate,
    durationHours: days > 0 ? days * 6 : Math.round((h.distanceKm / 3.8) * 10) / 10,
  };
}

export default function MonMaterielPage() {
  const { triggerHaptic } = useHapticFeedback();
  
  // Data hooks
  const { equipment, loading: equipmentLoading, addToEquipment, updateEquipment } = useEquipment();
  const { kits, updateKit, moveToTrash } = useUserKits(equipment);
  
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);
  const [activeHike, setActiveHike] = useState<PlannedHike | null>(null);

  useEffect(() => {
    setPlannedHikes(getPlannedHikes());
    setActiveHike(getActivePlannedHike() || getPlannedHikes()[0] || null);
  }, []);

  // UI state
  const [expandedCard, setExpandedCard] = useState<CardId | null>(null);
  const [cardOrder, setCardOrder] = useState<CardId[]>(DEFAULT_ORDER);
  
  useEffect(() => {
    const saved = localStorage.getItem('lkdv_cockpit_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) setCardOrder(parsed);
      } catch (e) {}
    }
  }, []);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Derived Data
  const activeKit = useMemo(() => kits.find(k => k.id === activeHike?.assignedKitId) || kits[0] || null, [kits, activeHike]);
  
  const departurePlan = useMemo(() => {
    if (!activeHike) return null;
    try {
      return resolveDeparturePlan(buildHikeContext(activeHike), kits, equipment);
    } catch { return null; }
  }, [activeHike, kits, equipment]);

  const hikeReadiness = useMemo(() => {
    if (!activeKit) return { readinessPct: 100, ownedCount: 0, totalCount: 0, missingItems: [] };
    const kitItems = activeKit.items || [];
    const missing: any[] = [];
    let owned = 0;
    kitItems.forEach((ki) => {
      const isOwned = equipment.some((e) => (ki.gear_item_id && e.id === ki.gear_item_id) || e.name.toLowerCase() === ki.item_name.toLowerCase());
      if (isOwned) owned++;
      else missing.push(ki);
    });
    return {
      readinessPct: kitItems.length > 0 ? Math.round((owned / kitItems.length) * 100) : 100,
      ownedCount: owned,
      totalCount: kitItems.length,
      missingItems: missing,
    };
  }, [activeKit, equipment]);

  const alerts = useMemo(() => {
    const now = Date.now();
    const out: any[] = [];
    equipment.forEach(it => {
      if (it.next_maintenance_date && new Date(it.next_maintenance_date).getTime() < now) out.push({ kind: 'maintenance', item: it });
      if (it.expiry_date && new Date(it.expiry_date).getTime() < now) out.push({ kind: 'expiry', item: it });
      if (it.condition === 'à_remplacer') out.push({ kind: 'replace', item: it });
      if (it.loan_status === 'prêté') out.push({ kind: 'loan', item: it });
    });
    return out;
  }, [equipment]);

  const proactiveList = useMemo(() => {
    const list: { label: string; critical: boolean }[] = [];
    hikeReadiness.missingItems.forEach(mi => list.push({ label: `Manquant: ${mi.item_name}`, critical: true }));
    alerts.forEach(a => {
      if (a.kind === 'expiry') list.push({ label: `Périmé: ${a.item.name}`, critical: true });
      if (a.kind === 'loan') list.push({ label: `Prêté: ${a.item.name}`, critical: false });
    });
    if (activeHike?.weather?.condition?.includes('Pluie')) list.push({ label: 'Vérifier protection pluie', critical: true });
    list.push({ label: 'Charger les batteries', critical: false });
    return list;
  }, [hikeReadiness, alerts, activeHike]);

  // Handlers
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(cardOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setCardOrder(items);
    localStorage.setItem('lkdv_cockpit_order', JSON.stringify(items));
    triggerHaptic('selection');
  };

  const closeExpanded = () => setExpandedCard(null);
  
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeExpanded(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Card Content Renderers
  const renderCardDepart = (isExpanded: boolean) => (
    <div className="flex flex-col h-full text-white p-2">
      {!activeHike ? (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-white/60 mb-4 text-center">Aucun départ prévu</p>
          <Link href="/explorer" className="px-4 py-2 bg-[#A3C4A3] text-[#0B1F17] font-bold rounded-full">Planifier une aventure</Link>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className={`font-extrabold ${isExpanded ? 'text-4xl' : 'text-xl'} mb-1`}>{activeHike.name}</h3>
              <p className="text-white/70 text-sm">{activeHike.terrain} · {activeHike.difficulty}</p>
            </div>
            <div className={`flex flex-col items-end ${hikeReadiness.readinessPct < 50 ? 'text-[#E76F51]' : 'text-[#A3C4A3]'}`}>
              <span className={`font-bold ${isExpanded ? 'text-5xl' : 'text-3xl'}`}>
                {(daysUntil(activeHike.targetDate) ?? 0) >= 0 ? `J-${daysUntil(activeHike.targetDate)}` : 'Terminé'}
              </span>
              <span className="text-sm opacity-80">{hikeReadiness.readinessPct}% prêt</span>
            </div>
          </div>
          {isExpanded && departurePlan && (
            <div className="mt-6 bg-white/5 p-4 rounded-xl border border-white/10">
              <h4 className="font-bold text-[#A3C4A3] mb-2 uppercase text-sm">Analyse SmartDeparture</h4>
              <p>Eau recommandée : {departurePlan.consumables.waterLiters} L</p>
              <p>Repas prévus : {departurePlan.consumables.foodMealsCount}</p>
              <p>Gaz : {departurePlan.consumables.fuelGrams} g</p>
              <div className="mt-4">
                <p className="font-bold mb-2">Checklist manquants ({hikeReadiness.missingItems.length}) :</p>
                <ul className="list-disc pl-5">
                  {hikeReadiness.missingItems.map((m, i) => <li key={i} className="text-[#E76F51]">{m.item_name}</li>)}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderCardKits = (isExpanded: boolean) => (
    <div className="flex flex-col h-full text-white p-2">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className={`font-bold ${isExpanded ? 'text-6xl' : 'text-4xl'} text-[#A3C4A3]`}>{kits.length}</span>
        <span className="text-white/70 text-sm uppercase">Kits actifs</span>
        {activeKit && (
          <div className="mt-2 text-center">
            <p className="font-bold truncate w-full max-w-[150px]">{activeKit.name}</p>
            <p className="text-xs text-[#A3C4A3]">{formatWeight(activeKit.total_weight_g || 0)}</p>
          </div>
        )}
        <button onClick={() => setIsKitDrawerOpen(true)} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-bold w-full transition-colors">Ouvrir</button>
      </div>
      {isExpanded && (
        <div className="mt-8 space-y-2">
          {kits.map(k => (
            <div key={k.id} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-xl">
              <span className="font-bold">{k.name}</span>
              <span className="text-[#A3C4A3]">{formatWeight(k.total_weight_g || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCardAlertes = (isExpanded: boolean) => (
    <div className="flex flex-col h-full text-white p-2">
      <div className="flex flex-col items-center justify-center h-full gap-2">
        {alerts.length === 0 ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#A3C4A3]/20 flex items-center justify-center text-2xl">✅</div>
            <span className="text-[#A3C4A3] font-bold text-sm">Tout est ok</span>
          </>
        ) : (
          <>
            <span className={`font-bold ${isExpanded ? 'text-6xl' : 'text-4xl'} text-[#E76F51] drop-shadow-[0_0_15px_rgba(231,111,81,0.5)]`}>
              {alerts.length}
            </span>
            <span className="text-white/70 text-sm uppercase text-center">Alertes</span>
            {!isExpanded && <p className="text-xs text-[#E76F51] mt-2 text-center px-2 bg-[#E76F51]/10 rounded-full">{alerts[0].kind === 'loan' ? 'Prêt en cours' : 'Action requise'}</p>}
          </>
        )}
      </div>
      {isExpanded && alerts.length > 0 && (
        <div className="mt-6 space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="p-3 bg-[#E76F51]/10 border border-[#E76F51]/30 rounded-xl text-sm">
              <span className="font-bold capitalize">{a.kind}: </span>{a.item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCardOublier = (isExpanded: boolean) => (
    <div className="flex flex-col h-full text-white p-2">
      <div className="flex items-center gap-4 mb-4">
        <span className={`font-bold ${isExpanded ? 'text-5xl' : 'text-3xl'} ${proactiveList.some(p => p.critical) ? 'text-[#E9C46A] drop-shadow-[0_0_15px_rgba(233,196,106,0.3)]' : 'text-[#A3C4A3]'}`}>
          {proactiveList.length}
        </span>
        <span className="text-white/70 uppercase text-sm font-bold">À vérifier</span>
      </div>
      <div className="space-y-2 flex-1 overflow-hidden">
        {proactiveList.slice(0, isExpanded ? 20 : 3).map((item, i) => (
          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${item.critical ? 'bg-[#E9C46A]/10 border border-[#E9C46A]/20' : 'bg-white/5 border border-white/10'}`}>
            <input type="checkbox" className="w-4 h-4 accent-[#A3C4A3]" />
            <span className={`text-sm ${item.critical ? 'text-[#E9C46A]' : 'text-white'}`}>{item.label}</span>
          </div>
        ))}
        {!isExpanded && proactiveList.length > 3 && (
          <p className="text-xs text-white/50 text-center mt-2">+{proactiveList.length - 3} autres éléments...</p>
        )}
      </div>
    </div>
  );

  const renderCardEquipements = (isExpanded: boolean) => {
    const counts = CATEGORIES.reduce((acc, cat) => {
      acc[cat] = equipment.filter(e => (e.category || 'Autre').toLowerCase().includes(cat.toLowerCase())).length;
      return acc;
    }, {} as Record<string, number>);
    
    return (
      <div className="flex flex-col h-full text-white p-2">
        <h4 className="font-bold uppercase text-white/70 text-xs mb-3 text-center">Catégories</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map(cat => (
            <div key={cat} className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs flex gap-2 items-center">
              <span>{cat}</span>
              <span className="text-[#A3C4A3] font-bold">{counts[cat]}</span>
            </div>
          ))}
        </div>
        {isExpanded && (
          <div className="mt-8 flex justify-center">
            <button onClick={() => { setIsAddModalOpen(true); closeExpanded(); }} className="px-6 py-3 bg-[#A3C4A3] text-[#0B1F17] font-bold rounded-full">
              + Ajouter à l'inventaire
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderCardActions = (isExpanded: boolean) => (
    <div className="flex flex-col h-full text-white p-2 justify-center gap-3">
      <button onClick={() => setIsAddModalOpen(true)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition-colors border border-white/10">+ Équipement</button>
      <button onClick={() => setIsKitDrawerOpen(true)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition-colors border border-white/10">Ouvrir Kits</button>
      <button onClick={() => setIsLendModalOpen(true)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition-colors border border-white/10">Prêter</button>
    </div>
  );

  const getCardContent = (id: CardId, isExpanded: boolean) => {
    switch (id) {
      case 'depart': return renderCardDepart(isExpanded);
      case 'kits': return renderCardKits(isExpanded);
      case 'alertes': return renderCardAlertes(isExpanded);
      case 'oublier': return renderCardOublier(isExpanded);
      case 'equipements': return renderCardEquipements(isExpanded);
      case 'actions': return renderCardActions(isExpanded);
      default: return null;
    }
  };

  const getCardTitle = (id: CardId) => {
    switch (id) {
      case 'depart': return 'Prochain départ';
      case 'kits': return 'Mes Kits';
      case 'alertes': return 'Alertes';
      case 'oublier': return 'À ne pas oublier';
      case 'equipements': return 'Mes Équipements';
      case 'actions': return 'Actions rapides';
      default: return '';
    }
  };

  // Render
  return (
    <div className="fixed inset-0 w-full bg-[#0B1F17] text-white overflow-hidden flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 pt-24 pb-8 flex flex-col h-[100dvh]">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="cockpit-grid" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full"
              >
                {cardOrder.map((cardId, index) => {
                  const isLarge = cardId === 'depart' || cardId === 'oublier';
                  const isHidden = expandedCard && expandedCard !== cardId;
                  
                  return (
                    <Draggable key={cardId} draggableId={cardId} index={index} isDragDisabled={expandedCard !== null}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${isLarge ? 'md:col-span-2' : 'md:col-span-1'} h-full min-h-[220px] transition-all duration-300`}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: isHidden ? 0.15 : (snapshot.isDragging ? 0.8 : 1),
                            transform: `${provided.draggableProps.style?.transform || ''} ${isHidden ? 'scale(0.98)' : 'scale(1)'}`,
                          }}
                        >
                          <motion.div
                            layoutId={`card-container-${cardId}`}
                            className="w-full h-full rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-md flex flex-col overflow-hidden"
                          >
                            {/* Card Header */}
                            <motion.div layoutId={`card-header-${cardId}`} className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="text-white/40 hover:text-white cursor-grab active:cursor-grabbing" aria-label="Déplacer">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <h2 className="font-bold text-sm uppercase tracking-wider">{getCardTitle(cardId)}</h2>
                              </div>
                              <button
                                onClick={() => { triggerHaptic('selection'); setExpandedCard(cardId); }}
                                aria-label="Agrandir"
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                              </button>
                            </motion.div>
                            
                            {/* Card Content Compact */}
                            <div className="flex-1 p-4 overflow-hidden">
                              {getCardContent(cardId, false)}
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </main>

      {/* Expanded Fullscreen Overlay */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            onClick={closeExpanded}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedCard && (
          <motion.div
            layoutId={`card-container-${expandedCard}`}
            transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.45 }}
            className="fixed inset-4 md:inset-10 z-50 rounded-[32px] border border-white/20 bg-[#0B1F17] shadow-2xl flex flex-col overflow-hidden"
          >
            <motion.div layoutId={`card-header-${expandedCard}`} className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20 shrink-0">
              <h2 className="font-bold text-2xl uppercase tracking-wider text-[#A3C4A3]">{getCardTitle(expandedCard)}</h2>
              <button
                onClick={closeExpanded}
                aria-label="Réduire"
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>
              </button>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex-1 p-8 overflow-y-auto"
            >
              {getCardContent(expandedCard, true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals & Drawers from existing file */}
      <AddEditGearModal
        isOpen={isAddModalOpen}
        initialItem={editingItem as any}
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }}
        onSave={async () => { setIsAddModalOpen(false); setEditingItem(null); }}
      />

      <KitCockpitDrawer
        isOpen={isKitDrawerOpen}
        kit={selectedKitForCockpit || activeKit || kits[0] || null}
        userEquipment={equipment}
        onClose={() => { setIsKitDrawerOpen(false); setSelectedKitForCockpit(null); }}
        onSelectForDeparture={(kit) => {
          setSelectedKitForCockpit(kit);
          if (activeHike) updatePlannedHike(activeHike.id, { assignedKitId: kit.id });
          setIsKitDrawerOpen(false);
        }}
        onUpdateKit={async (kitId, patch) => updateKit(kitId, patch)}
        onDeleteKit={async (kitId) => { await moveToTrash(kitId); setIsKitDrawerOpen(false); }}
        onAddGearToInventory={async (product) => addToEquipment({ name: product.name, category: product.category || 'Autre', weight_g: product.weight_g || 100 })}
        onAddToCart={(p) => addToCart({ id: p.id || 'prod', slug: 'equip', name: p.name, brand: 'LKDV', priceEur: p.price_eur || 99, weightG: p.weight_g || 100, category: 'équipement', image: '', imageAlt: '' })}
      />

      <LendItemModal
        isOpen={isLendModalOpen}
        item={equipment[0]}
        onClose={() => setIsLendModalOpen(false)}
        onSaveLoan={async () => { setIsLendModalOpen(false); }}
      />
    </div>
  );
}