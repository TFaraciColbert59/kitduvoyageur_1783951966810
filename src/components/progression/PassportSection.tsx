'use client';

import React from 'react';
import { useTranslation, type LocaleContextValue } from '@/lib/i18n/context';
import type { UserDiscovery } from '@/features/progression/server/discoveries';

/**
 * T19 — Passeport privé : souvenirs datés (identifiants canoniques seulement).
 * Aucune trace, aucun document d'identité, aucune coordonnée : cette vue ne
 * peut afficher que des noms d'entités, une provenance et une date.
 */
export interface PassportSectionProps {
  status: 'loading' | 'ready' | 'unavailable';
  discoveries: UserDiscovery[];
}

const TYPE_LABEL_KEY = {
  country: 'progression.passportCountries',
  region: 'progression.passportRegions',
  massif: 'progression.passportMassifs',
} as const;

const PROVENANCE_LABEL_KEY = {
  verified: 'progression.passportVerified',
  declared: 'progression.passportDeclared',
  virtual: 'progression.passportVirtual',
} as const;

function formatStamp(dateValue: string, locale: LocaleContextValue['locale']): string | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (!Number.isFinite(parsed.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parsed);
  } catch {
    return null;
  }
}

export default function PassportSection({ status, discoveries }: PassportSectionProps) {
  const { t, locale } = useTranslation();

  if (status === 'unavailable') {
    return (
      <p className="text-xs text-[var(--lkv-text-secondary)]">
        {t('progression.passportUnavailable')}
      </p>
    );
  }
  if (status === 'loading') {
    return <p className="text-xs text-[var(--lkv-text-muted)]">{t('progression.passportLoading')}</p>;
  }
  if (discoveries.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">
        {t('progression.passportEmptyBody')}
      </p>
    );
  }

  const counts = discoveries.reduce<Record<UserDiscovery['entityType'], number>>(
    (acc, discovery) => {
      acc[discovery.entityType] += 1;
      return acc;
    },
    { country: 0, region: 0, massif: 0 }
  );

  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
        {t('progression.passportPrivate')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {(['country', 'region', 'massif'] as const).map((type) =>
          counts[type] > 0 ? (
            <li
              key={type}
              className="rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-[11px] font-semibold text-[color:var(--card-content)]"
            >
              {`${counts[type]} · ${t(TYPE_LABEL_KEY[type])}`}
            </li>
          ) : null
        )}
      </ul>
      <ul className="mt-3 divide-y divide-black/5">
        {discoveries.slice(0, 20).map((discovery) => {
          const dateLabel = formatStamp(discovery.firstSeenAt, locale);
          return (
            <li
              key={`${discovery.entityType}:${discovery.entityCode}`}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-[var(--lkv-text-primary)]">
                  {discovery.entityCode}
                </span>
                <span className="block text-[10.5px] text-[var(--lkv-text-muted)]">
                  {t(PROVENANCE_LABEL_KEY[discovery.provenance])}
                  {dateLabel ? ` · ${dateLabel}` : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
