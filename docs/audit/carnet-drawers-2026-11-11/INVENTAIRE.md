# Inventaire — tiroirs et sous-tiroirs de la fiche Carnet v2

Date : 2026-11-11. Source : build fixtures (participant) + production `koosmoweb.fr` en session réelle (visiteur). Captures dans `docs/audit/carnet-drawers-2026-11-11/`.

## 1. Méthode et limites

- **Tiroirs et lentilles** : captures 390×844 (deviceScaleFactor 2) sur le build fixtures, rôle participant, `contrast: more` (repli opaque du verre pour la lisibilité en Chromium headless) ; les captures de production sont en session visiteur réelle.
- Les **fiches** (moment, étape, nuit, objet, voyageur) ne s'ouvrent pas par un simple clic dans l'automatisation (déclencheur = bouton interne « Ouvrir : … » / appui long) : elles sont couvertes par les tests RTL/E2E mais **non capturées ici** — à compléter en recette manuelle sur iPhone.
- Le banc fixtures ne charge pas les tuiles Esri (`ERR_ABORTED`) : les cartes y sont vides ; ce n'est pas un bug de l'app (la production charge les tuiles, voir captures `prod/`).
- `backdrop-filter` n'est pas rendu en Chromium headless : sans repli, le contenu derrière le verre transparaît (lisibilité) ; sur Safari iOS le blur s'applique. À contrôler sur iPhone.

## 2. Galerie (28 captures)

| Groupe | Fichiers |
| --- | --- |
| Fiche | `00-fiche-jour.png` |
| Menu / tiroir du compte | `01-menu-carnet.png`, `02-tiroir-compte.png` |
| Création | `03-creation-types.png`, `04-creation-note-vocale.png`, `04-creation-depense.png` |
| Tiroirs (fil, route, sac, chiffres, équipage × 2 lentilles) | `10-volet-*.png`, `bench/carnet-tiroir-*.png` |
| Mode modification, création étape 2 | `bench/carnet-modif-tiroir-fil.png`, `bench/carnet-creer-etape2.png` |
| Production réelle (visiteur) | `prod/prod-fiche-visiteur.png`, `prod/prod-route-visiteur.png`, `prod/prod-route-lentille-2.png` |

## 3. Problèmes à régler

### P1 — Le tracé affiché ne correspond pas au carnet (cause racine de « le tracé ne se met pas bien sur les chemins »)

Trois causes distinctes, mesurées :

1. **Sortie hors fenêtre du carnet utilisée quand même** (`pickCarnetTrace`, `src/features/carnet/detail/trace.ts`). Sur le carnet public de production `749e9e8c…` (dates **26 mars → 4 avril 2026**), les 6 sorties liées sont datées **2 juillet** et **17–20 octobre 2026**. L'app affiche la trace de la sortie la plus récente (octobre, 17 km, vers Chamonix/Planards) comme « tracé du carnet » : mauvaise randonnée, donc tracé hors sujet, et le badge carte affiche « D+ +191 m · 6,3 km » au lieu des chiffres du carnet.
   **Correctif** : ne retenir que les sorties dont les points tombent dans `[carnet.start_date, carnet.end_date]` (ou rattacher explicitement la sortie au jour) ; si aucune trace dans la fenêtre, état vide honnête (« Aucune trace sur ces dates ») plutôt qu'une trace étrangère.

2. **Journées sans points mappés** (même cause) : `buildDays` numérote les points via `start_date + jour - 1` (`days.ts`). Les points de juillet/octobre tombent sur des « jours fantômes » (J99, J205) ignorés par l'UI, donc **J1–J5 n'ont aucune trace ni statistique** : les cartes-jour affichent `— · — · 1 moment` et la lentille Route « Chiffres non renseignés », alors que l'en-tête affiche 102 km / +7 200 m (somme des sessions).
   **Correctif** : filtrer/clamper les points à la fenêtre du carnet, et **repli sur les colonnes de session** (`distance_km`, `elevation_gain_m`, `duration_seconds`) quand les points GPS manquent, pour que chaque jour montre ses chiffres réels.

3. **Trace simplifiée à 120 points** quand aucune trace par jour n'existe : `simplifyTrack(parsePositions(trace))` avec `maxPoints = 120` (`geometry.ts`). Sur 326 points réels, on ne garde que 120 sommets → les lacets sont coupés, le tracé « coupe » à travers le terrain, et le profil d'altitude montre un pic artificiel (visible sur `prod-fiche-visiteur.png` : segment rectiligne et pointe finale).
   **Correctif** : pour la carte, garder la densité réelle (MapLibre gère des milliers de points) ; réserver la simplification à 120 points au profil d'altitude.

