'use client';

import { ErrorState } from '@/components/ui';

export default function TripSectionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-8">
      <ErrorState
        title="Cette section n'a pas pu être chargée"
        message="Les autres sections du voyage restent accessibles depuis la navigation."
        onRetry={() => reset()}
      />
    </div>
  );
}
