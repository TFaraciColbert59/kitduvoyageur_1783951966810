'use client';

import type { Metadata } from 'next';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useEquipment } from '@/src/hooks/useEquipment';
import { useUserKits } from '@/src/hooks/useUserKits';
import { SmartDepartureEngine } from '@/src/lib/preparation/SmartDepartureEngine';
import { plannedHikesState } from '@/src/lib/preparation/plannedHikes';
import { formatDate, formatDateRange, daysUntil } from '@/src/lib/utils/dateHelpers';
import { formatWeight } from '@/src/lib/utils/formatters';
import { useToast } from '@/src/components/ui/use-toast';
import { WidgetGrid, Widget, WidgetHandle, WidgetAgrandirButton } from '@/src/components/dashboard';
import {
  ProchainDepartWidget,
  MesKitsWidget,
  DontForgetWidget,
  InventaireWidget,
  DisponibiliteWidget,
  AlertesWidget
} from '@/src/components/dashboard/widgets';
import { useDragDrop } from '@/src/hooks/useDragDrop';
import { usePersistence } from '@/src/hooks/usePersistence';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mon Matériel & Inventaire',
  description: 'Inventaire complet de votre équipement outdoor et calcul de poids pour vos expéditions.',
  alternates: {
    canonical: `${siteUrl}/mon-materiel`,
  },
  robots: { index: false, follow: false },
};

