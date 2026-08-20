'use client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';

/** W-D-10 DepartActionsBar — barre d'actions sticky bottom (branchée API). */
export function DepartActionsBar({ departId, className }: { departId: string; className?: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const validate = () => {
    toast('Préparation validée ✓', 'success');
  };

  const share = async () => {
    const res = await fetch('/api/materiel/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kit_id: departId, permission: 'lecture' }),
    });
    if (res.ok) {
      const data = await res.json();
      try { await navigator.clipboard.writeText(window.location.origin + data.url); toast('Lien de partage copié', 'success'); }
      catch { toast('Lien créé', 'success'); }
    } else toast('Erreur de partage', 'error');
  };

  const remove = async () => {
    if (!confirm('Supprimer définitivement ce kit ?')) return;
    const res = await fetch(`/api/materiel/kits/${departId}`, { method: 'DELETE' });
    if (res.ok) { toast('Kit supprimé', 'success'); router.push('/materiel/kits'); }
    else toast('Erreur', 'error');
  };

  return (
    <div className={`${className ?? ''} flex flex-wrap gap-2 glass p-3`} role="toolbar" aria-label="Actions du départ">
      <button onClick={validate} className="glass interactive h-11 px-4 rounded-full text-sm font-medium text-white bg-sage-800">✓ Valider</button>
      <button onClick={share} className="glass interactive h-11 px-4 rounded-full text-sm font-medium">📤 Partager</button>
      <a href="/api/materiel/calendar" className="glass interactive h-11 px-4 rounded-full text-sm font-medium inline-flex items-center">📅 Calendrier</a>
      <button onClick={remove} className="glass interactive h-11 px-4 rounded-full text-sm font-medium text-danger">🗑️ Supprimer</button>
    </div>
  );
}
