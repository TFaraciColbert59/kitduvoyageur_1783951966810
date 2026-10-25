'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_PROFILES_VIEW } from '@/lib/queries/publicProfilesCore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export interface MentionProfile {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface MentionPickerProps {
  /** Texte tapé après `@` (le préfixe `@` est toléré). */
  query: string;
  onSelect: (profile: MentionProfile) => void;
  onClose: () => void;
  /** Placement/ancrage : le parent reste maître du conteneur. */
  className?: string;
}

export const MENTION_PROFILE_COLUMNS = 'id,handle,full_name,avatar_url';
export const MENTION_PICKER_LIMIT = 5;
export const MENTION_PICKER_DEBOUNCE_MS = 150;

/** Retire le `@` de saisie, compacte les espaces et normalise la requête. */
export function normalizeMentionQuery(query: string): string {
  return query.trim().replace(/^@+/, '').replace(/\s+/g, ' ').trim();
}

/** Échappe une valeur pour un filtre PostgREST entre guillemets doubles. */
function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Filtre `.or()` pour la vue `public_profiles`.
 * Les `,`, `.`, `(`, `)` et `"` sont neutralisés par les guillemets PostgREST ;
 * `%` et `_` sont échappés pour être cherchés littéralement (ILIKE).
 */
export function buildMentionSearchFilter(query: string): string | null {
  const normalized = normalizeMentionQuery(query);
  if (!normalized) return null;

  const pattern = `%${normalized.replace(/[\\%_]/g, '\\$&')}%`;
  const quoted = quotePostgrestValue(pattern);
  return `full_name.ilike.${quoted},handle.ilike.${quoted}`;
}

function toMentionProfile(row: unknown): MentionProfile | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id) return null;

  return {
    id: record.id,
    handle: typeof record.handle === 'string' && record.handle ? record.handle : null,
    full_name: typeof record.full_name === 'string' && record.full_name ? record.full_name : null,
    avatar_url:
      typeof record.avatar_url === 'string' && record.avatar_url ? record.avatar_url : null,
  };
}

/**
 * Recherche les profils mentionnables (nom ou handle), limités à
 * `MENTION_PICKER_LIMIT`. Lève une erreur si PostgREST échoue afin que
 * l'appelant puisse afficher un état d'erreur explicite.
 */
export async function fetchMentionProfiles(
  supabase: Pick<SupabaseClient, 'from'>,
  query: string,
  limit: number = MENTION_PICKER_LIMIT
): Promise<MentionProfile[]> {
  const filter = buildMentionSearchFilter(query);
  if (!filter) return [];

  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : MENTION_PICKER_LIMIT;
  if (safeLimit === 0) return [];

  const { data, error } = await supabase
    .from(PUBLIC_PROFILES_VIEW)
    .select(MENTION_PROFILE_COLUMNS)
    .or(filter)
    .order('full_name', { ascending: true, nullsFirst: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map(toMentionProfile)
    .filter((profile): profile is MentionProfile => profile !== null);
}

function profileLabel(profile: MentionProfile): string {
  return profile.full_name || profile.handle || 'Voyageur LKDV';
}

function profileHandle(profile: MentionProfile): string | null {
  if (!profile.handle) return null;
  return `@${profile.handle.replace(/^@/, '')}`;
}

/**
 * Liste de suggestions de mention, sans dépendance à un textarea.
 *
 * Le parent garde la main sur la saisie : il passe `query`, reçoit le profil
 * choisi via `onSelect` (insertion du token `encodeMention` de son choix) puis
 * referme via `onClose`. Le clavier est écouté au niveau document en phase de
 * capture pour fonctionner même si le focus reste dans le champ de saisie.
 */
export function MentionPicker({ query, onSelect, onClose, className }: MentionPickerProps) {
  const normalizedQuery = normalizeMentionQuery(query);
  const [profiles, setProfiles] = useState<MentionProfile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const listboxId = useId();
  const requestId = useRef(0);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const normalized = normalizeMentionQuery(query);
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    setActiveIndex(0);
    setFailed(false);

    if (!normalized) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    setProfiles([]);
    setLoading(true);
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          const next = await fetchMentionProfiles(supabase, normalized);
          if (cancelled || currentRequest !== requestId.current) return;
          setProfiles(next);
          setActiveIndex(0);
        } catch {
          if (cancelled || currentRequest !== requestId.current) return;
          setProfiles([]);
          setFailed(true);
        } finally {
          if (!cancelled && currentRequest === requestId.current) setLoading(false);
        }
      })();
    }, MENTION_PICKER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const safeIndex = profiles.length === 0 ? 0 : Math.min(activeIndex, profiles.length - 1);

  useEffect(() => {
    if (profiles.length === 0) return;
    optionRefs.current[safeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [profiles.length, safeIndex]);

  useEffect(() => {
    if (!normalizedQuery) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (profiles.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((current) => (current + 1) % profiles.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((current) => (current - 1 + profiles.length) % profiles.length);
        return;
      }

      if (event.key === 'Enter') {
        const profile = profiles[safeIndex];
        if (!profile) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect(profile);
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [normalizedQuery, onClose, onSelect, profiles, safeIndex]);

  if (!normalizedQuery) return null;

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const choose = (profile: MentionProfile) => {
    onSelect(profile);
    onClose();
  };

  return (
    <div
      className={cn(
        'lkdv-mention-picker w-full max-w-[340px] overflow-hidden rounded-control',
        'border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-1',
        'text-[color:var(--feed-ink)] shadow-elevation-3',
        'backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset',
        className
      )}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <p role="status" className="px-3 py-2.5 text-[12px] text-[color:var(--feed-muted)]">
          Recherche…
        </p>
      ) : failed ? (
        <p role="status" className="px-3 py-2.5 text-[12px] text-[color:var(--feed-muted)]">
          Recherche indisponible
        </p>
      ) : profiles.length === 0 ? (
        <p role="status" className="px-3 py-2.5 text-[12px] text-[color:var(--feed-muted)]">
          Aucun voyageur trouvé
        </p>
      ) : (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Voyageurs à mentionner"
          aria-activedescendant={optionId(safeIndex)}
          className="m-0 flex max-h-[264px] list-none flex-col gap-0.5 overflow-y-auto p-0"
        >
          {profiles.map((profile, index) => {
            const name = profileLabel(profile);
            const handle = profileHandle(profile);
            const active = index === safeIndex;

            return (
              <li
                key={profile.id}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(profile)}
                className={cn(
                  'flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2 py-1.5',
                  'transition-colors duration-100 motion-reduce:transition-none',
                  active
                    ? 'bg-[color:var(--lkv-hover-surface)]'
                    : 'hover:bg-[color:var(--lkv-hover-surface)]'
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgba(23,64,44,.08)] text-[11px] font-bold text-[color:var(--feed-ink)]">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar distant, pas de next/image hors grille
                    <img
                      src={profile.avatar_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight">
                    {name}
                  </span>
                  {handle ? (
                    <span className="block truncate text-[11px] leading-tight text-[color:var(--feed-muted)]">
                      {handle}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default MentionPicker;
