'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type NotificationFilter = 0 | 1 | 2 | 3; // Tout · Moments · Équipage · Système
export const NOTIFICATION_FILTERS = ['Tout', 'Moments', 'Équipage', 'Système'] as const;

export interface CarnetNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  createdAt: string;
  /** 1 Moments · 2 Équipage · 3 Système. */
  category: 1 | 2 | 3;
}

/** Catégorie d'affichage d'un type de notification (types de `notifications.type`). */
export function categoryOfType(type: string): 1 | 2 | 3 {
  if (/collab|member|invite|crew|participant|follow/i.test(type)) return 2;
  if (/moment|photo|comment|like|reaction|story|media/i.test(type)) return 1;
  return 3;
}

/** « il y a 2 h », « hier », « il y a 3 j » : repères de la maquette. */
export function relativeTime(iso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} j`;
}

export function groupLabel(iso: string, now = new Date()): 'Aujourd’hui' | 'Hier' | 'Avant' {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
  return diff <= 0 ? 'Aujourd’hui' : diff === 1 ? 'Hier' : 'Avant';
}

/**
 * Notifications de la personne connectée liées à ce carnet
 * (`related_type = 'carnet'`). La RLS de `notifications` ne rend que les siennes ;
 * « Tout lire » ne met à jour que ces lignes.
 */
export function useCarnetNotifications(carnetId: string, userId: string | null, enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<CarnetNotification[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;
    setState('loading');
    void (async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, read, created_at')
        .eq('user_id', userId)
        .eq('related_type', 'carnet')
        .eq('related_id', carnetId)
        .order('created_at', { ascending: false })
        .limit(40);
      if (cancelled) return;
      if (error) {
        setState('error');
        return;
      }
      setItems(
        ((data ?? []) as Array<{
          id: string;
          type: string;
          title: string;
          message: string | null;
          read: boolean | null;
          created_at: string;
        }>).map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          message: row.message,
          read: Boolean(row.read),
          createdAt: row.created_at,
          category: categoryOfType(row.type),
        }))
      );
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [carnetId, enabled, supabase, userId]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0 || !userId) return false;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', userId);
      if (error) return false;
      setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
      return true;
    },
    [supabase, userId]
  );

  return { items, state, markRead };
}
