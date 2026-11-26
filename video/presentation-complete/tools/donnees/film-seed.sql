-- Données de démo ajoutées pour le tournage du film (26/11/2026), avec l'accord de Tony :
-- « Hésite pas à rajouter du contenu même faux… on fera un nettoyage avant le lancement… sans rien casser. »
-- Rien n'est supprimé. Tout est annulable par film-annuler.sql (identifiants fixés à l'avance).
-- Compte de démo : lea.fontaine (d5451f35-db9f-4575-9114-6d3b79550bbc). Personnes fictives uniquement.

-- 1) Messagerie : sept conversations de démo ravivées, pour que les conversations personnelles
--    de Tony (pseudo tiré de son e-mail) descendent sous le premier écran. Ordre chronologique.
insert into public.messages (id, conversation_id, sender_id, content, type, message_type, created_at, updated_at) values
  ('e8f06330-0281-4733-b5d1-56d4e9e85a7f', '94b027ea-0439-4ee3-a389-4132ea8fb451', 'aa000001-0000-0000-0000-000000000006', 'Ton carnet m''a convaincu : je prépare le GR20 sud pour mai.', 'text', 'text', now() - interval '110 minutes', now() - interval '110 minutes'),
  ('d76806a0-3615-4994-95eb-70b7f3b93193', '60c5b80c-21b3-55dc-b275-ad4f3611befb', '7e8ba234-94cf-4de1-8994-58f3a5424a77', 'Merci pour ton kit souche, je pars avec la même tente que toi.', 'text', 'text', now() - interval '88 minutes', now() - interval '88 minutes'),
  ('f1fd6b94-d0a0-47d3-a474-2936068ad567', '07d15ad6-47fd-55e2-94ff-8e83c394f4e6', '43b3011e-5388-44c2-a5d1-1470e88a3378', 'Vercors ou Chartreuse pour le premier bivouac de l''année ?', 'text', 'text', now() - interval '70 minutes', now() - interval '70 minutes'),
  ('28e87b8d-2173-488d-a12c-d20b21884cb8', '07d15ad6-47fd-55e2-94ff-8e83c394f4e6', '55436f94-d807-4de4-a4ed-f16749163667', 'Vercors. Les Hauts-Plateaux au lever du jour, aucun regret.', 'text', 'text', now() - interval '63 minutes', now() - interval '63 minutes'),
  ('8b79499c-9158-4994-b569-01e3d84ac2cb', 'f7290350-aeae-56aa-9f15-df0fa0ef1cc3', 'ed29bd98-c43d-4e1a-95ae-b7297b44cc86', 'Le refuge Lagazuoi confirme pour le 12 août 🙌', 'text', 'text', now() - interval '58 minutes', now() - interval '58 minutes'),
  ('58099f8f-3dde-4129-9c05-105ec91641e2', '11aff89e-7005-4ed4-8bb0-4c176f9f4edd', 'f41d1f60-02c8-4cd9-ae5e-f63660d646da', 'Sortie de la Cordée au Moucherotte le 14 : je t''ai gardé une place.', 'text', 'text', now() - interval '47 minutes', now() - interval '47 minutes'),
  ('2c77b15d-62a1-42d6-b34c-25b058ad3e89', 'f7290350-aeae-56aa-9f15-df0fa0ef1cc3', '04e678e3-ef35-426e-8dc4-49269ac27c9d', 'J''ai mis l''Alta Via 1 dans le Compas : six étapes, tout tient.', 'text', 'text', now() - interval '41 minutes', now() - interval '41 minutes'),
  ('c4802400-47c9-4110-9848-bfb398fcbd51', '7bc0c98f-3caa-57ec-96cd-a448a45a14b9', 'b85f85a0-9c70-426c-8ac6-137bc272e1ef', 'Tu m''envoies ton lien de suivi samedi ? Je veille depuis Lille.', 'text', 'text', now() - interval '33 minutes', now() - interval '33 minutes'),
  ('343f27c3-8cbb-4c10-8ca2-1e8d2f8eea32', '658b0035-ff45-506b-a65b-b74e62fee845', '6e111ce2-0fa4-4e3a-8f24-87b03c632588', 'Ton carnet du Tour du Mont-Blanc : onze espèces dans le Pokédex 😮', 'text', 'text', now() - interval '25 minutes', now() - interval '25 minutes'),
  ('77657875-a9e4-4868-aac8-65a1d8cf0aff', '658b0035-ff45-506b-a65b-b74e62fee845', 'd5451f35-db9f-4575-9114-6d3b79550bbc', 'Et le col de la Seigne au lever du jour, je ne l''oublierai pas.', 'text', 'text', now() - interval '22 minutes', now() - interval '22 minutes'),
  ('106bc70c-54fb-483e-a9a1-2bdd4f8d185d', '07d15ad6-47fd-55e2-94ff-8e83c394f4e6', 'a0dd22d8-9a86-45e5-af00-d30b2ca1a007', 'Météo de samedi : grand beau, 4° au petit matin. Sortez les doudounes.', 'text', 'text', now() - interval '16 minutes', now() - interval '16 minutes'),
  ('8f46f236-45e5-4e39-b826-30357759745b', '658b0035-ff45-506b-a65b-b74e62fee845', '6e111ce2-0fa4-4e3a-8f24-87b03c632588', 'On repart ensemble en juin ? Le Vercors me fait de l''œil.', 'text', 'text', now() - interval '9 minutes', now() - interval '9 minutes'),
  ('6fb2824f-cdd6-4b38-b421-02d86706f27f', 'f7290350-aeae-56aa-9f15-df0fa0ef1cc3', 'efab6445-ba3e-402d-878a-0ff4ab0ea081', 'Je prends le réchaud. Quelqu''un a de la place pour une cartouche ?', 'text', 'text', now() - interval '4 minutes', now() - interval '4 minutes');

