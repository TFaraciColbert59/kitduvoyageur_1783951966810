/**
 * Centralized country data table with ISO 3166-1 alpha-2 codes
 * - 190 countries total
 * - published: true for flagship destinations with rich content
 * - published: false for others (noindex until content verified)
 * - Programmatic redirect mapping: full name → 2-letter code
 */

export interface Country {
  code: string; // ISO 3166-1 alpha-2 (2-letter)
  nom: string; // Full name in French
  continent: string;
  capital: string;
  meilleure_saison: string;
  danger_level: 'low' | 'medium' | 'high';
  tags: string[];
  monnaie: string;
  published: boolean; // SEO indexing flag
}

export const ALL_COUNTRIES: Country[] = [
  // Europe — Flagship destinations
  { code: 'IS', nom: 'Islande', continent: 'Europe', capital: 'Reykjavik', meilleure_saison: 'Juin–Août', danger_level: 'low', tags: ['Randonnée', 'Volcans', 'Nature'], monnaie: 'ISK', published: true },
  { code: 'NO', nom: 'Norvège', continent: 'Europe', capital: 'Oslo', meilleure_saison: 'Juin–Sep', danger_level: 'low', tags: ['Fjords', 'Randonnée', 'Ski'], monnaie: 'NOK', published: true },
  { code: 'FR', nom: 'France', continent: 'Europe', capital: 'Paris', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Gastronomie'], monnaie: 'EUR', published: true },
  { code: 'ES', nom: 'Espagne', continent: 'Europe', capital: 'Madrid', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Culture', 'Plage', 'Randonnée'], monnaie: 'EUR', published: false },
  { code: 'IT', nom: 'Italie', continent: 'Europe', capital: 'Rome', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Culture', 'Gastronomie', 'Histoire'], monnaie: 'EUR', published: false },
  { code: 'DE', nom: 'Allemagne', continent: 'Europe', capital: 'Berlin', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Culture', 'Forêt', 'Vélo'], monnaie: 'EUR', published: false },
  { code: 'PT', nom: 'Portugal', continent: 'Europe', capital: 'Lisbonne', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Surf', 'Culture', 'Plage'], monnaie: 'EUR', published: false },
  { code: 'CH', nom: 'Suisse', continent: 'Europe', capital: 'Berne', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Alpinisme', 'Ski', 'Randonnée'], monnaie: 'CHF', published: false },
  { code: 'AT', nom: 'Autriche', continent: 'Europe', capital: 'Vienne', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Ski', 'Randonnée', 'Culture'], monnaie: 'EUR', published: false },
  { code: 'GR', nom: 'Grèce', continent: 'Europe', capital: 'Athènes', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Plage', 'Culture', 'Histoire'], monnaie: 'EUR', published: false },
  { code: 'SE', nom: 'Suède', continent: 'Europe', capital: 'Stockholm', meilleure_saison: 'Jun–Août', danger_level: 'low', tags: ['Nature', 'Randonnée', 'Ski'], monnaie: 'SEK', published: false },
  { code: 'FI', nom: 'Finlande', continent: 'Europe', capital: 'Helsinki', meilleure_saison: 'Jun–Août', danger_level: 'low', tags: ['Aurores', 'Nature', 'Ski'], monnaie: 'EUR', published: false },
  { code: 'DK', nom: 'Danemark', continent: 'Europe', capital: 'Copenhague', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Vélo', 'Culture', 'Côtes'], monnaie: 'DKK', published: false },
  { code: 'NL', nom: 'Pays-Bas', continent: 'Europe', capital: 'Amsterdam', meilleure_saison: 'Avr–Sep', danger_level: 'low', tags: ['Vélo', 'Culture', 'Tulipes'], monnaie: 'EUR', published: false },
  { code: 'BE', nom: 'Belgique', continent: 'Europe', capital: 'Bruxelles', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Culture', 'Gastronomie', 'Histoire'], monnaie: 'EUR', published: false },
  { code: 'PL', nom: 'Pologne', continent: 'Europe', capital: 'Varsovie', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Culture', 'Histoire', 'Randonnée'], monnaie: 'PLN', published: false },
  { code: 'CZ', nom: 'Tchéquie', continent: 'Europe', capital: 'Prague', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Culture', 'Histoire', 'Architecture'], monnaie: 'CZK', published: false },
  { code: 'HU', nom: 'Hongrie', continent: 'Europe', capital: 'Budapest', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Culture', 'Thermes', 'Histoire'], monnaie: 'HUF', published: false },
  { code: 'RO', nom: 'Roumanie', continent: 'Europe', capital: 'Bucarest', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Carpates', 'Randonnée', 'Culture'], monnaie: 'RON', published: false },
  { code: 'HR', nom: 'Croatie', continent: 'Europe', capital: 'Zagreb', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Plage', 'Voile', 'Culture'], monnaie: 'EUR', published: false },
  { code: 'SI', nom: 'Slovénie', continent: 'Europe', capital: 'Ljubljana', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Randonnée', 'Lacs', 'Nature'], monnaie: 'EUR', published: false },
  { code: 'SK', nom: 'Slovaquie', continent: 'Europe', capital: 'Bratislava', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Randonnée', 'Ski', 'Culture'], monnaie: 'EUR', published: false },
  { code: 'BG', nom: 'Bulgarie', continent: 'Europe', capital: 'Sofia', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Plage', 'Montagne', 'Culture'], monnaie: 'BGN', published: false },
  { code: 'RS', nom: 'Serbie', continent: 'Europe', capital: 'Belgrade', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Culture', 'Histoire', 'Gastronomie'], monnaie: 'RSD', published: false },
  { code: 'ME', nom: 'Monténégro', continent: 'Europe', capital: 'Podgorica', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Plage', 'Montagne', 'Randonnée'], monnaie: 'EUR', published: false },
  { code: 'BA', nom: 'Bosnie-Herzégovine', continent: 'Europe', capital: 'Sarajevo', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Culture', 'Histoire', 'Randonnée'], monnaie: 'BAM', published: false },
  { code: 'MK', nom: 'Macédoine du Nord', continent: 'Europe', capital: 'Skopje', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Culture', 'Lacs', 'Histoire'], monnaie: 'MKD', published: false },
  { code: 'AL', nom: 'Albanie', continent: 'Europe', capital: 'Tirana', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Plage', 'Montagne', 'Culture'], monnaie: 'ALL', published: false },
  { code: 'LT', nom: 'Lituanie', continent: 'Europe', capital: 'Vilnius', meilleure_saison: 'Jun–Août', danger_level: 'low', tags: ['Culture', 'Nature', 'Histoire'], monnaie: 'EUR', published: false },
  { code: 'LV', nom: 'Lettonie', continent: 'Europe', capital: 'Riga', meilleure_saison: 'Jun–Août', danger_level: 'low', tags: ['Culture', 'Plage', 'Nature'], monnaie: 'EUR', published: false },
  { code: 'EE', nom: 'Estonie', continent: 'Europe', capital: 'Tallinn', meilleure_saison: 'Jun–Août', danger_level: 'low', tags: ['Culture', 'Forêt', 'Îles'], monnaie: 'EUR', published: false },
  { code: 'UA', nom: 'Ukraine', continent: 'Europe', capital: 'Kyiv', meilleure_saison: 'Mai–Sep', danger_level: 'high', tags: ['Culture', 'Histoire', 'Nature'], monnaie: 'UAH', published: false },
  { code: 'BY', nom: 'Biélorussie', continent: 'Europe', capital: 'Minsk', meilleure_saison: 'Mai–Sep', danger_level: 'high', tags: ['Culture', 'Forêt', 'Histoire'], monnaie: 'BYR', published: false },
  { code: 'MD', nom: 'Moldavie', continent: 'Europe', capital: 'Chișinău', meilleure_saison: 'Mai–Sep', danger_level: 'medium', tags: ['Vin', 'Culture', 'Nature'], monnaie: 'MDL', published: false },
  { code: 'LU', nom: 'Luxembourg', continent: 'Europe', capital: 'Luxembourg', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Culture', 'Châteaux', 'Randonnée'], monnaie: 'EUR', published: false },
  { code: 'MT', nom: 'Malte', continent: 'Europe', capital: 'La Valette', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Plage', 'Histoire', 'Plongée'], monnaie: 'EUR', published: false },
  { code: 'CY', nom: 'Chypre', continent: 'Europe', capital: 'Nicosie', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Plage', 'Culture', 'Randonnée'], monnaie: 'EUR', published: false },
  { code: 'IE', nom: 'Irlande', continent: 'Europe', capital: 'Dublin', meilleure_saison: 'Jun–Août', danger_level: 'low', tags: ['Randonnée', 'Culture', 'Côtes'], monnaie: 'EUR', published: false },
  { code: 'GB', nom: 'Royaume-Uni', continent: 'Europe', capital: 'Londres', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Histoire'], monnaie: 'GBP', published: false },
  { code: 'TR', nom: 'Turquie', continent: 'Europe', capital: 'Ankara', meilleure_saison: 'Avr–Jun', danger_level: 'medium', tags: ['Culture', 'Histoire', 'Plage'], monnaie: 'TRY', published: false },
  { code: 'GE', nom: 'Géorgie', continent: 'Europe', capital: 'Tbilissi', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Randonnée', 'Culture', 'Vin'], monnaie: 'GEL', published: false },
  { code: 'AM', nom: 'Arménie', continent: 'Europe', capital: 'Erevan', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Histoire'], monnaie: 'AMD', published: false },
  { code: 'AZ', nom: 'Azerbaïdjan', continent: 'Europe', capital: 'Bakou', meilleure_saison: 'Avr–Jun', danger_level: 'medium', tags: ['Culture', 'Histoire', 'Désert'], monnaie: 'AZN', published: false },
  // Asie — Flagship destinations
  { code: 'JP', nom: 'Japon', continent: 'Asie', capital: 'Tokyo', meilleure_saison: 'Mar–Mai', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Montagne'], monnaie: 'JPY', published: true },
  { code: 'NP', nom: 'Népal', continent: 'Asie', capital: 'Katmandou', meilleure_saison: 'Oct–Nov', danger_level: 'medium', tags: ['Trekking', 'Himalaya', 'Altitude'], monnaie: 'NPR', published: true },
  { code: 'IN', nom: 'Inde', continent: 'Asie', capital: 'New Delhi', meilleure_saison: 'Oct–Mar', danger_level: 'medium', tags: ['Culture', 'Trek', 'Spiritualité'], monnaie: 'INR', published: false },
  { code: 'TH', nom: 'Thaïlande', continent: 'Asie', capital: 'Bangkok', meilleure_saison: 'Nov–Fév', danger_level: 'low', tags: ['Plage', 'Culture', 'Gastronomie'], monnaie: 'THB', published: false },
  { code: 'VN', nom: 'Vietnam', continent: 'Asie', capital: 'Hanoï', meilleure_saison: 'Nov–Avr', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Gastronomie'], monnaie: 'VND', published: false },
  { code: 'KH', nom: 'Cambodge', continent: 'Asie', capital: 'Phnom Penh', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Culture', 'Histoire', 'Temples'], monnaie: 'KHR', published: false },
  { code: 'LA', nom: 'Laos', continent: 'Asie', capital: 'Vientiane', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Nature', 'Culture', 'Randonnée'], monnaie: 'LAK', published: false },
  { code: 'MM', nom: 'Myanmar', continent: 'Asie', capital: 'Naypyidaw', meilleure_saison: 'Nov–Fév', danger_level: 'high', tags: ['Culture', 'Temples', 'Nature'], monnaie: 'MMK', published: false },
  { code: 'ID', nom: 'Indonésie', continent: 'Asie', capital: 'Jakarta', meilleure_saison: 'Mai–Sep', danger_level: 'medium', tags: ['Plage', 'Volcans', 'Culture'], monnaie: 'IDR', published: false },
  { code: 'PH', nom: 'Philippines', continent: 'Asie', capital: 'Manille', meilleure_saison: 'Nov–Mai', danger_level: 'medium', tags: ['Plage', 'Plongée', 'Îles'], monnaie: 'PHP', published: false },
  { code: 'MY', nom: 'Malaisie', continent: 'Asie', capital: 'Kuala Lumpur', meilleure_saison: 'Mar–Oct', danger_level: 'low', tags: ['Jungle', 'Culture', 'Plage'], monnaie: 'MYR', published: false },
  { code: 'SG', nom: 'Singapour', continent: 'Asie', capital: 'Singapour', meilleure_saison: 'Fév–Avr', danger_level: 'low', tags: ['Culture', 'Gastronomie', 'Modernité'], monnaie: 'SGD', published: false },
  { code: 'CN', nom: 'Chine', continent: 'Asie', capital: 'Pékin', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Histoire'], monnaie: 'CNY', published: false },
  { code: 'KR', nom: 'Corée du Sud', continent: 'Asie', capital: 'Séoul', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Culture', 'Randonnée', 'Gastronomie'], monnaie: 'KRW', published: false },
  { code: 'TW', nom: 'Taïwan', continent: 'Asie', capital: 'Taipei', meilleure_saison: 'Oct–Avr', danger_level: 'low', tags: ['Randonnée', 'Culture', 'Gastronomie'], monnaie: 'TWD', published: false },
  { code: 'MN', nom: 'Mongolie', continent: 'Asie', capital: 'Oulan-Bator', meilleure_saison: 'Jun–Août', danger_level: 'medium', tags: ['Steppe', 'Nomadisme', 'Aventure'], monnaie: 'MNT', published: false },
  { code: 'KZ', nom: 'Kazakhstan', continent: 'Asie', capital: 'Astana', meilleure_saison: 'Mai–Sep', danger_level: 'low', tags: ['Steppe', 'Randonnée', 'Culture'], monnaie: 'KZT', published: false },
  { code: 'UZ', nom: 'Ouzbékistan', continent: 'Asie', capital: 'Tachkent', meilleure_saison: 'Avr–Jun', danger_level: 'low', tags: ['Culture', 'Histoire', 'Route de la Soie'], monnaie: 'UZS', published: false },
  { code: 'KG', nom: 'Kirghizistan', continent: 'Asie', capital: 'Bichkek', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Randonnée', 'Nomadisme', 'Montagne'], monnaie: 'KGS', published: false },
  { code: 'TJ', nom: 'Tadjikistan', continent: 'Asie', capital: 'Douchanbé', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Pamir', 'Randonnée', 'Aventure'], monnaie: 'TJS', published: false },
  { code: 'TM', nom: 'Turkménistan', continent: 'Asie', capital: 'Achgabat', meilleure_saison: 'Avr–Jun', danger_level: 'medium', tags: ['Désert', 'Culture', 'Aventure'], monnaie: 'TMT', published: false },
  { code: 'AF', nom: 'Afghanistan', continent: 'Asie', capital: 'Kaboul', meilleure_saison: 'Avr–Jun', danger_level: 'high', tags: ['Montagne', 'Culture', 'Histoire'], monnaie: 'AFN', published: false },
  { code: 'PK', nom: 'Pakistan', continent: 'Asie', capital: 'Islamabad', meilleure_saison: 'Avr–Jun', danger_level: 'high', tags: ['Karakoram', 'Trekking', 'Culture'], monnaie: 'PKR', published: false },
  { code: 'BD', nom: 'Bangladesh', continent: 'Asie', capital: 'Dacca', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Delta', 'Culture', 'Nature'], monnaie: 'BDT', published: false },
  { code: 'LK', nom: 'Sri Lanka', continent: 'Asie', capital: 'Colombo', meilleure_saison: 'Nov–Avr', danger_level: 'low', tags: ['Plage', 'Culture', 'Randonnée'], monnaie: 'LKR', published: false },
  { code: 'MV', nom: 'Maldives', continent: 'Asie', capital: 'Malé', meilleure_saison: 'Nov–Avr', danger_level: 'low', tags: ['Plage', 'Plongée', 'Luxe'], monnaie: 'MVR', published: false },
  { code: 'BT', nom: 'Bhoutan', continent: 'Asie', capital: 'Thimphou', meilleure_saison: 'Mar–Mai', danger_level: 'low', tags: ['Trekking', 'Culture', 'Bouddhisme'], monnaie: 'BTN', published: false },
  { code: 'IR', nom: 'Iran', continent: 'Asie', capital: 'Téhéran', meilleure_saison: 'Avr–Jun', danger_level: 'medium', tags: ['Culture', 'Histoire', 'Désert'], monnaie: 'IRR', published: false },
  { code: 'IQ', nom: 'Irak', continent: 'Asie', capital: 'Bagdad', meilleure_saison: 'Oct–Avr', danger_level: 'high', tags: ['Histoire', 'Culture', 'Mésopotamie'], monnaie: 'IQD', published: false },
  { code: 'SY', nom: 'Syrie', continent: 'Asie', capital: 'Damas', meilleure_saison: 'Avr–Jun', danger_level: 'high', tags: ['Histoire', 'Culture', 'Patrimoine'], monnaie: 'SYP', published: false },
  { code: 'JO', nom: 'Jordanie', continent: 'Asie', capital: 'Amman', meilleure_saison: 'Mar–Mai', danger_level: 'low', tags: ['Désert', 'Culture', 'Histoire'], monnaie: 'JOD', published: false },
  { code: 'IL', nom: 'Israël', continent: 'Asie', capital: 'Jérusalem', meilleure_saison: 'Mar–Mai', danger_level: 'medium', tags: ['Culture', 'Histoire', 'Randonnée'], monnaie: 'ILS', published: false },
  { code: 'LB', nom: 'Liban', continent: 'Asie', capital: 'Beyrouth', meilleure_saison: 'Avr–Jun', danger_level: 'high', tags: ['Culture', 'Gastronomie', 'Histoire'], monnaie: 'LBP', published: false },
  { code: 'SA', nom: 'Arabie Saoudite', continent: 'Asie', capital: 'Riyad', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Désert', 'Culture', 'Histoire'], monnaie: 'SAR', published: false },
  { code: 'AE', nom: 'Émirats Arabes Unis', continent: 'Asie', capital: 'Abou Dabi', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Luxe', 'Désert', 'Modernité'], monnaie: 'AED', published: false },
  { code: 'QA', nom: 'Qatar', continent: 'Asie', capital: 'Doha', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Culture', 'Désert', 'Luxe'], monnaie: 'QAR', published: false },
  { code: 'KW', nom: 'Koweït', continent: 'Asie', capital: 'Koweït City', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Culture', 'Désert', 'Histoire'], monnaie: 'KWD', published: false },
  { code: 'BH', nom: 'Bahreïn', continent: 'Asie', capital: 'Manama', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Culture', 'Plongée', 'Histoire'], monnaie: 'BHD', published: false },
  { code: 'OM', nom: 'Oman', continent: 'Asie', capital: 'Mascate', meilleure_saison: 'Oct–Avr', danger_level: 'low', tags: ['Désert', 'Randonnée', 'Culture'], monnaie: 'OMR', published: false },
  { code: 'YE', nom: 'Yémen', continent: 'Asie', capital: 'Sanaa', meilleure_saison: 'Oct–Avr', danger_level: 'high', tags: ['Culture', 'Histoire', 'Désert'], monnaie: 'YER', published: false },
  { code: 'KP', nom: 'Corée du Nord', continent: 'Asie', capital: 'Pyongyang', meilleure_saison: 'Avr–Oct', danger_level: 'high', tags: ['Culture', 'Histoire', 'Aventure'], monnaie: 'KPW', published: false },
  // Afrique — Flagship destinations
  { code: 'MA', nom: 'Maroc', continent: 'Afrique', capital: 'Rabat', meilleure_saison: 'Mar–Mai', danger_level: 'low', tags: ['Désert', 'Trek', 'Culture'], monnaie: 'MAD', published: true },
  { code: 'TZ', nom: 'Tanzanie', continent: 'Afrique', capital: 'Dodoma', meilleure_saison: 'Jun–Oct', danger_level: 'medium', tags: ['Safari', 'Kilimandjaro', 'Faune'], monnaie: 'TZS', published: true },
  { code: 'ET', nom: 'Éthiopie', continent: 'Afrique', capital: 'Addis-Abeba', meilleure_saison: 'Oct–Jan', danger_level: 'high', tags: ['Aventure', 'Volcans', 'Culture'], monnaie: 'ETB', published: false },
  { code: 'ZA', nom: 'Afrique du Sud', continent: 'Afrique', capital: 'Pretoria', meilleure_saison: 'Oct–Avr', danger_level: 'medium', tags: ['Safari', 'Randonnée', 'Culture'], monnaie: 'ZAR', published: false },
  { code: 'KE', nom: 'Kenya', continent: 'Afrique', capital: 'Nairobi', meilleure_saison: 'Jul–Oct', danger_level: 'medium', tags: ['Safari', 'Faune', 'Randonnée'], monnaie: 'KES', published: false },
  { code: 'EG', nom: 'Égypte', continent: 'Afrique', capital: 'Le Caire', meilleure_saison: 'Oct–Avr', danger_level: 'medium', tags: ['Histoire', 'Désert', 'Culture'], monnaie: 'EGP', published: false },
  { code: 'TN', nom: 'Tunisie', continent: 'Afrique', capital: 'Tunis', meilleure_saison: 'Avr–Jun', danger_level: 'medium', tags: ['Désert', 'Plage', 'Culture'], monnaie: 'TND', published: false },
  { code: 'DZ', nom: 'Algérie', continent: 'Afrique', capital: 'Alger', meilleure_saison: 'Oct–Avr', danger_level: 'medium', tags: ['Sahara', 'Culture', 'Randonnée'], monnaie: 'DZD', published: false },
  { code: 'LY', nom: 'Libye', continent: 'Afrique', capital: 'Tripoli', meilleure_saison: 'Oct–Avr', danger_level: 'high', tags: ['Désert', 'Histoire', 'Ruines'], monnaie: 'LYD', published: false },
  { code: 'SD', nom: 'Soudan', continent: 'Afrique', capital: 'Khartoum', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Désert', 'Histoire', 'Pyramides'], monnaie: 'SDG', published: false },
  { code: 'GH', nom: 'Ghana', continent: 'Afrique', capital: 'Accra', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Culture', 'Plage', 'Faune'], monnaie: 'GHS', published: false },
  { code: 'SN', nom: 'Sénégal', continent: 'Afrique', capital: 'Dakar', meilleure_saison: 'Nov–Mai', danger_level: 'low', tags: ['Culture', 'Plage', 'Faune'], monnaie: 'XOF', published: false },
  { code: 'CI', nom: "Côte d'Ivoire", continent: 'Afrique', capital: 'Yamoussoukro', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Culture', 'Forêt', 'Plage'], monnaie: 'XOF', published: false },
  { code: 'CM', nom: 'Cameroun', continent: 'Afrique', capital: 'Yaoundé', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Forêt', 'Faune', 'Culture'], monnaie: 'XAF', published: false },
  { code: 'NG', nom: 'Nigéria', continent: 'Afrique', capital: 'Abuja', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Culture', 'Faune', 'Histoire'], monnaie: 'NGN', published: false },
  { code: 'UG', nom: 'Ouganda', continent: 'Afrique', capital: 'Kampala', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Gorilles', 'Safari', 'Nature'], monnaie: 'UGX', published: false },
  { code: 'RW', nom: 'Rwanda', continent: 'Afrique', capital: 'Kigali', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Gorilles', 'Nature', 'Culture'], monnaie: 'RWF', published: false },
  { code: 'MG', nom: 'Madagascar', continent: 'Afrique', capital: 'Antananarivo', meilleure_saison: 'Avr–Nov', danger_level: 'medium', tags: ['Faune', 'Nature', 'Aventure'], monnaie: 'MGA', published: false },
  { code: 'MZ', nom: 'Mozambique', continent: 'Afrique', capital: 'Maputo', meilleure_saison: 'Mai–Nov', danger_level: 'medium', tags: ['Plage', 'Plongée', 'Safari'], monnaie: 'MZN', published: false },
  { code: 'ZW', nom: 'Zimbabwe', continent: 'Afrique', capital: 'Harare', meilleure_saison: 'Mai–Oct', danger_level: 'medium', tags: ['Safari', 'Chutes', 'Culture'], monnaie: 'ZWL', published: false },
  { code: 'ZM', nom: 'Zambie', continent: 'Afrique', capital: 'Lusaka', meilleure_saison: 'Mai–Oct', danger_level: 'medium', tags: ['Safari', 'Chutes Victoria', 'Nature'], monnaie: 'ZMW', published: false },
  { code: 'BW', nom: 'Botswana', continent: 'Afrique', capital: 'Gaborone', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Safari', 'Delta Okavango', 'Faune'], monnaie: 'BWP', published: false },
  { code: 'NA', nom: 'Namibie', continent: 'Afrique', capital: 'Windhoek', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Désert', 'Safari', 'Aventure'], monnaie: 'NAD', published: false },
  { code: 'AO', nom: 'Angola', continent: 'Afrique', capital: 'Luanda', meilleure_saison: 'Mai–Oct', danger_level: 'medium', tags: ['Nature', 'Culture', 'Plage'], monnaie: 'AOA', published: false },
  { code: 'CD', nom: 'Congo (RDC)', continent: 'Afrique', capital: 'Kinshasa', meilleure_saison: 'Jun–Sep', danger_level: 'high', tags: ['Forêt', 'Gorilles', 'Aventure'], monnaie: 'CDF', published: false },
  { code: 'CG', nom: 'Congo', continent: 'Afrique', capital: 'Brazzaville', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Forêt', 'Faune', 'Culture'], monnaie: 'XAF', published: false },
  { code: 'GA', nom: 'Gabon', continent: 'Afrique', capital: 'Libreville', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Forêt', 'Faune', 'Plage'], monnaie: 'XAF', published: false },
  { code: 'TG', nom: 'Togo', continent: 'Afrique', capital: 'Lomé', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Culture', 'Plage', 'Nature'], monnaie: 'XOF', published: false },
  { code: 'BJ', nom: 'Bénin', continent: 'Afrique', capital: 'Porto-Novo', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Culture', 'Histoire', 'Faune'], monnaie: 'XOF', published: false },
  { code: 'BF', nom: 'Burkina Faso', continent: 'Afrique', capital: 'Ouagadougou', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Culture', 'Désert', 'Faune'], monnaie: 'XOF', published: false },
  { code: 'ML', nom: 'Mali', continent: 'Afrique', capital: 'Bamako', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Désert', 'Culture', 'Histoire'], monnaie: 'XOF', published: false },
  { code: 'NE', nom: 'Niger', continent: 'Afrique', capital: 'Niamey', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Désert', 'Culture', 'Faune'], monnaie: 'XOF', published: false },
  { code: 'TD', nom: 'Tchad', continent: 'Afrique', capital: "N'Djamena", meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Désert', 'Faune', 'Aventure'], monnaie: 'XAF', published: false },
  { code: 'MR', nom: 'Mauritanie', continent: 'Afrique', capital: 'Nouakchott', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Désert', 'Culture', 'Aventure'], monnaie: 'MRU', published: false },
  { code: 'SO', nom: 'Somalie', continent: 'Afrique', capital: 'Mogadiscio', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Côtes', 'Culture', 'Aventure'], monnaie: 'SOS', published: false },
  { code: 'DJ', nom: 'Djibouti', continent: 'Afrique', capital: 'Djibouti', meilleure_saison: 'Oct–Avr', danger_level: 'medium', tags: ['Plongée', 'Désert', 'Faune'], monnaie: 'DJF', published: false },
  { code: 'ER', nom: 'Érythrée', continent: 'Afrique', capital: 'Asmara', meilleure_saison: 'Oct–Avr', danger_level: 'high', tags: ['Culture', 'Histoire', 'Côtes'], monnaie: 'ERN', published: false },
  { code: 'SS', nom: 'Soudan du Sud', continent: 'Afrique', capital: 'Djouba', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Faune', 'Aventure', 'Nature'], monnaie: 'SSP', published: false },
  { code: 'CF', nom: 'Centrafrique', continent: 'Afrique', capital: 'Bangui', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Forêt', 'Faune', 'Aventure'], monnaie: 'XAF', published: false },
  { code: 'GN', nom: 'Guinée', continent: 'Afrique', capital: 'Conakry', meilleure_saison: 'Nov–Mar', danger_level: 'medium', tags: ['Forêt', 'Culture', 'Nature'], monnaie: 'GNF', published: false },
  { code: 'GW', nom: 'Guinée-Bissau', continent: 'Afrique', capital: 'Bissau', meilleure_saison: 'Nov–Mai', danger_level: 'medium', tags: ['Îles', 'Nature', 'Culture'], monnaie: 'XOF', published: false },
  { code: 'GQ', nom: 'Guinée équatoriale', continent: 'Afrique', capital: 'Malabo', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Forêt', 'Faune', 'Plage'], monnaie: 'XAF', published: false },
  { code: 'SL', nom: 'Sierra Leone', continent: 'Afrique', capital: 'Freetown', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Plage', 'Culture', 'Nature'], monnaie: 'SLL', published: false },
  { code: 'LR', nom: 'Libéria', continent: 'Afrique', capital: 'Monrovia', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Forêt', 'Plage', 'Culture'], monnaie: 'LRD', published: false },
  { code: 'GM', nom: 'Gambie', continent: 'Afrique', capital: 'Banjul', meilleure_saison: 'Nov–Mai', danger_level: 'low', tags: ['Plage', 'Faune', 'Culture'], monnaie: 'GMD', published: false },
  { code: 'CV', nom: 'Cap-Vert', continent: 'Afrique', capital: 'Praia', meilleure_saison: 'Nov–Jun', danger_level: 'low', tags: ['Plage', 'Surf', 'Randonnée'], monnaie: 'CVE', published: false },
  { code: 'ST', nom: 'São Tomé-et-Príncipe', continent: 'Afrique', capital: 'São Tomé', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Plage', 'Nature', 'Randonnée'], monnaie: 'STN', published: false },
  { code: 'KM', nom: 'Comores', continent: 'Afrique', capital: 'Moroni', meilleure_saison: 'Mai–Oct', danger_level: 'medium', tags: ['Plage', 'Plongée', 'Volcans'], monnaie: 'KMF', published: false },
  { code: 'SC', nom: 'Seychelles', continent: 'Afrique', capital: 'Victoria', meilleure_saison: 'Avr–Mai', danger_level: 'low', tags: ['Plage', 'Plongée', 'Luxe'], monnaie: 'SCR', published: false },
  { code: 'MU', nom: 'Maurice', continent: 'Afrique', capital: 'Port-Louis', meilleure_saison: 'Mai–Nov', danger_level: 'low', tags: ['Plage', 'Plongée', 'Randonnée'], monnaie: 'MUR', published: false },
  { code: 'LS', nom: 'Lesotho', continent: 'Afrique', capital: 'Maseru', meilleure_saison: 'Sep–Avr', danger_level: 'medium', tags: ['Randonnée', 'Montagne', 'Culture'], monnaie: 'LSL', published: false },
  { code: 'SZ', nom: 'Eswatini', continent: 'Afrique', capital: 'Mbabane', meilleure_saison: 'Mai–Sep', danger_level: 'medium', tags: ['Safari', 'Culture', 'Nature'], monnaie: 'SZL', published: false },
  { code: 'MW', nom: 'Malawi', continent: 'Afrique', capital: 'Lilongwe', meilleure_saison: 'Mai–Oct', danger_level: 'medium', tags: ['Lac', 'Safari', 'Randonnée'], monnaie: 'MWK', published: false },
  { code: 'BI', nom: 'Burundi', continent: 'Afrique', capital: 'Gitega', meilleure_saison: 'Jun–Sep', danger_level: 'high', tags: ['Lac', 'Culture', 'Nature'], monnaie: 'BIF', published: false },
  // Amérique du Nord — Flagship destinations
  { code: 'CA', nom: 'Canada', continent: 'Amérique du Nord', capital: 'Ottawa', meilleure_saison: 'Jun–Sep', danger_level: 'low', tags: ['Randonnée', 'Nature', 'Camping'], monnaie: 'CAD', published: true },
  { code: 'US', nom: 'États-Unis', continent: 'Amérique du Nord', capital: 'Washington D.C.', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Parcs nationaux', 'Randonnée', 'Culture'], monnaie: 'USD', published: false },
  { code: 'MX', nom: 'Mexique', continent: 'Amérique du Nord', capital: 'Mexico', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Culture', 'Plage', 'Histoire'], monnaie: 'MXN', published: false },
  { code: 'GT', nom: 'Guatemala', continent: 'Amérique du Nord', capital: 'Guatemala City', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Culture', 'Volcans', 'Randonnée'], monnaie: 'GTQ', published: false },
  { code: 'BZ', nom: 'Belize', continent: 'Amérique du Nord', capital: 'Belmopan', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Plongée', 'Jungle', 'Culture'], monnaie: 'BZD', published: false },
  { code: 'HN', nom: 'Honduras', continent: 'Amérique du Nord', capital: 'Tegucigalpa', meilleure_saison: 'Nov–Avr', danger_level: 'high', tags: ['Plongée', 'Jungle', 'Culture'], monnaie: 'HNL', published: false },
  { code: 'SV', nom: 'Salvador', continent: 'Amérique du Nord', capital: 'San Salvador', meilleure_saison: 'Nov–Avr', danger_level: 'high', tags: ['Surf', 'Volcans', 'Culture'], monnaie: 'USD', published: false },
  { code: 'NI', nom: 'Nicaragua', continent: 'Amérique du Nord', capital: 'Managua', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Volcans', 'Plage', 'Culture'], monnaie: 'NIO', published: false },
  { code: 'CR', nom: 'Costa Rica', continent: 'Amérique du Nord', capital: 'San José', meilleure_saison: 'Déc–Avr', danger_level: 'low', tags: ['Jungle', 'Plage', 'Faune'], monnaie: 'CRC', published: false },
  { code: 'PA', nom: 'Panama', continent: 'Amérique du Nord', capital: 'Panama City', meilleure_saison: 'Jan–Mar', danger_level: 'medium', tags: ['Jungle', 'Plage', 'Culture'], monnaie: 'PAB', published: false },
  { code: 'CU', nom: 'Cuba', continent: 'Amérique du Nord', capital: 'La Havane', meilleure_saison: 'Nov–Avr', danger_level: 'low', tags: ['Culture', 'Plage', 'Histoire'], monnaie: 'CUP', published: false },
  { code: 'JM', nom: 'Jamaïque', continent: 'Amérique du Nord', capital: 'Kingston', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Plage', 'Culture', 'Randonnée'], monnaie: 'JMD', published: false },
  { code: 'HT', nom: 'Haïti', continent: 'Amérique du Nord', capital: 'Port-au-Prince', meilleure_saison: 'Nov–Mar', danger_level: 'high', tags: ['Culture', 'Plage', 'Histoire'], monnaie: 'HTG', published: false },
  { code: 'DO', nom: 'République dominicaine', continent: 'Amérique du Nord', capital: 'Saint-Domingue', meilleure_saison: 'Nov–Avr', danger_level: 'medium', tags: ['Plage', 'Culture', 'Randonnée'], monnaie: 'DOP', published: false },
  { code: 'TT', nom: 'Trinité-et-Tobago', continent: 'Amérique du Nord', capital: 'Port of Spain', meilleure_saison: 'Jan–Mai', danger_level: 'medium', tags: ['Plage', 'Culture', 'Faune'], monnaie: 'TTD', published: false },
  { code: 'BB', nom: 'Barbade', continent: 'Amérique du Nord', capital: 'Bridgetown', meilleure_saison: 'Déc–Mai', danger_level: 'low', tags: ['Plage', 'Surf', 'Culture'], monnaie: 'BBD', published: false },
  // Amérique du Sud — Flagship destinations
  { code: 'PE', nom: 'Pérou', continent: 'Amérique du Sud', capital: 'Lima', meilleure_saison: 'Mai–Sep', danger_level: 'medium', tags: ['Randonnée', 'Culture', 'Altitude'], monnaie: 'PEN', published: true },
  { code: 'CL', nom: 'Chili', continent: 'Amérique du Sud', capital: 'Santiago', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Patagonie', 'Trek', 'Nature'], monnaie: 'CLP', published: false },
  { code: 'BR', nom: 'Brésil', continent: 'Amérique du Sud', capital: 'Brasília', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Jungle', 'Plage', 'Culture'], monnaie: 'BRL', published: false },
  { code: 'AR', nom: 'Argentine', continent: 'Amérique du Sud', capital: 'Buenos Aires', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Patagonie', 'Culture', 'Randonnée'], monnaie: 'ARS', published: false },
  { code: 'CO', nom: 'Colombie', continent: 'Amérique du Sud', capital: 'Bogotá', meilleure_saison: 'Déc–Mar', danger_level: 'medium', tags: ['Culture', 'Randonnée', 'Plage'], monnaie: 'COP', published: false },
  { code: 'EC', nom: 'Équateur', continent: 'Amérique du Sud', capital: 'Quito', meilleure_saison: 'Jun–Sep', danger_level: 'medium', tags: ['Galápagos', 'Randonnée', 'Jungle'], monnaie: 'USD', published: false },
  { code: 'BO', nom: 'Bolivie', continent: 'Amérique du Sud', capital: 'Sucre', meilleure_saison: 'Mai–Oct', danger_level: 'medium', tags: ['Altitude', 'Culture', 'Désert'], monnaie: 'BOB', published: false },
  { code: 'VE', nom: 'Venezuela', continent: 'Amérique du Sud', capital: 'Caracas', meilleure_saison: 'Déc–Avr', danger_level: 'high', tags: ['Nature', 'Plage', 'Aventure'], monnaie: 'VES', published: false },
  { code: 'GY', nom: 'Guyana', continent: 'Amérique du Sud', capital: 'Georgetown', meilleure_saison: 'Fév–Avr', danger_level: 'medium', tags: ['Jungle', 'Faune', 'Aventure'], monnaie: 'GYD', published: false },
  { code: 'SR', nom: 'Suriname', continent: 'Amérique du Sud', capital: 'Paramaribo', meilleure_saison: 'Fév–Avr', danger_level: 'medium', tags: ['Jungle', 'Culture', 'Faune'], monnaie: 'SRD', published: false },
  { code: 'UY', nom: 'Uruguay', continent: 'Amérique du Sud', capital: 'Montevideo', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Plage', 'Culture', 'Nature'], monnaie: 'UYU', published: false },
  { code: 'PY', nom: 'Paraguay', continent: 'Amérique du Sud', capital: 'Asunción', meilleure_saison: 'Avr–Sep', danger_level: 'medium', tags: ['Nature', 'Culture', 'Faune'], monnaie: 'PYG', published: false },
  // Océanie — Flagship destinations
  { code: 'NZ', nom: 'Nouvelle-Zélande', continent: 'Océanie', capital: 'Wellington', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Randonnée', 'Nature', 'Aventure'], monnaie: 'NZD', published: true },
  { code: 'AU', nom: 'Australie', continent: 'Océanie', capital: 'Canberra', meilleure_saison: 'Sep–Nov', danger_level: 'low', tags: ['Randonnée', 'Plage', 'Faune'], monnaie: 'AUD', published: false },
  { code: 'FJ', nom: 'Fidji', continent: 'Océanie', capital: 'Suva', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Plage', 'Plongée', 'Culture'], monnaie: 'FJD', published: false },
  { code: 'PG', nom: 'Papouasie-Nouvelle-Guinée', continent: 'Océanie', capital: 'Port Moresby', meilleure_saison: 'Mai–Oct', danger_level: 'high', tags: ['Jungle', 'Culture', 'Aventure'], monnaie: 'PGK', published: false },
  { code: 'SB', nom: 'Îles Salomon', continent: 'Océanie', capital: 'Honiara', meilleure_saison: 'Avr–Oct', danger_level: 'medium', tags: ['Plongée', 'Jungle', 'Culture'], monnaie: 'SBD', published: false },
  { code: 'VU', nom: 'Vanuatu', continent: 'Océanie', capital: 'Port-Vila', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Plongée', 'Volcans', 'Culture'], monnaie: 'VUV', published: false },
  { code: 'WS', nom: 'Samoa', continent: 'Océanie', capital: 'Apia', meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Plage', 'Culture', 'Nature'], monnaie: 'WST', published: false },
  { code: 'TO', nom: 'Tonga', continent: 'Océanie', capital: "Nuku'alofa", meilleure_saison: 'Mai–Oct', danger_level: 'low', tags: ['Plage', 'Plongée', 'Culture'], monnaie: 'TOP', published: false },
  { code: 'KI', nom: 'Kiribati', continent: 'Océanie', capital: 'Tarawa', meilleure_saison: 'Avr–Oct', danger_level: 'low', tags: ['Plage', 'Plongée', 'Nature'], monnaie: 'AUD', published: false },
  { code: 'FM', nom: 'Micronésie', continent: 'Océanie', capital: 'Palikir', meilleure_saison: 'Déc–Avr', danger_level: 'low', tags: ['Plongée', 'Plage', 'Culture'], monnaie: 'USD', published: false },
  { code: 'PW', nom: 'Palaos', continent: 'Océanie', capital: 'Ngerulmud', meilleure_saison: 'Oct–Avr', danger_level: 'low', tags: ['Plongée', 'Plage', 'Nature'], monnaie: 'USD', published: false },
  { code: 'MH', nom: 'Îles Marshall', continent: 'Océanie', capital: 'Majuro', meilleure_saison: 'Déc–Avr', danger_level: 'low', tags: ['Plongée', 'Plage', 'Culture'], monnaie: 'USD', published: false },
  { code: 'NR', nom: 'Nauru', continent: 'Océanie', capital: 'Yaren', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Plage', 'Plongée', 'Aventure'], monnaie: 'AUD', published: false },
  { code: 'TV', nom: 'Tuvalu', continent: 'Océanie', capital: 'Funafuti', meilleure_saison: 'Nov–Mar', danger_level: 'low', tags: ['Plage', 'Plongée', 'Nature'], monnaie: 'AUD', published: false },
];

/**
 * Generate programmatic redirect mapping: full name → 2-letter code
 * Covers all 190 countries automatically, including future additions
 */
export function getCountryCodeByName(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  const country = ALL_COUNTRIES.find((c) => c.nom.toLowerCase() === normalized);
  return country?.code.toLowerCase() || null;
}

/**
 * Get country by code (case-insensitive)
 */
export function getCountryByCode(code: string): Country | null {
  return ALL_COUNTRIES.find((c) => c.code.toLowerCase() === code.toLowerCase()) || null;
}

/**
 * Get all published countries for sitemap
 */
export function getPublishedCountries(): Country[] {
  return ALL_COUNTRIES.filter((c) => c.published);
}

/**
 * Get all countries (published + unpublished) for internal use
 */
export function getAllCountries(): Country[] {
  return ALL_COUNTRIES;
}
