'use client';
import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import type { MarketplaceTransaction } from '../types';
import { FIELD, Feedback, request } from './shared';
type Report = { id: string; listing_id: string; reason: string; status?: string };
type Queue = { can_moderate: boolean; reports: Report[]; disputes: MarketplaceTransaction[] };
export function MarketplaceModeration() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    request<Queue>('/api/marketplace/moderation')
      .then((data) => {
        if (active) setQueue(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (!queue?.can_moderate) return null;
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (note.trim().length < 10)
        throw new Error('Documentez la décision en au moins 10 caractères.');
      await request('/api/marketplace/moderation', { ...body, note });
      setMessage('Décision enregistrée.');
      setQueue(await request<Queue>('/api/marketplace/moderation'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modération indisponible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold">Modération</h3>
      <label className="block">
        Motif documenté de la décision
        <textarea
          className={FIELD}
          minLength={10}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Feedback error={error} message={message} />
      <h4 className="font-semibold">Signalements</h4>
      {queue.reports.length === 0 && <p>Aucun signalement à traiter.</p>}
      {queue.reports.map((r) => (
        <div key={r.id} className="space-y-2">
          <p>{r.reason}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void act({ action: 'hide', listing_id: r.listing_id, report_id: r.id })
              }
            >
              Masquer l’annonce
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void act({ action: 'dismiss_report', report_id: r.id })}
            >
              Clore le signalement
            </Button>
          </div>
        </div>
      ))}
      <h4 className="font-semibold">Litiges</h4>
      {queue.disputes.length === 0 && <p>Aucun litige à traiter.</p>}
      {queue.disputes.map((tx) => (
        <div key={tx.id} className="space-y-2">
          <p>
            {tx.listing_snapshot.name} · {tx.mode}
          </p>
          <p>
            Confirmez la remise ou le retour réel avant la résolution. Une vente remise reste
            irréversible.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void act({
                  action: 'resolve_dispute',
                  transaction_id: tx.id,
                  resolution: 'completed',
                })
              }
            >
              Clore comme terminée
            </Button>
            {tx.mode !== 'vente' && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void act({
                    action: 'resolve_dispute',
                    transaction_id: tx.id,
                    resolution: 'cancelled',
                  })
                }
              >
                Clore et libérer le matériel
              </Button>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
