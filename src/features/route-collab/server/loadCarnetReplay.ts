import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getCarnetDetail } from '@/features/carnet/detail/getCarnetDetail';
import { carnetTraceCoordinates, type CarnetReplayState } from '../carnetReplay';

/**
 * 9.10 : lit le carnet d'où l'on reprend le tracé, avec le client Supabase de la personne (RLS) et par
 * `getCarnetDetail`, donc avec les masques du lecteur (zone de départ, visibilité) : ce module ne lit jamais la
 * colonne `carnets.trace` brute. Le voyage du carnet n'est rendu qu'à son propriétaire.
 */
export async function loadCarnetReplay(carnetId: string): Promise<CarnetReplayState> {
  try {
    const detail = await getCarnetDetail(carnetId);
    if (!detail) return { status: 'not_found' };
    const coordinates = carnetTraceCoordinates(detail.trace);
    if (coordinates.length < 2) return { status: 'no_trace' };
    let tripId: string | null = null;
    if (detail.isOwner) {
      const supabase = await createClient();
      const { data } = await supabase.from('carnets').select('trip_id').eq('id', carnetId).maybeSingle();
      const t = (data as { trip_id?: string | null } | null)?.trip_id;
      tripId = typeof t === 'string' ? t : null;
    }
    return {
      status: 'ok',
      tripId,
      replay: {
        carnetId,
        title: detail.title || 'Carnet',
        coordinates,
        traceMasked: Boolean(detail.traceMasked),
      },
    };
  } catch {
    return { status: 'error' };
  }
}
