'use client';

import { useState } from 'react';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { AdminField, AdminTextarea } from './AdminField';

/** Îlot client : ajouter une note journalisée (visible dans l'audit). */
export function NoteComposer({ targetTable, targetId }: { targetTable?: string; targetId?: string }) {
  const { csrfReady, call } = useAdminFetch();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    if (text.trim().length === 0) {
      setError('Note vide');
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await call('/api/admin/notes', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim(), target_table: targetTable, target_id: targetId }),
      });
      if (!res.ok) throw new Error(`Échec (${res.status})`);
      setText('');
      setDone(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" disabled={!csrfReady} onClick={() => setOpen(true)}>
        Ajouter une note
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AdminField label="Note (journalisée)">
        <AdminTextarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} disabled={busy} />
      </AdminField>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!csrfReady || busy} onClick={save}>
          Enregistrer
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
      {error ? (
        <span role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </span>
      ) : null}
      {done ? <span className="text-xs">Note enregistrée dans l’audit.</span> : null}
    </div>
  );
}
