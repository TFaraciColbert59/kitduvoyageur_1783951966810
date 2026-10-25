'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, EmptyState, LoadingState, SearchField, Sheet } from '@/components/ui';
import {
  getSocialSuggestions,
  searchTripPartners,
  createEphemeralGroup,
  type SocialSuggestion,
} from '@/features/tribu/actions/ephemeralGroup';

interface EphemeralGroupSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { groupId: string; name: string }) => void | Promise<void>;
}

const FIELD_CLASS =
  'min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

/**
 * Sortie eclair (Phase 2 TRIBU) — selection dans le cercle existant :
 * co-membres de mes groupes + personnes que je suis + recherche par nom.
 * La gestion du groupe reste dans le Hub (TRIBU-R1).
 */
export default function EphemeralGroupSheet({ open, onClose, onCreated }: EphemeralGroupSheetProps) {
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SocialSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setQuery('');
    setSelected(new Set());
    setLoading(true);
    getSocialSuggestions()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setSuggestions(result.suggestions);
        else setError(result.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      searchTripPartners(trimmed).then((result) => {
        if (!result.ok) return;
        setSuggestions((prev) => {
          const seen = new Set(prev.map((s) => s.id));
          const merged = [...prev];
          for (const suggestion of result.suggestions) {
            if (!seen.has(suggestion.id)) {
              merged.push(suggestion);
              seen.add(suggestion.id);
            }
          }
          return merged;
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const visibleSuggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return suggestions;
    return suggestions.filter((s) => s.name.toLowerCase().includes(trimmed));
  }, [suggestions, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await createEphemeralGroup({
      title: title.trim() || undefined,
      inviteeIds: Array.from(selected),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle('');
    await onCreated({ groupId: result.groupId, name: result.name });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v && !submitting) onClose();
      }}
      title="Sortie avec des amis"
      description="Un groupe éclair, à gérer dans le Hub — dissous automatiquement après la sortie."
    >
      <div data-testid="ephemeral-group-sheet" className="space-y-[var(--space-4)]">
        <label className="block space-y-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-secondary)]">
            Nom de la sortie
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Sortie du jour"
            className={FIELD_CLASS}
            data-testid="ephemeral-group-title"
          />
        </label>

        <label className="block space-y-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-secondary)]">
            Rechercher un voyageur
          </span>
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom…"
            aria-label="Rechercher un voyageur"
            data-testid="ephemeral-group-search"
          />
        </label>

        <div className="space-y-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-secondary)]">
            Compagnons ({selected.size})
          </span>
          {loading ? (
            <LoadingState compact label="Chargement des suggestions…" />
          ) : visibleSuggestions.length === 0 ? (
            <EmptyState
              compact
              title="Aucune suggestion"
              description="Cherchez un nom pour inviter quelqu’un."
            />
          ) : (
            <div className="max-h-56 space-y-[var(--space-1)] overflow-y-auto pr-[var(--space-1)]">
              {visibleSuggestions.map((suggestion) => {
                const checked = selected.has(suggestion.id);
                return (
                  <Card
                    key={suggestion.id}
                    variant="compact"
                    selected={checked}
                    onClick={() => toggle(suggestion.id)}
                    className="flex min-h-[var(--lkv-touch-min)] items-center justify-between gap-[var(--space-2)]"
                  >
                    <span className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                      {suggestion.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-[var(--space-2)]">
                      <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wide text-[color:var(--lkv-text-muted)]">
                        {suggestion.hint}
                      </span>
                      <span aria-hidden className="text-[color:var(--lkv-text-secondary)]">
                        {checked ? '✓' : '+'}
                      </span>
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p
            className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-danger)]"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          disabled={submitting}
          data-testid="ephemeral-group-submit"
        >
          {submitting ? 'Création…' : 'Créer la sortie et ouvrir le Hub'}
        </Button>
      </div>
    </Sheet>
  );
}
