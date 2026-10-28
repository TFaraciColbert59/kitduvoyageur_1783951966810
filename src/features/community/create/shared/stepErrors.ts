/**
 * Routage des erreurs de formulaire vers l’étape qui porte le champ.
 *
 * Les panes inactives du `StepPager` sont `inert` : un `focus()` sur un champ
 * d’une pane inactive ne fait rien. Toute logique de focus doit donc d’abord
 * basculer sur l’étape fautive, puis focaliser.
 */

/** Premier champ en erreur, dans l’ordre de déclaration des champs. */
export function firstErrorField(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    // Les erreurs serveur (`root.*`) ne sont pas des champs focalisables.
    if (key === 'root' || key.startsWith('root.')) continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const nested = firstErrorField(value);
      if (nested) return `${key}.${nested}`;
      continue;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.message === 'string' && record.message.trim()) return key;
      const nested = firstErrorField(record);
      if (nested) return `${key}.${nested}`;
      continue;
    }
    if (typeof value === 'string' && value.trim()) return key;
  }
  return null;
}

/** Nom de champ racine (`media.0` → `media`), celui que React Hook Form enregistre. */
export function rootFieldName(name: string): string {
  return name.split('.')[0] || name;
}

/** Étape qui contient le champ, ou -1 si aucune ne le déclare. */
export function findStepForField(
  stepFields: readonly (readonly string[])[],
  name: string,
): number {
  const root = rootFieldName(name);
  return stepFields.findIndex((fields) => fields.includes(root));
}
