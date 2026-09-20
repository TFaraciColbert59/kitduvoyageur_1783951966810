'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { Sheet } from '@/components/ui/Sheet';
import { LkvInput } from '@/components/ui/LkvInput';
import { renameTrip, type RenameTripResult } from '@/features/trips/actions/renameTrip';

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
      className="space-y-4"
      aria-label="Renommer l’activité"
    >
      <LkvInput
        label="Nom de l’activité"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        autoFocus
        error={error ?? undefined}
        disabled={pending}
      />
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] font-medium text-[var(--lkv-text-secondary)]">
          Entre 3 et 120 caractères.
        </p>
        <div className="flex items-center gap-2">
          <GlassCapsuleBtn type="button" size="sm" onClick={onCancel} disabled={pending}>
            Annuler
          </GlassCapsuleBtn>
          <GlassCapsuleBtn
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending || value.trim().length < 3}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </GlassCapsuleBtn>
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Renommer l’activité"
    >
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
