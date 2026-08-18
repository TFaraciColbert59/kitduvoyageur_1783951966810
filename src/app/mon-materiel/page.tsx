'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem, UnifiedProduct } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  PlannedHike,
  getPlannedHikes,
  getActivePlannedHike,
  updatePlannedHike,
  setActivePlannedHikeId,
} from '@/lib/preparation/plannedHikes';
import {
  DepartureHikeContext,
  resolveDeparturePlan,
  DeparturePreparationPlan,
} from '@/lib/preparation/SmartDepartureEngine';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';

import { ProchainDepartWidget } from '@/components/cockpit/widgets/ProchainDepartWidget';
import { MesKitsWidget } from '@/components/cockpit/widgets/MesKitsWidget';
import { OublierWidget } from '@/components/cockpit/widgets/OublierWidget';
import { InventaireWidget } from '@/components/cockpit/widgets/InventaireWidget';
import { DisponibiliteWidget } from '@/components/cockpit/widgets/DisponibiliteWidget';
import { AlertesWidget } from '@/components/cockpit/widgets/AlertesWidget';

import { useWidgetExpansion, CardId } from '@/hooks/useWidgetExpansion';
import { useWidgetOrder, CardId as OrderCardId } from '@/hooks/useWidgetOrder';
import { FullscreenOverlay } from '@/components/cockpit/FullscreenOverlay';

import '@/styles/tokens.css';

// Types
type WidgetId = CardId;

const WIDGET_ORDER: WidgetId[] = ['depart', 'kits', 'oublier', 'inventaire', 'disponibilite', 'alertes'];
const LARGE_WIDGETS: WidgetId[] = ['depart', 'kits', 'oublier', 'inventaire'];

interface WidgetConfig {
  id: WidgetId;
  title: string;
  isLarge: boolean;
}

const WIDGET_CONFIGS: Record<WidgetId, WidgetConfig> = {
  depart: { id: 'depart', title: 'Prochain départ', isLarge: true },
  kits: { id: 'kits', title: 'Mes Kits', isLarge: true },
  oublier: { id: 'oublier', title: 'À ne pas oublier', isLarge: true },
  inventaire: { id: 'inventaire', title: 'Inventaire & Catalogue', isLarge: true },
  disponibilite: { id: 'disponibilite', title: 'Disponibilité', isLarge: false },
  alertes: { id: 'alertes', title: 'Alertes & Fiabilité', isLarge: false },
};

