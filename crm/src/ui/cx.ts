/** Joint des classes conditionnelles (pas de dépendance externe). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
