/** Familles d’icônes correspondant à la condition WMO utilisée par les prévisions LKDV. */
export function weatherGlyph(code: number): string {
  if (code === 0) return 'sun';
  if (code <= 2) return 'cloud-sun';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'cloud-fog';
  if (code <= 57) return 'cloud-drizzle';
  if (code >= 95) return 'cloud-lightning';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'cloud-snow';
  return 'cloud-rain';
}
