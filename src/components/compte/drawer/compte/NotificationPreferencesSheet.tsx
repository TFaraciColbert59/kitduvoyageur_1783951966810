'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, RotateCw, Smartphone } from 'lucide-react';
import type { NotificationPreferencesPayload } from '@/features/compte/server/compte';
import {
  LEGACY_NOTIFICATION_CATEGORIES,
  NOTIFICATION_GROUPS,
  NOTIFICATION_TYPE_BY_ID,
  UNAVAILABLE_NOTIFICATION_SCOPES,
  computeLegacyCategories,
  notificationTypesForGroup,
  notificationTypesForLegacyGroup,
  type LegacyNotificationGroup,
} from '@/features/compte/notificationCatalog';
import { DrawerToggle, OverlaySheet } from '../../overlay/OverlaySheet';
import { fetchJson } from './shared';
import './settingsSheets.css';

type Channel = 'inApp' | 'email' | 'push';

const CHANNELS: ReadonlyArray<{ id: Channel; label: string; icon: React.ReactNode }> = [
  { id: 'inApp', label: 'App', icon: <Bell size={11} aria-hidden="true" /> },
  { id: 'email', label: 'Email', icon: <Mail size={11} aria-hidden="true" /> },
  { id: 'push', label: 'Push', icon: <Smartphone size={11} aria-hidden="true" /> },
];

const QUERY_KEY = ['compte', 'notification-preferences'] as const;

