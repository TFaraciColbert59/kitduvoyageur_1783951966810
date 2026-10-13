import React from 'react';
import ENTRY_DATA from '@/features/compas/data/entryRequirements.meta.json';
import CURRENCIES_META from '@/features/compas/data/countryCurrencies.meta.json';
import FUEL_META from '@/features/compas/data/fuelPrices.meta.json';
import ICP_META from '@/features/compas/data/icpPriceLevels.meta.json';
import MAINS_META from '@/features/compas/data/mainsElectricity.meta.json';
import { frenchDay } from '@/features/compas/engine/entry';
import { tollSources } from '@/features/compas/engine/tolls';

/**
 * Sources des données et licences (plan 5.3) : chaque service gratuit est
 * crédité comme ses conditions l'exigent (`docs/compas/SERVICES-GRATUITS.md`).
 *
 * Les textes de licence sont ceux lus sur la page officielle du service le
 * 2026-10-10 et relus le 2026-10-11 ; `__tests__/dataSources.test.tsx` les vérifie mot pour mot et
 * relit le code pour prouver que chaque service crédité est réellement employé
 * (on ne crédite pas ce qu'on n'emploie pas). Ce module n'est pas la page :
 * une page Next n'exporte pas d'autre nom que `default` et `metadata`.
 */

/** Le crédit de l'éditeur de la table des papiers, coupé autour de l'adresse du jeu (qui devient un lien). */
const [CREDIT_BEFORE_URL, CREDIT_AFTER_URL] = ENTRY_DATA.credit.split(ENTRY_DATA.url) as [string, string];

export type SourcePart = string | { text: string; href: string };

export interface DataSource {
  label: string;
  parts: SourcePart[];
}

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const GEOAPIFY = 'https://www.geoapify.com/';

/**
 * Les sources des péages et vignettes : prises dans la table elle-même (`engine/tolls.ts`), une fois chacune,
 * avec le jour de lecture. Une source ajoutée à la table est créditée ici sans autre geste.
 */
const TOLL_PARTS: SourcePart[] = tollSources().flatMap((src, i): SourcePart[] => [
  ...(i === 0 ? [] : [' ; ']),
  `${src.name} : `,
  ...src.refs.flatMap((ref, j): SourcePart[] => [...(j === 0 ? [] : [', ']), { text: ref.name, href: ref.url }]),
  ` (lu le ${frenchDay(src.readOn) ?? src.readOn})`,
]);

