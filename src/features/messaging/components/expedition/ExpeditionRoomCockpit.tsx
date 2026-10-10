'use client';

import React, { useState } from 'react';
import type {
  ExpeditionRoomStatus,
  ExpeditionChecklistItem,
  FieldCheckIn,
  CheckInStatus,
} from '../../types/expeditionRooms.types';
import { RouteMiniMapPane } from './RouteMiniMapPane';
import { WeatherPane } from './WeatherPane';
import { SharedChecklistPane } from './SharedChecklistPane';
import { FieldCheckInsPane } from './FieldCheckInsPane';

export type CockpitPane = 'chat' | 'weather' | 'route' | 'checklist' | 'checkins';

export interface ExpeditionRoomCockpitProps {
  room: {
    id: string;
    title: string;
    status: ExpeditionRoomStatus;
    tripId?: string | null;
    conversationId?: string;
  };
  weatherData?: {
    locationName?: string;
    tempC?: number;
    windKmH?: number;
    freezingLevelM?: number;
    weatherCode?: number;
    precipitationProbability?: number;
  } | null;
  gpxSnapshot?: {
    title: string;
    distanceKm: number;
    elevationGainM: number;
    svgPolylinePath?: string;
    estimatedDurationMinutes?: number;
  } | null;
  checklistItems?: ExpeditionChecklistItem[];
  lastCheckIn?: FieldCheckIn | null;
  checkins?: FieldCheckIn[];
  activePane?: CockpitPane;
  onSelectPane?: (pane: CockpitPane) => void;
  onToggleChecklistItem?: (itemId: string, isCompleted: boolean) => void;
  onBroadcastCheckin?: (status: CheckInStatus, message?: string) => Promise<void> | void;
  children?: React.ReactNode;
  className?: string;
}

const PANES: CockpitPane[] = ['chat', 'weather', 'route', 'checklist', 'checkins'];

const PANE_LABELS: Record<CockpitPane, string> = {
  chat: 'Discussion',
  weather: 'Météo',
  route: 'Tracé GPX',
  checklist: 'Checklist',
  checkins: 'Points de situation',
};

export const ExpeditionRoomCockpit: React.FC<ExpeditionRoomCockpitProps> = ({
  room,
  weatherData,
  gpxSnapshot,
  checklistItems = [],
  lastCheckIn,
  checkins = [],
  activePane: controlledActivePane,
  onSelectPane,
  onToggleChecklistItem,
  onBroadcastCheckin,
  children,
  className = '',
}) => {
  const [internalPane, setInternalPane] = useState<CockpitPane>('chat');
  const [tacticalPane, setTacticalPane] = useState<CockpitPane>('weather');

  const currentPane = controlledActivePane !== undefined ? controlledActivePane : internalPane;
  const effectiveTacticalPane: CockpitPane =
    currentPane !== 'chat' ? currentPane : tacticalPane;

  const handleSelectPane = (pane: CockpitPane) => {
    setInternalPane(pane);
    if (pane !== 'chat') {
      setTacticalPane(pane);
    }
    onSelectPane?.(pane);
  };

  return (
    <div
      data-testid="expedition-cockpit-container"
      className={`flex w-full flex-col overflow-hidden rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] shadow-elevation-2 backdrop-blur-md ${className}`}
    >
      {/* Cockpit Header */}
      <header className="flex h-14 items-center justify-between border-b border-[color:var(--glass-border)] px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[color:var(--lkv-text-primary)]">{room.title}</h2>
          <span className="rounded-full border border-forest-500/30 bg-forest-500/15 px-2 py-0.5 text-[10px] font-semibold text-forest-700 dark:text-forest-300">
            {room.status}
          </span>
        </div>
        {room.tripId && (
          <span className="text-xs text-[color:var(--lkv-text-secondary)]">Voyage lié</span>
        )}
      </header>

      {/* Segmented Controls (Apple HIG >= 44px) */}
      <nav
        aria-label="Navigation Cockpit"
        className="flex border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-1"
      >
        {PANES.map((pane) => {
          const isActive = currentPane === pane;
          const isHighlighted =
            pane === 'chat'
              ? currentPane === 'chat'
              : currentPane === pane || (currentPane === 'chat' && pane === tacticalPane);

          return (
            <button
              key={pane}
              data-pane={pane}
              type="button"
              onClick={() => handleSelectPane(pane)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-[44px] min-h-[44px] flex-1 items-center justify-center rounded-xl text-xs font-semibold transition-all focus-visible:outline-none ${
                pane === 'chat' ? 'flex md:hidden' : 'flex'
              } ${
                isHighlighted
                  ? 'bg-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-primary)] shadow-sm'
                  : 'text-[color:var(--lkv-text-secondary)] hover:text-[color:var(--lkv-text-primary)]'
              }`}
            >
              {PANE_LABELS[pane]}
            </button>
          );
        })}
      </nav>

      {/* Responsive Multi-Pane Body: 2-Column Desktop Layout (md:grid md:grid-cols-2) */}
      <main className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-[color:var(--glass-border)]">
        {/* Left Column: Conversation Stream (Always visible on desktop md:block, mobile: visible when currentPane === 'chat') */}
        <section
          data-testid="cockpit-chat-column"
          aria-label="Flux de conversation"
          className={`p-4 ${currentPane === 'chat' ? 'block' : 'hidden md:block'}`}
        >
          <div className="mb-3 hidden md:flex items-center justify-between border-b border-[color:var(--glass-border)] pb-2">
            <h3 className="text-xs font-bold text-[color:var(--lkv-text-primary)]">Discussion</h3>
            <span className="text-[10px] text-[color:var(--lkv-text-secondary)]">Flux en direct</span>
          </div>
          <div>
            {children || (
              <div className="flex flex-col gap-2 text-xs text-[color:var(--lkv-text-primary)]">
                <span>Flux de conversation actif.</span>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Tactical Console Pane (Always visible on desktop md:block, mobile: visible when currentPane !== 'chat') */}
        <section
          data-testid="cockpit-tactical-column"
          aria-label="Console tactique"
          className={`p-4 ${currentPane !== 'chat' ? 'block' : 'hidden md:block'}`}
        >
          {effectiveTacticalPane === 'weather' && (
            <WeatherPane weatherData={weatherData} />
          )}

          {effectiveTacticalPane === 'route' && (
            <RouteMiniMapPane snapshot={gpxSnapshot} />
          )}

          {effectiveTacticalPane === 'checklist' && (
            <SharedChecklistPane
              items={checklistItems}
              onToggleItem={onToggleChecklistItem}
            />
          )}

          {effectiveTacticalPane === 'checkins' && (
            <FieldCheckInsPane
              lastCheckIn={lastCheckIn}
              checkins={checkins}
              onBroadcastCheckin={onBroadcastCheckin}
            />
          )}
        </section>
      </main>
    </div>
  );
};
