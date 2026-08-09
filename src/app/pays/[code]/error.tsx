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
    <div className="min-h-screen bg-[#F0EBE1] flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-sm space-y-6">
        <div className="w-16 h-16 bg-[#F8F5F0] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#1C2620]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-serif text-[#1C2620]">Une erreur est survenue</h2>
        <p className="text-[#1C2620]/70">
          Nous n'avons pas pu charger cette page. Veuillez réessayer.
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => reset()}
            className="w-full bg-[#1C2620] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#2A362E] transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="w-full bg-[#F8F5F0] text-[#1C2620] px-6 py-3 rounded-xl font-medium hover:bg-[#F0ECE1] transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
