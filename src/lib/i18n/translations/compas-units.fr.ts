/**
 * Espace de noms `compas.units` (PLAN-100 6.3) : les gabarits qui écrivaient l'unité en dur
 * (« {m} m », « {capacity} kg », « 0 °C ») ont ici une variante qui reçoit la valeur DÉJÀ
 * formatée avec son unité. Elle ne sert que pour une grandeur affichée en impérial
 * (mi, ft, lb, °F) : en métrique, le Compas garde le gabarit d'origine, au caractère près.
 * Branché dans `compas.fr.ts` ; les clés se lisent `compas.units.…`.
 */
export const compasUnitsFr = {
  units: {
    /** Profil d'altitude, lecteur d'écran : « 6 890 ft à 3,1 mi ». */
    atPoint: '{altitude} à {distance}',
    maxMin: 'Altitude maximale {max}, minimale {min} ({source})',
    away: 'à {distance}',
    freezingAt: '{temp} à {altitude}',
    carriesOf: 'porte {weight} sur {capacity}',
    ofCapacity: 'sur {capacity}',
    distanceTrack: 'à {distance} du tracé',
    distanceStage: 'à {distance} de l’étape',
    waterRule:
      'Repère courant : {perHour} par heure de marche, {perHourHot} au-delà de {temp} (prévision du jour). Une source OpenStreetMap peut être tarie : à vérifier avant de compter dessus.',
  },
} as const;
