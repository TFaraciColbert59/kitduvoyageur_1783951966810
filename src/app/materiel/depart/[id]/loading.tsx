import { DepartCockpitSkeleton } from '@/features/materiel/components/depart/DepartCockpitSkeleton';

export default function DepartIdLoading() {
  return (
    <div className="w-full h-full flex flex-col overflow-y-auto">
      <DepartCockpitSkeleton />
    </div>
  );
}