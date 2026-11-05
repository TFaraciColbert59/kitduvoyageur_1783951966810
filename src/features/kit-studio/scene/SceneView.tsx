'use client';
import { useEffect, useRef, useState } from 'react';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';
import { S } from '../ui/strings';
import { createKitScene, type KitScene } from './createScene';

/** Canvas plein écran : crée la scène, relaie l'état du store, libère tout au démontage. */
export default function SceneView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let scene: KitScene;
    try {
      scene = createKitScene(el, {
        state: useKitStore.getState().kit,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onContextChange: setFailed,
      });
    } catch {
      setFailed(true);
      return;
    }
    scene.setDrawerOpen(useUiStore.getState().dockOpen);
    const offKit = useKitStore.subscribe((s, prev) => {
      if (s.kit !== prev.kit) scene.update(s.kit);
    });
    const offUi = useUiStore.subscribe((s, prev) => {
      if (s.dockOpen !== prev.dockOpen) scene.setDrawerOpen(s.dockOpen);
    });
    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    ro?.observe(el);
    return () => {
      offKit();
      offUi();
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      scene.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} className="ks-canvas" aria-label={S.a11y.bag3d} role="img" tabIndex={0} />
      {failed && (
        <p className="ks-fallback" role="status">
          {S.states.error}
        </p>
      )}
    </>
  );
}
