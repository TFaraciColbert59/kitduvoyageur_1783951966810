'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  fallbackSrc?: string;
  fallbackIcon?: React.ReactNode;
  aspectRatio?: string;
}

const DEFAULT_OUTDOOR_FALLBACK =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80';

export default function SmartImage({
  src,
  alt,
  className = '',
  fill = false,
  width,
  height,
  priority = false,
  fallbackSrc = DEFAULT_OUTDOOR_FALLBACK,
  fallbackIcon,
  aspectRatio,
}: SmartImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (src && src.trim() !== '') {
      setImgSrc(src);
      setHasError(false);
      setIsLoading(true);
    } else {
      setImgSrc(fallbackSrc);
    }
  }, [src, fallbackSrc]);

  /* Course de chargement : une image en cache peut finir de charger AVANT que
   * React n'attache `onLoad` → on vérifie `complete` après montage/changement. */
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    if (el.complete) {
      if (el.naturalWidth > 0) setIsLoading(false);
      else handleError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgSrc]);

  const handleError = () => {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    } else {
      setHasError(true);
    }
    setIsLoading(false);
  };

  if (hasError || !imgSrc) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center bg-gradient-to-br from-[color:var(--lkv-primary)]/10 via-[color:var(--lkv-surface)] to-[color:var(--lkv-secondary)]/15 border border-white/60 text-[color:var(--lkv-primary)] overflow-hidden ${className}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <div className="w-10 h-10 rounded-full bg-white/70 backdrop-blur-md flex items-center justify-center shadow-2xs mb-1">
          {fallbackIcon || <Icon name="mountain" size={18} className="text-[color:var(--lkv-primary)]" />}
        </div>
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[color:var(--lkv-text-secondary)]">
          {alt || 'LKDV Expédition'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${fill ? 'w-full h-full' : ''} ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-[color:var(--stone-200)]/60 backdrop-blur-xs animate-pulse z-10" />
      )}
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={() => setIsLoading(false)}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
