'use client';

import React, { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  CloudRain,
  GripVertical,
  Hand,
  Moon,
  PauseCircle,
  Sun,
  Tent,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';
import type { HudContrastVariant } from '../primitives/ExplorerNonModalSheet';
import { IosToggleSwitch } from '../primitives/IosGlassControls';
import { COCKPIT_FIELD_LABELS } from './GpsCockpitGrid';

export interface GpsTerrainControlsSubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sportSlug: string;
  contrast: HudContrastVariant;
  onContrastChange: (contrast: HudContrastVariant) => void;
  glovesMode: boolean;
  onToggleGlovesMode: (enabled: boolean) => void;
  rainLockActive: boolean;
  onToggleRainLock: (enabled: boolean) => void;
  bivouacSleepActive?: boolean;
  onToggleBivouacSleep?: () => void;
  audioMuted?: boolean;
  onToggleAudio?: () => void;
  autoPauseEnabled: boolean;
  onToggleAutoPause: (enabled: boolean) => void;
  cockpitFields: readonly string[];
  onReorderCockpitFields: (nextOrder: string[]) => void;
}

function SortableKpiRow({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    background: 'rgba(255, 255, 255, 0.92)',
    border: '0.5px solid rgba(23, 64, 44, 0.1)',
    color: 'var(--xp-hud-ink)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex min-h-[46px] items-center justify-between rounded-2xl px-3.5 py-2 text-[13.5px] font-bold"
    >
      <span>{COCKPIT_FIELD_LABELS[id] ?? id}</span>
      <button
        type="button"
        aria-label={`Déplacer ${COCKPIT_FIELD_LABELS[id] ?? id}`}
        className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-xl"
        style={{ background: 'rgba(23, 64, 44, 0.06)' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Contrôles terrain extrêmes (Soleil AAA, Nuit Rouge OLED, Gants >= 60 px, Pluie, Bivouac)
 * avec interrupteurs iOS 18 animés et réorganisation Drag & Drop `@dnd-kit` des tuiles KPI.
 */
export function GpsTerrainControlsSubDrawer({
  open,
  onOpenChange,
  sportSlug,
  contrast,
  onContrastChange,
  glovesMode,
  onToggleGlovesMode,
  rainLockActive,
  onToggleRainLock,
  bivouacSleepActive = false,
  onToggleBivouacSleep,
  audioMuted = false,
  onToggleAudio,
  autoPauseEnabled,
  onToggleAutoPause,
  cockpitFields,
  onReorderCockpitFields,
}: GpsTerrainControlsSubDrawerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = useMemo(() => [...cockpitFields], [cockpitFields]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`lkdv_cockpit_fields_${sportSlug}`, JSON.stringify(next));
      }
    } catch {
      // ignore storage quota
    }
    onReorderCockpitFields(next);
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 22,
    padding: 13,
    background: 'rgba(255, 255, 255, 0.88)',
    border: '0.5px solid rgba(23, 64, 44, 0.1)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(16, 32, 25, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Contrôles terrain & Cockpit"
      subtitle="Conditions extrêmes · Ordre des données"
      contrast={contrast}
      glovesMode={glovesMode}
    >
      <div className="flex flex-col gap-3.5 pb-2">
        {/* Contraste segmenté style iOS */}
        <section style={cardStyle}>
          <span className="px-0.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: '#56665D' }}>
            Lisibilité écran
          </span>
          <div
            role="radiogroup"
            aria-label="Mode de contraste"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 4,
              padding: 4,
              borderRadius: 15,
              background: 'rgba(23, 64, 44, 0.07)',
            }}
          >
            {(
              [
                { id: 'standard', label: 'Liquid Glass', icon: <Sun size={13} /> },
                { id: 'sunlight', label: 'Soleil AAA', icon: <Sun size={13} /> },
                { id: 'night-red', label: 'Nuit Rouge', icon: <Moon size={13} /> },
              ] as const
            ).map((opt) => {
              const selected = contrast === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onContrastChange(opt.id)}
                  style={{
                    height: 38,
                    borderRadius: 12,
                    border: 0,
                    background: selected ? '#FFFFFF' : 'transparent',
                    color: selected ? '#17402C' : '#56665D',
                    fontSize: 12,
                    fontWeight: selected ? 800 : 600,
                    boxShadow: selected ? '0 2px 8px rgba(16, 32, 25, 0.12)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    cursor: 'pointer',
                  }}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Toggles iOS 18 Terrain Extrême */}
        <section style={cardStyle}>
          <span className="px-0.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: '#56665D' }}>
            Modes extrêmes
          </span>

          <IosToggleSwitch
            checked={glovesMode}
            onToggle={() => onToggleGlovesMode(!glovesMode)}
            icon={<Hand size={16} />}
            label="Mode Gants"
            description="Boutons tactiles agrandis (≥ 60 px)"
          />

          <IosToggleSwitch
            checked={rainLockActive}
            onToggle={() => onToggleRainLock(!rainLockActive)}
            icon={<CloudRain size={16} />}
            label="Verrouillage Pluie"
            description="Empêche les appuis gouttes (déverrouillage 1,5 s)"
          />

          {onToggleBivouacSleep ? (
            <IosToggleSwitch
              checked={bivouacSleepActive}
              onToggle={onToggleBivouacSleep}
              icon={<Tent size={16} />}
              label="Pause Nuit / Bivouac"
              description="Coupe le GPS pendant la nuit sans clore la sortie"
            />
          ) : null}

          {onToggleAudio ? (
            <IosToggleSwitch
              checked={!audioMuted}
              onToggle={onToggleAudio}
              icon={audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              label="Guidage vocal"
              description="Annonces virages et splits kilométriques"
            />
          ) : null}

          <IosToggleSwitch
            checked={autoPauseEnabled}
            onToggle={() => onToggleAutoPause(!autoPauseEnabled)}
            icon={<PauseCircle size={16} />}
            label="Auto-Pause intelligente"
            description="Met en pause le chrono dès l'arrêt prolongé"
          />
        </section>

        {/* Personnalisation Drag & Drop des tuiles KPI */}
        <section style={cardStyle}>
          <span className="px-0.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: '#56665D' }}>
            Ordre des tuiles du cockpit
          </span>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {items.map((id) => (
                  <SortableKpiRow key={id} id={id} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </div>
    </ExplorerNestedSubDrawer>
  );
}
