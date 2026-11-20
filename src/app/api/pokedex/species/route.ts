import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 86400;

interface INatTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  wikipedia_url?: string | null;
  default_photo?: {
    medium_url?: string | null;
    square_url?: string | null;
    attribution?: string | null;
  } | null;
}

interface INatSpeciesCountResult {
  count: number;
  taxon: INatTaxon;
}

export interface PokedexApiSpecies {
  taxonId: number;
  dexNumber: string;
  name: string;
  latin: string;
  kingdom: 'faune' | 'flore' | 'geologie';
  iconicTaxon: string;
  rarity: 'Commun' | 'Peu commun' | 'Rare' | 'Mythique';
  observationsCount: number;
  imageUrl: string | null;
  wikipediaUrl: string | null;
  attribution: string | null;
}

function mapKingdom(iconic?: string): 'faune' | 'flore' | 'geologie' {
  const key = (iconic ?? '').toLowerCase();
  if (key === 'plantae' || key === 'fungi') return 'flore';
  return 'faune';
}

function mapRarity(count: number): PokedexApiSpecies['rarity'] {
  if (count <= 8) return 'Mythique';
  if (count <= 35) return 'Rare';
  if (count <= 140) return 'Peu commun';
  return 'Commun';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const q = searchParams.get('q')?.trim() ?? '';
  const iconic =
    searchParams.get('iconic_taxa') ??
    'Mammalia,Aves,Amphibia,Reptilia,Insecta,Plantae,Fungi';

  const lat = latParam ? Number(latParam) : NaN;
  const lng = lngParam ? Number(lngParam) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const params = new URLSearchParams({
    locale: 'fr',
    per_page: '24',
    iconic_taxa: iconic,
    quality_grade: 'research',
  });

  if (hasCoords) {
    params.set('lat', lat.toFixed(4));
    params.set('lng', lng.toFixed(4));
    params.set('radius', '20');
  } else {
    params.set('place_id', '6753');
  }

  if (q) {
    params.set('q', q);
  }

  const endpoint = `https://api.inaturalist.org/v1/observations/species_counts?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'LeKitDuVoyageur/2.0 (pokedex-nature)',
        Accept: 'application/json',
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { species: [], source: 'fallback', status: res.status },
        { status: 200 },
      );
    }

    const payload = (await res.json()) as {
      total_results?: number;
      results?: INatSpeciesCountResult[];
    };
    const results = payload.results ?? [];

    const species: PokedexApiSpecies[] = results
      .filter((r) => Boolean(r.taxon?.name))
      .map((r, index) => {
        const common = r.taxon.preferred_common_name?.trim();
        const latin = r.taxon.name;
        const formattedName = common
          ? common.charAt(0).toUpperCase() + common.slice(1)
          : latin;
        return {
          taxonId: r.taxon.id,
          dexNumber: `#${String(index + 1).padStart(3, '0')}`,
          name: formattedName,
          latin,
          kingdom: mapKingdom(r.taxon.iconic_taxon_name),
          iconicTaxon: r.taxon.iconic_taxon_name ?? 'Unknown',
          rarity: mapRarity(r.count),
          observationsCount: r.count,
          imageUrl:
            r.taxon.default_photo?.medium_url ??
            r.taxon.default_photo?.square_url ??
            null,
          wikipediaUrl: r.taxon.wikipedia_url ?? null,
          attribution: r.taxon.default_photo?.attribution ?? null,
        };
      });

    return NextResponse.json(
      {
        species,
        totalResults:
          typeof payload.total_results === 'number' && payload.total_results > 0
            ? payload.total_results
            : species.length,
        source: 'inaturalist',
        hasCoords,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        },
      },
    );
  } catch {
    return NextResponse.json({ species: [], source: 'fallback' }, { status: 200 });
  }
}
