'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  dismissDynamicIsland,
  onDynamicIsland,
  type DynamicIslandEvent,
} from '@/lib/dynamic-island';
import Icon from './Icon';

export function DynamicIslandHost() {
  const [event, setEvent] = useState<DynamicIslandEvent | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onDynamicIsland((ev) => {
      setEvent(ev);
    });
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    clearTimer();
    if (!event || isPaused) return;

    const duration = event.durationMs ?? 3800;
    timerRef.current = setTimeout(() => {
      dismissDynamicIsland(event.id);
    }, duration);

    return clearTimer;
  }, [event, isPaused]);

  if (!event) return null;

  const isCompact = event.variant === 'compact';

  return (
    <aside
      aria-label="Notification île dynamique"
      className="fixed left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300 ease-out"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        zIndex: 'var(--z-alert, 700)',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onPointerEnter={() => setIsPaused(true)}
        onPointerLeave={() => setIsPaused(false)}
        className="pointer-events-auto flex items-center justify-between gap-2.5 transition-all duration-300"
        style={{
          width: isCompact ? '220px' : 'min(366px, calc(100vw - 24px))',
          minHeight: isCompact ? '38px' : '44px',
          padding: isCompact ? '4px 12px' : '6px 14px',
          borderRadius: isCompact ? '9999px' : '22px',
          backgroundColor: 'rgba(251, 250, 246, 0.94)', // 100% Light Mode Sauge Canvas
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '0.5px solid rgba(23, 43, 36, 0.14)', // Glass rim
          boxShadow: '0 8px 24px rgba(23, 64, 44, 0.12), 0 2px 6px rgba(23, 43, 36, 0.08)',
          color: '#172B24',
        }}
      >
        {isCompact ? (
          <div className="flex w-full items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#17402C]">
              {event.leadingIcon ? (
                <Icon name={event.leadingIcon as any} size={16} aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[#226148]" />
              )}
              <span className="truncate">{event.title}</span>
            </span>
            {event.trailingText ? (
              <span className="text-xs font-medium text-[#56665D] tabular-nums">
                {event.trailingText}
              </span>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-[13px] font-semibold leading-tight text-[#172B24]">
                {event.title}
              </span>
              {event.subtitle ? (
                <span className="truncate text-[11px] font-medium leading-tight text-[#56665D]">
                  {event.subtitle}
                </span>
              ) : null}
            </div>

            {(event.undo || event.action) && (
              <div className="flex shrink-0 items-center gap-1.5">
                {event.undo && (
                  <button
                    type="button"
                    onClick={() => {
                      event.undo?.onUndo();
                      dismissDynamicIsland(event.id);
                    }}
                    className="flex h-7 min-w-[44px] items-center justify-center rounded-full px-2.5 text-xs font-semibold text-[#56665D] transition-colors hover:bg-black/5 hover:text-[#172B24] active:scale-95"
                  >
                    {event.undo.label ?? 'Annuler'}
                  </button>
                )}
                {event.action && (
                  <button
                    type="button"
                    onClick={() => {
                      event.action?.onAction();
                      dismissDynamicIsland(event.id);
                    }}
                    className="flex h-7 min-w-[44px] items-center justify-center rounded-full bg-[#17402C] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#226148] active:scale-95"
                  >
                    {event.action.label}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

export default DynamicIslandHost;
