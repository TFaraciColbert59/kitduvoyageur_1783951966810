'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Nature } from '../engine/hubNature';

export type HubEvent =
  | 'hub_page_view'
  | 'hub_nature_auto_applied'
  | 'hub_nature_changed'
  | 'hub_section_visited'
  | 'hub_redirect_used'
  | 'hub_offline_session';

interface QueuedEvent {
  event: HubEvent;
  payload: Record<string, unknown>;
}

function newSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* repli ci-dessous */
  }
  return `hub-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * H7.3 — Télémétrie hub : batch toutes les 30 s OU `beforeunload`.
 * SSR-safe : no-op hors navigateur. Échec réseau silencieux (jamais bloquant).
 */
export function useHubTelemetry() {
  const queue = useRef<QueuedEvent[]>([]);
  const sessionId = useRef<string>('');
  if (!sessionId.current && typeof window !== 'undefined') {
    sessionId.current = newSessionId();
  }

  const flush = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || queue.current.length === 0) return;
    const events = queue.current.splice(0, 20);
    try {
      await fetch('/api/telemetry/hub', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `${sessionId.current}-${Date.now()}`,
          'x-hub-session': sessionId.current,
        },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {
      /* silencieux : la télémétrie ne casse jamais le hub */
    }
  }, []);

  const track = useCallback((event: HubEvent, payload: Record<string, unknown> = {}): void => {
    if (typeof window === 'undefined') return;
    queue.current.push({ event, payload });
    if (queue.current.length >= 20) void flush();
  }, [flush]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setInterval(() => void flush(), 30_000);
    const onUnload = () => void flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flush]);

  return { track, flush };
}

/** Nature affichée → payload page_view minimal. */
export function pageViewPayload(nature: Nature): Record<string, unknown> {
  return { nature, referrer: typeof document !== 'undefined' ? document.referrer : '' };
}