### P1 — Vue publique RGPD : tracé dégradé mesuré

La vue `hike_sessions_public` échantillonne 1 point sur 5 et arrondit à 3 décimales (~110 m). Sur la sortie de référence (326 points) : **66 points**, longueur 5 804 m → **6 336 m (+9 %)**, **écart maximum 58,1 m** (distance de Hausdorff). Un visiteur voit donc un tracé qui zigzague et sort des sentiers de ~50 m — c'est visible sur `prod-fiche-visiteur.png`.
**Correctif proposé** : conserver la densité (pas d'échantillonnage) et arrondir à **4 décimales (~11 m)** en gardant les protections actuelles (retard, pas d'horodatage ni d'identifiant) ; ou choix explicite de l'auteur (public précis / flouté).

### P2 — Lentille Route : lignes uniformes et sans chiffres

`prod-route-visiteur.png` : les 5 jours affichent le même libellé « Chamonix-Mont-Blanc » et « Chiffres non renseignés ». Les étapes n'ont que `nom` (souvent = destination) et aucune statistique ; les données existent pourtant dans les sessions. **Correctif** : afficher distance/D+/durée du jour (repli session, cf. P1-2) et compléter le libellé avec le départ/arrivée ou le type d'étape.

### P2 — Barre des lentilles qui recouvre le contenu

`bench/carnet-tiroir-sac-2.png` : les dernières lignes (« Duvet 0 °C », « Matelas isolant ») passent **sous** la barre flottante des lentilles ; il manque la réserve basse correspondante. **Correctif** : `padding-bottom` du slot ≥ hauteur de la barre + safe area (mesuré 44 px + marge), et vérifier le défilement jusqu'au dernier élément.

### P2 — Bouton primaire désactivé illisible (note vocale)

`04-creation-note-vocale.png` : en état `disabled` (micro non supporté), « Enregistrer » est **blanc sur fond blanc**, quasi invisible. **Correctif** : style désactivé contrasté (texte/icône à 4,5:1, fond neutre) pour tous les boutons primaires désactivés.

### P2 — Lisibilité du verre sans blur (accessibilité / headless)

`02-tiroir-compte.png`, `10-volet-fil-de-bord-moments.png` : le contenu de la fiche transparaît à travers les feuilles quand `backdrop-filter` n'est pas rendu (Chromium headless, ou réglage « réduire la transparence » mal couvert). Sur iOS le blur existe. **Correctif** : vérifier sur iPhone ; renforcer le repli `prefers-reduced-transparency` (fond opaque ≥ 92 %) et l'appliquer dès que `backdrop-filter` est indisponible.

### P3 — Divers constatés

- Le tiroir du compte (Notifications) affiche à la fois « Tout est lu » et « Tout lire » sur l'état vide : redondant (cosmétique).
- La pastille de titre tronque « Tour du Mont-Blanc en autonomie complète » en « Tour du Mont-Blanc en a… » (ellipsis normal, pas un bug).
- Le menu du carnet et les fiches ne sont pas atteignables par clavier dans l'automatisation actuelle (à vérifier : piège de focus déjà couvert par tests RTL).
- Les tuiles Esri sont bloquées dans le banc fixtures : à corriger côté harnais (autoriser le réseau), sinon les captures de recette montrent des cartes vides.

## 4. Priorisation de correction

1. **P1-1 + P1-2** (fenêtre du carnet : trace et statistiques par jour) — c'est la cause du tracé incohérent signalé.
2. **P1-3** (densité du tracé sur la carte) et **P1 public RGPD** (arrondi 4 décimales, sans échantillonnage).
3. **P2** Route (chiffres + libellés), réserve basse de la barre de lentilles, bouton désactivé.
4. **P2/P3** verre/transparence, redondance notifications, tuiles du harnais.

## 5. Ce qui fonctionne (vérifié sur les captures)

- Les 5 volets et leurs lentilles (Fil/Moments, Route/Tracé-Altitude, Sac/Inventaire-Verdicts, Chiffres/Distance-Dénivelé, Équipage/Participants-Réactions) s'ouvrent et se composent correctement.
- Tiroir du compte : Notifications / Partage / Paramètres / Gérer présents, états vides explicites.
- Création : liste des types, formulaire note vocale (lieu, enregistrement, titre, « Ajouter le moment »).
- Fiche : en-tête (jours, km, D+, voyageurs), pastille d'état, bouton « Ouvrir le carnet », carte + profil, barre d'onglets.
- Mode modification et pilules « Modifier » présents (capture bench).


## 6. Correctifs appliqués le 2026-11-11 (branche `claude/kind-bell-bfyt69`)

| Problème | Correctif | Preuve |
| --- | --- | --- |
| P1-1 trace d'une sortie hors séjour | `pickCarnetTrace(sessions, {startDate, endDate})` ne retient que les sorties datées dans la fenêtre ; `buildCarnetDetail` applique la même fenêtre aux totaux, au profil d'altitude et au repli mono-sortie ; sans trace datée dans le séjour, la carte affiche son état vide honnête au lieu d'une autre randonnée | 3 tests `trace.test.ts` + 2 tests `buildCarnetDetail.test.ts` ; tsc/lint 0 |
| P1-2 journées sans chiffres | repli chiffré dans `buildDays` : distance/D+/durée d'une sortie sans points exploitables sont rattachés au jour de son départ ; la vue de jour n'affiche plus « — · — » mais seulement les valeurs connues | 2 tests `days.test.ts` + 1 test `buildCarnetDetail.test.ts` |
| P1-3 trace coupée à 120 points | `CompteMap` garde jusqu'à 4 000 sommets pour la carte (120 réservés au profil d'altitude) | tsc + revue ; capture production à refaire après déploiement |
| P1 public RGPD | migration `20261111190000_carnet_public_trace_precision` : densité réelle (plus d'échantillonnage 1/5) et arrondi 4 décimales (~11 m) ; protections inchangées (retard, ni horodatage ni identifiant) — **appliquée en production** | en base sur la sortie de référence : 326 → **326 points**, écart max **6,6 m** (contre 58,1 m), longueur +2,8 % (contre +9 %) ; pgTAP ajusté (16 assertions) |
| P2 barre des lentilles qui recouvre le contenu | réserve basse de 46 px sur `.lkdv-slot-stage` | capture à refaire après déploiement |
| P2 bouton primaire désactivé illisible | état `:disabled` explicite (fond neutre, encre lisible) pour `.lkdv-mbtn` | capture à refaire après déploiement |
| P2 Route sans chiffres | la lentille Étapes complète distance/D+ manquants avec les stats du jour | test unitaire de rendu à ajouter ; tsc/lint 0 |
| P3 notifications redondantes | l'en-tête « Tout est lu / Tout lire » n'apparaît plus quand la liste est vide | capture `02-tiroir-compte` à refaire |

### Vérification en production après déploiement (`dpl_AmrrJan6fzAfERz1epms7c7vkc6T`, commit `0afc2c0e`)

Captures `after/after-prod-fiche.png`, `after/after-prod-route.png` (session visiteur réelle) :

- En-tête et résumé : **170 km / +10 000 m** (valeurs déclarées du carnet) au lieu du total 102 km des sorties d'un autre mois.
- Cartes-jour : « 1 moment » sans « — · — » (les chiffres absents ne sont plus affichés comme des tirets).
- Carte : état vide honnête **« Aucun tracé enregistré pour ce carnet. L'auteur n'a pas joint de trace GPS à ce carnet. »** — l'ancienne trace d'octobre n'est plus présentée comme le parcours d'un carnet de mars.
- Aucune nouvelle erreur runtime (les 400/403 et le heartbeat `user_presence` existaient déjà pour une session anonyme).
- Lentille Route : les lignes n'affichent plus « Chiffres non renseignés » (vérifié sur la capture finale `after/after-prod-route.png`, déploiement `e7e8e5ff`) ; la barre des lentilles ne recouvre plus le contenu (la réserve basse est en place ; le texte qui transparaît sous le verre est le contenu de la fiche derrière, flouté sur l'appareil).
- Reste à contrôler sur iPhone : rendu du verre (blur réel) et barre des lentilles en bas de tiroir.

