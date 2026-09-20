'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Sheet } from '@/components/ui/Sheet';
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
      <div data-testid="ephemeral-group-sheet" className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-[var(--lkv-text-secondary)]">Nom de la sortie</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Sortie du jour"
            className="w-full glass-input rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            data-testid="ephemeral-group-title"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-[var(--lkv-text-secondary)]">
            Rechercher un voyageur
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom…"
            className="w-full glass-input rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            data-testid="ephemeral-group-search"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-bold text-[var(--lkv-text-secondary)]">
            Compagnons ({selected.size})
          </span>
          {loading ? (
            <p className="text-xs text-[var(--lkv-text-muted)] py-3">Chargement des suggestions…</p>
          ) : visibleSuggestions.length === 0 ? (
            <p className="text-xs text-[var(--lkv-text-muted)] py-3">
              Aucune suggestion — cherchez un nom pour inviter quelqu’un.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {visibleSuggestions.map((suggestion) => {
                const checked = selected.has(suggestion.id);
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => toggle(suggestion.id)}
                    aria-pressed={checked}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all min-h-[44px] ${
                      checked
                        ? 'bg-lkv-primary/10 text-lkv-primary border border-lkv-primary'
                        : 'glass-sub-card text-[var(--lkv-text-secondary)] border border-transparent'
                    }`}
                  >
                    <span className="truncate">{suggestion.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] font-mono uppercase tracking-wide opacity-70">
                        {suggestion.hint}
                      </span>
                      <span aria-hidden>{checked ? '✓' : '+'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs font-bold text-[var(--lkv-danger)]" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="glass-capsule-btn primary w-full py-3 text-sm font-bold min-h-[44px] disabled:opacity-60"
          data-testid="ephemeral-group-submit"
        >
          <span className="relative z-10">
            {submitting ? 'Création…' : 'Créer la sortie et ouvrir le Hub'}
          </span>
        </button>
      </div>
    </Sheet>
  );
}
