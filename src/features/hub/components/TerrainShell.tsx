'use client';

import React from 'react';
import { useHubStore } from '../stores/useHubStore';
import { useHubLiveSensors } from '../hooks/useHubLiveSensors';
import { HubTopBar } from './HubTopBar';
import { BaseCampView } from './BaseCampView';
import { ActionModeView } from './ActionModeView';

/**
 * H3.2 — Coquille terrain historique (ex-HubShell, D1).
 * Comportement inchangé, capteurs extraits dans useHubLiveSensors.
 * Vivante jusqu'en H5 (redirect /terrain → /hub), puis supprimée avec preuve grep.
 */
export const TerrainShell: React.FC = () => {
  const isTrekActive = useHubStore((s) => s.isTrekActive);
  const baseCamp = useHubStore((s) => s.baseCamp);
  const action = useHubStore((s) => s.action);
  const isOnline = useHubStore((s) => s.isOnline);
  const setTrekActive = useHubStore((s) => s.setTrekActive);
  const toggleUltraSave = useHubStore((s) => s.toggleUltraSave);
  const dismissAlert = useHubStore((s) => s.dismissAlert);
  const updateAction = useHubStore((s) => s.updateAction);

  useHubLiveSensors(isTrekActive);

  const isUltraSave = action.isUltraSaveActive;

  return (
    <div
      className={`min-h-[100dvh] w-full transition-colors duration-300 ${
        isUltraSave
          ? 'bg-black text-[#4ADE80]'
          : 'bg-[#FBFAF6] dark:bg-[#0B120E] text-[#17402C] dark:text-[#E7E3D6]'
      }`}
      style={{
        paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 16px))',
      }}
    >
      {/* Dynamic Top Bar */}
      <HubTopBar
        isTrekActive={isTrekActive}
        isOnline={isOnline}
        isUltraSaveActive={isUltraSave}
        batteryLevel={action.batteryLevel}
        onToggleUltraSave={() => toggleUltraSave()}
      />

      {/* Main Content Area */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        {!isTrekActive ? (
          <BaseCampView
            state={baseCamp}
            onStartTrek={() => setTrekActive(true)}
            onDismissAlert={dismissAlert}
          />
        ) : (
          <ActionModeView
            trekName={baseCamp.trekName}
            state={action}
            onPause={() => updateAction({ isPaused: true })}
            onResume={() => updateAction({ isPaused: false })}
            onStop={() => setTrekActive(false)}
            onUpdateAction={updateAction}
          />
        )}
      </main>
    </div>
  );
};
