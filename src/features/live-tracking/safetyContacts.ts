import { randomUUID } from 'node:crypto';
import { SystemClock } from './tokenService';
import type {
  AddSafetyContactInput,
  LiveTrackingClock,
  SafetyBroadcastResult,
  SafetyContact,
  SafetyContactConsentStatus,
  SafetyContactStore,
  SafetyNotificationEvent,
  SafetyNotifier,
} from './types';

export const MAX_SAFETY_CONTACTS = 5;

export class InMemorySafetyContactStore implements SafetyContactStore {
  private readonly contacts = new Map<string, SafetyContact>();

  async listByOwner(ownerUserId: string): Promise<SafetyContact[]> {
    const out: SafetyContact[] = [];
    for (const c of this.contacts.values()) {
      if (c.ownerUserId === ownerUserId) {
        out.push({ ...c });
      }
    }
    return out;
  }

  async getById(contactId: string): Promise<SafetyContact | null> {
    const c = this.contacts.get(contactId);
    return c ? { ...c } : null;
  }

  async save(contact: SafetyContact): Promise<void> {
    this.contacts.set(contact.id, { ...contact });
  }

  async delete(contactId: string): Promise<void> {
    this.contacts.delete(contactId);
  }
}

export class SafetyContactService {
  constructor(
    private readonly store: SafetyContactStore,
    private readonly notifier: SafetyNotifier,
    private readonly clock: LiveTrackingClock = new SystemClock(),
    private readonly maxContacts: number = MAX_SAFETY_CONTACTS,
  ) {}

  async addContact(
    input: AddSafetyContactInput,
  ): Promise<
    | { ok: true; contact: SafetyContact }
    | { ok: false; error: 'invalid_input' | 'max_contacts_reached' | 'duplicate_contact' }
  > {
    const displayName = input.displayName.trim();
    const destination = input.destination.trim();
    if (!displayName || !destination) {
      return { ok: false, error: 'invalid_input' };
    }

    const existing = await this.store.listByOwner(input.ownerUserId);
    if (existing.length >= this.maxContacts) {
      return { ok: false, error: 'max_contacts_reached' };
    }
    const duplicate = existing.some(
      (c) =>
        c.channel === input.channel &&
        c.destination.toLowerCase() === destination.toLowerCase(),
    );
    if (duplicate) {
      return { ok: false, error: 'duplicate_contact' };
    }

    const nowMs = this.clock.nowMs();
    const contact: SafetyContact = {
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      displayName,
      channel: input.channel,
      destination,
      consentStatus: 'pending',
      consentedAtMs: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    await this.store.save(contact);
    return { ok: true, contact };
  }

  async setConsent(
    contactId: string,
    ownerUserId: string,
    consentStatus: Exclude<SafetyContactConsentStatus, 'pending'>,
  ): Promise<{ ok: true; contact: SafetyContact } | { ok: false; error: 'not_found' | 'unauthorized' }> {
    const contact = await this.store.getById(contactId);
    if (!contact) {
      return { ok: false, error: 'not_found' };
    }
    if (contact.ownerUserId !== ownerUserId) {
      return { ok: false, error: 'unauthorized' };
    }

    const nowMs = this.clock.nowMs();
    const updated: SafetyContact = {
      ...contact,
      consentStatus,
      consentedAtMs: consentStatus === 'accepted' ? nowMs : null,
      updatedAtMs: nowMs,
    };
    await this.store.save(updated);
    return { ok: true, contact: updated };
  }

  async removeContact(
    contactId: string,
    ownerUserId: string,
  ): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'unauthorized' }> {
    const contact = await this.store.getById(contactId);
    if (!contact) {
      return { ok: false, error: 'not_found' };
    }
    if (contact.ownerUserId !== ownerUserId) {
      return { ok: false, error: 'unauthorized' };
    }
    await this.store.delete(contactId);
    return { ok: true };
  }

  /**
   * Diffuse un événement aux seuls contacts ayant donné leur consentement explicite ('accepted').
   */
  async broadcastEvent(params: {
    ownerUserId: string;
    sessionId: string;
    event: SafetyNotificationEvent;
    shareUrl?: string;
    targetContactIds?: string[];
  }): Promise<SafetyBroadcastResult> {
    const allContacts = await this.store.listByOwner(params.ownerUserId);
    const selected = params.targetContactIds
      ? allContacts.filter((c) => params.targetContactIds!.includes(c.id))
      : allContacts;

    const notifiedContactIds: string[] = [];
    const skippedUnconsentedIds: string[] = [];
    const failedContactIds: string[] = [];
    const nowMs = this.clock.nowMs();

    for (const contact of selected) {
      if (contact.consentStatus !== 'accepted') {
        skippedUnconsentedIds.push(contact.id);
        continue;
      }

      const res = await this.notifier.send({
        contactId: contact.id,
        channel: contact.channel,
        destination: contact.destination,
        event: params.event,
        sessionId: params.sessionId,
        shareUrl: params.event === 'live_share_stopped' ? undefined : params.shareUrl,
        sentAtMs: nowMs,
      });

      if (res.ok) {
        notifiedContactIds.push(contact.id);
      } else {
        failedContactIds.push(contact.id);
      }
    }

    return {
      notifiedContactIds,
      skippedUnconsentedIds,
      failedContactIds,
    };
  }
}
