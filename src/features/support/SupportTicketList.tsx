'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card } from '@/components/ui';
type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  response: string | null;
  created_at: string;
};
export default function SupportTicketList({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const userId = user?.id;
  useEffect(() => {
    let active = true;
    if (!userId) {
      setTickets([]);
      setCanManage(false);
      return;
    }
    fetch('/api/support/tickets')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) {
          setTickets(d.tickets);
          setCanManage(Boolean(d.canManage));
          setError('');
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [userId, refreshKey]);
  async function respond(ticket: Ticket) {
    if (pending) return;
    setPending(ticket.id);
    setError('');
    try {
      const r = await fetch('/api/support/tickets/' + ticket.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', response: answers[ticket.id] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTickets((rows) => rows.map((t) => (t.id === ticket.id ? d.ticket : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réponse impossible');
    } finally {
      setPending(null);
    }
  }
  if (!user) return null;
  return (
    <section className="mt-6 space-y-3" aria-label="Mes demandes de support">
      <h2 className="text-lg font-semibold">
        {canManage ? 'Demandes de support' : 'Mes demandes'}
      </h2>
      {error && <p role="alert">{error}</p>}
      {!tickets.length && !error && <p>Aucune demande enregistrée.</p>}
      {tickets.map((t) => (
        <Card key={t.id} className="p-4 space-y-2">
          <p className="font-semibold">
            {t.subject} ·{' '}
            {t.status === 'resolved'
              ? 'Résolue'
              : t.status === 'in_progress'
                ? 'En cours'
                : 'En attente'}
          </p>
          <p className="text-xs break-all">N° {t.id}</p>
          <p className="whitespace-pre-wrap">{t.message}</p>
          {t.response && <p className="whitespace-pre-wrap">Réponse : {t.response}</p>}
          {canManage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void respond(t);
              }}
              className="space-y-2"
            >
              <label className="block">
                Réponse à la demande
                <textarea
                  required
                  minLength={1}
                  maxLength={5000}
                  className="w-full min-h-24 rounded-lg bg-[color:var(--glass-bg-medium)] p-3"
                  value={answers[t.id] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [t.id]: e.target.value })}
                />
              </label>
              <Button type="submit" disabled={pending !== null}>
                Répondre et résoudre
              </Button>
            </form>
          )}
        </Card>
      ))}
    </section>
  );
}
