// src/features/discovery/providers/klook/klookErrors.ts

export const KLOOK_INVALID_URL = 'KLOOK_INVALID_URL' as const;
export const KLOOK_MISSING_LINK = 'KLOOK_MISSING_LINK' as const;

export type KlookErrorCode = typeof KLOOK_INVALID_URL | typeof KLOOK_MISSING_LINK;

export class KlookLinkError extends Error {
  readonly code: KlookErrorCode;

  constructor(code: KlookErrorCode, message: string) {
    super(message);
    this.name = 'KlookLinkError';
    this.code = code;
  }
}

export const invalidKlookUrl = (message = 'URL Klook invalide ou non autorisée.') =>
  new KlookLinkError(KLOOK_INVALID_URL, message);

export const missingKlookLink = () =>
  new KlookLinkError(KLOOK_MISSING_LINK, 'Aucun lien Klook configuré.');
