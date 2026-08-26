'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center p-4">
      <div className="glass rounded-[24px] p-8 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-[#E1EBDE] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#17402C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-display font-bold text-[#17402C]">Une erreur est survenue</h2>
        <p className="text-[#5A7064]">
          Nous n'avons pas pu charger cette page. Veuillez réessayer.
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => reset()}
            className="glass-capsule-btn w-full justify-center"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="glass-capsule-btn secondary w-full justify-center"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}