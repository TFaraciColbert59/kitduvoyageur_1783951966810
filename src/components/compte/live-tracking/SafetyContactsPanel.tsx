'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';

import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import LkvIcon from '@/components/ui/LkvIcon';
import Spinner from '@/components/ui/Spinner';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { SafetyContact, SafetyContactChannel } from '@/features/live-tracking';

import {
  CHANNEL_LABEL,
  CHANNEL_PLACEHOLDER,
  isValidContactDestination,
  maskDestination,
} from './model';
import { liveTrackingApi, type LiveTrackingApi } from './liveTrackingApi';
import { Chip, ErrorNotice, PanelCard, SectionHeading } from './shared';

export const MAX_CONTACTS = 5;

const CHANNELS: SafetyContactChannel[] = ['sms', 'email', 'push', 'in_app'];

const CONSENT_COPY: Record<
  SafetyContact['consentStatus'],
  { label: string; tone: 'live' | 'warning' | 'danger' }
> = {
  accepted: { label: 'Accord donné', tone: 'live' },
  pending: { label: 'Accord à donner', tone: 'warning' },
  revoked: { label: 'Accord retiré', tone: 'danger' },
};

export interface SafetyContactsPanelProps {
  api?: LiveTrackingApi;
  initialContacts?: SafetyContact[];
}

