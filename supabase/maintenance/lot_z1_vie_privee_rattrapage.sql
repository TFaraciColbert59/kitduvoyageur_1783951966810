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
--      abaissée du montant des seules formalités SUPPRIMÉES (étape c) ; si elles en étaient
--      tout le montant, elle est remise à vide (NULL, comme l’annulation du préremplissage :
--      « pas de budget »), jamais à 0 ni en négatif. Une enveloppe modifiée depuis n’est
--      jamais touchée.
--   c. `trip_expenses` : les dépenses « Formalités : … » ÉCRITES PAR UNE PRÉPARATION
--      (`metadata.autofill` présent ET base « ressortissant français ») sont classées :
--        - SUPPRIMÉES si elles sont restées intactes : `is_planned` vrai, jamais retouchées
--          (`updated_at` au plus 5 s après `trips.metadata.compas.autofill.at`, la marge de
--          `untouchedSince` dans engine/dependencies.ts, ET au plus 5 s après `created_at`,
--          ce qui écarte une ligne modifiée avant une relance qui a reporté `autofill.at`) ;
--          leurs identifiants sont retirés de `compas.autofill.expenseIds` ;
--        - NEUTRALISÉES sinon (réglée = `is_planned` faux, modifiée, réécrite par un
--          recalcul d’équipe, ou voyage sans `autofill.at` lisible) : la ligne reste, avec
--          son montant, son statut et son titre ; seule la base (`metadata.basis`, qui
--          nomme « ressortissant français ») est remplacée par un texte sans profil. Dans le
--          doute, on neutralise : une dépense n’est supprimée que si elle est prouvée intacte.
--      Une dépense saisie à la main, même nommée « Formalités : … », n’est jamais touchée.
--   d. Le déclencheur `trg_trips_updated_at` remet `updated_at` à jour sur les voyages
--      corrigés : les écrans rechargent.
--   La ligne « Formalités » de chaque lecteur est calculée par le code à la lecture ; ce
--   script n’a rien à y recréer.
--
-- ⚠️ À L’ÉCRAN : `getCompasData` masque les dépenses dont la base dit « ressortissant français »
--    (`isStoredFormalities`). Une ligne NEUTRALISÉE n’est plus masquée : elle s’affiche comme
--    une ligne ordinaire du budget (même titre, même montant, même statut), parce qu’elle a été
--    réglée ou retouchée, donc qu’elle est devenue un choix de la personne. Son TITRE
--    (« Formalités : ESTA (40 $) ») reste lisible : c’est le seul reste, et il ne se retire
--    qu’en supprimant la ligne à la main.
--
-- IDEMPOTENT : un second passage ne trouve plus rien (les fonctions sont les mêmes ; les
-- UPDATE ne touchent que les lignes dont la valeur change ; la base neutralisée ne dit plus
-- « ressortissant français », donc plus aucune dépense n’est reconnue ; le DELETE ne trouve
-- plus de dépense). Les compteurs de l’étape A tombent à 0 et y restent (hors
-- `depenses_formalites_a_verifier`, qui reste constant entre deux passages).
--
-- MODE D’EMPLOI (l’éditeur n’affiche que le résultat de la DERNIÈRE requête : lance chaque
-- étape séparément, en sélectionnant son bloc puis « Run »)
--   1. Étape A : le SELECT de contrôle, AVANT. Note les compteurs.
--   2. Étape B : la transaction (de BEGIN à COMMIT). Pour une répétition à blanc,
--      remplace la dernière ligne `commit;` par `rollback;` : rien n’est gardé.
--   3. Étape A de nouveau : TOUS les compteurs doivent valoir 0, sauf
--      `depenses_formalites_a_verifier`, qui n’est pas à remettre à 0 : ce sont les dépenses
--      « Formalités : … » que le script ne supprime pas (saisies à la main, ou déjà
--      neutralisées). Avant B : celles que B ne touche pas ; après B : celles-ci PLUS les
--      lignes neutralisées. Regarde-les une fois à la main (titre et montant seulement : la
--      base n’y dit plus rien du profil).
--
-- ⚠️ Aucun secret, aucune donnée personnelle dans ce fichier. Il ne lit ni n’écrit
--    `user_traveller` : le profil de personne n’est jamais touché, seuls les voyages le sont.
--
-- VALIDATION FAITE : exécuté (étape A, B en `rollback` puis B pour de vrai, A, puis B encore)
-- sur un PostgreSQL 16 jetable avec dix-sept voyages factices : formalités intacte, intacte
-- avec d’autres lignes, intacte et seule dans le budget (enveloppe remise à NULL), intacte avec
-- une enveloppe modifiée à la main ou non fixée par la préparation, réglée, modifiée, modifiée
-- avant une relance, réécrite par un recalcul d’équipe, sans `autofill.at` ou avec un `at`
-- illisible, marge de 5 s (3 s gardée comme intacte, 6 s neutralisée), dépense saisie à la main,
-- notes « Papiers » / « Prises » d’avant le correctif, métadonnées vides, nulles ou non objet.
-- Résultat : seules les lignes attendues changent, la répétition à blanc ne laisse aucune
-- trace, un second passage ne change rien. Les textes neutres et les listes (zone euro,
-- expressions de change et de prises) sont vérifiés contre le code par
-- src/features/compas/__tests__/rattrapageSql.test.ts. Cela ne remplace pas la validation sur
-- une branche ou une copie de la base réelle (colonnes, types et déclencheurs réels).
-- ============================================================================


