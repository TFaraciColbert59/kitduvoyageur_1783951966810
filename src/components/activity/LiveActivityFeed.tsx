'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Compass, Users, MapPin, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { fetchRecentEvents } from '@/lib/events/queries';
import { eventBus } from '@/lib/events/eventBus';
import { handleActivityFeedEvent, type ActivityFeedItem } from '@/lib/events/handlers/activityFeedHandler';
import { GlassCard } from '@/components/ui/GlassCard';

interface LiveActivityFeedProps {
  crewId?: string;
  limit?: number;
  title?: string;
}

export function LiveActivityFeed({
  crewId,
  limit = 10,
  title = 'Flux d’activité communautaire',
}: LiveActivityFeedProps) {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      const fetched = await fetchRecentEvents({ limit, crewId, visibility: crewId ? 'crew' : 'public' });
      if (isMounted) {
        setItems(fetched);
        setLoading(false);
      }
    }

    loadEvents();

    // Écoute en temps réel des nouveaux événements émis in-process
    const unsubscribe = eventBus.subscribe('*', (event) => {
      const feedItem = handleActivityFeedEvent(event);
      if (feedItem) {
        setItems((prev) => [feedItem, ...prev.slice(0, limit - 1)]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [crewId, limit]);

  const getIcon = (badge: string) => {
    switch (badge) {
      case 'Nouvelle aventure':
      case 'Expédition terminée':
        return <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Équipage':
        return <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'Avis sentinelle':
        return <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'Carnet d’expédition':
        return <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Compass className="w-4 h-4 text-lkv-secondary" />;
    }
  };

  return (
    <GlassCard className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-black/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h3 className="font-display font-bold text-sm sm:text-base text-lkv-primary">
            {title}
          </h3>
        </div>
        <span className="text-[11px] font-mono uppercase tracking-wider text-lkv-secondary">
          Live Sync
        </span>
      </div>

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-xs text-lkv-secondary gap-2">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Synchronisation des activités...</span>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-6 text-center text-xs text-lkv-secondary space-y-2">
          <p>Aucune activité récente enregistrée pour le moment.</p>
          <p className="text-[11px] text-lkv-secondary/80">
            Créez une expédition ou rejoignez un équipage pour initier le flux.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="divide-y divide-black/5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.url}
              className="flex items-start justify-between gap-3 py-3 hover:bg-black/5 rounded-xl px-2.5 transition-colors group"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-black/5 mt-0.5 shrink-0">
                  {getIcon(item.badge)}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-lkv-primary group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {item.headline}
                    </span>
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-lkv-secondary">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(item.timestamp).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-lkv-secondary group-hover:text-lkv-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