function formatWeight(g: number): string {
  if (!g || g <= 0) return '0 g';
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(g)} g`;
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

  // --- Data Hooks ---
  const {
    equipment,
    loading: equipmentLoading,
    addToEquipment,
    updateEquipment,
    removeFromEquipment,
    products: catalogProducts,
  } = useEquipment();

  const {
    kits,
    updateKit,
    moveToTrash,
    createKit,
  } = useUserKits(equipment);

  // --- Planned Hikes State ---
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);
  const [activeHike, setActiveHike] = useState<PlannedHike | null>(null);

  useEffect(() => {
    const hikes = getPlannedHikes();
    setPlannedHikes(hikes);
    setActiveHike(getActivePlannedHike() || hikes[0] || null);
  }, []);

  // --- Widget Expansion (Animation Cinématique) ---
  const {
    expandedCard,
    isAnimating,
    expandCard,
    collapseCard,
    registerCardRef,
    registerContentRef,
    getContainerTransition,
    getContentTransition,
    getBackdropTransition,
    prefersReducedMotion,
  } = useWidgetExpansion({
    onExpandStart: (cardId) => triggerHaptic('selection'),
    onExpandComplete: (cardId) => triggerHaptic('success'),
    onCollapseStart: (cardId) => triggerHaptic('selection'),
    onCollapseComplete: (cardId) => {},
  });

  // --- Widget Order (Drag & Drop Persistant) ---
  const {
    cardOrder,
    handleDragEnd,
    isInitialized,
  } = useWidgetOrder({
    onOrderChange: (newOrder) => {},
  });

  // --- Toast ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    triggerHaptic('success');
    setTimeout(() => setToastMessage(null), 3500);
  }, [triggerHaptic]);

  // --- Modals & Drawers ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [selectedLendItem, setSelectedLendItem] = useState<UserEquipmentItem | null>(null);

  // --- Fullscreen Filters State ---
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('Tous');
  const [gearSearchQuery, setGearSearchQuery] = useState<string>('');
  const [gearPossessionFilter, setGearPossessionFilter] = useState<'all' | 'owned' | 'catalog'>('all');
  const [selectedKitInFullscreen, setSelectedKitInFullscreen] = useState<string | null>(null);
  const [checkedOublis, setCheckedOublis] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem('lkdv_checked_oublis');
    if (saved) {
      try { setCheckedOublis(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const toggleOubliCheck = (id: string) => {
    triggerHaptic('selection');
    setCheckedOublis(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('lkdv_checked_oublis', JSON.stringify(next));
      return next;
    });
  };

  // --- Derived Calculations ---
  const activeKit = useMemo(() => {
    if (activeHike?.assignedKitId) {
      const match = kits.find(k => k.id === activeHike.assignedKitId);
      if (match) return match;
    }
    return kits[0] || null;
  }, [kits, activeHike]);

  useEffect(() => {
    if (activeKit && !selectedKitInFullscreen) {
      setSelectedKitInFullscreen(activeKit.id);
    }
  }, [activeKit, selectedKitInFullscreen]);

  const departurePlan: DeparturePreparationPlan | null = useMemo(() => {
    if (!activeHike) return null;
    try {
      return resolveDeparturePlan(buildHikeContext(activeHike), kits, equipment);
    } catch {
      return null;
    }
  }, [activeHike, kits, equipment]);

  const hikeReadiness = useMemo(() => {
    if (!activeKit) return { readinessPct: 100, ownedCount: 0, totalCount: 0, missingItems: [] as any[] };
    const kitItems = activeKit.items || [];
    const missing: any[] = [];
    let owned = 0;
    kitItems.forEach((ki) => {
      const isOwned = equipment.some((e) =>
        (ki.gear_item_id && e.id === ki.gear_item_id) ||
        e.name.toLowerCase() === ki.item_name.toLowerCase()
      );
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

  // Alertes
  const alerts = useMemo(() => {
    const now = Date.now();
    const out: any[] = [];
    equipment.forEach(it => {
      if (it.next_maintenance_date && new Date(it.next_maintenance_date).getTime() < now) {
        out.push({
          id: `maint-${it.id}`, kind: 'maintenance',
          title: `Entretien dépassé : ${it.name}`,
          description: `Prévu le ${new Date(it.next_maintenance_date).toLocaleDateString('fr-FR')}.`,
          critical: true, item: it,
        });
      }
      if (it.expiry_date && new Date(it.expiry_date).getTime() < (now + 30 * 86400000)) {
        const isPast = new Date(it.expiry_date).getTime() < now;
        out.push({
          id: `exp-${it.id}`, kind: 'expiry',
          title: `${isPast ? 'Périmé' : 'Péremption proche'} : ${it.name}`,
          description: `Date limite : ${new Date(it.expiry_date).toLocaleDateString('fr-FR')}.`,
          critical: isPast, item: it,
        });
      }
      if (it.condition === 'à_remplacer' || it.condition === 'à_réparer') {
        out.push({
          id: `rep-${it.id}`, kind: 'replace',
          title: `Matériel ${it.condition.replace('_', ' ')} : ${it.name}`,
          description: `État dégradé. Remplacement recommandé.`,
          critical: true, item: it,
        });
      }
      if (it.loan_status === 'prêté') {
        out.push({
          id: `loan-${it.id}`, kind: 'loan',
          title: `Matériel prêté : ${it.name}`,
          description: `Prêté à ${it.loan_to_name || 'un ami'}.`,
          critical: false, item: it,
        });
      }
    });
    return out;
  }, [equipment]);

  // Actions
  const handleAddProductToCart = (product: UnifiedProduct | { name: string; price_eur?: number; weight_g?: number; id?: string }) => {
    addToCart({
      id: product.id || `custom-${Date.now()}`,
      slug: (product as UnifiedProduct).slug || 'equipement-outdoor',
      name: product.name,
      brand: (product as UnifiedProduct).brand || 'LKDV Sélection',
      priceEur: product.price_eur || 49,
      weightG: product.weight_g || 150,
      category: (product as UnifiedProduct).category || 'équipement',
      image: (product as UnifiedProduct).image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80',
      imageAlt: product.name,
    });
    showToast(`✓ "${product.name}" ajouté au panier`);
  };

  const handleReturnLoan = async (item: UserEquipmentItem) => {
    await updateEquipment(item.id, { loan_status: 'disponible', loan_to_name: null });
    showToast(`✓ "${item.name}" marqué comme récupéré !`);
  };

  const handleResolveMaintenance = async (item: UserEquipmentItem) => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    await updateEquipment(item.id, {
      last_maintenance_date: new Date().toISOString().split('T')[0],
      next_maintenance_date: nextYear,
      condition: 'bon',
    });
    showToast(`✓ Entretien de "${item.name}" validé pour 1 an`);
  };

  const handleAddToEquipment = useCallback(async (product: any, condition = { condition: 'neuf' }) => {
    await addToEquipment(product, condition);
    showToast(`✓ "${product.name}" ajouté à votre inventaire`);
  }, [addToEquipment, showToast]);

  // Refs pour les cards (pour animation shared layout)
  const cardRefs = useRef<Map<WidgetId, HTMLDivElement>>(new Map());
  const headerRefs = useRef<Map<WidgetId, HTMLDivElement>>(new Map());

  const registerCardRefWrapper = (id: WidgetId, el: HTMLDivElement | null) => {
    registerCardRef(id, el);
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  const registerHeaderRefWrapper = (id: WidgetId, el: HTMLDivElement | null) => {
    if (el) headerRefs.current.set(id, el);
    else headerRefs.current.delete(id);
  };

  // Handler pour changer la randonnée active
  const handleSetActiveHike = (hike: PlannedHike) => {
    setActiveHike(hike);
    setActivePlannedHikeId(hike.id);
    triggerHaptic('selection');
  };

  const handleAssignKitToDeparture = (kit: CustomKit) => {
    if (activeHike) {
      updatePlannedHike(activeHike.id, { assignedKitId: kit.id });
      setActiveHike(prev => prev ? { ...prev, assignedKitId: kit.id } : null);
      showToast(`✓ "${kit.name}" assigné au départ`);
    }
  };

  const handleOpenKitDrawer = (kit?: CustomKit) => {
    setSelectedKitForCockpit(kit || activeKit || kits[0] || null);
    setIsKitDrawerOpen(true);
  };

  const handleCreateKit = () => {
    createKit({
      name: `Nouveau Kit (${kits.length + 1})`,
      description: 'Kit sur-mesure',
      season: '3 Saisons',
      activity: 'Randonnée',
      for_destination: 'Toutes destinations',
      items: [],
    });
    showToast('✓ Nouveau kit créé');
  };

  return (
    <div className="cockpit-root">
      <Header />

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="toast"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="cockpit-main">
        {isInitialized && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="cockpit-grid" direction="horizontal">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="cockpit-grid"
                >
                  {cardOrder.map((widgetId, index) => {
                    const config = WIDGET_CONFIGS[widgetId];
                    const isLarge = config.isLarge;
                    const isHidden = expandedCard && expandedCard !== widgetId;

                    return (
                      <Draggable
                        key={widgetId}
                        draggableId={widgetId}
                        index={index}
                        isDragDisabled={expandedCard !== null || isAnimating}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={(el) => {
                              provided.innerRef(el);
                              registerCardRefWrapper(widgetId, el);
                            }}
                            {...provided.draggableProps}
                            className={`${isLarge ? 'cockpit-card--large' : 'cockpit-card--compact'} cockpit-card h-full transition-all duration-300`}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: isHidden ? 0.15 : (snapshot.isDragging ? 0.8 : 1),
                              transform: `${provided.draggableProps.style?.transform || ''} ${isHidden ? 'scale(0.98)' : 'scale(1)'}`,
                            }}
                          >
                            <motion.div
                              layoutId={`card-container-${widgetId}`}
                              className="glass-card w-full h-full flex flex-col overflow-hidden"
                            >
                              {/* Card Header */}
                              <motion.div
                                ref={(el) => registerHeaderRefWrapper(widgetId, el)}
                                layoutId={`card-header-${widgetId}`}
                                className="widget-controls flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/25 shrink-0"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="drag-handle"
                                    aria-label={`Déplacer la carte ${config.title}`}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                      <circle cx="9" cy="6" r="1.5" />
                                      <circle cx="15" cy="6" r="1.5" />
                                      <circle cx="9" cy="12" r="1.5" />
                                      <circle cx="15" cy="12" r="1.5" />
                                      <circle cx="9" cy="18" r="1.5" />
                                      <circle cx="15" cy="18" r="1.5" />
                                    </svg>
                                  </div>
                                  <h2 className="font-bold text-xs uppercase tracking-wider text-white/90">
                                    {config.title}
                                  </h2>
                                </div>

                                <button
                                  onClick={() => expandCard(widgetId)}
                                  aria-label={`Agrandir le widget ${config.title}`}
                                  className="expand-btn"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </motion.div>

                              {/* Card Content */}
                              <div className="flex-1 p-3.5 overflow-hidden flex flex-col">
                                {renderWidgetContent(widgetId, false)}
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
        )}
      </main>

      {/* Fullscreen Overlays - un par widget possible */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={getBackdropTransition()}
            className="fixed inset-0 z-[600] bg-black/85 backdrop-blur-md"
            onClick={collapseCard}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {expandedCard && (
        <FullscreenOverlay
          isOpen={true}
          cardId={expandedCard}
          cardTitle={WIDGET_CONFIGS[expandedCard].title}
          layoutId={`card-container-${expandedCard}`}
          headerLayoutId={`card-header-${expandedCard}`}
          onClose={collapseCard}
        >
          {renderWidgetContent(expandedCard, true)}
        </FullscreenOverlay>
      )}

      {/* Modals & Drawers */}
      <AddEditGearModal
        isOpen={isAddModalOpen}
        initialItem={editingItem as any}
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }}
        onSave={async (itemData) => {
          if (editingItem) {
            await updateEquipment(editingItem.id, itemData);
            showToast('✓ Équipement mis à jour');
          } else {
            await addToEquipment(itemData as any);
            showToast('✓ Équipement ajouté à l\'inventaire');
          }
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
      />

      <KitCockpitDrawer
        isOpen={isKitDrawerOpen}
        kit={selectedKitForCockpit || activeKit || kits[0] || null}
        userEquipment={equipment}
        onClose={() => { setIsKitDrawerOpen(false); setSelectedKitForCockpit(null); }}
        onSelectForDeparture={handleAssignKitToDeparture}
        onUpdateKit={async (kitId, patch) => { await updateKit(kitId, patch); showToast('✓ Kit mis à jour'); }}
        onDeleteKit={async (kitId) => { await moveToTrash(kitId); setIsKitDrawerOpen(false); showToast('✓ Kit supprimé'); }}
        onAddGearToInventory={async (product) => { await handleAddToEquipment(product); }}
        onAddToCart={handleAddProductToCart}
      />

      <LendItemModal
        isOpen={isLendModalOpen}
        item={selectedLendItem || equipment[0] || null}
        onClose={() => { setIsLendModalOpen(false); setSelectedLendItem(null); }}
        onSaveLoan={async (borrowerName, returnDate, notes) => {
          if (selectedLendItem) {
            await updateEquipment(selectedLendItem.id, {
              loan_status: 'prêté',
              loan_to_name: borrowerName,
              expiry_date: returnDate,
              notes: notes || selectedLendItem.notes,
            });
            showToast(`✓ "${selectedLendItem.name}" prêté à ${borrowerName}`);
          }
          setIsLendModalOpen(false);
          setSelectedLendItem(null);
        }}
      />
    </div>
  );

  // --- Rendu du contenu des widgets ---
  function renderWidgetContent(widgetId: WidgetId, isExpanded: boolean) {
    switch (widgetId) {
      case 'depart':
        return (
          <ProchainDepartWidget
            activeHike={activeHike}
            plannedHikes={plannedHikes}
            activeKit={activeKit}
            kits={kits}
            departurePlan={departurePlan}
            hikeReadiness={hikeReadiness}
            equipment={equipment}
            onSetActiveHike={handleSetActiveHike}
            onOpenKitDrawer={handleOpenKitDrawer}
            onExpand={() => expandCard('depart')}
            onCloseExpanded={collapseCard}
            isExpanded={isExpanded}
            cardRef={cardRefs.current.get('depart') || null}
            headerRef={headerRefs.current.get('depart') || null}
            layoutId={`card-container-depart`}
            headerLayoutId={`card-header-depart`}
          />
        );

      case 'kits':
        return (
          <MesKitsWidget
            kits={kits}
            activeKit={activeKit}
            activeHike={activeHike}
            equipment={equipment}
            selectedKitInFullscreen={selectedKitInFullscreen}
            onSetSelectedKitInFullscreen={setSelectedKitInFullscreen}
            onOpenKitDrawer={handleOpenKitDrawer}
            onCreateKit={handleCreateKit}
            onAssignKitToDeparture={handleAssignKitToDeparture}
            onExpand={() => expandCard('kits')}
            onCloseExpanded={collapseCard}
            isExpanded={isExpanded}
            cardRef={cardRefs.current.get('kits') || null}
            headerRef={headerRefs.current.get('kits') || null}
            layoutId={`card-container-kits`}
            headerLayoutId={`card-header-kits`}
          />
        );

      case 'oublier':
        return (
          <OublierWidget
            activeHike={activeHike}
            activeKit={activeKit}
            kits={kits}
            departurePlan={departurePlan}
            hikeReadiness={hikeReadiness}
            equipment={equipment}
            catalogProducts={catalogProducts || []}
            alerts={alerts}
            checkedOublis={checkedOublis}
            onToggleCheck={toggleOubliCheck}
            onExpand={() => expandCard('oublier')}
            onCloseExpanded={collapseCard}
            onAddToCart={handleAddProductToCart}
            onAddToEquipment={handleAddToEquipment}
            isExpanded={isExpanded}
            cardRef={cardRefs.current.get('oublier') || null}
            headerRef={headerRefs.current.get('oublier') || null}
            layoutId={`card-container-oublier`}
            headerLayoutId={`card-header-oublier`}
          />
        );

      case 'inventaire':
        return (
          <InventaireWidget
            equipment={equipment}
            catalogProducts={catalogProducts || []}
            selectedCategoryTab={selectedCategoryTab}
            setSelectedCategoryTab={setSelectedCategoryTab}
            gearSearchQuery={gearSearchQuery}
            setGearSearchQuery={setGearSearchQuery}
            gearPossessionFilter={gearPossessionFilter}
            setGearPossessionFilter={setGearPossessionFilter}
            onOpenAddModal={() => { setEditingItem(null); setIsAddModalOpen(true); }}
            onAddToEquipment={handleAddToEquipment}
            onAddToCart={handleAddProductToCart}
            onOpenLendModal={(item) => { setSelectedLendItem(item); setIsLendModalOpen(true); }}
            onOpenEditModal={(item) => { setEditingItem(item); setIsAddModalOpen(true); }}
            onExpand={() => expandCard('inventaire')}
            onCloseExpanded={collapseCard}
            isExpanded={isExpanded}
            cardRef={cardRefs.current.get('inventaire') || null}
            headerRef={headerRefs.current.get('inventaire') || null}
            layoutId={`card-container-inventaire`}
            headerLayoutId={`card-header-inventaire`}
          />
        );

      case 'disponibilite':
        return (
          <DisponibiliteWidget
            equipment={equipment}
            onExpand={() => expandCard('disponibilite')}
            onCloseExpanded={collapseCard}
            isExpanded={isExpanded}
            cardRef={cardRefs.current.get('disponibilite') || null}
            headerRef={headerRefs.current.get('disponibilite') || null}
            layoutId={`card-container-disponibilite`}
            headerLayoutId={`card-header-disponibilite`}
          />
        );

      case 'alertes':
        return (
          <AlertesWidget
            equipment={equipment}
            kits={kits}
            activeHike={activeHike}
            departurePlan={departurePlan}
            onExpand={() => expandCard('alertes')}
            onCloseExpanded={collapseCard}
            isExpanded={isExpanded}
            cardRef={cardRefs.current.get('alertes') || null}
            headerRef={headerRefs.current.get('alertes') || null}
            layoutId={`card-container-alertes`}
            headerLayoutId={`card-header-alertes`}
            onResolveMaintenance={handleResolveMaintenance}
            onReturnLoan={handleReturnLoan}
            onAddToCart={handleAddProductToCart}
          />
        );

      default:
        return null;
    }
  }
}