'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { runPreparation, PreparationResult, HikeContext } from '@/lib/preparation/PreparationEngine';
import { WeatherService } from '@/features/hiking/services/WeatherService';
import { WeatherSnapshot } from '@/features/hiking/types';
import { listOfflineRoutes } from '@/lib/offlineStorage';
import { useOfflineInventory } from '@/hooks/useOfflineInventory';

import './design/tokens.css';
import './design/prep.css';

import { MobilePreparationView } from './components/MobilePreparationView';
import { DesktopPreparationView } from './components/DesktopPreparationView';

interface PreparationClientProps {
  route: any;
  userId?: string;
}

export default function PreparationClient({ route, userId }: PreparationClientProps) {
  const router = useRouter();
  const [report, setReport] = useState<PreparationResult | null>(null);
  const [engineLoading, setEngineLoading] = useState(true);
  
  const [weatherData, setWeatherData] = useState<WeatherSnapshot | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  const [gpsStatus, setGpsStatus] = useState<'CHECKING' | 'AUTHORIZED' | 'DENIED' | 'PROMPT' | 'UNAVAILABLE'>('CHECKING');

  const { inventory, loading: inventoryLoading, addGearItem, loadInventory, isOnline } = useOfflineInventory(userId);

  const loading = engineLoading || inventoryLoading;

  useEffect(() => {
    const checkGPS = async () => {
      try {
        if (!navigator.geolocation) {
          setGpsStatus('UNAVAILABLE');
          return;
        }

        if (navigator.permissions) {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          const updateGpsFromPerm = (state: string) => {
             if (state === 'granted') setGpsStatus('AUTHORIZED');
             else if (state === 'prompt') setGpsStatus('PROMPT');
             else setGpsStatus('DENIED');
          };
          
          updateGpsFromPerm(perm.state);
          perm.onchange = () => updateGpsFromPerm(perm.state);
        } else {
          setGpsStatus('PROMPT'); 
        }

        navigator.geolocation.getCurrentPosition(
          () => setGpsStatus('AUTHORIZED'),
          () => setGpsStatus('DENIED'),
          { timeout: 5000 }
        );

      } catch (err) {
        setGpsStatus('UNAVAILABLE');
      }
    };

    checkGPS();
  }, []);

  const distanceKm = Number(route.distanceKm ?? route.distance_km ?? 0);
  const durationHours = route.durationHours ?? route.duration_hours ?? null;
  const elevationGain = Number(route.elevationGainM ?? route.elevation_gain ?? 0);
  const geom = route.geojson ?? route.geom ?? null;
  const startPt = route.start ?? (route.start_lat && route.start_lng ? { lat: route.start_lat, lng: route.start_lng } : null);

  const normalizedRoute = {
    ...route,
    distance_km: distanceKm,
    duration_hours: durationHours,
    elevation_gain: elevationGain,
    distanceKm,
    durationHours,
    elevationGainM: elevationGain,
    geom,
    geojson: geom,
    start: startPt,
  };

  const runEngine = useCallback(async () => {
    if (inventoryLoading) return;

    try {
      let w: WeatherSnapshot | null = null;
      if (startPt) {
        if (isOnline) {
          w = await WeatherService.fetchWeather(startPt.lat, startPt.lng);
        }
      }
      
      if (w) {
        setWeatherData(w);
        setWeatherStatus('success');
      } else {
        setWeatherStatus('error');
      }

      const context: HikeContext = {
        id: String(route.id),
        name: route.name,
        distanceKm,
        durationHours,
        elevationGain,
        difficulty: route.difficulty,
        season: route.season,
        weather: w,
      };

      const formattedInventory = inventory.map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        brand: i.brand,
        weightGrams: i.weight_g || 0,
        condition: i.condition,
        quantity: i.quantity || 1,
        tags: i.tags || [],
        loan_status: i.loan_status,
      }));

      const result = runPreparation(context, formattedInventory);
      setReport(result);
    } catch (err) {
      console.error('Failed to compute hike preparation', err);
    } finally {
      setEngineLoading(false);
    }
  }, [route, distanceKm, durationHours, elevationGain, startPt, inventory, inventoryLoading, isOnline]);

  useEffect(() => {
    runEngine();
  }, [runEngine]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  useEffect(() => {
    listOfflineRoutes().then(routes => {
      setIsOfflineReady(routes.some(r => r.routeId === String(route.id)));
    }).catch(() => {});
  }, [route.id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1600);
  };

  const handleAddInventory = async (itemName: string, itemCategory: string) => {
    await addGearItem(itemName, itemCategory);
    showToast(`${itemName} ajouté`);
  };

  const handleStart = () => {
    router.push(`/randonnee-active?routeId=${route.id}`);
  };

  if (loading || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#EAE6DF] text-black">
         <div className="text-sm font-mono tracking-widest text-[#1C2620] uppercase mb-2 animate-pulse">Initialisation Cockpit...</div>
      </div>
    );
  }

  const missingItems = report.missingRequirements || [];
  const matchedItems = report.matchedRequirements || [];
  
  const dispoItems = matchedItems.filter(m => m.available >= m.requirement.required);
  const insufItems = matchedItems.filter(m => m.available > 0 && m.available < m.requirement.required);
  
  const essentialMissing = missingItems.filter(r => r.priority === 'vital');
  const allMissingOrPartial = [...missingItems, ...insufItems.map(m => m.requirement)];
  const anyEssentialMissing = essentialMissing.length > 0;

  const wState = {
    ok: weatherStatus === 'success',
    warn: weatherData?.isAlert || false,
    desc: weatherStatus === 'loading' ? 'Recherche en cours...' :
          weatherStatus === 'success' && weatherData ? `${weatherData.tempC}°C · pluie ${Math.round(weatherData.precipitationProbability * 100)}%` :
          'Météo indisponible'
  };
  const gState = {
    ok: gpsStatus === 'AUTHORIZED',
    desc: gpsStatus === 'AUTHORIZED' ? 'Prêt' : 'Permission requise'
  };
  const bState = {
    ok: batteryLevel !== null && batteryLevel > 20,
    desc: batteryLevel !== null ? `${batteryLevel}%` : 'Inconnu'
  };
  const oState = {
    ok: isOfflineReady,
    desc: isOfflineReady ? 'Prêt' : 'Non téléchargé'
  };

  const viewProps = {
    route: normalizedRoute,
    report,
    weatherData,
    weatherStatus,
    gpsStatus,
    batteryLevel,
    isOfflineReady,
    isOnline,
    handleAddInventory,
    handleStart,
    toastMsg,
    dispoItems,
    insufItems,
    missingItems,
    matchedItems,
    allMissingOrPartial,
    anyEssentialMissing,
    wState,
    gState,
    bState,
    oState,
  };

  return (
    <>
      <div className="block lg:hidden">
         <MobilePreparationView {...viewProps} />
      </div>
      <div className="hidden lg:block h-screen w-screen overflow-hidden">
         <DesktopPreparationView {...viewProps} />
      </div>
    </>
  );
}