export const DATA_SOURCES: DataSource[] = [
  {
    label: 'Cartes',
    parts: [
      '© ',
      { text: 'contributeurs OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
      ' (licence ODbL) ; fonds de carte ',
      { text: 'Powered by Esri', href: 'https://www.esri.com/' },
      ' (ArcGIS Location Platform : Esri, TomTom, Garmin, FAO, NOAA, USGS, Maxar, Earthstar Geographics, GIS User Community) ; fond « Plan » des cartes de l’Explorer et du Compas : ',
      // Mention exigée par OpenFreeMap (https://openfreemap.org/, page lue le 2026-10-13) : « OpenFreeMap © OpenMapTiles Data from OpenStreetMap ».
      { text: 'OpenFreeMap', href: 'https://openfreemap.org/' },
      ' ',
      { text: '© OpenMapTiles', href: 'https://www.openmaptiles.org/' },
      ' Data from ',
      { text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
      '.',
    ],
  },
  {
    label: 'Recherche de lieux',
    parts: [
      'Photon (komoot) ; ',
      { text: 'Search by LocationIQ.com', href: 'https://locationiq.com/' },
      ' ; ',
      { text: 'Powered by Geoapify', href: GEOAPIFY },
      ' ; points d’intérêt OpenStreetMap par Overpass (private.coffee).',
    ],
  },
  {
    label: 'Lieux habités, régions et pays',
    parts: [
      { text: 'GeoNames', href: 'https://www.geonames.org/' },
      ' (licence ',
      { text: 'CC BY 4.0', href: CC_BY },
      ' : « This work is licensed under a Creative Commons Attribution 4.0 License », ',
      { text: 'licence des données', href: 'https://download.geonames.org/export/dump/readme.txt' },
      ' ; usage commercial permis, crédit à GeoNames demandé, données fournies « as is »), importées et réduites aux lieux habités.',
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
      { text: 'Powered by Geoapify', href: GEOAPIFY },
      ' ; en secours, Valhalla (',
      { text: 'FOSSGIS e.V.', href: 'https://www.fossgis.de/' },
      ') ; données © contributeurs OpenStreetMap.',
    ],
  },
  {
    label: 'Altitudes',
    parts: [
      { text: 'Terrain Tiles', href: 'https://registry.opendata.aws/terrain-tiles/' },
      ' (Mapzen / AWS Open Data). Les ',
      {
        text: 'attributions exigées par la licence',
        href: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
      },
      ' sont : ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736 ; Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017 ; Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich ; Canada terrain data contains information licensed under the Open Government Licence – Canada ; Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers ; Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration ; Mexico terrain data source: INEGI, Continental relief, 2016 ; New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved) ; Norway terrain data © Kartverket ; United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved ; United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.',
    ],
  },
  {
    label: 'Météo',
    parts: [
      'Prévisions ',
      { text: 'MET Norway', href: 'https://api.met.no/' },
      ' (licence ',
      { text: 'CC BY 4.0', href: CC_BY },
      ') ; tendances : données du projet ',
      { text: 'POWER', href: 'https://power.larc.nasa.gov/' },
      ' du NASA Langley Research Center (LaRC), financé par le programme NASA Earth Science/Applied Science.',
    ],
  },
  {
    label: 'Alertes météo officielles',
    parts: [
      { text: 'EUMETNET – MeteoAlarm', href: 'https://meteoalarm.org/en/live/' },
      ' : alertes des services météorologiques et hydrologiques nationaux d’Europe ; chaque alerte nomme son service national, son heure d’émission, sa période de validité et reprend son texte officiel. Information redistribuée selon des termes équivalents à la licence ',
      { text: 'Creative Commons Attribution 4.0 (CC BY 4.0)', href: CC_BY },
      ', avec les exigences des ',
      {
        text: 'conditions d’utilisation de Meteoalarm',
        href: 'https://meteoalarm.org/en/live/page/terms-and-conditions',
      },
      ' (version du 15/03/2024). Des décalages entre ce site et meteoalarm.org sont possibles ; l’information la plus à jour est celle de meteoalarm.org.',
    ],
  },
  {
    label: 'Taux de change',
    parts: [
      { text: 'Frankfurter', href: 'https://frankfurter.dev/' },
      ' (taux de référence publiés par les banques centrales et sources officielles ; taux de la ',
      {
        text: 'BCE',
        href: 'https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html',
      },
      ' : « Source: ECB statistics. », statistiques reprises sans les modifier) ; en secours, ',
      { text: 'currency-api', href: 'https://github.com/fawazahmed0/exchange-api' },
      ' (CC0). Taux donnés à titre indicatif.',
    ],
  },
  {
    label: 'Carburant',
    parts: [
      'Prix à la pompe de l’UE-27 : ',
      { text: 'Weekly Oil Bulletin', href: FUEL_META.page },
      ', Commission européenne (DG Énergie), licence ',
      { text: 'CC BY 4.0', href: CC_BY },
      ` ; prix du ${FUEL_META.pricesDate}, convertis en euros par litre et arrondis au millième. Hors de l’UE, aucune source gratuite : le prix est une estimation, dite comme telle.`,
    ],
  },
  {
    label: 'Péages et vignettes',
    parts: [
      'Tarifs officiels des vignettes (voiture) et des péages au kilomètre (barème moyen), à titre indicatif et à vérifier avant de partir : ',
      ...TOLL_PARTS,
      '. Un pays dont aucune source officielle n’a pu être lue reste « non chiffré », dit comme tel.',
    ],
  },
  {
    label: 'Niveaux de prix des repas',
    parts: [
      { text: 'The World Bank: ICP 2021', href: ICP_META.page },
      ` (International Comparison Program), indice de niveau de prix (Monde = 100), série « Produits alimentaires et boissons non alcoolisées », année ${ICP_META.year}, mis à jour le ${frenchDay(ICP_META.lastUpdated) ?? ICP_META.lastUpdated}, lu le ${frenchDay(ICP_META.readOn) ?? ICP_META.readOn} (licence `,
      { text: 'CC BY 4.0', href: ICP_META.licenceUrl },
      '). Ramené à la France = 100 et arrondi par le Compas, pour les repas en autonomie ; les autres repas suivent le barème du Compas.',
    ],
  },
  {
    label: 'Prises et courant',
    parts: [
      'Lettres de prise (A à O), tension et fréquence du courant de chaque pays : ',
      { text: MAINS_META.source, href: MAINS_META.page },
      ', révision ',
      { text: String(MAINS_META.revision), href: MAINS_META.revisionUrl },
      ` du ${frenchDay(MAINS_META.revisionDate) ?? MAINS_META.revisionDate}, lue le ${frenchDay(MAINS_META.readOn) ?? MAINS_META.readOn} (`,
      { text: 'liste des auteurs', href: MAINS_META.historyUrl },
      ', licence ',
      { text: MAINS_META.licence, href: MAINS_META.licenceUrl },
      '). Les lettres viennent de l’ancien site « World Plugs » de la ',
      { text: 'CEI (IEC)', href: MAINS_META.primarySourceUrl },
      ', que la CEI a retiré en septembre 2026. Changements : lettres, tensions du foyer et fréquences extraites, notes et normes nationales écartées. Ce jeu dérivé reste sous la même licence (CC BY-SA 4.0). À titre indicatif : la table peut être inexacte, vérifie sur place avant de brancher un appareil.',
    ],
  },
  {
    label: 'Devises des pays',
    parts: [
      'Devise de chaque pays d’après la liste n° 1 de la norme ISO 4217, publiée par ',
      { text: 'SIX', href: 'https://www.six-group.com/en/products-services/financial-information/data-standards.html' },
      ', agence de maintenance de la norme (liste du ',
      CURRENCIES_META.published,
      ').',
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
