# Couverture des 200 améliorations — Communauté v2

**Date : 2026-11-08** · Audit documentaire statique (lecture du code livré, aucun test exécuté ici).
Source des exigences : `handoff/communaute-v2/annexes/D-document-refonte.md` (20 améliorations × 10 volets).
Exceptions admises : `handoff/communaute-v2/01-SPEC-PRODUIT.md` § 6 (L96-105).

## Résumé chiffré (sur 200) — état unique et vrai au 2026-11-10

| Statut | Nombre |
|---|---|
| fait | **187** (dont **4 « dépendent de la production »** : Carnets#2, Carnet#13, Club#4, Kit#12) |
| partiel | **0** |
| non fait | **0** |
| reporté (01 § 6) | **13** |
| **Total** | **200** |

Historique : l'audit statique du 2026-11-08 comptait 161 fait / 23 partiels / 13 reportés / 3 non faits. La PR #158
(fidélité maquette) a comblé une partie des 26 (Carnets#2 et #4, Sorties#8, Publication#6, Story#11, Carnet#8, Kit#4/#5/#10, Club#13,
etc.) sans que ce document soit relu ; la finition du 2026-11-10 a clos le reste. Chaque ligne ci-dessous cite sa preuve (fichier + test).
« fait (dépend de la prod) » = l'interface, les tests sur fixtures et l'état vide honnête sont livrés ; la donnée réelle manque en production
(migration non appliquée, RPC non étendue) — FID-078/083, bloqués par J-08.

Hors décompte : la vidéo dans les publications est une exception § 6 non numérotée (`01` L96).

## Méthode et légende des chemins

Chaque point a été cherché dans le code (grep/read ciblés sur les composants, fonctions, RPC et CSS), pas dans les commits.
Préfixes utilisés dans la colonne Preuve :

- `EX` = `src/features/community/v2/explore`
- `CR` = `src/features/community/v2/create`
- `DA` = `src/features/community/v2/data`
- `SH` = `src/features/community/v2/shared`
- `UI` = `src/components/ui/drawer`

Les chemins `src/styles/*`, `supabase/migrations/*`, `src/app/*` sont donnés en entier.
Les écarts connus au 2026-11-08 (visa sans pays, pastille sans anneau, libellé « Billets », `carnet_nights` masqué) sont clos ou documentés dans « Clôture des 26 points » en bas de page.

---

## 1. Recherche — 20 fait

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `EX/ExploreCapsule.tsx` `EXPLORE_CAPSULE_ITEMS` (loupe = 1er slot) + `SH/CommunitySheetShell.tsx` (capsule toujours rendue hors détail) |
| 2 | fait | `SH/CommunitySheetShell.tsx` (un seul snap « card » : `--cv2-card-top/bottom`) + `src/styles/communaute-v2-shell.css` L14-19 ; aucune règle `50dvh`/`80dvh` dans les CSS v2 (grep vide) |
| 3 | fait | `EX/panes/SearchPane.tsx` (input 48 px, icône 20 px, bouton Effacer 44 px via `.lkdv-cv2x-clear`) + `src/styles/communaute-v2.css` `.lkdv-cv2-input` (16 px, `--cv2-field-height: 48px`) |
| 4 | fait | `EX/search/SearchHome.tsx` : récents supprimables, tendances (`community_search_trending`), lieux populaires |
| 5 | fait | `EX/ExploreCapsule.tsx` `SEARCH_SCOPE_ITEMS` + mini-capsule dans `EX/CommunityExploreSheetV2.tsx` (branche `tab === 'search'`) |
| 6 | fait | `EX/search/SearchResults.tsx` : `lkdv-cv2-group-head` + eyebrow + compteur `<b>` + « Voir tout » |
| 7 | fait | `src/styles/communaute-v2.css` `.lkdv-cv2-type` (10,5 px, `--type-*`) + `src/styles/tokens.css` L1162-1166 (alias de verts) ; test `SH/__tests__/fondationsCss.test.ts` « cinq types en alias de verts » |
| 8 | fait | `EX/search/HighlightedText.tsx` + `SH/format.ts` `searchTerms` |
| 9 | fait | `supabase/migrations/20261108130001_communaute_v2_lot_a_search.sql` : `lkdv_norm` (unaccent + ponctuation), index trigram, seuil 0.15, `community_search` |
| 10 | fait | `EX/panes/SearchPane.tsx` : `ExploreError title="Recherche indisponible"` (jamais « Aucun résultat » pour une erreur) |
| 11 | fait | `EX/panes/SearchPane.tsx` (suggestions `EX/search/suggest.ts`, « Créer une sortie « X » ») ; test `EX/__tests__/suggest.test.ts` |
| 12 | fait | `EX/ExploreStates.tsx` `ExploreSkeleton variant="rows"` + cascade `cv2RowIn` (`src/styles/communaute-v2-shell.css`) |
| 13 | fait | `DA/communityFeedMappers.ts` `fallbackSearchHref` : `/profil/<id>` (résolu UUID **ou** handle par `src/app/profil/[id]/page.tsx`), `/sorties/<id>`, `/carnets/<id>`, `/clubs/<id>` |
| 14 | fait | `EX/useLongPress.ts` (460 ms) + `EX/details/PeekOverlay.tsx` + `openSearchPeek` (Ouvrir / Enregistrer / Partager) |
| 15 | fait | `EX/details/SearchMap.tsx` (`PlaceMiniMap`, repères carnets + sorties, bascule Liste / Sur la carte) |
| 16 | fait | `EX/useExploreState.ts` `SEARCH_CONTEXT_LABELS/ORDER` + `SearchPane` chips `aria-pressed` |
| 17 | fait | `EX/useNearMe.ts` + `SearchPane.onRequestGeo` + `distanceKm` affiché par ligne |
| 18 | fait | `src/components/ui/CapsuleTabs.tsx` haptique `selection` (défaut actif) + `haptic('light')` à l'ouverture d'un résultat (`openCarnetPeek`/`openSearchPeek`) |
| 19 | fait | `SearchPane.onKeyDown` (↑ ↓ Entrée Échap) + `role="status" aria-live="polite"` + `aria-activedescendant` |
| 20 | fait | `EX/useExploreState.ts` (`useSessionMemory` : volet, filtres, tri, requête) + `EX/usePaneScrollMemory.ts` + récents en mémoire |

## 2. Carnets — 19 fait, 1 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `EX/tiles/CarnetTileV2.tsx` + `src/styles/communaute-v2.css` `.lkdv-cv2-tile` (`--drawer-card-*`, rayon 14-20) |
| 2 | fait (dépend de la prod) | `EX/tiles/CarnetTileV2.tsx` : pays du visa (`countryIso`, `carnets.country_iso`, FID-067) ; la colonne vient de la migration `20261108190000`, **non appliquée en production** : sans elle, le visa montre « jours · km » seuls. Test `EX/__tests__/CarnetTileV2.test.tsx` |
| 3 | fait | `EX/panes/CarnetsPane.tsx` : 1er carnet `wide week` puis grille 2 colonnes |
| 4 | fait | `explore-v2.css` L271-290 : anneau **conique** `conic-gradient` autour de la pastille « En route » (maquette L1022) ; PR #158 |
| 5 | fait | `CarnetTileV2` L113-128 : SVG `lkdv-cv2-trace` en filigrane sur la couverture |
| 6 | fait | `EX/ExploreCapsule.tsx` `CARNET_FILTER_ITEMS` (Découvrir, Mes carnets, Suivis, Près de moi) |
| 7 | fait | `UI/SortMenuButton.tsx` (30 px, `role=menu`/`menuitemradio`, point vert `[data-modified="true"]::before`) |
| 8 | fait | `CarnetTileV2` : bouton 44 px, `--lkv-like`, pop `cv2x-heart-pop`, haptique dans `handleCarnetLike` |
| 9 | fait | `CarnetTileV2` : `travelers.slice(0,3)` + pastille « +n » |
| 10 | fait | `src/styles/communaute-v2.css` `.lkdv-cv2-title` (600 14 px) + `.lkdv-cv2-meta` (10,5 px) |
| 11 | fait | `CarnetTileV2` : badge `verifiedGps` « Trace GPS vérifiée » |
| 12 | fait | `openCarnetPeek` : Lire / Enregistrer / Partager |
| 13 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L98 (« transition partagée vers la fiche carnet, ne pas toucher `/carnets/[id]` ») |
| 14 | fait | `DA/useCursorFeed.ts` + `CarnetsPane` (`usePaneNearBottom`, `ExploreListFoot`, `hasMore`) |
| 15 | fait | `20261108130002_communaute_v2_lot_b_geo_feeds.sql` : `likes_count`/`comments_count` lus dans la RPC (jamais 5 000 lignes côté client) |
| 16 | fait | `EX/ExploreStates.tsx` `variant="tiles"` (4) et `tile5` (5) |
| 17 | fait | `CarnetsPane` état vide « Mes carnets » + « Créer mon premier carnet » → `onCreateCarnet` |
| 18 | fait | `CarnetsPane` : `ExploreError title="Carnets indisponibles" onRetry={feed.refresh}` |
| 19 | fait | `EX/ExploreStates.tsx` `ExplorePaneFoot` + `EX/panes/CarnetsPane.tsx` : pied « Créer un carnet / Tout voir » (maquette L2343). Le hub `/carnets` n'existe pas (route interdite d'écriture) : « Tout voir » élargit au flux complet (retour à « Découvrir » ou chargement de la suite), il ne ramène jamais à la page courante. Test `create/__tests__/finitionUi.test.tsx` « Carnets#19 » |
| 20 | fait | `CarnetTileV2` : un seul `Link` + j'aime et commentaires en boutons distincts hors du lien ; test `EX/__tests__/CarnetTileV2.test.tsx` « est un seul lien avec un libellé complet » |

