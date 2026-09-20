'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { renameTrip, type RenameTripResult } from '@/features/trips/actions/renameTrip';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

/** Soumission normalisée — isolée de la modale pour rester testable sans DOM. */
export async function submitRenameTrip(
  tripId: string,
  title: string
): Promise<RenameTripResult> {
  return renameTrip(tripId, title.trim());
}

export interface RenameTripFormProps {
  value: string;
  error?: string | null;
  pending?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/** Forme présentable du renommage (sans portail) — testable en markup. */
export function RenameTripForm({
  value,
  error,
  pending = false,
  onChange,
  onSubmit,
  onCancel,
}: RenameTripFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-[var(--space-4)]"
      aria-label="Renommer l’activité"
    >
      <label className="flex flex-col gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
        <span>Nom de l’activité</span>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={120}
          autoFocus
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'rename-trip-error' : undefined}
          className={`${FIELD_CLASS} ${error ? 'border-[color:var(--lkv-danger)]' : ''}`}
        />
      </label>
      {error && (
        <p
          id="rename-trip-error"
          role="alert"
          className="text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-danger-dark)]"
        >
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-[var(--space-3)] pt-[var(--space-1)]">
        <p className="text-[11px] font-medium text-[color:var(--lkv-text-secondary)]">
          Entre 3 et 120 caractères.
        </p>
        <div className="flex items-center gap-[var(--space-2)]">
          <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={pending}
            disabled={!pending && value.trim().length < 3}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export interface RenameTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  currentTitle: string;
  /** Succès : renommage persistant, à charge du parent de rafraîchir sa vue. */
  onRenamed?: (title: string) => void;
}

/**
 * Modale de renommage de l'activité (trips.title) — valeur initiale = titre
 * courant, action serveur scopée user, erreurs affichées sous le champ,
 * fermeture + refresh doux au succès.
 */
export function RenameTripModal({
  open,
  onOpenChange,
  tripId,
  currentTitle,
  onRenamed,
}: RenameTripModalProps) {
  const [value, setValue] = useState(currentTitle);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setValue(currentTitle);
      setError(null);
    }
  }, [open, currentTitle]);

  const handleSubmit = () => {
    const clean = value.trim();
    if (clean.length < 3) {
      setError('Le titre doit comporter au moins 3 caractères');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitRenameTrip(tripId, clean);
      if (!result.ok) {
        setError(result.error ?? 'Erreur lors du renommage.');
        return;
      }
      onOpenChange(false);
      onRenamed?.(clean);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Renommer l’activité">
      <div className="pb-2">
        <RenameTripForm
          value={value}
          error={error}
          pending={isPending}
          onChange={setValue}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </div>
    </Sheet>
  );
}

export default RenameTripModal;
