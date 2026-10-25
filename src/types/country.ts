// Country data types — shared between API route and client components
// Kept in a separate file so client components can import types
// without pulling in Node.js-only modules (fs, path) from the API route.

export interface CountryDataV2 {
  pays: { nom: string; code_iso: string; continent: string };
  meteo: {
    calendrier_12_mois: {
      mois: string;
      temp_min_c: number;
      temp_max_c: number;
      precipitations_mm: number;
      niveau: 'ideal' | 'bon' | 'moyen' | 'deconseille';
      affluence: 'faible' | 'moyenne' | 'forte';
    }[];
    source: string;
    derniere_maj: string;
  };
  securite: {
    zones: {
      nom_zone: string;
      niveau: 'sur' | 'vigilance' | 'deconseille_sauf_raison_imperative' | 'formellement_deconseille';
      description: string;
    }[];
    source_officielle: { nom: string; url: string };
    derniere_synchronisation: string;
    statut: 'verifie' | 'non_verifie';
    ambassade_consulat: { nom: string; telephone: string; url: string };
  };
  sante: {
    risques: string[];
    vaccins_recommandes: string[];
    vaccins_obligatoires: string[];
    eau_potable: 'oui' | 'non' | 'a_traiter' | 'non_verifie';
    source: string;
    derniere_maj: string;
    statut: 'verifie' | 'non_verifie';
  };
  connectivite: {
    couverture_mobile: 'bonne' | 'moyenne' | 'faible' | 'non_verifie';
    wifi_disponibilite: string;
    statut: 'verifie' | 'estimation';
  };
  pratique: {
    visa: { nationalite: string; regle: string; duree_sejour_sans_visa: string };
    monnaie: string;
    prise_electrique: { type: string; voltage: string };
    langues: string[];
    phrases_survie: { fr: string; locale: string }[];
    decalage_horaire_utc: string;
    budget_quotidien_repere_eur: {
      petit: { logement: number; nourriture: number; transport: number };
      moyen: { logement: number; nourriture: number; transport: number };
      gros: { logement: number; nourriture: number; transport: number };
    };
  };
  vols: {
    tendance_par_saison: { periode: string; niveau_prix: 'bas' | 'moyen' | 'haut' }[];
    statut: 'indicatif';
  };
  carbone: {
    vol_paris_kg_co2_estime: number;
    methodologie: string;
    statut: 'estimation';
  };
  evenements: { nom: string; periode: string; description: string }[];
  lieux_incontournables: { nom: string; description: string; lat: number; lng: number }[];
  coutumes: string;
  kits_recommandes_tags_climat: string[];
  gabarit_poids_recommande: { poids_total_kg: number; justification: string };
  pays_similaires: { code_iso: string; nom: string; raison: string }[];
  faq: { question: string; reponse: string }[];
  meta: { genere_le: string; cache_valide_jusqu_au: string };
}
