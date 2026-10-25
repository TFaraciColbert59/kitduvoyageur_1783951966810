import React from 'react';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';

export function DiscoverySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden p-0">
          <Skeleton className="h-40 w-full rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DiscoveryEmpty({ label }: { label: string }) {
  return <EmptyState compact title={label} />;
}

export function DiscoveryNotice({
  children,
  tone = 'neutral',
  onRetry,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warn';
  onRetry?: () => void;
}) {
  return (
    <Card
      tone={tone === 'warn' ? 'warn' : 'neutral'}
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 px-4 py-4 text-center text-[length:var(--lkv-text-caption-1)] font-mono"
    >
      <span>{children}</span>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </Card>
  );
}
