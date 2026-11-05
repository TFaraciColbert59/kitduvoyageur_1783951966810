'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ThumbnailEngine, ThumbSpec, ThumbValue } from '../scene/thumbnails';

interface ThumbProps {
  /** Clé de cache (voir scene/thumbSpecs.ts). */
  thumbKey: string;
  /** Description à rendre ; mémorisée par le moteur, l'identité de l'objet importe peu. */
  spec: ThumbSpec;
  /** Pictogramme SVG affiché en attendant, ou si WebGL est indisponible. */
  fallback: ReactNode;
  /** Moteur à utiliser (tests) ; défaut : moteur partagé. */
  engine?: ThumbnailEngine;
}

const HOST_STYLE: CSSProperties = { display: 'grid', placeItems: 'center', width: '100%', height: '100%' };
const PRIORITY_VISIBLE = 10;
const PRIORITY_LOW = 0;

/** Three n'entre dans le chunk de l'interface qu'à la première vignette demandée. */
async function sharedEngine(): Promise<ThumbnailEngine> {
  const m = await import('../scene/thumbnails');
  const { registerThumbBuilders } = await import('../scene/thumbBuilders');
  registerThumbBuilders();
  return m.getThumbnailEngine();
}

/** Vignette 3D d'une carte : image mise en cache par le moteur partagé, repli SVG sinon. */
export function Thumb({ thumbKey, spec, fallback, engine: injected }: ThumbProps) {
  const host = useRef<HTMLSpanElement>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const visibleRef = useRef(false);
  const [engine, setEngine] = useState<ThumbnailEngine | null>(injected ?? null);
  const [value, setValue] = useState<ThumbValue>(undefined);

  useEffect(() => {
    if (injected) { setEngine(injected); return; }
    let alive = true;
    sharedEngine().then((e) => { if (alive) setEngine(e); }, () => { if (alive) setValue(null); });
    return () => { alive = false; };
  }, [injected]);

  // Abonnement + demande initiale.
  useEffect(() => {
    if (!engine) return;
    const ask = () => engine.request(thumbKey, { spec: specRef.current, priority: visibleRef.current ? PRIORITY_VISIBLE : PRIORITY_LOW });
    setValue(engine.get(thumbKey));
    const off = engine.subscribe(thumbKey, (v) => {
      setValue(v);
      // Cache vidé (revokeAll) alors que la carte est encore affichée : on redemande.
      if (v === undefined) ask();
    });
    ask();
    return () => {
      off();
      engine.cancel(thumbKey);
    };
  }, [engine, thumbKey]);

  // Priorité aux cartes visibles.
  useEffect(() => {
    const el = host.current;
    if (!engine || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const seen = entries.some((e) => e.isIntersecting);
      visibleRef.current = seen;
      if (seen) engine.request(thumbKey, { spec: specRef.current, priority: PRIORITY_VISIBLE });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [engine, thumbKey]);

  return (
    <span ref={host} className="ks-thumb" data-state={value ? 'ready' : value === null ? 'fallback' : 'pending'} style={HOST_STYLE}>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- Blob URL locale, pas une image distante optimisable
        <img
          src={value}
          alt=""
          draggable={false}
          decoding="async"
          className="ks-thumb__img"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            WebkitUserDrag: 'none',
            filter: 'var(--ks-thumb-filter, drop-shadow(0 6px 7px color-mix(in srgb, var(--lkv-ink-900, currentColor) 20%, transparent)))',
          } as CSSProperties}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
