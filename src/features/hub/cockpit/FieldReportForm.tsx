'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createHubFieldReport, type FieldReportCategory } from './fieldReportActions';
import type { Coordinate } from './model';
import styles from './cockpit.module.css';

const REPORT_LABELS: Record<FieldReportCategory, string> = {
  water_dry: 'Source tarie',
  water_ok: 'Eau disponible',
  trail_closed: 'Sentier fermé',
  hazard: 'Danger / éboulement',
  shelter_closed: 'Abri fermé',
  snow_ice: 'Neige / glace',
  mud: 'Boue / terrain glissant',
  other: 'Autre observation',
};

export function FieldReportForm({
  tripId,
  defaultPoint,
  isOnline,
}: {
  tripId: string;
  defaultPoint?: Coordinate | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FieldReportCategory>('water_dry');
  const [title, setTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div>
        <button type="button" className="lkdv-cv2-chip" onClick={() => setOpen(true)}>
          + Signaler un état terrain
        </button>
        {feedback && <p role="status" className={styles.meta}>{feedback}</p>}
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setFeedback('Décris brièvement le signalement.');
      return;
    }
    if (!isOnline) {
      setFeedback('Connexion requise pour publier un signalement partagé.');
      return;
    }
    const [lon, lat] = defaultPoint ?? [6.86, 45.92];
    setFeedback(null);
    startTransition(async () => {
      const res = await createHubFieldReport({
        tripId,
        category,
        title: title.trim(),
        lat,
        lon,
      });
      if (res.ok) {
        setTitle('');
        setOpen(false);
        setFeedback('Signalement terrain enregistré (valide 7 jours).');
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <form onSubmit={submit} className={styles.stepExecution} aria-label="Signalement terrain">
      <label className={styles.stepNote}>
        Type d’observation
        <select value={category} onChange={(e) => setCategory(e.currentTarget.value as FieldReportCategory)}>
          {(Object.keys(REPORT_LABELS) as FieldReportCategory[]).map((key) => (
            <option key={key} value={key}>{REPORT_LABELS[key]}</option>
          ))}
        </select>
      </label>
      <label className={styles.stepNote}>
        Précision (ex. Source à sec au refuge)
        <input
          type="text"
          value={title}
          maxLength={140}
          required
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </label>
      <div className={styles.stepButtons}>
        <button type="submit" className="lkdv-cv2-chip" disabled={pending}>
          {pending ? 'Envoi…' : 'Publier le signalement'}
        </button>
        <button type="button" className="lkdv-cv2-chip" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
      {feedback && <p role="alert" className={styles.meta}>{feedback}</p>}
    </form>
  );
}