export function SafetyContactsPanel({
  api = liveTrackingApi,
  initialContacts,
}: SafetyContactsPanelProps) {
  const { haptic } = useHapticFeedback();
  const nameId = useId();
  const destinationId = useId();
  const channelLegendId = useId();

  const [contacts, setContacts] = useState<SafetyContact[]>(initialContacts ?? []);
  const [loading, setLoading] = useState(!initialContacts);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [channel, setChannel] = useState<SafetyContactChannel>('sms');
  const [destination, setDestination] = useState('');

  const refresh = useCallback(async () => {
    try {
      setContacts(await api.listContacts());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les contacts.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!initialContacts) void refresh();
  }, [initialContacts, refresh]);

  const addContact = useCallback(async () => {
    setNotice(null);
    if (!displayName.trim()) {
      setError('Donne un nom à ce contact.');
      return;
    }
    if (!isValidContactDestination(channel, destination)) {
      setError(
        channel === 'email'
          ? 'Adresse e-mail invalide.'
          : channel === 'sms'
            ? 'Numéro invalide. Utilise un format international, par exemple +33 6 12 34 56 78.'
            : 'Identifiant invalide.'
      );
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      setError(`Tu peux enregistrer au maximum ${MAX_CONTACTS} contacts de sécurité.`);
      return;
    }

    setBusy('add');
    setError(null);
    try {
      const contact = await api.addContact({
        displayName: displayName.trim(),
        channel,
        destination: destination.trim(),
      });
      setContacts((current) => [...current, contact]);
      setDisplayName('');
      setDestination('');
      setNotice('Contact ajouté. Il ne recevra rien tant que son accord n’est pas donné.');
      haptic('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’ajouter ce contact.');
    } finally {
      setBusy(null);
    }
  }, [api, channel, contacts.length, destination, displayName, haptic]);

  const setConsent = useCallback(
    async (contact: SafetyContact, consentStatus: 'accepted' | 'revoked') => {
      setBusy(`consent:${contact.id}`);
      setError(null);
      setNotice(null);
      try {
        const updated = await api.setContactConsent(contact.id, consentStatus);
        setContacts((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
        );
        setNotice(
          consentStatus === 'accepted'
            ? `${updated.displayName} pourra être prévenu en cas de besoin.`
            : `${updated.displayName} ne sera plus notifié.`
        );
        haptic('selection');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible de modifier cet accord.');
      } finally {
        setBusy(null);
      }
    },
    [api, haptic]
  );

  const removeContact = useCallback(
    async (contact: SafetyContact) => {
      if (pendingDelete !== contact.id) {
        setPendingDelete(contact.id);
        setNotice('Appuie une seconde fois sur Supprimer pour confirmer.');
        return;
      }
      setBusy(`delete:${contact.id}`);
      setError(null);
      setPendingDelete(null);
      try {
        await api.removeContact(contact.id);
        setContacts((current) => current.filter((candidate) => candidate.id !== contact.id));
        setNotice(`${contact.displayName} a été supprimé.`);
        haptic('medium');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible de supprimer ce contact.');
      } finally {
        setBusy(null);
      }
    },
    [api, haptic, pendingDelete]
  );

  const atLimit = contacts.length >= MAX_CONTACTS;

  return (
    <div className="space-y-4">
      <PanelCard aria-labelledby="safety-contacts-title">
        <SectionHeading
          id="safety-contacts-title"
          eyebrow="Sécurité"
          title="Contacts de sécurité"
          description="Ils peuvent recevoir un lien de suivi ou un ping. Leur accord explicite est requis avant tout envoi."
        />

        {loading ? (
          <div className="flex items-center gap-3 py-4 text-[13px] text-[color:var(--glass-secondary)]">
            <Spinner size="sm" label="Chargement des contacts" />
            Chargement des contacts…
          </div>
        ) : null}

        {error ? <ErrorNotice message={error} onRetry={() => void refresh()} /> : null}

        {notice ? (
          <div
            role="status"
            className="mb-4 rounded-2xl border border-[color:var(--lkv-action-soft)] bg-[var(--lkv-action-soft)] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--lkv-action)]"
          >
            {notice}
          </div>
        ) : null}

        {!loading && contacts.length === 0 ? (
          <EmptyState
            compact
            icon={
              <span aria-hidden>
                <LkvIcon name="users" size={26} />
              </span>
            }
            title="Aucun contact de sécurité"
            description="Ajoute une personne de confiance. Rien ne lui sera envoyé sans son accord."
          />
        ) : null}

        {contacts.length > 0 ? (
          <ul className="divide-y divide-[color:var(--glass-rim)]">
            {contacts.map((contact) => {
              const consent = CONSENT_COPY[contact.consentStatus];
              return (
                <li key={contact.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[color:var(--glass-label)]">
                        {contact.displayName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[color:var(--glass-secondary)]">
                        {CHANNEL_LABEL[contact.channel]} ·{' '}
                        {maskDestination(contact.channel, contact.destination)}
                      </p>
                    </div>
                    <Chip tone={consent.tone}>{consent.label}</Chip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contact.consentStatus === 'accepted' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy === `consent:${contact.id}`}
                        onClick={() => void setConsent(contact, 'revoked')}
                      >
                        Retirer l’accord
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy === `consent:${contact.id}`}
                        onClick={() => void setConsent(contact, 'accepted')}
                      >
                        Donner l’accord
                      </Button>
                    )}
                    <Button
                      variant={pendingDelete === contact.id ? 'destructive' : 'ghost'}
                      size="sm"
                      loading={busy === `delete:${contact.id}`}
                      onClick={() => void removeContact(contact)}
                    >
                      {pendingDelete === contact.id ? 'Confirmer la suppression' : 'Supprimer'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </PanelCard>

      <PanelCard aria-labelledby="safety-contact-add-title">
        <SectionHeading
          id="safety-contact-add-title"
          eyebrow="Ajouter"
          title="Une personne de confiance"
          description={
            atLimit
              ? `Limite atteinte (${MAX_CONTACTS}). Supprime un contact pour en ajouter un autre.`
              : `${contacts.length}/${MAX_CONTACTS} contacts enregistrés.`
          }
        />

        <div className="space-y-4">
          <div>
            <label
              htmlFor={nameId}
              className="mb-1 block text-[13px] font-medium text-[color:var(--glass-label)]"
            >
              Nom
            </label>
            <input
              id={nameId}
              type="text"
              maxLength={80}
              value={displayName}
              placeholder="Ex. Camille"
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-11 w-full rounded-xl border border-[color:var(--lkv-field-border)] bg-[var(--lkv-field-bg)] px-3 text-[14px] text-[color:var(--glass-label)] placeholder:text-[color:var(--lkv-text-muted)]"
            />
          </div>

          <fieldset aria-describedby={channelLegendId}>
            <legend
              id={channelLegendId}
              className="mb-2 text-[13px] font-medium text-[color:var(--glass-label)]"
            >
              Canal
            </legend>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={channel === candidate}
                  onClick={() => setChannel(candidate)}
                  className={`min-h-11 rounded-full border px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                    channel === candidate
                      ? 'border-[color:var(--lkv-action)] bg-[color:var(--lkv-action)] text-[color:var(--lkv-text-inverted)]'
                      : 'border-[color:var(--glass-rim)] bg-[var(--lkv-surface-paper)] text-[color:var(--glass-label)]'
                  }`}
                >
                  {CHANNEL_LABEL[candidate]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor={destinationId}
              className="mb-1 block text-[13px] font-medium text-[color:var(--glass-label)]"
            >
              {channel === 'email'
                ? 'Adresse e-mail'
                : channel === 'sms'
                  ? 'Numéro de téléphone'
                  : 'Identifiant'}
            </label>
            <input
              id={destinationId}
              type={channel === 'email' ? 'email' : channel === 'sms' ? 'tel' : 'text'}
              inputMode={channel === 'sms' ? 'tel' : channel === 'email' ? 'email' : 'text'}
              maxLength={320}
              value={destination}
              placeholder={CHANNEL_PLACEHOLDER[channel]}
              onChange={(event) => setDestination(event.target.value)}
              className="h-11 w-full rounded-xl border border-[color:var(--lkv-field-border)] bg-[var(--lkv-field-bg)] px-3 text-[14px] text-[color:var(--glass-label)] placeholder:text-[color:var(--lkv-text-muted)]"
            />
          </div>

          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={busy === 'add'}
            disabled={atLimit}
            onClick={() => void addContact()}
          >
            Ajouter ce contact
          </Button>
        </div>
      </PanelCard>
    </div>
  );
}

export default SafetyContactsPanel;
