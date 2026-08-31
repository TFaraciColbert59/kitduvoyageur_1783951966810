"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ExternalLink, Globe } from 'lucide-react';
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
    <div className="mt-2 overflow-hidden rounded-xl border border-black/10 transition-all hover:shadow-md">
      {loading ? (
        <div className="p-3 bg-black/5 animate-pulse flex flex-col gap-2">
          <div className="h-28 bg-stone-300/40 rounded-lg w-full" />
          <div className="h-3 bg-stone-300/60 rounded w-3/4" />
          <div className="h-2 bg-stone-300/40 rounded w-1/2" />
        </div>
      ) : ogData ? (
        <a
          href={ogData.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block text-left group ${
            isMine ? 'bg-black/15 text-white' : 'bg-stone-50/90 text-stone-900 border border-stone-200/80'
          }`}
        >
          {ogData.image && (
            <div className="relative w-full h-32 bg-stone-900/10 overflow-hidden">
              <Image
                src={ogData.image}
                alt={ogData.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 300px"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="truncate">{ogData.domain}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-auto opacity-60" />
            </div>
            <p className="text-xs font-bold leading-tight line-clamp-1 group-hover:underline">
              {ogData.title}
            </p>
            {ogData.description && (
              <p className="text-[11px] opacity-80 leading-snug line-clamp-2">
                {ogData.description}
              </p>
            )}
          </div>
        </a>
      ) : null}
    </div>
  );
};