-- ============================================================================
-- ÉTAPE A — CONTRÔLE (lecture seule). À lancer AVANT, puis APRÈS l’étape B.
-- Chaque colonne compte des VOYAGES (ou des lignes) à corriger ; toutes doivent valoir 0
-- une fois l’étape B passée, sauf `depenses_formalites_a_verifier` (voir le mode d’emploi).
--
-- Ce que l’étape B fera des dépenses « Formalités : … » (compteurs de la fin) :
--   depenses_formalites_supprimables   écrites par une préparation et restées intactes : SUPPRIMÉES ;
--   depenses_formalites_a_neutraliser  écrites par une préparation mais réglées, modifiées ou
--                                      réécrites : GARDÉES, seule leur base est remplacée ;
--     dont_reglees                     (parmi elles) celles dont `is_planned` est faux ;
--   depenses_formalites_a_verifier     autres lignes « Formalités : … » (saisies à la main…) :
--                                      JAMAIS touchées, à regarder à la main ;
--   enveloppes_a_abaisser              voyages dont `estimated_budget` (fixé par la préparation,
--                                      encore égal à son total) sera abaissé du montant supprimé ;
--     dont_remises_a_vide              (parmi eux) ceux où les formalités étaient tout le budget :
--                                      l’enveloppe repasse à NULL.
-- Le classement (supprimable ou non) est le MÊME texte qu’en B.2.
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
formalities as (
  select e.id,
         e.trip_id,
         e.amount,
         e.is_planned,
         e.metadata ->> 'autofill' as run,
         case when (t.metadata #>> '{compas,autofill,at}') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
              then e.is_planned
               and e.updated_at <= (t.metadata #>> '{compas,autofill,at}')::timestamptz + interval '5 seconds'
               and e.updated_at <= e.created_at + interval '5 seconds'
              else false end as supprimable
  from public.trip_expenses e
  join public.trips t on t.id = e.trip_id
  where e.title like 'Formalités : %'
    and e.metadata ->> 'autofill' is not null
    and e.metadata ->> 'basis' like '%ressortissant français%'
),
formalities_autres as (
  select e.id
  from public.trip_expenses e
  where e.title like 'Formalités : %'
    and not exists (select 1 from formalities f where f.id = e.id)
),
envelopes as (
  select t.id as trip_id,
         (select coalesce(sum(x.amount), 0)
            from public.trip_expenses x
           where x.trip_id = t.id
             and x.metadata ->> 'autofill' = t.metadata #>> '{compas,autofill,runId}') as old_total,
         (select coalesce(sum(f.amount), 0)
            from formalities f
           where f.trip_id = t.id
             and f.supprimable
             and f.run = t.metadata #>> '{compas,autofill,runId}') as removed,
         t.estimated_budget
  from public.trips t
  where t.metadata #>> '{compas,autofill,budgetSet}' = 'true'
    and exists (select 1 from formalities f where f.trip_id = t.id and f.supprimable)
)
select
  (select count(distinct id) from bad_notes)                                          as voyages_notes_a_neutraliser,
  (select count(distinct id) from bad_notes where visibility <> 'private')            as dont_publics_ou_non_listes,
  (select count(distinct id) from bad_notes where note like 'Papiers :%')             as voyages_papiers_non_neutres,
  (select count(distinct id) from bad_notes where note like 'Prises de type %')       as voyages_prises_non_neutres,
  (select count(distinct id) from bad_notes where note like 'Suggestion de l’IA%')    as voyages_conseils_ia_change_ou_prises,
  (select count(distinct id) from bad_lines)                                          as voyages_lignes_budget_formalites,
  (select count(*) from formalities where supprimable)                                as depenses_formalites_supprimables,
  (select count(*) from formalities where not supprimable)                            as depenses_formalites_a_neutraliser,
  (select count(*) from formalities where not supprimable and not is_planned)         as dont_reglees,
  (select count(*) from formalities_autres)                                           as depenses_formalites_a_verifier,
  (select count(*) from envelopes
    where estimated_budget = old_total and removed > 0 and removed <= old_total)      as enveloppes_a_abaisser,
  (select count(*) from envelopes
    where estimated_budget = old_total and removed > 0 and removed = old_total)       as dont_remises_a_vide;


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

-- B.2 — Les dépenses « Formalités » écrites par une préparation, classées (avant toute suppression)
-- `supprimable` : prévue (`is_planned`), jamais retouchée depuis son écriture (voir l’en-tête, c).
-- Faux = on la GARDE et on neutralise sa base (B.7). Même classement que l’étape A.
create temp table z1_formalities on commit drop as
select e.id,
       e.trip_id,
       e.amount,
       e.is_planned,
       e.metadata ->> 'autofill' as run,
       case when (t.metadata #>> '{compas,autofill,at}') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
            then e.is_planned
             and e.updated_at <= (t.metadata #>> '{compas,autofill,at}')::timestamptz + interval '5 seconds'
             and e.updated_at <= e.created_at + interval '5 seconds'
            else false end as supprimable
from public.trip_expenses e
join public.trips t on t.id = e.trip_id
where e.title like 'Formalités : %'
  and e.metadata ->> 'autofill' is not null
  and e.metadata ->> 'basis' like '%ressortissant français%';

-- B.3 — Ce que valait le total rangé par la préparation en cours de chaque voyage concerné ---
-- (somme des dépenses de sa dernière exécution, formalités comprises) et ce qui en sort : les
-- seules formalités SUPPRIMÉES (une ligne neutralisée reste dans le budget, donc dans le total).
create temp table z1_budget on commit drop as
select t.id as trip_id,
       (select coalesce(sum(x.amount), 0)
          from public.trip_expenses x
         where x.trip_id = t.id
           and x.metadata ->> 'autofill' = t.metadata #>> '{compas,autofill,runId}') as old_total,
       (select coalesce(sum(f.amount), 0)
          from z1_formalities f
         where f.trip_id = t.id
           and f.supprimable
           and f.run = t.metadata #>> '{compas,autofill,runId}') as removed
from public.trips t
where exists (select 1 from z1_formalities f where f.trip_id = t.id and f.supprimable);

-- B.4 — Les métadonnées des voyages (seuls ceux dont la valeur change sont réécrits) --------
with fixed as (
  select t.id,
         pg_temp.z1_fix_metadata(
           t.metadata,
           t.destination_country_code,
           coalesce((select jsonb_agg(to_jsonb(f.id::text)) from z1_formalities f where f.trip_id = t.id and f.supprimable), '[]'::jsonb)
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
-- Abaissée du montant des formalités supprimées ; remise à NULL (« pas de budget », comme
-- l’annulation du préremplissage et comme avant la préparation) quand elles en étaient tout le
-- montant. Jamais négative : `removed <= old_total`.
update public.trips t
   set estimated_budget = nullif(b.old_total - b.removed, 0)
  from z1_budget b
 where b.trip_id = t.id
   and t.metadata #>> '{compas,autofill,budgetSet}' = 'true'
   and t.estimated_budget = b.old_total
   and b.removed > 0
   and b.removed <= b.old_total;

-- B.6 — Les dépenses « Formalités » de la préparation restées intactes ------------------------
delete from public.trip_expenses e
 using z1_formalities f
 where f.id = e.id
   and f.supprimable;

-- B.7 — Les autres (réglées, modifiées, réécrites) restent : seule leur base est neutralisée ---
-- Titre, montant, statut, catégorie, date : inchangés. Plus de « ressortissant français » : la
-- ligne suivante du même état ne les reconnaît plus (idempotent).
update public.trip_expenses e
   set metadata = jsonb_set(e.metadata, '{basis}',
         to_jsonb('barème Compas · montant indicatif, à vérifier auprès du service officiel avant de partir'::text))
  from z1_formalities f
 where f.id = e.id
   and not f.supprimable
   and e.metadata ->> 'basis' like '%ressortissant français%';

commit;  -- répétition à blanc : remplacer par `rollback;`

-- ÉTAPE A (bis) : relance maintenant le SELECT de contrôle de l’étape A tel quel. Tous les
-- compteurs doivent valoir 0 (sauf `depenses_formalites_a_verifier` : les lignes à regarder à la
-- main), et ils y restent si tu relances l’étape B.
