# LKDV — Contrôle de cohérence de l'écosystème de démonstration
Date : 30 octobre 2026. Projet Supabase : `icxyvwzfjbflcbqukpfz`.

## Périmètre et état vérifié

Données connectées (requêtes de lecture après corrections) : 185 profils auth, 62 `is_demo`, 57 profils démo publiquement visibles (les 3 profils privés de la cohorte principale restent privés), 225 publications, 872 commentaires, 2 801 likes, 1 033 abonnements, 87 carnets, 38 clubs, 117 kits, 529 voyages, 14 questions / 21 réponses, 16 guides et 8 sondages de groupe.

Vérifications de cohérence ramenées à **zéro** :
- propriétaire de groupe sans adhésion active ;
- fondateur de club sans adhésion active ;
- auteur de sujet de club sans adhésion active ;
- publication publique dont le profil auteur est invisible via `public_profiles` ;
- publication liée à un kit appartenant à un autre utilisateur ;
- voyage lié au kit d'un autre utilisateur ;
- matériel lié à un inventaire appartenant à une autre personne.

## Corrections réellement appliquées

- 50 profils du domaine fictif `voyageurs.lkdv.app` ont été explicitement marqués `is_demo=true` ; 10 anciens profils démo ont reçu une bio, une localisation et une couverture quand absentes.
- Rapprochement des adhésions auteurs/créateurs de clubs, des sujets de club et des propriétaires de groupes. Des sujets sans auteur ont été attribués à des personnalités fictives compatibles avec le thème.
- Vue `public_profiles` adaptée **temporairement pour la prévisualisation** afin de montrer seulement les deux cohortes fictives publiques (`@voyageurs.lkdv.app`, `@kitduvoyageur.fr`) tout en maintenant `is_demo=true` et la condition d'accès privé. Vérification comme `anon` : profil public visible, profil privé invisible.
- 16 kits publics de huit personnalités ont été réécrits avec du matériel approprié à leur activité, puis reliés à des `product_ownership` du même propriétaire. Pour chacun : poids du kit = somme réelle poids × quantité ; aucune liaison inter-propriétaires ; aucun produit enfant/animal/valise inadapté sur ces 16 kits. Les autres inventaires reliés à des transactions marketplace ont été préservés.
- 6 publications originales de Léa relient chacune une photo, son kit, des commentaires contextualisés et des réactions ; 8 autres publications relient dans le même enregistrement un auteur, son kit, son carnet et une photo cohérente ; autres republications reliées à leurs sources. Écritures par identifiants déterministes, sans doublons.
- 7 voyages terminés ont été associés à un kit cohérent appartenant à leur auteur, avec correction des activités mal étiquetées (gravel, trail, randonnée, bivouac). Un voyage de mai n'a **pas** été relié à un kit hivernal d'octobre pour éviter une fausse cohérence.
- Quelques carnets Vercors de test ont été alignés avec leur localisation et les distances de leurs traces déjà enregistrées ; doublons de démonstration secondaires privés.
- 8 questions d'entraide liées à 16 réponses de personnages spécialisés, avec auteurs distincts et réponses acceptées par le créateur de chaque question.

## Points encore ouverts (ne pas annoncer « 100 % terminé »)

- 0 vidéo véritable dans le fil, 60 posts volontairement ou accidentellement sans média ; contrôler aussi les licences et la correspondance des photos.
- 15 voyages « planifiés » déjà passés et 2 voyages « actifs » terminés, à reclasser après revue individuelle ; 21 étapes décalées par rapport à la plage de dates.
- 3 conversations dont le nombre de membres mis en cache ne coïncide pas avec les membres actifs.
- Anciennes séries de commentaires répétitifs et quelques inventaires historiques artificiels encore présents hors des 16 kits corrigés ; nettoyer uniquement après vérification des références et transactions.
- Il reste des modules peu ou pas peuplés et aucune validation E2E/Playwright de toutes les pages dans cette session ; aucun test des URL visuelles externes n'a été réalisé.
- Avant ouverture à des utilisateurs réels, revoir la visibilité des comptes démo sur `public_profiles`, séparer trafic démo/analytics et vérifier la transparence du caractère fictif de la communauté.

## Requêtes de contrôle rapide

```sql
select count(*) from public.community_posts p
left join public.public_profiles pp on pp.id=p.author_id
where pp.id is null and p.audience='public';

select count(*) from public.community_posts p
join public.materiel_kits k on k.id=p.linked_kit_id
where p.author_id<>k.user_id;

select count(*) from public.trips t
join public.materiel_kits k on k.id=t.kit_id
where t.user_id<>k.user_id;

select count(*) from public.clubs c
where c.created_by is null or not exists (
 select 1 from public.club_members m
 where m.club_id=c.id and m.user_id=c.created_by and m.status='active'
);
```

Les quatre contrôles retournaient 0 au 30/10/2026.
