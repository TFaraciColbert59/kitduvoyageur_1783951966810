-- ============================================================
-- Phase 2 — Seed de référence pays (countries_geo)
-- Base : Natural Earth 1:50m (administrative_units + populated_places)
-- + capitales GeoNames (geoname_id) — aucun mock, toutes les
-- coordonnées proviennent de sources officielles réelles.
--
-- Politique : ZÉRO MOCK. Les champs non connus restent NULL ;
-- les colonnes avec DEFAULT restent à leur valeur par défaut.
--
-- Idempotent : peut être rejoué sans erreur (ON CONFLICT DO UPDATE
-- sur iso_a2, la contrainte unique existante).
-- ============================================================

-- ── 1. Helper de normalisation (recherche insensible aux accents) ──
-- Nécessaire pour les index trigramme insensibles aux accents.
CREATE OR REPLACE FUNCTION public.unaccent_lower(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(translate(
    $1,
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyy'
  ));
$$;

-- Helper partagé : normalisation insensible aux accents
-- (défini en Phase 2, migration 20260811000000_geodata_phase2_schema.sql).
-- Ce seed est rejouable : on supprime l'index trigramme créé par une
-- exécution précédente pour le recréer après le refresh des données.
DROP INDEX IF EXISTS idx_place_names_geo_name_unaccent_trgm;

-- Index trigramme insensible aux accents sur les noms alternatifs.
CREATE INDEX IF NOT EXISTS idx_place_names_geo_name_unaccent_trgm
  ON public.place_names_geo
  USING GIN (public.unaccent_lower(name) gin_trgm_ops);

-- ── 2. Seed countries_geo (197 entrées ISO A2 uniques, dont Kosovo) ──
-- Colonnes remplies : id (généré), iso_a2, name, continent,
--   capital, currency, population, geometry (POINT capitale),
--   geoname_id, iso_a3, iso_numeric, fips_code, tld, phone_code,
--   currency_code, currency_name, postal_code_format,
--   postal_code_regex, languages, neighbours, area_km2,
--   name_ascii, name_en, name_short, geometry_source,
--   is_sovereign.
-- Les capitales (geoname_id, lat, lon) proviennent de GeoNames
-- countryInfo.txt. La géométrie POINT est la capitale réelle,
-- jamais inventée.

INSERT INTO public.countries_geo (
  iso_a2, name, continent, capital, currency, population,
  geometry, geoname_id, iso_a3, iso_numeric, fips_code, tld,
  phone_code, currency_code, currency_name, postal_code_format,
  postal_code_regex, languages, neighbours, area_km2, name_ascii,
  name_en, name_short, geometry_source, is_sovereign
)
VALUES
  ('AD','Andorre','EU','Andorre-la-Vieille','EUR',77006,ST_SetSRID(ST_MakePoint(1.5167,42.5),4326),3041565,'AND','020','AN','.ad','+376','EUR','Euro','AD###','^(?:AD)*(\d{3})$','{ca}','{ES,FR}',468,'Andorra','Andorra','Andorre','geonames',true),
  ('AE','Émirats arabes unis','AS','Abou Dabi','AED',9630959,ST_SetSRID(ST_MakePoint(54.3667,24.4667),4326),292969,'ARE','784','AE','.ae','+971','AED','Dirham','','','{ar-AE,fa,en,hi,ur}','{OM,SA}',83600,'United Arab Emirates','United Arab Emirates','Émirats arabes unis','geonames',true),
  ('AF','Afghanistan','AS','Kaboul','AFN',38928346,ST_SetSRID(ST_MakePoint(69.1667,34.5167),4326),1138958,'AFG','004','AF','.af','+93','AFN','Afghani','','','{fa,ps}','{CN,IR,PK,TJ,TM,UZ}',652230,'Afghanistan','Afghanistan','Afghanistan','geonames',true),
  ('AG','Antigua-et-Barbuda','NA','Saint John''s','XCD',97928,ST_SetSRID(ST_MakePoint(-61.85,17.1167),4326),3576022,'ATG','028','AC','.ag','+1268','XCD','Dollar','','','{en}','{none}',442,'Antigua and Barbuda','Antigua and Barbuda','Antigua-et-Barbuda','geonames',true),
  ('AL','Albanie','EU','Tirana','ALL',2877797,ST_SetSRID(ST_MakePoint(19.8167,41.3167),4326),3183875,'ALB','008','AL','.al','+355','ALL','Lek','','','{sq,el}','{GR,ME,MK,RS}',28748,'Albania','Albania','Albanie','geonames',true),
  ('AM','Arménie','AS','Erevan','AMD',2963243,ST_SetSRID(ST_MakePoint(44.5,40.1833),4326),616052,'ARM','051','AM','.am','+374','AMD','Dram','','','{hy,ru}','{AZ,GE,IR,TR}',29743,'Armenia','Armenia','Arménie','geonames',true),
  ('AO','Angola','AF','Luanda','AOA',32866272,ST_SetSRID(ST_MakePoint(13.2333,-8.8333),4326),2240449,'AGO','024','AO','.ao','+244','AOA','Kwanza','','','{pt}','{CD,CG,NA,ZM}',1246700,'Angola','Angola','Angola','geonames',true),
  ('AR','Argentine','SA','Buenos Aires','ARS',45195774,ST_SetSRID(ST_MakePoint(-58.3833,-34.5833),4326),3435919,'ARG','032','AR','.ar','+54','ARS','Peso','','','{es-AR,en,it,de,fr,gn}','{BO,BR,CL,PY,UY}',2780400,'Argentina','Argentina','Argentine','geonames',true),
  ('AT','Autriche','EU','Vienne','EUR',8917205,ST_SetSRID(ST_MakePoint(16.3667,48.2),4326),2761369,'AUT','040','AU','.at','+43','EUR','Euro','','','{de-AT}','{CZ,DE,CH,IT,LI,HU,SK,SI}',83871,'Austria','Austria','Autriche','geonames',true),
  ('AU','Australie','OC','Canberra','AUD',25499884,ST_SetSRID(ST_MakePoint(149.1333,-35.2833),4326),2177471,'AUS','036','AS','.au','+61','AUD','Dollar','','','{en-AU}','{none}',7692024,'Australia','Australia','Australie','geonames',true),
  ('AZ','Azerbaïdjan','AS','Bakou','AZN',10139177,ST_SetSRID(ST_MakePoint(49.8667,40.3833),4326),587084,'AZE','031','AJ','.az','+994','AZN','Manat','','','{az,ru,hy}','{AM,GE,IR,RU,TR}',86600,'Azerbaijan','Azerbaijan','Azerbaïdjan','geonames',true),
  ('BA','Bosnie-Herzégovine','EU','Sarajevo','BAM',3280819,ST_SetSRID(ST_MakePoint(18.3833,43.85),4326),3191281,'BIH','070','BK','.ba','+387','BAM','Convertible Mark','','','{bs,hr,sr}','{HR,ME,RS}',51197,'Bosnia and Herzegovina','Bosnia and Herzegovina','Bosnie-Herzégovine','geonames',true),
  ('BB','Barbade','NA','Bridgetown','BBD',287375,ST_SetSRID(ST_MakePoint(-59.6167,13.1),4326),3374084,'BRB','052','BB','.bb','+1246','BBD','Dollar','','','{en}','{none}',430,'Barbados','Barbados','Barbade','geonames',true),
  ('BD','Bangladesh','AS','Dacca','BDT',164689383,ST_SetSRID(ST_MakePoint(90.4,23.7167),4326),1185241,'BGD','050','BG','.bd','+880','BDT','Taka','','','{bn}','{IN,MM}',147570,'Bangladesh','Bangladesh','Bangladesh','geonames',true),
  ('BE','Belgique','EU','Bruxelles','EUR',11589623,ST_SetSRID(ST_MakePoint(4.3333,50.8333),4326),2800866,'BEL','056','BE','.be','+32','EUR','Euro','','','{nl-BE,fr-BE,de-BE}','{FR,DE,LU,NL}',30528,'Belgium','Belgium','Belgique','geonames',true),
  ('BF','Burkina Faso','AF','Ouagadougou','XOF',20903273,ST_SetSRID(ST_MakePoint(-1.5167,12.3667),4326),2357048,'BFA','854','UV','.bf','+226','XOF','CFA Franc','','','{fr-BF}','{BJ,GH,CI,ML,NE,TG}',272967,'Burkina Faso','Burkina Faso','Burkina Faso','geonames',true),
  ('BG','Bulgarie','EU','Sofia','BGN',6948445,ST_SetSRID(ST_MakePoint(23.3167,42.6833),4326),727011,'BGR','100','BU','.bg','+359','BGN','Lev','','','{bg,tr-BG}','{GR,MK,RO,RS,TR}',110879,'Bulgaria','Bulgaria','Bulgarie','geonames',true),
  ('BH','Bahreïn','AS','Manama','BHD',1701575,ST_SetSRID(ST_MakePoint(50.5833,26.2167),4326),290291,'BHR','048','BA','.bh','+973','BHD','Dinar','','','{ar-BH,en,fa,ur}','{none}',765,'Bahrain','Bahrain','Bahreïn','geonames',true),
  ('BI','Burundi','AF','Gitega','BIF',11890784,ST_SetSRID(ST_MakePoint(29.9333,-3.4333),4326),433561,'BDI','108','BY','.bi','+257','BIF','Franc','','','{fr-BI,rn}','{CD,RW,TZ}',27834,'Burundi','Burundi','Burundi','geonames',true),
  ('BN','Brunei','AS','Bandar Seri Begawan','BND',437483,ST_SetSRID(ST_MakePoint(114.9333,4.8833),4326),1820814,'BRN','096','BX','.bn','+673','BND','Dollar','','','{ms-BN}','{MY}',5765,'Brunei','Brunei','Brunei','geonames',true),
  ('BJ','Bénin','AF','Porto-Novo','XOF',12123198,ST_SetSRID(ST_MakePoint(2.6167,6.4833),4326),2392087,'BEN','204','BN','.bj','+229','XOF','CFA Franc','','','{fr-BJ}','{BF,NE,NG,TG}',112622,'Benin','Benin','Bénin','geonames',true),
  ('BO','Bolivie','SA','Sucre','BOB',11673021,ST_SetSRID(ST_MakePoint(-65.25,-19.0333),4326),3919096,'BOL','068','BL','.bo','+591','BOB','Boliviano','','','{es-BO,qu,ay}','{AR,BR,CL,PY,PE}',1098581,'Bolivia','Bolivia','Bolivie','geonames',true),
  ('BR','Brésil','SA','Brasilia','BRL',211049527,ST_SetSRID(ST_MakePoint(-47.9167,-15.7833),4326),3469034,'BRA','076','BR','.br','+55','BRL','Real','','','{pt-BR,es,en,fr}','{AR,BO,CO,GF,GY,PY,PE,SR,UY,VE}',8515770,'Brazil','Brazil','Brésil','geonames',true),
  ('BS','Bahamas','NA','Nassau','BSD',393244,ST_SetSRID(ST_MakePoint(-77.35,25.0667),4326),3571824,'BHS','044','BF','.bs','+1242','BSD','Dollar','','','{en}','{none}',13880,'Bahamas','Bahamas','Bahamas','geonames',true),
  ('BT','Bhoutan','AS','Thimphou','BTN',771612,ST_SetSRID(ST_MakePoint(89.6333,27.4667),4326),1252416,'BTN','064','BT','.bt','+975','BTN','Ngultrum','','','{dz}','{CN,IN}',38394,'Bhutan','Bhutan','Bhoutan','geonames',true),
  ('BW','Botswana','AF','Gaborone','BWP',2351627,ST_SetSRID(ST_MakePoint(25.9167,-24.65),4326),933860,'BWA','072','BC','.bw','+267','BWP','Pula','','','{en-BW,tn-BW}','{NA,ZA,ZM,ZW}',581730,'Botswana','Botswana','Botswana','geonames',true),
  ('BY','Biélorussie','EU','Minsk','BYN',9449323,ST_SetSRID(ST_MakePoint(27.5667,53.9),4326),625144,'BLR','112','BO','.by','+375','BYN','Belarusian Ruble','','','{be,ru}','{LV,LT,PL,RU,UA}',207600,'Belarus','Belarus','Biélorussie','geonames',true),
  ('BZ','Belize','NA','Belmopan','BZD',397621,ST_SetSRID(ST_MakePoint(-88.7667,17.25),4326),3582672,'BLZ','084','BH','.bz','+501','BZD','Dollar','','','{en-BZ,es}','{GT,MX}',22966,'Belize','Belize','Belize','geonames',true),
  ('CA','Canada','NA','Ottawa','CAD',37742154,ST_SetSRID(ST_MakePoint(-75.7,45.4167),4326),6093943,'CAN','124','CA','.ca','+1','CAD','Dollar','','','{en-CA,fr-CA,iu}','{US}',9984670,'Canada','Canada','Canada','geonames',true),
  ('CD','RD Congo','AF','Kinshasa','CDF',89561403,ST_SetSRID(ST_MakePoint(15.3,-4.3167),4326),2314302,'COD','180','CG','.cd','+243','CDF','Congolese Franc','','','{fr-CD,ln,kg,sw,lu}','{AO,BI,CF,CG,SS,RW,TZ,UG,ZM}',2344858,'DR Congo','Democratic Republic of the Congo','RD Congo','geonames',true),
  ('CF','République centrafricaine','AF','Bangui','XAF',4829767,ST_SetSRID(ST_MakePoint(18.5833,4.3667),4326),239880,'CAF','140','CT','.cf','+236','XAF','CFA Franc','','','{fr-CF,sg,ln,kg}','{CM,CD,CG,TD,SS,SD}',622984,'Central African Republic','Central African Republic','République centrafricaine','geonames',true),
  ('CG','Congo-Brazzaville','AF','Brazzaville','XAF',5518092,ST_SetSRID(ST_MakePoint(15.2667,-4.2667),4326),2260494,'COG','178','CF','.cg','+242','XAF','CFA Franc','','','{fr-CG,kg,ln}','{AO,CM,CF,CD,GA}',342000,'Republic of the Congo','Republic of the Congo','Congo-Brazzaville','geonames',true),
  ('CH','Suisse','EU','Berne','CHF',8654622,ST_SetSRID(ST_MakePoint(7.45,46.9167),4326),2661552,'CHE','756','SZ','.ch','+41','CHF','Franc','','','{de-CH,fr-CH,it-CH,rm}','{AT,FR,IT,LI,DE}',41284,'Switzerland','Switzerland','Suisse','geonames',true),
  ('CI','Côte d''Ivoire','AF','Yamoussoukro','XOF',26378274,ST_SetSRID(ST_MakePoint(-5.2833,6.8167),4326),2287781,'CIV','384','IV','.ci','+225','XOF','CFA Franc','','','{fr-CI}','{BF,GH,GN,LR,ML}',322463,'Ivory Coast','Ivory Coast','Côte d''Ivoire','geonames',true),
  ('CL','Chili','SA','Santiago','CLP',19116201,ST_SetSRID(ST_MakePoint(-70.6667,-33.45),4326),3895114,'CHL','152','CI','.cl','+56','CLP','Peso','','','{es-CL}','{AR,BO,PE}',756102,'Chile','Chile','Chili','geonames',true),
  ('CM','Cameroun','AF','Yaoundé','XAF',26545864,ST_SetSRID(ST_MakePoint(11.5167,3.8667),4326),2233387,'CMR','120','CM','.cm','+237','XAF','CFA Franc','','','{en-CM,fr-CM}','{TD,CF,GA,GQ,CG,NG}',475442,'Cameroon','Cameroon','Cameroun','geonames',true),
  ('CN','Chine','AS','Pékin','CNY',1439323776,ST_SetSRID(ST_MakePoint(116.3833,39.9167),4326),1816670,'CHN','156','CH','.cn','+86','CNY','Yuan Renminbi','','','{zh-CN}','{AF,BT,IN,KZ,KP,KG,LA,MN,MM,NP,PK,RU,TJ,VN}',9596960,'China','China','Chine','geonames',true),
  ('CO','Colombie','SA','Bogota','COP',50882891,ST_SetSRID(ST_MakePoint(-74.0833,4.6),4326),3686110,'COL','170','CO','.co','+57','COP','Peso','','','{es-CO}','{BR,EC,PA,PE,VE}',1138910,'Colombia','Colombia','Colombie','geonames',true),
  ('CR','Costa Rica','NA','San José','CRC',5094118,ST_SetSRID(ST_MakePoint(-84.0833,9.9333),4326),3624060,'CRI','188','CS','.cr','+506','CRC','Colon','','','{es-CR,en}','{NI,PA}',51100,'Costa Rica','Costa Rica','Costa Rica','geonames',true),
  ('CU','Cuba','NA','La Havane','CUP',11326616,ST_SetSRID(ST_MakePoint(-82.35,23.1167),4326),3562981,'CUB','192','CU','.cu','+53','CUP','Peso','','','{es-CU}','{none}',109884,'Cuba','Cuba','Cuba','geonames',true),
  ('CV','Cap-Vert','AF','Praia','CVE',555988,ST_SetSRID(ST_MakePoint(-23.5167,14.9167),4326),3374333,'CPV','132','CV','.cv','+238','CVE','Escudo','','','{pt-CV}','{none}',4033,'Cape Verde','Cape Verde','Cap-Vert','geonames',true),
  ('CY','Chypre','AS','Nicosie','EUR',1207359,ST_SetSRID(ST_MakePoint(33.3833,35.1667),4326),146268,'CYP','196','CY','.cy','+357','EUR','Euro','','','{el-CY,tr-CY,en}','{none}',9251,'Cyprus','Cyprus','Chypre','geonames',true),
  ('CZ','Tchéquie','EU','Prague','CZK',10708981,ST_SetSRID(ST_MakePoint(14.4167,50.0833),4326),3067696,'CZE','203','EZ','.cz','+420','CZK','Czech Koruna','','','{cs,sk}','{AT,DE,PL,SK}',78867,'Czech Republic','Czech Republic','Tchéquie','geonames',true),
  ('DE','Allemagne','EU','Berlin','EUR',83783942,ST_SetSRID(ST_MakePoint(13.4,52.5167),4326),2950159,'DEU','276','GM','.de','+49','EUR','Euro','','','{de}','{AT,BE,CZ,DK,FR,LU,NL,PL,CH}',357114,'Germany','Germany','Allemagne','geonames',true),
  ('DJ','Djibouti','AF','Djibouti','DJF',988002,ST_SetSRID(ST_MakePoint(43.15,11.5833),4326),223816,'DJI','262','DJ','.dj','+253','DJF','Franc','','','{fr-DJ,ar,so}','{ER,ET,SO}',23200,'Djibouti','Djibouti','Djibouti','geonames',true),
  ('DK','Danemark','EU','Copenhague','DKK',5831404,ST_SetSRID(ST_MakePoint(12.5667,55.6667),4326),2623032,'DNK','208','DA','.dk','+45','DKK','Krone','','','{da-DK,en,fo,de-DK}','{DE}',43094,'Denmark','Denmark','Danemark','geonames',true),
  ('DM','Dominique','NA','Roseau','XCD',71986,ST_SetSRID(ST_MakePoint(-61.4,15.3),4326),3575830,'DMA','212','DO','.dm','+1767','XCD','Dollar','','','{en}','{none}',751,'Dominica','Dominica','Dominique','geonames',true),
  ('DO','République dominicaine','NA','Saint-Domingue','DOP',10847910,ST_SetSRID(ST_MakePoint(-69.9,18.4667),4326),3508797,'DOM','214','DR','.do','+1809','DOP','Peso','','','{es-DO}','{HT}',48671,'Dominican Republic','Dominican Republic','République dominicaine','geonames',true),
  ('DZ','Algérie','AF','Alger','DZD',43851044,ST_SetSRID(ST_MakePoint(3.05,36.75),4326),2589581,'DZA','012','AG','.dz','+213','DZD','Dinar','','','{ar-DZ}','{LY,MR,MA,NE,TN,WF,EH}',2381741,'Algeria','Algeria','Algérie','geonames',true),
  ('EC','Équateur','SA','Quito','USD',17643054,ST_SetSRID(ST_MakePoint(-78.5,-0.2167),4326),3657509,'ECU','218','EC','.ec','+593','USD','Dollar','','','{es-EC}','{CO,PE}',283561,'Ecuador','Ecuador','Équateur','geonames',true),
  ('EE','Estonie','EU','Tallinn','EUR',1326535,ST_SetSRID(ST_MakePoint(24.75,59.4333),4326),588409,'EST','233','EN','.ee','+372','EUR','Euro','','','{et}','{LV,RU}',45228,'Estonia','Estonia','Estonie','geonames',true),
  ('EG','Égypte','AF','Le Caire','EGP',102334404,ST_SetSRID(ST_MakePoint(31.25,30.05),4326),357994,'EGY','818','EG','.eg','+20','EGP','Pound','','','{ar-EG,en,fr}','{LY,SD,IL,PS}',1002450,'Egypt','Egypt','Égypte','geonames',true),
  ('ER','Érythrée','AF','Asmara','ERN',3546421,ST_SetSRID(ST_MakePoint(38.9333,15.3333),4326),338010,'ERI','232','ER','.er','+291','ERN','Nakfa','','','{aa-ER,ar,tig,kun,ti}','{DJ,ET,SD}',117600,'Eritrea','Eritrea','Érythrée','geonames',true),
  ('ES','Espagne','EU','Madrid','EUR',46754778,ST_SetSRID(ST_MakePoint(-3.6833,40.4),4326),2510769,'ESP','724','SP','.es','+34','EUR','Euro','','','{es-ES,ca,gl,eu,oc}','{AD,FR,GI,PT,MA}',505992,'Spain','Spain','Espagne','geonames',true),
  ('ET','Éthiopie','AF','Addis-Abeba','ETB',114963588,ST_SetSRID(ST_MakePoint(38.7333,9.0333),4326),344979,'ETH','231','ET','.et','+251','ETB','Birr','','','{am,om,ti,so,en}','{DJ,ER,KE,SO,SS,SD}',1104300,'Ethiopia','Ethiopia','Éthiopie','geonames',true),
  ('FI','Finlande','EU','Helsinki','EUR',5540720,ST_SetSRID(ST_MakePoint(24.9333,60.1667),4326),658225,'FIN','246','FI','.fi','+358','EUR','Euro','','','{fi-FI,sv-FI,se}','{NO,SE,RU}',338424,'Finland','Finland','Finlande','geonames',true),
  ('FJ','Fidji','OC','Suva','FJD',896444,ST_SetSRID(ST_MakePoint(178.45,-18.1333),4326),2205218,'FJI','242','FJ','.fj','+679','FJD','Dollar','','','{en-FJ,fj}','{none}',18272,'Fiji','Fiji','Fidji','geonames',true),
  ('FM','Micronésie','OC','Palikir','USD',115021,ST_SetSRID(ST_MakePoint(158.15,6.9167),4326),2081986,'FSM','583','FM','.fm','+691','USD','Dollar','','','{en-FM,chk,pon,yap,kos,uli,woe,nkr,kpg}','{none}',702,'Micronesia','Federated States of Micronesia','Micronésie','geonames',true),
  ('FR','France','EU','Paris','EUR',65273511,ST_SetSRID(ST_MakePoint(2.35,48.85),4326),2988507,'FRA','250','FR','.fr','+33','EUR','Euro','','','{fr-FR,frp,br,co,ca,eu,oc}','{AD,BE,DE,IT,LU,MC,ES,CH}',643801,'France','France','France','geonames',true),
  ('GA','Gabon','AF','Libreville','XAF',2225728,ST_SetSRID(ST_MakePoint(9.45,0.3833),4326),2400553,'GAB','266','GB','.ga','+241','XAF','CFA Franc','','','{fr-GA}','{CM,CG,GQ}',267668,'Gabon','Gabon','Gabon','geonames',true),
  ('GB','Royaume-Uni','EU','Londres','GBP',67886011,ST_SetSRID(ST_MakePoint(-0.0833,51.5),4326),2643743,'GBR','826','UK','.uk','+44','GBP','Pound Sterling','','','{en-GB,cy-GB,gd}','{IE}',243610,'United Kingdom','United Kingdom','Royaume-Uni','geonames',true),
  ('GD','Grenade','NA','Saint-Georges','XCD',112523,ST_SetSRID(ST_MakePoint(-61.75,12.05),4326),3580239,'GRD','308','GJ','.gd','+1473','XCD','Dollar','','','{en}','{none}',344,'Grenada','Grenada','Grenade','geonames',true),
  ('GE','Géorgie','AS','Tbilissi','GEL',3989167,ST_SetSRID(ST_MakePoint(44.8,41.7167),4326),611717,'GEO','268','GG','.ge','+995','GEL','Lari','','','{ka,ru,hy,az}','{AM,AZ,RU,TR}',69700,'Georgia','Georgia','Géorgie','geonames',true),
  ('GH','Ghana','AF','Accra','GHS',31072940,ST_SetSRID(ST_MakePoint(-0.2,5.55),4326),2306104,'GHA','288','GH','.gh','+233','GHS','Cedi','','','{en-GH,ak,ee,tw}','{BF,CI,TG}',238533,'Ghana','Ghana','Ghana','geonames',true),
  ('GM','Gambie','AF','Banjul','GMD',2416668,ST_SetSRID(ST_MakePoint(-16.5833,13.45),4326),2413876,'GMB','270','GA','.gm','+220','GMD','Dalasi','','','{en-GM,rn,wo,ff}','{SN}',11295,'Gambia','Gambia','Gambie','geonames',true),
  ('GN','Guinée','AF','Conakry','GNF',13132795,ST_SetSRID(ST_MakePoint(-13.7,9.5167),4326),2420477,'GIN','324','GV','.gn','+224','GNF','Franc','','','{fr-GN}','{CI,GW,LR,ML,SN,SL}',245857,'Guinea','Guinea','Guinée','geonames',true),
  ('GQ','Guinée équatoriale','AF','Malabo','XAF',1402985,ST_SetSRID(ST_MakePoint(8.7833,3.75),4326),2309527,'GNQ','226','EK','.gq','+240','XAF','CFA Franc','','','{es-GQ,fr}','{CM,GA}',28051,'Equatorial Guinea','Equatorial Guinea','Guinée équatoriale','geonames',true),
  ('GR','Grèce','EU','Athènes','EUR',10423054,ST_SetSRID(ST_MakePoint(23.7333,37.9833),4326),264371,'GRC','300','GR','.gr','+30','EUR','Euro','','','{el-GR,en,fr}','{AL,BG,TR,MK}',131957,'Greece','Greece','Grèce','geonames',true),
  ('GT','Guatemala','NA','Guatemala','GTQ',17915568,ST_SetSRID(ST_MakePoint(-90.5167,14.6167),4326),3598132,'GTM','320','GT','.gt','+502','GTQ','Quetzal','','','{es-GT}','{BZ,SV,HN,MX}',108889,'Guatemala','Guatemala','Guatemala','geonames',true),
  ('GW','Guinée-Bissau','AF','Bissau','XOF',1968001,ST_SetSRID(ST_MakePoint(-15.6,11.85),4326),2374776,'GNB','624','PU','.gw','+245','XOF','CFA Franc','','','{pt-GW}','{GN,SN}',36125,'Guinea-Bissau','Guinea-Bissau','Guinée-Bissau','geonames',true),
  ('GY','Guyana','SA','Georgetown','GYD',786552,ST_SetSRID(ST_MakePoint(-58.15,6.8),4326),3378644,'GUY','328','GY','.gy','+592','GYD','Dollar','','','{en-GY}','{BR,SR,VE}',214969,'Guyana','Guyana','Guyana','geonames',true),
  ('HN','Honduras','NA','Tegucigalpa','HNL',9904607,ST_SetSRID(ST_MakePoint(-87.2167,14.1),4326),3600982,'HND','340','HO','.hn','+504','HNL','Lempira','','','{es-HN}','{GT,NI,SV}',112090,'Honduras','Honduras','Honduras','geonames',true),
  ('HR','Croatie','EU','Zagreb','HRK',4105267,ST_SetSRID(ST_MakePoint(15.9667,45.8),4326),3186886,'HRV','191','HR','.hr','+385','HRK','Kuna','','','{hr-HR,sr}','{BA,HU,ME,RS,SI}',56594,'Croatia','Croatia','Croatie','geonames',true),
  ('HT','Haïti','NA','Port-au-Prince','HTG',11402528,ST_SetSRID(ST_MakePoint(-72.3333,18.5333),4326),3718425,'HTI','332','HA','.ht','+509','HTG','Gourde','','','{ht,fr-HT}','{DO}',27750,'Haiti','Haiti','Haïti','geonames',true),
  ('HU','Hongrie','EU','Budapest','HUF',9660351,ST_SetSRID(ST_MakePoint(19.05,47.5),4326),3054643,'HUN','348','HU','.hu','+36','HUF','Forint','','','{hu-HU}','{AT,HR,RO,RS,SK,SI,UA}',93028,'Hungary','Hungary','Hongrie','geonames',true),
  ('ID','Indonésie','AS','Jakarta','IDR',273523615,ST_SetSRID(ST_MakePoint(106.85,-6.1667),4326),1642911,'IDN','360','ID','.id','+62','IDR','Rupiah','','','{id,en,nl,jv}','{MY,PG,TL}',1904569,'Indonesia','Indonesia','Indonésie','geonames',true),
  ('IE','Irlande','EU','Dublin','EUR',4937786,ST_SetSRID(ST_MakePoint(-6.25,53.3333),4326),2964574,'IRL','372','EI','.ie','+353','EUR','Euro','','','{en-IE,ga-IE}','{GB}',70273,'Ireland','Ireland','Irlande','geonames',true),
  ('IL','Israël','AS','Jérusalem','ILS',8655535,ST_SetSRID(ST_MakePoint(35.2333,31.7667),4326),281184,'ISR','376','IS','.il','+972','ILS','Shekel','','','{he,ar-IL,en-IL}','{SY,JO,LB,EG,PS}',20770,'Israel','Israel','Israël','geonames',true),
  ('IN','Inde','AS','New Delhi','INR',1380004385,ST_SetSRID(ST_MakePoint(77.2167,28.6),4326),1261481,'IND','356','IN','.in','+91','INR','Rupee','','','{en-IN,hi,bn,te,mr,ta,ur,gu,kn,ml,or,pa,as,bh,sat,ks,ne,sd,si,doi,brr,ma,mtm,sa}','{BD,BT,MM,CN,NP,PK,LK}',3287263,'India','India','Inde','geonames',true),
  ('IQ','Irak','AS','Bagdad','IQD',40222493,ST_SetSRID(ST_MakePoint(44.4,33.3333),4326),98182,'IRQ','368','IZ','.iq','+964','IQD','Dinar','','','{ar-IQ,ku,tr}','{IR,JO,KW,SA,SY,TR}',438317,'Iraq','Iraq','Irak','geonames',true),
  ('IR','Iran','AS','Téhéran','IRR',83992949,ST_SetSRID(ST_MakePoint(51.4167,35.6833),4326),112931,'IRN','364','IR','.ir','+98','IRR','Rial','','','{fa-IR,ku}','{AF,AM,AZ,IQ,PK,TM,TR}',1648195,'Iran','Iran','Iran','geonames',true),
  ('IS','Islande','EU','Reykjavik','ISK',341243,ST_SetSRID(ST_MakePoint(-21.9333,64.15),4326),3413829,'ISL','352','IC','.is','+354','ISK','Krona','','','{is,en,de,da,sv,no}','{none}',103000,'Iceland','Iceland','Islande','geonames',true),
  ('IT','Italie','EU','Rome','EUR',60461826,ST_SetSRID(ST_MakePoint(12.4833,41.9),4326),3169070,'ITA','380','IT','.it','+39','EUR','Euro','','','{it-IT,de-IT,fr-IT,sc,ca,co,sl}','{AT,FR,SM,CH,VA}',301336,'Italy','Italy','Italie','geonames',true),
  ('JM','Jamaïque','NA','Kingston','JMD',2961161,ST_SetSRID(ST_MakePoint(-76.8,18),4326),3489854,'JAM','388','JM','.jm','+1876','JMD','Dollar','','','{en-JM}','{none}',10991,'Jamaica','Jamaica','Jamaïque','geonames',true),
  ('JO','Jordanie','AS','Amman','JOD',10203134,ST_SetSRID(ST_MakePoint(35.9333,31.95),4326),250441,'JOR','400','JO','.jo','+962','JOD','Dinar','','','{ar-JO,en}','{IQ,IL,SA,SY}',89342,'Jordan','Jordan','Jordanie','geonames',true),
  ('JP','Japon','AS','Tokyo','JPY',126476461,ST_SetSRID(ST_MakePoint(139.6833,35.6833),4326),1850147,'JPN','392','JA','.jp','+81','JPY','Yen','','','{ja}','{none}',377930,'Japan','Japan','Japon','geonames',true),
  ('KE','Kenya','AF','Nairobi','KES',53771300,ST_SetSRID(ST_MakePoint(36.8167,-1.2833),4326),184745,'KEN','404','KE','.ke','+254','KES','Shilling','','','{en-KE,sw-KE}','{ET,SO,SS,TZ,UG}',580367,'Kenya','Kenya','Kenya','geonames',true),
  ('KG','Kirghizistan','AS','Bichkek','KGS',6524195,ST_SetSRID(ST_MakePoint(74.6,42.8667),4326),1528675,'KGZ','417','KG','.kg','+996','KGS','Som','','','{ky,ru}','{CN,KZ,TJ,UZ}',199951,'Kyrgyzstan','Kyrgyzstan','Kirghizistan','geonames',true),
  ('KH','Cambodge','AS','Phnom Penh','KHR',16718965,ST_SetSRID(ST_MakePoint(104.9167,11.55),4326),1830106,'KHM','116','CB','.kh','+855','KHR','Riel','','','{km,fr,en}','{LA,TH,VN}',181035,'Cambodia','Cambodia','Cambodge','geonames',true),
  ('KI','Kiribati','OC','Tarawa','AUD',119449,ST_SetSRID(ST_MakePoint(173,-0.8833),4326),2110294,'KIR','296','KR','.ki','+686','AUD','Dollar','','','{en-KI,gil}','{none}',811,'Kiribati','Kiribati','Kiribati','geonames',true),
  ('KM','Comores','AF','Moroni','KMF',869595,ST_SetSRID(ST_MakePoint(43.25,-11.7),4326),921772,'COM','174','CN','.km','+269','KMF','Franc','','','{ar,fr}','{none}',1862,'Comoros','Comoros','Comores','geonames',true),
  ('KN','Saint-Christophe-et-Niévès','NA','Basseterre','XCD',53199,ST_SetSRID(ST_MakePoint(-62.7167,17.3),4326),3575551,'KNA','659','SC','.kn','+1869','XCD','Dollar','','','{en-KN}','{none}',261,'Saint Kitts and Nevis','Saint Kitts and Nevis','Saint-Christophe-et-Niévès','geonames',true),
  ('KP','Corée du Nord','AS','Pyongyang','KPW',25778816,ST_SetSRID(ST_MakePoint(125.75,39.0167),4326),1871859,'PRK','408','KN','.kp','+850','KPW','Won','','','{ko-KP}','{CN,KR,RU}',120538,'North Korea','North Korea','Corée du Nord','geonames',true),
  ('KR','Corée du Sud','AS','Séoul','KRW',51269185,ST_SetSRID(ST_MakePoint(126.9833,37.5667),4326),1835848,'KOR','410','KS','.kr','+82','KRW','Won','','','{ko-KR,en}','{KP}',100210,'South Korea','South Korea','Corée du Sud','geonames',true),
  ('KW','Koweït','AS','Koweït','KWD',4270571,ST_SetSRID(ST_MakePoint(47.9667,29.3667),4326),285787,'KWT','414','KU','.kw','+965','KWD','Dinar','','','{ar-KW,en}','{IQ,SA}',17818,'Kuwait','Kuwait','Koweït','geonames',true),
  ('KZ','Kazakhstan','AS','Noursoultan','KZT',18776707,ST_SetSRID(ST_MakePoint(71.45,51.1667),4326),1526384,'KAZ','398','KZ','.kz','+7','KZT','Tenge','','','{kk,ru}','{CN,KG,RU,TM,UZ}',2724900,'Kazakhstan','Kazakhstan','Kazakhstan','geonames',true),
  ('LA','Laos','AS','Vientiane','LAK',7275560,ST_SetSRID(ST_MakePoint(102.6,17.9667),4326),1651944,'LAO','418','LA','.la','+856','LAK','Kip','','','{lo,fr,en}','{KH,CN,MM,TH,VN}',236800,'Laos','Laos','Laos','geonames',true),
  ('LB','Liban','AS','Beyrouth','LBP',6825442,ST_SetSRID(ST_MakePoint(35.5,33.8833),4326),276781,'LBN','422','LE','.lb','+961','LBP','Pound','','','{ar-LB,fr-LB,en,hy}','{IL,SY}',10400,'Lebanon','Lebanon','Liban','geonames',true),
  ('LC','Sainte-Lucie','NA','Castries','XCD',183627,ST_SetSRID(ST_MakePoint(-61,14),4326),3576812,'LCA','662','ST','.lc','+1758','XCD','Dollar','','','{en}','{none}',616,'Saint Lucia','Saint Lucia','Sainte-Lucie','geonames',true),
  ('LI','Liechtenstein','EU','Vaduz','CHF',38137,ST_SetSRID(ST_MakePoint(9.5167,47.1333),4326),3042030,'LIE','438','LS','.li','+423','CHF','Franc','','','{de-LI}','{AT,CH}',160,'Liechtenstein','Liechtenstein','Liechtenstein','geonames',true),
  ('LK','Sri Lanka','AS','Sri Jayawardenapura Kotte','LKR',21413249,ST_SetSRID(ST_MakePoint(79.9,6.9),4326),1227603,'LKA','144','CE','.lk','+94','LKR','Rupee','','','{si,ta,en}','{IN,MV}',65610,'Sri Lanka','Sri Lanka','Sri Lanka','geonames',true),
  ('LR','Liberia','AF','Monrovia','LRD',5057681,ST_SetSRID(ST_MakePoint(-10.8,6.3),4326),2274895,'LBR','430','LI','.lr','+231','LRD','Dollar','','','{en}','{CI,GN,SL}',111369,'Liberia','Liberia','Liberia','geonames',true),
  ('LS','Lesotho','AF','Maseru','LSL',2142249,ST_SetSRID(ST_MakePoint(27.4833,-29.3167),4326),932505,'LSO','426','LT','.ls','+266','LSL','Loti','','','{en-LS,st,zu,xh}','{ZA}',30355,'Lesotho','Lesotho','Lesotho','geonames',true),
  ('LT','Lituanie','EU','Vilnius','EUR',2722289,ST_SetSRID(ST_MakePoint(25.3167,54.6833),4326),593116,'LTU','440','LH','.lt','+370','EUR','Euro','','','{lt}','{BY,LV,PL,RU}',65300,'Lithuania','Lithuania','Lituanie','geonames',true),
  ('LU','Luxembourg','EU','Luxembourg','EUR',625978,ST_SetSRID(ST_MakePoint(6.1167,49.6),4326),2960316,'LUX','442','LU','.lu','+352','EUR','Euro','','','{lb,de-LU,fr-LU}','{BE,DE,FR}',2586,'Luxembourg','Luxembourg','Luxembourg','geonames',true),
  ('LV','Lettonie','EU','Riga','EUR',1886198,ST_SetSRID(ST_MakePoint(24.1,56.95),4326),456172,'LVA','428','LG','.lv','+371','EUR','Euro','','','{lv,ru,lt}','{BY,EE,LT,RU}',64589,'Latvia','Latvia','Lettonie','geonames',true),
  ('LY','Libye','AF','Tripoli','LYD',6871287,ST_SetSRID(ST_MakePoint(13.1833,32.8833),4326),2210247,'LBY','434','LY','.ly','+218','LYD','Dinar','','','{ar-LY,it,en}','{DZ,TD,EG,NE,SD,TN}',1759540,'Libya','Libya','Libye','geonames',true),
  ('MA','Maroc','AF','Rabat','MAD',36910560,ST_SetSRID(ST_MakePoint(-6.8333,34.0167),4326),2538475,'MAR','504','MO','.ma','+212','MAD','Dirham','','','{ar-MA,ber,fr}','{DZ,EH,ES}',446550,'Morocco','Morocco','Maroc','geonames',true),
  ('MC','Monaco','EU','Monaco','EUR',39242,ST_SetSRID(ST_MakePoint(7.4167,43.7333),4326),2993457,'MCO','492','MN','.mc','+377','EUR','Euro','','','{fr-MC,en,it}','{FR}',2,'Monaco','Monaco','Monaco','geonames',true),
  ('MD','Moldavie','EU','Chișinău','MDL',4033963,ST_SetSRID(ST_MakePoint(28.85,47.0167),4326),618069,'MDA','498','MD','.md','+373','MDL','Leu','','','{ro,ru,uk,ga}','{RO,UA}',33851,'Moldova','Moldova','Moldavie','geonames',true),
  ('ME','Monténégro','EU','Podgorica','EUR',628066,ST_SetSRID(ST_MakePoint(19.2667,42.4333),4326),3193044,'MNE','499','MJ','.me','+382','EUR','Euro','','','{sr,hu,bs,sq}','{AL,BA,HR,RS,XK}',13812,'Montenegro','Montenegro','Monténégro','geonames',true),
  ('MG','Madagascar','AF','Antananarivo','MGA',27691018,ST_SetSRID(ST_MakePoint(47.5167,-18.9167),4326),2302696,'MDG','450','MA','.mg','+261','MGA','Ariary','','','{fr-MG,mg}','{none}',587041,'Madagascar','Madagascar','Madagascar','geonames',true),
  ('MH','Îles Marshall','OC','Majuro','USD',59190,ST_SetSRID(ST_MakePoint(171.3833,7.1),4326),2080185,'MHL','584','RM','.mh','+692','USD','Dollar','','','{en-MH,mh}','{none}',181,'Marshall Islands','Marshall Islands','Îles Marshall','geonames',true),
  ('MK','Macédoine du Nord','EU','Skopje','MKD',2083374,ST_SetSRID(ST_MakePoint(21.4333,42),4326),785842,'MKD','807','MK','.mk','+389','MKD','Denar','','','{mk,sq,tr,rm,sr}','{AL,BG,GR,RS,XK}',25713,'North Macedonia','North Macedonia','Macédoine du Nord','geonames',true),
  ('ML','Mali','AF','Bamako','XOF',20250833,ST_SetSRID(ST_MakePoint(-8,12.65),4326),2460596,'MLI','466','ML','.ml','+223','XOF','CFA Franc','','','{fr-ML,bm}','{DZ,BF,GN,CI,MR,NE,SN}',1240192,'Mali','Mali','Mali','geonames',true),
  ('MM','Myanmar','AS','Naypyidaw','MMK',54409800,ST_SetSRID(ST_MakePoint(96.1667,19.75),4326),1307584,'MMR','104','BM','.mm','+95','MMK','Kyat','','','{my}','{BD,CN,IN,LA,TH}',676578,'Myanmar','Myanmar','Myanmar','geonames',true),
  ('MN','Mongolie','AS','Oulan-Bator','MNT',3278290,ST_SetSRID(ST_MakePoint(106.9167,47.9167),4326),2028462,'MNG','496','MG','.mn','+976','MNT','Tugrik','','','{mn,ru}','{CN,RU}',1564116,'Mongolia','Mongolia','Mongolie','geonames',true),
  ('MR','Mauritanie','AF','Nouakchott','MRU',4649658,ST_SetSRID(ST_MakePoint(-15.9333,18.0667),4326),2377450,'MRT','478','MR','.mr','+222','MRU','Ouguiya','','','{ar-MR,fuc,snk,fr,mey}','{DZ,ML,SN,EH}',1030700,'Mauritania','Mauritania','Mauritanie','geonames',true),
  ('MT','Malte','EU','La Valette','EUR',441543,ST_SetSRID(ST_MakePoint(14.5167,35.8833),4326),2562305,'MLT','470','MT','.mt','+356','EUR','Euro','','','{mt,en-MT}','{none}',316,'Malta','Malta','Malte','geonames',true),
  ('MU','Maurice','AF','Port-Louis','MUR',1271768,ST_SetSRID(ST_MakePoint(57.5,-20.15),4326),934154,'MUS','480','MP','.mu','+230','MUR','Rupee','','','{en-MU,bho,fr}','{none}',2040,'Mauritius','Mauritius','Maurice','geonames',true),
  ('MV','Maldives','AS','Malé','MVR',540544,ST_SetSRID(ST_MakePoint(73.5,4.1667),4326),1282027,'MDV','462','MV','.mv','+960','MVR','Rufiyaa','','','{dv,en}','{IN,LK}',298,'Maldives','Maldives','Maldives','geonames',true),
  ('MW','Malawi','AF','Lilongwe','MWK',19129952,ST_SetSRID(ST_MakePoint(33.7833,-13.9833),4326),927967,'MWI','454','MI','.mw','+265','MWK','Kwacha','','','{ny,yao,tum,swk}','{MZ,TZ,ZM}',118484,'Malawi','Malawi','Malawi','geonames',true),
  ('MX','Mexique','NA','Mexico','MXN',128932753,ST_SetSRID(ST_MakePoint(-99.15,19.4333),4326),3530597,'MEX','484','MX','.mx','+52','MXN','Peso','','','{es-MX}','{BZ,GT,US}',1964375,'Mexico','Mexico','Mexique','geonames',true),
  ('MY','Malaisie','AS','Kuala Lumpur','MYR',32365999,ST_SetSRID(ST_MakePoint(101.7167,3.1333),4326),1735161,'MYS','458','MY','.my','+60','MYR','Ringgit','','','{ms-MY,en,zh,ta,te,ml,pa,th}','{BN,ID,TH}',329847,'Malaysia','Malaysia','Malaisie','geonames',true),
  ('MZ','Mozambique','AF','Maputo','MZN',31255435,ST_SetSRID(ST_MakePoint(32.5833,-25.9667),4326),1040652,'MOZ','508','MZ','.mz','+258','MZN','Metical','','','{pt-MZ,vmw}','{MW,ZA,SZ,TZ,ZM,ZW}',801590,'Mozambique','Mozambique','Mozambique','geonames',true),
  ('NA','Namibie','AF','Windhoek','NAD',2540905,ST_SetSRID(ST_MakePoint(17.0833,-22.5667),4326),3352138,'NAM','516','WA','.na','+264','NAD','Dollar','','','{en-NA,af,de,hz,naq}','{AO,BW,ZA,ZM}',824292,'Namibia','Namibia','Namibie','geonames',true),
  ('NE','Niger','AF','Niamey','XOF',24206644,ST_SetSRID(ST_MakePoint(2.1,13.5167),4326),2440476,'NER','562','NG','.ne','+227','XOF','CFA Franc','','','{fr-NE,ha,kr,dje}','{DZ,BJ,BF,TD,LY,ML,NG}',1267000,'Niger','Niger','Niger','geonames',true),
  ('NG','Nigeria','AF','Abuja','NGN',206139589,ST_SetSRID(ST_MakePoint(7.5333,9.0833),4326),2352778,'NGA','566','NI','.ng','+234','NGN','Naira','','','{en-NG,ha,yo,ig,ff}','{BJ,CM,TD,NE}',923768,'Nigeria','Nigeria','Nigeria','geonames',true),
  ('NI','Nicaragua','NA','Managua','NIO',6624554,ST_SetSRID(ST_MakePoint(-86.25,12.15),4326),3617763,'NIC','558','NU','.ni','+505','NIO','Cordoba','','','{es-NI,en}','{CR,HN}',130373,'Nicaragua','Nicaragua','Nicaragua','geonames',true),
  ('NL','Pays-Bas','EU','Amsterdam','EUR',17134872,ST_SetSRID(ST_MakePoint(4.9,52.3667),4326),2759794,'NLD','528','NL','.nl','+31','EUR','Euro','','','{nl-NL,fy-NL}','{BE,DE}',41543,'Netherlands','Netherlands','Pays-Bas','geonames',true),
  ('NO','Norvège','EU','Oslo','NOK',5421241,ST_SetSRID(ST_MakePoint(10.75,59.9167),4326),3143244,'NOR','578','NO','.no','+47','NOK','Krone','','','{no,nb,nn,se,fj}','{FI,RU,SE}',323802,'Norway','Norway','Norvège','geonames',true),
  ('NP','Népal','AS','Katmandou','NPR',29136808,ST_SetSRID(ST_MakePoint(85.3167,27.7167),4326),1283240,'NPL','524','NP','.np','+977','NPR','Rupee','','','{ne,en}','{CN,IN}',147181,'Nepal','Nepal','Népal','geonames',true),
  ('NR','Nauru','OC','Yaren','AUD',10824,ST_SetSRID(ST_MakePoint(166.9167,-0.55),4326),2110425,'NRU','520','NR','.nr','+674','AUD','Dollar','','','{na,en-TK}','{none}',21,'Nauru','Nauru','Nauru','geonames',true),
  ('NZ','Nouvelle-Zélande','OC','Wellington','NZD',4822233,ST_SetSRID(ST_MakePoint(174.7833,-41.3),4326),2179537,'NZL','554','NZ','.nz','+64','NZD','Dollar','','','{en-NZ,mi}','{none}',270467,'New Zealand','New Zealand','Nouvelle-Zélande','geonames',true),
  ('OM','Oman','AS','Mascate','OMR',5106626,ST_SetSRID(ST_MakePoint(58.5833,23.6),4326),287286,'OMN','512','MU','.om','+968','OMR','Rial','','','{ar-OM,en,bal,ur}','{SA,AE,YE}',309500,'Oman','Oman','Oman','geonames',true),
  ('PA','Panama','NA','Panama','PAB',4314767,ST_SetSRID(ST_MakePoint(-79.5167,8.9667),4326),3700565,'PAN','591','PM','.pa','+507','PAB','Balboa','','','{es-PA,en}','{CO,CR}',75417,'Panama','Panama','Panama','geonames',true),
  ('PE','Pérou','SA','Lima','PEN',32971854,ST_SetSRID(ST_MakePoint(-77.05,-12.05),4326),3936456,'PER','604','PE','.pe','+51','PEN','Sol','','','{es-PE,qu,ay}','{BO,BR,CL,CO,EC}',1285216,'Peru','Peru','Pérou','geonames',true),
  ('PG','Papouasie-Nouvelle-Guinée','OC','Port Moresby','PGK',8947024,ST_SetSRID(ST_MakePoint(147.1833,-9.45),4326),2088122,'PNG','598','PP','.pg','+675','PGK','Kina','','','{en-PG,ho,me,tpi}','{ID}',462840,'Papua New Guinea','Papua New Guinea','Papouasie-Nouvelle-Guinée','geonames',true),
  ('PH','Philippines','AS','Manille','PHP',109581078,ST_SetSRID(ST_MakePoint(120.9667,14.6),4326),1701668,'PHL','608','RP','.ph','+63','PHP','Peso','','','{tl,en-PH,fil}','{none}',300000,'Philippines','Philippines','Philippines','geonames',true),
  ('PK','Pakistan','AS','Islamabad','PKR',220892340,ST_SetSRID(ST_MakePoint(73.05,33.7),4326),1176615,'PAK','586','PK','.pk','+92','PKR','Rupee','','','{ur-PK,en-PK,pa,sd,ps,brh}','{AF,CN,IN,IR}',881913,'Pakistan','Pakistan','Pakistan','geonames',true),
  ('PL','Pologne','EU','Varsovie','PLN',37846611,ST_SetSRID(ST_MakePoint(21,52.25),4326),756135,'POL','616','PL','.pl','+48','PLN','Zloty','','','{pl}','{BY,CZ,DE,LT,RU,SK,UA}',312679,'Poland','Poland','Pologne','geonames',true),
  ('PS','Palestine','AS','Ramallah','ILS',5101414,ST_SetSRID(ST_MakePoint(35.2,31.9),4326),2826156,'PSE','275','WE','.ps','+970','ILS','Shekel','','','{ar-PS}','{IL,JO}',6020,'Palestinian Territory','Palestinian Territory','Palestine','geonames',true),
  ('PT','Portugal','EU','Lisbonne','EUR',10196709,ST_SetSRID(ST_MakePoint(-9.1333,38.7167),4326),2267057,'PRT','620','PO','.pt','+351','EUR','Euro','','','{pt-PT,mwl}','{ES}',92090,'Portugal','Portugal','Portugal','geonames',true),
  ('PW','Palaos','OC','Melekeok','USD',18094,ST_SetSRID(ST_MakePoint(134.6,7.4833),4326),1559582,'PLW','585','PS','.pw','+680','USD','Dollar','','','{pau,sov,en,tob}','{none}',459,'Palau','Palau','Palaos','geonames',true),
  ('PY','Paraguay','SA','Asuncion','PYG',7132530,ST_SetSRID(ST_MakePoint(-57.6333,-25.2667),4326),3439389,'PRY','600','PA','.py','+595','PYG','Guarani','','','{es-PY,gn}','{AR,BO,BR}',406752,'Paraguay','Paraguay','Paraguay','geonames',true),
  ('QA','Qatar','AS','Doha','QAR',2881053,ST_SetSRID(ST_MakePoint(51.5333,25.2833),4326),290030,'QAT','634','QA','.qa','+974','QAR','Rial','','','{ar-QA,es}','{SA}',11586,'Qatar','Qatar','Qatar','geonames',true),
  ('RO','Roumanie','EU','Bucarest','RON',19237691,ST_SetSRID(ST_MakePoint(26.1,44.4333),4326),683506,'ROU','642','RO','.ro','+40','RON','Leu','','','{ro,hu,rom,de}','{BG,HU,MD,RS,UA}',238391,'Romania','Romania','Roumanie','geonames',true),
  ('RS','Serbie','EU','Belgrade','RSD',8737371,ST_SetSRID(ST_MakePoint(20.4667,44.8),4326),792680,'SRB','688','RI','.rs','+381','RSD','Dinar','','','{sr,hu,bs,rom}','{BA,BG,HR,HU,ME,MK,RO,XK}',88361,'Serbia','Serbia','Serbie','geonames',true),
  ('RU','Russie','EU','Moscou','RUB',145934462,ST_SetSRID(ST_MakePoint(37.6167,55.75),4326),524901,'RUS','643','RS','.ru','+7','RUB','Ruble','','','{ru,tt,uk,ba,be,av,ce,ch,kv,kk,ud,tk,cy,my,inh,yr,sah,cv,os,sj,ady,bua,ev,kt,mdf,mo,myv}','{AZ,BY,CN,EE,FI,GE,KZ,KP,LV,LT,MN,NO,PL,UA}',17098242,'Russia','Russia','Russie','geonames',true),
  ('RW','Rwanda','AF','Kigali','RWF',12952218,ST_SetSRID(ST_MakePoint(30.05,-1.95),4326),202061,'RWA','646','RW','.rw','+250','RWF','Franc','','','{rw,en-RW,fr-RW,sw}','{BI,CD,TZ,UG}',26338,'Rwanda','Rwanda','Rwanda','geonames',true),
  ('SA','Arabie saoudite','AS','Riyad','SAR',34813871,ST_SetSRID(ST_MakePoint(46.7,24.65),4326),108410,'SAU','682','SA','.sa','+966','SAR','Rial','','','{ar-SA}','{IQ,JO,KW,OM,QA,AE,YE}',2149690,'Saudi Arabia','Saudi Arabia','Arabie saoudite','geonames',true),
  ('SB','Îles Salomon','OC','Honiara','SBD',686884,ST_SetSRID(ST_MakePoint(159.95,-9.4333),4326),2108502,'SLB','090','BP','.sb','+677','SBD','Dollar','','','{en-SB,tpi}','{none}',28896,'Solomon Islands','Solomon Islands','Îles Salomon','geonames',true),
  ('SC','Seychelles','AF','Victoria','SCR',98347,ST_SetSRID(ST_MakePoint(55.45,-4.6167),4326),241131,'SYC','690','SE','.sc','+248','SCR','Rupee','','','{en-SC,fr-SC}','{none}',455,'Seychelles','Seychelles','Seychelles','geonames',true),
  ('SD','Soudan','AF','Khartoum','SDG',43849260,ST_SetSRID(ST_MakePoint(32.55,15.6),4326),379252,'SDN','729','SU','.sd','+249','SDG','Pound','','','{ar-SD,en,fia}','{CF,TD,EG,ER,ET,LY,SS}',1861484,'Sudan','Sudan','Soudan','geonames',true),
  ('SE','Suède','EU','Stockholm','SEK',10353442,ST_SetSRID(ST_MakePoint(18.05,59.3333),4326),2673730,'SWE','752','SW','.se','+46','SEK','Krona','','','{sv-SE,se,sma,fi-SE}','{NO,FI}',450295,'Sweden','Sweden','Suède','geonames',true),
  ('SG','Singapour','AS','Singapour','SGD',5850342,ST_SetSRID(ST_MakePoint(103.85,1.3),4326),1880252,'SGP','702','SN','.sg','+65','SGD','Dollar','','','{cmn,en-SG,ms-SG,ta-SG}','{none}',710,'Singapore','Singapore','Singapour','geonames',true),
  ('SI','Slovénie','EU','Ljubljana','EUR',2078938,ST_SetSRID(ST_MakePoint(14.5167,46.05),4326),3196359,'SVN','705','SI','.si','+386','EUR','Euro','','','{sl,sh}','{AT,HR,IT,HU}',20273,'Slovenia','Slovenia','Slovénie','geonames',true),
  ('SK','Slovaquie','EU','Bratislava','EUR',5459642,ST_SetSRID(ST_MakePoint(17.1167,48.15),4326),3060972,'SVK','703','LO','.sk','+421','EUR','Euro','','','{sk,hu}','{AT,CZ,HU,PL,UA}',49035,'Slovakia','Slovakia','Slovaquie','geonames',true),
  ('SL','Sierra Leone','AF','Freetown','SLL',7976983,ST_SetSRID(ST_MakePoint(-13.2333,8.4833),4326),2409306,'SLE','694','SL','.sl','+232','SLL','Leone','','','{en-SL,men,tem}','{GN,LR}',71740,'Sierra Leone','Sierra Leone','Sierra Leone','geonames',true),
  ('SM','Saint-Marin','EU','Saint-Marin','EUR',33931,ST_SetSRID(ST_MakePoint(12.4167,43.9333),4326),3168068,'SMR','674','SM','.sm','+378','EUR','Euro','','','{it}','{IT}',61,'San Marino','San Marino','Saint-Marin','geonames',true),
  ('SN','Sénégal','AF','Dakar','XOF',16743927,ST_SetSRID(ST_MakePoint(-17.45,14.7),4326),2253354,'SEN','686','SG','.sn','+221','XOF','CFA Franc','','','{fr-SN,wo,fuc,mnk}','{GM,GN,GW,ML,MR}',196722,'Senegal','Senegal','Sénégal','geonames',true),
  ('SO','Somalie','AF','Mogadiscio','SOS',15893222,ST_SetSRID(ST_MakePoint(45.3333,2.0667),4326),53654,'SOM','706','SO','.so','+252','SOS','Shilling','','','{so-SO,ar,it,en}','{DJ,ET,KE}',637657,'Somalia','Somalia','Somalie','geonames',true),
  ('SR','Suriname','SA','Paramaribo','SRD',586634,ST_SetSRID(ST_MakePoint(-55.1667,5.8667),4326),3383330,'SUR','740','NS','.sr','+597','SRD','Dollar','','','{nl-SR,en,srn,hns,jv}','{BR,GF,GY}',163820,'Suriname','Suriname','Suriname','geonames',true),
  ('SS','Soudan du Sud','AF','Djouba','SSP',11193725,ST_SetSRID(ST_MakePoint(31.6,4.85),4326),373303,'SSD','728','OD','.ss','+211','SSP','Pound','','','{en}','{CD,CF,ET,KE,SD,UG}',644329,'South Sudan','South Sudan','Soudan du Sud','geonames',true),
  ('ST','Sao Tomé-et-Principe','AF','São Tomé','STN',219159,ST_SetSRID(ST_MakePoint(6.7333,0.3333),4326),2410763,'STP','678','TP','.st','+239','STN','Dobra','','','{pt-ST}','{none}',964,'Sao Tome and Principe','Sao Tome and Principe','Sao Tomé-et-Principe','geonames',true),
  ('SV','Salvador','NA','San Salvador','USD',6486205,ST_SetSRID(ST_MakePoint(-89.2,13.7),4326),3583361,'SLV','222','ES','.sv','+503','USD','Dollar','','','{es-SV}','{GT,HN}',21041,'El Salvador','El Salvador','Salvador','geonames',true),
  ('SY','Syrie','AS','Damas','SYP',17500658,ST_SetSRID(ST_MakePoint(36.3,33.5),4326),170654,'SYR','760','SY','.sy','+963','SYP','Pound','','','{ar-SY,ku,hy,fr,en}','{IQ,IL,JO,LB,TR}',185180,'Syria','Syria','Syrie','geonames',true),
  ('SZ','Eswatini','AF','Mbabane','SZL',1160164,ST_SetSRID(ST_MakePoint(31.1333,-26.3167),4326),934985,'SWZ','748','WZ','.sz','+268','SZL','Lilangeni','','','{en-SZ,ss-SZ}','{MZ,ZA}',17364,'Eswatini','Eswatini','Eswatini','geonames',true),
  ('TD','Tchad','AF','N''Djamena','XAF',16425864,ST_SetSRID(ST_MakePoint(15.05,12.1),4326),2427123,'TCD','148','CD','.td','+235','XAF','CFA Franc','','','{fr-TD,ar-TD,sre}','{CM,CF,LY,NE,NG,SD}',1284000,'Chad','Chad','Tchad','geonames',true),
  ('TG','Togo','AF','Lomé','XOF',8278724,ST_SetSRID(ST_MakePoint(1.35,6.1333),4326),2363686,'TGO','768','TO','.tg','+228','XOF','CFA Franc','','','{fr-TG,ee,hna,kbp,dag}','{BJ,BF,GH}',56785,'Togo','Togo','Togo','geonames',true),
  ('TH','Thaïlande','AS','Bangkok','THB',69799978,ST_SetSRID(ST_MakePoint(100.5167,13.75),4326),1609350,'THA','764','TH','.th','+66','THB','Baht','','','{th,en}','{KH,LA,MM,MY}',513120,'Thailand','Thailand','Thaïlande','geonames',true),
  ('TJ','Tadjikistan','AS','Douchanbé','TJS',9537645,ST_SetSRID(ST_MakePoint(68.7833,38.55),4326),1221874,'TJK','762','TI','.tj','+992','TJS','Somoni','','','{tg,ru}','{AF,CN,KG,UZ}',143100,'Tajikistan','Tajikistan','Tadjikistan','geonames',true),
  ('TL','Timor oriental','AS','Dili','USD',1318445,ST_SetSRID(ST_MakePoint(125.5667,-8.55),4326),1645457,'TLS','626','TT','.tl','+670','USD','Dollar','','','{tet,pt-TL,id,en}','{ID}',14874,'East Timor','East Timor','Timor oriental','geonames',true),
  ('TM','Turkménistan','AS','Achgabat','TMT',6031200,ST_SetSRID(ST_MakePoint(58.3833,37.95),4326),162183,'TKM','795','TX','.tm','+993','TMT','Manat','','','{tk,ru}','{AF,IR,KZ,UZ}',488100,'Turkmenistan','Turkmenistan','Turkménistan','geonames',true),
  ('TN','Tunisie','AF','Tunis','TND',11818619,ST_SetSRID(ST_MakePoint(10.1833,36.8),4326),2464470,'TUN','788','TS','.tn','+216','TND','Dinar','','','{ar-TN,fr}','{DZ,LY}',163610,'Tunisia','Tunisia','Tunisie','geonames',true),
  ('TO','Tonga','OC','Nuku''alofa','TOP',105695,ST_SetSRID(ST_MakePoint(-175.2,-21.1333),4326),4032406,'TON','776','TN','.to','+676','TOP','Pa''anga','','','{to,en-TO}','{none}',747,'Tonga','Tonga','Tonga','geonames',true),
  ('TR','Turquie','AS','Ankara','TRY',84339067,ST_SetSRID(ST_MakePoint(32.85,39.9333),4326),323786,'TUR','792','TU','.tr','+90','TRY','Lira','','','{tr-TR,ku,diq,az,av}','{AM,AZ,BG,GE,GR,IR,IQ,SY}',783562,'Turkey','Turkey','Turquie','geonames',true),
  ('TT','Trinité-et-Tobago','NA','Port-d''Espagne','TTD',1399488,ST_SetSRID(ST_MakePoint(-61.5167,10.65),4326),3573891,'TTO','780','TD','.tt','+1868','TTD','Dollar','','','{en-TT,hns,fr,es}','{none}',5130,'Trinidad and Tobago','Trinidad and Tobago','Trinité-et-Tobago','geonames',true),
  ('TV','Tuvalu','OC','Funafuti','AUD',11792,ST_SetSRID(ST_MakePoint(179.1333,-8.5167),4326),2110394,'TUV','798','TV','.tv','+688','AUD','Dollar','','','{tvl,en,sm,gil}','{none}',26,'Tuvalu','Tuvalu','Tuvalu','geonames',true),
  ('TW','Taïwan','AS','Taipei','TWD',23816775,ST_SetSRID(ST_MakePoint(121.5667,25.0333),4326),1668341,'TWN','158','TW','.tw','+886','TWD','Dollar','','','{zh-TW,zh,nan,hak}','{none}',36193,'Taiwan','Taiwan','Taïwan','geonames',true),
  ('TZ','Tanzanie','AF','Dodoma','TZS',59734218,ST_SetSRID(ST_MakePoint(35.75,-6.1667),4326),160196,'TZA','834','TZ','.tz','+255','TZS','Shilling','','','{sw-TZ,en,ar}','{BI,CD,KE,MW,MZ,RW,UG,ZM}',945087,'Tanzania','Tanzania','Tanzanie','geonames',true),
  ('UA','Ukraine','EU','Kiev','UAH',43733762,ST_SetSRID(ST_MakePoint(30.5167,50.4333),4326),703448,'UKR','804','UP','.ua','+380','UAH','Hryvnia','','','{uk,ru-UA,be,hu,ro,pl}','{BY,HU,MD,PL,RO,RU,SK}',603550,'Ukraine','Ukraine','Ukraine','geonames',true),
  ('UG','Ouganda','AF','Kampala','UGX',45741007,ST_SetSRID(ST_MakePoint(32.5833,0.3167),4326),232422,'UGA','800','UG','.ug','+256','UGX','Shilling','','','{en-UG,lg,sw,ar}','{CD,KE,RW,SS,TZ}',241038,'Uganda','Uganda','Ouganda','geonames',true),
  ('US','États-Unis','NA','Washington','USD',331002651,ST_SetSRID(ST_MakePoint(-77.0333,38.9),4326),4140963,'USA','840','US','.us','+1','USD','Dollar','','','{en-US,es-US,haw,fr}','{CA,MX,CU}',9833520,'United States','United States','États-Unis','geonames',true),
  ('UY','Uruguay','SA','Montevideo','UYU',3473730,ST_SetSRID(ST_MakePoint(-56.1667,-34.8833),4326),3441575,'URY','858','UY','.uy','+598','UYU','Peso','','','{es-UY}','{AR,BR}',176215,'Uruguay','Uruguay','Uruguay','geonames',true),
  ('UZ','Ouzbékistan','AS','Tachkent','UZS',33469199,ST_SetSRID(ST_MakePoint(69.25,41.3167),4326),1512569,'UZB','860','UZ','.uz','+998','UZS','Som','','','{uz,ru,tg}','{AF,KZ,KG,TJ,TM}',447400,'Uzbekistan','Uzbekistan','Ouzbékistan','geonames',true),
  ('VA','Vatican','EU','Vatican','EUR',801,ST_SetSRID(ST_MakePoint(12.45,41.9),4326),3164670,'VAT','336','VT','.va','+379','EUR','Euro','','','{la,it,fr}','{IT}',0.44,'Vatican','Vatican','Vatican','geonames',true),
  ('VC','Saint-Vincent-et-les-Grenadines','NA','Kingstown','XCD',110940,ST_SetSRID(ST_MakePoint(-61.2167,13.15),4326),3577887,'VCT','670','VC','.vc','+1784','XCD','Dollar','','','{en-VC,fr}','{none}',389,'Saint Vincent and the Grenadines','Saint Vincent and the Grenadines','Saint-Vincent-et-les-Grenadines','geonames',true),
  ('VE','Venezuela','SA','Caracas','VES',28435940,ST_SetSRID(ST_MakePoint(-66.9167,10.4833),4326),3646738,'VEN','862','VE','.ve','+58','VES','Bolivar','','','{es-VE}','{BR,CO,GY}',912050,'Venezuela','Venezuela','Venezuela','geonames',true),
  ('VN','Vietnam','AS','Hanoï','VND',97338579,ST_SetSRID(ST_MakePoint(105.85,21.0333),4326),1581130,'VNM','704','VM','.vn','+84','VND','Dong','','','{vi,en,fr,zh,km}','{KH,CN,LA}',331212,'Vietnam','Vietnam','Vietnam','geonames',true),
  ('VU','Vanuatu','OC','Port-Vila','VUV',307150,ST_SetSRID(ST_MakePoint(168.3167,-17.7333),4326),2135171,'VUT','548','NH','.vu','+678','VUV','Vatu','','','{bi,en-VU,fr-VU}','{none}',12189,'Vanuatu','Vanuatu','Vanuatu','geonames',true),
  ('WS','Samoa','OC','Apia','WST',198410,ST_SetSRID(ST_MakePoint(-171.75,-13.8333),4326),4035413,'WSM','882','WS','.ws','+685','WST','Tala','','','{sm,en-WS}','{none}',2842,'Samoa','Samoa','Samoa','geonames',true),
  ('XK','Kosovo','EU','Pristina','EUR',1831000,ST_SetSRID(ST_MakePoint(21.1667,42.6667),4326),786714,'UNK','-1','KV','.xk','+383','EUR','Euro','','','{sq,sr}','{AL,ME,MK,RS}',10887,'Kosovo','Kosovo','Kosovo','geonames',true),
  ('YE','Yémen','AS','Sanaa','YER',29825964,ST_SetSRID(ST_MakePoint(44.2,15.35),4326),71137,'YEM','887','YM','.ye','+967','YER','Rial','','','{ar-YE}','{OM,SA}',527968,'Yemen','Yemen','Yémen','geonames',true),
  ('ZA','Afrique du Sud','AF','Pretoria','ZAR',59308690,ST_SetSRID(ST_MakePoint(28.1833,-25.75),4326),964137,'ZAF','710','SF','.za','+27','ZAR','Rand','','','{zu,xh,af,nso,en-ZA,tn,st,ts,ss,ve,nr}','{BW,LS,MZ,NA,SZ,ZW}',1221037,'South Africa','South Africa','Afrique du Sud','geonames',true),
  ('ZM','Zambie','AF','Lusaka','ZMW',18383955,ST_SetSRID(ST_MakePoint(28.2833,-15.4167),4326),909137,'ZMB','894','ZA','.zm','+260','ZMW','Kwacha','','','{en-ZM,bem,loz,lun,ny,toi}','{AO,BW,CD,MZ,NA,TZ,ZW}',752612,'Zambia','Zambia','Zambie','geonames',true),
  ('ZW','Zimbabwe','AF','Harare','ZWL',14862924,ST_SetSRID(ST_MakePoint(31.05,-17.8167),4326),890299,'ZWE','716','ZI','.zw','+263','ZWL','Dollar','','','{en-ZW,sn,nr,nd}','{BW,MZ,ZA,ZM}',390757,'Zimbabwe','Zimbabwe','Zimbabwe','geonames',true)
ON CONFLICT (iso_a2) DO UPDATE SET
  name = EXCLUDED.name,
  continent = EXCLUDED.continent,
  capital = EXCLUDED.capital,
  currency = EXCLUDED.currency,
  population = EXCLUDED.population,
  geometry = EXCLUDED.geometry,
  geoname_id = EXCLUDED.geoname_id,
  iso_a3 = EXCLUDED.iso_a3,
  iso_numeric = EXCLUDED.iso_numeric,
  fips_code = EXCLUDED.fips_code,
  tld = EXCLUDED.tld,
  phone_code = EXCLUDED.phone_code,
  currency_code = EXCLUDED.currency_code,
  currency_name = EXCLUDED.currency_name,
  postal_code_format = EXCLUDED.postal_code_format,
  postal_code_regex = EXCLUDED.postal_code_regex,
  languages = EXCLUDED.languages,
  neighbours = EXCLUDED.neighbours,
  area_km2 = EXCLUDED.area_km2,
  name_ascii = EXCLUDED.name_ascii,
  name_en = EXCLUDED.name_en,
  name_short = EXCLUDED.name_short,
  geometry_source = EXCLUDED.geometry_source,
  is_sovereign = EXCLUDED.is_sovereign;

-- ── 3. Vérifications post-seed ──────────────────────────────
DO $$
DECLARE
  n integer;
  missing integer;
BEGIN
  SELECT count(*) INTO n FROM public.countries_geo WHERE iso_a2 IS NOT NULL;
  RAISE NOTICE 'countries_geo : % pays peuplés', n;

  SELECT count(*) INTO missing
  FROM public.countries_geo
  WHERE geometry IS NULL OR geoname_id IS NULL;
  IF missing > 0 THEN
    RAISE WARNING 'countries_geo : % pays sans géométrie ou geoname_id (doit être 0)', missing;
  END IF;
END;
$$;
