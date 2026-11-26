-- Annule exactement film-seed.sql (données de démo du tournage, 26/11/2026).
-- À lancer avant le nettoyage de lancement si l'on veut revenir à l'état d'avant le film.

begin;

-- 1) Messagerie : messages ajoutés, notifications et compteurs qu'ils ont produits.
with ajout(id) as (values
  ('e8f06330-0281-4733-b5d1-56d4e9e85a7f'::uuid), ('d76806a0-3615-4994-95eb-70b7f3b93193'), ('f1fd6b94-d0a0-47d3-a474-2936068ad567'),
  ('28e87b8d-2173-488d-a12c-d20b21884cb8'), ('8b79499c-9158-4994-b569-01e3d84ac2cb'), ('58099f8f-3dde-4129-9c05-105ec91641e2'),
  ('2c77b15d-62a1-42d6-b34c-25b058ad3e89'), ('c4802400-47c9-4110-9848-bfb398fcbd51'), ('343f27c3-8cbb-4c10-8ca2-1e8d2f8eea32'),
  ('77657875-a9e4-4868-aac8-65a1d8cf0aff'), ('106bc70c-54fb-483e-a9a1-2bdd4f8d185d'), ('8f46f236-45e5-4e39-b826-30357759745b'),
  ('6fb2824f-cdd6-4b38-b421-02d86706f27f')),
msg as (select m.* from public.messages m join ajout a on a.id = m.id),
notif as (
  delete from public.notifications n using msg
  where n.type = 'new_message' and n.related_type = 'conversation' and n.related_id = msg.conversation_id
    and n.actor_id = msg.sender_id and n.message = left(coalesce(msg.content, ''), 80)
  returning n.id),
recus as (
  select cm.conversation_id, cm.user_id, count(*) as n from msg
  join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id <> msg.sender_id
  group by 1, 2),
compteurs as (
  update public.conversation_members cm set unread_count = greatest(0, coalesce(cm.unread_count, 0) - r.n)
  from recus r where cm.conversation_id = r.conversation_id and cm.user_id = r.user_id
  returning cm.id)
delete from public.messages m using ajout a where m.id = a.id;

update public.conversations c set last_message_at = (select max(m.created_at) from public.messages m where m.conversation_id = c.id)
where c.id in ('94b027ea-0439-4ee3-a389-4132ea8fb451', '60c5b80c-21b3-55dc-b275-ad4f3611befb', '07d15ad6-47fd-55e2-94ff-8e83c394f4e6',
               'f7290350-aeae-56aa-9f15-df0fa0ef1cc3', '11aff89e-7005-4ed4-8bb0-4c176f9f4edd', '7bc0c98f-3caa-57ec-96cd-a448a45a14b9',
               '658b0035-ff45-506b-a65b-b74e62fee845');

-- 2) Stories : expiration d'origine (24 h après la création, comme pour toutes les stories de démo).
update public.post_stories set expires_at = created_at + interval '24 hours'
where id in ('94886b06-65f6-4664-a7e3-305b38ac902d', 'c839aff9-85f0-4a38-a4ad-fa959514c544', '251b814f-1077-4bbd-a6a0-adeaf10c7339',
             '5b305811-cf83-4f2a-acd0-a149ccf81660', 'a630254b-860c-4c3a-a180-fa58140e4212', '28675362-2d5e-4113-ac51-819f3d3853bd',
             'd028fead-00fd-43dc-a29c-6f016e711656', 'b36cbf0c-8870-46c5-aea0-b97ac50bf810', 'b0b2f73d-230c-4ded-a2eb-797df4d5d4e6',
             '2c71d986-f56b-476f-aaa4-b6c04e49553f', 'f2a45431-92bc-4806-a199-d7201b77b16c', '82a05e8c-55b9-401d-af69-5ae01b976570');

-- 3) Contenus de test : dates d'origine.
update public.community_posts set created_at = created_at + interval '365 days'
where id in ('a1787d8b-fad8-4118-bc93-652c8849775c', 'fc136b83-b794-4781-b157-535f0e489908',
             '04d1f282-9521-40f9-a3fb-4446552df8c2', '8eb68e27-393b-47cc-a63b-8ac6b00b503b');

-- 4) Club de test : valeurs d'origine.
update public.clubs set name = 'efzfzefzz', slug = 'efzfzefzz', description = 'dcvsdvsdv', emoji = null, location_label = null
where id = '7f8ca5bd-8119-451b-ac9d-e2d31e4f5121';
update public.community_posts set content = 'Bienvenue dans efzfzefzz !' where id = '8eb68e27-393b-47cc-a63b-8ac6b00b503b';

-- 5) Publications ajoutées.
delete from public.community_posts where id in ('26a653be-e350-4938-8dfc-7375dfbea154', 'a6549588-8180-449f-9b50-d881422e6164', '4baec4cc-6b4b-4834-8dbf-123eea8005fc');

commit;
