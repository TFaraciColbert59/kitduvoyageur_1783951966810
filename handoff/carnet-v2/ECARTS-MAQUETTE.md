# Écarts maquette ↔ fiche carnet v2 — état après la reprise du 8 nov. 2026

> **Mise à jour du 9 nov.** : ce document est historique. Les tableaux § 1 à § 5 contiennent des énoncés dépassés
> (« tables non migrées en prod », « pas de pilule de reprise »). La source de vérité est `CHECKLIST-100.md` et
> `docs/claude/FINITION-SUIVI.md` ; voir § 7.

**Référence** : `annexes/maquette-fiche-carnet.html`, rendue à **430 × 932** (capture
`docs/audit/carnet-v2-2026-11-08/captures/maquette-430x932.png`).
**Mesure** : prod locale Next 15 + Supabase de démo, compte `@lea.fontaine`,
viewport 430 × 932, puis 768 et 1440. Captures « après » dans le même dossier.
**Méthode** : DOM mesuré (boîtes, styles calculés), pas de comparaison à l'œil.

> La première version de ce document (8 nov., matin) contenait deux erreurs :
> la pilule « Reprendre » existait déjà (c'est « Reprendre le kit », un fork),
> et le tiroir n'était pas seulement « simplifié » : sa feuille était en plein
> écran et le CSS du `SlotShell` n'était pas chargé. Les lignes corrigées sont
> marquées **[corrigé]**.

---

## 1. Ce qui est fermé dans cette reprise

| #      | Surface                                     | Avant                                                                                                                                    | Après                                                                                                                                                                                                                                                                                | Preuve                                                                        |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **1**  | Accessoire altimétrique `#acc`              | absent ; le tiroir Route > Altitude affichait un faux « Trace altimétrique interactive synchronisée » sans courbe                        | `CarnetAltitude` (SVG, curseur tactile + clavier) ; branché sur un profil **réel** `positions_timed[].elevationM` ; accessoire au-dessus de la barre seulement si ≥ 2 mesures ; sinon état vide honnête                                                                              | `CarnetAltitude.test.tsx` (3), `elevationProfile.test.ts` (4), capture tiroir |
| **2**  | Peek & Pop `.ctx`                           | appui long → simple toast                                                                                                                | `CarnetPeek` : aperçu verre 310, 4 actions réelles (J'aime le carnet, Commenter, Ouvrir, Partager), `aria-modal`, focus piégé, Échap, clic extérieur, scroll lock, sortie animée. Le j'aime est celui du carnet : les tables `carnet_moment_likes/saves` ne sont pas migrées en prod | capture `after-peek-430.png`, e2e scénario 11                                 |
| **3**  | Pilule « Reprendre »                        | **[corrigé]** « Reprendre le kit » et « Reprendre dans mon sac » existent (fork réel) ; la pilule de **reprise de lecture** n'existe pas | inchangé : le fork est conservé ; la reprise de lecture reste hors périmètre (aucun état de lecture persisté)                                                                                                                                                                        | `CarnetDrawerV2.tsx` L332/L862                                                |
| **4**  | Verdicts Top / Flop / Neutre                | colonnes absentes en prod (`42703`), fallback                                                                                            | inchangé : fallback résilient, aucun verdict inventé                                                                                                                                                                                                                                 | SQL `carnet_kit_items` (pas de colonne `verdict`)                             |
| **5**  | Morphing de la pilule titre                 | menu standard                                                                                                                            | inchangé (menu standard, pas de morphing géométrique)                                                                                                                                                                                                                                | —                                                                             |
| **6**  | Dialogue d'affichage `#popv`                | bouton soleil seul, pas de popover                                                                                                       | popover « Affichage » famille D, 2 interrupteurs iOS (`Plein soleil`, `Réduire les animations`), Échap, clic extérieur, focus rendu                                                                                                                                                  | capture `after-display-430.png`, test unitaire                                |
| **7**  | Lentille chromatique de la barre `.tb.drag` | absente                                                                                                                                  | inchangé : la barre globale n'est pas dans le périmètre de la fiche                                                                                                                                                                                                                  | —                                                                             |
| **8**  | Marqueurs SVG vs WebGL                      | MapLibre (ADR-002)                                                                                                                       | inchangé, conforme au socle                                                                                                                                                                                                                                                          | —                                                                             |
| **9**  | Cascade d'ouverture des lignes              | bloc                                                                                                                                     | partiel : les rangées du tiroir entrent par la transition de `LensPager` ; pas de stagger 30 ms par ligne                                                                                                                                                                            | —                                                                             |
| **10** | Accès anonyme                               | middleware 307                                                                                                                           | hors périmètre (décision produit, `00-MISSION.md` §5)                                                                                                                                                                                                                                | —                                                                             |

## 2. Défauts découverts pendant la reprise (et corrigés)

| #       | Défaut                                                                                                           | Cause mesurée                                                                                                                                                                     | Correction                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-A** | Texte blanc sur verre clair dans la carte et le tiroir (`rgba(255,255,255,.71)` sur `#F5F2EC`), contraste ~1,1:1 | la fiche utilisait `--lkv-text-secondary` / `--lkv-primary`, tokens du thème liquide **sombre** globaux ; elle ne monte pas `.phone`, qui porte `--label` / `--label2` / `--tint` | bloc de jetons du socle sur `.lkdv-carnet-v2-root` (source `compte-v8.css` L26-34), remplacement des 18 usages CSS + 50 usages TSX          |
| **D-B** | Tiroir en plein écran (`inset:0`, rayon 32 en haut), pas une feuille                                             | conteneur `.lkdv-carnet-drawer` écrit `inset:0` en inline                                                                                                                         | feuille **406 × 521.9 @ 12,48** (`56dvh`), `r24`, recette `--sheet-*` ; `role="dialog"`, `aria-modal`, `tabIndex=-1`                        |
| **D-C** | Capsule de lentilles hors de la feuille (y = 1048 pour une feuille à 570)                                        | `DRAWER_V2_CSS` du `SlotShell` n'était **pas injecté** par la fiche                                                                                                               | injection de `DRAWER_V2_CSS` dans `CarnetScreenV2` ; le shell devient `position:relative`, la capsule se pose à `bottom:10`                 |
| **D-D** | Crash de la fiche à 768 / 1440 (`Ce carnet n'a pas pu être chargé`)                                              | `bottomBarOverlap` lisait la barre non stylée ≥ 768 (D-01) à `top≈0` et ajoutait toute la hauteur de l'écran au padding ; maplibre levait dans `cameraForBoxAndBearing`           | garde `barTop < 80 → 0` + `fitBoundsSafely` (conteneur mesuré, bounds finis, padding non négatif)                                           |
| **D-E** | Carte étirée à 768 / 1440 (712 / 1384 px) et `scrollHeight` > `innerHeight`                                      | pas de règle responsive ; `padding:16px` du `.lkdv-compte-v8`                                                                                                                     | colonne **430 centrée**, hauteur `100dvh`, `padding:0!important`, barre flottante retirée quand la fiche est montée, fond de page `#F5F2EC` |
| **D-F** | Sélecteur de jour rogné et posé dans le flux de la grille                                                        | `position:absolute` dans `.lkdv-day-swipe-view`                                                                                                                                   | portail vers `#card`, `right:10 / bottom:10` (maquette `.ig-tabs-float`), masqué quand une feuille est ouverte                              |
| **D-G** | 4 boutons ronds dans la barre haute (retour, +, soleil, réglages)                                                | deux boutons pour deux réglages                                                                                                                                                   | 3 boutons max : retour, +, Affichage ; les réglages/partage passent dans le menu du titre                                                   |

## 3. Écarts encore assumés

| Écart                                                  | Raison                                                                                              | Suite                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Reprise de lecture (pilule)                            | aucun état de lecture persisté ; le fork de kit existe et reste                                     | à spécifier si le produit veut mémoriser un point de lecture                             |
| Verdicts                                               | colonnes absentes de la base distante                                                               | appliquer les migrations Lot D/E après sauvegarde                                        |
| Morphing du titre, lentille chromatique, cascade 30 ms | micro-animations non bloquantes                                                                     | lot motion séparé                                                                        |
| Jours `J211` / `J212` dans le sélecteur                | données de démo `carnet_moments.jour_numero` hors bornes ; la fiche ne filtre pas une donnée réelle | assainir la donnée, pas l'écran                                                          |
| Accessoire altimétrique invisible en démo              | aucune mesure `elevationM` en base (326 échantillons, tous `null`)                                  | l'accessoire apparaît dès qu'une sortie porte des altitudes réelles ; testé unitairement |

## 4. Mesures après reprise

| Viewport   | Racine             | Carte                 | Feuille              | `scrollHeight`       |
| ---------- | ------------------ | --------------------- | -------------------- | -------------------- |
| 430 × 932  | 430 × 932          | 406 × 542.08 @ 12,49  | 406 × 521.91 @ 12,48 | 932 = `innerHeight`  |
| 768 × 1024 | 430 × 1024 centrée | 406 × 605.55 @ 181,49 | 406 × 521.91         | 1024 = `innerHeight` |
| 1440 × 900 | 430 × 900 centrée  | 406 × 520 @ 517,49    | 406 × 521.91         | 900 = `innerHeight`  |

Barre flottante : `402 × 60` à 430 ; `display:none` à ≥ 768 quand la fiche est montée.

## 5. Contre-recette du 8 novembre 2026 (20 h 55)

Cinq défauts trouvés en vérifiant la production, corrigés et testés :

| Défaut                            | Constat                                                                                                                                   | Correction                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Like du post sans retour visuel   | le bouton « Aimer (0) » restait à 0 alors qu'il supprimait le like **carnet** (état initial pris dans `momentEngagement`, absent en prod) | `CarnetPostSheet` reçoit `liked`/`likes` réels de `useCarnetEngagement` ; le Peek affiche « J'aime le carnet » |
| Lignes du tiroir non accessibles  | étapes, nuits, objets et participants étaient des `<div onClick>` sans rôle ni clavier                                                    | converties en `<button type="button">`, styles conservés                                                       |
| Grille de moments : ARIA invalide | `role="grid"` avec des `button role="gridcell"` sans `role="row"` (2 violations axe **critical**)                                         | `role="group"` + tuiles `button` sans rôle de cellule ; axe page/tiroir/peek = 0 critical/serious              |
| Focus qui sortait du tiroir       | après la dernière lentille, Tab atteignait `body` (les panes inactifs `inert` restaient dans la liste)                                    | piège de focus déplacé manuellement sur la liste filtrée `[inert]`                                             |
| Fond non inerte                   | `aria-modal` seul, sans `inert` sur la carte et la carte du bas                                                                           | `inert` + `aria-hidden` sur les deux sections et sur la barre flottante pendant une feuille                    |
| « 1 jours »                       | pluriel figé dans le résumé et le statut                                                                                                  | `1 jour` / `n jours`                                                                                           |

Contre-recette : axe 0 critical/serious (page, tiroir, peek), focus piégé sur 25 Tab,
like post/peek qui change d'état, 390/360 sans débordement, `tsc` ciblé 0, 118/118 tests.

## 6. Refonte 100 % (8 novembre 2026, 22 h)

### Fermé côté code

| Surface | État |
|---|---|
| Résumé | `dayhead` `Tout` + une **voyage-card** 144 px par jour (photo, `J{n} · date`, altitude de nuit si réelle, `from → to`, km · D+ · moments), clic → jour |
| Vue jour | `dayhead` `J{n}` (route, date · durée · km · D+, météo) + grille 3 colonnes ; bannière de verre supprimée |
| Carte | fond **topo** par défaut, badge `Tout`/`J{n}`, badges `N{n}` verre (si nuits), curseur de scrub, drag de la poignée > 20 px |
| Altitude | profil **réel** Open-Meteo (cache 1 h, timeout 3 s, échec → état vide), accessoire visible, curseur carte, lentille Route › Altitude |
| Peek | 5 actions par moment : J'aime, Commenter, Enregistrer, Partager, Signaler |
| Post | j'aime/enregistrer/commentaires **par moment** (`carnet_moment_*`) |
| Signalement | moment et carnet persistés dans `comment_reports` (`table_name` = `carnet_moments` / `carnets`) |
| Verdicts | filtres Essentiel/Utile/Jamais servi/Défaillant/Manquait + état vide honnête |
| Tiroir | cascade 0/30/60/90 ms, pilule « Reprendre » de lecture, « Reprendre le kit » intacte |
| Titre | morphing 500 ms + point d'édition pulsant |
| A11y | axe 0 critical/serious sur résumé, jour, tiroir, peek ; focus piégé ; `inert` ; barre masquée sous toutes les feuilles |

### Migrations appliquées en production (additives, RLS)

`carnet_v2_lot_a_access_functions`, `lot_b_day_reactions`, `lot_c_moment_engagement`,
`lot_d_nights_verdicts_live`, `lot_e_kit_forks`, `post_reports_target_type`.
Tables : `carnet_moment_likes/saves/comments`, `carnet_day_likes/comments`,
`carnet_nights`, `carnet_live_positions`, `kit_forks`. Colonnes verdict sur
`carnet_kit_items`, `live_sharing` sur `carnets`.

### Encore bloqué par la donnée ou le produit

- **Nuits** : `carnet_nights` est vide en démo → aucun badge `N1/N2/N3`, aucune fiche nuit. Dès qu'une nuit réelle existe, le code l'affiche.
- **Verdicts** : colonnes créées, aucune valeur en démo → filtres + état vide, jamais de verdict inventé.
- **Jours J211/J212** : données de démo hors bornes, non filtrées.
- **Distance/D+ par jour** : `days[].distanceKm/elevationM` nuls en démo pour J1/J2 → `—`, pas d'invention.
- **Accès anonyme** : middleware inchangé (décision produit/sécurité du 00-MISSION §5).
- **Lentille chromatique** : barre flottante globale, hors fiche.
- **Échelle de carte, départ/arrivée, couches par tiroir** : partiels.
- **Squelettes/chargement/hors-ligne** : partiels.

## 7. Reprise du 9 novembre 2026 (banc de fidélité)

| Surface | Avant | Après | Preuve |
|---|---|---|---|
| Tiroirs (5) : capsule | 402×36 à y=66 | 338×56 à y=69 | banc : 31/31 mesures sur les 5 tiroirs (était 16/31) |
| Tiroirs : contenu, barre de lentilles | y=122/140, 132 px | y=133, 181×30 à y=490,4, verre clair | idem |
| Résumé : pastille titre | x=52 (bouton Retour en trop) | x=12, chevron, 3 boutons ronds | banc : 64/69 mesures (était 48/69) |
| Résumé : km / D+ | 15 km, +860 (dernière sortie) | 72,4 km, +4 520 (somme des sorties) | `finition.test.ts` « totaux du carnet » |
| Résumé : cartes-jour, avatar | aplat sombre | illustration `CarnetArt` en repli de photo | capture `resume-*` |
| Fil › Résumé | liste de moments | une carte postale par jour | capture |
| Sac : verdict inconnu | plantage | repli neutre | test « verdict inconnu » |
| Pixels différents (Résumé 390) | 41,5 % | 30,3 % | `FINITION-SUIVI.md` §Scores |
| Pixels différents (tiroirs 390) | 41–53 % | 13–38 % | idem |

Décisions : le bouton Retour de la barre haute est retiré (la maquette n'en a pas ; retour par le navigateur ou le geste
système) ; la pastille de lecture « Reprendre » est retirée (absente de la maquette) ; les lentilles « Nuit » et « Météo
et ciel » portent le nom de la maquette ; Équipage garde trois lentilles (la maquette n'a pas de « Commentaires » : ils
sont dans « Réactions ») ; le menu « Enregistrer » de la maquette est le rail ··· du post (Enregistrer, Copier le lien,
Signaler), déjà fourni par `CommunityFeedPost` via `CarnetPostSheet`.