-- 2) Stories : les douze dernières stories de démo restent visibles trois semaines (elles avaient expiré).
update public.post_stories set expires_at = now() + interval '21 days'
where id in ('94886b06-65f6-4664-a7e3-305b38ac902d', 'c839aff9-85f0-4a38-a4ad-fa959514c544', '251b814f-1077-4bbd-a6a0-adeaf10c7339',
             '5b305811-cf83-4f2a-acd0-a149ccf81660', 'a630254b-860c-4c3a-a180-fa58140e4212', '28675362-2d5e-4113-ac51-819f3d3853bd',
             'd028fead-00fd-43dc-a29c-6f016e711656', 'b36cbf0c-8870-46c5-aea0-b97ac50bf810', 'b0b2f73d-230c-4ded-a2eb-797df4d5d4e6',
             '2c71d986-f56b-476f-aaa4-b6c04e49553f', 'f2a45431-92bc-4806-a199-d7201b77b16c', '82a05e8c-55b9-401d-af69-5ae01b976570');

-- 3) Contenus de test de Léa : reculés d'un an dans le temps (ils descendent au fond du fil, rien n'est effacé).
update public.community_posts set created_at = created_at - interval '365 days'
where id in ('a1787d8b-fad8-4118-bc93-652c8849775c', 'fc136b83-b794-4781-b157-535f0e489908',
             '04d1f282-9521-40f9-a3fb-4446552df8c2', '8eb68e27-393b-47cc-a63b-8ac6b00b503b');

-- 4) Le club de test « efzfzefzz » devient un club présentable (nom, adresse, description, emoji).
update public.clubs set name = 'Les Hauts-Plateaux du Vercors', slug = 'hauts-plateaux-du-vercors',
  description = 'Bivouacs et traversées sur les Hauts-Plateaux, au rythme des saisons.', emoji = '⛺', location_label = 'Vercors'
where id = '7f8ca5bd-8119-451b-ac9d-e2d31e4f5121';
update public.community_posts set content = 'Bienvenue dans Les Hauts-Plateaux du Vercors !'
where id = '8eb68e27-393b-47cc-a63b-8ac6b00b503b';

-- 5) Trois publications fraîches en tête du fil (dont le partage du vrai carnet du Tour du Mont-Blanc de Léa).
insert into public.community_posts (id, author_id, post_type, title, content, image_url, media_urls, audience, linked_carnet_id, created_at, updated_at) values
  ('26a653be-e350-4938-8dfc-7375dfbea154', 'd5451f35-db9f-4575-9114-6d3b79550bbc', 'share', 'Tour du Mont-Blanc en autonomie complète',
   '170 km, +10 000 m, neuf nuits sous tente et onze espèces dans le Pokédex. Le carnet est en ligne.',
   'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1600&q=80',
   '["https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1600&q=80"]'::jsonb,
   'public', '749e9e8c-9540-5a73-8b6c-6ab07264f62f', now() - interval '35 minutes', now() - interval '35 minutes'),
  ('a6549588-8180-449f-9b50-d881422e6164', '55436f94-d807-4de4-a4ed-f16749163667', 'post', 'Premier bivouac de l''année',
   'Hauts-Plateaux du Vercors, 6 h 40. Pas un bruit, pas un réseau, juste le jour qui arrive.',
   'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&auto=format&fit=crop&q=80',
   '["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&auto=format&fit=crop&q=80"]'::jsonb,
   'public', null, now() - interval '20 minutes', now() - interval '20 minutes'),
  ('4baec4cc-6b4b-4834-8dbf-123eea8005fc', 'f41d1f60-02c8-4cd9-ae5e-f63660d646da', 'post', 'Sortie de la Cordée : le Moucherotte',
   'Samedi 14, départ 6 h de Saint-Nizier. Lever de soleil sur Belledonne, il reste quatre places.',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80',
   '["https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80"]'::jsonb,
   'public', null, now() - interval '8 minutes', now() - interval '8 minutes');
