import { createClient } from '@/lib/supabase/client';
import { CarnetData } from '@/types/carnet';

function formatDuration(seconds?: number | string | null): string {
  if (!seconds) return '';
  if (typeof seconds === 'string') return seconds;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
  return `${m} min`;
}

export async function getCarnetComplet(carnetId: string): Promise<CarnetData | null> {
  try {
    const supabase = createClient();

    // 1. Fetch main Carnet row
    let { data: carnet } = await supabase
      .from('carnets')
      .select('*, groupe:groupes(*)')
      .eq('id', carnetId)
      .maybeSingle();

    // Fallback lookup: Check if carnetId is actually a hike_sessions id
    if (!carnet) {
      const { data: session } = await supabase
        .from('hike_sessions')
        .select('carnet_id')
        .eq('id', carnetId)
        .maybeSingle();

      if (session?.carnet_id) {
        const { data: linkedCarnet } = await supabase
          .from('carnets')
          .select('*, groupe:groupes(*)')
          .eq('id', session.carnet_id)
          .maybeSingle();
        carnet = linkedCarnet;
      }
    }

    // If still no carnet found in Supabase DB, return null (0 mock fallback!)
    if (!carnet) {
      return null;
    }

    const realCarnetId = carnet.id;
    const realGroupeId = carnet.groupe_id || carnet.groupe?.id;

    // 2. Fetch associated Hike Session (GPS trace, POIs, exact metrics)
    const { data: hikeSession } = await supabase
      .from('hike_sessions')
      .select('*')
      .eq('carnet_id', realCarnetId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    // 3. Fetch related tables in parallel
    const [
      { data: etapes },
      { data: hebergements },
      { data: moments },
      { data: kitItems },
    ] = await Promise.all([
      realGroupeId
        ? supabase.from('groupe_etapes').select('*').eq('groupe_id', realGroupeId).order('ordre', { ascending: true })
        : Promise.resolve({ data: [] }),
      realGroupeId
        ? supabase.from('groupe_hebergements').select('*').eq('groupe_id', realGroupeId).order('apres_jour_numero', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase
        .from('carnet_moments')
        .select('*')
        .eq('carnet_id', realCarnetId)
        .order('jour_numero', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('carnet_kit_items').select('*').eq('carnet_id', realCarnetId).order('sort_order', { ascending: true }),
    ]);

    // Format title
    const fullTitle = carnet.title || carnet.destination || 'Carnet d\'expédition';
    const words = fullTitle.split(' ');
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(' ');
    const line2 = words.slice(half).join(' ');

    // 4. Format Jours (Etapes)
    let formattedJours = (etapes && etapes.length > 0)
      ? etapes.map((e: any) => ({
          id: e.id,
          dayNumber: e.jour_numero || e.ordre || 1,
          label: `JOUR ${e.jour_numero || e.ordre}${e.date_etape ? ` · ${e.date_etape}` : ''}`,
          title: e.lieu_depart ? `${e.lieu_depart} → ` : '',
          titleItalic: e.lieu_arrivee || '',
          recit: e.recit || '',
          stats: [
            { icon: '📏', label: `${e.distance_km || 0} km` },
            { icon: '⛰', label: e.denivele_m ? `${e.denivele_m} m D+` : 'Dénivelé indisponible' },
            { icon: '🕐', label: e.duree_texte || '' },
            { icon: '☁️', label: `${e.meteo || ''}${e.temperature_c !== undefined && e.temperature_c !== null ? ` · ${e.temperature_c}°C` : ''}` },
          ].filter((s) => Boolean(s.label)),
        }))
      : [];

    // Synthesize a factual stage if no groupe_etapes exist but a hike session exists
    if (formattedJours.length === 0 && hikeSession) {
      const dist = hikeSession.distance_km || carnet.distance_km || 0;
      const elev = hikeSession.elevation_gain_m ?? carnet.denivele_m ?? 0;
      const dur = formatDuration(hikeSession.duration_seconds || carnet.duration);

      formattedJours = [
        {
          id: `stage-${hikeSession.id}`,
          dayNumber: 1,
          label: `JOUR 1 · ${new Date(hikeSession.started_at || carnet.created_at).toLocaleDateString('fr-FR')}`,
          title: carnet.lieu_depart ? `${carnet.lieu_depart} → ` : 'Départ → ',
          titleItalic: carnet.lieu_arrivee || 'Arrivée',
          recit: carnet.description || `Expédition outdoor récapitulant ${dist.toFixed(1)} km.`,
          stats: [
            { icon: '📏', label: `${dist.toFixed(1)} km` },
            { icon: '⛰', label: elev > 0 ? `${elev} m D+` : 'Dénivelé indisponible' },
            { icon: '🕐', label: dur || 'Durée non enregistrée' },
          ].filter((s) => Boolean(s.label)),
        },
      ];
    }

    // 5. Format Hebergements (Only real ones, 0 mock)
    const formattedHebergements = (hebergements && hebergements.length > 0)
      ? hebergements.map((h: any) => ({
          id: h.id,
          nightNumber: h.apres_jour_numero || 1,
          name: h.nom,
          price: h.prix_cents ? Math.round(h.prix_cents / 100) : 0,
          priceLabel: h.prix_note || 'demi-pension',
          detail: `${h.altitude_m ? `${h.altitude_m} m` : ''}${h.note ? ` · ${h.note}` : ''}${h.hote ? ` · ${h.hote}` : ''}`,
        }))
      : [];

    // 6. Format Moments (Only real ones)
    const formattedMoments = (moments && moments.length > 0)
      ? moments.map((m: any) => ({
          id: m.id,
          label: `JOUR ${m.jour_numero || 1}${m.heure ? ` · ${m.heure}` : ''}`,
          citation: `« ${m.citation} »`,
          author: m.auteur_nom || 'Randonneur',
          location: m.lieu || '',
          imageUrl: m.image_url || undefined,
        }))
      : [];

    // 7. Format Kit Items & Calculate total weight
    let totalWeightGrams = 0;
    const formattedKitItems = (kitItems && kitItems.length > 0)
      ? kitItems.map((k: any) => {
          const p = Number(k.poids_g) || 0;
          totalWeightGrams += p;
          return {
            id: k.id,
            name: k.nom,
            detail: k.detail || '',
            weight: p >= 1000 ? `${(p / 1000).toFixed(1).replace('.', ',')} kg` : `${p} g`,
            color: k.couleur_tag || '#33463C',
          };
        })
      : [];

    const totalWeightStr = totalWeightGrams > 0
      ? totalWeightGrams >= 1000
        ? `${(totalWeightGrams / 1000).toFixed(2).replace('.', ',')} kg`
        : `${totalWeightGrams} g`
      : '';

    const kitIntro = carnet.kit_intro || carnet.equipment_summary || (formattedKitItems.length > 0 ? 'Matériel embarqué pour cette expédition.' : '');

    // 8. Format Randonnees
    const formattedRandonnees = formattedJours.map((j) => ({
      id: j.id,
      title: `${j.title}${j.titleItalic}`,
      stats: j.stats.map((s) => s.label).join(' · '),
    }));

    // 9. Real Factual Stats (Hidden if missing / zero)
    const realDist = hikeSession?.distance_km || carnet.distance_km;
    const realElev = hikeSession?.elevation_gain_m ?? carnet.denivele_m;
    const realDur = formatDuration(hikeSession?.duration_seconds || carnet.duration);

    const distanceVal = realDist && realDist > 0 ? `${realDist.toFixed(1)} km` : null;
    const deniveleVal = realElev && realElev > 0 ? `${realElev} m D+` : null;
    const dureeVal = realDur || null;
    const momentsVal = formattedMoments.length > 0 ? `${formattedMoments.length}` : null;
    const hebergementsVal = formattedHebergements.length > 0 ? `${formattedHebergements.length}` : null;

    return {
      id: carnet.id,
      meta: {
        badge: `CARNET D'EXPÉDITION · ${(carnet.destination || carnet.title || 'OUTDOOR').toUpperCase()}`,
        titleLine1: line1,
        titleLine2: line2,
        subtitleLine1: carnet.description || '',
        subtitleLine2: '',
        voyageurs: carnet.nb_voyageurs || 1,
        dateRange: carnet.start_date
          ? new Date(carnet.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          : hikeSession?.started_at
          ? new Date(hikeSession.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          : new Date(carnet.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        itineraire: carnet.lieu_depart && carnet.lieu_arrivee
          ? `${carnet.lieu_depart} → ${carnet.lieu_arrivee}`
          : carnet.destination || fullTitle,
      },
      stats: [
        { value: distanceVal || '', label: 'DISTANCE', hidden: !distanceVal },
        { value: deniveleVal || '', label: 'DÉNIVELÉ +', hidden: !deniveleVal },
        { value: dureeVal || '', label: 'DURÉE', hidden: !dureeVal },
        { value: momentsVal || '', label: 'MOMENTS', hidden: !momentsVal },
        { value: hebergementsVal || '', label: 'HÉBERGEMENTS', sublabel: 'refuges', hidden: !hebergementsVal },
      ].filter((s) => !s.hidden),
      jours: formattedJours,
      hebergements: formattedHebergements,
      moments: formattedMoments,
      kit: {
        intro: kitIntro,
        totalWeight: totalWeightStr,
        items: formattedKitItems,
      },
      randonnees: formattedRandonnees,
      traceGeojson: hikeSession?.positions_geojson || null,
      hikeSessionId: hikeSession?.id,
      poiEvents: hikeSession?.poi_events || [],
    };
  } catch (err) {
    console.error('[getCarnetComplet] Error fetching real carnet data:', err);
    return null;
  }
}
