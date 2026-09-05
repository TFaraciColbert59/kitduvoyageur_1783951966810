import AppShell from '@/components/shell/AppShell';

export default function TripItineraryLoading() {
  return (
    <AppShell safeTop={true} hasBottomNav={false}>
      <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse space-y-4">
        {/* Header skeleton */}
        <div className="h-10 bg-surface-card rounded-xl w-1/3" />
        {/* Day navigator skeleton */}
        <div className="h-14 bg-surface-card rounded-2xl w-full" />
        {/* Day view skeleton */}
        <div className="h-32 bg-surface-card rounded-2xl w-full" />
        {/* Steps skeleton */}
        <div className="space-y-3">
          <div className="h-24 bg-surface-card rounded-2xl w-full" />
          <div className="h-24 bg-surface-card rounded-2xl w-full" />
          <div className="h-24 bg-surface-card rounded-2xl w-full" />
        </div>
      </div>
    </AppShell>
  );
}
