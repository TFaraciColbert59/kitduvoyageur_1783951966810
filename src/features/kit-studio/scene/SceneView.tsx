'use client';
import { useEffect, useRef, useState } from 'react';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';
import { S } from '../ui/strings';
import { createKitScene, type KitScene } from './createScene';
import type { BagModelRuntimeInfo } from './bag/modelLayer';
import { setScene } from './sceneRef';

/** Annonce lisible (aria-live) de l'état du sac maillé : jamais de teinte sur un atlas entier, ni d'état vide muet pour les modules 3D. */
export function bagModelNotice(
  info: BagModelRuntimeInfo,
  mode?: string | null,
  category?: string | null,
): string | null {
  if (info.status === 'degraded') {
    return 'Modèle 3D indisponible : le sac est construit par code.';
  }
  if (info.status === 'glb' && info.colorCustomization === 'unavailable-no-mask') {
    return 'Personnalisation de couleur indisponible pour ce sac : son masque de zone tissu manque.';
  }
  if (
    info.status === 'glb' &&
    info.modules3dAvailable === false &&
    mode === 'appearance' &&
    category === 'mod'
  ) {
    return 'Modules 3D en cours de production : aucun maillage de module n’est encore livré pour ce sac.';
  }
  return null;
}

/** Canvas plein écran : crée la scène, relaie l'état du store, libère tout au démontage. */
export default function SceneView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [bagModel, setBagModel] = useState<BagModelRuntimeInfo | null>(null);
  const mode = useUiStore((s) => s.mode);
  const category = useUiStore((s) => s.category);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let scene: KitScene;
    try {
      scene = createKitScene(el, {
        state: useKitStore.getState().kit,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onContextChange: setFailed,
        onBagModel: setBagModel,
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

  const notice = bagModel ? bagModelNotice(bagModel, mode, category) : null;

  return (
    <>
      <canvas ref={canvas} className="ks-canvas" aria-label={S.a11y.bag3d} role="img" tabIndex={0} />
      {failed && (
        <p className="ks-fallback" role="status">
          {S.states.error}
        </p>
      )}
      {/* État du sac maillé annoncé, jamais substitué au procédural par surprise. */}
      {notice ? (
        <p
          role="status"
          data-testid="ks-bag-model-notice"
          className="ks-bag-model-notice"
          style={{
            position: 'absolute',
            left: 12,
            bottom: 'calc(var(--safe-bottom, 0px) + 12px)',
            zIndex: 30,
            maxWidth: 260,
            margin: 0,
            padding: '6px 10px',
            borderRadius: 10,
            background: 'var(--ks-paper, rgb(250 249 245))',
            color: 'var(--ks-ink-2, rgb(86 102 93))',
            fontSize: 12,
            lineHeight: 1.35,
            pointerEvents: 'none',
          }}
        >
          {notice}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {bagModel?.status === 'glb'
          ? `Sac maillé ${bagModel.label ?? bagModel.modelId} : ${bagModel.parts.length} pièces, ${bagModel.anchors.length} ancrages.`
          : ''}
      </p>
    </>
  );
}
