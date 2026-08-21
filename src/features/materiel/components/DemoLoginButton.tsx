'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/** Connexion démo : connecte au compte seed demo@lkdv.app puis recharge. */
export function DemoLoginButton({ compact = false }: { compact?: boolean }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doDemo = async () => {
    setBusy(true); setError(null);
    try {
      await signIn('demo@lkdv.app', 'DemoPass!2026');
      router.refresh();
    } catch {
      setError('Échec de la connexion démo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={doDemo}
        disabled={busy}
        className="glass interactive h-11 px-5 rounded-full text-sm font-medium text-white bg-sage-800 disabled:opacity-40"
      >
        {busy ? 'Connexion…' : 'Connexion démo'}
      </button>
      {!compact && (
        <p className="text-xs text-[color:var(--label-tertiary)]">
          demo@lkdv.app — données d’exemple pré-chargées
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
