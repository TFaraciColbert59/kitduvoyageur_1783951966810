-- ============================================================================
-- lot_z1_vie_privee_rattrapage.sql — Rattrapage de vie privée des voyages DÉJÀ
-- préparés par le Compas (lot Z1, PLAN-100 §4.1 et §4.2)
--
-- ⚠️  SCRIPT ÉCRIT, NON APPLIQUÉ. À passer par Tony dans le SQL Editor Supabase
--     (rôle postgres), D'ABORD sur une branche ou une copie, puis en production.
--     Ce n'est PAS une migration : il ne vit pas dans supabase/migrations et ne
--     s'exécute jamais seul.
--
-- POURQUOI
--   Avant le lot Z1, la préparation (compasAutofillAction) rangeait sur le voyage
--   (`trips.metadata`, `trip_expenses`), lisibles par les collaborateurs et, pour un
--   voyage `public` / `unlisted`, par la clé anon, des lignes qui dépendent du PROFIL
--   du lanceur :
--     1. « Papiers : … » (nationalité : « passeport valide, sans visa … », « carte
--        d’identité … ») — déjà neutralisée pour les préparations récentes ;
--     2. « Prises de type G : adaptateur à prévoir. » (appareils de France, donc la
--        résidence) ;
--     3. des conseils de l’IA filtrés avec la devise et la résidence du lanceur
--        (leur présence trahit « devise ≠ euro » ou « appareils non français ») ;
--     4. la dépense « Formalités : ESTA (40 $) » et sa base « … ressortissant
--        français … », recopiée dans `autofill_result.summary.budget` et comptée dans
--        le total et l’enveloppe auto-fixée.
--   Le code ne range plus que des lignes neutres ; chaque lecteur reçoit SA ligne à
--   la lecture (getCompasData). Ce script nettoie ce qui est DÉJÀ rangé.
--
-- CE QUE FAIT LA CORRECTION (étape B, une seule transaction)
--   a. `compas.autofill.notes` et `compas.autofill_result.summary.notes` :
--        - chaque élément « Papiers : … » qui n’est pas déjà la ligne neutre est
--          remplacé, à sa place, par « Papiers : conditions d’entrée (<pays>) à vérifier
--          auprès du service officiel de ton pays avant de partir. » (une seule ligne) ;
--        - chaque élément « Prises de type X … » qui n’est pas déjà la ligne neutre est
--          remplacé par « Prises de type X (<pays>) : vérifie que tes chargeurs s’y
--          branchent. » (le type de prise ne dépend que du pays) ;
--        - les conseils de l’IA (« Suggestion de l’IA (facultatif) : … ») qui parlent
--          d’adaptateur / de prises, ou de change quand la destination est en zone
--          euro, sont retirés (le nouveau filtre, sans profil, ne les aurait pas
--          rangés) ;
--        - le pays est celui que le voyage a rangé (`autofill.papers`, sinon le lieu
--          retrouvé sur la carte, sinon `trips.destination_country_code`) ; sans pays
--          connu, la ligne est retirée plutôt que devinée.
--   b. `compas.autofill_result.summary.budget` : les lignes « Formalités : … » (et toute
--      ligne dont la base dit « ressortissant français ») sont retirées, `summary.total`
--      est recalculé. Si la préparation avait fixé l’enveloppe (`autofill.budgetSet`) et
--      que `trips.estimated_budget` vaut encore exactement l’ancien total, elle est
--      abaissée du montant des formalités (une enveloppe modifiée depuis n’est jamais
--      touchée).
--   c. `trip_expenses` : les dépenses « Formalités : … » ÉCRITES PAR UNE PRÉPARATION
--      (`metadata.autofill` présent ET base « ressortissant français ») sont supprimées ;
--      leurs identifiants sont retirés de `compas.autofill.expenseIds`. Une dépense
--      saisie à la main, même nommée « Formalités : … », n’est jamais touchée.
--   d. Le déclencheur `trg_trips_updated_at` remet `updated_at` à jour sur les voyages
--      corrigés : les écrans rechargent.
--   La ligne « Formalités » de chaque lecteur est calculée par le code à la lecture ; ce
--   script n’a rien à y recréer.
--
-- IDEMPOTENT : un second passage ne trouve plus rien (les fonctions sont les mêmes ; les
-- UPDATE ne touchent que les lignes dont la valeur change ; le DELETE ne trouve plus de
-- dépense). Les compteurs de l’étape A tombent à 0 et y restent.
--
-- MODE D’EMPLOI (l’éditeur n’affiche que le résultat de la DERNIÈRE requête : lance chaque
-- étape séparément, en sélectionnant son bloc puis « Run »)
--   1. Étape A : le SELECT de contrôle, AVANT. Note les compteurs.
--   2. Étape B : la transaction (de BEGIN à COMMIT). Pour une répétition à blanc,
--      remplace la dernière ligne `commit;` par `rollback;` : rien n’est gardé.
--   3. Étape A de nouveau : TOUS les compteurs doivent valoir 0.
--
-- ⚠️ Aucun secret, aucune donnée personnelle dans ce fichier. Il ne lit ni n’écrit
--    `user_traveller` : le profil de personne n’est jamais touché, seuls les voyages le sont.
--
-- VALIDATION FAITE : exécuté (étapes A, B, A, puis B encore, et une répétition à blanc en
-- `rollback`) sur un PostgreSQL 16 jetable avec dix voyages factices (avant/après le
-- correctif, enveloppe modifiée à la main, dépense « Formalités » saisie à la main, métadonnées
-- vides ou nulles) : seules les lignes attendues changent, un second passage ne change rien.
-- Les textes neutres et les listes (zone euro, expressions de change et de prises) sont
-- vérifiés contre le code par src/features/compas/__tests__/rattrapageSql.test.ts. Cela ne
-- remplace pas la validation sur une branche ou une copie de la base réelle.
-- ============================================================================


