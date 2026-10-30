'use client';

import React from 'react';

/** Erreur de champ, annoncée dès son apparition. */
export function InlineError({ message }: { message?: string | null }) {
  return message ? (
    <span className="lkdv-form-error-inline" role="alert">
      {message}
    </span>
  ) : null;
}

export default InlineError;
