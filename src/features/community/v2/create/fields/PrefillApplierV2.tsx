'use client';

import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

/**
 * Applique un préremplissage reçu après le montage du formulaire (enchaînement
 * Club → Sortie avec `{clubId, clubName}`, Kit → Sortie avec `{kitId, kitName}`).
 * Un `nonce` différent rejoue l'application ; les valeurs absentes sont ignorées.
 */
export function PrefillApplierV2({
  values,
  nonce,
}: {
  values: Record<string, unknown> | null | undefined;
  nonce: number;
}) {
  const form = useFormContext();
  const applied = useRef(-1);
  useEffect(() => {
    if (!values || applied.current === nonce) return;
    applied.current = nonce;
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue;
      form.setValue(key as never, value as never, { shouldDirty: false, shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontairement piloté par le nonce
  }, [nonce, form]);

  return null;
}

export default PrefillApplierV2;
