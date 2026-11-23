/** Formats fr-FR partagés par les lectures d'étapes, de variantes et de versions (purs, sans ICU requis). */
const NNBSP = ' ';

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);

export function fmtKm(km: number): string {
  const r = Math.round(km * 10) / 10;
  const [i, d] = Math.abs(r).toFixed(1).split('.');
  return `${r < 0 ? '−' : ''}${group(i)}${d && d !== '0' ? `,${d}` : ''} km`;
}

export function fmtMeters(m: number): string {
  const r = Math.round(m);
  return `${r < 0 ? '−' : ''}${group(String(Math.abs(r)))} m`;
}

/** « 5 h 10 », « 45 min », « 6 h ». */
export function fmtDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function fmtSignedKm(km: number): string {
  if (Math.abs(km) < 0.05) return '±0 km';
  return `${km > 0 ? '+' : '−'}${fmtKm(Math.abs(km))}`;
}

export function fmtSignedMeters(m: number): string {
  if (Math.round(m) === 0) return '±0 m';
  return `${m > 0 ? '+' : '−'}${fmtMeters(Math.abs(m))}`;
}

export function fmtSignedDuration(min: number): string {
  if (Math.round(min) === 0) return '±0 min';
  return `${min > 0 ? '+' : '−'}${fmtDuration(Math.abs(min))}`;
}
