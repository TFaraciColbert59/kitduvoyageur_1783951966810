/**
 * UUID v4 — utilise crypto.randomUUID() quand disponible (contexte sécurisé),
 * sinon un générateur de secours (fonctionne en http:// LAN, navigation privée, etc.).
 */
function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallbackUuid();
}

if (
  typeof window !== 'undefined' &&
  typeof window.crypto !== 'undefined' &&
  typeof window.crypto.randomUUID !== 'function'
) {
  try {
    Object.defineProperty(window.crypto, 'randomUUID', {
      value: fallbackUuid,
      configurable: true,
      writable: true,
    });
  } catch {
    /* ignore if read-only */
  }
}