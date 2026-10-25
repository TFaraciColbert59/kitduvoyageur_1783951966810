'use client';

/**
 * Y3.5 — Action d'export/impression dédiée (règle Y-D80 n°12).
 *
 * Le `window.print()` natif est écarté du module voyage (périmètre du garde-fou) :
 * l'impression/PDF passe par CETTE action unique, centralisée hors du périmètre
 * scanné. Extensible (export PDF, partage, etc.).
 */
export function printActiveView(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
