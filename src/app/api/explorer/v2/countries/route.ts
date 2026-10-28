import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pgrest } from '@/lib/explorer-v2/pgrest';

export const revalidate = 3600;

const querySchema = z.object({
  iso: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

interface CountryRow {
  iso_a2: string;
  name: string;
  continent: string | null;
  capital: string | null;
  currency_code: string | null;
  currency_name: string | null;
  phone_code: string | null;
  timezone: string | null;
  languages: string[] | null;
  area_km2: number | null;
}

interface PracticalRow {
  iso_a2: string;
  emergency_numbers: Record<string, string> | null;
  plug_types: string[] | null;
  driving_side: string | null;
  units: string | null;
}

/**
 * Détails d'un pays (français, capitale, monnaie, indicatif) et faits
 * pratiques (urgences, prises, conduite, unités).
 * Toute valeur absente est renvoyée `null` : le client masque le bloc.
 */
export async function GET(request: Request) {
  const parsed = querySchema.safeParse({
    iso: new URL(request.url).searchParams.get('iso') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'iso invalide' }, { status: 400 });
  }
  const iso = parsed.data.iso;

  try {
    const filter = iso ? `&iso_a2=eq.${iso}` : '';
    const [countries, practical] = await Promise.all([
      pgrest<CountryRow[]>(
        `countries_geo?select=iso_a2,name,continent,capital,currency_code,currency_name,phone_code,timezone,languages,area_km2${filter}&order=name.asc`,
        { revalidate: 86400 },
      ),
      pgrest<PracticalRow[]>(
        `country_practical?select=iso_a2,emergency_numbers,plug_types,driving_side,units${filter}`,
        { revalidate: 86400 },
      ).catch(() => [] as PracticalRow[]),
    ]);

    const practicalByIso = new Map(practical.map((row) => [row.iso_a2, row]));
    const data = countries.map((row) => ({
      ...row,
      practical: practicalByIso.get(row.iso_a2) ?? null,
    }));

    return NextResponse.json(
      { countries: data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('[explorer-v2] countries', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
