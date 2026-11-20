'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createInitialState } from '@/features/kit-studio/domain/state';
import { setStudioData, studioData, type StudioData } from '@/features/kit-studio/domain/studioData';
import { createKitScene, type KitScene } from '@/features/kit-studio/scene/createScene';
import styles from './cockpit.module.css';

type PreviewData = Pick<StudioData, 'items' | 'one' | 'config' | 'colorways' | 'families'> & { kit: StudioData['kits'][number] };
type State = 'loading' | 'ready' | 'no_configuration' | 'unassigned' | 'unavailable' | 'model_unavailable';

export function HubKitPreview({ kitId }: { kitId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let scene: KitScene | undefined;
    let previous: StudioData | undefined;
    let activeData: StudioData | undefined;

    async function createPreview() {
      const response = await fetch(`/api/hub/kit-preview?kit=${encodeURIComponent(kitId)}`, { signal: controller.signal });
      const result = await response.json() as PreviewData & { reason?: State };
      if (controller.signal.aborted || !canvas.current) return;
      if (!response.ok) {
        setState(result.reason === 'no_configuration' || result.reason === 'unassigned' ? result.reason : 'unavailable');
        return;
      }
      if (result.kit?.id !== kitId) throw new Error('kit');
      const { kit, ...registry } = result;
      previous = studioData();
      activeData = { ...registry, kits: [kit], own: {}, order: {}, bodyKg: kit.body };
      setStudioData(activeData);
      scene = createKitScene(canvas.current, {
        state: createInitialState(kit.id),
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onContextChange: (lost) => setState(lost ? 'unavailable' : 'ready'),
        onBagModel: (model) => {
          if (model.status === 'degraded') setState('model_unavailable');
        },
      });
      setState('ready');
    }
    void createPreview().catch(() => {
      if (controller.signal.aborted) return;
      if (activeData && studioData() === activeData && previous) setStudioData(previous);
      setState('unavailable');
    });
    return () => {
      controller.abort();
      scene?.dispose();
      if (activeData && studioData() === activeData && previous) setStudioData(previous);
    };
  }, [kitId, attempt]);

  return <>
    <div className={styles.kitScene}>
      <canvas ref={canvas} aria-label="Modèle 3D du kit affecté au voyage" tabIndex={state === 'ready' ? 0 : -1}
        style={{ visibility: state === 'ready' ? 'visible' : 'hidden' }} />
      {state !== 'ready' && <p role="status" className={styles.mapStatus}>{
        state === 'loading' ? 'Chargement du kit 3D…'
          : state === 'no_configuration' ? 'Aucune configuration 3D enregistrée pour ce kit.'
          : state === 'unassigned' ? 'Ce kit n’est pas accessible avec ce compte.'
          : state === 'model_unavailable' ? 'Le modèle 3D du sac est indisponible.'
          : 'Impossible d’afficher le kit 3D.'
      }</p>}
    </div>
    {state === 'unavailable' && <button type="button" className="lkdv-cv2-chip" onClick={() => {
      setState('loading');
      setAttempt((count) => count + 1);
    }}>Réessayer</button>}
    {state === 'no_configuration' && <Link href={`/kit-studio?kit=${encodeURIComponent(kitId)}`} className="lkdv-cv2-chip">
      Configurer dans Kit Studio
    </Link>}
  </>;
}
