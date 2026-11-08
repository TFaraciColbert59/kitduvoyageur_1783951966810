# Couverture des 200 améliorations — Communauté v2

**Date : 2026-11-08** · Audit documentaire statique (lecture du code livré, aucun test exécuté ici).
Source des exigences : `handoff/communaute-v2/annexes/D-document-refonte.md` (20 améliorations × 10 volets).
Exceptions admises : `handoff/communaute-v2/01-SPEC-PRODUIT.md` § 6 (L96-105).

## Résumé chiffré (sur 200)

| Statut | Nombre |
|---|---|
| fait | **161** |
| partiel | **23** |
| reporté (01 § 6) | **13** |
| non fait | **3** |
| **Total** | **200** |

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
Rappel des écarts déjà connus du Lead, confirmés ici : visa sans pays (`Carnets#2`), pastille « En route » au lieu de l'anneau conique (`Carnets#4`), libellé « Billets » au lieu de « Grille » (`Sorties#3`), `carnet_nights` masqué en prod (`Carnet#13`).

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

## 2. Carnets — 16 fait, 3 partiel, 1 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `EX/tiles/CarnetTileV2.tsx` + `src/styles/communaute-v2.css` `.lkdv-cv2-tile` (`--drawer-card-*`, rayon 14-20) |
| 2 | partiel | `CarnetTileV2.visaLabel` = jours · km ; **pas de pays** : `SH/types.ts` `CarnetCardVM` n'a pas `country_iso` et `community_carnets_feed` ne le renvoie pas (grep) |
| 3 | fait | `EX/panes/CarnetsPane.tsx` : 1er carnet `wide week` puis grille 2 colonnes |
| 4 | partiel | `CarnetTileV2` L130-135 : pastille + point « En route » ; **pas d'anneau conique animé** (grep `conic` = 0 dans les CSS v2) |
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
| 19 | partiel | « Créer » OK (`onCreateRequested('carnet')`) ; **aucun « Tout voir »/hub filtré** dans le volet (grep « Tout voir » : seulement `SearchResults`) |
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

## 4. Sorties — 16 fait, 2 partiel, 2 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `SH/EventTicket.tsx` (souche jour/mois, topo à droite) + `EX/tiles/EventTicketV2.tsx` |
| 2 | fait | `SH/AgendaStrip.tsx` (14 jours, points, date complète, 44 px) + `DA/useEventAgenda.ts` + filtre `eventDay` |
| 3 | fait | `EX/panes/EventsPane.tsx` vue `list` : `groupEventsByAgenda` (Ce week-end / La semaine prochaine / Plus tard). Écart : libellé « Billets » au lieu de « Grille » |
| 4 | fait | `EventTicket` : barre de capacité + badges Complet / Liste d'attente / Inscrit + `EventDetailView` jauge `role="progressbar"` |
| 5 | fait | `EventActionButton` : 44 px, libellés Inscrit ✓ / Liste d'attente / Complet / Terminée |
| 6 | fait | lien `/sorties/<id>` intercepté vers le détail (`EventTicketV2`), lien « Voir la fiche de la sortie » |
| 7 | fait | `EventTicket` chips : niveau, distance, D+, durée (+ reprise dans `EventDetailView`) |
| 8 | partiel | météo du jour J dans `EX/details/EventDetailView.tsx` (fenêtre J-7) ; **aucune météo sur la tuile** (`EventTicket`/`EventTicketV2` : grep `weather` = 0) |
| 9 | fait | `EventDetailView` : `PlaceMiniMap` + « Itinéraire » (Google Maps) |
| 10 | fait | `EventDetailView` : carte organisateur (avatar, nom, « Organisateur ») |
| 11 | partiel | `EventDetailView` : avatars des participants seulement ; **pas d'amis inscrits** distingués (`ClubDetailExtras.friends` existe, pas pour les sorties) |
| 12 | fait | `EX/ExploreCapsule.tsx` `EVENT_FILTER_ITEMS` |
| 13 | fait | détail empilé (`SheetDetail` + `‹ Retour`) |
| 14 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L101 (« seulement le fichier `.ics` ; rappel dépend du chantier notifications »). `.ics` fait : `EventDetailView.downloadIcs` + fiche |
| 15 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L100 (« aucune colonne `events → carnets` ») |
| 16 | fait | `handleEventSignup` : île « Inscription confirmée » + Annuler + `haptic('success')` |
| 17 | fait | `EventsPane` état vide + « Organiser une sortie » → `onCreateEvent` |
| 18 | fait | `ExploreError` + Réessayer, bouton occupé, `ExploreSkeleton variant="tickets"` |
| 19 | fait | `EventTicket` verre de `/compte`, titre 14 px, action 44 px |
| 20 | fait | `EventTicket.ariaLabel` : date complète + niveau + dénivelé + état ; `AgendaStrip` libellé « samedi 14 novembre · 2 sorties » |