## 3. Clubs (Explorer) — 20 fait

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `EX/tiles/ClubTileV2.tsx` + titres/méta tokenisés (600 14 px / 10,5 px) |
| 2 | fait | `SH/ClubCrest.tsx` (initiale + icône d'activité, hash stable, `data-tone` vert) ; test `SH/__tests__/ClubCrest.test.tsx` |
| 3 | fait | `EX/panes/ClubsPane.tsx` : 1er club `month` en pleine largeur |
| 4 | fait | `ClubTileV2` : pilule 44 px, états Rejoindre / Demande envoyée / Membre ✓ ; « Quitter » dans le menu du Peek |
| 5 | fait | `ClubTileV2` cadenas si `privacy === 'closed'` + `handleClubJoin` envoie `join_club` (statut `pending`) |
| 6 | fait | bouton occupé (`markBusy`, `aria-busy`, `disabled`) + `join_club` et `lkdv_recount_club_members` (`20261108130004_communaute_v2_lot_d_clubs_membership.sql`) |
| 7 | fait | `EX/details/ClubDetailView.tsx` + pile de détails de la coque (`‹ Retour`, animations `cv2DetailIn`/`cv2RowIn`) |
| 8 | fait | `ClubDetailView` : prochaines sorties, membres, règles, dernières publications |
| 9 | fait | `ClubTileV2.activityLine` + `ClubDetailView` : sorties du mois + dernière publication |
| 10 | fait | `ClubTileV2` (`friendsTotal`, avatars) + carte « n amis sont membres » du détail |
| 11 | fait | `EX/ExploreCapsule.tsx` `CLUB_FILTER_ITEMS` |
| 12 | fait | `ClubsPane` `CLUB_ACTIVITY_CHIPS` (rando, ski, vélo, escalade, trail) |
| 13 | fait | `CLUB_SORT_OPTIONS` (activité récente, proches, taille) via `SortMenuButton` |
| 14 | fait | `detail.pages` + `LensPager` + `onIndexChange` (`haptic('selection')`) dans `CommunityExploreSheetV2` |
| 15 | fait | `openClubPeek` : Voir / Rejoindre (ou Annuler la demande) / Partager |
| 16 | fait | `handleClubJoin` : île « Club rejoint » (ou « Demande envoyée ») + Annuler + `haptic('success')` |
| 17 | fait | `ClubsPane` état vide « Mes clubs » : « Créer un club » + « Explorer par activité » |
| 18 | fait | `ClubsPane` : `ExploreError` + Réessayer, `ExploreSkeleton variant="tiles"` |
| 19 | fait | `ClubDetailView` : bouton secondaire « Voir la page » → `/clubs/<slug>` |
| 20 | fait | `joinAria` complet + `aria-pressed`/`aria-busy` ; annonce par `DynamicIsland` `role="status" aria-live="polite"` ; test `EX/__tests__/ClubTileV2.test.tsx` |

## 4. Sorties — 18 fait, 2 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `SH/EventTicket.tsx` (souche jour/mois, topo à droite) + `EX/tiles/EventTicketV2.tsx` |
| 2 | fait | `SH/AgendaStrip.tsx` (14 jours, points, date complète, 44 px) + `DA/useEventAgenda.ts` + filtre `eventDay` |
| 3 | fait | `EX/panes/EventsPane.tsx` vue `list` : `groupEventsByAgenda` (Ce week-end / La semaine prochaine / Plus tard). Écart : libellé « Billets » au lieu de « Grille » |
| 4 | fait | `EventTicket` : barre de capacité + badges Complet / Liste d'attente / Inscrit + `EventDetailView` jauge `role="progressbar"` |
| 5 | fait | `EventActionButton` : 44 px, libellés Inscrit ✓ / Liste d'attente / Complet / Terminée |
| 6 | fait | lien `/sorties/<id>` intercepté vers le détail (`EventTicketV2`), lien « Voir la fiche de la sortie » |
| 7 | fait | `EventTicket` chips : niveau, distance, D+, durée (+ reprise dans `EventDetailView`) |
| 8 | fait | `EX/tiles/EventTicketV2.tsx` + `DA/useEventTileWeather.ts` : météo du jour J sur la tuile (fenêtre J-7, route `/api/weather`, repli silencieux) ; test `DA/__tests__/eventWeather.test.ts` |
| 9 | fait | `EventDetailView` : `PlaceMiniMap` + « Itinéraire » (Google Maps) |
| 10 | fait | `EventDetailView` : carte organisateur (avatar, nom, « Organisateur ») |
| 11 | fait | `DA/communityDetails.ts` `fetchEventDetail(…, viewerId)` : amis inscrits = participants confirmés suivis par le lecteur (`user_follows`) ; carte « n amis sont inscrits » dans `EX/details/EventDetailView.tsx`. Test `create/__tests__/finitionUi.test.tsx` « Sorties#11 » |
| 12 | fait | `EX/ExploreCapsule.tsx` `EVENT_FILTER_ITEMS` |
| 13 | fait | détail empilé (`SheetDetail` + `‹ Retour`) |
| 14 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L101 (« seulement le fichier `.ics` ; rappel dépend du chantier notifications »). `.ics` fait : `EventDetailView.downloadIcs` + fiche |
| 15 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L100 (« aucune colonne `events → carnets` ») |
| 16 | fait | `handleEventSignup` : île « Inscription confirmée » + Annuler + `haptic('success')` |
| 17 | fait | `EventsPane` état vide + « Organiser une sortie » → `onCreateEvent` |
| 18 | fait | `ExploreError` + Réessayer, bouton occupé, `ExploreSkeleton variant="tickets"` |
| 19 | fait | `EventTicket` verre de `/compte`, titre 14 px, action 44 px |
| 20 | fait | `EventTicket.ariaLabel` : date complète + niveau + dénivelé + état ; `AgendaStrip` libellé « samedi 14 novembre · 2 sorties » |

## 5. Publication — 17 fait, 3 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `CR/engine/steps.ts` `POST_STEPS` : Format, Contenu, Diffusion (mini-capsule) |
| 2 | fait | `CR/fields/FieldV2.tsx` : `<label>` visible 600 10 px majuscules ; placeholders en exemples |
| 3 | fait | `src/styles/communaute-v2.css` `.lkdv-cv2-input` (16 px, `--cv2-field-height: 48px`, rayon/verre v2) |
| 4 | fait | `CR/forms/PostFormV2.tsx` `previewPost` + `CommunityFeedPost embedded` en aperçu vivant |
| 5 | fait | étape 0 = Format + Audience ; étape 1 = médias, avec avertissement immédiat si audience non publique |
| 6 | fait | `CR/fields/MediaFieldV2.tsx` : bouton Supprimer `.lkdv-cv2c-medialist-del` de **44 × 44 px** ; l'ancienne grille 30 px (`.lkdv-cv2-media-remove`) n'est plus rendue. Test `shared/__tests__/finitionCss.test.ts` |
| 7 | fait | `MediaFieldV2` : Original / 4:5 / 1:1 + grille `.lkdv-cv2-crop-grid` + recadrage canvas réel (`cropImageToRatio`) |
| 8 | fait | `MediaFieldV2` : champ « Texte de l'image » + rappel doux « Un texte alternatif aide… » si vide |
| 9 | fait | `CR/fields/MentionFieldV2.tsx` (`fetchMentionProfiles`) + `CR/fields/TagsFieldV2.tsx` (suggestions, 10 max) |
| 10 | fait | `CR/fields/PlaceFieldV2.tsx` : `/api/geocode` + « Ma position » → `locationLat/Lng` |
| 11 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L97 (sondage) |
| 12 | fait | `PostFormV2` carte « Événement » → `requestCreate('sortie')` |
| 13 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L97 (commentaires / j'aime). UI inerte + mention « prochaine version » |
| 14 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L97 (programmation) |
| 15 | fait | `FieldV2` compteur `value / max` avec `data-near` / `data-over` (changement de couleur) |
| 16 | fait | `CR/engine/useDraftV2.ts` (400 ms, `pagehide`, `visibilitychange`) + bandeau « Brouillon restauré · Effacer » |
| 17 | fait | `serverError` unique rendu dans le pied, près du bouton (`CreateSheetV2` `lkdv-cv2c-server`, `role="alert"`) |
| 18 | fait | `busyLabel` « Envoi des médias… X % » + `submitAll` refuse tant que `uploadState.pending > 0` |
| 19 | fait | `reportCreated('post')` → île « Publié » + « Voir » (`/communaute?post=<id>`) |
| 20 | fait | `CreateSheetV2` `useKeyboardInsets` + `focusin` → `scrollIntoView` + classe `lkdv-cv2c-keyboard` |

## 6. Story — 20 fait

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | étapes dans la mini-capsule de la coque (`CreateSheetV2` `mini`), plus de capsule en portail `z 2147483000` |
| 2 | fait | `CR/story/StoryStageV2.tsx` + `src/components/communaute/StoriesViewer.tsx` mode `compose` (`lkdv-story-compose-frame` 9:16) |
| 3 | fait | `StoryStageV2` : glisser 1 doigt + pincement 2 doigts (échelle bornée) sur le média |
| 4 | fait | `StoryStageV2` : calques déplaçables / pincement (échelle + rotation) + 3 styles (`clair`, `encre`, `sauge`) |
| 5 | fait | `CR/forms/StoryFormV2.tsx` `StickerTools` : lieu, altitude, distance, météo `/api/explorer/v2/weather` |
| 6 | fait | `CR/engine/createSchemasV2.ts` L452-457 : URL `http(s)` validée ; sticker lien affiché dans la scène |
| 7 | fait | curseurs début/fin + lecture de l'extrait en boucle (`StoriesViewer` `currentTime`/`trimEnd`) + `trim_start_ms`/`trim_end_ms` (`20261108130006_communaute_v2_lot_f_stories.sql`) |
| 8 | fait | `CR/story/camera.ts` : `@capacitor/camera`, `CameraSource.Camera`, repli galerie au navigateur |
| 9 | fait | `AUDIENCE_OPTIONS` inclut `close_friends` (table `story_close_friends`) |
| 10 | fait | `REPLY_OPTIONS` (tout le monde / abonnés / désactivées) → `replyPolicy` |
| 11 | fait | `CR/forms/StoryFormV2.tsx` : choix du **jour** du carnet lié (`stickers.carnetDay` → `linked_carnet_day`, lot F), borné au nombre de jours du carnet ; PR #158 |
| 12 | fait | scène affichée à chaque étape (`api.active`) + légende « Aperçu vivant » |
| 13 | fait | `FieldV2` libellés visibles + `.lkdv-cv2-input` 16 px |
| 14 | fait | pied Retour / Suivant / « Publier la story » (`steps.ts` + `CreateSheetV2`) |
| 15 | fait | `CR/fields/videoCompress.ts` + `media.ts` : vidéo > 6 Mo ré-encodée côté client en **MP4** (`captureStream` + `MediaRecorder`, ~2,5 Mbit/s), sans perdre le son ; sans support, sans gain de 15 % ou en cas d'erreur, l'original part tel quel. Tests `finitionTiroirs.test.ts` « Story#15 » |
| 16 | fait | `useDraftV2` conserve les médias déjà téléversés (URL seulement, aucun `blob:`) + bandeau |
| 17 | fait | `CR/engine/CreateFormEngineV2.tsx` `liveValidation` + `errors.ts` `liveFieldIssue` : le champ modifié est revalidé à la frappe (chemin complet, ex. `stickers.link.url`) ; un champ vide jamais tenté reste muet. Activé pour la Story. Tests `finitionTiroirs.test.ts` « Story#17 » |
| 18 | fait | `haptic('light')` à chaque changement d'étape, `haptic('success')` à la publication |
| 19 | fait | île « Story publiée » + « Voir » → rafraîchit la barre des stories (`handleCreatedV2`) et ferme |
| 20 | fait | champ « Texte alternatif » (`altText`, `lot_f`) + ordre scène → champs |

## 7. Carnet (création) — 20 fait

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `useDraftV2` (tracé, jours, moments) + confirmation de fermeture `CreateSheetV2` (`alertdialog`, piège de focus) |
| 2 | fait | `CR/carnet/DaysPaneV2.tsx` `MomentPhotoV2` : `uploadMediaV2` bucket `carnet-media` dès la sélection (EXIF retiré) |
| 3 | fait | `CR/createRpc.ts` `carnetCover` (première photo par défaut) + sélection dans l'étape Partage |
| 4 | fait | `CarnetFormV2` `VISIBILITIES` + `createSchemasV2` L724 (`.default('private')`) |
| 5 | fait | `CARNET_STEPS` Infos / Tracé / Jours / Partage dans la mini-capsule |
| 6 | fait | `CR/carnet/TracePaneV2.tsx` : tracé au doigt + GPX + sortie enregistrée (`hike_sessions`) |
| 7 | fait | `TracePaneV2.centerOnMyPosition` (`getCurrentGeoPosition`, `flyTo`, `startLat/Lng`) |
| 8 | fait | `shared/traceEditing.ts` + `CR/carnet/TracePaneV2.tsx` : points intermédiaires déplaçables (marqueurs `draggable`), suppression d'un segment, historique de 50 pas ; PR #158. Test `shared/__tests__/traceEditing.test.ts` |
| 9 | fait | `TracePaneV2` profil d'altitude SVG en direct (`/api/elevation`) + distance/dénivelé recalculés |
| 10 | fait | `CR/forms/CarnetFormV2.tsx` `CarnetPreviewV2` : aperçu vivant en tête de chaque étape, **tracé en filigrane** (`normalizeRouteTrace`) mis à jour à chaque geste |
| 11 | fait | `CR/carnet/daySwipe.ts` `useDaySwipe` : glisser horizontal entre les jours, le panneau suit le doigt (transform seul), ressort au relâchement, immobile sous `prefers-reduced-motion` ; test `finitionTiroirs.test.ts` « Carnet#11 » |
| 12 | fait | `CARNET_MOMENT_KINDS_V2` : photo, rencontre, nuit, dépense, objet, espèce |
| 13 | fait (dépend de la prod) | `CR/carnet/capabilities.ts` `useCarnetNights` : la nuitée s'affiche **dès que `carnet_nights` répond** (sonde en lecture, plus de drapeau à basculer) et part dans `create_carnet_v2`. En production la table n'existe pas encore (migration `20261108100004` non appliquée) : la saisie reste masquée, sans perte silencieuse. Test `finitionTiroirs.test.ts` « Carnet#13 » |
| 14 | fait | `PartageStep` : carnet collaboratif + résolution de `@handle` → `collaborators` |
| 15 | fait | `proposeDays` (dates → nombre de jours) + `addDay` (jour → date suivante) |
| 16 | fait | `FieldV2` + `readError` par champ (ex. `days`, `joinQuestions`) |
| 17 | fait | `finalLabel` « Créer le carnet » en pilule (`steps.ts`, pied `lkdv-cv2-pill--primary`) |
| 18 | fait | `AiImproveButton` repris dans l'étape Infos ; `CarnetCreateForm` **absent du dépôt** (`find` vide) |
| 19 | fait | `CR/engine/CreateFormEngineV2.tsx` `queueWhenOffline` (Carnet) : un envoi refusé hors ligne est **mis en file** et repart tout seul à la reconnexion (une tentative, idempotent par `client_request_id`) ; les photos déjà envoyées ne sont pas supprimées. Message `QUEUED_OFFLINE_MESSAGE` |
| 20 | fait | `CR/carnet/DaysPaneV2.tsx` : `tablist` + `tabpanel` relié (`aria-controls`/`aria-labelledby`), tabindex itinérant, flèches/Home/End, « + » hors du tablist ; test `create/__tests__/finitionUi.test.tsx` « Carnet#20 » |

## 8. Sortie (création) — 18 fait, 2 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `CR/forms/SortieFormV2.tsx` `ACTIVITY_OPTIONS` en chips icônes (6), plus de doublon recherche + liste |
| 2 | fait | pied Retour / Suivant + `FieldV2` (libellés, 16 px) |
| 3 | fait | `CR/sortie/MeetingMapV2.tsx` : épingle déplaçable + clic carte, `meetingLat/Lng` envoyés |
| 4 | fait | `DateFieldV2` + `TimeFieldV2` (départ et fin) |
| 5 | fait | `CR/sortie/itinerarySourcesV2.ts` + `CR/forms/SortieFormV2.tsx` : « Importer un itinéraire » = une trace (GPX), **un carnet** (`carnets`, distance et D+) ou **une sortie enregistrée** (`hike_sessions`) ; D+ arrondi à 50 m comme la maquette. Tests `finitionTiroirs.test.ts` « Sortie#5 » |
| 6 | fait | cartes de difficulté tactiles (facile/moyen/difficile) avec définition par niveau |
| 7 | fait | `ItineraireStep` : `/api/weather` dès que date + coordonnées sont connues (fenêtre 14 j) |
| 8 | fait | `NumberStepperV2` 44 px + switch liste d'attente + jauge des places |
| 9 | fait | sélection d'un kit existant (`materiel_kits`) comme matériel requis |
| 10 | fait | `SAFETY_CHIPS` (DVA, pelle, sonde, frontale, eau…) + `safetyNotes` libre |
| 11 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (aucune table/RPC d'invitation) |
| 12 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L102 (règle `recurrence` stockée, occurrences non générées ; hint L349-351) |
| 13 | fait | `buildTicket` → `EventTicket variant="preview"` rempli en direct |
| 14 | fait | colonnes réelles (`20261108130003_communaute_v2_lot_c_events_columns.sql`) + payload `createRpc` (`distance_km`, `elevation_gain_m`, `meeting_lat/lng`, `starts_at`…) |
| 15 | fait | `createEventWithPostV2` → `create_event_with_post` (lot E) avec option `announce` |
| 16 | fait | `requiredDate` sur `date` seul + `superRefine` date passée : un seul message sous le champ |
| 17 | fait | `useDraftV2` + bandeau « Brouillon restauré · Effacer » |
| 18 | fait | `reportCreated('sortie')` → île « Sortie créée » + « Partager » |
| 19 | fait | `keyboardGuard` (flèches, Home/End, Entrée neutralisées dans un champ ; capture en mode portail) |
| 20 | fait | `CR/engine/CreateFormEngineV2.tsx` : `<legend>` de chaque étape (« Étape 2 sur 4 : Itinéraire ») + groupes `fieldset/legend` visibles (« Rendez-vous », « Importer un itinéraire ») ; test `finitionUi.test.tsx` « Sortie#20 » |

## 9. Kit — 18 fait, 2 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `CR/forms/KitFormV2.tsx` `MediaFieldV2 name="cover"` (champ ajouté) |
| 2 | fait | `CR/kit/ProductPickerSheetV2.tsx` ouvert via `openDetail` (sous-tiroir empilé avec ‹ Retour) |
| 3 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L104 (pas de recherche produit par EAN : grep `barcode`/`ean` vide) |
| 4 | fait | `CR/forms/KitFormV2.tsx` `StartFromV2` + `CR/kit/kitSourcesV2.ts` : « Partir de » mon kit (`materiel_kits`), un carnet (`carnet_kit_items`), un modèle ou vide ; PR #158 |
| 5 | fait | `KitFormV2.tsx` `KitRingV2` (anneau conique de poids) + `KitLayersV2` (sac en couches porté/sac/consommable) ; PR #158 |
| 6 | fait | `WeightBar` : poids total en direct + jauge ultraléger / léger / standard |
| 7 | fait | stepper de quantité par objet (`− n +`) |
| 8 | fait | glisser un objet vers une catégorie ou sur un autre objet (`pointermove` + `elementsFromPoint`) |
| 9 | fait | `CR/kit/kitContextV2.ts` `kitWeatherSuggestionsV2` + bouton « Adapter à la météo près de moi » : position demandée sur geste, route `/api/weather`, objets proposés (jamais ajoutés) selon froid, pluie, chaleur. Tests `finitionTiroirs.test.ts` « Kit#9 » |
| 10 | fait | `KitFormV2.tsx` : objet perso = nom, **catégorie en chips**, **stepper de poids** 50 g, « Ajouter l’objet » ; PR #158 |
| 11 | fait | case « emporté » par objet (`isChecked`, `aria-pressed`) |
| 12 | fait (dépend de la prod) | `KitFormV2.tsx` « Mode préparation » : check-list « Emporté » + puce « Emprunté » ; les prêts actifs (`materiel_loans`, emprunteur = soi) marquent les objets par `product_ownership_id`. Le lien automatique dépend des prêts réels en base ; le marquage manuel marche partout. Tests `finitionTiroirs.test.ts` « Kit#12 », `finitionUi.test.tsx` |
| 13 | fait | `PartageStep` propose « Kit <saison> · X,X kg » si le nom est vide (modifiable) |
| 14 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L103 (`materiel_kits` n'a que `is_public` : Public / Privé) |
| 15 | fait | `kitContextV2.ts` + `KitFormV2.tsx` « Unités impériales » : valeur initiale = préférence du compte (`localStorage.lkdv_units`, réglages `/compte`), interrupteur local sans modifier le compte, kg ↔ lb partout (aperçu compris). Tests `finitionTiroirs.test.ts` « Kit#15 » |
| 16 | fait | message « Ajoute au moins un objet avec un poids. » affiché dans l'étape Inventaire (`readError('items')`) |
| 17 | fait | La carte kit de la maquette (`.kcard`, mosaïque + nom + pastille d'objectif + anneau) reste affichée en tête des 3 étapes ; le récapitulatif maison qui la doublait à l'étape Partager est supprimé |
| 18 | fait | pied Retour / Suivant + libellés visibles |
| 19 | fait | `useDraftV2` + bandeau |
| 20 | fait | île « Kit créé » + « Partager » et « Utiliser pour une sortie » (préremplit Sortie) |

## 10. Club (création) — 17 fait, 3 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `ClubPreview` + `ClubCrest` généré ; image facultative (`MediaFieldV2`) |
| 2 | fait | `cropOptions` : Original / 1:1 « Carré » / 3:1 « Bannière » |
| 3 | fait | `ChipsFieldV2` multiple sur `ACTIVITY_CHOICES` (5 max) ; écart mineur : pas d'icône dans les chips |
| 4 | fait (dépend de la prod) | `CR/forms/ClubFormV2.tsx` : lieu cherchable (`/api/geocode`), **mini-carte** à épingle déplaçable (`MeetingMapV2`), rayon 5-60 km ; `zone_lat/zone_lng/zone_radius_km` envoyés. `create_club_with_admin` (lot E) n'écrit pas encore `zone_geom`/`zone_radius_km` : tant que la RPC n'est pas étendue, la zone n'est pas persistée (« Près de moi » des clubs ne la voit pas) |
| 5 | fait | `checkClubSlugV2` (`check_club_slug`) en direct + aperçu `lekitduvoyageur.fr/clubs/<slug>` |
| 6 | fait | `moderateText` affiché pendant la saisie du nom |
| 7 | fait | cartes explicatives « Ouvert » / « Sur validation » (`role=radiogroup`) |
| 8 | fait | questions d'adhésion réordonnables (flèches), 3 maximum, lignes 44 px |
| 9 | fait | 3 modèles de charte (randonnée, alpinisme, vélo) |
| 10 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (visibilité privé/secret) |
| 11 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (co-administrateurs) |
| 12 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (inviter des membres) |
| 13 | fait | `ClubFormV2.tsx` `PublicationStep` : aperçu rendu du post d'accueil (nom du club + message) ; PR #158 |
| 14 | fait | île « Club créé » → action « Organiser une sortie » préremplie (`requestCreate('sortie', {clubId})`) |
| 15 | fait | `createClubWithAdminV2` → `create_club_with_admin` (club + admin atomiques) |
| 16 | fait | `ClubPreview` : blason + nom + activités + adhésion, mis à jour en direct |
| 17 | fait | pied Retour / Suivant + libellés + 16 px |
| 18 | fait | `useDraftV2` + bandeau |
| 19 | fait | île « Club créé » + « Ouvrir la page » → `/clubs/<slug>` |
| 20 | fait | `role=radiogroup`/`radio` + `aria-checked`, erreurs `aria-describedby`, ordre de focus logique |

---

## Reportés (01 § 6) — liste exacte et justification du bundle

13 points numérotés, conformes à `01-SPEC-PRODUIT.md` § 6, plus une exception non numérotée.

| Point | Ligne `01 § 6` | Justification du bundle |
|---|---|---|
| Publication#11 (sondage) | L97 | exige de modifier le composant post et la politique de lecture des posts ; option masquée dans la V2 |
| Publication#13 (commentaires / j'aime) | L97 | même bundle post + politique de lecture ; le réglage est inerte et annoncé « prochaine version » |
| Publication#14 (programmation) | L97 | même bundle post + politique de lecture ; aucun sélecteur date/heure de publication |
| Carnets#13 (transition partagée fiche carnet) | L98 | interdiction de toucher `/carnets/[id]` ; la tuile navigue simplement vers la fiche |
| Club#10 (visibilité privé / secret) | L99 | la colonne accepte `open`/`closed`/`secret` (`20261108130008_..._clubs_privacy.sql`), mais le schéma du formulaire (`CLUB_PRIVACIES_V2`) et `create_club_with_admin` n'acceptent que `open` / `closed` |
| Club#11 (co-administrateurs) | L99 | aucune table ni RPC de co-administration à la création |
| Club#12 (inviter des membres) | L99 | aucune table/RPC d'invitation et interdiction d'écrire à de vrais comptes |
| Sortie#11 (inviter des amis ou un club) | L99 | même bundle invitation ; le club organisateur existe (`club_id`) mais n'invite personne |
| Sorties#15 (lien vers le carnet né de la sortie) | L100 | aucune colonne `events → carnets` en base |
| Sorties#14 (rappel la veille) | L101 | dépend du chantier notifications ; seul le `.ics` est livré (détail + fiche) |
| Sortie#12 (récurrence) | L102 | exception explicite : stocker la règle (`recurrence`), ne pas générer les occurrences — c'est exactement ce que fait le formulaire |
| Kit#14 (visibilité Amis) | L103 | `materiel_kits` n'a que `is_public` : Public / Privé seulement |
| Kit#3 (scan de code-barres) | L104 | aucune recherche produit par EAN en base : bouton absent (et non masqué) |
| *Vidéo dans les publications* (non numéroté) | L96 | bucket `carnet-media` limité aux images ≤ 10 Mo ; l'UI de Publication ne propose que des photos, les stories gardent la vidéo (≤ 25 Mo, ≤ 60 s) |

Météo : **non reportée**, car des routes existent (`/api/explorer/v2/weather`, `/api/weather`, `/api/elevation`). Sortie#7 et Story#5 sont donc comptés `fait` ; Sorties#8 reste `partiel` pour un autre motif (tuile, voir ci-dessous).

## Clôture des 26 points (23 partiels + 3 non faits)

Tous clos au 2026-11-10 ; preuves dans les lignes ci-dessus. Tests : `src/features/community/v2/create/__tests__/finitionTiroirs.test.ts`,
`finitionUi.test.tsx`, `shared/__tests__/finitionCss.test.ts`. Captures 390 / 360 / 430, thème sombre, états et invité, avec la
maquette dans le même état : `ecarts-maquette/captures-finition/` (+ `audit-transverses.json`).

### Dépendent des données de production (UI et état vide livrés)

| # | Ce qui manque en production |
|---|---|
| Carnets#2 | migration `20261108190000` (`carnets.country_iso`) non appliquée (FID-078) |
| Carnet#13 | migration `20261108100004` (`carnet_nights`) non appliquée : la nuitée reste masquée tant que la table ne répond pas |
| Club#4 | `create_club_with_admin` n'écrit pas `zone_geom` / `zone_radius_km` (la colonne existe, lot B) : extension de la RPC à faire |
| Kit#12 | lien automatique « Emprunté » = prêts réels (`materiel_loans`) ; marquage manuel disponible |

### Écarts mineurs assumés

- Sorties#3 : bascule libellée « Billets / Liste » au lieu de « Grille / Liste ».
- Invité : un geste interdit (j'aime) **redirige** vers l'inscription avec un toast (recette e2e 8b) ; la maquette montre d'abord une île « Se connecter ».
- Recherche#6, Recherche#12, Sorties#4, Publication#18 : voir l'audit du 2026-11-08 (écarts sans impact fonctionnel).

## Reportés — rappel (13, décision de Tony attendue)

Publication#11, #13, #14 · Carnets#13 · Club#10, #11, #12 · Sortie#11, #12 · Sorties#14, #15 · Kit#3, #14 (liste complète et raisons ci-dessus).