export default function MonMaterielPage() {
  const { equipment, isLoading, error, addToEquipment, removeFromEquipment, updateEquipment } = useEquipment();
  const { kits, activeKit, createKit, updateKit, trashKit } = useUserKits();
  const { plannedHikes, addHike, updateHike, removeHike, setActiveHike } = plannedHikesState;
  const { toast } = useToast();

  // Initialize SmartDepartureEngine
  const [smartDepartureEngine] = useState(() => new SmartDepartureEngine());

  // Widget state
  const [widgets, setWidgets] = useState([
    { id: 'prochain-depart', type: 'prochain-depart', order: 0 },
    { id: 'mes-kits', type: 'mes-kits', order: 1 },
    { id: 'a-ne-pas-oublier', type: 'a-ne-pas-oublier', order: 2 },
    { id: 'inventaire-catalogue', type: 'inventaire-catalogue', order: 3 },
    { id: 'disponibilite', type: 'disponibilite', order: 4 },
    { id: 'alertes', type: 'alertes', order: 5 }
  ]);

  // Load widget order from persistence
  const { loadPersistence, savePersistence } = usePersistence('widget-order');
  useEffect(() => {
    const loadWidgetOrder = async () => {
      const savedOrder = await loadPersistence();
      if (savedOrder && Array.isArray(savedOrder)) {
        setWidgets(savedOrder);
      }
    };
    loadWidgetOrder();
  }, [loadPersistence]);

  // Save widget order when it changes
  useEffect(() => {
    savePersistence(widgets);
  }, [widgets, savePersistence]);

  // Reorder widgets based on current order state
  const reorderedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  // Active widget for fullscreen view
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  // Handle widget drag & drop
  const { handleDragStart, handleDragOver, handleDrop } = useDragDrop(
    (sourceIndex, destinationIndex) => {
      setWidgets(prev => {
        const newWidgets = [...prev];
        const [movedItem] = newWidgets.splice(sourceIndex, 1);
        newWidgets.splice(destinationIndex, 0, movedItem);

        // Update order values
        return newWidgets.map((widget, index) => ({
          ...widget,
          order: index
        }));
      });
    }
  );

  // Handle widget click for fullscreen
  const handleWidgetClick = (widgetId: string) => {
    setActiveWidgetId(widgetId);
  };

  // Handle widget close (exit fullscreen)
  const handleWidgetClose = () => {
    setActiveWidgetId(null);
  };

  // Handle widget agrandir button
  const handleWidgetAgrandir = (widgetId: string) => {
    setActiveWidgetId(widgetId);
  };

  // Calculate derived data for widgets
  const activeHike = plannedHikes.find(hike => hike.id === setActiveHike());

  // Get departure plan from SmartDepartureEngine
  const [departurePlan, setDeparturePlan] = useState(null);
  useEffect(() => {
    if (activeHike) {
      const plan = smartDepartureEngine.generateDeparturePlan(activeHike, equipment, kits);
      setDeparturePlan(plan);
    } else {
      setDeparturePlan(null);
    }
  }, [activeHike, equipment, kits, smartDepartureEngine]);

  // Get recommended kit
  const recommendedKit = departurePlan?.recommendedKit || null;

  // Calculate equipment stats
  const totalWeightG = equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0);
  const totalValue = equipment.reduce((sum, item) => sum + (item.purchase_price || 0), 0);

  // Calculate availability stats
  const availableItems = equipment.filter(item =>
    item.condition !== 'abîmé' &&
    item.loan_status !== 'prêté' &&
    !item.needs_maintenance
  );

  const unavailableItems = equipment.filter(item =>
    item.condition === 'abîmé' ||
    item.loan_status === 'prêté' ||
    item.needs_maintenance
  );

  // Calculate alertes
  const alerts = [];

  // Maintenance alerts
  equipment.forEach(item => {
    if (item.needs_maintenance) {
      alerts.push({
        id: `maintenance-${item.id}`,
        label: `${item.name} nécessite un entretien`,
        itemId: item.id,
        type: 'maintenance'
      });
    }

    if (item.next_maintenance_date && new Date(item.next_maintenance_date) < new Date()) {
      alerts.push({
        id: `maintenance-overdue-${item.id}`,
        label: `${item.name} : entretien dépassé`,
        itemId: item.id,
        type: 'maintenance-overdue'
      });
    }
  });

  // Expiry alerts (for consumables)
  equipment.forEach(item => {
    if (item.expiry_date && new Date(item.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
      alerts.push({
        id: `expiry-${item.id}`,
        label: `${item.name} : périmé bientôt`,
        itemId: item.id,
        type: 'expiry'
      });
    }
  });

  // Loan alerts for critical items
  equipment.forEach(item => {
    if (item.loan_status === 'prêté' && item.is_critical) {
      alerts.push({
        id: `loan-critical-${item.id}`,
        label: `${item.name} : prêté (article critique)`,
        itemId: item.id,
        type: 'loan-critical'
      });
    }
  });

  // Missing items for active hike
  if (activeHike && departurePlan?.missingItems) {
    departurePlan.missingItems.forEach((missingItem: any) => {
      alerts.push({
        id: `missing-${missingItem.id}`,
        label: `${missingItem.name} : manquant pour ${activeHike.name}`,
        itemId: missingItem.id,
        type: 'missing-item'
      });
    });
  }

  // Weight excess alerts
  if (activeHike && departurePlan?.weightExceedsLimit) {
    alerts.push({
      id: `weight-excess-${activeHike.id}`,
      label: `Poids du kit : ${formatWeight(departurePlan.totalWeightG)} (limite dépassée)`,
      itemId: activeHike.id,
      type: 'weight-excess'
    });
  }

  // Handle equipment updates from widgets
  const handleEquipmentUpdate = useCallback(async (updates: any) => {
    if (updates.id) {
      await updateEquipment(updates.id, updates);
      toast({ description: 'Équipement mis à jour', variant: 'default' });
    } else {
      await addToEquipment(updates);
      toast({ description: 'Équipement ajouté', variant: 'default' });
    }
  }, [addToEquipment, updateEquipment, toast]);

  // Handle kit updates from widgets
  const handleKitUpdate = useCallback(async (kitId: string, updates: any) => {
    await updateKit(kitId, updates);
    toast({ description: 'Kit mis à jour', variant: 'default' });
  }, [updateKit, toast]);

  // Handle hike creation from widgets
  const handleCreateHike = useCallback(async (hikeData: any) => {
    await addHike(hikeData);
    toast({ description: 'Randonnée créée', variant: 'default' });
  }, [addHike, toast]);

  // Handle assigning kit to hike
  const handleAssignKitToHike = useCallback(async (hikeId: string, kitId: string) => {
    await updateHike(hikeId, { kitId });
    await updateKit(kitId, { assignedToHike: hikeId });
    toast({ description: 'Kit assigné au départ', variant: 'default' });
  }, [updateHike, updateKit, toast]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center bg-black/50">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-2 border-white/20 rounded-full animate-spin"></div>
          <p className="text-white/70">Chargement de votre matériel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center bg-black/50">
        <div className="text-center space-y-4">
          <div className="text-2xl">⚠️</div>
          <p className="text-white/70">Erreur de chargement : {error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-black">
      {/* Fullscreen widget overlay */}
      {activeWidgetId && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-sm">
          <div className="fixed inset-0 p-4 pointer-events-none">
            <div className="max-w-6xl w-full h-full pointer-events-all">
              {widgets.find(w => w.id === activeWidgetId)?.type === 'prochain-depart' && (
                <ProchainDepartWidget
                  equipment={equipment}
                  kits={kits}
                  activeHike={activeHike}
                  departurePlan={departurePlan}
                  recommendedKit={recommendedKit}
                  onUpdateEquipment={handleEquipmentUpdate}
                  onUpdateKit={handleKitUpdate}
                  onCreateHike={handleCreateHike}
                  onAssignKitToHike={handleAssignKitToHike}
                  onClose={handleWidgetClose}
                  isFullscreen={true}
                />
              )}
              {widgets.find(w => w.id === activeWidgetId)?.type === 'mes-kits' && (
                <MesKitsWidget
                  equipment={equipment}
                  kits={kits}
                  activeKit={activeKit}
                  onUpdateEquipment={handleEquipmentUpdate}
                  onUpdateKit={handleKitUpdate}
                  onCreateKit={createKit}
                  onClose={handleWidgetClose}
                  isFullscreen={true}
                />
              )}
              {widgets.find(w => w.id === activeWidgetId)?.type === 'a-ne-pas-oublier' && (
                <DontForgetWidget
                  equipment={equipment}
                  activeHike={activeHike}
                  departurePlan={departurePlan}
                  onUpdateEquipment={handleEquipmentUpdate}
                  onClose={handleWidgetClose}
                  isFullscreen={true}
                />
              )}
              {widgets.find(w => w.id === activeWidgetId)?.type === 'inventaire-catalogue' && (
                <InventaireWidget
                  equipment={equipment}
                  onUpdateEquipment={handleEquipmentUpdate}
                  onClose={handleWidgetClose}
                  isFullscreen={true}
                />
              )}
              {widgets.find(w => w.id === activeWidgetId)?.type === 'disponibilite' && (
                <DisponibiliteWidget
                  equipment={equipment}
                  onUpdateEquipment={handleEquipmentUpdate}
                  onClose={handleWidgetClose}
                  isFullscreen={true}
                />
              )}
              {widgets.find(w => w.id === activeWidgetId)?.type === 'alertes' && (
                <AlertesWidget
                  equipment={equipment}
                  alerts={alerts}
                  onUpdateEquipment={handleEquipmentUpdate}
                  onClose={handleWidgetClose}
                  isFullscreen={true}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main dashboard grid */}
      <div className="p-4">
        <h1 className="mb-6 text-2xl font-bold text-white">
          Cockpit Smart - Mon Matériel
        </h1>

        <WidgetGrid
          widgets={reorderedWidgets}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onWidgetClick={handleWidgetClick}
          onWidgetAgrandir={handleWidgetAgrandir}
        >
          {reorderedWidgets.map(widget => {
            const isActive = widget.id === activeWidgetId;

            switch (widget.type) {
              case 'prochain-depart':
                return (
                  <Widget
                    key={widget.id}
                    id={widget.id}
                    title="Prochain départ"
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !isActive && handleWidgetClick(widget.id)}
                    isActive={isActive}
                    className={isActive ? 'hidden' : ''}
                  >
                    <ProchainDepartWidget
                      equipment={equipment}
                      kits={kits}
                      activeHike={activeHike}
                      departurePlan={departurePlan}
                      recommendedKit={recommendedKit}
                      onUpdateEquipment={handleEquipmentUpdate}
                      onUpdateKit={handleKitUpdate}
                      onCreateHike={handleCreateHike}
                      onAssignKitToHike={handleAssignKitToHike}
                      onClose={() => {/* Handled by parent */}}
                      isFullscreen={false}
                      onAgrandir={() => handleWidgetAgrandir(widget.id)}
                    />
                  </Widget>
                );

              case 'mes-kits':
                return (
                  <Widget
                    key={widget.id}
                    id={widget.id}
                    title="Mes kits"
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !isActive && handleWidgetClick(widget.id)}
                    isActive={isActive}
                    className={isActive ? 'hidden' : ''}
                  >
                    <MesKitsWidget
                      equipment={equipment}
                      kits={kits}
                      activeKit={activeKit}
                      onUpdateEquipment={handleEquipmentUpdate}
                      onUpdateKit={handleKitUpdate}
                      onCreateKit={createKit}
                      onClose={() => {/* Handled by parent */}}
                      isFullscreen={false}
                      onAgrandir={() => handleWidgetAgrandir(widget.id)}
                    />
                  </Widget>
                );

              case 'a-ne-pas-oublier':
                return (
                  <Widget
                    key={widget.id}
                    id={widget.id}
                    title="À ne pas oublier"
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !isActive && handleWidgetClick(widget.id)}
                    isActive={isActive}
                    className={isActive ? 'hidden' : ''}
                  >
                    <DontForgetWidget
                      equipment={equipment}
                      activeHike={activeHike}
                      departurePlan={departurePlan}
                      onUpdateEquipment={handleEquipmentUpdate}
                      onClose={() => {/* Handled by parent */}}
                      isFullscreen={false}
                      onAgrandir={() => handleWidgetAgrandir(widget.id)}
                    />
                  </Widget>
                );

              case 'inventaire-catalogue':
                return (
                  <Widget
                    key={widget.id}
                    id={widget.id}
                    title="Inventaire & catalogue"
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !isActive && handleWidgetClick(widget.id)}
                    isActive={isActive}
                    className={isActive ? 'hidden' : ''}
                  >
                    <InventaireWidget
                      equipment={equipment}
                      onUpdateEquipment={handleEquipmentUpdate}
                      onClose={() => {/* Handled by parent */}}
                      isFullscreen={false}
                      onAgrandir={() => handleWidgetAgrandir(widget.id)}
                    />
                  </Widget>
                );

              case 'disponibilite':
                return (
                  <Widget
                    key={widget.id}
                    id={widget.id}
                    title="Disponibilité"
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !isActive && handleWidgetClick(widget.id)}
                    isActive={isActive}
                    className={isActive ? 'hidden' : ''}
                  >
                    <DisponibiliteWidget
                      equipment={equipment}
                      onUpdateEquipment={handleEquipmentUpdate}
                      onClose={() => {/* Handled by parent */}}
                      isFullscreen={false}
                      onAgrandir={() => handleWidgetAgrandir(widget.id)}
                    />
                  </Widget>
                );

              case 'alertes':
                return (
                  <Widget
                    key={widget.id}
                    id={widget.id}
                    title="Alertes"
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => !isActive && handleWidgetClick(widget.id)}
                    isActive={isActive}
                    className={isActive ? 'hidden' : ''}
                  >
                    <AlertesWidget
                      equipment={equipment}
                      alerts={alerts}
                      onUpdateEquipment={handleEquipmentUpdate}
                      onClose={() => {/* Handled by parent */}}
                      isFullscreen={false}
                      onAgrandir={() => handleWidgetAgrandir(widget.id)}
                    />
                  </Widget>
                );

              default:
                return null;
            }
          })}
        </WidgetGrid>
      </div>
    </div>
  );
}