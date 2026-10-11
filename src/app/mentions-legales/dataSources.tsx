import React from 'react';
import ENTRY_DATA from '@/features/compas/data/entryRequirements.meta.json';

/** Le crédit de l'éditeur de la table des papiers, coupé autour de l'adresse du jeu (qui devient un lien). */
const [CREDIT_BEFORE_URL, CREDIT_AFTER_URL] = ENTRY_DATA.credit.split(ENTRY_DATA.url) as [string, string];

/**
 * Sources des données et licences (plan 5.3) : chaque service gratuit est
 * crédité comme ses conditions l'exigent (`docs/compas/SERVICES-GRATUITS.md`).
 */
export const DATA_SOURCES: Array<{ label: string; parts: Array<string | { text: string; href: string }> }> = [
  {
    label: 'Cartes',
    parts: [
      '© ',
      { text: 'contributeurs OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
      ' (licence ODbL) ; fonds de carte ',
      { text: 'Powered by Esri', href: 'https://www.esri.com/' },
      ' (ArcGIS Location Platform : Esri, TomTom, Garmin, FAO, NOAA, USGS, Maxar, Earthstar Geographics, GIS User Community).',
    ],
  },
  {
    label: 'Recherche de lieux',
    parts: [
      'Photon (komoot) ; ',
      { text: 'Search by LocationIQ.com', href: 'https://locationiq.com/' },
      ' ; ',
      { text: 'Powered by Geoapify', href: 'https://www.geoapify.com/' },
      ' ; points d’intérêt OpenStreetMap par Overpass (private.coffee).',
    ],
  },
  {
    label: 'Lieux habités, régions et pays',
    parts: [
      { text: 'GeoNames', href: 'https://www.geonames.org/' },
      ' (licence ',
      { text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
      '), données importées et réduites aux lieux habités.',
    ],
  },
  {
    label: 'Aéroports',
    parts: [
      { text: 'OurAirports', href: 'https://ourairports.com/data/' },
      ' (domaine public) : aéroports à vols réguliers, pour estimer un vol d’aéroport à aéroport.',
    ],
  },
  {
    label: 'Papiers d’entrée',
    parts: [
      // Crédit exact donné par l'éditeur (jeu v1.3.0, CC BY 4.0) : même texte que `entryRequirements.meta.json`.
      CREDIT_BEFORE_URL,
      { text: ENTRY_DATA.url, href: ENTRY_DATA.url },
      CREDIT_AFTER_URL,
      '. Exigences d’entrée par passeport et destination, à titre indicatif : à confirmer auprès du service officiel avant de partir.',
    ],
  },
  {
    label: 'Calcul d’itinéraires',
    parts: [
      { text: 'Powered by Geoapify', href: 'https://www.geoapify.com/' },
      ' ; en secours, Valhalla (',
      { text: 'FOSSGIS e.V.', href: 'https://www.fossgis.de/' },
      ') ; données © contributeurs OpenStreetMap ; altitudes Terrain Tiles (AWS Open Data).',
    ],
  },
  {
    label: 'Météo',
    parts: [
      'Prévisions ',
      { text: 'MET Norway', href: 'https://api.met.no/' },
      ' (licence ',
      { text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
      ') ; tendances : données du projet ',
      { text: 'POWER', href: 'https://power.larc.nasa.gov/' },
      ' du NASA Langley Research Center (LaRC), financé par le programme NASA Earth Science/Applied Science.',
    ],
  },
  {
    label: 'Taux de change',
    parts: [
      { text: 'Frankfurter', href: 'https://frankfurter.dev/' },
      ' (taux de référence publiés par les banques centrales et sources officielles ; taux de la ',
      { text: 'BCE', href: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html' },
      ' : « Source: ECB statistics. ») ; en secours, ',
      { text: 'currency-api', href: 'https://github.com/fawazahmed0/exchange-api' },
      ' (CC0). Taux donnés à titre indicatif.',
    ],
  },
];

export function DataSources({ linkClass }: { linkClass: string }) {
  return (
    <>
      {DATA_SOURCES.map((source) => (
        <p key={source.label} className="mb-2">
          <strong>{source.label} :</strong>{' '}
          {source.parts.map((part, i) =>
            typeof part === 'string' ? (
              <React.Fragment key={i}>{part}</React.Fragment>
            ) : (
              <a key={i} href={part.href} className={linkClass} target="_blank" rel="noopener noreferrer">
                {part.text}
              </a>
            )
          )}
        </p>
      ))}
    </>
  );
}
