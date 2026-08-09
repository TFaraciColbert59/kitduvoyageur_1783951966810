'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import ExplorerMap from '@/components/explorer/ExplorerMap';
import SpeciesIdentifier from '@/components/carnet/SpeciesIdentifier';
import { useHikingStore } from '../hooks/useHikingStore';
import TopHUD from './TopHUD';
import ContextualInsight from './ContextualInsight';
import NavigationCard from './NavigationCard';
import HikingControls from './HikingControls';
import CockpitBottomNav, { CockpitTab } from './CockpitBottomNav';
import { POI } from '../types';

export default function HikingCockpitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdParam = searchParams?.get('routeId');

  const hikingStore = useHikingStore();
  const [activeTab, setActiveTab] = useState<CockpitTab>('nav');
  const [showStopModal, setShowStopModal] = useState(false);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  // Fetch weather on mount
  useEffect(() => {
    if (hikingStore.positions.length > 0) {
      const last = hikingStore.positions[hikingStore.positions.length - 1];
      hikingStore.fetchWeather(last.latitude, last.longitude);
    }
  }, [hikingStore.positions.length]);

  // Listen to device orientation for compass heading
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const heading = (e as any).webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : null);
      if (heading != null) setDeviceHeading(Math.round(heading));
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  const handleTabSelect = (tab: CockpitTab) => {
    if (tab === 'more') {
      router.push('/boussole');
      return;
    }
    if (tab === 'camera') {
      setShowSpeciesModal(true);
      return;
    }
    if (tab === 'carnet') {
      router.push('/carnets');
      return;
    }
    setActiveTab(tab);
  };

  const handleConfirmStop = async () => {
    setShowStopModal(false);
    const result = await hikingStore.stopHike();
    if (result?.sessionId) {
      router.push('/carnets');
    }
  };

  const userLoc: [number, number] | null = hikingStore.positions.length > 0
    ? [
        hikingStore.positions[hikingStore.positions.length - 1].latitude,
        hikingStore.positions[hikingStore.positions.length - 1].longitude,
      ]
    : null;

  return (
    <MobilePageShell>
      <div className="relative w-full h-[100dvh] bg-[#0d1a12] flex flex-col justify-between overflow-hidden select-none">
        {/* Top Floating HUD */}
        <div className="z-40 w-full">
          <TopHUD
            distanceKm={hikingStore.distanceKm}
            routeTotalKm={null}
            durationSeconds={hikingStore.durationSeconds}
            elevationGainM={hikingStore.elevationGainM}
            progressPercent={hikingStore.progressPercent}
            routeName={routeIdParam ? `Itinéraire #${routeIdParam}` : null}
            batteryLevel={hikingStore.batteryLevel}
            weatherTempC={hikingStore.weather?.tempC}
            weatherCondition={hikingStore.weather?.condition}
          />

          <ContextualInsight
            isOffRoute={hikingStore.isOffRoute}
            deviationMeters={hikingStore.deviation?.distanceM}
            bearingDeg={hikingStore.deviation?.bearingDeg}
            nextPoi={hikingStore.nextPoi}
            weather={hikingStore.weather}
            safetyAlerts={hikingStore.safetyAlerts}
            isPaused={hikingStore.isPaused}
            onDismissOffRoute={() => hikingStore.dismissOffRoute()}
          />

          <NavigationCard
            nextPoi={hikingStore.nextPoi}
            bearingDeg={hikingStore.nextPoi ? (hikingStore.nextPoi as any).bearing_deg : null}
            deviceHeading={deviceHeading}
          />
        </div>

        {/* Center Interactive Map */}
        <div className="absolute inset-0 z-10 w-full h-full">
          <ExplorerMap
            trails={[]}
            selectedTrailId={null}
            onTrailClick={() => {}}
            userLocation={userLoc}
          />
        </div>

        {/* Bottom Floating Control Panel */}
        <div className="z-40 w-full bg-gradient-to-t from-[#0d1a12] via-[#0d1a12]/90 to-transparent pb-[env(safe-area-inset-bottom)] pt-4">
          <HikingControls
            state={hikingStore.state}
            isActive={hikingStore.isActive}
            isPaused={hikingStore.isPaused}
            onStart={() => hikingStore.startHike(routeIdParam || undefined)}
            onPause={() => hikingStore.pauseHike()}
            onResume={() => hikingStore.resumeHike()}
            onStop={() => setShowStopModal(true)}
          />

          <CockpitBottomNav activeTab={activeTab} onTabSelect={handleTabSelect} />
        </div>

        {/* Stop Confirmation Modal */}
        {showStopModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-[#17402C] border border-[#2D5A27]/50 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl">
              <span className="text-4xl mb-3 block">⏹️</span>
              <h3 className="text-white font-bold text-lg mb-2">Terminer la randonnée ?</h3>
              <p className="text-[#A3C4A3] text-xs mb-6">
                Votre parcours ({hikingStore.distanceKm.toFixed(1)} km) sera sauvegardé dans vos carnets.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStopModal(false)}
                  className="flex-1 py-3 bg-white/10 text-white/80 font-bold text-xs rounded-xl hover:bg-white/20 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmStop}
                  className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold text-xs rounded-xl shadow-lg hover:from-red-700 hover:to-red-800 transition-colors"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Species Identifier Modal */}
        {showSpeciesModal && (
          <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0d1a12] border border-[#2D5A27]/50 rounded-3xl p-4 max-w-sm w-full relative">
              <button
                onClick={() => setShowSpeciesModal(false)}
                className="absolute top-3 right-3 text-white/60 hover:text-white text-sm bg-white/10 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
              <SpeciesIdentifier />
            </div>
          </div>
        )}
      </div>
    </MobilePageShell>
  );
}
