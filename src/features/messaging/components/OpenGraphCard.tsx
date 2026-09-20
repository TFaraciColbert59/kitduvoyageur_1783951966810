'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, Skeleton } from '@/components/ui';
import type { OpenGraphPreviewData } from '../types/messaging.types';

const ogCache = new Map<string, OpenGraphPreviewData | null>();

interface OpenGraphCardProps {
  url: string;
  isMine: boolean;
}

export const OpenGraphCard: React.FC<OpenGraphCardProps> = ({ url, isMine }) => {
  const [ogData, setOgData] = useState<OpenGraphPreviewData | null>(ogCache.get(url) || null);
  const [loading, setLoading] = useState<boolean>(!ogCache.has(url));
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    if (ogCache.has(url)) {
      setOgData(ogCache.get(url) || null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch('/api/og-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && !data.error && (data.title || data.description)) {
          ogCache.set(url, data);
          setOgData(data);
        } else {
          ogCache.set(url, null);
          setFailed(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          ogCache.set(url, null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (failed || (!loading && !ogData)) return null;

  return (
    <Card variant="compact" className="mt-[var(--space-2)] overflow-hidden p-0 transition-shadow hover:shadow-elevation-2">
      {loading ? (
        <div className="flex animate-pulse flex-col gap-[var(--space-2)] bg-[color:var(--lkv-primary)]/5 p-[var(--space-3)]">
          <Skeleton className="h-28 w-full rounded-[var(--lkv-radius-sm)]" />
          <Skeleton className="h-3 w-3/4 rounded" />
          <Skeleton className="h-2 w-1/2 rounded" />
        </div>
      ) : ogData ? (
        <a
          href={ogData.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`group block text-left ${
            isMine
              ? 'bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
              : 'border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] text-[color:var(--lkv-text-primary)]'
          }`}
        >
          {ogData.image && (
            <div className="relative h-32 w-full overflow-hidden bg-[color:var(--lkv-primary)]/10">
              <Image
                src={ogData.image}
                alt={ogData.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 300px"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="space-y-[var(--space-1)] p-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold opacity-75">
              <Icon name="globe" className="size-3 shrink-0" />
              <span className="truncate">{ogData.domain}</span>
              <Icon name="external-link" className="ml-auto size-2.5 shrink-0 opacity-60" />
            </div>
            <p className="line-clamp-1 text-[length:var(--lkv-text-caption)] font-bold leading-tight group-hover:underline">
              {ogData.title}
            </p>
            {ogData.description && (
              <p className="line-clamp-2 text-[length:var(--lkv-text-caption)] leading-snug opacity-80">
                {ogData.description}
              </p>
            )}
          </div>
        </a>
      ) : null}
    </Card>
  );
};
