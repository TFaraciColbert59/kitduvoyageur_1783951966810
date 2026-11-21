'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createCockpitDocument } from './paperasseActions';
import styles from './cockpit.module.css';

export function PaperasseQuickAdd({
  tripId,
  isOnline,
  onAdded,
}: {
  tripId: string;
  isOnline: boolean;
  onAdded: (doc: { id: string; title: string; category: string; expiration: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('booking');
  const [reference, setReference] = useState('');
  const [expiration, setExpiration] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div>
        <button type="button" className="lkdv-cv2-chip" onClick={() => setOpen(true)}>
          + Ajouter une confirmation / billet
        </button>
        {feedback && <p role="status" className={styles.meta}>{feedback}</p>}
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline || !title.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await createCockpitDocument({
        tripId,
        title: title.trim(),
        category,
        reference: reference.trim() || undefined,
        expiration: expiration || null,
      });
      if (res.ok) {
        onAdded(res.document);
        setTitle('');
        setReference('');
        setExpiration('');
        setOpen(false);
        setFeedback('Confirmation enregistrée dans le portefeuille.');
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <form onSubmit={submit} className={styles.stepExecution} aria-label="Nouvelle confirmation">
      <label className={styles.stepNote}>
        Intitulé (ex. Train Paris–Chamonix, Refuge…)
        <input type="text" required maxLength={120} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
      </label>
      <div className={styles.stepButtons}>
        <label className={styles.stepNote}>
          Type
          <select value={category} onChange={(e) => setCategory(e.currentTarget.value)}>
            <option value="booking">Réservation</option>
            <option value="ticket">Billet</option>
            <option value="insurance">Assurance</option>
            <option value="passport">Identité / Passeport</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label className={styles.stepNote}>
          Échéance (facultative)
          <input type="date" value={expiration} onChange={(e) => setExpiration(e.currentTarget.value)} />
        </label>
      </div>
      <label className={styles.stepNote}>
        Référence / n° dossier (facultatif)
        <input type="text" maxLength={200} value={reference} onChange={(e) => setReference(e.currentTarget.value)} />
      </label>
      <div className={styles.stepButtons}>
        <button type="submit" className="lkdv-cv2-chip" disabled={!isOnline || pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="lkdv-cv2-chip" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {feedback && <p role="alert" className={styles.meta}>{feedback}</p>}
    </form>
  );
}
