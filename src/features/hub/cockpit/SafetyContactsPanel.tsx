'use client';

import { useState, useTransition, type FormEvent } from 'react';
import Icon from '@/components/ui/Icon';
import { publishHubLivePosition, saveHubSafetyContact } from './liveSafetyActions';
import type { Coordinate } from './model';
import { DrawerRow, DrawerSection, StatusBadge } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

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
    <div role="region" aria-label="Sécurité et partage de position" className={ds.drawerRoot} style={{ paddingBottom: 0 }}>
      <DrawerSection
        title="Partage de position au groupe"
        right={<StatusBadge tone={sharing ? 'good' : 'neutral'}>{sharing ? 'Actif (4h)' : 'Masqué'}</StatusBadge>}
      >
        <div className={ds.row}>
          <span className={ds.rowIcon} data-tone={sharing ? 'good' : 'neutral'} aria-hidden="true">
            <Icon name="navigation" size={17} />
          </span>
          <span className={ds.rowBody}>
            <span className={ds.rowTitle}>Partager ma position</span>
            <span className={ds.rowSub}>Visible par les membres confirmés · révocable instantanément</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={sharing}
            aria-label={sharing ? 'Couper le partage de position' : 'Partager ma position au groupe'}
            className={ds.switchTrack}
            disabled={!isOnline || pending}
            onClick={() => toggleSharing(!sharing)}
          >
            <span className={ds.switchThumb} />
          </button>
        </div>
      </DrawerSection>

      <DrawerSection
        title="Contacts d’urgence privés"
        right={<StatusBadge tone="neutral">Privé 🔒</StatusBadge>}
        padded={openContact}
      >
        {!openContact ? (
          <DrawerRow
            icon="shield"
            iconTone="warn"
            title="+ Contact d’urgence privé"
            subtitle="Visible uniquement par toi · persisté en base"
            chevron
            onClick={() => setOpenContact(true)}
          />
        ) : (
          <form onSubmit={submitContact} className={ds.drawerRoot} style={{ paddingBottom: 0 }} aria-label="Contact de sécurité privé">
            <label className={ds.fieldGroup}>
              <span className={ds.fieldLabel}>Nom du contact</span>
              <input
                type="text"
                className={ds.fieldInput}
                required
                maxLength={120}
                placeholder="Ex. Claire Fontaine"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </label>
            <div className={ds.kpiGrid2}>
              <label className={ds.fieldGroup}>
                <span className={ds.fieldLabel}>Canal</span>
                <select
                  className={ds.fieldSelect}
                  value={channel}
                  onChange={(e) => setChannel(e.currentTarget.value as 'phone' | 'sms' | 'email')}
                >
                  <option value="phone">Téléphone</option>
                  <option value="sms">SMS</option>
                  <option value="email">E-mail</option>
                </select>
              </label>
              <label className={ds.fieldGroup}>
                <span className={ds.fieldLabel}>Numéro ou e-mail</span>
                <input
                  type="text"
                  className={ds.fieldInput}
                  required
                  maxLength={160}
                  placeholder="+33 6 …"
                  value={value}
                  onChange={(e) => setValue(e.currentTarget.value)}
                />
              </label>
            </div>
            <div className={ds.btnRow}>
              <button type="submit" className={ds.btnPrimary} disabled={pending}>
                Enregistrer le contact
              </button>
              <button type="button" className={ds.btnSecondary} onClick={() => setOpenContact(false)}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </DrawerSection>

      {feedback && (
        <div className={ds.alertBanner} data-tone="good" role="status">
          {feedback}
        </div>
      )}
    </div>
  );
}
