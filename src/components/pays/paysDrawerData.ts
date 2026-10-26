export interface PaysRegionSource {
  id: string;
  name: string;
}

export interface PaysDestinationSource {
  categorie?: string | null;
  titre?: string | null;
  titre_em?: string | null;
  meta_2?: string | null;
  image_url?: string | null;
}

export interface PaysRegionTile {
  key: string;
  name: string;
  image: string | null;
  alt: string;
  count: number;
  query: string;
  category: string | null;
}

export interface PaysTripSource {
  id: string;
  slug?: string | null;
  title?: string | null;
  destination_name?: string | null;
  destination_country_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
}

export interface PaysTripHistoryRow {
  id: string;
  slug: string | null;
  title: string;
  destination: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
}

const normalize = (value: string | null | undefined): string => (value ?? '').trim().toLocaleLowerCase('fr-FR');

export function zoneFromCategory(category: string | null | undefined): string | null {
  return category?.trim() ? category.trim() : null;
}

export function buildRegionTiles(
  regions: PaysRegionSource[] | null | undefined,
  destinations: PaysDestinationSource[] | null | undefined,
): PaysRegionTile[] {
  const places = (destinations ?? []).filter((destination) =>
    Boolean(destination?.titre || destination?.titre_em || destination?.meta_2),
  );

  const known = (regions ?? []).map((region) => region?.name).filter((name): name is string => Boolean(name?.trim()));
  if (known.length > 0) {
    return known.map((name, index) => {
      const wanted = normalize(name);
      const match = places.find((destination) => {
        const haystack = [destination.categorie, destination.titre, destination.titre_em, destination.meta_2]
          .map(normalize)
          .join(' ');
        return wanted.length > 0 && haystack.includes(wanted);
      });
      const matchedCount = places.filter((destination) => {
        const haystack = [destination.categorie, destination.titre, destination.titre_em, destination.meta_2]
          .map(normalize)
          .join(' ');
        return wanted.length > 0 && haystack.includes(wanted);
      }).length;
      const region = (regions ?? [])[index];
      return {
        key: `region-${region?.id ?? index}`,
        name,
        image: match?.image_url ?? null,
        alt: name,
        count: matchedCount,
        query: name,
        category: match?.categorie ?? null,
      };
    });
  }

  const zones = new Map<string, { name: string; image: string | null; count: number; category: string }>();
  for (const destination of places) {
    const zone = zoneFromCategory(destination.categorie);
    if (!zone) continue;
    const current = zones.get(zone);
    if (current) {
      current.count += 1;
      if (!current.image && destination.image_url) current.image = destination.image_url;
    } else {
      zones.set(zone, {
        name: zone,
        image: destination.image_url ?? null,
        count: 1,
        category: destination.categorie ?? zone,
      });
    }
  }
  return [...zones.values()].map((zone) => ({
    key: `zone-${zone.name}`,
    name: zone.name,
    image: zone.image,
    alt: zone.name,
    count: zone.count,
    query: zone.name,
    category: zone.category,
  }));
}

export function normalizeTripHistory(
  owned: PaysTripSource[] | null | undefined,
  shared: PaysTripSource[] | null | undefined,
): PaysTripHistoryRow[] {
  const rows = [...(owned ?? []), ...(shared ?? [])]
    .filter((trip): trip is PaysTripSource => Boolean(trip?.id))
    .map((trip) => ({
      id: trip.id,
      slug: trip.slug ?? null,
      title: trip.title?.trim() || 'Voyage sans titre',
      destination: trip.destination_name?.trim() || null,
      start: trip.start_date ?? null,
      end: trip.end_date ?? null,
      status: trip.status ?? null,
    }));
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
}