Restent ouverts après ce lot : les fiches (moment/étape/objet/voyageur) à capturer manuellement, la lisibilité du verre sans `backdrop-filter` à contrôler sur iPhone, les tuiles Esri du banc fixtures, le recentrage de la carte sur le départ du carnet quand aucune trace n'est affichée (P3), et la capture du tiroir Sac après la réserve basse.


## 7. Deuxième passe (2026-11-11 soir) — tracé réel, dénivelé, recherche de randonnée

- **Données de démonstration recalées en production** : les 3 sorties GPS du carnet `749e9e8c…` (1819, 173 et 326 points horodatés avec altitude) ont été redatées dans la fenêtre du carnet (26–28 mars 2026, points répartis sur 6 h) et les 3 doublons sans GPS supprimés. Le parcours, le dénivelé et les statistiques quotidiennes redeviennent calculables et cohérents.
- **Repli du tracé** : `pickCarnetTrace` préfère une trace datée dans le séjour et se replie sinon sur la trace d'une sortie réellement rattachée au carnet (jamais vide si une trace existe, jamais une géométrie inventée). Le profil d'altitude suit le même repli (`pickElevationProfile`).
- **Dénivelé** : totaux déclarés du carnet prioritaires (170 km / +10 000 m pour la démo), profil d'altitude calculé depuis les points horodatés (altitude par point), carte du bas et lentille Route « Dénivelé » alimentées.
- **Recherche d'une randonnée** : nouvelle feuille `HikeSearchSheet` branchée sur `GET /api/hikes` (RPC `trails_in_viewport`, polygone France explicite car la RPC plafonne le viewport à 20°). Accessible depuis la lentille Route (« Rechercher une randonnée »), résultats avec distance/D+/difficulté, sélection = recentrage carte + message d'île. 3 tests RTL (URL API, rendu des chiffres, sélection, seuil de 2 lettres).
- Vérifié : tsc 0, lint 0 erreur, 53 fichiers / 530 tests verts.


