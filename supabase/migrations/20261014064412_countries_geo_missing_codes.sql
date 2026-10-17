-- Pays et territoires absents du référentiel `countries_geo` (13 oct. 2026).
--
-- `trips.destination_country_code` référence `countries_geo(iso_a2)` : une destination dans l'un de ces
-- 50 codes ISO 3166-1 était refusée (« 4 jours à Prague » : « Impossible d'enregistrer la destination »,
-- violation 23503). Le Compas contourne déjà côté code (colonne laissée vide, pays gardé dans l'ancre) ;
-- ici le référentiel est complété : la Tchéquie et la Biélorussie (souveraines), et les territoires
-- (outre-mer français, britanniques, néerlandais, américains, danois…) que la carte nomme à part.
--
-- Données seulement : nom français (`name`, comme les autres lignes) et anglais (`name_en`) du
-- référentiel Unicode CLDR, sans géométrie (colonne facultative, `geometry_source` = 'manual' par défaut).
-- Additive et rejouable (ON CONFLICT DO NOTHING) ; aucune policy ni droit modifié.

insert into public.countries_geo (iso_a2, name, name_en, is_sovereign, sources)
values
  ('AI', 'Anguilla', 'Anguilla', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('AS', 'Samoa américaines', 'American Samoa', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('AW', 'Aruba', 'Aruba', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('AX', 'Îles Åland', 'Åland Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('BL', 'Saint-Barthélemy', 'St. Barthélemy', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('BM', 'Bermudes', 'Bermuda', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('BQ', 'Pays-Bas caribéens', 'Caribbean Netherlands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('BY', 'Biélorussie', 'Belarus', true, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('CC', 'Îles Cocos', 'Cocos (Keeling) Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('CK', 'Îles Cook', 'Cook Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('CW', 'Curaçao', 'Curaçao', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('CX', 'Île Christmas', 'Christmas Island', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('CZ', 'Tchéquie', 'Czechia', true, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('EH', 'Sahara occidental', 'Western Sahara', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('FK', 'Îles Malouines', 'Falkland Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('FO', 'Îles Féroé', 'Faroe Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GF', 'Guyane française', 'French Guiana', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GG', 'Guernesey', 'Guernsey', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GI', 'Gibraltar', 'Gibraltar', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GL', 'Groenland', 'Greenland', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GP', 'Guadeloupe', 'Guadeloupe', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GS', 'Géorgie du Sud-et-les Îles Sandwich du Sud', 'South Georgia & South Sandwich Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('GU', 'Guam', 'Guam', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('HK', 'Hong Kong', 'Hong Kong', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('IM', 'Île de Man', 'Isle of Man', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('IO', 'Territoire britannique de l’océan Indien', 'British Indian Ocean Territory', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('JE', 'Jersey', 'Jersey', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('KY', 'Îles Caïmans', 'Cayman Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('MF', 'Saint-Martin', 'St. Martin', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('MO', 'Macao', 'Macao', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('MP', 'Îles Mariannes du Nord', 'Northern Mariana Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('MQ', 'Martinique', 'Martinique', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('MS', 'Montserrat', 'Montserrat', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('NC', 'Nouvelle-Calédonie', 'New Caledonia', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('NF', 'Île Norfolk', 'Norfolk Island', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('PF', 'Polynésie française', 'French Polynesia', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('PM', 'Saint-Pierre-et-Miquelon', 'St. Pierre & Miquelon', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('PN', 'Îles Pitcairn', 'Pitcairn Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('PR', 'Porto Rico', 'Puerto Rico', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('RE', 'La Réunion', 'Réunion', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('SH', 'Sainte-Hélène', 'St. Helena', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('SJ', 'Svalbard et Jan Mayen', 'Svalbard & Jan Mayen', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('SX', 'Saint-Martin (partie néerlandaise)', 'Sint Maarten', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('TC', 'Îles Turques-et-Caïques', 'Turks & Caicos Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('TF', 'Terres australes françaises', 'French Southern Territories', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('TK', 'Tokelau', 'Tokelau', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('VG', 'Îles Vierges britanniques', 'British Virgin Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('VI', 'Îles Vierges des États-Unis', 'U.S. Virgin Islands', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('WF', 'Wallis-et-Futuna', 'Wallis & Futuna', false, 'ISO 3166-1 (noms : Unicode CLDR)'),
  ('YT', 'Mayotte', 'Mayotte', false, 'ISO 3166-1 (noms : Unicode CLDR)')

on conflict (iso_a2) do nothing;