-- ============================================================================
-- ÉTAPE A — CONTRÔLE (lecture seule). À lancer AVANT, puis APRÈS l’étape B.
-- Chaque colonne compte des VOYAGES (ou des lignes) à corriger ; toutes doivent valoir 0
-- une fois l’étape B passée.
-- ============================================================================
with t0 as (
  select t.id,
         t.visibility::text as visibility,
         t.metadata,
         upper(coalesce(
           nullif(btrim(t.metadata #>> '{compas,autofill,papers,countryCode}'), ''),
           nullif(btrim(t.metadata #>> '{compas,anchor,countryCode}'), ''),
           t.destination_country_code
         )) as code
  from public.trips t
  where jsonb_typeof(t.metadata) = 'object'
),
notes as (
  select t0.id, t0.visibility, t0.code, n.value #>> '{}' as note
  from t0
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(t0.metadata #> '{compas,autofill,notes}') = 'array'
         then t0.metadata #> '{compas,autofill,notes}' else '[]'::jsonb end
  ) as n(value)
  where jsonb_typeof(n.value) = 'string'
  union all
  select t0.id, t0.visibility, t0.code, n.value #>> '{}' as note
  from t0
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(t0.metadata #> '{compas,autofill_result,summary,notes}') = 'array'
         then t0.metadata #> '{compas,autofill_result,summary,notes}' else '[]'::jsonb end
  ) as n(value)
  where jsonb_typeof(n.value) = 'string'
),
budget_lines as (
  select t0.id, t0.visibility, l.value as line
  from t0
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(t0.metadata #> '{compas,autofill_result,summary,budget}') = 'array'
         then t0.metadata #> '{compas,autofill_result,summary,budget}' else '[]'::jsonb end
  ) as l(value)
  where jsonb_typeof(l.value) = 'object'
),
bad_notes as (
  select * from notes
  where
    -- « Papiers : … » qui n’est pas la ligne neutre
    (note like 'Papiers :%'
       and note !~ '^Papiers : conditions d’entrée \(.+\) à vérifier auprès du service officiel de ton pays avant de partir\.$')
    -- « Prises de type … » qui n’est pas la ligne neutre
    or (note like 'Prises de type %'
       and note !~ '^Prises de type [^ :]+ \(.+\) : vérifie que tes chargeurs s’y branchent\.$')
    -- conseil de l’IA sur les prises, ou sur le change en zone euro
    or (note like 'Suggestion de l’IA (facultatif) : %'
       and (note ~* 'adaptateur|prises? (électriques?|de type)'
         or (code = any (array['FR','RE','GP','MQ','GF','YT','PM','BL','MF','AT','BE','BG','HR','CY','EE','FI','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES','AD','MC','SM','VA','ME','XK'])
             and note ~* 'bureau de change|taux de change|devises?\y|monnaie locale|changer (de l[’''])?argent|changer (tes |vos |des )?euros|change tes euros|change vos euros')))
),
bad_lines as (
  select * from budget_lines
  where (line ->> 'title') like 'Formalités : %' or (line ->> 'basis') like '%ressortissant français%'
),
bad_expenses as (
  select e.id, e.trip_id
  from public.trip_expenses e
  where e.title like 'Formalités : %'
    and e.metadata ->> 'autofill' is not null
    and e.metadata ->> 'basis' like '%ressortissant français%'
)
select
  (select count(distinct id) from bad_notes)                                          as voyages_notes_a_neutraliser,
  (select count(distinct id) from bad_notes where visibility <> 'private')            as dont_publics_ou_non_listes,
  (select count(distinct id) from bad_notes where note like 'Papiers :%')             as voyages_papiers_non_neutres,
  (select count(distinct id) from bad_notes where note like 'Prises de type %')       as voyages_prises_non_neutres,
  (select count(distinct id) from bad_notes where note like 'Suggestion de l’IA%')    as voyages_conseils_ia_change_ou_prises,
  (select count(distinct id) from bad_lines)                                          as voyages_lignes_budget_formalites,
  (select count(*) from bad_expenses)                                                 as depenses_formalites_a_supprimer;


-- ============================================================================
-- ÉTAPE B — CORRECTION (une seule transaction). Lancer de BEGIN à COMMIT.
-- ============================================================================
begin;

-- B.1 — Fonctions temporaires (propres à cette session, disparaissent avec elle) -----------

-- Les notes rangées, rendues neutres : mêmes règles que le code (engine/papers.ts :
-- sharedNotes, sharedRules). `code` : pays (ISO 3166-1 alpha-2) ou null ; `label` : le nom
-- du pays tel que la ligne le dit (sinon le code) ou null.
create or replace function pg_temp.z1_clean_notes(notes jsonb, code text, label text)
returns jsonb
language plpgsql
as $fn$
declare
  el jsonb;
  note text;
  plug text;
  out jsonb := '[]'::jsonb;
  seen_papers boolean := false;
  seen_plugs boolean := false;
  -- Zone euro, comme `EURO` dans engine/papers.ts.
  euro boolean := code is not null and code = any (array[
    'FR','RE','GP','MQ','GF','YT','PM','BL','MF','AT','BE','BG','HR','CY','EE','FI','DE','GR','IE','IT','LV','LT',
    'LU','MT','NL','PT','SK','SI','ES','AD','MC','SM','VA','ME','XK'
  ]);
  neutral_papers constant text := $re$^Papiers : conditions d’entrée \(.+\) à vérifier auprès du service officiel de ton pays avant de partir\.$$re$;
  neutral_plugs  constant text := $re$^Prises de type [^ :]+ \(.+\) : vérifie que tes chargeurs s’y branchent\.$$re$;
  plug_re  constant text := $re$adaptateur|prises? (électriques?|de type)$re$;
  money_re constant text := $re$bureau de change|taux de change|devises?\y|monnaie locale|changer (de l[’'])?argent|changer (tes |vos |des )?euros|change tes euros|change vos euros$re$;
begin
  if jsonb_typeof(notes) is distinct from 'array' then
    return notes;
  end if;
  for el in
    select value from jsonb_array_elements(notes) with ordinality as t(value, ord) order by ord
  loop
    if jsonb_typeof(el) <> 'string' then
      out := out || jsonb_build_array(el);
      continue;
    end if;
    note := el #>> '{}';
    if note like 'Papiers :%' then
      -- Une seule ligne « Papiers », neutre, à la place de la première.
      if not seen_papers then
        if note ~ neutral_papers then
          out := out || jsonb_build_array(el);
        elsif label is not null then
          out := out || jsonb_build_array(to_jsonb(format(
            'Papiers : conditions d’entrée (%s) à vérifier auprès du service officiel de ton pays avant de partir.', label)));
        end if;
      end if;
      seen_papers := true;
    elsif note like 'Prises de type %' then
      if not seen_plugs then
        plug := substring(note from '^Prises de type ([^ :]+)');
        if note ~ neutral_plugs then
          out := out || jsonb_build_array(el);
        elsif label is not null and plug is not null then
          out := out || jsonb_build_array(to_jsonb(format(
            'Prises de type %s (%s) : vérifie que tes chargeurs s’y branchent.', plug, label)));
        end if;
      end if;
      seen_plugs := true;
    elsif note like 'Suggestion de l’IA (facultatif) : %'
          and (note ~* plug_re or (euro and note ~* money_re)) then
      null; -- retiré : le filtre sans profil ne l’aurait pas rangé
    else
      out := out || jsonb_build_array(el);
    end if;
  end loop;
  return out;
end
$fn$;

-- Les métadonnées d’un voyage, neutralisées. `gone_ids` : identifiants (texte) des dépenses
-- « Formalités » supprimées de CE voyage, à retirer de `compas.autofill.expenseIds`.
create or replace function pg_temp.z1_fix_metadata(meta jsonb, dest text, gone_ids jsonb)
returns jsonb
language plpgsql
as $fn$
declare
  autofill jsonb;
  result jsonb;
  anchor jsonb;
  code text;
  label text;
  cleaned jsonb;
  budget jsonb;
begin
  if jsonb_typeof(meta) is distinct from 'object' then
    return meta;
  end if;
  autofill := meta #> '{compas,autofill}';
  result := meta #> '{compas,autofill_result}';
  anchor := meta #> '{compas,anchor}';
  code := upper(coalesce(
    nullif(btrim(autofill #>> '{papers,countryCode}'), ''),
    nullif(btrim(anchor ->> 'countryCode'), ''),
    dest
  ));
  if code is null or code !~ '^[A-Z]{2}$' then
    code := null;
  end if;
  label := coalesce(
    nullif(btrim(autofill #>> '{papers,country}'), ''),
    nullif(btrim(anchor ->> 'country'), ''),
    code
  );

  -- a. notes rangées par la préparation, et notes de l’issue
  if jsonb_typeof(autofill -> 'notes') = 'array' then
    cleaned := pg_temp.z1_clean_notes(autofill -> 'notes', code, label);
    if cleaned is distinct from autofill -> 'notes' then
      meta := jsonb_set(meta, '{compas,autofill,notes}', cleaned);
    end if;
  end if;
  if jsonb_typeof(result #> '{summary,notes}') = 'array' then
    cleaned := pg_temp.z1_clean_notes(result #> '{summary,notes}', code, label);
    if cleaned is distinct from result #> '{summary,notes}' then
      meta := jsonb_set(meta, '{compas,autofill_result,summary,notes}', cleaned);
    end if;
  end if;

  -- b. lignes de budget de l’issue : plus de « Formalités » ni de base « ressortissant français »
  budget := result #> '{summary,budget}';
  if jsonb_typeof(budget) = 'array' then
    select coalesce(jsonb_agg(l.value order by l.ord), '[]'::jsonb)
      into cleaned
      from jsonb_array_elements(budget) with ordinality as l(value, ord)
     where not (
       jsonb_typeof(l.value) = 'object'
       and ((l.value ->> 'title') like 'Formalités : %' or (l.value ->> 'basis') like '%ressortissant français%')
     );
    if cleaned is distinct from budget then
      meta := jsonb_set(meta, '{compas,autofill_result,summary,budget}', cleaned);
      meta := jsonb_set(
        meta,
        '{compas,autofill_result,summary,total}',
        to_jsonb((
          select coalesce(sum(case when jsonb_typeof(l.value -> 'amount') = 'number' then (l.value ->> 'amount')::numeric else 0 end), 0)
            from jsonb_array_elements(cleaned) as l(value)
        ))
      );
    end if;
  end if;

  -- c. identifiants de dépenses (pour l’annulation) : ceux qui vont être supprimés disparaissent
  if jsonb_typeof(autofill -> 'expenseIds') = 'array'
     and jsonb_typeof(gone_ids) = 'array'
     and jsonb_array_length(gone_ids) > 0 then
    select coalesce(jsonb_agg(e.value order by e.ord), '[]'::jsonb)
      into cleaned
      from jsonb_array_elements(autofill -> 'expenseIds') with ordinality as e(value, ord)
     where not (gone_ids @> jsonb_build_array(e.value));
    if cleaned is distinct from autofill -> 'expenseIds' then
      meta := jsonb_set(meta, '{compas,autofill,expenseIds}', cleaned);
    end if;
  end if;

  return meta;
end
$fn$;

-- B.2 — Les dépenses « Formalités » écrites par une préparation (avant toute suppression) ---
create temp table z1_formalities on commit drop as
select e.id,
       e.trip_id,
       e.amount,
       e.metadata ->> 'autofill' as run
from public.trip_expenses e
where e.title like 'Formalités : %'
  and e.metadata ->> 'autofill' is not null
  and e.metadata ->> 'basis' like '%ressortissant français%';

-- B.3 — Ce que valait le total rangé par la préparation en cours de chaque voyage concerné ---
-- (somme des dépenses de sa dernière exécution, formalités comprises) et ce qui en sort.
create temp table z1_budget on commit drop as
select t.id as trip_id,
       (select coalesce(sum(x.amount), 0)
          from public.trip_expenses x
         where x.trip_id = t.id
           and x.metadata ->> 'autofill' = t.metadata #>> '{compas,autofill,runId}') as old_total,
       (select coalesce(sum(f.amount), 0)
          from z1_formalities f
         where f.trip_id = t.id
           and f.run = t.metadata #>> '{compas,autofill,runId}') as removed
from public.trips t
where exists (select 1 from z1_formalities f where f.trip_id = t.id);

-- B.4 — Les métadonnées des voyages (seuls ceux dont la valeur change sont réécrits) --------
with fixed as (
  select t.id,
         pg_temp.z1_fix_metadata(
           t.metadata,
           t.destination_country_code,
           coalesce((select jsonb_agg(to_jsonb(f.id::text)) from z1_formalities f where f.trip_id = t.id), '[]'::jsonb)
         ) as metadata
  from public.trips t
  where jsonb_typeof(t.metadata) = 'object'
    and t.metadata #> '{compas}' is not null
)
update public.trips t
   set metadata = f.metadata
  from fixed f
 where f.id = t.id
   and f.metadata is distinct from t.metadata;

-- B.5 — L’enveloppe fixée par la préparation, si elle n’a pas bougé depuis --------------------
update public.trips t
   set estimated_budget = b.old_total - b.removed
  from z1_budget b
 where b.trip_id = t.id
   and t.metadata #>> '{compas,autofill,budgetSet}' = 'true'
   and t.estimated_budget = b.old_total
   and b.removed > 0
   and b.old_total - b.removed > 0;

-- B.6 — Les dépenses « Formalités » de la préparation --------------------------------------
delete from public.trip_expenses e
 using z1_formalities f
 where f.id = e.id;

commit;  -- répétition à blanc : remplacer par `rollback;`

-- ÉTAPE A (bis) : relance maintenant le SELECT de contrôle de l’étape A tel quel. Tous les
-- compteurs doivent valoir 0, et ils y restent si tu relances l’étape B.
