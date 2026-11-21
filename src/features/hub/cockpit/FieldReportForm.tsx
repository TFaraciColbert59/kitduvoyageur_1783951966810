'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { createHubFieldReport, type FieldReportCategory } from './fieldReportActions';
import type { Coordinate } from './model';
import { DrawerSection } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

const REPORT_LABELS: Record<FieldReportCategory, string> = {
  water_dry: 'Source tarie',
  water_ok: 'Eau disponible',
  trail_closed: 'Sentier fermé',
  hazard: 'Danger / éboulement',
  shelter_closed: 'Abri fermé',
  snow_ice: 'Neige / glace',
  mud: 'Boue / glissant',
  other: 'Autre',
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
      <div className={ds.drawerRoot} style={{ paddingBottom: 0 }}>
        <button type="button" className={ds.btnPrimary} onClick={() => setOpen(true)}>
          + Signaler un état terrain
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
    <DrawerSection title="Nouveau signalement terrain" padded>
      <form onSubmit={submit} className={ds.drawerRoot} style={{ paddingBottom: 0 }} aria-label="Signalement terrain">
        <label className={ds.fieldGroup}>
          <span className={ds.fieldLabel}>Type d’observation</span>
          <select
            className={ds.fieldSelect}
            value={category}
            onChange={(e) => setCategory(e.currentTarget.value as FieldReportCategory)}
          >
            {(Object.keys(REPORT_LABELS) as FieldReportCategory[]).map((key) => (
              <option key={key} value={key}>{REPORT_LABELS[key]}</option>
            ))}
          </select>
        </label>
        <label className={ds.fieldGroup}>
          <span className={ds.fieldLabel}>Précision (ex. Source à sec au refuge)</span>
          <input
            type="text"
            className={ds.fieldInput}
            value={title}
            maxLength={140}
            required
            placeholder="Décris l’état observé sur place…"
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <div className={ds.btnRow}>
          <button type="submit" className={ds.btnPrimary} disabled={pending}>
            {pending ? 'Envoi…' : 'Publier le signalement'}
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
