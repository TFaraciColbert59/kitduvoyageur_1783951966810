'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createCockpitDocument } from './paperasseActions';
import { DrawerSection } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

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
      <div className={ds.drawerRoot} style={{ paddingBottom: 0 }}>
        <button type="button" className={ds.btnPrimary} onClick={() => setOpen(true)}>
          + Ajouter une confirmation / billet
        </button>
        {feedback && (
          <div className={ds.alertBanner} data-tone="good" role="status">
            {feedback}
          </div>
        )}
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
    <DrawerSection title="Nouvelle confirmation ou billet" padded>
      <form onSubmit={submit} className={ds.drawerRoot} style={{ paddingBottom: 0 }} aria-label="Nouvelle confirmation">
        <label className={ds.fieldGroup}>
          <span className={ds.fieldLabel}>Intitulé (ex. Train Paris–Chamonix, Refuge…)</span>
          <input
            type="text"
            className={ds.fieldInput}
            required
            maxLength={120}
            value={title}
            placeholder="Ex. Refuge du Lac Blanc"
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <div className={ds.kpiGrid2}>
          <label className={ds.fieldGroup}>
            <span className={ds.fieldLabel}>Type</span>
            <select
              className={ds.fieldSelect}
              value={category}
              onChange={(e) => setCategory(e.currentTarget.value)}
            >
              <option value="booking">Réservation</option>
              <option value="ticket">Billet</option>
              <option value="insurance">Assurance</option>
              <option value="passport">Identité / Passeport</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className={ds.fieldGroup}>
            <span className={ds.fieldLabel}>Échéance (facultative)</span>
            <input
              type="date"
              className={ds.fieldInput}
              value={expiration}
              onChange={(e) => setExpiration(e.currentTarget.value)}
            />
          </label>
        </div>
        <label className={ds.fieldGroup}>
          <span className={ds.fieldLabel}>Référence / n° dossier (facultatif)</span>
          <input
            type="text"
            className={ds.fieldInput}
            maxLength={200}
            value={reference}
            placeholder="Ex. #LB-8842"
            onChange={(e) => setReference(e.currentTarget.value)}
          />
        </label>
        <div className={ds.btnRow}>
          <button type="submit" className={ds.btnPrimary} disabled={!isOnline || pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className={ds.btnSecondary} onClick={() => setOpen(false)}>
            Annuler
          </button>
        </div>
        {feedback && (
          <div className={ds.alertBanner} data-tone="bad" role="alert">
            {feedback}
          </div>
        )}
      </form>
    </DrawerSection>
  );
}
