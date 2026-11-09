-- ════════════════════════════════════════════════════════════════════════
-- Kit Studio · taxonomie de fonctions, volumes et placement dans le sac
-- Appliquée le 2026-11-07 (version enregistrée : 20261107123212).
-- Source : kit-studio-bundle/db/20261104010000_gear_taxonomy.sql.
-- Testée à blanc (BEGIN … ROLLBACK) avant application.
-- Débloque : échange « même fonction », « ça rentre ? », ordre de chargement,
-- accessibilité, doublons, kit généré depuis un départ.
-- Rollback : supabase/migrations_down/20261107123212_gear_taxonomy.down.sql
--
-- Écart assumé par rapport au script du bundle : l'UPDATE de classement de
-- product_ownership exclut les objets engagés (status en_pret/en_location/vendu).
-- Ces lignes sont immuables par le trigger préexistant inventory_guard (migration
-- antérieure à ce chantier) ; les toucher fait échouer toute la migration. Elles
-- restent donc non classées et apparaissent dans la vue gear_function_review.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Référentiel des fonctions (remplace les 59 libellés libres de catégorie)
create table if not exists public.gear_functions (
  id               text primary key,
  family           text not null,
  label_fr         text not null,
  default_zone     text check (default_zone in ('worn','lid','main','front','sides','hip','back')),
  access_priority  smallint not null default 0,   -- 2 = doit rester accessible en marchant
  is_vital_default boolean  not null default false,
  shape_kind       text not null                  -- primitive 3D par défaut
);
alter table public.gear_functions enable row level security;
drop policy if exists "gear_functions_lecture" on public.gear_functions;
create policy "gear_functions_lecture" on public.gear_functions for select using (true);

insert into public.gear_functions (id,family,label_fr,default_zone,access_priority,is_vital_default,shape_kind) values
 ('shelter','Abri & couchage','Abri','main',0,true,'roll'),
 ('sleep','Abri & couchage','Sac de couchage','main',0,true,'roll'),
 ('sleeppad','Abri & couchage','Matelas','main',0,true,'roll'),
 ('pillow','Abri & couchage','Oreiller','main',0,false,'sack'),
 ('rainshell','Vêtements','Veste imperméable','front',2,true,'jacket'),
 ('rainpants','Vêtements','Surpantalon','main',1,false,'jacket'),
 ('insulation','Vêtements','Couche chaude','main',1,true,'jacket'),
 ('midlayer','Vêtements','Polaire','main',1,false,'jacket'),
 ('baselayer','Vêtements','Première couche','worn',0,false,'jacket'),
 ('legwear','Vêtements','Bas','worn',0,false,'jacket'),
 ('coldhead','Vêtements','Bonnet','lid',1,false,'hat'),
 ('sunhead','Vêtements','Protection de la tête','worn',1,false,'hat'),
 ('gloves','Vêtements','Gants','lid',1,false,'sack'),
 ('socks','Vêtements','Chaussettes','main',0,false,'sack'),
 ('footwear','Vêtements','Chaussures','worn',0,true,'shoe'),
 ('gaiters','Vêtements','Guêtres','main',0,false,'sack'),
 ('clothes','Vêtements','Rechange','main',0,false,'sack'),
 ('water','Eau & cuisine','Contenant d’eau','sides',2,true,'bottle'),
 ('watertreat','Eau & cuisine','Traitement de l’eau','lid',1,false,'bottle'),
 ('cook','Eau & cuisine','Cuisine','main',0,false,'stove'),
 ('fuel','Eau & cuisine','Combustible','main',0,false,'bottle'),
 ('food','Eau & cuisine','Repas','main',0,true,'sack'),
 ('snack','Eau & cuisine','En-cas','hip',2,false,'sack'),
 ('light','Lumière & énergie','Éclairage','lid',2,true,'lamp'),
 ('power','Lumière & énergie','Énergie','lid',1,false,'box'),
 ('comm','Lumière & énergie','Communication','hip',2,true,'phone'),
 ('nav','Orientation & outils','Instrument de navigation','worn',2,false,'watch'),
 ('map','Orientation & outils','Carte','lid',2,false,'map'),
 ('poles','Orientation & outils','Bâtons','front',1,false,'poles'),
 ('tool','Orientation & outils','Outil','hip',1,false,'knife'),
 ('technical','Orientation & outils','Matériel technique','front',1,false,'box'),
 ('optics','Orientation & outils','Optique et photo','hip',1,false,'box'),
 ('sun','Sécurité & soin','Lunettes','hip',2,false,'glasses'),
 ('firstaid','Sécurité & soin','Premiers secours','lid',2,true,'box'),
 ('emergency','Sécurité & soin','Urgence','lid',2,true,'blanket'),
 ('sunscreen','Sécurité & soin','Protection solaire','hip',2,false,'tube'),
 ('insect','Sécurité & soin','Anti-insectes','lid',1,false,'tube'),
 ('hygiene','Sécurité & soin','Hygiène','main',0,false,'box'),
 ('footcare','Sécurité & soin','Soin des pieds','lid',1,false,'box'),
 ('pack','Portage','Sac à dos',null,0,true,'bag'),
 ('organizer','Portage','Rangement','main',0,false,'sack'),
 ('documents','Voyage','Documents','hip',2,true,'map'),
 ('laptop','Voyage','Ordinateur','back',0,false,'laptop')
