import AppShell from '@/components/shell/AppShell';

export default function TripKitLoading() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 animate-pulse">
        <div className="h-4 w-48 bg-stone-200 rounded mb-4" />
        <div className="h-8 w-64 bg-stone-200 rounded mb-2" />
        <div className="h-4 w-96 bg-stone-200 rounded mb-6" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="h-32 bg-stone-200/60 rounded-[24px]" />
          <div className="h-32 bg-stone-200/60 rounded-[24px]" />
          <div className="h-32 bg-stone-200/60 rounded-[24px]" />
        </div>

        <div className="h-64 bg-stone-200/60 rounded-[28px] mb-6" />
        <div className="h-96 bg-stone-200/60 rounded-[28px]" />
      </div>
    </AppShell>
  );
}
