'use client';
import { useRouter } from 'next/navigation';

/** W-D-10 DepartActionsBar — barre d'actions sticky bottom. */
export function DepartActionsBar({ departId, className }: { departId: string; className?: string }) {
  const router = useRouter();
  return (
    <div className={`${className ?? ''} flex flex-wrap gap-2 glass p-3`} role="toolbar" aria-label="Actions du départ">
      <button className="glass interactive h-11 px-4 rounded-full text-sm font-medium text-white bg-sage-800">
        ✓ Valider
      </button>
      <button className="glass interactive h-11 px-4 rounded-full text-sm font-medium" onClick={() => router.push(`/materiel/kits`)}>
        🎒 Préparer
      </button>
      <button
        className="glass interactive h-11 px-4 rounded-full text-sm font-medium"
        onClick={() => router.push(`/api/materiel/calendar`)}
      >
        📅 Calendrier
      </button>
      <button className="glass interactive h-11 px-4 rounded-full text-sm font-medium text-danger">
        🗑️ Supprimer
      </button>
    </div>
  );
}
