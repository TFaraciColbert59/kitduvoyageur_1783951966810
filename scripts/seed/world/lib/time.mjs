// Horloge du monde : toutes les dates sont relatives à un epoch stable,
// enregistré dans le manifeste. Un rejeu ne décale donc rien ; `--refresh`
// peut explicitement réancrer la vie récente.

const DAY_MS = 86_400_000;

export function createClock(epochIso) {
  const base = new Date(epochIso);
  if (Number.isNaN(base.getTime())) throw new Error(`Epoch invalide: ${epochIso}`);

  const at = (offsetDays, hour = 18, minute = 0) => {
    const d = new Date(base.getTime() + offsetDays * DAY_MS);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  return {
    epoch: base.toISOString(),
    now: () => new Date(base.getTime()),
    daysAgo: (n, hour = 18, minute = 0) => at(-n, hour, minute),
    daysFromNow: (n, hour = 10, minute = 0) => at(n, hour, minute),
    hoursAgo: (n) => new Date(base.getTime() - n * 3_600_000),
    hoursFromNow: (n) => new Date(base.getTime() + n * 3_600_000),
    minutesAgo: (n) => new Date(base.getTime() - n * 60_000),
    today: (hour = 10, minute = 0) => at(0, hour, minute),
    iso: (d) => d.toISOString(),
    date: (d) => d.toISOString().slice(0, 10),
    /** Décale une date existante de n jours (utile pour les séries). */
    shift: (d, n, hour, minute) => {
      const x = new Date(new Date(d).getTime() + n * DAY_MS);
      if (hour != null) x.setHours(hour, minute ?? 0, 0, 0);
      return x;
    },
  };
}

export function dateOnly(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export function addDays(d, n) {
  return new Date(new Date(d).getTime() + n * DAY_MS);
}

export function addMinutes(d, n) {
  return new Date(new Date(d).getTime() + n * 60_000);
}

/** Distance approximative en km entre deux points (Haversine). */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
