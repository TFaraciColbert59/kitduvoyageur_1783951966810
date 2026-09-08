/**
 * Saison courante (fonction pure, utilisable serveur ET client).
 * Extraite de WeatherMatchScore (H4, H-AUTO-24) : la version 'use client'
 * faisait crasher les pages serveur /materiel/alertes et /hub/alertes
 * (« Attempted to call currentSeason() from the server »).
 */
export function currentSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'printemps';
  if (m >= 6 && m <= 8) return 'ete';
  if (m >= 9 && m <= 11) return 'automne';
  return 'hiver';
}
