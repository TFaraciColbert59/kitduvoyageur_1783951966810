'use client';
import dynamic from 'next/dynamic';
import type { MapRoute } from './Map3DImmersive';

const Map3DImmersive = dynamic(() => import('./Map3DImmersive').then((m) => m.Map3DImmersive), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-stone-200/60 rounded-[var(--r-lg)]" aria-hidden="true" />
  ),
});

/** W-D-1 LazyMap3D — wrapper client qui charge MapLibre à la demande (split du bundle). */
export function LazyMap3D({ route, className }: { route?: MapRoute | null; className?: string }) {
  return <Map3DImmersive route={route ?? undefined} className={className} />;
}