on conflict (id) do nothing;

-- 2) Classement automatique par le nom (test à blanc : 87,4 % des objets de kit, 86 % de l’inventaire)
create or replace function public.lkdv_classify_gear(p_name text)
returns text language sql immutable set search_path = '' as $$
 select case
  when n ~ '(sac de couchage|duvet|quilt|drap de sac)' then 'sleep'
  when n ~ '(matelas|tapis de sol)' then 'sleeppad'
  when n ~ 'oreiller' then 'pillow'
  when n ~ '(tente|tarp|abri|bivy|hamac)' then 'shelter'
  when n ~ '(surpantalon|pantalon de pluie|pantalon imper)' then 'rainpants'
  when n ~ '(poncho|cape de pluie|k-way|hardshell|veste.*(imper|pluie|gore|étanche))' then 'rainshell'
  when n ~ '(doudoune|primaloft|veste.*(isol|synth|duvet))' then 'insulation'
  when n ~ '(polaire|softshell|fleece)' then 'midlayer'
  when n ~ '(t-shirt|tee-shirt|sous-v|m[ée]rinos|maillot|carline|première couche)' then 'baselayer'
  when n ~ '(rechange)' then 'clothes'
  when n ~ '(pantalon|short|collant|legging)' then 'legwear'
  when n ~ '(bonnet|cagoule)' then 'coldhead'
  when n ~ '(casquette|chapeau|bob|buff|tour de cou|bandana)' then 'sunhead'
  when n ~ '(gant|moufle)' then 'gloves'
  when n ~ 'chaussette' then 'socks'
  when n ~ '(chaussure|botte|sandale|tong|basket)' then 'footwear'
  when n ~ 'gu[êe]tre' then 'gaiters'
  when n ~ '(ampoule|compeed|soin des pieds|crème pied)' then 'footcare'
  when n ~ '(frontale|lampe|torche|lanterne)' then 'light'
  when n ~ '(batterie|power ?bank|chargeur|panneau solaire|c[âa]ble|\ypiles?\y)' then 'power'
  when n ~ '(t[ée]l[ée]phone|smartphone|balise|talkie|inreach|satellite|radio)' then 'comm'
  when n ~ '(passeport|papiers|argent|carte d.identit|portefeuille|assurance|billet)' then 'documents'
  when n ~ '(boussole|gps|montre|altim)' then 'nav'
  when n ~ '(carte|topo)' then 'map'
  when n ~ '(filtre|pastille|purif|steripen|micropur)' then 'watertreat'
  when n ~ '(gourde|bouteille|poche à eau|camel|bidon|flasque|thermos)' then 'water'
  when n ~ '(cartouche|gaz|combustible|alcool)' then 'fuel'
  when n ~ '(r[ée]chaud|popote|casserole|gamelle|tasse|mug|couvert|spork|cuill|briquet|allume|bol|assiette|po[êe]le)' then 'cook'
  when n ~ '(repas|lyophil|nourriture|ration)' then 'food'
  when n ~ '(barre|fruits secs|snack|g[âa]teau|chocolat)' then 'snack'
  when n ~ '(couverture de survie|sifflet)' then 'emergency'
  when n ~ '(trousse.*(secours|soin|premiers)|pansement|secours|pharmacie|m[ée]dic)' then 'firstaid'
  when n ~ '(crème solaire|[ée]cran solaire|stick|baume|spf)' then 'sunscreen'
  when n ~ '(anti-?moustique|r[ée]pulsif|tique)' then 'insect'
  when n ~ '(brosse à dents|dentifrice|savon|papier toilette|lingette|serviette|trousse de toilette|truelle|d[ée]odorant|hygi)' then 'hygiene'
  when n ~ 'lunettes' then 'sun'
  when n ~ '(crampon|piolet|casque|baudrier|corde|mousqueton|longe|dva|raquettes)' then 'technical'
  when n ~ 'b[âa]ton' then 'poles'
  when n ~ '(couteau|opinel|multi-?outil|pince|ciseaux|r[ée]paration|rustine|scotch|duct|aiguille|cordelette)' then 'tool'
  when n ~ '(ordinateur|laptop|macbook)' then 'laptop'
  when n ~ 'sac (à|a) dos' then 'pack'
  when n ~ '(sac [ée]tanche|dry ?bag|pochette|organis|housse|sac de compression|sac)' then 'organizer'
  when n ~ '(appareil photo|cam[ée]ra|gopro|jumelle|objectif|trépied)' then 'optics'
  else null end
 from (select lower(coalesce(p_name,'')) as n) s
