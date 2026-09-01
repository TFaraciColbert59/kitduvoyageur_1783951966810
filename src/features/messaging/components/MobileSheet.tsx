'use client';

import React, { useEffect, useRef, useState } from 'react';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * MobileSheet — bottom sheet réutilisable (Liquid Glass).
 * - z-[10010] : passe au-dessus de la BottomTabBar (z-9999) et du calque
 *   conversation (z-10000), que le sheet soit ouvert depuis la liste ou
 *   depuis une conversation.
 * - Uniquement des propriétés GPU-safe animées (transform, opacity).
 * - Drag vers le bas (mobile), Échap (desktop), clic sur le scrim.
 * - Verrouille le scroll du fond le temps de l'ouverture.
 */
export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragY = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
    }
  }, [isOpen]);

  const requestClose = () => {
    setClosing(true);
    window.setTimeout(() => {
      setMounted(false);
      onClose();
      setClosing(false);
    }, 200);
  };

  // Échap + verrouillage du scroll de fond
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={requestClose}
        className={`absolute inset-0 bg-[rgba(11,31,23,0.42)] backdrop-blur-sm ${
          closing ? 'msg-fade-out' : 'msg-fade-in'
        }`}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl outline-none ${
          closing ? 'msg-sheet-down-out' : 'msg-sheet-up-in'
        }`}
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          maxHeight: 'min(86dvh, 720px)',
        }}
        onTouchStart={(e) => {
          startY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          dragY.current = Math.max(0, e.touches[0].clientY - startY.current);
          if (panelRef.current) {
            panelRef.current.style.transform = `translate3d(0,${dragY.current}px,0)`;
          }
        }}
        onTouchEnd={() => {
          if (dragY.current > 90) {
            requestClose();
          } else if (panelRef.current) {
            panelRef.current.style.transition =
              'transform 220ms cubic-bezier(0.22,1,0.36,1)';
            panelRef.current.style.transform = 'translate3d(0,0,0)';
            window.setTimeout(() => {
              if (panelRef.current) panelRef.current.style.transition = '';
            }, 240);
          }
          dragY.current = 0;
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-[#17402C]/20" />
        </div>
        <div className="px-5 pt-2 pb-3 border-b border-stone-200/60">
          <h3 className="font-bold text-[17px] text-[#17402C]">{title}</h3>
        </div>
        <div className="px-5 py-4 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
};