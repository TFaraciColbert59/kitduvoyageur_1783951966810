import { NextResponse } from 'next/server';
import { pgrest } from '@/lib/explorer-v2/pgrest';

/**
 * Disponibilité réelle des données de terrain (fiche K3.04).
 *
 * La couche « surface » ne peut pas être affichée si `trail_segments` est vide
 * (état vérifié dans `docs/explorer-v2/AUDIT_VERIFIE.md`). On interroge donc la
 * table existante, en lecture publique et sans migration : l'interface dit
 * « aucune donnée » uniquement quand c'est vrai, et ne promet jamais une
 * couche qui n'a rien à dessiner.
 *
 * Aucune géométrie n'est renvoyée ici : seulement la présence d'au moins une
 * ligne. La couche de surface elle-même reste hors de cette tranche, faute de
 * données importées.
 */
export const revalidate = 3_600;

interface Row {
  id: number;
}

async function hasRows(path: string): Promise<boolean> {
  const rows = await pgrest<Row[]>(path, { revalidate: 3_600 });
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET() {
  try {
    const [surface, routes] = await Promise.all([
      hasRows('trail_segments?select=id&limit=1'),
      hasRows('hiking_routes?select=id&limit=1'),
    ]);

    return NextResponse.json(
      {
        surface: {
          available: surface,
          table: 'trail_segments',
          source: 'OpenStreetMap',
          licence: 'ODbL 1.0',
        },
        routes: {
          available: routes,
          table: 'hiking_routes',
          source: 'OpenStreetMap',
          licence: 'ODbL 1.0',
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('[explorer-v2] terrain coverage', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