export function NotificationPreferencesSheet({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchJson<NotificationPreferencesPayload>('/api/compte/compte/notification-preferences'),
    staleTime: 15_000,
  });
  const [draft, setDraft] = useState<NotificationPreferencesPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const activeCount = useMemo(
    () => (draft ? Object.values(draft.categories).filter(Boolean).length : 0),
    [draft]
  );

  const save = async (
    optimistic: NotificationPreferencesPayload,
    body: Record<string, unknown>,
    success: string
  ) => {
    const previous = draft;
    setDraft(optimistic);
    setBusy(true);
    setStatus(null);
    try {
      const next = await fetchJson<NotificationPreferencesPayload>(
        '/api/compte/compte/notification-preferences',
        { method: 'PATCH', body: JSON.stringify(body) }
      );
      setDraft(next);
      queryClient.setQueryData(QUERY_KEY, next);
      void queryClient.invalidateQueries({ queryKey: ['compte', 'profile'] });
      void queryClient.invalidateQueries({ queryKey: ['compte', 'notifications'] });
      window.dispatchEvent(new Event('lkdv:notifications-changed'));
      setStatus({ kind: 'ok', text: success });
      window.setTimeout(() => setStatus(null), 2200);
    } catch (error) {
      setDraft(previous);
      setStatus({
        kind: 'error',
        text:
          error instanceof Error && error.message
            ? `Non enregistré : ${error.message}`
            : 'Non enregistré. Réessaie.',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleType = (type: string, channel: Channel) => {
    const definition = NOTIFICATION_TYPE_BY_ID.get(type);
    const current = draft?.preferences.find((preference) => preference.type === type);
    if (
      !definition ||
      !current ||
      (channel === 'email' && definition.emailLocked) ||
      (definition.inAppOnly && channel !== 'inApp')
    ) {
      return;
    }
    const nextValue = !current[channel];
    const nextPreferences = draft!.preferences.map((preference) => {
      if (preference.type !== type) return preference;
      if (channel === 'inApp') return { ...preference, inApp: nextValue };
      if (channel === 'email') return { ...preference, email: nextValue };
      return { ...preference, push: nextValue };
    });
    const optimistic: NotificationPreferencesPayload = {
      preferences: nextPreferences,
      categories: computeLegacyCategories(nextPreferences),
    };
    void save(
      optimistic,
      { preferences: [{ type, [channel]: nextValue }] },
      `${definition.label} : ${CHANNELS.find((item) => item.id === channel)?.label} ${
        nextValue ? 'activé' : 'coupé'
      }.`
    );
  };

  const toggleCategory = (category: LegacyNotificationGroup, enabled: boolean) => {
    if (!draft) return;
    const targetTypes = new Set(notificationTypesForLegacyGroup(category).map((type) => type.type));
    const nextPreferences = draft.preferences.map((preference) => {
      if (!targetTypes.has(preference.type)) return preference;
      const definition = NOTIFICATION_TYPE_BY_ID.get(preference.type);
      return {
        ...preference,
        inApp: enabled,
        email: definition?.emailLocked || definition?.inAppOnly ? false : enabled,
        push: definition?.inAppOnly ? false : enabled,
      };
    });
    const optimistic: NotificationPreferencesPayload = {
      preferences: nextPreferences,
      categories: computeLegacyCategories(nextPreferences),
    };
    const label = LEGACY_NOTIFICATION_CATEGORIES.find((item) => item.id === category)?.label ?? category;
    void save(
      optimistic,
      { categories: { [category]: enabled } },
      `${label} : ${enabled ? 'activé' : 'coupé'}.`
    );
  };

  return (
    <OverlaySheet
      title="Notifications"
      subtitle="Catégories, puis canaux par type"
      onClose={onClose}
      nested
      className="lkdv-cp-settings-overlay"
    >
      <div className="lkdv-cp-settings-sheet">
        {status ? (
          <p className={`lkdv-cp-settings-status is-${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        ) : null}

        {query.isLoading && !draft ? (
          <p className="lkdv-cp-settings-status is-info" role="status">Chargement de tes réglages…</p>
        ) : null}

        {query.isError && !draft ? (
          <div className="lkdv-cp-settings-section">
            <h3>Réglages indisponibles</h3>
            <p className="lkdv-cp-settings-intro">
              Impossible de lire tes préférences pour le moment. Aucun réglage n’a été modifié.
            </p>
            <button
              type="button"
              className="lkdv-cp-choice"
              onClick={() => void query.refetch()}
            >
              <RotateCw size={13} aria-hidden="true" /> Réessayer
            </button>
          </div>
        ) : null}

        {draft ? (
          <>
            <p className="lkdv-cp-settings-intro">
              {activeCount === 0
                ? 'Aucune catégorie d’activité active. Les alertes de sécurité et la messagerie restent hors de ce réglage.'
                : `${activeCount} catégorie${activeCount > 1 ? 's' : ''} active${
                    activeCount > 1 ? 's' : ''
                  } sur 4.`}
            </p>

            <section className="lkdv-cp-settings-section" aria-labelledby="lkdv-cp-categories">
              <h3 id="lkdv-cp-categories">Catégories</h3>
              <p>
                Couper une catégorie coupe tous ses types. Les réglages fins ci-dessous restent
                modifiables type par type.
              </p>
              {LEGACY_NOTIFICATION_CATEGORIES.map((category) => (
                <div className="lkdv-cp-category-row" key={category.id}>
                  <div className="lkdv-cp-category-copy">
                    <b>{category.label}</b>
                    <small>{category.detail}</small>
                  </div>
                  <DrawerToggle
                    checked={draft.categories[category.id]}
                    onChange={(enabled) => toggleCategory(category.id, enabled)}
                    disabled={busy}
                    label={`${draft.categories[category.id] ? 'Couper' : 'Activer'} la catégorie ${category.label}`}
                  />
                </div>
              ))}
            </section>

            {NOTIFICATION_GROUPS.map((group) => {
              const types = notificationTypesForGroup(group.id);
              if (types.length === 0) return null;
              return (
                <section
                  className="lkdv-cp-settings-section"
                  key={group.id}
                  aria-labelledby={`lkdv-cp-group-${group.id}`}
                >
                  <h3 id={`lkdv-cp-group-${group.id}`}>{group.label}</h3>
                  <p>{group.detail}</p>
                  {types.map((definition) => {
                    const preference = draft.preferences.find((item) => item.type === definition.type);
                    if (!preference) return null;
                    return (
                      <div className="lkdv-cp-type-row" key={definition.type}>
                        <div className="lkdv-cp-type-copy">
                          <b>{definition.label}</b>
                          <small>{definition.detail}</small>
                        </div>
                        <div className="lkdv-cp-type-channels" role="group" aria-label={`Canaux pour ${definition.label}`}>
                          {CHANNELS.map((channel) => {
                            const locked = channel.id === 'email' && definition.emailLocked;
                            const unavailable =
                              definition.inAppOnly === true && channel.id !== 'inApp';
                            const checked = unavailable ? false : preference[channel.id];
                            return (
                              <button
                                key={channel.id}
                                type="button"
                                className="lkdv-cp-channel"
                                aria-pressed={checked}
                                aria-label={`${definition.label} — ${channel.label}${
                                  locked ? ' (regroupé dans le digest, non modifiable)' : ''
                                }${unavailable ? ' (aucun envoi de ce type aujourd’hui)' : ''}`}
                                title={
                                  locked
                                    ? 'Email regroupé dans le digest : ce type ne l’envoie jamais immédiatement.'
                                    : unavailable
                                      ? 'Ce producteur n’enfile aujourd’hui aucun envoi email ou push : le réglage reste inactif.'
                                      : channel.label
                                }
                                disabled={busy || locked || unavailable}
                                onClick={() => toggleType(definition.type, channel.id)}
                              >
                                {channel.icon}
                                <span aria-hidden="true">{channel.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}

            <section className="lkdv-cp-settings-section" aria-labelledby="lkdv-cp-unavailable">
              <h3 id="lkdv-cp-unavailable">Non disponible dans les données actuelles</h3>
              <div className="lkdv-cp-unavailable">
                <b>Sports et segments</b>
                {UNAVAILABLE_NOTIFICATION_SCOPES.map((scope) => (
                  <p key={scope.id}>
                    <strong>{scope.label} :</strong> {scope.reason}
                  </p>
                ))}
              </div>
              <p className="lkdv-cp-settings-note">
                Aucune migration n’est créée pour ces cases : elles n’apparaîtront qu’avec un
                producteur de notification réel.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </OverlaySheet>
  );
}

export default NotificationPreferencesSheet;
