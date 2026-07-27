import { createClient } from '@/lib/supabase/client';
import { mockCarnetChartreuse, CarnetData } from '@/lib/mock/carnet-chartreuse';

export async function getCarnetComplet(carnetId: string): Promise<CarnetData> {
  try {
    const supabase = createClient();

    let query = supabase.from('carnets').select('*, groupe:groupes(*)');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(carnetId);

    if (isUuid) {
      query = query.eq('id', carnetId);
    } else {
      query = query.eq('title', 'Trois jours dans la Chartreuse');
    }

    const { data: carnet } = await query.single();
    if (!carnet) return mockCarnetChartreuse;

    const realCarnetId = carnet.id;
    const realGroupeId = carnet.groupe_id || carnet.groupe?.id;

    // Fetch related tables in parallel
    const [
      { data: etapes },
      { data: hebergements },
      { data: moments },
      { data: kitItems },
    ] = await Promise.all([
      realGroupeId ? supabase.from('groupe_etapes').select('*').eq('groupe_id', realGroupeId).order('ordre', { ascending: true }) : Promise.resolve({ data: [] }),
      realGroupeId ? supabase.from('groupe_hebergements').select('*').eq('groupe_id', realGroupeId).order('apres_jour_numero', { ascending: true }) : Promise.resolve({ data: [] }),
      supabase.from('carnet_moments').select('*').eq('carnet_id', realCarnetId).order('jour_numero', { ascending: true }),
      supabase.from('carnet_kit_items').select('*').eq('carnet_id', realCarnetId).order('sort_order', { ascending: true }),
    ]);

    // Format title
    const words = (carnet.title || '').split(' ');
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(' ') || 'Trois jours dans';
    const line2 = words.slice(half).join(' ') || 'la Chartreuse,';

    // Format jours
    const formattedJours = (etapes && etapes.length > 0) ? etapes.map((e: any) => ({
      id: e.id,
      dayNumber: e.jour_numero || e.ordre,
      label: `JOUR ${e.jour_numero || e.ordre} · ${e.date_etape || ''}`,
      title: `${e.lieu_depart || ''} → `,
      titleItalic: e.lieu_arrivee || '',
      recit: e.recit || '',
      stats: [
        { icon: '📏', label: `${e.distance_km || 0} km` },
        { icon: '⛰', label: `${e.denivele_m || 0} m D+` },
        { icon: '🕐', label: e.duree_texte || '4h00' },
        { icon: '☁️', label: `${e.meteo || 'Ciel variable'} · ${e.temperature_c || 12}°C` },
      ],
    })) : mockCarnetChartreuse.jours;

    // Format hebergements
    const formattedHebergements = (hebergements && hebergements.length > 0) ? hebergements.map((h: any) => ({
      id: h.id,
      nightNumber: h.apres_jour_numero,
      name: h.nom,
      price: Math.round((h.prix_cents || 4800) / 100),
      priceLabel: h.prix_note || 'par personne, demi-pension',
      detail: `${h.altitude_m || 2100} m · ${h.note || ''} · ${h.hote || ''}`,
    })) : mockCarnetChartreuse.hebergements;

    // Format moments
    const formattedMoments = (moments && moments.length > 0) ? moments.map((m: any) => ({
      id: m.id,
      label: `JOUR ${m.jour_numero} · ${m.heure || ''}`,
      citation: `« ${m.citation} »`,
      author: m.auteur_nom || 'Voyageur',
      location: m.lieu || '',
      imageUrl: m.image_url || undefined,
    })) : mockCarnetChartreuse.moments;

    // Format kit items
    const formattedKitItems = (kitItems && kitItems.length > 0) ? kitItems.map((k: any) => ({
      id: k.id,
      name: k.nom,
      detail: k.detail || '',
      weight: k.poids_g >= 1000 ? `${(k.poids_g / 1000).toFixed(1)} kg` : `${k.poids_g} g`,
      color: k.couleur_tag || '#33463C',
    })) : mockCarnetChartreuse.kit.items;

    // Format randonnees
    const formattedRandonnees = (etapes && etapes.length > 0) ? etapes.map((e: any) => ({
      id: e.id,
      title: `${e.lieu_depart} → ${e.lieu_arrivee}`,
      stats: `${e.distance_km} km · ${e.denivele_m} m D+ · ${e.duree_texte || '4h'}`,
      badge: e.difficulte || undefined,
    })) : mockCarnetChartreuse.randonnees;

    return {
      meta: {
        badge: `CARNET OUVERT · ${carnet.destination?.toUpperCase() || 'TRAVERSÉE'} · AUTOMNE 2026`,
        titleLine1: line1,
        titleLine2: line2,
        subtitleLine1: carnet.description ? carnet.description.slice(0, 35) + '...' : mockCarnetChartreuse.meta.subtitleLine1,
        subtitleLine2: mockCarnetChartreuse.meta.subtitleLine2,
        voyageurs: carnet.nb_voyageurs || 6,
        dateRange: carnet.start_date && carnet.end_date 
          ? `${new Date(carnet.start_date).toLocaleDateString('fr-FR')} – ${new Date(carnet.end_date).toLocaleDateString('fr-FR')}`
          : mockCarnetChartreuse.meta.dateRange,
        itineraire: `${carnet.lieu_depart || 'Saint-Pierre'} → ${carnet.lieu_arrivee || 'Charmette'}`,
      },
      stats: [
        { value: `${carnet.distance_km || 27.4} km`, label: 'DISTANCE' },
        { value: `${carnet.denivele_m || 1620} m`, label: 'DÉNIVELÉ +' },
        { value: `${carnet.nb_nuits || 2}`, label: 'NUITS' },
        { value: `${carnet.likes_count || 14}`, label: 'MOMENTS' },
        { value: `${carnet.views_count || 62}`, label: 'PHOTOS' },
        { value: `${formattedHebergements.length}`, label: 'HÉBERGEMENTS', sublabel: 'refuges' },
      ],
      jours: formattedJours,
      hebergements: formattedHebergements,
      moments: formattedMoments,
      kit: {
        intro: 'Sac 45L configuré pour l\'expédition — chargement optimisé.',
        totalWeight: '2,98 kg',
        items: formattedKitItems,
      },
      randonnees: formattedRandonnees,
    };
  } catch (err) {
    console.error('getCarnetComplet error:', err);
    return mockCarnetChartreuse;
  }
}
