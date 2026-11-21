'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { publishHubLivePosition, saveHubSafetyContact } from './liveSafetyActions';
import type { Coordinate } from './model';
import styles from './cockpit.module.css';

export function SafetyContactsPanel({
  tripId,
  defaultPoint,
  isOnline,
}: {
  tripId: string;
  defaultPoint?: Coordinate | null;
  isOnline: boolean;
}) {
  const [openContact, setOpenContact] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [channel, setChannel] = useState<'phone' | 'sms' | 'email'>('phone');
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOnline || !name.trim() || value.trim().length < 3) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await saveHubSafetyContact({
        tripId,
        contactName: name.trim(),
        contactChannel: channel,
        contactValue: value.trim(),
        consentConfirmed: true,
      });
      if (res.ok) {
        setName('');
        setValue('');
        setOpenContact(false);
        setFeedback('Contact de sécurité privé enregistré en base.');
      } else {
        setFeedback(res.message);
      }
    });
  }

  function toggleSharing(next: boolean) {
    if (!isOnline || pending) return;
    const [lon, lat] = defaultPoint ?? [6.86, 45.92];
    setFeedback(null);
    startTransition(async () => {
      const res = await publishHubLivePosition({
        tripId,
        lat,
        lon,
        recordedAt: new Date().toISOString(),
        sharingEnabled: next,
      });
      if (res.ok) {
        setSharing(next);
        setFeedback(next ? 'Partage de position activé pour le groupe.' : 'Partage de position interrompu.');
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div role="region" aria-label="Sécurité et partage de position" className={styles.stepExecution}>
      <div className={styles.stepButtons}>
        <button
          type="button"
          className="lkdv-cv2-chip"
          disabled={!isOnline || pending}
          onClick={() => toggleSharing(!sharing)}
        >
          {sharing ? 'Couper le partage de position' : 'Partager ma position au groupe'}
        </button>
        {!openContact && (
          <button type="button" className="lkdv-cv2-chip" onClick={() => setOpenContact(true)}>
            + Contact d’urgence privé
          </button>
        )}
      </div>
      {openContact && (
        <form onSubmit={submitContact} className={styles.stepExecution} aria-label="Contact de sécurité privé">
          <label className={styles.stepNote}>
            Nom du contact
            <input type="text" required maxLength={120} value={name} onChange={(e) => setName(e.currentTarget.value)} />
          </label>
          <div className={styles.stepButtons}>
            <label className={styles.stepNote}>
              Canal
              <select value={channel} onChange={(e) => setChannel(e.currentTarget.value as 'phone' | 'sms' | 'email')}>
                <option value="phone">Téléphone</option>
                <option value="sms">SMS</option>
                <option value="email">E-mail</option>
              </select>
            </label>
            <label className={styles.stepNote}>
              Numéro ou e-mail
              <input type="text" required maxLength={160} value={value} onChange={(e) => setValue(e.currentTarget.value)} />
            </label>
          </div>
          <div className={styles.stepButtons}>
            <button type="submit" className="lkdv-cv2-chip" disabled={pending}>Enregistrer le contact</button>
            <button type="button" className="lkdv-cv2-chip" onClick={() => setOpenContact(false)}>Annuler</button>
          </div>
        </form>
      )}
      {feedback && <p role="status" className={styles.meta}>{feedback}</p>}
    </div>
  );
}
