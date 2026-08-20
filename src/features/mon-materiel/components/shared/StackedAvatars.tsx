'use client';
/**
 * LKDV — StackedAvatars : empilage de photos/icônes (kits, objets).
 * Affiche jusqu'à `max` avatars en chevauchement horizontal.
 */
import React from 'react';
import Image from 'next/image';

export interface AvatarDatum {
  id: string;
  label: string;
  imageUrl?: string | null;
  fallbackIcon?: React.ReactNode;
}

interface StackedAvatarsProps {
  items: AvatarDatum[];
  max?: number;
  size?: number; // px
  className?: string;
}

export function StackedAvatars({ items, max = 4, size = 32, className = '' }: StackedAvatarsProps) {
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;
  return (
    <div className={`flex items-center ${className}`} style={{ gap: 0 }}>
      {visible.map((item, i) => (
        <div
          key={item.id}
          title={item.label}
          className="rounded-full border-2 border-white/80 bg-[#2D5A3D]/10 overflow-hidden flex items-center justify-center shrink-0"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -size * 0.3,
            zIndex: visible.length - i,
          }}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.label}
              width={size}
              height={size}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-[#2D5A3D] text-xs">{item.fallbackIcon ?? '🎒'}</span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full border-2 border-white/80 bg-[#1C2620]/8 flex items-center justify-center text-[10px] font-semibold text-[#1C2620]/60 shrink-0"
          style={{ width: size, height: size, marginLeft: -size * 0.3, zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
