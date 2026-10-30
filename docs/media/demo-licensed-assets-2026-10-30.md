# LKDV — médiathèque de démonstration libre (30 octobre 2026)

## Principes

- Corpus **de démonstration** à retirer ou isoler avant présentation comme communauté réelle. Tous les auteurs concernés sont des profils `is_demo=true`.
- Chaque post signale explicitement qu'il s'agit de médias d'illustration (ne pas inventer une expédition ou une prise de vue personnelle).
- Vidéos sélectionnées sur leurs pages Wikimedia Commons avec **CC0 1.0** explicite. Conserver le lien vers la page de licence dans le texte.
- Les illustrations de couverture sont des images déjà utilisées sur LKDV ou des images Unsplash, utilisables sous la [licence Unsplash](https://unsplash.com/license). La photo ne prétend pas montrer le lieu réel décrit si l'origine géographique n'est pas attestée.
- Aucune musique issue de répertoires commerciaux, services de streaming ou de licences interdisant les applications. Audio Wikimedia **CC0**, interprétation incluse, librement jouable à la demande seulement.
- Les vidéos sont servies par Wikimedia via `Special:Redirect/file` : ce n'est pas un hébergement Supabase. Les vidéos originales peuvent atteindre 15–23 Mo ; garder `preload="metadata"`, poster statique, pause hors écran et activer des transcodes plus légers avant usage à grande échelle.
- Les pistes `.ogg` peuvent ne pas être décodées sur certains navigateurs iOS : lecteur avec message d'erreur et lien direct vers la source. Étudier les versions MP3 transcodées officielles si nécessaire.
- Audit des licences effectué sur les pages sources, mais **pas de preuve d'une lecture E2E réelle** avec le navigateur LKDV dans cette session.

## Vidéos CC0 importées (10)

| Slug | Source et auteur |
| --- | --- |
| `waterfall` | [Mma Legage Waterfall](https://commons.wikimedia.org/wiki/File:Mma_Legage_Waterfall_video.webm) — Kbmotswagole |
| `stream` | [Water flowing stream](https://commons.wikimedia.org/wiki/File:Water_flowing_strem.webm) — BhotaRohit |
| `speedboat` | [Aerial Shot Of Sea With Speedboat](https://commons.wikimedia.org/wiki/File:Aerial_Shot_Of_Sea_With_Speedboat.webm) — bellergy |
| `sea` | [Aerial view of sea and boats](https://commons.wikimedia.org/wiki/File:Aerial_view_of_sea_and_boats.webm) — Wayne McKelvie |
| `moon` | [Moon 360 animation](https://commons.wikimedia.org/wiki/File:Moon_360_animation.webm) — Wikideas1 |
| `river-delta` | [Barre River Mouth](https://commons.wikimedia.org/wiki/File:Barre_River_Mouth.webm) — Lothur |
| `sunrise-coast` | [Sunrise Glow Over Surf Beach](https://commons.wikimedia.org/wiki/File:Sunrise_Glow_Over_Surf_Beach_with_Pink_Horizon_and_Vibrant_Sand_Tones.webm) — JaredMcKenzie |
| `cloudy-beach` | [Cloudy Beach](https://commons.wikimedia.org/wiki/File:Cloudy_Beach.webm) — Dgao0204 |
| `murrays-beach` | [Murrays Beach](https://commons.wikimedia.org/wiki/File:Murrays_Beach.webm) — JaredMcKenzie |
| `komoca-beach` | [Komoča Beach](https://commons.wikimedia.org/wiki/File:Komoča_Beach_VID_20170718_202321.webm) — Vauia Rex |

Les 10 vidéos sont insérées dans `community_posts` sous l'ID idempotent `md5('lkdv-cc0-video-2026:' || slug)::uuid`. La source originale est dans le contenu.

## Pistes CC0 utilisées (6 sources uniques, 12 associations)

- [Nocturne op. 9 n°2 de Chopin, enregistrement de Membeth](https://commons.wikimedia.org/wiki/File:Chopin.Nocturne.Es-Dur.opus.9.2.ogg).
- [Sanna river rapids — Jarrod Stanley](https://commons.wikimedia.org/wiki/File:Sanna_river_rapids.ogg).
- [Dark Highway — John Bartmann](https://commons.wikimedia.org/wiki/File:John_Bartmann_-_dark-highway-master.ogg).
- [Ocean Waves on a Tropical Beach — Jarrod Stanley](https://commons.wikimedia.org/wiki/File:Ocean_Waves_on_a_Tropical_Beach.ogg).
- [La Espero — piano CC0 Florian Cuny](https://commons.wikimedia.org/wiki/File:La_Espero_-_1_piano_-_2020.ogg).
- [Smells Like Rain — Thecolororangeiscool](https://commons.wikimedia.org/wiki/File:Smells_Like_Rain.ogg).

**Total : 6 enregistrements audio distincts**, 12 liens à un post. Pistes conservées avec `soundtrack_url`, `soundtrack_title`, `soundtrack_creator`, `soundtrack_source_url`. Les liens source ne doivent jamais être utilisés comme preuve d'un enregistrement fait par le personnage.

## Photos (6 nouveaux albums)

12 images de paysages Unsplash dans `community_posts.media_urls`, regroupées par thématique (bivouac, forêt, voyage lent, Alpes, littoral, reportage). Les articles affichent la licence Unsplash et ne prétendent pas reproduire l'expérience personnelle d'un personnage fictif.

## Contrôles recommandés

```sql
select count(*) from public.community_posts where image_url ~* '\\.webm($|\\?)';
select count(*) from public.community_posts where soundtrack_url is not null;
select count(*) from public.community_posts where soundtrack_url is not null
 and (soundtrack_creator is null or soundtrack_source_url is null);
select count(*) from public.community_posts p
 left join public.public_profiles u on u.id=p.author_id
 where p.audience='public' and u.id is null;
```

Les données brutes ont été peuplées **dans Supabase** ; les changements TypeScript / UI sont dans la PR de cette branche et ne sont pas publiés sur le site de production tant que cette PR n'est pas fusionnée et déployée avec une validation CI.

### Suite technique

- Contrôler la lecture WebM sur iOS/Safari et vérifier les redirections directes Wikimedia en navigateur réel.
- Si la redirection refuse la lecture embarquée, employer un MP4 transcodé réutilisable ou importer dans un stockage adapté après vérification des tailles.
- Remplacer les pistes OGG par les transcodes MP3 officiels pour améliorer la compatibilité mobile.
- Prévoir de vraies URLs d'origine/photographe par visuel et un contrôle automatique des erreurs HTTP sur les médias.
