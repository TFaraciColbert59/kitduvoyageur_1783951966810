'use client';
import { useEffect, useRef, useState } from 'react';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';
import { S } from '../ui/strings';
import { createKitScene, type KitScene } from './createScene';
import { setScene } from './sceneRef';

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
    setScene(scene);
    const offKit = useKitStore.subscribe((s, prev) => {
      if (s.kit !== prev.kit) scene.update(s.kit);
    });
    const offUi = useUiStore.subscribe((s, prev) => {
      if (s.dockOpen !== prev.dockOpen) scene.setDrawerOpen(s.dockOpen);
    });
    // Le redimensionnement est déjà tenu par createScene (ResizeObserver interne) : rien à doubler ici.
    return () => {
      offKit();
      offUi();
      setScene(null);
      scene.dispose();
      // Le moteur de vignettes partage un second contexte WebGL : on le libère en quittant l'écran.
      void import('./thumbnails').then((m) => m.disposeThumbnailEngine()).catch(() => undefined);
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
