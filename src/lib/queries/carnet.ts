import { createClient } from '@/lib/supabase/client';
import { CarnetData } from '@/lib/mock/carnet-chartreuse';

export async function getCarnetComplet(carnetId: string): Promise<CarnetData | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(carnetId);

  // Return null immediately if carnetId is not a valid UUID (no title fallback)
  if (!isUuid) {
    return null;
  }

  try {
    const supabase = createClient();

    const { data: carnet, error } = await supabase
      .from('carnets')
      .select('*, groupe:groupes(*)')
      .eq('id', carnetId)
      .maybeSingle();

    if (error || !carnet) {
      return null;
    }

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
    const words = (carnet.title || 'Carnet de voyage').split(' ');
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(' ');
    const line2 = words.slice(half).join(' ');

    // Format jours
    const formattedJours = (etapes && etapes.length > 0) ? etapes.map((e: any) => ({
      id: e.id,
      dayNumber: e.jour_numero || e.ordre,
      label: `JOUR ${e.jour_numero || e.ordre}${e.date_etape ? ` · ${e.date_etape}` : ''}`,
      title: e.lieu_depart ? `${e.lieu_depart} → ` : '',
      titleItalic: e.lieu_arrivee || '',
      recit: e.recit || '',
      stats: [
        { icon: '📏', label: `${e.distance_km || 0} km` },
        { icon: '⛰', label: `${e.denivele_m || 0} m D+` },
        { icon: '🕐', label: e.duree_texte || '4h00' },
        { icon: '☁️', label: `${e.meteo || 'Ciel variable'}${e.temperature_c !== undefined && e.temperature_c !== null ? ` · ${e.temperature_c}°C` : ''}` },
      ],
    })) : [];

    // Format hebergements
    const formattedHebergements = (hebergements && hebergements.length > 0) ? hebergements.map((h: any) => ({
      id: h.id,
      nightNumber: h.apres_jour_numero || 1,
      name: h.nom,
      price: h.prix_cents ? Math.round(h.prix_cents / 100) : 0,
      priceLabel: h.prix_note || 'demi-pension',
      detail: `${h.altitude_m ? `${h.altitude_m} m` : ''}${h.note ? ` · ${h.note}` : ''}${h.hote ? ` · ${h.hote}` : ''}`,
    })) : [];

    // Format moments
    const formattedMoments = (moments && moments.length > 0) ? moments.map((m: any) => ({
      id: m.id,
      label: `JOUR ${m.jour_numero || 1}${m.heure ? ` · ${m.heure}` : ''}`,
      citation: `« ${m.citation} »`,
      author: m.auteur_nom || 'Voyageur',
      location: m.lieu || '',
      imageUrl: m.image_url || undefined,
    })) : [];

    // Format kit items & calculate total weight
    let totalWeightGrams = 0;
    const formattedKitItems = (kitItems && kitItems.length > 0) ? kitItems.map((k: any) => {
      const p = Number(k.poids_g) || 0;
      totalWeightGrams += p;
      return {
        id: k.id,
        name: k.nom,
        detail: k.detail || '',
        weight: p >= 1000 ? `${(p / 1000).toFixed(1).replace('.', ',')} kg` : `${p} g`,
        color: k.couleur_tag || '#33463C',
      };
    }) : [];

    const totalWeightStr = totalWeightGrams >= 1000
      ? `${(totalWeightGrams / 1000).toFixed(2).replace('.', ',')} kg`
      : `${totalWeightGrams} g`;

    // Dynamic kit intro
    // TODO produit: si colonne kit_intro existe en base, l'utiliser en priorité
    const kitIntro = carnet.kit_intro || carnet.equipment_summary || 'Matériel et équipement d\'expédition archivés pour ce voyage.';

    // Format randonnees
    const formattedRandonnees = (etapes && etapes.length > 0) ? etapes.map((e: any) => ({
      id: e.id,
      title: `${e.lieu_depart || 'Étape'} → ${e.lieu_arrivee || ''}`,
      stats: `${e.distance_km || 0} km · ${e.denivele_m || 0} m D+${e.duree_texte ? ` · ${e.duree_texte}` : ''}`,
      badge: e.difficulte || undefined,
    })) : [];

    // Format stats with hidden prop if value is missing/zero/null
    const distanceVal = carnet.distance_km ? `${carnet.distance_km} km` : null;
    const deniveleVal = carnet.denivele_m ? `${carnet.denivele_m} m` : null;
    const nuitsVal = carnet.nb_nuits ? `${carnet.nb_nuits}` : null;
    const momentsVal = moments && moments.length > 0 ? `${moments.length}` : (carnet.likes_count ? `${carnet.likes_count}` : null);
    const photosVal = carnet.views_count ? `${carnet.views_count}` : null;
    const hebergementsVal = formattedHebergements.length > 0 ? `${formattedHebergements.length}` : null;

    return {
      meta: {
        badge: `CARNET OUVERT · ${(carnet.destination || 'EXPÉDITION').toUpperCase()}`,
        titleLine1: line1,
        titleLine2: line2,
        subtitleLine1: carnet.description ? carnet.description.slice(0, 45) + (carnet.description.length > 45 ? '...' : '') : '',
        subtitleLine2: '',
        voyageurs: carnet.nb_voyageurs || 1,
        dateRange: carnet.start_date && carnet.end_date
          ? `${new Date(carnet.start_date).toLocaleDateString('fr-FR')} – ${new Date(carnet.end_date).toLocaleDateString('fr-FR')}`
          : carnet.start_date ? new Date(carnet.start_date).toLocaleDateString('fr-FR') : '',
        itineraire: carnet.lieu_depart && carnet.lieu_arrivee
          ? `${carnet.lieu_depart} → ${carnet.lieu_arrivee}`
          : carnet.destination || '',
      },
      stats: [
        { value: distanceVal || '', label: 'DISTANCE', hidden: !distanceVal },
        { value: deniveleVal || '', label: 'DÉNIVELÉ +', hidden: !deniveleVal },
        { value: nuitsVal || '', label: 'NUITS', hidden: !nuitsVal },
        { value: momentsVal || '', label: 'MOMENTS', hidden: !momentsVal },
        { value: photosVal || '', label: 'PHOTOS', hidden: !photosVal },
        { value: hebergementsVal || '', label: 'HÉBERGEMENTS', sublabel: 'refuges', hidden: !hebergementsVal },
      ],
      jours: formattedJours,
      hebergements: formattedHebergements,
      moments: formattedMoments,
      kit: {
        intro: kitIntro,
        totalWeight: totalWeightStr,
        items: formattedKitItems,
      },
      randonnees: formattedRandonnees,
    };
  } catch (err) {
    console.error('getCarnetComplet error:', err);
    return null;
  }
}
