'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import ExplorerMap from '@/components/explorer/ExplorerMap';
import { useHikingStore } from '../hooks/useHikingStore';
import TopHUD from './TopHUD';
import SideControlsCol from './SideControlsCol';
import ContextualInsight from './ContextualInsight';
import NavigationCard from './NavigationCard';
import CockpitBottomNav, { CockpitTab } from './CockpitBottomNav';
import OfflineIndicatorBanner from './OfflineIndicatorBanner';
import SafetyCenterModal from './SafetyCenterModal';
import Terrain3DViewer from './Terrain3DViewer';
import GPXImportExportModal from './GPXImportExportModal';
import StatsSheet from './sheets/StatsSheet';
import CaptureSheet from './sheets/CaptureSheet';
import CopilotSheet from './sheets/CopilotSheet';
import MoreSheet from './sheets/MoreSheet';

export default function HikingCockpitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdParam = searchParams?.get('routeId');

  const hikingStore = useHikingStore();
  const [activeTab, setActiveTab] = useState<CockpitTab | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [show3DTerrain, setShow3DTerrain] = useState(false);
  const [showGPXModal, setShowGPXModal] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(15);

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
    setActiveTab(tab);
  };

  const handleToggleHike = () => {
    if (hikingStore.isActive && !hikingStore.isPaused) {
      hikingStore.pauseHike();
    } else if (hikingStore.isPaused) {
      hikingStore.resumeHike();
    } else {
      hikingStore.startHike(routeIdParam || undefined);
    }
  };

  const handleConfirmStop = async () => {
    const result = await hikingStore.stopHike();
    if (result?.sessionId) {
      router.push('/carnets');
    }
  };

  const currentPos = hikingStore.positions.length > 0
    ? hikingStore.positions[hikingStore.positions.length - 1]
    : null;

  const userLoc: [number, number] | null = currentPos
    ? [currentPos.latitude, currentPos.longitude]
    : [45.2833, 5.8667]; // Default Chartreuse coordinates for mock demonstration

  return (
    <MobilePageShell>
      <div
        className={`relative w-full h-[100dvh] flex flex-col justify-between overflow-hidden select-none transition-colors ${
          isNightMode ? 'bg-[#06120C]' : 'bg-[#FBFAF6]'
        }`}
      >
        {/* Full-Screen Interactive Map */}
        <div className="absolute inset-0 z-0">
          <ExplorerMap
            trails={[]}
            selectedTrailId={routeIdParam || null}
            onTrailClick={() => {}}
            userLocation={userLoc}
          />

          {/* Topographic SVGs & Specks Overlay for Premium Feel */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity ${
              isNightMode ? 'opacity-40 invert brightness-125' : 'opacity-20'
            }`}
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 380 780'><g fill='none' stroke='%2317402C' stroke-width='0.55'><ellipse cx='200' cy='380' rx='150' ry='75'/><ellipse cx='200' cy='380' rx='115' ry='55'/><ellipse cx='200' cy='380' rx='80' ry='38'/></g></svg>")`,
              backgroundSize: 'cover',
            }}
          />
        </div>

        {/* Top Floating Glass HUD */}
        <div className="z-40 w-full">
          <OfflineIndicatorBanner />
          <TopHUD
            distanceKm={hikingStore.distanceKm}
            routeTotalKm={14.2}
            durationSeconds={hikingStore.durationSeconds}
            elevationGainM={hikingStore.elevationGainM}
            currentSpeedKmH={hikingStore.currentSpeedKmH}
            progressPercent={hikingStore.progressPercent}
            routeName={routeIdParam ? `Itinéraire #${routeIdParam}` : 'Chemin des Crêtes'}
            isOffRoute={hikingStore.isOffRoute}
            isNightMode={isNightMode}
            onBack={() => router.back()}
          />
        </div>

        {/* Right Side Column Controls (Compass, Weather, Battery, SOS) */}
        <SideControlsCol
          headingDeg={deviceHeading}
          tempC={hikingStore.weather?.tempC}
          weatherCondition={hikingStore.weather?.condition}
          batteryLevel={78}
          isNightMode={isNightMode}
          onOpenSafety={() => setShowSafetyModal(true)}
          onOpenWeather={() => setActiveTab('copilot')}
        />

        {/* Contextual Alert Banner (Off-Route / Storm Rain / Paused) */}
        <ContextualInsight
          isOffRoute={hikingStore.isOffRoute}
          deviationMeters={hikingStore.deviation?.distanceM ?? 80}
          nextPoi={hikingStore.nextPoi}
          weather={hikingStore.weather}
          isPaused={hikingStore.isPaused}
          onDismissOffRoute={() => {}}
          onReturnToPath={() => {}}
          onViewShelter={() => setActiveTab('copilot')}
        />

        {/* Floating Turn Card */}
        {!hikingStore.isOffRoute && (
          <NavigationCard
            nextPoi={hikingStore.nextPoi}
            routeName="Chemin des Crêtes · GR9 · +140 m"
            isNightMode={isNightMode}
          />
        )}

        {/* Bottom 5-Tab Bar with Central 68px Button */}
        <CockpitBottomNav
          activeTab={activeTab}
          isActive={hikingStore.isActive}
          isPaused={hikingStore.isPaused}
          onTabSelect={handleTabSelect}
          onToggleHike={handleToggleHike}
          isNightMode={isNightMode}
        />

        {/* Interactive Bottom Sheets */}
        <StatsSheet
          isOpen={activeTab === 'stats'}
          onClose={() => setActiveTab(null)}
          distanceKm={hikingStore.distanceKm}
          durationSeconds={hikingStore.durationSeconds}
          elevationGainM={hikingStore.elevationGainM}
          currentSpeedKmH={hikingStore.currentSpeedKmH}
          averageSpeedKmH={hikingStore.averageSpeedKmH}
          paceMinPerKm={hikingStore.paceMinPerKm}
        />

        <CaptureSheet
          isOpen={activeTab === 'capture' || activeTab === 'carnet'}
          onClose={() => setActiveTab(null)}
          onCaptureAction={() => setActiveTab(null)}
        />

        <CopilotSheet
          isOpen={activeTab === 'copilot'}
          onClose={() => setActiveTab(null)}
          distanceKm={hikingStore.distanceKm}
          remainingDistanceKm={Math.max(0, 14.2 - hikingStore.distanceKm)}
          elevationGainM={hikingStore.elevationGainM ?? 420}
          weatherCondition={hikingStore.weather?.condition}
        />

        <MoreSheet
          isOpen={activeTab === 'more'}
          onClose={() => setActiveTab(null)}
          isNightMode={isNightMode}
          onToggleNightMode={() => setIsNightMode((v) => !v)}
          onOpenSafety={() => setShowSafetyModal(true)}
          onOpenWeather={() => setActiveTab('copilot')}
          onOpenARCompass={() => router.push('/boussole')}
          onOpen3DTerrain={() => setShow3DTerrain(true)}
          onOpenGPXModal={() => setShowGPXModal(true)}
          onStopHike={handleConfirmStop}
        />

        {/* Safety Center Modal */}
        <SafetyCenterModal
          isOpen={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          currentPos={currentPos}
          batteryLevel={78}
          isOffline={false}
        />

        {/* 3D Terrain Relief Viewer */}
        <Terrain3DViewer
          isOpen={show3DTerrain}
          onClose={() => setShow3DTerrain(false)}
          elevationGainM={hikingStore.elevationGainM}
        />

        {/* GPX Import/Export Modal */}
        <GPXImportExportModal
          isOpen={showGPXModal}
          onClose={() => setShowGPXModal(false)}
          positions={hikingStore.positions}
          onImportParsedGPX={(parsed) => {
            console.log('[Cockpit] GPX Imported:', parsed.title, parsed.positions.length);
          }}
        />
      </div>
    </MobilePageShell>
  );
}