$$;

-- 3) Colonnes manquantes pour un vrai créateur de sac
alter table public.product_ownership
  add column if not exists function_id     text references public.gear_functions(id),
  add column if not exists function_source text check (function_source in ('regle','ia','manuel')),
  add column if not exists volume_ml       integer check (volume_ml >= 0),
  add column if not exists dims_mm         integer[] check (dims_mm is null or array_length(dims_mm,1) = 3);

alter table public.materiel_kit_items
  add column if not exists function_id text references public.gear_functions(id),
  add column if not exists zone        text check (zone in ('worn','lid','main','front','sides','hip','back')),
  add column if not exists slot        text check (slot in ('bottom','bottomF','midBack','midFront','top')),
  add column if not exists load_order  smallint,
  add column if not exists carry_mode  text check (carry_mode in ('base','consumable','worn'));

create index if not exists product_ownership_function_idx  on public.product_ownership(function_id);
create index if not exists materiel_kit_items_function_idx on public.materiel_kit_items(function_id);

-- 4) Remplissage automatique (seulement là où la règle est sûre ET où l'objet reste
--    modifiable : les objets engagés — en_pret/en_location/vendu — sont protégés par
--    le trigger préexistant inventory_guard)
update public.product_ownership
   set function_id = public.lkdv_classify_gear(name), function_source = 'regle'
 where function_id is null and public.lkdv_classify_gear(name) is not null
   and status not in ('en_pret','en_location','vendu');

update public.materiel_kit_items
   set function_id = public.lkdv_classify_gear(name)
 where function_id is null and public.lkdv_classify_gear(name) is not null;

-- 5) Ce qui reste à classer (marques, vélo, avalanche…) : à passer à l’IA puis en revue
create or replace view public.gear_function_review with (security_invoker = true) as
  select 'product_ownership'::text as source, id, name, category from public.product_ownership where function_id is null
  union all
  select 'materiel_kit_items', id, name, category from public.materiel_kit_items where function_id is null;


-- 6) À décider séparément, après vérification que rien ne les lit plus (toutes vides aujourd’hui) :
-- drop table public.kits, public.kit_items, public.custom_kits, public.custom_kit_items;