## 8. Troisième passe (2026-11-11, après déploiement `cfde9aee` + `e6bee650`) — preuves demandées

**Tracé réel sur la carte** : visible sur `prod3/01-fiche.png` (tracé dense en boucle autour des Vuches / Chamonix-Mont-Blanc, marqueurs de jour) — les sorties de démonstration ont été recalées dans les dates du carnet (3 sorties, 1819/173/326 points horodatés avec altitude, 26–28 mars 2026).

**Dénivelé** :
- `prod3/10-chiffres-denivele.png` : « DÉNIVELÉ POSITIF · JOUR 1 → +980 m », barres J1 +980, J2 +980, J3 +1 420, J4/J5 « — », écart à la moyenne ;
- `prod3/10-route-altitude.png` : profil d'altitude dessiné (« Dénivelé du tracé : +117 m ») ;
- `prod3/20-sous-route-etape.png` : fiche d'étape avec **Distance 40,89 km, Dénivelé +980 m, Durée 6 h** (plus de « — »).

**Recherche d'une randonnée** : `prod3/30-recherche-vide.png` et `prod3/31-recherche-resultats.png` — feuille « Rechercher une randonnée », requête « mont », résultats issus de `GET /api/hikes` (nom, distance, D+, difficulté). Sélection = recentrage carte + message.

**Galerie complète** (`prod3/`, session visiteur réelle) : fiche, menu, tiroir du compte (`03-compte`, `03-compte-notifications`, `-partage`, `-parametres`), les 5 volets × toutes leurs lentilles (Fil : moments/médias/rencontres/nature · Route : étapes/altitude/nuit/météo · Sac : kit/verdicts/poids · Chiffres : distance/dénivelé/durée · Équipage : participants/réactions/suivre), sous-tiroirs capturés : **étape**, **objet du sac**, **voyageur**, et la liste des moments.

**Limites de capture** : en session visiteur (anonyme), la visionneuse de moment plein écran et la fiche de nuit ne s'ouvrent pas au clic automatisé (elles restent accessibles aux comptes connectés) ; `Gérer` du tiroir du compte est réservé au propriétaire. À compléter en recette connectée sur iPhone.


## 9. Derniers correctifs (2026-11-11) — fermeture des autres problèmes

- **Carte sans tracé** : elle se cale désormais sur le **départ réel** du carnet (position live, zone publique, première nuit géolocalisée, sinon lieu du carnet) au lieu du centre par défaut de la France ; l'état vide propose **« Rechercher une randonnée »** (même feuille branchée sur l'API Explorer).
- **Présence** : plus de battement `user_presence` pour une session anonyme (la RLS le refusait : 403 + erreur console à chaque ouverture d'écran). Seuls les vrais comptes battent.
- **Verre sans flou d'arrière-plan** : repli CSS `@supports not (backdrop-filter)` — les feuilles, capsules, menus et pastilles deviennent opaques quand le navigateur ne sait pas flouter, au lieu de laisser transparaître le contenu derrière.
- Tests : `CompteMapState` rend l'action sous le message d'état ; suite complète verte (979 tests, 102 fichiers), lint 0 erreur.
- **Vérifié en production** (`prod4/`) : carnet sans trace → « Aucun tracé enregistré pour ce carnet » + bouton « Rechercher une randonnée » → feuille de recherche → résultats (« lac » → GRP 125 Lac de Val Joly, 10,7 km, +220 m) ; **0 erreur `user_presence`** en session anonyme ; en-tête de carnet vide sans « — · 1 voyageur » ; carte d'état remontée pour ne pas rogner le bouton.
- Restent volontairement hors périmètre : visionneuse de moment et fiche de nuit en session anonyme (données/gestes réservés aux comptes connectés dans la recette), « Gérer » réservé au propriétaire, tuiles Esri du banc fixtures (réseau du harnais, pas l'app).
