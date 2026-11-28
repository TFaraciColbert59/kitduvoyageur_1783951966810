'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ConfirmHost = dynamic(() => import('@/components/ui/ConfirmHost'), { ssr: false });
const PromptHost = dynamic(() => import('@/components/ui/PromptHost'), { ssr: false });
const ToastHost = dynamic(() => import('@/components/ui/ToastHost'), { ssr: false });
const DynamicIslandHost = dynamic(() => import('@/components/ui/DynamicIslandHost'), { ssr: false });
const DiscoveryHost = dynamic(
  () => import('@/features/discovery/DiscoveryHost').then((m) => ({ default: m.DiscoveryHost })),
  { ssr: false },
);
const ActiveOutingGlobalPill = dynamic(
  () => import('@/components/explorer/ActiveOutingGlobalPill'),
  { ssr: false },
);
const ConditionalCursor = dynamic(
  () => import('@/components/ui/CustomCursor').then((m) => ({ default: m.ConditionalCursor })),
  { ssr: false },
);
const AccessibilityRuntime = dynamic(
  () => import('@/components/accessibility').then((m) => ({ default: m.AccessibilityRuntime })),
  { ssr: false },
);
const PresenceTracker = dynamic(() => import('@/components/system/PresenceTracker'), { ssr: false });
const ServiceWorkerRegistration = dynamic(() => import('@/components/ServiceWorkerRegistration'), {
  ssr: false,
});
const WebVitalsReporter = dynamic(() => import('@/components/WebVitalsReporter'), { ssr: false });
const MigrationEffect = dynamic(() => import('@/lib/storage/MigrationEffect'), { ssr: false });
const GoogleAnalytics = dynamic(() => import('@/components/GoogleAnalytics'), { ssr: false });
const RocketConsentScripts = dynamic(() => import('@/components/RocketConsentScripts'), { ssr: false });
const TravelpayoutsDrive = dynamic(() => import('@/components/TravelpayoutsDrive'), { ssr: false });

/**
 * Hôtes globaux non critiques pour le premier affichage (FCP/LCP).
 * Chargés en chunks séparés hors du JS initial du layout racine, puis montés
 * en deux temps :
 *  - immédiatement après hydratation pour les hôtes UI interactifs (toasts,
 *    confirmations, prompts, Dynamic Island, accessibilité) ;
 *  - au premier temps mort (`requestIdleCallback`) pour la télémétrie, la
 *    présence, le Service Worker, la bannière cookies et les scripts tiers.
 */
export default function DeferredGlobalHosts() {
  const [hydrated, setHydrated] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setIdle(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  if (!hydrated) return null;

  return (
    <>
      <AccessibilityRuntime />
      <ConfirmHost />
      <PromptHost />
      <ToastHost />
      <DynamicIslandHost />
      <DiscoveryHost />
      <ActiveOutingGlobalPill />
      {idle ? (
        <>
          <ConditionalCursor />
          <PresenceTracker />
          <ServiceWorkerRegistration />
          <WebVitalsReporter />
          <MigrationEffect />
          <RocketConsentScripts />
          <TravelpayoutsDrive />
          <Suspense fallback={null}>
            <GoogleAnalytics />
          </Suspense>
        </>
      ) : null}
    </>
  );
}