## 5. Publication — 16 fait, 1 partiel, 3 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `CR/engine/steps.ts` `POST_STEPS` : Format, Contenu, Diffusion (mini-capsule) |
| 2 | fait | `CR/fields/FieldV2.tsx` : `<label>` visible 600 10 px majuscules ; placeholders en exemples |
| 3 | fait | `src/styles/communaute-v2.css` `.lkdv-cv2-input` (16 px, `--cv2-field-height: 48px`, rayon/verre v2) |
| 4 | fait | `CR/forms/PostFormV2.tsx` `previewPost` + `CommunityFeedPost embedded` en aperçu vivant |
| 5 | fait | étape 0 = Format + Audience ; étape 1 = médias, avec avertissement immédiat si audience non publique |
| 6 | partiel | réordonnancement au doigt (`MediaFieldV2`, `moveItem`) OK ; **bouton Supprimer 30×30** (`.lkdv-cv2-media-remove`), seuls poignée/`open` ont 44 px |
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

## 6. Story — 17 fait, 3 partiel

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
| 11 | partiel | carnet lié (`stickers.carnetId` → `linked_carnet_id`) ; **aucun choix de jour** (`linked_carnet_day` existe en base, pas d'UI) |
| 12 | fait | scène affichée à chaque étape (`api.active`) + légende « Aperçu vivant » |
| 13 | fait | `FieldV2` libellés visibles + `.lkdv-cv2-input` 16 px |
| 14 | fait | pied Retour / Suivant / « Publier la story » (`steps.ts` + `CreateSheetV2`) |
| 15 | partiel | progression sur la vignette + « Réessayer » + ré-encodage JPEG au recadrage ; **vidéo envoyée telle quelle** (`media.ts` `uploadMediaV2` : `isVideo ? file`) |
| 16 | fait | `useDraftV2` conserve les médias déjà téléversés (URL seulement, aucun `blob:`) + bandeau |
| 17 | partiel | erreurs sous le champ (`aria-describedby`) mais validation **à l'étape** (`validateStepAt`), pas pendant la frappe ; lien invalide signalé au Suivant |
| 18 | fait | `haptic('light')` à chaque changement d'étape, `haptic('success')` à la publication |
| 19 | fait | île « Story publiée » + « Voir » → rafraîchit la barre des stories (`handleCreatedV2`) et ferme |
| 20 | fait | champ « Texte alternatif » (`altText`, `lot_f`) + ordre scène → champs |

## 7. Carnet (création) — 14 fait, 6 partiel

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `useDraftV2` (tracé, jours, moments) + confirmation de fermeture `CreateSheetV2` (`alertdialog`, piège de focus) |
| 2 | fait | `CR/carnet/DaysPaneV2.tsx` `MomentPhotoV2` : `uploadMediaV2` bucket `carnet-media` dès la sélection (EXIF retiré) |
| 3 | fait | `CR/createRpc.ts` `carnetCover` (première photo par défaut) + sélection dans l'étape Partage |
| 4 | fait | `CarnetFormV2` `VISIBILITIES` + `createSchemasV2` L724 (`.default('private')`) |
| 5 | fait | `CARNET_STEPS` Infos / Tracé / Jours / Partage dans la mini-capsule |
| 6 | fait | `CR/carnet/TracePaneV2.tsx` : tracé au doigt + GPX + sortie enregistrée (`hike_sessions`) |
| 7 | fait | `TracePaneV2.centerOnMyPosition` (`getCurrentGeoPosition`, `flyTo`, `startLat/Lng`) |
| 8 | partiel | annuler/rétablir + repères départ/arrivée déplaçables ; **pas de déplacement d'un point intermédiaire ni de suppression de segment** |
| 9 | fait | `TracePaneV2` profil d'altitude SVG en direct (`/api/elevation`) + distance/dénivelé recalculés |
| 10 | partiel | récap « Aperçu de la fiche » à l'étape Partage (couverture, stats, visibilité) ; **pas de tracé** et pas de mise à jour au fil des étapes |
| 11 | partiel | onglets jours `role="tablist"` + précédent/suivant ; **pas de glisser entre les jours** qui suit le doigt |
| 12 | fait | `CARNET_MOMENT_KINDS_V2` : photo, rencontre, nuit, dépense, objet, espèce |
| 13 | partiel | nuitée/refuge par jour codée mais **masquée en prod** : `CR/carnet/capabilities.ts` `HAS_CARNET_NIGHTS = false` (migration `carnet_v2_lot_d` non appliquée) |
| 14 | fait | `PartageStep` : carnet collaboratif + résolution de `@handle` → `collaborators` |
| 15 | fait | `proposeDays` (dates → nombre de jours) + `addDay` (jour → date suivante) |
| 16 | fait | `FieldV2` + `readError` par champ (ex. `days`, `joinQuestions`) |
| 17 | fait | `finalLabel` « Créer le carnet » en pilule (`steps.ts`, pied `lkdv-cv2-pill--primary`) |
| 18 | fait | `AiImproveButton` repris dans l'étape Infos ; `CarnetCreateForm` **absent du dépôt** (`find` vide) |
| 19 | partiel | brouillon local (tracé et saisie) + message hors ligne ; **renvoi manuel** à la reconnexion, pas de file d'attente |
| 20 | partiel | alternative carte = liste des points (`details`) + champs 16 px ; `role="tab"` **sans `aria-controls`/tabpanel ni flèches** (tablist incomplet) |

## 8. Sortie (création) — 16 fait, 2 partiel, 2 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `CR/forms/SortieFormV2.tsx` `ACTIVITY_OPTIONS` en chips icônes (6), plus de doublon recherche + liste |
| 2 | fait | pied Retour / Suivant + `FieldV2` (libellés, 16 px) |
| 3 | fait | `CR/sortie/MeetingMapV2.tsx` : épingle déplaçable + clic carte, `meetingLat/Lng` envoyés |
| 4 | fait | `DateFieldV2` + `TimeFieldV2` (départ et fin) |
| 5 | partiel | import GPX avec distance + D+ calculés ; **pas d'import depuis un carnet ni un itinéraire existant** |
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
| 20 | partiel | chaque étape est un `<fieldset>` mais **aucun `<legend>`** (grep 0) ; erreurs reliées par `aria-describedby` |

## 9. Kit — 11 fait, 4 partiel, 2 reporté, 3 non fait

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `CR/forms/KitFormV2.tsx` `MediaFieldV2 name="cover"` (champ ajouté) |
| 2 | fait | `CR/kit/ProductPickerSheetV2.tsx` ouvert via `openDetail` (sous-tiroir empilé avec ‹ Retour) |
| 3 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L104 (pas de recherche produit par EAN : grep `barcode`/`ean` vide) |
| 4 | non fait | cherché dans `KitFormV2`, `ProductPickerSheetV2`, `kitCompletion`, `createRpc` : aucune reprise d'un kit existant, d'un « Repris » de carnet ni d'un modèle |
| 5 | partiel | objets groupés par catégorie avec poids ; **pas de « sac en couches » ni d'anneau `KitRing`** (grep `KitRing`/`conic` vide) |
| 6 | fait | `WeightBar` : poids total en direct + jauge ultraléger / léger / standard |
| 7 | fait | stepper de quantité par objet (`− n +`) |
| 8 | fait | glisser un objet vers une catégorie ou sur un autre objet (`pointermove` + `elementsFromPoint`) |
| 9 | partiel | `suggestKitCompletion` sur modèle figé `'bivouac'` + saison ; **météo non utilisée** |
| 10 | partiel | objet perso : texte + `input number` + `select` catégorie (16 px) ; **pas de stepper de poids ni de chips** |
| 11 | fait | case « emporté » par objet (`isChecked`, `aria-pressed`) |
| 12 | non fait | cherché « Prêts/loan » dans `KitFormV2` et `createRpc` : aucun lien avec les prêts de `/compte` |
| 13 | fait | `PartageStep` propose « Kit <saison> · X,X kg » si le nom est vide (modifiable) |
| 14 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L103 (`materiel_kits` n'a que `is_public` : Public / Privé) |
| 15 | non fait | cherché `imperial`/`unit` dans le formulaire : aucune préférence d'unités du compte |
| 16 | fait | message « Ajoute au moins un objet avec un poids. » affiché dans l'étape Inventaire (`readError('items')`) |
| 17 | partiel | récap maison (couverture, poids, visibilité, saison) ; **pas la `KitCard` de `/compte`** |
| 18 | fait | pied Retour / Suivant + libellés visibles |
| 19 | fait | `useDraftV2` + bandeau |
| 20 | fait | île « Kit créé » + « Partager » et « Utiliser pour une sortie » (préremplit Sortie) |

## 10. Club (création) — 15 fait, 2 partiel, 3 reporté

| # | Statut | Preuve / fichier |
|---|---|---|
| 1 | fait | `ClubPreview` + `ClubCrest` généré ; image facultative (`MediaFieldV2`) |
| 2 | fait | `cropOptions` : Original / 1:1 « Carré » / 3:1 « Bannière » |
| 3 | fait | `ChipsFieldV2` multiple sur `ACTIVITY_CHOICES` (5 max) ; écart mineur : pas d'icône dans les chips |
| 4 | partiel | « Zone d'activité » en texte + rayon en chips (25/50/100/200 km) ; **pas de mini-carte** |
| 5 | fait | `checkClubSlugV2` (`check_club_slug`) en direct + aperçu `lekitduvoyageur.fr/clubs/<slug>` |
| 6 | fait | `moderateText` affiché pendant la saisie du nom |
| 7 | fait | cartes explicatives « Ouvert » / « Sur validation » (`role=radiogroup`) |
| 8 | fait | questions d'adhésion réordonnables (flèches), 3 maximum, lignes 44 px |
| 9 | fait | 3 modèles de charte (randonnée, alpinisme, vélo) |
| 10 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (visibilité privé/secret) |
| 11 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (co-administrateurs) |
| 12 | reporté (01 § 6) | `01-SPEC-PRODUIT.md` L99 (inviter des membres) |
| 13 | partiel | switch + `TextAreaFieldV2` du post d'accueil ; **pas d'aperçu rendu** du post |
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

## Non faits / écarts constatés

### Non faits (3)

| # | Raison factuelle |
|---|---|
| Kit#4 | Aucun point d'entrée « partir d'un kit existant » : rien dans `KitFormV2`, `ProductPickerSheetV2`, `kitCompletion` ni `createRpc` (grep `reprendre`/`fork`/`modèle` vide côté formulaire) |
| Kit#12 | Aucun lien avec les Prêts de `/compte` : aucun champ ni requête `loan`/`prêt` dans le formulaire Kit |
| Kit#15 | Aucune préférence d'unités (métrique/impérial) lue ni proposée dans le formulaire Kit |

### Partiels (23) et écart précis

| # | Écart |
|---|---|
| Carnets#2 | Visa = jours · km ; pas de pays (`CarnetCardVM` sans `country_iso`, RPC sans colonne pays) |
| Carnets#4 | Pastille « En route » + point, pas d'anneau conique animé |
| Carnets#19 | « Créer » réparé ; pas de « Tout voir » ni de hub filtré dans le volet Carnets |
| Sorties#8 | Météo J-7 dans le détail seulement, absente des tuiles |
| Sorties#11 | Participants en avatars, pas d'amis inscrits distingués |
| Publication#6 | Réordonnancement OK ; bouton Supprimer 30×30 au lieu de 44 px |
| Story#11 | Carnet lié, mais pas de rattachement à un jour (`linked_carnet_day` non exposé) |
| Story#15 | Progression + réessai + compression des images ; vidéo téléversée non compressée |
| Story#17 | Erreurs en ligne mais validation à l'étape, pas « en direct » pendant la frappe |
| Carnet#8 | Annuler/rétablir + extrémités déplaçables ; pas de point intermédiaire déplaçable ni de segment supprimable |
| Carnet#10 | Récap fiche à la dernière étape (sans tracé), pas d'aperçu vivant au fil de la saisie |
| Carnet#11 | Onglets de jours + précédent/suivant ; pas de glisser suivant le doigt |
| Carnet#13 | Nuitées codées mais masquées en prod (`HAS_CARNET_NIGHTS = false`, `carnet_nights` non appliqué) |
| Carnet#19 | Saisie conservée hors ligne, renvoi manuel (pas de file d'attente à la reconnexion) |
| Carnet#20 | `role="tab"` sans `aria-controls`/tabpanel ni flèches (tablist incomplet) |
| Sortie#5 | Import GPX seulement ; pas d'import depuis un carnet ou un itinéraire existant |
| Sortie#20 | `<fieldset>` par étape sans `<legend>` visible |
| Kit#5 | Groupes par catégorie avec poids ; ni « sac en couches » ni anneau `KitRing` |
| Kit#9 | Suggestions sur modèle figé + saison ; météo absente |
| Kit#10 | Objet perso en `input number` + `select` ; pas de stepper de poids ni de chips |
| Kit#17 | Récap maison ; pas la `KitCard` de `/compte` |
| Club#4 | Rayon d'activité en chips ; pas de lieu sur mini-carte |
| Club#13 | Post d'accueil éditable ; pas d'aperçu rendu |

### Écarts mineurs sur des points comptés `fait`

- Clubs#3 : chips d'activité sans icône (texte seul).
- Sorties#3 : bascule libellée « Billets / Liste » au lieu de « Grille / Liste » (écart déjà connu du Lead).
- Recherche#6 : eyebrow partagé à 11 px (le document demande 10,5 px) — même échelle, aucun impact fonctionnel.
- Recherche#12 : skeleton de lignes présent ; la cascade `sheetRowIn` du document est nommée `cv2RowIn` et s'applique à l'entrée des détails, pas au skeleton.
- Sorties#4 : la jauge est rendue en ligne (`.lkdv-cv2-capacity`) et non par un composant nommé `CapacityGauge`.
- Publication#18 : le pied affiche « Envoi des médias… X % » et l'envoi est refusé avec un message, mais le bouton n'est pas `disabled` pendant le téléversement (il l'est pendant l'envoi du formulaire).
