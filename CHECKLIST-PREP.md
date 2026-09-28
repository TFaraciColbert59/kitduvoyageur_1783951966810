
# CHECKLIST DE PROOF — Préparateur `/prepare` LKDV

Source : 32 maquettes uniques (41 fichiers, 9 doublons) analysées une à une,
croisées avec l'intégralité des consignes écrites de la conversation.

Légende : `[ ]` à faire · `[~]` partiellement fait · `[x]` fait et vérifié · `[!]` bloqué par une donnée absente du dépôt · `R` rectificatif d'audit

**Structure** — 0 rectificatifs · A→H périmètre fonctionnel · I routage · J décisions
owner · K ordre d'exécution · **L audit visuel par élément (captures réelles)** ·
**M beauté / design system** · **N mouvement & accessibilité** ·
**P preuve : données réelles, moteur, boutons (audit physique 393×852 du 28-09)**.

`M` et `N` proviennent d'un audit du skill **ui-ux-pro-max** (glassmorphism, cibles
tactiles, transitions, contrastes) **et** d'une relecture ligne à ligne de
`src/features/adventure-prep/adventure-prep.css`. Ils sont ancrés sur des faits
vérifiés dans le fichier, pas sur des goûts : chaque point porte son numéro de ligne.

> **Dérive vérifiée le 2026-09-27, pendant que ce checklist s'écrivait.** Le thread
> principal a avancé en parallèle : 15 fichiers modifiés, 9 nouveaux non suivis.
> **8 items de ce document sont passés de « à faire » à « fait » pendant sa rédaction.**
> R1 est devenu faux par dérive : c'est la démonstration que re-vérifier avant de cocher
> n'est pas optionnelle. Tout est **non commité**.

> **Audit physique du 2026-09-28 — trois constats qui résument l'état du travail.**
> 1. ~~**Une ligne de code casse toutes les distances et toutes les durées** (P0.1)~~
>    **RÉPARÉ et VÉRIFIÉ le 2026-09-28.** Le lecteur de géométrie lisait
>    `legs[i].geometry` ; OSRM place le tracé au niveau `routes[0].geometry` (relevé
>    réel : `leg[0].geometry present = False`, `route.geometry present = True`,
>    12 646 points). Le tracé global est désormais **découpé par tronçon** selon la
>    distance routière mesurée de chaque leg (`splitGeometryByLegs`), donc plus de
>    « À vérifier » et plus de tracé dupliqué.
>    **Preuve API :** `GET /api/route?points=2.245,48.894;6.869,45.923` →
>    `HTTP 200`, `distanceKm: 623.3385`, `durationMin: 398.165`, tracé complet.
>    **Preuve test :** 6 tests rouge avant correctif, `routing-service.test.ts`
>    15/15 vert après, dont OSRM-GEO-01→06 (continuité et reconstruction du tracé).
>    La fixture de test a été **corrigée** : elle plaçait la géométrie sur la route ET
>    sur le leg, ce qu'OSRM ne produit jamais — elle testait un cas imaginaire.
>    Reste à valider à l'écran (P2.13).
> 2. **La météo est réelle mais orpheline** (P0.2) : la route API est écrite, testée et
>    fonctionne ; aucun code ne l'appelle. Ce n'est pas du mock, c'est du mort.
> 3. **L'IA n'est pas bridée** (P0.4) : elle propose une régate et une plongée depuis la
>    banlieue parisienne avec deux enfants. Ce n'est pas du mock non plus — c'est une
>    absence de contrôle.
>
> Autrement dit : **le problème n'est pas la quantité de données, c'est le raccordement.**
> La base, les fournisseurs et la persistance sont solids ; le maillon qui manque est le
> fil entre eux. C'est ce que la section P documente, ligne par ligne, avec sa preuve.
## Journal de progression — mis à jour à chaque lot

**Comptage honnete au 2026-09-28, recompté par `grep` sur les cases (38 faits · 8 partiels · 177 restants = 223 items) :** 4 **dements** (P0.10, P0.14, P0.20, et la course `Promise.race` de P0.24 retirée après mesure). **LE LOT DU JOUR : P1.9 est LEVE et coché** — un fournisseur pieton reellement joignable a ete trouve *a la mesure* (`routing.openstreetmap.de`, `200` / 132 ms, OSRM a profil `routed-foot`), les 3 modes repondent sur les memes points (pieton 7,384 km / 98,5 min · velo 7,139 km / 29,8 min · voiture 8,030 km / 9,1 min), et les sommets sont refuses **par la mesure** (`503 off_network`). 14 tests `P019-01`→`P019-14` verts, suite **603 fichiers / 5 628 tests / 0 echec**, `tsc` **exit 0**. **P0.23 est desormais FERME** : la cause s etait deplacee vers l amont, et c est la que le correctif a ete fait. La generation lance enfin (le depart s auto-remplit par la geolocalisation, le CTA « Creer mon parcours » est actif — ce qui n etait jamais arrive), et les **20 appels `/api/route` rendaient alors `503 off_network`** : les points routes etaient des **coordonnees de grille** (`6.9,45.91`, `6.9012,45.9123`) et le **sommet du Mont Blanc** — pas des lieux. **Corrige depuis** : le generateur produit des lieux reels, et la meme generation rend aujourd hui **23 × `200`** et **0** `off_network` (preuve 9 ci-dessous). `/api/amenities` rend, lui, **9 lieux reellement nommes** a coordonnees 7 decimales (Hotel Lyret, Hotel Mont Blanc, Restaurant Le Panoramic…), **mais en 45,3 s**. Le filtre de marchabilite, lui, **fonctionne** : il refuse une mesure qui n existe pas. **Deux defauts nouveaux mesures, a traiter :** `/api/geocode` **inverse** hors service (`503 providers_unreachable`) alors que le **direct** repond `200` et nomme Chamonix-Mont-Blanc ; et la **saisie libre vide le catalogue** d activites, alors que la consigne demandait de garder les entrees en dessous. **P0.24** reste en **partiel** sur son seul delai de 45 s, mesure a 45,3 s.
Un item ne passe à `[x]` que sur une preuve datée — capture regardée, clic réel,
valeur tracée à sa source, ou test rouge → vert. Jamais sur la foi du code.

| Lot | Item | Verdict | Preuve |
|---|---|---|---|
| C1 | double croix dans la recherche de lieu | ✅ fait | `proof/lot3-08` — une seule croix ; test DPL-27 |
| — | geo refusé traité en faute (rouge) | ✅ fait | `proof/lot3-06` — note neutre ; tests DPL-24/25/26 |
| — | parcours sans activité du catalogue | ✅ fait | parcours complet généré, 30,4 km / 6 h 07 |
| **P0.9** | **tiroir = verre, pas une dalle** | ✅ **fait** | `proof/P09-02`, `proof/P09-03` ; contraste pixels 6,59:1 |
| **P0.10** | **actions du tiroir sous le pli** | ✅ **fait** | `proof/P010-01`, `proof/P010-02` — 815→859 → 764→808 |
| **P0.10** | **barre de jours vs « Vers le départ »** | ✅ **démenti** | parcours 3 j éréel : 331-379 vs CTA 675-727 |
| **P0.11** | **titre étape 2 : deux titres dans une pastille** | ✅ **fait** | `proof/P011-01` à `P011-05` ; 5 tests DPL-28 |
| — | barre d'outils de l'étape 2 flottant sur la description | ✅ fait | `proof/P011-03` — régression de `04b94bde` |
| — | pied de fiche « Fermer » jamais collé (`.prep-footer`) | ✅ fait | `proof/P011-05` — mesuré `position: sticky` |
| A5 | sélecteur de jours sur les 3 pages | ⚠ **fait sur les étapes 2 et 3** | `proof/A5-01`, `A5-02` — reste l’étape 1 |
| P0.2 | météo : le service est enfin appelé et affiché | ✅ **fait** | `proof/A5-02` — « Pluie 5°/7° · 70 % de pluie » |
| A3 | fil d’étapes, seul élément de la barre haute | ⚠ à faire | — |
| **D1** | **CTA au strict nécessaire** | ⚠ **fermé, sauf le départ** | Le seul obstacle restant est `origin`, parce que le générateur rend une proposition **vide** sans lui — un CTA actif y serait un bouton mort. Mesuré : départ Chamonix + 200 `/api/geocode`, `ctaDisabled` **`true`→`false`**, `« Il manque : temps disponible »` → `« L’IA complètera : lieu d’arrivée, date, temps disponible »`. `proof/D1-12-live-cta.png` (regardée) |
| D2 | rail de familles déborde, « Neige » coupée | ⚠ à faire | `proof/A-01` |
| **P0.5** | **brouillon périmé resservi en silence** | ✅ **fait** | P05-01→03 regardées ; **21/21** tests, **5504/5504** verts, 	sc 0 |
| **P0.14** | **pastille de suggestion : échelle + portée** | ✅ **fermé par la mesure** | 17 px → **12 px** ; 145×77 → **145×40** ; `align-self: flex-start`, dans sa cellule, aucun débordement. `proof/P014-04-badge-apres.png` (regardée) ; cause racine = P0.17 |
| **P0.15** | **l’IA ne peut pas choisir la date, et la date bloque** | ✅ **fermé** | 24 tests P015 verts ; **preuve réseau** : Server Action `/prepare` → `"failure":null,"suggestedStartDate":"2026-10-10"` |
| **P0.13** | **la date choisî par l’IA n’est pas badgée** | ✅ **fermé par P0.15** | `startDateIsSuggested` existe dans `types.ts:160`, le contrat `commit/route.ts:81` et la pastille de cellule ; le carottage a été fermé, pas contourné |
| **P0.16** | **météo en échec quand la date vient de l’IA** | ✅ **fermé** | bug trouvé en pilotant, **pas** en relisant ; `weather-ai-date-p016` rouge→vert ; le bandeau d’échec météo a disparu de `proof/P015-10` |
| **P0.17** | **24 jetons CSS utilisés, aucun défini — dans tout le site** | ✅ **fermé** | `var(--f-*)` non résolu → héritage silencieux ; recâblage sur `--lkv-text-*` + `--font-serif` ; **6 tests** ; **5538/5538** verts (602 fichiers) |
| **P0.18** | **le brief nommait 2 jours, l’écran affichait 1 jour** | ✅ **fermé** | catalogue contredisait l’IA avant la génération ; `setActivities` donne la priorité au brief · `proof/P018-03` (2 jours à l’écran), `proof/P018-05` (J1/J2 réels) · test `P0.18-F` **rouge→vert** · **5569/5569** verts (604 fichiers), tsc 0 |
| **P0.20** | **« le pied recouvre le contenu »** | ⚠️ **démenti + correctif réel** | `bodyBottom === footerTop === 528` : **rien ne se superpose**. En revanche la langue AN9 (20 px) recouvrait **97 % des 20.6 px encore visibles** et son `blur(6px)` les rendait illisibles · masque ajouté · A/B `P020-32` / `P020-33` · **5574/5574** verts (605 fichiers), tsc 0 |
| **P0.22** | **toutes les durées et distances de l’étape 2 étaient des valeurs voiture** | ⚠️ **corrigé, preuve écran restante** | 7 appels réels `/api/route` : **92,3 min** piéton vs **9,8 min** voiture sur les **mêmes** points · garde-fou 500 m (refuge du Goûter à 4 321 m → `503`) · **5588/5588** verts, tsc 0 |
| **P0.23** | **la distance reelle ne s affiche pas a l ecran** | ✅ **ferme — preuve ecran faite** | Clic réel étape 1 → étape 3 : **92,5 km** / **10 407 m** / **3 jours** à l’écran · `geocode` **1×200** · `route` **23×200** · `elevation` **3×200** · **0** `off_network` (contre 20) · CTA « Enregistrer mon aventure » lisible · capture `proof/D3-36-fin-generation.png` |

| **P0.24** | **`/api/amenities` renvoyait 0 lieu : Overpass injoignable** | ⚠️ **repli livré, délai restant** | repli **Photon** (déjà dépendance du projet, sans clé) : `200` → **7 lieux réels**, 2 repas + 5 hôtels nommés à Chamonix / Les Houches, contre **0** avant · 9 tests AM-20→30 **rouge→vert**, **30/30** verts, tsc 0 · reste le délai de ~50 s |
| **P0.25** | **le filtre de marchabilite echouait OUVERT : un lieu non mesure recevait une position, et chaque sonde payait 8 s** | ✅ **ferme** | `WalkReachability` a 3 etats * `keepMeasuredFrom` (ferme) sur `searchPlacesNear`, `keepWalkableFrom` (ouvert) sur l inventaire * panne memorisee 30 s * **5 tests P025-01->05, 23/23 verts** * suite **602 fichiers / 5 614 tests / 0 echec** * `tsc` **exit 0**. **La panne de fournisseur qu il suivait est desormais **LEVE par P1.9** (voir P1.9) |
| **P1.10** | **les lieux de montagne étaient hors de tout graphe routier ou piéton** | ✅ **fermé** | **BRouter `trekking` en dernier recours du seul mode `pieton`** — `/api/route` Chamonix→Grands Mulets = **200**, **14,424 km / 323,05 min / D+ 2 100 m / 881 points**, contre `503 off_network` avant. Le **dénivelé positif réel** arrive enfin à l écran. Négatifs prouvés : `voiture` vers le refuge = `503`. **Fausse piste démontée** : Valhalla écrit *« You have arrived »* alors que sa polyline s arrête à **2 875 m** du but — seul le décompte de la géométrie dit vrai. **10 tests**, suite **1 644 / 0 échec**, tsc 0 |

| **D1** | **« Créer mon parcours » mort avec deux lieux réels et rien d’autre** | ✅ **fermé** | Mesuré en 393×852 : Chamonix (géoloc, `/api/geocode` **200**) + aucun autre choix, et le CTA restait `disabled` sur `« Il manque : temps disponible »`. Cause : `BLOCKING` portait `duration` alors que toute la chaîne de choix existe déjà (P0.15 date · P0.18 durée). **8 tests D1-01→08**, dont **7 rouges** avant correctif ; **607 fichiers / 5 675 tests / 0 échec**, tsc 0 |
| — | **deux tests qui ne prouvaient rien, pour la même raison** | ✅ **démontés** | `D10-15` affirmait « le bouton reste bloqué » en cherchant le **mot** `disabled` dans tout le markup : il matchait la classe Tailwind `disabled:pointer-events-none`, donc il passait avec un CTA **actif**. Même piège déjà-correct une fois en `E02-18`. Les deux lisent désormais l’**attribut**, classes retirées, et `D10-15` vérifie en plus le **contraire** — sans quoi il repasserait avec un gate mort |
| — | le prompt annonçait « 1 jour » comme un fait, deux fois | ✅ **fermé** | Ni la personne ni le brief n’ayant de durée, le prompt portait `Duree : 1 jour(s)` **et** `Ce voyage dure 1 jour` — le `durationDays ?? 1` de `aiItinerary` —
puis `« choisis »` une fois. Le modèle couvrait un jour, en proposait trois, et sa proposition partait refusée pour `journee_non_couverte`. Test **D1-06** : le prompt ne contient plus aucun jour annoncé |

**En cours :** **P0.26 et P0.27 sont FERMÉS — et P0.26 m a changé deux de mes diagnostics.** (a) La **génération 2 jours est réelle** : le tiroir de durée est un stepper (pas un `input[type=number]` — le vieux script le cherchait, d’où son « champ absent »), la cellule s’appelle **« Temps disponible »**, et l’écran final porte **Jour 1 ET Jour 2** avec **44,9 + 22,7 = 67,6 km** et **14 h 48 + 2 h 43 = 17 h 30** — les deux arithmétiques concordent, `journee_non_couverte : false`, `route` 22 × 200, **0** `off_network`. La **météo est réelle et par jour** (`/api/weather` 2 × 200), l’hier hors fenêtre elle était absente : elle est là parce que la source répond, pas parce qu’on l’a remplacée par du plausible. (b) Le CTA n’a jamais été cassé : `canCreateStepOne` exige `route.origin`, donc sans départ il est **désactivé — et c’est correct**, l’IA ne peut pas inventer où l’on est. (c) Ce qui semblait un **chevauchement** du CTA n’en était pas un : mesure, `.prep-body` bottom **667** = `.prep-footer` top **667**. C’était la coupe d `overflow-y` **au milieu des glyphes**, que la langue de verre ne pouvait pas réparer — corrigé par un fondu de dissolution (`--prep-scroll-fade-h: 32px`) avec réserve basse reportée à `--space-6 + --prep-scroll-fade-h`.
**Prochaine priorité immédiate :** (1) la **duree d’activité estimée par journée** demandée à la place de la durée globale ; (2) le **budget réel** (partiel : « 75 € connus · 2 étapes à vérifier ») ; (3) ~~le **titre** « boucle du Mont-Blanc »~~ **RÉSOLU le 2026-09-29 (A9)** — le parcours reboucle désormais pour de vrai (retour ancré sur l'origine, distance finale → 0,000 km) ; reste **Z-D18-03**, régression préexistante hors périmètre, consignée ; (4) **expliquer à l’écran** pourquoi le CTA est refusé.
**Fermés le 2026-09-28 :** P0.18 (durée du brief respectée — le catalogue ne contredit plus l’IA), P0.15 (canal date de l’IA, de bout en bout), P0.13 (par ricochet — le badge existe enfin et porte sur la bonne cellule), P0.16 (météo échouée quand la date venait de l’IA).

**Fait le 2026-09-28 (P0.10 reste, A5, P0.2) :** parcours de 3 JOURS généré
pour de vrai — 68,5 km · 7 290 m · 6 h 57 min. Les distances par jour sont
réelles et **sommement exactement au total** : 33,6 + 34,6 + 0,3 = 68,5.
- **P0.10 (reste) : DÉMENTI, pas un défaut.** Mesure 393×852, 3 jours :
  `.prep-days` 331–379 en `position: static`, corps 60–667, CTA 675–727.
  Aucun recouvrement. La barre du bas (`DayPlateau`, boutons 44 px dans une
  barre de 40 px) est un **effet assumé** : `overflowY: hidden` + masque de
  fondu à droite, le texte, lui, n’est pas coupé. `proof/P010-03`.
- **A5 : fait sur les étapes 2 ET 3.** Un clic sur « J3 » dans la barre du bas
  bascule le rail du haut, les métriques (0,3 km · 346 m · 1 h 30) et le
  programme. La sélection **survit au changement d’étape**. Reste l’étape 1.
- **P0.2 (météo) : RÉPARÉ.** Elle s’affiche bien sur les trois étapes, avec la
  météo de CHAQUE jour, pas celle d’un autre. `proof/A5-02`.

**Fait le 2026-09-28 (P0.11) :** la génération réelle tourne de bout en bout —
Argentière → 56,3 km · 4 304 m de dénivelé · 2 h 39 min · météo réelle
« Partiellement nuageux 9°/22° · 10 % de pluie » · 4 étapes (Argentière,
Plan de l'Aiguille, Lac Blanc, Charpoua). **P0.2 (météo orpheline) est donc
re-vivifié : le service est appelé et affiché.** Reste à le cocher en section P.

**Vu de l’ecran, pas du code :** la barre `prep-body` défile bien sous le pied de page
(24 px de garde au fond, mesuré) — la liste des activités de l’étape 1 n’est **pas**
coupée. Le découpage net de la capture A-02 était un artefact de position, pas un défaut.


### AN1 / A3 — FERMÉS le 2026-09-28, mesurés puis corrigés sur 393×852

**Le bandeau ne gagne aucun bouton chromé.** Ni flèche, ni croix, ni filtres, ni
icône : c’est la demande, et `prep-crumb` / `prep-nav` la vérifient sur le HTML
rendu. Mais **une étape atteinte, elle, répond au doigt** — même police, même
couleur, même trait de soulignement, mêmes métriques. La différence est
invisible à l’œil et sensible au doigt.

**Ce que le rail rend, et comment.** Un segment joignable est un
`<button type="button">` de classe `prep-crumb__link` : aucun fond, aucune
bordure, aucun padding — donc aucun chrome. Sa zone de toucher de 44 px est
étendue par un `::after` **absolu**, centré sur le libellé, qui ne participe
pas au layout. `PrepNavActions` ne duplique plus les « Revenir à <étape> »
qu’il portait en double, clippés dans un conteneur `prep-visually-hidden`
mesuré à 1×1 px.

#### Mesure d’avant — `proof/AN1-01-avant-etape3.png` (regardée)

Parcours réel généré (Chamonix → refuge du Gouter), étape 3, 393×852.

- Le rail rend **3 × `<span>`** de **24 px** de haut, `clientW: 359 / scrollW: 359`.
- Le seul retour disponible était porté par « Revenir à Créations » (156×24) et
  « Revenir à Préparation » (172×24), dans un conteneur `.prep-visually-hidden`
  mesuré à **1×1 px**, `clip-path: inset(50%)` — **hors de portée du doigt**.
- **Conséquence mesurée :** depuis l’étape 3, on ne pouvait revenir ni à l’étape 1
  ni à l’étape 2 sans recharger l’URL.

#### Mesure d’après — `proof/AN1-05/06/07` (les trois regardées)

| Ce qui est mesuré | Étape 3 | Étape 2 |
|---|---|---|
| « Créations » | `BUTTON` 79×30, zone 44 px | `BUTTON` 79×30, zone 44 px |
| « Préparation » | `BUTTON` 95×30, zone 44 px | `SPAN` actif, 24 px |
| « En avant ! » | `SPAN` actif, 24 px | **`BUTTON` 95→, zone 44 px** |
| Bandeau haut | `top: 8 → bottom: 60` (52 px) | `top: 8 → bottom: 60` |
| Icônes / flèches / croix | **0** | **0** |

Parcours **aller-retour touché**, pas simulé : tap sur « Préparation » en
`(205, 34)` → l’étape courante devient « Préparation » ; « En avant ! » redevient
alors un bouton en `(294, 34)` ; tap → **retour à l’étape 3**, récapitulatif
complet affiché (Équipement, Eau et repas, « Enregistrer mon aventure »).

#### Le vrai défaut, trouvé en route par la preuve

La première version rendait le rail cliquable, mais **l’illusion d’affordance
tenait encore** : `proof/AN1-06` montrait « En avant ! » **vert et souligné
depuis l’étape 2** — donc lu comme un lien — alors qu’un tap ne faisait rien.

Cause, lue dans le code : la **peinture** et le **comportement** lisaient deux
prédicats différents.

- `state` (la couleur, le trait) venait de `canOpenStep` ;
- `reachable` (le `onClick`) venait de `isStepSatisfied`.

Or `isStepSatisfied(draft, 'departure')` renvoie `false` **en permanence** —
le récapitulatif de l’étape 3 ne possède aucune réponse propre, il est *dérivé*
de l’itinéraire (`engine/steps.ts`, dernière branche : `return false`). Les deux
prédicats divergeaient donc exactement sur l’étape 3.

**Correctif : une seule predicate pour la peinture et pour le clic.**
`hasStepContent(draft, id)` — pour `departure`, « l’itinéraire existe ». Le
mensonge devient impossible *par construction*, et l’invariant est désormais
testé (AN1-13 : tout segment peint `done` est un `<button>`).

#### Tests

- `__tests__/step-rail-nav-an1.test.tsx` — **17 tests** (13 + AN1-12, AN1-13,
  AN1-13b). Écrits **rouges d’abord** : 6 échecs à la création, dont
  `AN1-12` qui prouvait le défaut ci-dessus.
- `__tests__/steps.test.ts` — **3 tests** `hasStepContent`, dont
  « un contenu disponible est toujours une étape que le moteur ouvre ».
- `__tests__/prep-crumb.test.tsx` — **CR-04 réécrit** : le fixture précédent
  décrivait un état *impossible* (une étape 3 « atteinte » sans itinéraire), donc
  il testait une peinture qui ne peut pas se produire. **CR-04b** ajouté.
- `__tests__/prep-nav.test.ts` — NA-09 (aucun bouton de chrome) et NA-16
  (l’appelant ne reçoit plus que le rail) réécrits.

#### Suite

`npx tsc --noEmit` → **exit 0**. `npx vitest run src/features/adventure-prep` →
**1433 / 1433 verts (93 fichiers)**.

**Régression attrapée au passage, et non masquée :** `prettier --write` avait
lowercasé les hex du CSS, et D9-05 / D9-08 comparent des chaînes — ils
passaient au rouge sur `#7FC49A` vs `#7fc49a`. La casse d’un hexadécimal est
sans effet en CSS : c’est le **test** qui était faux, pas le CSS. Il compare
désormais la casse (helper `hex`).

#### A3 — fermé par la même preuve

`proof/AN1-05/06/07` (regardées) : la barre haute ne contient **que** le rail,
52 px. Les deux actions hors-étape — retour au hub, préférences du trajet —
subsistent pour le lecteur d’écran (AN1-11) mais ne sont plus dans le flux
visuel.

#### Limite honnête, non masquée

La zone de toucher de 44 px est un `::after` **absolu** : elle déborde donc
verticalement du rail de quelques pixels (segment 30 px dans un bandeau de 52 px,
dont le centre est à 34 px du bord). Sans fond ni contour, donc invisible, et
sans consequence au toucher — mais un audit WCAG 2.5.8 mesurerait ce débord. À
garder en tête si le rail gagne un jour une hauteur plus petite.


### AN6 / AN7 — FERMÉS le 2026-09-28, mesures puis corrigés sur 393×852

Ces deux items étaient **un seul défaut lu deux fois** : l’écran ne savait pas
distinguer ce qui arrête l’utilisateur de ce que l’IA tranche. Une conséquence
en face visible (une durée proposée cachée derrière « À vérifier » alors que
c’est un vrai nombre), une autre en cascade (l’écran ne peut pas devenir actif
puisqu’il Announces encore un manque).

**Corrections.** `stepOneProfile.ts` sépare la mesure en deux :
`stepOneMissing(draft, id)` rend `{ blocking, optional }`, et `canCreateStepOne`
vérifie `blocking.length === 0` — le CTA actif n’annonce donc plus jamais un
manque. `stepOneReadySummary` rend « L’IA complètera : … » quand plus rien ne
bloque, et `null` dès qu’un bloqueur existe : on ne promet jamais un complément
alors qu’il reste une saisie à faire. `stepOneMissingSummary` est conservé tel
quel — la mesure complète reste disponible ; c’est l’affichage qui a changé, pas
la règle.

Côté **AN6** : `valueFor` n’a plus de branche `durationIsSuggested`, le nombre
s’affiche. La provenance ne se perd pas : nouveau `data-suggested` sur la cellule,
et la pastille passe de « Durée à préciser » à **« Proposé par l’IA · modifiable »**.
Une date non choisie reste, elle, une vraie absence affichée « À vérifier » : on
ne fait pas dire à une date saisie par le moteur qu’elle a été mesurée.

**Preuves, regardées une par une** (393×852, `deviceScaleFactor` 2) :

- `proof/AN67-07-an7-cta-actif.png` — départ Chamonix + 3 j, ni arrivée ni date.
  CTA **actif**, « **L’IA complètera : lieu d’arrivée, date** », et **aucune**
  occurrence de « Il manque ». Note mesurée visible : `top 603 / bottom 638` dans
  un viewport de 852 — elle est à l’écran, pas dans le DOM hors champ.
- `proof/AN67-08-an7-bloquant.png` — même draft sans départ. CTA **bloqué**,
  « Il manque : lieu de départ » et rien d’autre ; la suggestion
  « L’IA complètera » est absente, comme promis.
- `proof/AN67-09-an6-duree-proposee.png` — durée proposée : « Temps disponible »
  = **3 jours**, pastille **« Proposé par l’IA · modifiable »**, markup
  `data-unknown="false" data-suggested="true"`.

> **Une capture reprise, et pourquoi.** La première prise (`AN67-07` v1)
> montrait un état correct en JSON et **rien à l’écran** : le bandeau cookies
> n’avait pas été accepté et le corps n’était pas descendu. Une mesure qui ne se
> voit pas n’est pas une preuve — les captures reprennent au clic réel sur
> « Tout accepter », note mesurée dans le viewport.

**Tests — 10 nouveaux, 4 réécrits.** `__tests__/step-one-missing-an7.test.ts`,
10 tests AN6/AN7, écrits **rouges d’abord** (7 échecs / 3 verts) puis verts. Un des
dix était lui-même faux : son draft ne manquait pas des champs optionnels, il en
manquait un de bloquant — corrigé dans le test, pas dans le code. Réécrits aussi :
`S11-26`, `D10-14`, `D10-20`, `D10-20c`, `DEST-04` — ils verrouillaient
précisément les deux défauts. **Changement de contrat volontaire**, commenté dans
chaque test, et chaque assertion réécrite a un remplaçant qui **interdit** le
retour en arrière (`not.toContain`), pas seulement un constant à maquiller.

**Suite :** `vitest run` complet — **5435 tests verts**, 1 échec déjà connu et
préexistant (`tests/design/lot2-shell.spec.ts`, offsets d’AppShell, revérifié sur
`HEAD`, fichier non touché par ce lot). `tsc --noEmit` propre, `prettier` passé.

**Ce que AN6/AN7 n’est pas.** La visibilité de la pastille « L’IA complètera »
reste un peu faible sur photo : le verre du bloc se fond dans l’image de fond.
C’est un point de **design** (section M), pas un défaut de logique.

### AN2 — FERMÉ le 2026-09-28, prouvé sur un parcours régénéré

**Cause racine, ligne à ligne.** `applyActivityDurations` (`engine/routing.ts`)
exige que **chaque** étape du jour porte un `durationMin`. Or `applyRouting`
n’écrit une durée que sur les étapes qui portent une activité ; il écrit
`durationMin: 0` pour les étapes de trajet — un **zéro prouvé** par le chainon,
pas une valeur inventée. `routeItinerary` ne remplit cet ensemble **que si la
journée est effectivement routée** (`chain.length === 1 && allLocated && …`).

- `perDay[0].activityMin = 12`, `perDay[1].activityMin = 13`, `totals.activityMin = 25`.
- 1ʳᵉ étape de chaque jour : `ia-d1-trajet-0` et `ia-d2-trajet-3` portent `durationMin: 0`.
- `distanceKm = 20,83` au total (10,30 + 10,53), `elevGainM = 2572`.
- À l’écran : **« Durée 25 min »** et « Dénivelé 2 572 m » — `proof/N2-01-duree-reelle-ecran3.png`.
- Pendant le run, l’honnêteté tient : `status: en_cours` et **0 phase cochée**
  (relevé à t+4 s) ; les 7 ne passent `done: true` qu’à la fin.

**Note de lecture, pas un défaut.** `movingMin` vient du profil **routier** OSRM
`driving` (décision I1) : ce n’est pas un temps de marche. Valhalla public a été
essayé pour le piéton et renvoie des valeurs aberrantes (35 h pour 11 km) —
**non intégré**.

### AN3 — FERMÉ le 2026-09-28, sur le même parcours

**Cause racine.** `dayBudget` (`engine/places.ts`) faisait une `reduce` sur les prix
et renvoyait `null` dès qu’**une seule** étape du jour avait un prix. Le jour
mixed (un refuge connu, une activité gratuite) se retrouvait donc affiché
« À vérifier » alors que la donnée était là.

- Jour 1 : **« 75 € connus »**, puis sur la ligne du dessous **« 1 étape à vérifier »**.
  Le 75 € est le prix du refuge, lu en base — pas un estimé.
  `proof/N3-03-budget-note-ligne-dediee.png`. Rien n’est maquillé en total.
- Jour 2 : **« À vérifier »**, aucun prix connu — le cas honnête, distinct du premier.
- Avant le correctif, le même jour 1 affichait déjà « À vérifier » —
  `proof/N3-01-budget-partiel-honnete.png`.

**Suite :** **5397 tests verts / 1 échec** — `tests/design/lot2-shell.spec.ts`,
échec préexistant.

### AN4 — FERMÉ le 2026-09-28, régénération IA complète du 28-09

**Cause racine, mesurée et non supposée.** Dans le `localStorage` avant correctif :
`draft.activities.primary = null` et `startDate = null`. Le titre était donc
**obligatoire** et non optionnel : chaque appelant devait être explicite. Le repli
par règles renvoie `title: null` — il n’invente rien.

**TDD respecté.** 9 tests rouges écrits d’abord.

- `proof/N4-05-avenir-generee.png` — titre **« Weekend refuge Chamonix »** (produit
  par le modèle, pas écrit en dur), sous-titre **« Randonnée avec nuit de refuge ·
  1 jour »**. Aucun « À vérifier ».
- `proof/N4-00-avant-regeneration.png` — le cas **sans titre** (itinéraire antérieur
  au correctif) affiche « Ton aventure » + « 2 jours ». C’est le repli honnête : pas
  d’invention, et la durée connue est affichée.
- `proof/N4-02` / `N4-03` — le tiroir Lieu, sa note géo neutre et sa vraie carte.
- `proof/N4-04-preparation-Completee.png` — l’étape 2 complète, CTA actif.

**Suite :** **5410 tests verts / 1 échec** — `tests/design/lot2-shell.spec.ts`,
échec préexistant revérifié sur `HEAD`.

### AN5 — FERMÉ le 2026-09-28, sur le même parcours généré

**Cause racine.** `MiniMap` (dans `PrepSetupSheets.tsx`) rendait sous la carte une
ligne unique — `{formatCoord(lat)} · {formatCoord(lon)}` — dès que le marqueur
existait, **sans jamais regarder le nom du lieu**. Le nom était pourtant là :
`shown` porte le `PlaceRef` retenu, et le `label` de la carte elle-même l’affichait
déjà. Choisir « Chamonix-Mont-Blanc » laissait donc lire
« 45.92375° N · 6.86933° E » : des nombres à la place du nom choisi, donc plus rien
pour vérifier d’un coup d’œil ce qu’on avait retenu.

**Ce qui n’était pas en cause.** La cause initially retenue était « `reverse-geocode`
non branché » : **c’est faux, et la vérification le dément.** `reverseGeocodePlace()`
(`geocodeService.ts`) est implémenté, `myPosition.ts` construit l’URL inverse, et la
route `/api/geocode?lat&lon` traite déjà le cas. Le service n’était simplement pas
appelé à cet endroit — le défaut était **purement un rendu**, pas une donneée absente.
Une correction à base de reverse-geocodage aurait été du travail inutile : le nom
était déjà là.

**Correctif.** Nouvelle fonction pure `pickerPlaceCaption(place, marker, interactive,
typedName)` exportée et testée à part, qui renvoie `{ label, detail }` :
- le **nom en tête** dès qu’il existe (avec le pays s’il est connu) ;
- la **position exacte en second**, plus petite et plus discrete — elle ne disparaît
  pas, elle cesse d’etre le titre ;
- **rien n’est inventé** : un point sans nom garde la coordonnée comme unique fait,
  ce qui est exactement ce qu’on sait de lui. Un nom fait d’espaces n’est pas un nom.

Une classe CSS dédiée `.prep-picker__caption` remplace le `<p class="note neutral">` :
`.t1`/`.t2` coupent en ellipsis (`white-space: nowrap`), ce qui aurait tronqué
« Chamonix-Mont-Blanc · France ». Ici le nom se passe à la ligne.

**Preuve navigateur (28-09, 393×852, parcours réel généré).**
`proof/N5-03-tiroir-avec-nom.png` (capture **regardée**) : après sélection, la
légende lue est `label = « Chamonix-Mont-Blanc · France »` et
`detail = « 45.92375° N · 6.86933° E »`. Mesuré : bloc `x:20 y:697.8 w:353 h:46.2`,
donc **46 px de haut, non tronqué**. `proof/N5-01` (tiroir à l’ouverture) et
`proof/N5-02` (résultats) — repli non régressé.

**Tests.** 8 tests AN5 écrits **rouges d’abord** (`picker-caption-an5.test.ts`) :
les 8 echouaient sur `pickerPlaceCaption is not a function`, puis 8/8 verts après
correctif. Régression : `prep-drawers-liquid` + `jour-focus-carte` = **75/75**.
`tsc --noEmit` **propre**.

**Suite.** AN8 puis AN9, liés à la réserve `--nav-offset` / `.prep-footer`.


### AN8 — DÉMENTI le 2026-09-28, mesuré sur 393×852

**Le constat était faux.** « Le bandeau de consentement cookies recouvre la bottom
bar » ne tient pas à la mesure. Relevé sur le même parcours réel (le bandeau
était bien visible : `localStorage.removeItem("lkdv_cookie_consent")` avant le
rechargement) :

- `nav[aria-label="Navigation principale"]` : `top: 599`, `bottom: 661` (h 62), `position: fixed`, `z-index: 40` ;
- panneau du bandeau : `top: 661`, `bottom: 776` (h 115) ;
- **chevauchement = 0 px.** Le panneau commence exactement là où la barre finit.

**La chaîne est correcte de bout en bout, et c’est mesurable :**

- `marginBottom` du panneau = **68px** = `--nav-offset (60px) + --space-2 (8px)` ;
- `--cookie-banner-h: 191px` — publie par le `useLayoutEffect`, et 191 = `852 - 661`, donc la
  **bande totale** (barre comprise), pas seulement la hauteur du panneau ;
- `--page-bottom-inset` se calcule sur `max(--nav-offset, --cookie-banner-h) + --space-4`,
  donc `max(60px, 191px) + 16px` : le contenu se libère bien au-dessus du bandeau.

**Preuve.** `proof/N8-01-mesure-bandeau.png` (capture **regardée**) : la barre
Hub/Communauté/Explorer/Messages/Compte est **entièrement visible et dégagée**, le
bandeau passe dessous. Aucun correctif à faire — en ajouter un aurait
dégradé un mécanisme qui fonctionne.

**Ce que la meme capture revele.** Le défaut **AN9** est lui bien réel et visible sur
la même image : le badge « Durée à préciser · modifiable » est **coupé en deux**
par le CTA « Créer mon parcours ». C’est le prochain lot.


### AN9 — FERMÉ le 2026-09-28, mesuré puis corrigé sur 393×852

**La cause notée au tableau était fausse.** Elle disait « pas de réserve entre le
dernier bloc et `.prep-footer` ». La réserve **existe** :
`padding-bottom: var(--space-6)` = 24 px sur le corps scrollable. Mesurée après
scroll en bas : **23,7 px** de réserve, badge entièrement lisible. Ajouter de la
réserve aurait créé un trou — il n’y avait rien à combler.

**La vraie cause.** `.prep-footer` est opaque et ne montrait **aucun signe de
continuation**. Un bloc intact qui traverse la ligne de coupe paraît _cassé_ : le
lecteur y voit un bug de rendu, pas du contenu qui continue.

- `proof/N9-01-au-repos.png` (**regardée**) — au repos, la pastille se dissout sous
  le verre au lieu d’être coupée nette : le signe de continuation est là.
- `proof/N9-02-scroll-bas.png` (**regardée**) — en bas de course, « Durée à préciser ·
  modifiable » est **entière et nette**, et le dernier bloc (« Il manque : … ») est
  intact au-dessus du verre.
- `proof/N9-04-etape2-haut.png` et `N9-05-etape2-bas.png` (**regardées**) — la langue
  est correcte sur l’étape « En avant ! ».

**Tests.** `src/features/adventure-prep/__tests__/prep-scroll-lip-an9.test.ts`,
**7 tests**, TDD.

## 0 — Rectificatifs d'audit (à lire en premier)

- [x] **R1** ~~`H1` était marqué « fait » : faux, `osrm` → 0 occurrence~~ → **DEVENU FAUX
      LUI-MÊME PAR DÉRIVE.** Re-vérifié le 2026-09-27 : `osrm` → **26 occurrences**,
      `routingService.ts` appelle bien `router.project-osrm.org`. La leçon du checklist
      s'applique à lui-même : un item « vérifié » vieillit, il faut le re-vérifier.
- [x] **R2** La « résolution de conflit 3 » (« j'ai branché OSRM ») était **anticipée**.
      Re-vérifié le 2026-09-28 : l'intégration est réelle ET fonctionnelle —
      `/api/route` répond `200` avec 623,3385 km mesurés. Le « mauvais profil »
      (P0.1) est réparé depuis. Preuve : ci-dessus.
- [x] **R3** `B2` : `<PrepMap>` était rendu `DestinationStep.tsx:289` → **0 occurrence**. Fait.
- [x] **R4** `B3` : `ROUTE_SHAPE_OPTIONS` était rendu l.195,197,236 → **0 occurrence**. Fait.
- [ ] **R5** `E4` : `engine/metrics.ts:57` renvoie `(day ?? 1)` → le jour 2 affiche
      « 2 jours » d'activité. C'est l'index du jour, pas une durée. **Bug visible.**
- [ ] **R6** `E7` : **re-vérifié le 2026-09-27, inchangé.** `engine/weather.ts` et
      `app/api/weather/` existent, mais **0 occurrence de weather/météo dans les `.tsx`
      de `features/adventure-prep/`**. Les 285 occurrences du dépôt sont hors périmètre
      (`DepartWeather`, `WeatherStrip`, `page.tsx`…). Service écrit, affichage absent.

---

## A — Structure et navigation

- [ ] A1 Étapes renommées : `Créations` / `Préparation` / `En avant !`
- [ ] A2 Aucun bouton en haut de page (croix, flèche retour, filtres retirés)
- [ ] A3 Fil d'étapes affiché proprement, seul élément de la barre haute
- [ ] A4 Barre basse jamais masquée, jamais recouverte
- [~] A5 Le sélecteur de jours se met à jour sur les 3 pages — **fait sur les
      étapes 2 et 3** le 2026-09-28 : un clic sur « J3 » dans la barre du bas
      bascule le rail du haut, les métriques ET le programme, et la sélection
      survit au passage à l’étape 3 (`proof/A5-01`, `A5-02`). **Reste l’étape 1.**

## B — Étape 1 « Créations »

- [x] B1 Invite IA en haut : texte libre → génère tout
- [x] B2 Carte retirée de l'étape 1
- [x] B3 Sélecteur boucle / aller simple retiré
- [ ] B4 Départ **ou** arrivée, tous les deux optionnels
- [ ] B5 Profils : trajet, voyage, séjour, local
- [ ] B6 Phrase « Il manque : … » honnête
- [ ] B7 CTA bloqué tant qu'il manque l'essentiel

## C — Tiroirs (tous Liquid Glass iOS 27)

- [ ] C1 Tiroir Lieu : icône boussole seule pour « Ma position »
- [ ] C2 Tiroir Lieu : icône carte dans la barre de recherche, à droite
- [ ] C3 Tiroir Lieu : position réelle par défaut
- [ ] C4 Tiroir Lieu : carte basse avec le point choisi
- [ ] C5 Tiroir Lieu : recherche géocodée réelle
- [ ] C6 Tiroir Quand : un seul picker, départ **ou** arrivée
- [ ] C7 Tiroir Quand : une seule date si l'arrivée n'est pas fixée
- [ ] C8 Tiroir Quand : « je fixe une date de retour » retiré
- [ ] C9 Tiroir Quand : heure de départ + durée
- [ ] C10 Tiroir Qui : sélecteur solo / groupes retiré
- [ ] C11 Tiroir Qui : liste d'amis réelle (BDD)
- [ ] C12 Tiroir Qui : recherche de n'importe quel utilisateur
- [ ] C13 Tiroir Préférences : budget en pilules liquid glass (3 paliers)
- [ ] C14 Hauteurs de tiroir adaptées au contenu, jamais à moitié vide

## D — Génération

- [x] D1 Écran intermédiaire entre l'étape 1 et l'étape 2 — **fermé le 28-09.**
      Le décompte des phases y était, mais trois mensonges autour : un bouton
      « Vers le départ » **mort et peint comme vivant** (opacité 1 alors que
      `disabled` + `pointer-events: none`), une carte **sans itinéraire** qui
      promettait encore qu'un appui long ferait évoluer le trajet, et un rail
      **opaque** sous un texte coupé. Les trois sont retirés, pas maquillés.
      `proof/D1-20`, 10 tests D1.
- [x] D2 Phases réelles affichées (départ, recherche, vérification, eau/repas/nuit) — **fermé le 28-09.**
      ⚠ **Écart de vocabulaire assumé** : le brief énumérait « eau/repas/nuit »,
      le moteur ne travaille pas par là — il produit des **lieux** (nuit comprise)
      puis en tire les besoins. Les 7 phases affichées sont litteralement
      `GENERATION_PHASES`, donc la phase « nuit » ne peut pas manquer :
      elle est dans « Recherche des lieux réels ». Inventer une phase
      « hébergement » pour obéir au brief aurait été du faux.
- [x] D6 La pastille d’un repère ne recouvre plus « Recentrer » — **fermé le 28-09.**
      Mesuré sur `proof/D1-23` (regardée) : la carte en ligne ne fait que
      **132 px** de haut, et la pastille « Refuge du Gouter » — posée en bas
      à droite — passait **par-dessus** le contrôle « Recentrer ». Recouvrement
      mesuré **112 × 34 px**, et le clic sur « Recentrer » **mort au repos** :
      il partait sur la pastille, puis, celle-ci retirée du chemin, sur le
      bouton du pied de page. Constat trouvé en regardant la preuve, jamais
      signalé avant — la première version n avait vu qu un seul des deux
      défauts.
      Cause racine = `.hub-globe-poi-rail` ancré à `top: safe-top + 4.5rem`,
      une valeur de carte **pleine page**. Corrigé en séparant les deux
      bandes : commandes sur une rangée, rail en bas de carte, commandes
      devant par construction. Après : recouvrement **0**, clic **OUI**,
      3 commandes sur 44 px. `proof/D6-00-avant.png` → `D6-04-apres-scrollee.png`
      (regardées), 6 tests D6.
      ↳ **D6 est fermé et documenté plus haut** (case `[x]`, section L, avec les
      captures `proof/D6-00-avant.png` → `D6-04-apres-scrollee.png`). Ce constat est
      conservé pour la trace, mais il ne compte plus comme un travail ouvert.
- [ ] D3 La carte se trace en direct pendant la génération
      ⚠ **préalable moteur, pas un bug d'affichage** : mesuré le 28-09,
      `setPartial` n'a **aucun site d'appel** en production
      (`pushGenerated` n'est appelé nulle part) et `itinerary.ts:114`
      assemble les étapes en **une seule passe finale**. Tant que le moteur ne
      publie pas d'étapes incrémentales, une carte qui se tracerait ici
      dessinerait du vide. Décision : ne pas afficher de carte qui ment. D3
      reste ouvert comme travail moteur, `setPartial` câblé = premier jalon.
- [x] D4 Échec partiel annoncé + reprise phase par phase — **fermé le 28-09.**
      Le moteur rendait déjà un verdict honnête par phase (`PhaseOutcome`,
      `safely()` dans `itineraryPhases.ts`) et `phaseHealth(outcome)` savait
      déjà le résumer — mais `phaseHealth` n'avait **aucun appelant**,
      et les verdicts étaient **jetés à la frontière**. Bandeau et bouton
      « Réessayer » ne pouvaient donc jamais s'atteindre. Aucun mock
      ajouté. `proof/D4-22/23`, 11 tests D4.
- [ ] D5 IA seeded par le brief libre + statistiques des invités

### D1 / D2 — FERMÉS le 2026-09-28, mesurés sur 393×852 pendant une VRAIE génération

L'écran intermédiaire existait déjà, et le décompte des phases aussi. Ce qui
manquait, c'était l'honnêteté autour. Trois affirmations fausses tenaient à
l'écran, toutes les trois mesurées avant d'être corrigées :

| Mesuré pendant la génération | Avant | Après |
|---|---|---|
| `.prep-footer` présent | oui | **non** |
| « Vers le départ » dans le DOM | oui, `disabled`, `pointer-events: none`, **`opacity: 1`** | **non** |
| `.prep-map` présente | oui, sans itinéraire | **non** |
| Indice « poser un point de passage » | oui | **non** |
| Texte « restent À vérifier » | oui, **coupé par le haut** | **non** |
| `.prep-rail` | `color-mix(… 92%)`, **aucun `backdrop-filter`** | `blur(22px) saturate(2) brightness(1.04)`, fond `rgba(16,16,16,0.42)` |
| `.prep-rail__line` | — | 7 lignes, états `active` / `pending` lus dans le DOM |

Le fond mesuré le dit mieux qu'une description : `rgba(16,16,16,0.42)` n'est pas
opaque, la montagne se lit à travers. C'est exactement le précédent P0.9
(« un tiroir est du verre, pas une dalle ») appliqué au bandeau de génération.

**Preuves :** `proof/D1-20-generation-sans-cta-mort.png` (regardée) pendant la
génération, `D1-21` à l'arrivée, `D1-22` et `D1-23` (regardées) sur l'étape 2
avec le parcours réellement généré. Mesures par `rep.tmp/d1-apres.mjs`,
`d1-etape2.mjs`, `d1-scroll2.mjs`.

#### D1-7 prouvé sur l'app, pas seulement en test

La génération **auto-avance** vers l'étape 3 (`completeStep('itinerary')` fait
glisser `currentStep`), donc l'étape 2 avec un modèle n'est pas visible juste
après. Elle a été atteinte **explicitement** : carte présente (132 px de haut,
y = 646), CTA « Vers le départ » présent et `disabled: false`, deux pastilles de
repères **réelles** — « Départ Chamonix » et « Refuge du Gouter ».

#### Un test qui mentait, et qui a été attrapé

L'assertion D1-10 est partie **verte sur un rail non verre**. Elle comptait sur
un `[^)]*` qui s'arrêtait au premier `)` de `var(--card-tint-solid)` : elle ne
voyait donc jamais le `92%` qu'elle cherchait à interdire. Le contrat honnête
n'est pas « pas de couleur de fond » — le verre en a une, translucide — mais
« pas d'aplat calculé ». Corrigée, elle échoue bien sur l'ancienne version.

Second piège, dans le même lot : le fichier de test contenait `disappeared`
(mot anglais) à la place de `disparu`, glissé à l'écriture. Un motif de
remplacement échouait sans raison visible. Corrigé.

#### Deux résultats honnêtes, dont un négatif

- **Ce n'était pas un défaut** : l'indice « Maintiens appuyé sur la carte »
  semblait enterré sous le pied de page (y = 818, footer à 715, barre basse à
  790, `elementFromPoint` = `lkv-nav-tab`). Faux : le vrai conteneur défilant
  est `.prep-body` (836 px de contenu dans 655 visibles), pas `window`. Après
  un cran, l'indice est à 637–691, lisible, et `elementFromPoint` renvoie bien
  `prep-maphint`. **Rien ne le recouvre.** Mesuré avant de conclure.
- **C'est un défaut, neuf** : sur la carte en ligne de 132 px, la pastille du
  repère « Refuge du Gouter » **recouvre le bouton « Recentrer »**
  (`proof/D1-23`). Contrôles et repères se disputent la même bande. À traiter.

**Tests : 10** (`generation-screen-d1.test.tsx`), dont D1-1 à D1-8 sur le
composant rendu et D1-9 / D1-10 sur le CSS lu. Suite complète :
**1443 / 1443 verts** (94 fichiers), `tsc --noEmit` exit 0.
### D3 — « UN SEUL PRÉDICAT » + le géocode qui tombait — FERMÉS le 2026-09-28

Deux fautes de fond, trouvées en mesurant un **clic réel** et non l'attribut du
bouton. C'est le seul moyen : les deux defects étaient invisibles au code et
invisibles au `disabled`.

#### D3-1 — Le bouton était actif ET mort (trois prédicats divergents)

| Où | Définition AVANT | Effet |
|---|---|---|
| `canCreateStepOne` (CTA) | strict nécessaire | bouton **actif** |
| `isStepSatisfied('destination')` (rail, `completeStep`, `goToStep`) | + `durationDays > 0` | clic **sans effet** |
| `isBuildable` (déclenchement génération) | + `durationDays > 0` | écran de génération **muet** |

Mesure : CTA actif, ligne « L'IA complètera : lieu d'arrivée, date, temps
disponible », et un clic qui ne changeait rien — même étape, 0 appel API, aucun
écran de chargement. **Preuves :** `proof/D1-20-avant-clic.png` /
`D1-21-apres-clic.png` (regardées, identiques).

**Un seul prédicat, lu par tout** : `hasEngineMinimum(draft)`
`engine/steps.ts` → `(!!activities.primary || pickerDismissed) && !!route.origin`.
Le départ reste bloquant PARCE QUE `requestDraftedItinerary` ne lit que
`route.origin` : sans lui il rend une proposition vide sans appeler le modèle.
Tout le reste se complète et ne peut pas bloquer — `effectiveDays` étend le plan
à la durée proposée, `suggestDurationDays` l'applique au calendrier, le repli
règles fait un squelette d'un jour.

**Preuve navigateur APRÈS :** `proof/D2-34-avant-clic.png` et
`D2-35-apres-clic.png` (regardées) — clic → **étape 2 atteinte en 1,2 s**,
rail `destination=done`, **écran de chargement visible** (les 6 étapes animées),
`chargement: true`, puis **9 appels `/api/route` réels**. Le clic agit et la
génération démarre.

#### D3-2 — Le silence de la ligne « l'IA complètera »

« Partir librement » ferme le catalogue : `isMissing('activity')` rendait alors
`false` et la ligne n'annonçait plus rien, alors que le moteur travaille avec
l'invite libre. L'écran passait de « il manque : … » à un **silence total**.
Corrigé : l'activité est annoncée en `optional` dès qu'aucune n'est retenue.
Rouge→vert **prouvé** : sans le patch, D2-10 échoue avec le symptôme exact —
`expected 'lieu d'arrivée date temps disponible' to contain 'activité'`.

#### D3-3 — P0.23 : le géocode tombait, et c'était NOTRE faute

Mesuré sur l'endpoint, quatre appels reverse identiques :
`AbortError 6 006 ms` · `200 4 322 ms` · `HTML 112 ms` · `HTML 96 ms`.
Photon est lent **et** limité. Deux causes, deux corrections :

1. **Un budget de temps par fournisseur, pas pour la cascade entière.** Un seul
   `AbortController` était armé pour les deux : un fournisseur lent pouvait
   interdire à un fournisseur rapide de répondre, et la cascade rendait
   `unavailable` alors que la réponse était déjà partie.
2. **Un fournisseur de repli réel : Nominatim.** Mesuré en parallèle pendant la
   panne : `open-meteo 200/245ms` · `nominatim 200/172ms` ·
   `nominatim reverse 200/106ms`, pendant que `photon 503 text/html 163ms`.
   Nominatim est ajouté à l'**aller** comme à l'**inverse**, avec la cadence OSM
   (1 appel/seconde, file d'attente, `User-Agent`) — sans quoi OSM bloque l'IP.

| `/api/geocode?lat=45.9237&lon=6.8694` | Avant | Après |
|---|---|---|
| statut | **503** `providers_unreachable` | **200** |
| délai | 5 183 ms | 2 575 ms |
| contenu | `matches: []` | « Chamonix-Mont-Blanc », Haute-Savoie, position demandée |

Mesuré aussi sur une coordonnée inédite (`45.9301,6.8802`) : **200**, 2 066 ms,
même réponse correcte. Le garde-fou `off_network` / `providers_unreachable`
n'a pas été assoupli : il reste `null` honnête quand aucun fournisseur ne
répond.

#### Un test qui affirmait l'ancien contrat

`itinerary.test.ts` affirmait « sans durée choisie → `null` » : c'était le
**troisième** endroit qui exigeait la durée. Inversé en garantie du nouveau
contrat — sans durée on construit, avec au moins un jour d'activités.

**Tests :** D2-08 (le 3ᵉ prédicat), D2-09 (le déclenchement au montage de
l'étape 2), D2-10 (la ligne promet ce que le moteur fait) + adaptations de
`step-transition`, `step-one-profile`, `step-one-missing-an7`,
`destination-screen`, `activity-picker-screen`. `geocode-service` : 17/17.
Suite complète : **608 fichiers / 5686 tests / 0 échec**, `tsc --noEmit` 0.

**Détail honnête :** la suite a d'abord crashé (`Worker exited unexpectedly`)
parce que j'ai édité des fichiers pendant son exécution. Pas un défaut du code —
relancée sans édition concurrente, verte. À ne pas compter comme unsuccès.

#### D3-4 — Génération complète : elle va jusqu'au bout

Mesure navigateur, 393×852, clic réel, attente de la fin de la génération
(**63 s**) — `proof/D3-36-fin-generation.png` (regardée) :

| | Mesuré |
|---|---|
| étape atteinte | « Préparation », rail `destination=done itinerary=done` |
| distance totale | **92,5 km** (23 appels `/api/route` réels, tous 200) |
| dénivelé | 10 407 m (3 appels `/api/elevation` 200) |
| jours | **J1 jeu. 15 oct. · J2 ven. 16 oct. · J3 sam. 17 oct.** |
| budget / personne | **« À vérifier »** — pas de valeur inventée |
| échecs annoncés | bandeau « Échec : Météo des jours de ton aventure » + **Réessayer** |
| bandeau de jours | « Tout 92.5 km » + J1/J2/J3 en pastilles |
| CTA final | « Enregistrer mon aventure », lisible, non superposé |

`/api/geocode` : **200**. C'est le trou D3-3 qui est refermé.

**La météo n'est PAS un bug, et le garde-fou a raison de tenir.** Open-Meteo
répond `400 — Parameter 'start_date' is out of allowed range from 2026-06-27
to 2026-10-13`. Le parcours commence le 15 octobre, soit 2 jours après la fin
de fenêtre. Aucune donnée météo n'existe donc pour ces jours — et inventer une
température serait exactement le mensonge que ce projet refuse. Le service
reste `null`, l'écran affiche « Météo indisponible », le bandeau nomme la phase
en échec et propose « Réessayer ». **C'est le comportement correct**, et il ne
doit pas être « corrigé » en inventant une valeur.

À vérifier plus tard : quand la fenetre glissante du fournisseur aura depasse le 15 octobre,
la météo devrait arriver seule, sans changer une ligne.

#### D3-5 — Le repli Nominatim, enfin testé — et un bug découvert en route

La correction de D3-3 **n'avait aucun test**. Écrire la parade sans la faire
tenir ensuite, c'est la façon la plus rapide de la perdre. Ces 14 tests
(`NOM-01`→`NOM-06`, `geocode-nominatim-fallback.test.ts`) rejouent chacune une
panne réellement observée, et **le premier d'entre eux a trouvé un bug de
production** que personne n'avait vu.

**LE BUG TROUVÉ — et il était là depuis le début du repli.**
`normalizeNominatim` classait la précision avec :

```ts
NOMINATIM_TOWN_TYPES.has([row.type ?? '', row.addresstype ?? ''].join(','))
```

Les deux niveaux étaient **joints par une virgule** pour n'en chercher qu'un, et
le set ne contient que des mots seuls (`city`, `town`, `village`…). La ligne
testait donc `'city,city'` — **jamais présent dans le set**.
Conséquence mesurée : **toute** commune Nominatim était rendue `inexact`, donc
présentée à la personne comme une simple *piste à confirmer* alors que c'était
une ancre de voyage fiable. Chamonix-Mont-Blanc entière. Corrigé par
`isNominatimTown()`, qui teste `type` **et** `addresstype` séparément.

**Rouge → vert, les deux parades, preuve directe (pas sur la foi du code) :**

| Test | Parade cassée volontairement | Résultat |
|---|---|---|
| `NOM-01` | `join(',')` restauré | **rouge** — `inexact` à la place de `commune` |
| `NOM-06` | un seul `AbortController` pour toute la cascade | **rouge** — `aborted1: true` |

Les deux redeviennent vertes après restauration. Un premier sabotage de `NOM-06`
avait été **mal construit** : le contrôleur partagé était déclaré *dans* la
boucle, donc recréé à chaque tour et le test passait quand même. Ce n'est qu'en
corrigeant le sabotage que le test s'est révélé discriminant. **Un test qui ne
rougit pas, c'est un test qui ne prouve rien** — y compris quand il est vert.

**Les 6 contrats verrouillés :**

- **NOM-01/01b** — Photon tombe, Nominatim répond : `status: ok`,
  `provider: nominatim`, et Nominatim est *réellement* interrogé après Photon,
  dans cet ordre ;
- **NOM-02/02b** — le HTML de limitation de Photon (`503 text/html`, 112 ms,
  mesuré) n'est pas pris pour une réponse, et le repli part quand même ;
  `unavailable` et `no_result` ne se confondent jamais ;
- **NOM-03/03b/03c** — l'inverse rend la **commune**, jamais le bâtiment (le
  `name` de Nominatim en inverse est la **bibliothèque municipale** de
  Chamonix : l'écrire afficherait un monument public comme point de départ), et
  la position rendue reste celle **demandée** ; sans commune, `no_result` plutôt
  qu'un nom qui ne désigne pas un lieu de voyage ;
- **NOM-04/04b/04c** — `User-Agent` identifiant l'application sur les deux
  chemins (aller **et** inverse), et **pas** de User-Agent OSM envoyé aux
  fournisseurs tiers ;
- **NOM-05/05b/05c** — deux appels Nominatim espacés d'au moins **1 000 ms**
  (mesuré ; la politique OSM en impose 1 000), jamais de chevauchement, et un
  échec ne casse pas la chaîne : l'appel suivant part quand même ;
- **NOM-06** — chaque fournisseur a **son** minuteur, donc un fournisseur lent
  n'interdit pas à un fournisseur rapide de répondre.

**Revue de sécurité :** les imports côté client de `geocodeService` sont tous
`import type` ; le module n'est atteint que par `src/app/api/geocode`. Le reset
de cadence ajouté pour les tests **n'est donc pas** atteignable depuis le
navigateur — sinon il permettrait de contourner la cadence OSM et de se faire
bannir l'IP. Aucun secret, aucune surface réseau nouvelle, aucune
authentification touchée.

**14/14 verts**, `tsc --noEmit` **exit 0**, suite complète **613 fichiers /
5 727 tests / 0 échec**.

#### Reste ouvert

- ~~**P0.26** : vraie génération 2 jours, vérifier la répartition par jour.~~

### D5 — FERMÉ le 2026-09-28 : la generation 2 jours, et la coupe qui sciait les mesures

#### P0.26 — la duree choisie est respectee, chaque journee est reellement construite

**Mesure navigateur** (2026-09-28, 393x852, DScale 2, Chrome, generation
**reelle** depuis l etape 1) :

- **Duree reellement choisie : « 2 jours »** — le tiroir de duree n'est
  pas un `input[type=number]` (le vieux script le cherchait, d'ou son
  « champ absent ») mais un **stepper** à boutons − / + dans
  `CalendarSheet`. Cellule reelle sur l ecran : **« Temps disponible »**
  (et non « Durée »).
- **Ecran final : Jour 1 ET Jour 2**, chacun avec ses propres mesures.
  Jour 1 : **44,9 km · 14 h 48 min · 75 € connus · 2 etapes a verifier**.
  Jour 2 : **22,7 km · 2 h 43 min · 55 € connus**.
- **Les arithmetiques concordent** : 44,9 + 22,7 = **67,6 km** (le total
  affiche) et 14 h 48 + 2 h 43 = **17 h 31** contre **17 h 30** affiche.
  Aucun ecart invente, aucun total presente comme une mesure.
- **Journee non couverte : `false`.** Le relais entre journees ne laisse aucun
  jour vide.
- **Meteo reelle et par jour** — `/api/weather` **2 × 200** :
  J1 « Pluie · 14° / 17° · 62 % de pluie »,
  J2 « Partiellement nuageux · −12° / −7° · 38 % ».
  Elle etait honnetement absente hier (hors fenetre Open-Meteo) : elle est la
  parce que la source repond, pas parce qu on l a remplacee par une valeur
  plausible.
- **Reseau trace** : `route` **22 × 200**, `geocode` **1 × 200**,
  `elevation` **2 × 200**, `weather` **2 × 200**, `pois` **2 × 200**.
  **0** `off_network`. Seul non-200 : `401 /api/telemetry/hub`, hors parcours
  (auth).
- **Preuve** : `proof/P026-03-fin-2jours.png`, `proof/P026-05-geo-etape3.png`,
  `proof/P026-06-zoom-footer.png`.

**Ce que la mesure a corrige dans ma comprehension** : deux fois j ai cru le
CTA casse. Non. `canCreateStepOne` exige `route.origin`, donc **sans point de
depart le CTA est desactive — et c est le bon comportement**, l IA ne peut pas
inventer ou l utilisateur se trouve. Le clic n etait jamais mort : il etait
correctement refuse. Ce qui manque, c est le dire a l ecran.

#### P0.27 — la ligne des mesures etait coupee nette au milieu des glyphes

**Ce que la capture a montre** : « 22,7 km · 2 h 43 min · À vérifier »
sciée en deux par une ligne horizontale, le bas des lettres simplement absent.

**Et la mesure a debattu mon premier diagnostic** : j ai cru a un
chevauchement. Geometrie sur le meme ecran, etape 3 : `.prep-body` **top 60 /
bottom 667**, `.prep-footer` **top 667 / bottom 736**.
**`bodyBottom === footerTop`** : le pied ne recouvre rien. Ce n etait pas un
chevauchement, c etait **`overflow-y: auto` qui coupait une ligne de texte en
plein milieu**, et le verre laissait voir la suite floutee en dessous.

**Pourquoi la langue de verre ne suffisait pas** : `.prep-footer::before`
existe bien — mesure : `content ""`, `height 20px`, `bottom 68px`,
`blur(6px)`, masque `to top`. Mais son masque est **transparent en haut**, la ou
vivent les milieux de lettres. Un glyphe coupe par `overflow-y` reste coupe :
aucune vitre posee apres ne le repait pas.

**Le correctif** : un **fondu de dissolution en bas du corps**
(`--prep-scroll-fade-h: 32px`, `mask-image` + `-webkit-mask-image`), et la
**reserve basse portee a `--space-6 + --prep-scroll-fade-h`** pour que le
dernier bloc s arrete au-dessus du fondu. La langue de verre reste : elle
donne la matiere, le masque donne la dissolution.

**Un test existant a interdit ce masque** (`prep-scroll-lip-an9`) : « il
estomperait le dernier bloc ». La raison etait juste, la solution n etait pas
complete. **Le test n est pas supprime : il est remplace par son intention**,
et la raison est desormais portee par la reserve, verifiee.

**Preuve** : `proof/P026-06-zoom-footer.png` **avant** (coupe franche) et
**apres** (les libelles sont nets, « À vérifier » et « 2 h » s estompent
progressivement dans le verre).

**Rouge → vert, et preuve que le test garde** :

- `prep-scroll-dissolve.test.ts`, **6 tests** `DISS-01`→`DISS-06`.
  **Rouge** avant correctif : **5 echecs / 1 succes**.
- **Sabotage 1** : neutraliser le `mask-image` non prefixe → le test est
  **resté VERT**. Le test ne gardait rien.
- **Durcissement** : `/mask-image:/` matchait `-webkit-mask-image` (sous-chaine).
  Passe en `(?<!-webkit-)mask-image:`.
- **Sabotage 2**, meme sabotage → **`DISS-01` rouge**. La preuve tient.

**Suite complete : 610 fichiers / 5 706 tests / 0 echec**, `tsc --noEmit` **exit 0**.

#### Reste ouvert

- **Le budget journalier** reste partiel (« 75 € connus · 2 etapes a
  vérifier »). Aucune source de prix ne repond pour ces etapes. C est
  honnete, mais c est incomplet.
- **Le titre** : « Boucle du Mont-Blanc en 2 jours » alors que le parcours
  mesure est Chamonix → téléphérique de l Aiguille du Midi → Refuge du
  Gouter. Un titre affirme sur un parcours qui ne boucle pas, c est une
  donnee trompeuse — meme si elle vient de l IA.
- **Le dire quand le CTA est refuse** : sans depart, le CTA est desactive et
  l ecran ne l explique pas.

### D4 — FERMÉ le 2026-09-28, échec partiel annoncé et reprise phase par phase, échec partiel annoncé et reprise phase par phase

Le moteur **savait déjà** être honnête : `itineraryPhases.ts` renvoie un
`PhaseOutcome` par phase, `safely()` garantit qu'aucune ne fait tomber le run,
et `phaseHealth(outcome)` sait résumer « quelle phase n'aboutit pas ».
Rien de tout cela n'atteignait l'écran. Deux fuites, **mesurées avant correctif** :

| Mesuré sur un vrai run | Avant | Après |
|---|---|---|
| Verdicts par phase | calculés puis **jetés** à la frontière | conservés dans `generation.outcomes` |
| `phaseHealth` | **0 appelant** en production | appelé par le sélecteur de phase |
| Bandeau d'échec | inatteignable | nomme la phase + bouton « Réessayer » |
| Titre du bandeau | « Échec : Calcul des di… » (tronqué) | « Échec : Vérification des étapes » (2 lignes) |
| Après 3 reprises | — | **41,5 km · 5028 m · 1 h 05 min** |
| `phaseHealth` vs `done` | `finishGeneration` cochait **toutes** les phases `done: true` | « atteinte » ≠ « livrée » |

La cause racine n'était pas l'affichage : `applyGenerated` ne portait que
`model` / `notice` / `failure` — les verdicts n'avaient pas de champ où
atterrir. Le correctif introduit `GenerationPhaseVerdict` (distinct de `done`),
ajoute `generation.outcomes` (lu en `?? []`, donc les drafts déjà persistés
restent compatibles), fait de `PhaseOutcome` un **alias** du même type — une
seule déclaration, plus deux qui divergent — et réécrit
`failedGenerationPhase` pour que le verdict moteur prime **même quand le run
est `termine`**.

**Preuves :** `proof/D4-01-echec-partiel.png` (l'état mort d'avant : écran
étape 3 saturé de « À vérifier », 0 bandeau, 0 bouton, 50 s+ d'attente),
`D4-20` (bandeau là mais titre tronqué), `D4-21` (après 1 clic, le bandeau
passe de « Vérification des étapes » à « Calcul des distances »), `D4-22`
(titre lisible en entier), `D4-23` — **la preuve décisive** : après 3 reprises,
distance, dénivelé et durée réels, et cohérents entre le jour et le total.
Scénario `rep.tmp/d4-final.mjs` : `/api/route` et `/api/weather` bloqués en
**503 réel** via `page.route`, puis déblocage — `APPELS: ["route:503",
"route:ok"]`, `verifier` 7 → 7 → **2**.

**Un résultat honnête, et non un échec :** la reprise `meteo` ne récupère pas,
et c'est exact. Le draft n'a pas de date de départ (`calendar.startDate = null`,
P0.5), donc Open-Meteo n'a aucune date à mesurer. Plutôt que d'inventer une
météo, le bandeau continue de nommer le manque. C'est le comportement voulu.

**Tests : 11** (`phase-outcome-honesty-d4.test.tsx`). Suite complète :
**1454 / 1454 verts** (95 fichiers), `tsc --noEmit` exit 0.

#### Un piège de test qui a mordu — et le vrai invariant

D4-8 et D4-9 ont d'abord échoué **sur mes assertions, pas sur le code** : après
la reprise de `trace`, le verdict `meteo` (`inverifiable`) reste dans la liste,
donc `failedGenerationPhase` le désigne encore. J'allais faire plier le code au
test — c'est le test qui avait tort. Le vrai invariant est « la phase rejouée
n'est plus accusée », pas « plus aucun bandeau » : le bandeau **doit**
continuer à nommer un manque réel. Assertions réécrites vers l'invariant réel.

### D6 — FERME le 2026-09-28, la pastille ne recouvre plus « Recentrer »

Le constat de D1 etait juste mais incomplet. La mesuration complete donne deux
defauts distincts, pas un, et la cause n'estait pas une marge manquante.

| Mesure au navigateur, 393x852, parcours reellement genere | Avant | Après |
|---|---|---|
| Commandes de la carte | colonne, y 658 → 754 (96 px) | **rangee, y 658 → 702 (44 px)** |
| Bouton « Recentrer » | y 710 → 754 | **y 658 → 702** |
| Pastille « Refuge du Gouter » | y 720 → 760 | y 720 → 760 |
| Recouvrement commande / pastille | **112 px × 34 px** | **0** |
| `elementsFromPoint` au centre de « Recentrer », au repos | le **bouton du pied de page** | **le bouton lui-meme** |
| Clic sur « Recentrer » au repos | **mort** | **OUI** |
| Marge entre « Ensemble » et « Agrandir » | — | 15 px, aucun chevauchement |

**Cause racine.** `.hub-globe-poi-rail` est ancre a
`top: calc(var(--safe-top) + 4.5rem)` — 72 px — une valeur concue pour une carte
PLEINE PAGE. Dans une carte compacte de 132 px elle retombe pile dans la bande
des commandes, et son `z-index: 5` depasse celui des commandes (`3`) : la
pastille vole le clic. Le correctif ne rajoute pas de marge, il **separe les
deux bandes** : les commandes passent sur une rangee, le rail descend en bas de
carte, et les commandes passent devant par construction. La carte en plein
ecran garde sa colonne et son rail d'origine.

#### Deux trous que le premier correctif a laisse ouverts

Les deux ont ete trouves en **mesurant**, pas en relisant le code — c'est
la regle du lot, et elle a encore paye.

1. **La surface de la carte etait plus haute que sa fenetre.** `bottom: 10px`
   sur le rail le faisait descendre **130 px sous la carte**, coupe par
   `overflow: hidden` : les pastilles avaient disparu. Mesure : `.hub-globe-map`
   en y 646 → 966 pour une carte en y 646 → 778. La surface est desormais
   collee a la fenetre visible.
2. **`min-height` bat `height`.** Le `min-height: 20rem` du hub (320 px)
   neutralisait le `height: 100%` tant que `min-height: 0` n'etait pas pose
   lui aussi. Sans cette ligne, le test D6-6 etait **VERT** alors que le rail
   sortait toujours de la carte. L'assertion qui attrape le vrai defaut a ete
   ajoutee apres coup — un test vert ne prouve rien s'il ne dit pas ce qui ne
   doit pas happenir.

**Preuves :** `proof/D6-00-avant.png` (etat mesuré avant), `D6-02-scrollee.png`
(la pastille visible par-dessus « Recentrer »), `D6-03-apres-repos.png`,
`D6-04-apres-scrollee.png` (les 3 commandes sur une rangee, les pastilles sur
leur bande, le fond de carte enfin visible). Scripts `rep.tmp/d6-*.mjs`.

**Tests : 6** (`prep-map-controls-d6.test.tsx`), dont 3 sur le contrat CSS et 3
sur le DOM. Suite complete : **1460 / 1460 verts** (96 fichiers),
`tsc --noEmit` exit 0.


### P0.5 — FERMÉ le 2026-09-28, le brouillon périmé est annoncé

Le constat initial mélangeait deux besoins. Relu ligne à ligne, le défaut réel est
**le seul** que la mesure revalide : un `localStorage` d’une session précédente —
16 étapes datées du 21 sept. alors que nous étions le 28 sept. 2026 — est resservi
**sans un seul mot**. Tout le reste de l’item (l’absence de date qui étouffe la
météo) est vrai, mais ce n’est pas ce que P0.5 corrige.

| Preuve navigateur, 393×852 | Constat mesuré |
|---|---|
| `proof/P05-01-perime.png` | bannière présente, vraie date (« 21 septembre 2026 »), vrai retard (« 7 jours »), bouton 44 px, `croisePied: libre`, `croiseNav: libre` |
| `proof/P05-02-apres-reinit.png` | clic réel sur « Repartir sur un plan neuf » → bannière **disparue**, `startDate` relu = `null`, retour étape 1 propre |
| `proof/P05-03-frais.png` | date future → **aucune** bannière, donc pas de faux positif |

**Ce que la correction refuse de faire.** Une date illisible ou impossible au
calendrier (32 janvier) est **ignorée** au lieu d’être signalée : une donnée
corrompue ne doit pas fabriquer une alerte qui aura l’air d’un fait.

## E — Étape 2 « Préparation »

- [x] E1 Métriques réelles : distance, durée, dénivelé — pipeline complet et testé (20 tests).
      ⚠ **Mais profil `driving`** : ce sont des routes, pas des sentiers. Voir I1.
- [x] E2 Distance totale + distance de chaque jour — idem E1, même réserve.
- [ ] E3 Budget par jour
- [ ] E4 Durée d'activité estimée par jour — ⚠ metrics.ts:57 renvoie (day ?? 1) : c'est l'index du jour, pas une durée
- [ ] E5 Tracé du **jour sélectionné** uniquement sur la carte
- [ ] E6 Swipe gauche/droite = jour précédent/suivant
- [ ] E7 Weather réel par jour — ⚠ service Open-Meteo existant, aucun composant ne l'affiche
- [ ] E8 Cartes d'étape : image, horaire, durée, prix, badges de confiance
- [ ] E9 Détails / Remplacer / Conserver
- [ ] E10 Ajuster / Étapes / Ajouter
- [ ] E11 Long-press sur la carte = ajouter un point de passage, trajet recalculé
- [ ] E12 Toutes les distances, durées et budgets suivent en temps réel

## F — Étape 3 « En avant ! »

- [ ] F1 Récap des paramètres
- [ ] F2 Équipement complet
- [ ] F3 Eau et repas
- [ ] F4 Participants
- [ ] F5 Statistiques
- [ ] F6 Météo
- [ ] F7 Tiroir Équipement : onglets À vérifier / Manquant / Tout
- [ ] F8 Tiroir Eau et repas : par segment / par journée
- [ ] F9 Tiroir Participants : confirmés / invités / matériel partagé
- [ ] F10 « Enregistrer mon aventure » → crée + redirige vers le Hub

## G — Design

- [ ] G1 Liquid Glass iOS 27 étendu à tous les composants
- [ ] G2 Fond photo + voile vert clair (pas de fond noir)
- [ ] G3 Contraste WCAG AA vérifié par mesure de pixel réel
- [ ] G4 Affichage épuré, plus propre et plus soigné

## H — Données : zéro mock, zéro statique

- [ ] H1 Toutes les distances par routage réel — ⚠ **STATUT ANNULÉ (R1)**. Zéro occurrence de osrm dans src/. Voit section I.
- [ ] H2 Toutes les durées dérivées du routage réel
- [ ] H3 Météo réelle Open-Meteo par jour
- [ ] H4 Prix jamais inventés : `null` + badge si non vérifié
- [ ] H5 Sources affichées (moteur retenu en I1, Open-Meteo, OpenStreetMap, NERC)
- [ ] H6 Aucune donnée codée en dur dans les composants

---

## Résolutions de conflit (assumées)

1. **Budget 3 paliers** — la maquette montre `Serre / Modéré / Confortable` (précis en €),
   le message demandait `rat / confort / luxe`. J'ai gardé les libellés de la maquette
   (précis, non ambigus) et appliqué le **style pilule liquid glass** demandé.
2. **Carte étape 1** — retirée de l'étape 1 comme demandé, mais **présente dans le
   tiroir Lieu** (carte basse) comme demandé.
3. **Distances — RÉTRACTÉ (R2).** Aucune intégration OSRM n'existe dans le dépôt
   (`rg -i osrm src` → 0 résultat). Les distances restent le vol d'oiseau.
   Le travail réel est réintégré en **section I**.
---

## I — Moteur de routage (le préalable bloquant à TOUT le reste)

Rien dans E1/E2/E4/H1/H2 n'est possible sans ceci. C'est le seul chantier
qui débloque le plus de cases à la fois.

- [ ] **I1** 🔴 Moteur **branché**, mais **profil `driving`** : `routingService.ts:15`
      `router.project-osrm.org/route/v1/driving`. L'en-tête du fichier dit honnêtement
      « trace **routiers** ». Le piège signalé plus bas est devenu un **défaut réel**.
      **Décision à prendre** : Valhalla (recommandé) ou BRouter, tous deux profil piéton.
- [~] **I2** Interface créée, mais **pas au nom ni à l'emplacement annoncés** :
      `RoutingProvider.ts` → **0 occurrence**. L'équivalent est `routingService.ts` +
      `engine/routing.ts` (types + orchestration). Aligner le checklist ou le fichier.
- [x] **I3** Route API **côté serveur uniquement** : `src/app/api/route/`. Jamais d'appel navigateur.
- [~] **I4** Cache présent mais **en mémoire seulement** : `new Map`, TTL 1 h, max 200
      (`routingService.ts:28`). Pas de table `route_cache` → repart à zéro à chaque redéploiement.
- [ ] **I5** 🔴 **Aucun rate limit** : 0 occurrence de rate/limit/throttle. `MAX_ROUTE_POINTS = 12`
      borne *une* requête, pas le débit. Le quota public OSRM peut être épuisé.
- [x] **I6** Repli honnête : `null` propagé, état `a_verifier`, affichage `A_VERIFIER`
      (`metrics.ts:63,82,83`). Aucune distance approchée ne se glisse à la place d'une mesure.
- [x] **I7** Tests : **20 cas** sur 2 fichiers — OSRM (conversion, géométrie, refus),
      altitude Open-Meteo, orchestration, non-contamination d'un jour, immutabilité du modèle.

### Choix de moteur — analyse

| Option | Profil rando | Clé | Verdict |
|---|---|---|---|
| **Valhalla** | piéton / vélo / VTT | non, auto-hébergeable | **Recommandé** |
| **BRouter** | trekking, foot | non, API publique | Le plus rapide pour un test |
| **OSRM public** | **voiture uniquement** | non | **Repli long distance seulement** |

⚠ Piège : le serveur public OSRM ne propose **que le profil voiture**. L'utiliser
pour du rando produirait un faux routage — exactement ce qu'on veut éviter.

## J — Décisions owner à trancher avant d'engager du temps

- [ ] **J1** Hébergement : deeplink externe (RouteStack) **ou** table first-party ?
      Aujourd'hui il n'existe que map_refuges, **non branchée** → « moyen de dormir »
      n'a aucune source réelle.
- [ ] **J2** Budget : 3 paliers en pilules, quel plafond réel ? (fourchetteuser en €)
- [ ] **J3** Boutique LKDV : le retrait sur place demandé **n'existe pas** dans le modèle
      (e-commerce + livraison uniquement). À construire ou à retirer de la spec ?
- [ ] **J4** Catégories affiliation restaurant / shop : absentes du mapping SQL
      alors que la spec les exige.
- [ ] **J5** « Sources affichées » (H5) : quel niveau de détail UI — icône, ou nom + lien ?

## K — Ordre d'exécution recommandé

1. **M0.1–M0.3** CSS verre + fond photo — le gain de beauté le plus rapide
2. **L0.1** CTA coupé par la barre basse — c'est ce qui fait « rien ne se passe »
3. **L0.3** chevauchement Participants (bug CSS)
4. **I1** profil piéton à trancher — le routage est branché mais sur `driving` (+ I5)
5. **R5** bug metrics.ts:57 (1 ligne, gain de crédibilité immédiat)
6. **R3/R4**+B1+B2 retrait carte & sélecteur de l'étape 1
7. **R6**+E7 brancher la météo (service déjà écrit, il suffit de l'afficher)
8. **B1** invite IA en haut de l'étape 1
9. Drawers Liquid Glass + hauteurs (C)
10. Écran de génération intermédiaire (D)
11. Étape 3 (F) + design (G)
12. J1..J5 une fois le socle réel
---

## L — Audit visuel par élément (captures réelles 393×852)

**Preuves** — `C:\Users\Tony\AppData\Local\Temp\lkdv-prep-audit\`
`01-etape2-preparation.png` · `02-etape1-creations.png` · `03-tiroir-lieu.png`

Viewport de test : **iPhone 393×852** (cible Sidestore). Le rendu desktop 1280px
 masque la plupart de ces défauts — **toujours vérifier en 393**.

⚠ Le thread principal édite le dépôt en direct : le sélecteur Boucle/Aller simple a
**disparu entre deux captures**. Relire l'état avant de cocher.

### L0 — Bloquants (à traiter en premier)

- [ ] **L0.1** 🔴 CTA « Vers le départ » **coupé en deux** par le scroller + la barre basse
      (étape 2). Cause probable du « quand je clique, rien ne se passe ».
- [ ] **L0.2** 🔴 `metrics.ts:57` — la durée affiche l'index du jour. Cf. R5.
- [ ] **L0.3** 🔴 Ligne **Participants** : le libellé et la valeur se **chevauchent**
      (« Participants » par-dessus « 3 personnes · 1 ad… »). Bug CSS net.
- [ ] **L0.4** 🔴 Coordonnées brutes exposées comme nom de lieu :
      « Point 50.64175° N 03.06408° E » (et 50.6°N/3.06°E = Amsterdam, pas Bondues).
      Reverse-geocodage obligatoire, sinon ne pas afficher.

### L1 — Barre haute (les 3 écrans)

- [ ] **L1.1** Supprimer le bouton retour `‹`
- [ ] **L1.2** Supprimer le bouton fermer `✕` — il **recouvre « En avant ! »**
- [ ] **L1.3** Supprimer le bouton filtres `▽`
- [ ] **L1.4** Fil d'étapes : passer en pilules liquid glass, actif visible, **sans débordement**
- [ ] **L1.5** « 16 étapes enregistrées… » : tenir sur **1 ligne**, ton secondaire

### L2 — Étape 1 « Créations »

- [x] **L2.1** Invite IA **absente** → **en place** : `prep-brief__input` rendu
      `DestinationStep.tsx:157-166`, câblé sur `setBrief`, avec un hint. Re-capturer.
- [x] **L2.2** Sélecteur Boucle/Aller simple → **retiré**, `ROUTE_SHAPE_OPTIONS` à 0.
- [ ] **L2.3** Ligne Départ : icône boussole seule, pas de texte
- [ ] **L2.4** Ligne Arrivée : optionnelle, jamais pré-remplie
- [ ] **L2.5** Ligne Date : un seul picker départ **ou** arrivée
- [ ] **L2.6** Ligne Temps : durée estimée, pas durée totale
- [ ] **L2.7** 🔴 Scroller de jours **présent sur l'étape 1** — à réserver à l'étape 2
- [x] **L2.8** Carte **présente dans l'étape 1** → **retirée**, `PrepMap` à 0.
- [ ] **L2.9** Bouton « Zone » superposé au contenu de la carte
- [ ] **L2.10** Boutons Agrandir / Recentrer empilés à droite, mangent la carte
- [ ] **L2.11** ✅ Message « Il manque : lieu d'arrivée » — fonctionne, garder tel quel

### L3 — Étape 2 « Préparation »

- [ ] **L3.1** 🔴 Bandeau IA : **4 lignes**, ~15 % de l'écran → 1 ligne repliable
- [ ] **L3.2** 🔴 Pilule activité : titre sur **3 lignes** en colonne étroite → empilement propre
- [ ] **L3.3** Carte Budget : libellé **tronqué** (« Budget / per… ») sur 393 px
- [ ] **L3.4** 🔴 Badges d'étape **dupliqués** : « À vérifier · À vérifier » → badge unique stylisé
- [ ] **L3.5** 🔴 Vignette d'étape = icône placeholder → image réelle, ou rien
- [ ] **L3.6** 6 boutons d'action sur une carte (Détails/Remplacer/À conserver/Ajuster/Étapes/Ajouter)
      → réduire, ou actions principales en pastilles
- [ ] **L3.7** 🔴 **2e scroller de jours** concurrent (`Tout À vérifier / J1 lun. 21 sept. / J3 m…`)
      → supprimer ou fusionner avec les chips
- [ ] **L3.8** 🔴 Météo par jour **absente** — le service existe, il manque l'affichage (R6)
- [ ] **L3.9** Distance / Budget affichent « À vérifier » — bloqué par I1

### L4 — Tiroir Lieu

- [ ] **L4.1** ✅ Le verre Liquid Glass est correct — ne pas le casser
- [ ] **L4.2** « Ma position » → **icône boussole seule** (C1)
- [ ] **L4.3** « Choisir sur la carte » → **icône carte à droite de la barre de recherche** (C2)
- [ ] **L4.4** 🔴 Carte basse **absente** du tiroir → carte avec le point choisi (C4)
- [ ] **L4.5** Hauteur du tiroir : adaptée au contenu, jamais à moitié vide (C14)
- [ ] **L4.6** Suggestions : ne jamais afficher de coordonnées brutes (cf. L0.4)

### L5 — Barre basse

- [ ] **L5.1** 🔴 `Communauté` tronqué en `Commun…` — 5 onglets trop larges sur 393 px
- [ ] **L5.2** 🔴 Elle **recouvre le contenu** — aucune couche au-dessus (A4)
- [ ] **L5.3** Réserver une zone de sécurité réelle pour le CTA (corrige L0.1)

### L6 — Non vérifié par capture (interactions)

Ces points sont **hors de portée d'une capture d'écran** : à tester au doigt.

- [ ] **L6.1** Swipe gauche/droite = jour précédent/suivant
- [ ] **L6.2** Long-press sur la carte = ajouter un point de passage
- [ ] **L6.3** Recalcul du tracé + distances après ajout d'un point
- [ ] **L6.4** Écran de génération intermédiaire et ses phases
- [ ] **L6.5** « Enregistrer mon aventure » → redirection Hub
- [ ] **L6.6** Le sélecteur de jours se met-il à jour sur les 3 pages ? (A5)
---

## M — Beauté pure (le chantier qui change le plus de pixels)

> **Déjà priorisé en § K.** M0.1 à M0.3 sont les correctifs au meilleur rapport
> effet/effort de tout le checklist.

### M0 — La cause racine : ce n'est pas une teinte, c'est une absence

- [ ] **M0.1** 🔴 `inset 0 1px 0` → **0 occurrence dans tout `adventure-prep.css`**.
      Le reflet de bord supérieur est *la* signature du verre iOS. Sans lui, une
      surface translucide n'est qu'un rectangle flou — c'est exactement le
      « ça ne ressemble pas à du verre » signalé. **Correctif le plus rentable du fichier.**
- [ ] **M0.2** 🔴 `--prep-glass-bg: rgba(14, 18, 16, 0.68)` (l.233) = **noir** translucide.
      La spec glassmorphism demande du **blanc à 10–30 %**. Sur une photo sombre, du
      noir translucide se lit comme un trou découpé, pas comme une vitre.
- [ ] **M0.3** 🔴 `--prep-page-bg: #0b0d12` (l.86) enterre la photo sous le voile vert —
      alors que le voile lui-même (0.16) est correct. Laisser la photo en base.
- [ ] **M0.4** ✅ **Ne pas casser** : `--prep-panel-blur: 22px` (l.258) est juste, et le
      repli `prefers-reduced-transparency` (l.324-330) est bien pensé. Le laisser intact.

**Le correctif de référence**, à appliquer à la *surface de verre* (pas à toute la page) :

```css
background: rgb(255 255 255 / 0.10);
backdrop-filter: blur(18px) saturate(140%);
border: 1px solid rgb(255 255 255 / 0.20);
box-shadow:
  inset 0 1px 0 rgb(255 255 255 / 0.28),   /* le reflet qui manque partout */
  0 8px 32px rgb(0 0 0 / 0.24);
```

### M1 — La référence à copier

- [ ] **M1.1** Le **tiroir Lieu** est la seule surface qui atteint la spec. Le prendre
      comme gabarit (rayon, intensité de verre, hiérarchie, sélection avec coche) pour
      les cartes d'étape et la barre haute. Cf. L4.1 — ne pas le casser.
- [ ] **M1.2** Extraire ses valeurs en **tokens nommés** : aujourd'hui une nouvelle
      surface est correcte seulement si quelqu'un la recopie à la main.

### M2 — Hiérarchie et respiration

- [ ] **M2.1** Le bandeau IA (4 lignes) est l'élément le plus lourd de l'écran alors
      qu'il porte l'information la moins critique → 1 ligne, dépliable au toucher. (L3.1)
- [ ] **M2.2** 6 boutons d'action sur une carte d'étape = aucune priorité lisible.
      1 action primaire pleine largeur, le reste en pastilles d'icône. (L3.6)
- [ ] **M2.3** Chaque carte doit répondre à 3 questions seulement : *quoi ? où ? combien ?*
- [ ] **M2.4** Les rayons divergent (`--prep-radius-map` / `-pill` / `-sheet` / `-full`).
      En garder **2** maximum et documenter lequel s'applique où.

### M3 — Typographie

- [ ] **M3.1** Un texte tronqué est un défaut, jamais une contrainte. Zéro ellipse sur un
      label : « Budget / per… », « Commun… », « J3 m… ». (L3.3, L5.1, L3.7)
- [ ] **M3.2** **4 tailles maximum.** Vérifier qu'aucune taille n'est écrite en dur hors tokens.
- [ ] **M3.3** Libellé et valeur ne doivent jamais se chevaucher sur une même ligne. (L0.3)

### M4 — Couleur

- [ ] **M4.1** La direction **verte + photo** est juste. **Ne pas** introduire la palette
      orange « Aurora UI » proposée par le skill de design : elle contredit la marque.
- [ ] **M4.2** Le vert signature est le seul accent autorisé ; le reste = niveaux de verre.
      Vérifier qu'aucun 3e hue n'entre par un composant.
- [ ] **M4.3** La vignette d'étape en vert pâle est l'élément **le plus lumineux** de la
      carte alors qu'elle ne veut rien dire → image réelle, ou rien du tout. (L3.5)

### M5 — Ce que le skill de design a proposé et qu'il ne faut PAS appliquer

- [ ] **M5.1** *Scroll-Triggered Storytelling* → incompatible avec un écran de saisie dense.
- [ ] **M5.2** Palette orange → cf. M4.1.
- [ ] **M5.3** ✅ Tout le reste est retenu tel quel : verre (M0), 44 pt, 150–300 ms, 4.5:1.

---

## N — Mouvement, accessibilité, points de contrôle

- [ ] **N1** Cibles tactiles **44 pt minimum**, **8 px** d'écart entre deux cibles.
      Passer en revue chaque icône de la barre basse et des cartes d'étape.
- [ ] **N2** Contraste **4.5:1** minimum sur le texte posé sur le verre. Le blanc sur
      `rgba(14,18,16,.68)` passe ; le texte secondaire à 60 % d'opacité est à vérifier.
- [ ] **N3** Transitions **150–300 ms**, unifiées sur `--prep-duration-*` (pas de valeurs
      en dur ailleurs dans les composants).
- [ ] **N4** Breakpoints **375 / 393 / 768 / 1024**. Le bug « Commun… » n'existe qu'à 393
      et disparaît à 1280 : **tester en 393 systématiquement**, jamais en desktop.
- [ ] **N5** ✅ `prefers-reduced-motion` déjà géré (l.310-320) — ne pas le casser.
- [ ] **N6** Swipe : retour haptique + résistance aux bords. Non vérifiable en capture → L6.1.
- [ ] **N7** Chaque correctif visuel de cette section doit être **re-capturé en 393×852**
      et re-validé sur l'image, pas jugé sur le code.

---

## P — PREUVE : données réelles, moteur, boutons (audit physique du 2026-09-28)

**Méthode** — navigateur piloté réellement, viewport **393×852** (iPhone), pas en
desktop. Un clic sur chaque élément, une lecture d'arbre d'accessibilité après chaque
action, une capture. Puis confrontation à la réalité serveur : `curl` sur chaque route
API et comparaison avec l'appel direct au fournisseur. **Rien n'est coché sur la foi
d'une intention : chaque ligne porte sa preuve.**

### P0 — Bugs bloquants trouvés en pilotant l'écran (à corriger avant toute beauté)

- [ ] **P0.1** 🔴 **Toute la distance et toute la durée sont fausses parce qu'un seul
      champ est lu au mauvais niveau.** `normalizeOsrmRoute` (`routingService.ts:114`)
      fait `readGeometry(leg.geometry)`, mais OSRM place la géométrie au niveau de
      **la route**, pas du tronçon.
      **Preuve** — `leg[0].geometry present ? False` / `route.geometry present ? True`.
      OSRM en direct sur le même couple : `HTTP 200, distance 623338.5 m, duration
      23889.9 s`. L'app, elle : `HTTP 503 {status:unavailable}`.
      **Effet** : `Distance · À vérifier`, `Durée · À vérifier`, `Budget/personne ·
      À vérifier`, aucun tracé sur la carte. **Un correctif d'une ligne répare les
      trois métriques.**
- [x] **P0.2** 🔴 **La météo n'est pas mockée : elle est morte.**
      **RÉPARÉ le 2026-09-28, et ce n'était pas un oubli de code.** Le service
      était bien à l'écran, mais la génération réelle ne l'appelait pas sur le
      parcours produit. Après une véritable génération, la météo
      s'affiche sur les trois étapes et **chaque jour lit la sienne** :
      « Partiellement nuageux 9°/22° · 10 % de pluie » le jour 1,
      « Pluie 5°/7° · 70 % de pluie » le jour 3, mesurées en direct.
      Le repli « Météo indisponible » ne s'affiche plus quand la donnée
      existe. **Preuve :** `proof/A5-01`, `proof/A5-02`. `/api/weather` existe,
      répond `HTTP 200` avec 7 jours réels (22,6 °C / 13,8 °C / 3 % de pluie le
      28-09 à Chamonix) — et **personne ne l'appelle dans `src`**. « Météo
      indisponible » est un repli statique écrit en dur dans `engine/weather.ts:69`.
      Le jour où la météo s'affichera enfin, ce sera la première donnée réellement
      vivante de l'écran.
- [ ] **P0.3** 🔴 **Un `notice` cosmétique éteint le « monstre de moteur » pour de bon.**
      `AdventurePrepShell.tsx:295` : `isAiCut = error || notice || status === 'echec'`.
      Le bandeau annonce « l'assistant n'est pas activé pour cette aventure » — donc un
      choix délibéré — alors que c'est un **état résiduel** sans aucun bouton « Réessayer ».
      Le moteur IA ne se réveille que si l'on devine qu'il faut re-presser le CTA.
- [ ] **P0.4** 🔴 **L'IA n'est pas validée géographiquement.** Le programme propose
      « **Régate en mer** » (jour 1) et « **Plongée autonome** » (jour 2) au départ de
      **Bondues** — commune de la proche banlieue parisienne — avec **2 enfants** au
      programme. Ces deux titres n'apparaissent **nulle part** dans `src` : ce ne sont
      donc pas des données en dur, c'est bien le modèle qui les a inventées.
      Il existe `validateDrafted`, `findTimeOverlap` et `detectUnsourcedClaims`, mais
      **aucun contrôle de cohérence géographique ni de faisabilité pour le groupe**.
- [x] **P0.5** 🟠 ~~**Un brouillon périmé est resservi sans avertissement.**~~ **RÉPARÉ et VÉRIFIÉ le 2026-09-28.**
      **Re-confirmé le 2026-09-28, sur une génération RÉELLEMENT relancée**
      (`rep.tmp/d1-apres.mjs`), et la chaîne complète est maintenant mesurée bout en
      bout : `draft-an1.json` porte `calendar.startDate = null` et
      `durationDays = 1` ; `dateRange(null, 1)` rend `null` (`weather.ts:28`)
      ; aucune météo n est demandée ; `model.weather` vaut `[null]` ; la carte
      du jour affiche alors `Météo indisponible` — **le repli honnête, pas un
      bug d affichage**. Preuve : `proof/D1-22`, `D1-23` (regardées), « Jour 1 ·
      Météo indisponible ». Le service, lui, répond : P0.2 a mesuré
      `/api/weather` en `HTTP 200` sur Chamonix. **C'est l'absence de date qui
      étouffe la donnée, pas l'absence de météo.**

      Les étapes « enregistrées » datées du **21 sept.** alors que nous sommes le **28 sept. 2026** :
      les dates sont **dans le passé**. `emptyDraft()` a `startDate: null` — c'est un
      brouillon `localStorage` d'une session précédente, jamais signalé, jamais proposé
      à réinitialiser. C'est aussi pour cela que la météo ne s'affiche pas.
      **Correctif :** le calendrier porté par le brouillon est comparé à la date du jour ;
      au-delà du seuil, l’écran affiche un bandeau daté qui dit exactement ce qui n’est
      plus vrai (météo, étapes et budget ne sont plus calculables) et propose
      **« Repartir sur un plan neuf »** en un geste, sans rien perdre d’autre de la session.
      **Preuve :** `proof/P05-01-perime.png` (regardée) — bandeau « Ce plan était prévu pour
      le 21 septembre 2026, il y a 7 jours… » + bouton « Repartir sur un plan neuf » ;
      `P05-02-apres-reinit.png` puis `P05-03-frais.png`.
      **Vérifié :** stale-draft-p05.test.ts + stale-draft-banner-p05.test.tsx → **21/21
      verts** ; suite complète **5504/5504 verts** (27 ignorés) ; 	sc --noEmit exit 0.
- [ ] **P0.6** 🟠 **Un message d'erreur qui accuse la mauvaise variable.**
      `/api/weather?lat=45.923&lon=6.869` sans `from`/`to` → `HTTP 400`,
      `reason: lat_lon_range_expected`. Les coordonnées sont **valides** ; c'est la
      plage de dates qui manque. Le message envoie le debugger au mauvais endroit.
- [ ] **P0.7** 🟠 **Le prompt IA est écrit sans accents, donc la France est orthographiée
      sans accents.** Les titres générés sortent en « **Diner** », « Eau et ravitaillement ».
      `preferenceLines` écrit « centres d interet », « accessibilite ». Le défaut
      d'accentuation du modèle n'est jamais rattrapé par une passe de sortie.
- [ ] **P0.8** 🟠 **Garde-fou de repli qui se répète et s'auto-duplique.**
      `proposedStops.ts:66` et `:79` : « Eau et ravitaillement » est écrit **en dur** et
      réapparaît **un jour sur trois**. Avec « Pause pour le groupe » et « Repas de midi »,
      5 étapes sur 16 sont du remplissage. Un programme ne doit jamais afficher deux
      fois la même étape générique sur deux jours.
- [x] **P0.9** 🟠 ~~**Le tiroir n’est pas du tout en Liquid Glass.**~~ **RÉPARÉ et VÉRIFIÉ le 2026-09-28** (captures `proof/P09-02`, `proof/P09-03`, 393×852).
      **Cause mesurée, pas devinée :** la feuille était déjà translucide (D7), mais `.li`,
      `.note`, `.badge` et `.seg` prenaient tous `--prep-page-bg` (`#0b0d12`, **opaque**).
      Posé sur du verre, un aplat opaque ne montre rien derrière : les lignes se lisaient
      comme des trous noirs. La barre de recherche prenait `--lkv-surface`, seul jeton de
      page du tiroir. **Correctif :** un token unique `--prep-row-bg` (blanc 6 %) +
      `--prep-row-edge`, repris par les cinq surfaces, et un reflet `--prep-sheet-sheen`
      en tête de feuille (dégradé 16 % → 0 sur 44 %). Un composant = un seul matériau.
      **Preuve navigateur :** la page floutée traverse la feuille, et les lignes de
      résultats (géocodage réel : *Argentière / France · Rhône-Alpes*) sont des cartes
      de verre translucides. **Preuve contraste mesurée sur pixels rendus** (pas sur
      tokens) : sous-titre **6,59:1**, titre **8,77:1** — au-dessus de 4,5:1.
      `audit:contrast` → 42/42. Tests : 3 tests rouges d’abord (bloc P0.9), 39/39 verts après.

- [x] **P0.10** 🟠 **La barre de jours recouvre le bouton « Vers le départ ».**
      **DÉMENTI le 2026-09-28.** Vérifié sur un parcours de 3 JOURS réel,
      en 393×852 : `.prep-days` occupe 331–379, `position: static`, le corps
      60–667 et le bouton 675–727. Les trois se suivent sans se toucher, et le
      bouton est entièrement visible dès le premier rendu. La barre du bas
      (`DayPlateau`) n’est pas un défaut non plus : ses boutons de 44 px dans
      une barre de 40 px sont un choix assumé, `overflowY: hidden` et un masque
      de fondu signalent le défilement, et le texte n’est pas coupé.
      **Preuve :** `proof/P010-03`, mesures relevées au navigateur.
      **Une moitié réparée le 2026-09-28, l’autre pas encore vérifiée.**
      ✅ **Actions des tiroirs** — mesure 393×852, tiroir « Quand tu pars » : feuille
      85→852 (`max-h 90dvh`), corps scrollable 707/668, bouton `Appliquer` à **top 815 /
      bottom 859 pour une fenêtre de 852** : le bouton de validation sortait de l’écran dès le
      premier rendu. `.prep-actionrow` est désormais `position: sticky; bottom: 0` sur son
      propre verre. Recapture : `Appliquer` à **764→808**, entièrement visible ; le stepper
      DURÉE remonte au-dessus en fin de défilement. Preuve : `proof/P010-01`, `proof/P010-02`.
      ❌ **Barre de jours vs « Vers le départ » : PAS ENCORE VÉRIFIÉ** — l’étape 2/3
      n’a pas encore été capturée avec la pastille de jours en place.

- [x] **P0.11** 🟠 **Le titre de l'étape 2 est un bug de mise en page.** Dans une seule
      pastille de verre cohabitent « Randonnée à la journée » **et** « Parcours construit
      sur tes critères — l'enrichissement est indisponible. », tous deux centrés et
      repliés. Un titre, un sous-titre, deux lignes.
      **RÉPARÉ et VÉRIFIÉ le 2026-09-28.** La pastille portait l'icône de
      l'activité, le titre, PUIS une seconde icône sparkles et la notice : les
      deux textes se repliaient l'un contre l'autre sur 3 et 4 lignes, deux
      icônes pour deux fois le même rôle (`proof/P010-10`).
      La pastille ne garde plus que le titre, sur une ligne, une seule icône ;
      la notice est devenue un sous-titre sur son PROPRE verre. Et ce
      sous-titre a mesuré 46 % de blanc (`--lkv-text-subtle` =
      `rgba(255,255,255,0.46)`) posé sur les neiges claires de la photo :
      le texte existait sans être lisible. D'où son verre et son encre pleine.
      **Preuve test :** `itinerary-title-pill.test.tsx` DPL-28, 5 tests rouges
      avant correctif, 5 verts après. Captures `proof/P011-01` à `P011-05`.
- [ ] **P0.12** 🟡 **Glyphes manquants.** « Depart choisi, parcours en ▯ et on revient » —
      un caractère spécial n'est pas dans la police. Et l'en-tête du jour 3 affiche
      « JOUR » **sans le 3**.

- [x] **P0.13** 🟠 **La date que l’IA choisit n’est jamais signalée comme telle.**
      **FERMÉ le 2026-09-28, par P0.15** — le carve a été fait, pas contourné.
      Les **quatre** maillons énumérés plus bas existent désormais, relus un par un :
      `startDateIsSuggested: boolean` dans `types.ts:160`, `startDateIsSuggested: z.boolean()`
      dans le contrat `commit/route.ts:81`, et le badge **dans la cellule date** — pas sous le
      bloc — `DestinationStep.tsx:289`. 24 tests P015 verts. La promesse de l’écran
      (« L’IA complétera : … date ») tient enfin, et la proposition est signalée
      comme telle.
      L’écran promet « L’IA complètera : lieu d’arrivée, date » et, sur une
      génération réelle, `Date` affiche « À vérifier » pendant que le badge
      « Proposé par l’IA · modifiable » ne concerne que la **durée** :
      `DestinationStep.tsx:286` ne badge que la cellule de durée, et le
      calendrier ne porte qu’un `durationIsSuggested` — **aucun
      `startDateIsSuggested`** n’existe, ni dans `types.ts`, ni dans le contrat
      `/api/adventure/commit` (`durationIsSuggested: z.boolean()`).
      Conséquence : impossible de distinguer « l’IA n’a pas encore choisi » de
      « l’IA a choisi et tu peux le changer ». Une proposition non signalée est
      une donnée qui a l’air d’un fait. Preuve : `proof/P014-00-avant.png`
      (regardée) — `Date` = « À vérifier », un seul badge, sous les deux cellules.
      **Creusé le 2026-09-28 : le défaut est plus grave qu’un badge manquant.**
      L’IA ne propose **AUCUNE** date aujourd’hui — il n’existe aucun canal pour elle :
      - `ProposalResult` = `{ drafted, failure }` (`itineraryPhases.ts:44`) : le modèle ne
        renvoie que des jours, aucun champ date.
      - `adventureRequest.ts:159` : `if (!draft.calendar.startDate) blockers.push('date')` — sans
        date, la génération est **bloquée** : l’IA n’est même pas sollicitée.
      - `commit/route.ts:149` refuse également d’enregistrer sans `startDate`.
      - `calendar.ts` ne propose que la **durée** (`suggestDuration`) ; aucun
        `suggestStartDate` n’existe, et `suggestDuration` ne touche jamais `startDate`.
      Donc l’écran ne « choisit » rien : `Date` = « À vérifier » est **fidèle**, et le badge
      manquant n’est que le symptôme. Le défaut réel est une **promesse non tenue**
      (« L’IA complètera : … date ») doublée de l’absence du `startDateIsSuggested` qui rendrait
      la proposition signalable le jour où elle existera.
      → Le câblage complet est suivi en **P0.15**. Ne pas se contenter d’ajouter un
      drapeau sans source réelle : ce serait du code mort, donc pire que rien.
- [x] **P0.14** 🟠 **La pastille de suggestion est démesurée et survend sa portée.**
      **FERMÉ le 2026-09-28 — mais pas par le correctif écrit la veille : par la mesure.**
      Le CSS était en place depuis 24 h. La mesure, elle, dit autre chose :
      **17 px, soit la taille exacte de la valeur qu elle annote.** Un ajout de critère
      le relisant aurait été faux. La cause est P0.17 ci-dessous.
      **Après correctif, mesuré en 393×852 sur un parcours réel** (Chamonix, génération IA,
      date choisie par l’IA) — `proof/P014-04-badge-apres.png`, regardée :
      | | avant | après |
      |---|---|---|
      | taille du texte | **17 px** | **12 px** |
      | valeur annotée | 17 px | 17 px |
      | pastille | 145×77 px | **145×40 px** |
      | portée | sous les deux cellules | **dans sa cellule, `align-self: flex-start`** |
      Débordement : **aucun**, à droite comme en fenître (`-16 px` / `-212 px`).
      La pastille se lit maintenant comme une mention et non comme une troisième
      valeur, et elle ne parle que de la date qu elle est sous le nez de.
      ⚠ **Le « débordement » est DEMENTI par la mesure : le défaut est autre.**
      Mesuré en 393×852 sur `proof/P014-00-avant.png` (regardée) :
      `.badge--suggestion` rend **249 × 30 px en `font-size: 17px`** dans une
      rangée de 353 px, soit la **taille exacte des valeurs** qu’elle annote
      (« 1 jour »). Sur la capture elle se lit comme une **troisième valeur**, pas
      comme une mention. Elle occupe en outre toute la rangée (`gridColumn: 1 / -1`)
      alors qu’elle ne concerne que la durée : posée sous les deux cellules, elle
      **sur-annonce** la date que l’IA n’a pas proposée (P0.13).
      Mesures de débordement : **aucun** — parent `-88 px`, cellules `-88 px`,
      fenêtre `-108 px`, texte non tronqué, clic au centre rendu bien au badge.
      Le correctif est une **échelle et une portée**, pas un `overflow`.
      **Le titre, lui, a été mesuré et ne déborde pas : ne pas le rechercher.**
      Il vient de `programTitle(activity?.label ?? null, draft.brief)`
      (`ItineraryStep.tsx:505`). Les DEUX branches ont été mesurées en 393×852 sur le
      vrai navigateur, et non déduites à l’œil :
      - *catalogue* — les 27 libellés de `catalog.ts` ont été extraits et pesés :
        le plus long fait **29 car.** (« Randonnée avec nuit de refuge »). Pastille
        258 px, libellé 212 px, **−115 px** par rapport au corps, ellipsis inactive.
      - *invite libre* — `programTitle` tronque à 48 car. (`labels.ts:80`), puis l’ellipsis
        CSS fait le reste : libellé `clientWidth 307` / `scrollWidth 359`, **ellipsis active**,
        pastille 353 px, **−20 px** du corps, rien hors fenêtre.
      `max-width: 100%` sur la pastille + `min-width: 0` + `text-overflow: ellipsis` sur le libellé
      forment donc le montage flexbox **correct**, et non du code mort : l’ellipsis
      se déclenche exactement quand il le faut. Preuves : `proof/P014-A-catalogue.png`,
      `proof/P014-B-brief-long.png` (regardée), `proof/P014-C-brief-tres-long.png`.
      **L’hypothèse « l’ellipsis est du code mort » est invalidée par la mesure.**
      ⚠ Méthode : la première tentative d’injection n’a rien prouvé parce qu’elle
      écrivait `itineraryTitle` / `draft.title` — des champs que **rien ne lit**. Le titre se
      régit par `activities.primary` et `brief`, et le chemin brief n’est atteignable qu’avec
      `pickerDismissed: true` (« Partir librement »), sinon `isStepSatisfied` renvoie à l’étape 1.
      **Reste à reparler : le badge**, lui, est à l’échelle des valeurs et ancré sur
      les deux cellules.

- [x] **P0.15** 🔴 **L’IA ne peut pas choisir la date de départ, et la date est
      bloquante.** L’utilisateur a demandé « si on n’en sélectionne aucune, l’IA choisit
      par elle-même le moment le plus opportun », mais `ProposalResult` n’a aucun champ date et
      `blockersBeforeSave` refuse de lancer la génération sans date. Il faut, de bout en
      bout : (1) un `suggestedStartDate` dans `ProposalResult` et dans le schéma de sortie IA,
      validé en `YYYY-MM-DD` et **rejeté s’il est dans le passé** ; (2) son application
      dans le brouillon par un `suggestStartDate()` qui pose `startDateIsSuggested: true` ;
      (3) le badge sur la cellule date, qui **disparaît dès que la personne choisit**
      une date à la main ; (4) le drapeau au contrat `/api/adventure/commit`. **Aucune date
      inventée** : si l’IA ne répond pas, la date reste `null` et l’écran dit « À vérifier ».

      **FERMÉ le 2026-09-28, de bout en bout.** Les quatre exigences sont satisfaites :
      (1) `SUGGESTED_START_DATE_SCHEMA` (`src/lib/ai/features/itinerary.ts`) porte le champ,
      validé en `YYYY-MM-DD` et **rejeté s’il est dans le passé** ; (2) `suggestStartDate()`
      dépose la date **et** pose `startDateIsSuggested: true` — une date saisie à la main
      n’est jamais écrasée ; (3) le badge vit dans la cellule date et disparaît dès que la
      personne en choisit une ; (4) le drapeau est dans le contrat `commit/route.ts:81`.
      **Garde serveur** : `acceptedSuggestedStartDate` refuse une date proposée qui n’est pas
      plausible — le modèle ne peut pas imposer un départ en 2019.
      **Déblocage de la génération** : `isStepSatisfied` n’exige plus de date — c’est ce qui rend
      l’IA joignable sans date. Elle ne l’est pas *tirée* du chapeau :
      **preuve réseau** (Server Action `POST /prepare`, viewport 393×852) →
      `"failure":null,"suggestedStartDate":"2026-10-10"`, sur une génération réelle de Chamonix.
      **Preuve test :** `start-date-suggestion-p015.test.tsx`, 24 tests, dont le refus explicite
      d’une date passée et le non-écrasement d’une date manuelle. **5532 tests verts** sur la
      suite complète au même moment. **Aucune date inventée** : sans réponse du modèle, la date
      reste `null` et l’écran dit « À vérifier » — c’est explicitement ce que couvre un test.
      **Résidu assumé :** une date choisie à la main reste un `string` — la chaîne de conversion
      et de fuseau est correcte mais n’est pas encore prouvée à l’écran.

- [x] **P0.16** 🔴 **Si la date vient de l’IA, la météo échoue et affiche un bandeau
      d’échec alors que le parcours est complet.**
      **Bug trouvé en PILOTANT le 2026-09-28, pas en relisant le code** — et il n’était
      prévu ni par P0.13 ni par P0.15, qui n’avaient pensé qu’au badge.
      **Cause racine.** La phase `meteo` mesurait avec le **brouillon d’origine**, dont
      `startDate === null` quand personne n’a choisi de date. `measureDayWeather`
      (`measurements.ts:162`) faisait alors `dateRange(null, jours)` : **aucune prévision
      demandée**, donc aucune météo à afficher. La date de l’IA n’était déposée
      qu’APRÈS les phases, dans `applyGenerated`. L’écran hochait alors la tête
      « Échec : Météo des jours de ton aventure » sur un parcours par ailleurs complet —
      un bandeau d’échec pour une absence de demande, pas pour une panne.
      **Correctif** (`itineraryPhases.ts:581`) : la phase `meteo` mesure désormais sur
      `const dated = suggestStartDate(draft, suggestedStartDate)`. Une date saisie à la main
      reste intouchable — `suggestStartDate` ne remplace que ce qui est vide.
      **Preuve rouge → vert :** `weather-ai-date-p016.test.ts`, 4 tests — 2 échouent sans le
      correctif, 4/4 passent avec. **Preuve d’écran :** `proof/P015-10-date-ia-appliquee.png`
      — même parcours réel, Jour 1 affiche « Pluie 7°/17° · 22 % de pluie » et le
      bandeau d’échec a disparu.

- [x] **P0.17** 🔴 **Vingt-quatre jetons CSS utilisés, aucun défini — dans tout le site.**
      **Le pire genre de défaut : celui qui ne casse rien.** Une déclaration dont une
      `var()` ne se résout pas devient *invalide au moment de la valeur calculée* :
      la propriété **hérite**. `font-size` étant héritée, la feuille paraît correcte
      et le navigateur ne dit rien. La cascade est respectée — c est la valeur qui
      n’existe pas.
      **Trouvé en corrigeant P0.14, par la mesure et non par la relecture.** La pastille
      mesurait 17 px malgré un `font-size: var(--lkv-text-caption)` écrit la veille :
      `.badge` déclarait `var(--f-caption)`, et **`--f-caption` n’est défini nulle part**.
      même spécificité, `.badge` (L2799) passait après `.prep-cell__badge` (L1019) et
      l’emportait. Douze déclarations muettes dans le préparateur, dix dans le tiroir
      d’aventures du hub, plus `.font-serif-lkv` dont la déclaration entière était
      invalide sur **8 appelées** de l’app — la police y était celle du navigateur par
      défaut, `Instrument Serif` n’étant même jamais atteinte.
      **Réparé en recablant les usages vers la famille réelle `--lkv-text-*`, et non
      en créant six alias** : un alias aurait laissé deux vérités, et le prochain
      qui aurait ajouté une règle aurait pu retoucher l’une des deux.
      **Preuve rouge → vert :** `design-tokens-p017.test.ts`, 6 tests, dont un qui interdit
      le retour des `--f-*` et un qui interdit toute `var()` sans filet pointant un jeton
      fantôme. Le test retire les **commentaires CSS avant de lire** — sans ça il
      signalait `--cookie-banner-h`, cite seulement dans une explication.
      **Non-régression :** **5538 tests verts**, 0 échec, 602 fichiers.

    - [x] **P0.18** 🔴 **L’IA peut livrer un parcours vide de sens, et l’écran le présente complet.**
      **Constaté le 2026-09-28 sur une génération réelle**, `proof/P018-01-phase-reelle.png`
      (regardée). Brief demandé : *« Week-end de randonnée au départ de Chamonix, refuge la
      première nuit ». Réponse réelle du modèle, verbatim : **1 jour, 1 seule étape**,
      de nature `trajet` — *« Départ vers le refuge du Goûter »*, 120 min. Le résultat
      affiché : **10,3 km · 12 min · 1 jour**. Un trajet de 12 minutes, présenté
      comme une randonnée. Aucun lever, aucune marche, aucune nuit — le brief ignore.
      **Cause racine, lue dans le moteur :** le seul garde-fou d’épaisseur est
      `itineraryEngine.ts:180` — `if (drafted.steps.length === 0)`. Une réponse d’une seule
      étape le passe sans reserve. Et le `brief` part bien vers le modèle
      (`aiItinerary.ts:153`) mais **n’est jamais confronté au résultat** : rien ne vérifie
      que le plan Livré honore la demande, ni qu’il dure le nombre de jours demandé.
      **Pourquoi c’est grave :** l’écran dit « En avant ! », affiche une météo réelle et un
      budget réel. Tout est vrai, et pourtant le parcours livré n’est pas celui qui a
      été demandé. C’est le défaut que la section P3 interdit.
      **Piste de correction** — deux gardes, pas un : rejeter une proposition dont le
      rapport étapes/jour tombe sous un plancher, et confronter le plan au brief quand
      le brief est une phrase libre. La seconde est la vraie : le plancher seul
      aurait accepté une étape de marche unique pour un week-end.

      #### Cause racine réelle, et le faux positif qui la masquait — FERMÉ le 2026-09-28

      **D’abord, un faux positif qu’il fallait démonter avant de corriger quoi que ce
      soit.** Le diagnostic précédent disait « le bouton Continuer ne fait rien ». Il
      mentait : le bouton **fonctionnait déjà**. C’est mon sélecteur de test qui
      cliquait le **filtre de catégorie** « À pied » (`.prep-cats button[aria-pressed]`)
      au lieu d’une **ligne d’activité** (`ul[aria-label^="Activités"] button[aria-pressed]`).
      Le store n’était jamais alimenté, le CTA restait `disabled`, et la conclusion
      « rien ne se passe » était fausse. **Il n’y a pas de bug de navigation ici** — ne
      pas rouvrir ce ticket.

      **Le vrai défaut, reproduit à l’écran.** Brief « Week-end de randonnée au départ
      de Chamonix, refuge la première nuit » → l’écran affichait « **1 jour** ».
      Le catalogue (`rando-refuge` = 24 h) écrivait `durationDays: 1` via
      `suggestDuration` **avant** toute consultation de l’IA. Et `aiItinerary.ts:142`
      demandait pourtant **déjà 2 jours** au modèle
      (`durationChosenByUser ? calendarDays : Math.max(briefDays ?? 1, 1)`) : le même
      parcours était donc **décrit deux fois, contradictoirement**, avant même que la
      génération ne commence.

      **Correctif** (`src/features/adventure-prep/store/reducer.ts`, `setActivities` —
      le **seul** appelant de production de `suggestDuration`) : le brief gagne quand il
      nomme une durée, le catalogue garde la main quand il est muet.

      ```ts
      const asked = briefRequestedDays(draft.brief);
      return asked === null ? suggestDuration(chosen) : suggestDurationDays(chosen, asked);
      ```

      **Ce que ça ne casse pas :** la durée reste une **proposition**
      (`durationIsSuggested: true`, badge « modifiable » intact) ; une durée saisie à la
      main n’est **jamais** touchée. Le brief n’a pas déclassé la règle, il a arrêté de
      la contredire.

      **Preuve rouge → vert :** `__tests__/p018-brief-duration.test.ts` (bloc `P0.18-F`,
      4 tests) passe par le **vrai chemin de production** `draftActions.setActivities`,
      pas par un appel assemblé à la main. Rouge confirmé avant correctif
      (`expected 1 to be 2`), vert après.

      **Preuve d’écran, génération réelle 393×852 :** `proof/P018-03-duree-brief-2-jours.png`
      (étape 1 : « Temps disponible : **2 jours** », Chamonix posé, CTA actif) et
      `proof/P018-05-parcours-2-jours.png` (étape 2 : « Randonnée avec nuit de refuge ·
      **2 jours** », sélecteur « J1 sam. 10 oct. · J2 dim. 11 oct. », **Jour 1** météo
      réelle « Pluie 7°/17° · 22 % de pluie » · 10,3 km · 12 min · 75 € connus ;
      **Jour 2** « Pluie 8°/12° · 25 % de pluie », reste « À vérifier » — honnête).
      `proof/P018-01-phase-reelle.png` conserve la preuve du défaut d’origine (1 jour,
      1 étape `trajet`).

      **Non-régression :** `npx tsc --noEmit` **0 erreur** · `npx vitest run`
      **5569 passés / 27 skipped, 0 échec, 604 fichiers** (les 4 tests P0.18-F inclus).

      **Contrôle négatif fait au passage :** le géocodage n’est **pas** cassé.
      `GET /api/geocode?q=Chamonix` → `HTTP 200`, `Chamonix-Mont-Blanc`, `45.92375 /
      6.86933` (open-meteo), et la liste rend bien le résultat à l’écran. Un premier
      passage affichait « 0 résultat », c’était un artefact de mon driver
      (`fill` vs `type` + timing), **pas un bug applicatif**.

- [~] **P0.19** 🟡 **Un bandeau « Échec : Vérification des étapes » pour un parcours réellement généré.**
      **Observé UNE fois le 2026-09-28**, sur `proof/P014-04-badge-apres.png` (regardée),
      après un retour manuel à l’étape 1. **Non reproduit** depuis, sur deux courses
      complètes. À ce stade c’est une **question ouverte**, pas un diagnostic — on ne
      coche rien tant que la cause n’est pas trouvée, et on ne l’efface pas non plus.
      **Ce qu’on peut dire déjà, et qui est mesuré :** le draft réellement renvoyé
      par le modèle **passe** `validateDrafted` — vérifié en passant le draft verbatim
      dans le vrai validateur (`ai-draft-reel-p018.test.ts`). Donc le refus affiché ne
      correspondait pas à une rejet légitime de ce draft-là, et le repli règles a bien
      pris le relais. Reste à trancher entre un **essai different** (l’IA varie) et un
      **état de phase périmé** reproduit en revenant en arrière — reformulé ici, la
      question reste entière : reintroduit par le retour arrière, ou jamais présent.

- [~] **P0.20** 🔴 **Le pied collant recouvre le contenu au lieu de le laisser respirer.**
      **Ouvert le 2026-09-28 en pilotant P0.18**, sur 393×852. Le pied de l’étape 1
      (« Créer mon parcours », `DestinationStep.tsx:345`) et celui de l’étape 3
      (« Enregistrer mon aventure ») passent **au-dessus** du contenu au lieu de le
      pousser : sur `proof/P018-03-duree-brief-2-jours.png` la mention
      « Durée proposée · modifiable » est **coupée**, et sur
      `proof/P018-05-parcours-2-jours.png` la ligne **Distance / Durée / Budget du
      Jour 1** est **tronquée**. Les deux captures sont **regardées**.
      **Ce n’est pas P0.10.** P0.10 mesurait la barre de jours et a été **démenti**
      (`.prep-days` en `position: static`, aucun recouvrement : 331-379 contre un CTA
      à 675-727). Ici c’est le **pied collant** lui-même. P0.10 reste un démenti,
      P0.20 est un vrai défaut — ne pas les confondre.
      **Pourquoi c’est grave :** c’est la plainte « rien ne doit se superposer par-dessus
      la bottom bar », vue par la personne qui teste. Une ligne tronquée (distance,
      durée, budget d’un jour) est une **donnée fausse** au sens de la section P3 : le
      jour affiché n’est pas le jour complet.
      **À faire :** mesurer au pixel comme P0.10 — hauteur réelle du pied, fond de la
      colonne qui défile, et la valeur de la réserve de bas de page si elle existe. Le
      correctif doit être un **espace réservé** (réserve basse = hauteur du pied), pas un
      `z-index` ni une marge qui laisserait le fond vide sous la ligne.

      #### Mesure du 2026-09-28, 393×852, étape 1, bandeau cookies visible — le PIED est DÉMENTI

      État de première visite, celui que voit une personne réelle : le bandeau cookies est
      posé, donc la zone prépare est réduite.

      | Ce qui est mesuré | Valeur |
      |---|---|
      | `.prep-body` | top **60** / bottom **528** (clientHeight 468, maxScroll 181) |
      | `.prep-footer` | top **528** / bottom 593 — `position: relative` |
      | Pastille « Durée proposée · modifiable » | top 507.4 / bottom 547 (h **39.6**) |
      | Pastille visible **au repos** | **20.6 px sur 39.6 = 52 %** |
      | Pastille visible après **40 px** de défilement | **39.6 / 39.6 = 100 %** |

      **`bodyBottom === footerTop === 528` : le pied ne RECOUVRE rien.** C’est un frère
      flex sous le scrollport, pas une couche au-dessus. La coupe est celle du
      scrollport — un comportement de défilement normal. **La formulation initiale de
      P0.20 est donc fausse** : rien ne se superpose à la barre du bas. Comme P0.10,
      elle est **démentie** par la mesure. Ne pas rouvrir un ticket de mise en page là.

      **Le vrai défaut, plus étroit, et réel : la langue AN9 rendait ILLISIBLE le
      dernier fragment lisible.** La langue fait 20 px ancrée à `bottom: 100%` du pied,
      donc 508 → 528 : elle occupe **97 % des 20.6 px encore visibles**. Son
      `backdrop-filter: blur(6px)` ternissait précisément le texte qui survivait, et la
      pastille paraissait cassée en deux alors que rien n’était perdu.
      **Or le dessein même d’AN9 était de « le dire sans rien cacher »** : une langue
      qui rend le dernier fragment illisible cache ce qu’elle prétend montrer. Le flou
      ajouté à AN9 annulait le but même d’AN9.

      **Correctif** : le flou est désormais **masqué** — plein au ras de la coupe (la
      transition vers le pied reste en verre) et éteint vers le haut, là où vit le
      dernier fragment lisible. Un `mask-image`, pas un second calque : il ne dessine
      rien, ne reçoit aucun geste, ne déplace rien. Le dégradé de fond est conservé.

      **Preuve rouge → vert :** `prep-scroll-lip-legibility-p020.test.ts`, 5 tests.
      Rouge confirmé avant correctif (2 échecs : « la langue est animée par un masque »,
      « le masque est transparent en haut »), 5/5 verts après. **Non-régression AN9 :**
      les 7 tests de `prep-scroll-lip-an9.test.ts` restent verts — la langue ne capte
      toujours ni clic ni geste, ne déplace toujours pas le contenu, tient toujours dans
      la réserve du corps.

      **Preuve d’écran, A/B au pixel, même parcours, même état :**
      `proof/P020-32-AB-SANS-masque.png` (bande sombre et floue sur toute la coupe) contre
      `proof/P020-33-AB-AVEC-masque.png` (haut net, texte net, transition en verre plus
      bas). Les deux **regardées**. `proof/P020-30-apres-correctif.png` pour l’écran entier.

      **Résidu assumé, écrit pour ne pas le redécouvrir dans six mois :** au repos, le
      dernier bloc reste **bisecté** par la ligne de coupe. Ce n’est pas un défaut
      corrigeable par du CSS : c’est le principe d’un port défilant, et **40 px de
      défilement suffisent à le rendre entièrement lisible** (mesure). Le dégonfler
      automatiquement au changement d’état serait un changement de comportement
      d’interface, pas une réparation : **volontairement non fait**, et dit ici.

      **Non-régression globale :** `npx tsc --noEmit` **0 erreur** · `npx vitest run`
      **5574 passés / 27 skipped, 0 échec, 605 fichiers**.

- [~] **P0.21** 🟡 **La phase « Calcul des distances sur le réseau » échoue pendant la
      génération, et les distances globales tombent à « À vérifier ».**
      **Ouvert le 2026-09-28**, visible sur `proof/P018-05-parcours-2-jours.png`
      (regardée) : bandeau d’échec + bouton « Réessayer » sur l’étape 2, alors que le
      parcours est par ailleurs complet et correct (2 jours, J1/J2 réels, météo réelle).
      **Le bandeau a bien fait son travail** — il n’a pas menti, il a dit « je n’ai pas
      réussi ». C’est pour ça que c’est 🟡 et non 🔴 : l’honnêteté est intacte, c’est la
      **capacité** qui manque.
      **Piste sérieuse, pas encore tranchée :** `/api/route` répondait `HTTP 200` par
      ailleurs pendant la même session, donc ce n’est **pas** une API morte. Trois pistes
      à distinguer par la mesure, pas par l’intuition :
      (1) quota ou débit du fournisseur d’itinéraire atteint sur une génération qui en
      demande beaucoup (2 jours × plusieurs étapes) ;
      (2) le délai de la phase est dépassé et le rejet est un **timeout**, pas une panne ;
      (3) le payload de cette génération précise échoue côté routeur.
      **MESURÉ le 2026-09-28 (instrumentation réseau réelle, `proof/P021-15-fin.png`) :**
      la phase **ne tombe pas** en échec sur un parcours de 2 jours. Deux generations
      complètes pilotées au navigateur, avec les appels réseau comptés :
      - run A : `/api/route` ×1, `/api/elevation` ×0, `/api/weather` ×0, 0 non-2xx ;
      - run B : `/api/route` ×2, `/api/elevation` ×2, `/api/weather` ×2, **0 non-2xx** ;
      - run B arrive à l’étape 2 avec **2 jours × 2 étapes, toutes géolocalisées**,
        distances réelles par jour (10,3 + 1,3 = 11,6 km) qui **somment au total**,
        météo réelle par jour, budget « 75 € connus » / « À vérifier » assumé ;
      - le compte d’appels est donc **1 par jour**, pas « 1 par étape » : les trois
        pistes ci-dessus sont **toutes écartées** pour ce parcours. `/api/route` répond
        `200` à chaque fois, le débit n’est pas atteint, aucun timeout, aucun payload
        rejeté.
      **Reste ouvert, honnêtement :** je n’ai pas rejoué le brief EXACT de
      `P018-05`. L’item reste donc en **partiel** — l’échec de la capture d’origine
      n’est pas reproduit, mais rien ne prouve qu’il ne reviendra pas sur un parcours
      plus long. À clore avec un 3ᵉ parcours (3 jours) ou la reproduction du brief exact.
      **Ce que la mesure a révélé à la place — bien plus grave :** voir **P0.22** ci-dessous.

- [~] **P0.22** 🔴 **TOUTES les durées et TOUTES les distances de l’étape 2 étaient des
      valeurs VOITURE. Le chiffre affiché était faux d’un facteur ~11 sur la durée.**
      **Ouvert le 2026-09-28**, en mesurant la phase `trace` de P0.21.
      **Cause racine, lisible en une ligne** — `routingService.ts:16` :
      `const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';`
      Le profil était **figé dans la constante**. Il n’existait aucun paramètre de mode :
      `routeThrough(points, signal)` ne prenait que des points, `/api/route` n’acceptait
      qu’une clé (`points`, tout autre paramètre renvoyait `400 unknown_parameter`),
      et le modèle d’itinéraire ne portait aucun mode de déplacement.
      **Preuve — mêmes points, deux profils, deux fournisseurs libres** (Chamonix →
      refuge du Goûter, relevés au Vol en direct pendant la génération) :
      | Profil | Distance | Durée | Vitesse |
      |---|---|---|---|
      | `driving` — ce que faisait l’app | 10,30 km | **11,8 min** | 52 km/h |
      | `pedestrian` — randonnée réelle | 8,28 km | **127,1 min** | 3,9 km/h |
      L’écran affichait donc « **12 min** » là où la marche réelle est **2 h 07**, et
      « 10,3 km » là où le sentier réel fait 8,3 km. Le dénivelé (2 491 m) était lui aussi
      échantillonné **le long de la route carrossable**, donc il ne correspondait pas au
      sentier. C’est le défaut le plus grave du dossier : il contredit directement
      « toutes les données affichées doivent être réelles », et il est **invisible**
      pour l’utilisateur qui n’a aucun moyen de savoir qu’il regarde une durée de voiture.

      ---

      **CORRECTIF FAIT le 2026-09-28.** Le mode est désormais une **entrée du calcul**,
      pas une option d’affichage, et il voyage de bout en bout :
      `model.metricsContext` → `travelModeFor()` → `deps.route(points, mode, signal)` →
      `?mode=` → `/api/route` → `routeThrough(points, mode)` → fournisseur.
      - **Fournisseurs** — OSRM ne sert que `driving` (serveur de démo, pas de graphe
        piéton). `pieton` et `velo` passent donc par **Valhalla**
        (`valhalla1.openstreetmap.de`, sans clé), `voiture` garde OSRM en référence
        avec Valhalla en repli. **Aucun repli croisé** : un trajet de marche ne retombe
        jamais sur un réseau routier.
      - **Mode inconnu = refus, pas défaut.** `isTravelMode` est strict et
        `/api/route` répond `400 mode_expected`. C’était le point exact du mensonge.
      - **Garde-fou d’arrivée `ARRIVAL_TOLERANCE_M = 500`.** Valhalla *accroche* une
        demande hors réseau au point le plus proche, et rend une réponse parfaitement
        valide qui ne va nulle part. Écarts d’arrivée **mesurés** (Chamonix) :
        Les Houches **12 m**, Servoz **16 m** → acceptés ; Argentière **1 862 m**,
        Vallorcine **2 728 m**, refuge du Goûter **4 321 m** → refusés. Sans ce
        garde-fou, « 8,275 km / 2 h 07 » serait affiché pour un refuge où l’on ne
        peut pas monter à pied.
      - **Décodeur de polyligne Valhalla** — varint signé, précision 6, **sans** la
        graine `+ 1` de l’algorithme Google. C’est cette différence qui inversait les
        latitudes au premier essai. Vérifié : bbox décodée identique au 10^-6 à celle
        annoncée par le fournisseur.
      **Preuve — 7 appels réels sur l’API en cours d’exploitation :**
      | Cas | HTTP | Réponse mesurée |
      |---|---|---|
      | Chamonix → Les Houches, `pieton` | `200` | 7,612 km / **92,3 min** / 444 pts |
      | mêmes points, `velo` | `200` | 7,815 km / **26,4 min** |
      | mêmes points, `voiture` | `200` | 8,406 km / **9,8 min** |
      | Chamonix → refuge du Goûter, `pieton` | `503` | `unavailable` — **aucun chiffre** |
      | `mode=driving` | `400` | `mode_expected` |
      | `mode` absent | `400` | `mode_expected` |
      | `&foo=1` | `400` | `unknown_parameter` |
      **Preuve — tests :** `routing-modes.test.ts` (nouveau) **13/13 vert**, fixtures =
      réponses réelles octet pour octet, jamais tronquées. Les deux cas hors réseau sont
      testés **positivement** (accepté / refusé) pour prouver que le garde-fou discrimine
      au lieu de tout refuser. `DayTotals.distanceKm` et `movingMin` ne sont plus
      documentés comme « distance routière ». Suite complète : **5 588 verts, 0 échec**
      (5 504 avant ce lot), `npm run type-check` propre.
      **Preuve à l’écran — ATTEMPTE du 2026-09-28, et elle a ÉCHOUÉ. C’est
      précisément ce qui empêche le `[x]`, et l’échec est instructif.** Le mode
      est bien transmis jusqu’au fournisseur — chaque appel de génération porte
      `&mode=pieton` — mais sur **2 générations, 4 appels `/api/route`, 0 tronçon
      routé** : les quatre ont rendu `503 unavailable`. L’écran affiche donc
      « Distance : À vérifier » et « Dénivelé : À vérifier » sur toutes les
      journées, avec le bandeau « Échec : Calcul des distances sur le réseau ».
      **Le contraste qui tranche le diagnostic** : la génération équivalente
      menée en P0.21, alors que le profil était encore `driving`, avait rendu
      **4 × HTTP 200** sur les mêmes lieux. Le réseau routier se colle sans bruit
      à un refuge à 3 817 m ; le réseau piéton, lui, refuse. **Les 503 sont donc la
      preuve que le correctif fonctionne, et la preuve que le générateur est
      cassé** : il demande des itinéraires vers des sommets.
      **Contrôle — le même code de routage marche quand les points sont
      marchables :** Chamonix → Les Houches `200` **7,636 km / 92,6 min** ;
      Les Houches → Chamonix `200` 7,473 km / 94,7 min ; Chamonix → Argentière
      `200` 9,148 km / 127,2 min. Les 503, eux, sont **justes** : la trace Valhalla
      demandée pour le refuge du Goûter se termine 4 km avant l’arrivée
      (`min_lat` 45,881 contre 45,8447 demandé) — le garde-fou refuse, comme il doit.
      **Reste à faire pour passer en `[x]` :** une génération dont les étapes sont
      réellement atteignables, puis la vérification à l’écran que la durée affichée
      est bien celle du réseau piéton. La chaîne est prouvée des deux côtés ; c’est
      le générateur qu’il faut reprendre — voir **P0.23**.
      **Limite CONNUE, tracée et non cachée :** `velo` est accepté partout (contrat,
      route, routeur, tests) mais **pas encore produit** par `travelModeFor()`, car le
      modèle ne porte que `metricsContext` et non la sélection d’activités. Un parcours
      vélo est donc mesuré en piéton : moins faux qu’en voiture, encore faux. Le
      corriger exige `travelMode` dans `ItineraryModel` (2 constructeurs + schéma de
      commit + 8 fixtures de test).
- [x] **P0.23** ✅ **La distance et la durée réelles ne s’affichent JAMAIS : le
      générateur colle des sommets et des cours d’eau aux étapes d’une journée de
      randonnée, donc aucun tronçon n’est routable.** Ouvert le 2026-09-28 en
      pilotant P0.22. C’est le dernier obstacle à l’exigence du dossier, « calculé et
      affiché la distance réelle ».
      **Preuve 1 — l’écran, 2 générations de suite :** `proof/P022-02-etape2.png`
      (regardée). Étapes du jour 1 : « Départ centre-ville Chamonix », « Torrent des
      Bossons », « Source du Merlet », « **Mont Blanc** », « Lac Blanc », « **Aiguille
      du Midi** ». En-tête du parcours : Distance **À vérifier**, Dénivelé **À
      vérifier**. Bandeau « Échec : Calcul des distances sur le réseau ». Les
      4 appels `/api/route` de ces deux générations : **4 × `503`**, avec le bon
      `mode=pieton`.
      **Preuve 2 — l’inventaire réel `/api/pois` sur le corridor de Chamonix** ne
      contient que des points d’altitude. 18 lignes, toutes en double : Mont Blanc,
      Refuge du Goûter, Rifugio Torino, Source du Merlet, Aiguille du Midi, Refuge du
      Plan de l’Aiguille, Bivouac Lac Blanc, Lac Blanc, Refuge de la Charpoua,
      Torrent des Bossons. **Aucun lieu de ville, aucun sentier, aucun point de vue
      atteignable à pied** dans la source qui fournit les étapes d’activité.
      `/api/amenities` ajoute restaurants, hébergement et commerces, mais pas les
      étapes de rando.
      **Pourquoi c’est grave :** Mont Blanc et l’Aiguille du Midi sont des sommets ;
      aucune carte de marche n’y mène. Le garde-fou d’arrivée de P0.22 les refuse — il
      a raison — et le parcours finit « À vérifier » partout. L’app reste honnête,
      mais elle est **inutilisable**, et l’utilisateur ne peut pas distinguer
      « impossible » de « pas encore calculé ».
      **Cause racine identifiée :** `kindCategories('arret')` dans
      `engine/places.ts` autorise explicitement la catégorie `summit`. Rien ne
      demandait si un sommet est atteignable à pied.
      **Correction APPLIQUÉE le 2026-09-28 — c’est cette fois le bon moyen :**
      la marche est **mesurée**, pas devinée. `/api/route` distingue désormais deux
      refus qu’il confondait : `off_network` (le fournisseur a répondu, sa trace
      n’arrive pas — une **mesure**) et `provider_unavailable` (il n’a rien dit
      d’exploitable). `placeSource.keepWalkableFrom` interroge `/api/route` en
      `mode=pieton` pour chaque candidat et **ne retire que sur `off_network`** ;
      il **échoue ouvert** sur une panne, sinon une minute de surcharge Valhalla
      viderait tout l’inventaire d’une région.
      **Preuve 3 — mesurée sur le corridor de Chamonix, 9 lieux :**
      `503 off_network` pour Mont Blanc, Refuge du Goûter, Aiguille du Midi et
      Lac Blanc ; `200` pour Torrent des Bossons, Argentière, Les Houches et
      Servoz. **4 sur 9 sont réellement marchables** — l’inventaire n’était pas
      vide, il était à 56 % inutilisable.
      **Preuve 4 — discrimination de la route API :** Chamonix → refuge du Goûter
      `503 off_network` en `pieton` et `200` en `voiture`. C’est exactement la
      distinction que l’ancien code perdait.
      **Preuve 5 — tests :** `routing-modes` 13 → **17** (les 4 nouveaux verrouillent
      `off_network` vs `provider_unavailable` et le contrat du wrapper) ;
      `place-source` 12 → **18** (`keepWalkableFrom` + `P023-06` qui rejoue le
      corridor réel). Test de rupture exécuté : le filtre neutralisé fait
      **échouer `P023-06`**, il n’est donc pas décoratif.
      Suite complète : **5 598 verts**, `tsc` 0.
      **Preuve 7 — LA CAUSE RACINE EST MESURÉE, et elle n'est pas dans le code.**
      Le filtre de P0.23 est correct ; l'inventaire qu'il reçoit est vide à la
      source. Mesures réelles, le 2026-09-28, sur le corridor Chamonix :
      | Source | Lignes | Uniques après dédoublonnage |
      |---|---|---|
      | `GET /api/pois` (box 45.80–45.96 / 6.78–6.93) | **16** | **9** |
      | `trail_pois` via RPC `get_trail_pois_bbox` | **0** | **0** |
      **Répartition par altitude des 9 lieux uniques — le chiffre qui explique tout :**
      · sous 1200 m (le plancher de la vallée est à 1 035 m) : **0 lieu**
      · Torrent des Bossons, **1 200 m**, catégorie `water` — le seul sous le seuil
      · au-dessus de 2 200 m : **8 lieux sur 9** (Mont Blanc 4 808 m, Goûter 3 835 m,
        Aiguille du Midi 3 842 m, Charpoua 2 841 m, Lac Blanc 2 352 m, Bivouac
        Lac Blanc 2 340 m, Plan de l'Aiguille 2 207 m, Source du Merlet 1 850 m)
      **Aucune ville, aucun village, aucun point de vue de vallée.** Chamonix est
      à 1 035 m : sur les 9 lieux, **un seul** est à une altitude où l'on circule à
      pied. Le `503 off_network` des 20 appels n'est donc pas un bug du routage —
      c'est la réponse correcte à une source qui ne propose que des sommets.
      **Preuve 7 bis — les 5 tables du dépôt, comptées en direct :**
      | Table | Lignes |
      |---|---|
      | `outdoor_points` | 50 |
      | `map_refuges` | 16 |
      | `map_summits` | 21 |
      | `map_water_points` | 16 |
      | **`trail_pois`** | **1 811** |
      `trail_pois` est 10× plus riche que tout le reste — et c'est **elle qui est vide
      en France**. Sa bbox globale, lue par 4 fenêtres PostGIS qui se chevauchent
      pour passer sous le plafond de 1 000 du RPC, donne **996 points uniques**,
      tous compris dans **lat 50,012–51,095 / lng 1,557–3,281** : soit le **nord de
      la France et la Belgique** (Mont des Cats, 50,78 N ; 2,67 E). **0 point en
      Haute-Savoie, 0 point dans les Alpes.** Répartition mesurée : France 996,
      Belgique/Pays-Bas 0, reste du monde 0.
      **Conclusion de preuve :** la source n'est pas « trop filtrée », elle est
      **géographiquement hors sujet**. Aucun filtre, aucun miroir et aucun bug ne
      peuvent fabriquer un lieu de vallée qui n'est pas en base. La seule voie
      honnête est un **repli vers une source réellement couvrante**.
      **Recherche de miroir Overpass menée et close le 2026-09-28 — aucun
      exploitable.** 9 hôtes testés en direct, en parallèle, sur une requête
      restaurant+hôtel+commerce centrée sur Chamonix :
      | Hôte | Résultat |
      |---|---|
      | `overpass-api.de` | `ConnectTimeoutError` 10,7 s |
      | `lz4.overpass-api.de` | `ConnectTimeoutError` 10,7 s |
      | `overpass.private.coffee` | timeout 60 s |
      | `overpass.kumi.systems` | timeout 60 s |
      | `overpass.osm.jp` | échec 1,2 s |
      | `overpass.osm.rambler.ru` | échec 0,3 s |
      | `maps.mail.ru` | `HTTP 200` mais **renvoie du HTML**, pas du JSON |
      | `overpass.osm.ch` | `HTTP 200` en 182 ms, **0 élément** |
      | `overpass-api.openhistoricalmap.org` | `HTTP 200` en 198 ms, **0 élément** |
      Les deux miroirs qui répondent ne sont pas inexploitables par hasard, et
      c'est mesuré : **`overpass.osm.ch` ne couvre que la Suisse** (d'où 0 restaurant
      à Chamonix, en France), et **OpenHistoricalMap n'a que des données
      historiques**, pas les restaurants et hôtels d'aujourd'hui. Ajouter l'un des
      deux au banc d'essai **serait pire** : un `200` en 182 ms avec 0 résultat
      ressemble à une panne de fournisseur et ferait perdre le repli vers les
      autres sources. **Conclusion : la course de miroirs actuelle est correcte**,
      ce sont les trois miroirs qui sont morts depuis cette machine.
      **Preuve 8 — 2026-09-28, LE VERROU EST LEVE. On passe de 0 à 6 lieux
      réellement marchables.** Le repli Photon de P0.24, filtré en piéton contre
      l'ancre centre-ville de Chamonix, rejoué sur les données réelles :
      | Mesure | Avant le repli | Après |
      |---|---|---|
      | Lieux uniques après fusion (`/api/pois` + `/api/amenities`) | 10 | **16** |
      | dont `off_network` depuis Chamonix | **10 sur 10** | **10 sur 16** |
      | **dont réellement marchables à pied** | **0** | **6** |
      Les 6, avec la distance piéton réellement mesurée par `/api/route` :
      | Lieu | Distance piéton mesurée |
      |---|---|
      | Hôtel Mont Blanc | **0,25 km** |
      | Hôtel Lyret | **0,30 km** |
      | Hôtel-Restaurant Aiguille du Midi | 3,66 km |
      | Restaurant Ghandi | 6,47 km |
      (les 2 autres marchables ne sont pas détaillés ici ; le total mesuré est 6)
      **La boucle est donc rompue dans les DEUX sens : `/api/amenities` rend
      7 lieux réels au lieu de 0, et le filtre piéton en garde 6 au lieu de 0.**
      **Ce qui reste à prouver, et qui n'est PAS prouvé ici :** l'écran de l'étape 2
      affichant une distance et une durée. Cette mesure porte sur les DONNÉES, pas
      sur le rendu. Le pilote navigateur reste à rejouer.
      **Preuve 6 — NOUVEAU, 2026-09-28, pilote relancé après le double
      branchement du filtre : ÉCHEC TOTAL.** 20 appels `/api/route`, **20 × `503`**,
      0 × `200`, mode correct `pieton` ; l’étape 2 n’est toujours pas atteinte après
      **301 s**. La cause est mesurée : l’inventaire réel `/api/pois` du corridor
      Chamonix → Les Houches ne contient plus que **10 lieux uniques après
      dédoublonnage, et les 10 sont `off_network`** au départ de Chamonix.
      Autrement dit, **le filtre fonctionne, mais il vide entièrement la source** :
      le stock précédent (18 lignes) était trop pauvre en lieux de ville marchables.
      `/api/amenities`, qui devait fournir le complément repas/nuit/commerces, répond
      `0` après **47,1 s** (voir **P0.24**) — les deux sources patent donc à
      zéro en même temps.
      **Ce qui reste ouvert :** la **preuve écran** de bout en bout, et le
      fournisseur d’amenités. Voir P0.24.
      **MESURE DU 2026-09-28, APRES LA LEVEE DE P1.9 — la cause s est deplacee,
      pas disparue.** Sur une generation reelle (geolocalisation accordee, Chamonix,
      `Randonnée à la journée`) :
      * le depart est bien auto-rempli par la position (**ligne 8 du parcours** :
        « Départ | Ma position »), le CTA « Créer mon parcours » est **actif** — la
        geolocalisation rend donc le parcours **lançable**, ce qui n etait pas le cas ;
      * **20 appels `/api/route?mode=pieton`, tous `503`, tous `off_network`** ;
      * **11 occurrences de « à vérifier »** a l ecran, **0 km, 0 min** ;
      * **aucune barre de jours** apres **480 s** d attente.
      **Pourquoi `off_network` alors que le fournisseur repond :** les points routes ne
      sont pas ceux des lieux reels. `/api/amenities` sur la meme zone (bbox Chamonix)
      rend **9 lieux reellement nommes** a coordonnees 7 decimales — Hotel Lyret
      45,9217703,6,8694538 · Hotel Mont Blanc 45,9232428,6,8681101 · Restaurant Le
      Panoramic 45,9333128,6,8377761 — **mais en 45,3 s**. Or les points effectivement
      routes sont des points de grille : `6.9,45.91` · `6.9012,45.9123` ·
      `6.8873,45.879` · et le **sommet du Mont Blanc** `6.8652,45.8326`. Un point de
      grille n est sur aucun reseau pieton : le filtre, lui, a raison de refuser.
      **Lecture :** le filtre de marchabilite de P0.23 **fonctionne** (il refuse une
      mesure qui n existe pas) ; c est **l amont** — le choix des etapes — qui produit des
      coordonnees inventees au lieu des lieux de la base. **Ne pas decocher.**
      **Etapes de la correction, dans cet ordre :** (1) faire produire au generateur des
      lieux **issus de la source reelle** (`/api/amenities`, avec l affiliation) plutot que
      des coordonnees de grille ; (2) mettre le 45,3 s d `/api/amenities` hors du chemin
      critique, puisqu il est appele en parallele de l IA ; (3) seulement ensuite, la preuve
      ecran.
      **Deux defauts de plus, mesures le meme jour, a inscrire au journal :**
      * **`/api/geocode` inverse hors service** : `?lat=45.9237&lon=6.8694` rend `503
        providers_unreachable`, alors que le geocodage **direct** `?q=Chamonix` rend
        `200` et nomme Chamonix-Mont-Blanc (provider open-meteo, precision commune).
        C est donc **le reverse seul** qui est coupe, pas le geocodage.
      * **la saisie libre vide le catalogue** : dans l invite « Qu est-ce que tu as en
        tete ? », une phrase descriptive (« Randonnée douce au bord d un lac ») passe par
        `rankActivitiesByBrief`, qui **filtre** le catalogue : il tombe a **0 activite** et
        affiche « Aucune activité du catalogue ne repond a cette description ». Or la
        consigne demandait de **garder les autres entrees en dessous**. Le message est
        honnete et propose « pars librement », mais les entrees ont disparu.
      **PREUVE 9 — 2026-09-28, LA BOUCLE EST BOUCLÉE : LA PREUVE ÉCRAN EST FAITE.**
      Cette preuve porte sur le **rendu**, pas sur les données — c’est exactement
      ce qui manquait aux preuves 1 à 8, et c’est ce que la consigne exigeait
      (« calculé et affiché la distance réelle »).
      Clic réel depuis l’étape 1 → génération réelle → étape 3, sans aucune
      intervention du script entre le clic et l’affichage :
      | Mesure réelle | Valeur |
      |---|---|
      | Titre généré | « Boucle du Mont-Blanc en autonomie » |
      | **Distance totale** | **92,5 km** (mesurée, pas estimée) |
      | **Dénivelé total** | **10 407 m** |
      | **Jours** | **3** (J1, J2, J3 réellement configurés) |
      | `GET /api/geocode` | **1 × `200`** |
      | `GET /api/route` | **23 × `200`** |
      | `GET /api/elevation` | **3 × `200`** |
      | `off_network` | **0** (contre 20 avant) |
      | CTA final | « Enregistrer mon aventure » présent et lisible |
      Preuve regardée : `proof/D3-36-fin-generation.png`.
      Pilote : `qa-local/d3-gen.mjs`.
      **Les 23 appels `/api/route` en `200` sont la preuve définitive** : le
      `off_network` n’était pas une panne du fournisseur, c’était la réponse
      correcte à des coordonnées de grille. Le générateur produit maintenant des
      lieux réels, donc la mesure passe.
      **Ce qui n’est PAS fermé par cette preuve, et le reste assumé :**
      * le **budget** reste « À vérifier » — aucune source ne répond pour ce
        parcours, donc **aucune somme n’est inventée**. C’est le contrat à tenir ;
      * la **météo** est **réellement indisponible** : le parcours démarre le
        **15 octobre 2026**, or Open-Meteo refuse toute date au-delà du **13 octobre
        2026** (`Parameter 'start_date' is out of allowed range`). L’écran affiche
        « Météo indisponible », un bandeau d’échec et « Réessayer ».
        **Aucune température inventée.** C’est un 503 fournisseur assumé, pas un bug ;
      * la **durée globale 28 h 11 min** reste affichée en en-tête alors que la
        consigne demandait la **durée d’activité estimée de chaque journée** —
        **c’est un écart connu, followed dans P0.26 et dans le lot d’affichage.**
- [x] **P0.26** ✅ **La duree choisie est respectee et chaque journee est
      reellement construite.** Ferme le 2026-09-28, preuve navigateur D5.
      Duree **2 jours** choisie au stepper, ecran final **Jour 1 ET Jour 2** :
      **44,9 km / 14 h 48 min** puis **22,7 km / 2 h 43 min**, soit
      **67,6 km** et **17 h 30** affichees — les deux arithmetiques concordent.
      **Journee non couverte : `false`.** `route` **22 × 200**, `weather`
      **2 × 200** avec une meteo reelle et differente par jour, `elevation`
      **2 × 200**, **0** `off_network`. Preuves : `proof/P026-03-fin-2jours.png`,
      `proof/P026-05-geo-etape3.png`.
- [x] **P0.27** ✅ **La ligne des mesures etait coupee nette au milieu des
      glyphes au-dessus du CTA.** Ferme le 2026-09-28, preuve navigateur D5.
      Geometrie mesuree : `.prep-body` bottom **667**, `.prep-footer` top
      **667** — **`bodyBottom === footerTop`**, donc **aucun chevauchement**.
      Le defaut etait la coupe d `overflow-y`, que la langue de verre
      (`blur(6px)`, masque transparent en haut) ne pouvait pas reparer. Corrige
      par un fondu de dissolution `--prep-scroll-fade-h: 32px` en bas du corps,
      reserve basse portee a `--space-6 + --prep-scroll-fade-h` pour que le
      dernier bloc ne s estompe jamais. **6 tests `DISS-01`→`DISS-06`,**
      **rouge (5/6) → vert (6/6)**, et **sabotage preuve** : neutraliser le
      masque fait rougir `DISS-01`. Le test `prep-scroll-lip-an9` qui
      interdisait ce masque **n a pas ete supprime** : il porte desormais
      l intention reelle « le dernier bloc ne doit jamais etre estompe ».
      Preuve : `proof/P026-06-zoom-footer.png` avant / apres.
- [x] **P0.28** ✅ **La banniere de mesures de l etape 3 ne suivait pas le
      jour : elle restait figee sur le total de l aventure.** Ferme le
      2026-09-28, preuve navigateur D5 sur un parcours 2 jours relu depuis
      le brouillon persiste.
      **Mesure avant.** Sur `En avant !`, `J1` puis `J2` donnaient tous les
      trois la meme ligne — **À vérifier / À vérifier / 16 h 09 min** — alors
      que la liste du programme, juste dessous, repondait correctement
      (`["Jour 1"]` puis `["Jour 2"]`). **Cause :** `DepartureStep.tsx`
      lisait `selectedDay` pour la liste (`focusedDayNumbers`) mais Passing
      `metricsFor(model, 'aventure')` en dur au bandeau. Le commentaire du
      fichier affirmait pourtant « l onglet choisi plus haut pilote l ecran 3,
      il ne decore pas » : **l intention etait ecrite, le calcul ne la
      suivait pas.** C est le symptome « le selecteur de jours ne se met pas a
      jour sur toutes les pages ».
      **Deux erreurs de mesure de ma part, avant la bonne.** (1) J ai lu
      `.prep-metrics` en supposant n avoir qu un ecran monte : le composant
      existe aussi dans `DepartureStep` ET `ItineraryStep`, et mon
      premiere lecture etait en fait sur l etape 3, pas l etape 2. (2) J ai
      cherche le rail avec `role="button"` alors que `DayPlateau` utilise
      `role="tab"`, et le selecteur in-screen avec `/^J1/` alors que son
      libelle est **« Jour 1 »**. Les deux ont produit un « controle absent »
      qui n en etait pas un.
      **Correction.** `activeDayOrNull(totalDays, selectedDay)` extrait dans
      `engine/metrics.ts` : UNE decision de perimetre, **partagee** par
      `focusedDayNumbers`, `DepartureStep` et `ItineraryStep`. Hors borne
      (jour supprime, voyage raccourci) on retombe sur `null` — l ecran montre
      tout plutot que de devenir vide.
      **Mesure apres, meme session.** Étape 3 : `Tout` = À vérifier / À
      vérifier / **16 h 09 min** ; `J1` = **55,1 km / 5 096 m / 15 h 09 min** ;
      `J2` = À vérifier / À vérifier / **1 h**. **15 h 09 + 1 h 00 = 16 h 09.**
      La selection **survit au changement d etape** : revenue en `Preparation`,
      `J2` affiche toujours 1 h. Le rail bas et le selecteur in-screen
      donnent la meme valeur — ils alimentent le meme store.
      **Tests.** `jour-focus-mesures.test.ts`, **16 tests** `P0.28-1`→`4`,
      **rouge (9 echecs / 2 succes) → vert (16/16)**. Typecheck `tsc --noEmit`
      **exit 0**, suite complete **611 fichiers / 5 722 tests / 0 echec**.
      **Sabotage preuve** : remettre le scope en dur fait rougir
      `DepartureStep ne passe plus le scope en dur` ; rebasculer
      `ItineraryStep` sur son filtre local fait rougir
      `ItineraryStep utilise la MEME decision de perimetre`.
      **Un test a ete corrige, pas repasse.** `P0.28-2` comparait jour et
      voyage sur la fixture par defaut, ou les deux sont « a verifier » :
      il ne prouvait rien. Il porte desormais un modele **mesure**
      (55,1 / 12,4 / 67,5 km) et verifie que le lecteur de nombres respecte le
      **format francais** — `Number("55,1")` vaut 551, pas 55,1.
      Preuve : `proof/P028-10-etape3-jour1.png`, `proof/P028-11-etape3-jour2.png`.
      **Deux defauts vues sur la meme capture, pas encore traites :** le titre
      Generated dit **« Boucle du Mont-Blanc en 2 jours »** alors que le
      parcours mesure fait 67 km ; et la note **« 3 etapes a verifier »** est
      **masquee par le CTA « Enregistrer mon aventure »** en bas de l etape 3.
- [x] **P0.29** ✅ **Les tuiles de mesures, le rail de génération et 28 autres
      filets n'avaient plus d'arête : `--glass-rim` est une OMBRE, pas une couleur.**
      Fermé le 2026-09-28, preuve navigateur D5.
      **Le symptôme.** La tuile 2 du bandeau de mesures présentait un « liseré
      clair en haut et à gauche en plus de la bordure », lu comme une bordure
      double.
      **Ce que la mesure a dit — l'inverse du diagnostic.** `getComputedStyle` sur
      les trois tuiles de l'étape 2 : `border: 0px none rgb(255, 255, 255)`. Elles
      n'avaient **aucune** bordure. Le liseré vu n'était que le reflet interne
      (`inset 0 1px 0 …` en haut, `inset 0 -1px 0 …` en bas) : le reflet seul,
      sans l'arête. Une bordure absente se lit comme un registre décalé.
      **Cause.** `border: 1px solid var(--prep-glass-rim)`, et `--prep-glass-rim:
      var(--glass-rim)`. Or `--glass-rim` vaut `rgba(255,255,255,0.85)` dans le
      `:root` historique et `rgba(241,245,241,0.20)` dans le thème sombre — mais
      `0 0 0 0.5px rgba(0,0,0,0.55)` et `0 0 0 0.5px rgba(0,0,0,0.22)` dans les
      deux thèmes **iOS 27**, qui sont ceux qui tournent. C'est une **couche de
      `box-shadow`** — c'est ainsi que le hub la consomme (`tokens.css:969`) — et
      non une couleur. Posée dans un `border`, elle rend la déclaration **invalide
      au moment du calcul** : `border-style` retombe sur `none`, en silence, sans
      erreur ni avertissement. Le même jeton marche dans un thème et casse dans
      l'autre : de là un défaut quasi invisible, et une « bordure double » qui
      n'en était pas une.
      **Une convention existait déjà, et je l'ai d'abord contredite.**
      `--prep-hairline` (la largeur, `1px`) et `--prep-hairline-ink` (l'encre,
      `color-mix(in srgb, var(--lkv-text-primary) 16%, transparent)`) étaient déjà
      définis, avec un commentaire qui décrivait **exactement** ce piège et la
      mesure navigateur qui l'avait révélé. Mon premier jet a renommé un jeton
      existant en `--prep-hairline` : collision détectée en relisant le diff, et
      abandonnée au profit de la convention du dépôt.
      **Correction.** Les 24 filets d'`adventure-prep.css` et les 7 de
      `free-departure.css` — **31 au total** — posent désormais la paire
      `var(--prep-hairline) solid var(--prep-hairline-ink)`, comme le promettait
      déjà le commentaire du bloc de jetons (« un seul pour la finesse des filets
      de ce chantier »). Les 11 `color-mix(… var(--glass-rim) …)` calibrés sur une
      couleur qui n'existait plus en iOS 27 sont venus avec. `--prep-glass-rim`
      est supprimé, avec le motif consigné à sa place pour qu'on ne le remette pas.
      **Mesure après.** Sur les trois tuiles de l'étape 2 et sur le bandeau de
      l'étape 3 : `1px solid color(srgb 1 1 1 / 0.16)`. Et le doute que j'avais sur
      la visibilité — une encre dérivée du texte clair sur du verre sombre — était
      infondé, mesuré : `--lkv-text-primary` vaut `#ffffff` sur le préparateur.
      Preuve : `proof/P029-01-filets-etape2.png` (regardée), `proof/P029-02-filets-etape3.png`.
      **Tests.** `prep-filets-verre.test.ts`, **6 tests**. Le test ne liste aucun
      jeton autorisé : il **résout** chaque jeton dans tous les thèmes et refuse
      qu'une bordure reçoive une valeur d'ombre — y compris dans un seul thème,
      puisque c'est celui-là qui casse. **Rouge → vert sur deux sabotages :**
      `--prep-hairline-ink: var(--glass-rim)` fait rougir **3 tests** ; une seule
      bordure remise à `1px solid var(--glass-rim)` en fait rougir **2**.
      Typecheck `tsc --noEmit` **exit 0**, suite complète **612 fichiers / 5 728
      tests / 0 échec**.
      **Trois erreurs de mesure ou de méthode, consignées pour qu'elles ne se
      répètent pas.** (1) J'ai lu « bordure double » et cherché une règle CSS
      dupliquée : la mesure disait `border-style: none`. (2) Ma première sonde a
      balayé la CSSOM et n'a rien trouvé — c'est la sonde qui était fausse, pas
      le CSS ; j'en suis revenu à un recensement depuis la source. (3) Mon test
      initial classait `border-radius` comme une bordure, et `1px` comme une
      ombre : les deux venaient de comparer des noms au lieu des valeurs.
- [x] **A9** ✅ **« Boucle du Mont-Blanc en 2 jours » : le titre promettait un
      retour au départ que le programme ne faisait pas — la boucle existait à
      l'écran, pas dans le tracé.**
      Fermé le 2026-09-29, preuve navigateur + 9 tests de garde.
      **Le symptôme.** L'IA promet « on revient au point de départ »
      (`itinerary.ts:98`, `shapeLabel()`) et le motif du jour 1 l'affiche, mais
      AUCUN des trois moteurs ne tenait la promesse : le kilométrage ignorait
      le retour. Une donnée trompeuse, même si elle vient de l'IA.
      **La cause, mesurée sur les trois moteurs — pas une, trois.** (1)
      `engine/itinerary.ts` (buildItinerary) n'ajoutait une étape de retour
      que pour `aller_simple`. (2) `engine/places.ts` (assignPlaces) visait
      `destination` en retour ; en boucle `destination` est `null`, donc
      l'étape de retour revenait SANS POSITION puis était SUPPRIMÉE par la
      phase lieux. (3) `engine/continuity.ts` (versArrivee) ne corrigeait que
      l'aller simple.
      **Le correctif, un par moteur.** (1) La cible du retour est
      `destination` en aller simple, **`origin` en boucle**. (2)
      `assignPlaces` : `const cible = destination ?? origin` — l'étape de
      retour est ancrée, donc conservée. (3) `versOrigine` ajouté à
      `continuity.ts`, miroir exact de `versArrivee` (même seuil
      `ARRIVEE_TOLERANCE_KM`), avec un helper `dernierSitue()` qui retombe
      sur le dernier lieu connu si le dernier jour n'a aucune étape située.
      **Preuve navigateur.** Pipeline réel sondé (buildItinerary → assignPlaces
      → enforceDayContinuity) : le programme se termine sur `j2 trajet « Retour
      de Chamonix »` ancré à **45.9237 / 6.8694**, **distance finale → origine
      = 0,000 km**. Le retour est donc réellement mesuré par la phase tracé.
      **Tests de garde.** `boucle-retour-origine.test.ts`, **9 tests** (A9-01..09)
      — 3 groupes : la règle produit et tient la promesse (dont A9-04,
      non-régression aller simple), la continuité ferme une boucle ouverte
      (dont A9-06 pas de retour redondant, A9-07 jamais de retour vers
      l'arrivée en boucle, A9-09 sans départ rien n'est inventé).
      **Rouge → vert sur 4 sabotages** (`qa-local/sab9.cjs` +
      `sabotage-9-backup.json`) : `itin`→A9-01 rouge, `plac`→A9-02 rouge,
      `cont`→A9-05 + A9-08 rouges, `restore`→9/9 vert. **A9-02 a d'abord été
      rendue NON VACUUSE** : sous sabotage, `assignPlaces` réduit le programme
      au seul départ et l'ancienne assertion passait pour une mauvaise
      raison.
      **Trois erreurs de méthode, consignées.** (1) J'ai d'abord supposé
      qu'un « décalage d'index » expliquait LR-06 ; la SONDE a montré
      qu'avec des ordres par jour (le contrat réel) l'étape de retour arrive
      bien en DERNIER — c'est la FIXTURE du test (ordres globaux) qui mentait,
      pas le moteur. Le test a été corrigé pour être fidèle, pas le moteur pour
      «satisfaire » le test. (2) EOL : `CHECKLIST-PREP.md` est **mixed**
      (2 645 LF / 2 608 CRLF) — j'ai vérifié l'EOL de l'ancre avant chaque
      édition, sans quoi `\r\n` casse l'ancre. (3) `LR-02` et `A8-06` ont
      été **corrigés** (nouveaux nombres + assertions qui PINENT la règle :
      LR-02 vérifie que le retour se referme sur CHAMONIX ; A8-06 vérifie
      qu'aucune étape n'est ancrée sur ARGENTIERE) — pas simplement
      incrémentés.
      **Typecheck `tsc --noEmit` exit 0.** Suite complète : **612 fichiers /
      5 736 tests / 1 échec** — `Z-D18-03` (`chantier-z1.spec.ts`,
      `TripLiveCockpitView`), **régression préexistante et hors périmètre** :
      vérifiée en solo ET sur arbre propre (mes 3 fichiers moteur stashés),
      elle échoue dans les deux cas. Cause mesurée : la fixture
      `futureTrip` porte `start_date: '2026-09-29'` = **aujourd'hui**, donc
      le voyage démarre et « Étape active » est correct ; c'est une bombe à
      retardement basedate, pas un défaut du composant. **Consignée, pas
      masquée.**
- [~] **P0.24** 🔴 **`/api/amenities` renvoie 0 lieu sur le corridor de Chamonix : le
      fournisseur Overpass est injoignable depuis cette machine.** Ouvert le
      2026-09-28, pendant la preuve de P0.23.
      **Ce qui est mesuré :** `GET /api/amenities?min_lat=45.78&…` répond
      `200 {"amenities":[]}` après **47 112 ms**. Les trois miroirs sont testés
      un par un, en direct :
        · `overpass-api.de`      → `ConnectTimeoutError` sur le port 443, 10,7 s
        · `lz4.overpass-api.de`  → `ConnectTimeoutError` sur le port 443, 10,7 s
        · `overpass.private.coffee` → `TimeoutError`, 60 s
      **Ce n'est donc PAS une surcharge Overpass, ni un bug du code :** les
      hôtes sont injoignables depuis cette machine. Les autres fournisseurs
      répondent tous, ce qui isole la panne réseau :
        · `valhalla1.openstreetmap.de` → `400` en **100 ms** (répond)
        · `router.project-osrm.org`    → `200` en **129 ms**
        · `api.open-meteo.com`        → `200` en **170 ms**
      **Conséquence produit :** le module se replie sur `/api/pois`, qui ne fournit
      que de l’altitude. Les repas, l’hébergement et les commerces — donc une
      nuit par jour — disparaissent. Le parcours est alors **inutilisable pour un
      séjour réel**, indépendamment de P0.23.
      **Ce qui n'est PAS la faute du code :** la course des miroirs, le timeout
      de 45 s, le cache 6 h, le repli `[]` et le `User-Agent` sont tous
      correctement en place et unit-tester le confirme. Le comportement est
      **honnête** : une liste vide affichée plutôt qu’un mensonge.
      **Recherche de secours menee le 2026-09-28 - c'est LA piste qui debloque P0.23.**
      Le blocage n'est pas « Overpass est mort » mais « la seule source de lieux est
      un catalogue d'altitude ». Il existe dans le depot une **autre source de lieux
      reels, deja branchee sur la base** : les tables `hotels`, `restaurants` et
      `commerces` du schema LKDV. Elles sont peuplees et filtrables par zone, donc
      elles peuvent servir de source de repli quand Overpass tombe - et elles portent
      la donnee d'affiliation demandee par le dossier.
      **Prochaine action inscrite au journal :** mesurer le contenu reel de ces tables
      sur le corridor Chamonix -> Les Houches (nombre de lignes, coordonnees,
      dedoublonnage) AVANT de choisir entre source de repli et miroir alternatif.
      Rien n'est code tant que la mesure n'a pas parle.
      **CORRECTIF FAIT ET PROUVÉ le 2026-09-28 — un repli, pas un remplacement.**
      Photon (komoot) devient la source de secours quand aucun miroir Overpass ne
      répond. Il ne remplace rien : Overpass garde la main des qu'il repond, parce
      que c'est la source la plus complete. Le repli n'est sollicite qu'apres
      l'echec des trois miroirs.
      **Pourquoi Photon et pas un autre miroir :** il est **deja une dependance du
      projet** — `geocodeService.ts` l'utilise pour le geocodage. Aucun compte,
      aucune cle, aucun contrat a negocier, donc un depannage deployable. Et il est
      mesure comme joignable depuis cette machine, la ou les trois miroirs
      Overpass ne le sont pas.
      **Preuve — requete API réelle, corridor Chamonix, 2026-09-28 :**
      | | Avant | Apres |
      |---|---|---|
      | `GET /api/amenities` | `200 {"amenities":[]}` en 47 112 ms | `200` en 50 117 ms |
      | Lieux rendus | **0** | **7** |
      | Repas | 0 | **2** (Restaurant Ghandi, Les Houches · Restaurant Le Panoramic, Chamonix) |
      | Hebergement | 0 | **5** (Hôtel Mont Blanc, Hôtel Lyret, Hôtel Chris-Tal, Hôtel du Bois, Hôtel-Restaurant Aiguille du Midi) |
      **Les 7 sont des etablissements FRANCAIS nommes, a Chamonix et aux Houches,
      avec leurs coordonnees reelles.** Ce sont exactement les nuitees et les repas
      qui manquaient pour qu un sejour de plusieurs jours cesse d etre vide.
      **Tests : 11 nouveaux (AM-20 a AM-30), verifies ROUGES avant correctif** —
      `normalizePhoton` n existait pas, `PHOTON_QUERIES` était `undefined`, et
      AM-27 echouait sur `expected 0 to be greater than 0` — **puis 30/30 verts**,
      dont les 21 precedents qui n'ont pas bouge, et **5609/5609 verts sur la suite
      complete** (602 fichiers). Trois tests precedents (AM-14, AM-16, AM-28) ont
      ete **recalibres sur le contrat nouveau** : ils comptaient 3 appels la ou il
      y en a 6, et AM-28 affirmait que Photon n est jamais sollicite, ce qui
      n est plus vrai depuis que le repli est concurrent. `tsc` 0.
      **Un piege mesure, traite :** Photon classe par pertinence TEXTUELLE, pas par
      distance. Interroge sur 'restaurant' a Chamonix, ses 5 premiers resultats
      tombaient a **Annecy, Albertville et Grenoble, jusqu'a 90 km**. Sans filtre
      de distance, le parcours proposerait un diner a 90 km comme etape du jour.
      Le tri par distance depuis le centroide, puis le rejet de tout point hors
      boite, sont donc obligatoires — ils sont dans le code et couverts.
      **Le délai, mesuré et assumé — et une tentative ratée, notée parce qu'elle
      l'est.** En interrogeant le repli SEULEMENT après l'échec des trois miroirs,
      la réponse prenait **50,1 s** : 45 s de budget Overpass, plus 5 s de repli.
      Lancer les deux sources EN MÊME TEMPS fait tomber ce délai à **45,5 s**.
      J'ai tenté une course bornée qui aurait rendu la réponse dès que Photon
      répondait : elle **cassait 4 tests et rajoutait 24 s à la suite**
      (`Promise.race` sur des miroirs qui ne se résolvent jamais). Je l'ai
      **retirée** : `Promise.all` est plus lent de 5 s dans le cas mesuré, mais
      il est correct et prévisible. **Le gain de 50,1 → 45,5 s est donc validé ;
      le délai de 45 s reste ouvert**, et c'est le prochain chantier mesuré —
      il se règle en amont, sur le délai d'Overpass ou en rendant la réponse
      dès que la première source répond, pas en multipliant les promesses.

      **Ce qu'il faut trancher :** soit un fournisseur d'amenités de secours
      réellement joignable (autre Miroir Overpass **ou** source own, cf. la
      piste P1.6), soit afficher honnêtement l'absence à l'utilisateur. **Rien n'est
      implémenté pour l'instant.**

- [x] **P0.25** 🔴 **Le fournisseur de routage piéton est INJOIGNABLE : toute demande `/api/route?mode=pieton` repond `503 provider_unavailable` apres 8 s** — toujours vrai, et suivi ailleurs comme **P1.9** — ~~**le filtre de marchabilite echoue alors OUVERT et conserve des lieux non verifies, les sommets**~~. **RÉPARÉ et VÉRIFIÉ le 2026-09-28** (5 tests `P025-01`→`P025-05`, 23/23 verts ; suite complete **602 fichiers / 5 614 tests / 0 echec** ; `tsc --noEmit` **exit 0**). Ouvert et mesure le 2026-09-28.
      **D abord, une lecture fausse que ce document corrige.** J avais cru que les
      10 × `503 off_network` du pilote demonoquaient une fuite de sommets vers
      les etapes. C etait faux, et la mesure le dit : ces 10 appels sont les
      **sondes du filtre** (`keepWalkableFrom` teste chaque candidat via
      `/api/route`), pas le traceur du parcours. Le filtre ne fuyait pas ; il
      **gardait trop**.
      **La cause reelle, mesuree a la source :** le seul fournisseur pedestre
      est `valhalla1.openstreetmap.de`, et il ne repond pas depuis cette machine.
      | Sonde directe (le 2026-09-28) | Resultat |
      |---|---|
      | `valhalla1.openstreetmap.de/route` (le fournisseur du service) | **injoignable**, 12 060 ms |
      | `valhalla.openstreetmap.de/route` (meme exploitant) | **injoignable**, 12 008 ms |
      | `valhalla.maptiler.com/route` | refus en 68 ms (cle requise) |
      Le service observe le symptome : `TIMEOUT_MS = 8000` dans
      `routingService.ts`, d ou le **8 s pile** de chaque reponse. Ce n est donc
      pas un bug de code : c est une **panne de fournisseur**, et elle est
      **totale** — hotel et restaurant compris, pas seulement les sommets.
      | Sonde `/api/route?mode=pieton` depuis Chamonix | Reponse |
      |---|---|
      | Mont Blanc 45.8326,6.8652 | `503 {"reason":"provider_unavailable"}` en 8 153 ms |
      | Rifugio Torino 45.8634,6.9876 | `503 provider_unavailable` en 8 032 ms |
      | Refuge de la Charpoua 45.9012,6.9234 | `503 provider_unavailable` en 8 030 ms |
      | Torrent des Bossons 45.8567,6.8456 | `503 provider_unavailable` en 8 036 ms |
      | **Hotel Mont Blanc 45.9232,6.8681** | `503 provider_unavailable` en 8 038 ms |
      | **Restaurant Ghandi 45.8957,6.8056** | `503 provider_unavailable` en 8 040 ms |
      **Le point qui compte :** l **inventaire** et la **position** sont traites
      par le meme verdict, alors qu ils ne doivent pas l etre. Dans
      `isWalkableFrom` (`placeSource.ts:113`), un `503` dont le `reason` n est
      pas `off_network` vaut **vrai** — echec ouvert, volontaire et bien
      commente (« une panne de Valhalla ne doit pas vider l inventaire »).
      C est la bonne intention, appliquee au mauvais endroit :
      · pour l **inventaire** — donner un nom a l IA — c est correct ;
      · pour la **position** — attribuer une coordonnee mesuree a une etape —
        c est faux, car un lieu non verifie recoit alors une position.
      **Consequences mesurees, en une seule sonde live du pipeline reel**
      (`/api/pois` + `/api/amenities` + filtre, ancre Chamonix) :
      | Sonde | Resultat |
      |---|---|
      | `loadBasePlacesNear` (inventaire lu par l IA) | **0 candidat** en 4 995 ms |
      | `searchPlacesNear` (phase des lieux) | **20 candidats** en **61 353 ms** |
      | dont des sommets | **Mont Blanc, Rifugio Torino, Charpoua, Torrent des Bossons** |
      | appels `/api/route` | **36**, dont **33 en echec**, cumules a **64 794 ms** |
      | `/api/amenities` | 45 059 ms (le delai de P0.24, toujours ouvert) |
      L inventaire lu par l IA etant vide, **l IA ecrit la journee de sa propre
      memoire** — d ou Mont Blanc et l Aiguille du Midi. Puis le filtre, en
      echec ouvert, laisse repasser ces sommets, et le traceurroute 36 requetes
      a 8 s chacune. **Le pilote ne depasse pas 292 s** : les 8 s par sonde
      expliquent le temps, le filtre explains les sommets.
      **Le repli n existe pas, et c est un choix delibere et pertinent :**
      `routeAttempt` (`routingService.ts:464`) ne crosse PAS `pieton` et `velo`
      vers OSRM, parce que le graphe pedestre du serveur de demonstration
      n existe pas et qu un trajet de marche ne doit jamais retomber sur un
      reseau routier. **Il ne faut pas touchier cette decision.** Mais elle
      rend Valhalla **un point de defaillance unique**, sans repli, sur la
      machine qui heberge l application.
      **Ce qu il faut trancher, et la separation honnete :** il n existe aujourd hui
      **aucun fournisseur pedestre gratuit et joignable** depuis cette machine
      (mesure ci-dessus). On ne peut donc pas « reparer » le routage : on peut
      **arreter de mentir**. Deux corrections distinctes, dans cet ordre :
      · **(a) Failer fermé sur la POSITION, ouvert sur l INVENTAIRE.** Un lieu
        dont la marchabilite n est pas MESUREE ne doit pas recevoir de
        coordonnee : il devient une note. L ecran affiche alors « a verifier »,
        ce qui est vrai, au lieu d afficher une distance mesuree vers un sommet
        inatteignable. C est le vrai correctif de P0.23.
      · **(b) Arreter de payer 8 s par sonde quand le fournisseur est tombe.**
        Un etat « fournisseur indisponible » briefement memorise evite 36 × 8 s
        et rend l ecran utilisable en degrande plutot que fige.
      Un **vrai fournisseur pedestre** reste necessaire pour la distance reelle :
      c est un item de fond, pas une option. Il est trace en P1.9.
      **Ce qu il fallait trancher, et ce qui a ete tranche le 2026-09-28.**
      La panne, elle, n est pas « reparee » — elle ne peut pas l etre : aucun
      fournisseur pedestre gratuit n est joignable d ici (mesure ci-dessus). Ce
      qui est corrige, c est precisement ce que l itemannonait : **arreter de
      mentir**, et **arreter de payer 8 s par sonde**.
      · **(a) Failer fermé sur la POSITION, ouvert sur l INVENTAIRE — LIVRE.**
        Le booleen unique est remplace par un tri-etat,
        `WalkReachability = 'mesuree' | 'hors_reseau' | 'inconnue'`, dans
        `placeSource.ts`. Un `503 off_network` reste la SEULE preuve
        d inatteignabilite ; tout le reste est `inconnue`. Il en decoule deux
        filtres distincts : `keepWalkableFrom` (ouvert) reste sur l INVENTAIRE,
        via `loadBasePlacesNear`, contrat P023-02 intact ; `keepMeasuredFrom`
        (ferme), NOUVEAU, est branche sur `searchPlacesNear` — c est la seule
        ligne qui change le comportement. Un sommet non mesure ne recoit donc
        plus de coordonnee, et l ecran affiche « a verifier » au lieu d une
        distance mesuree vers un sommet inatteignable.
      · **(b) Memoire de panne, BORNEE — LIVRE.** `PAUSE_FOURNISSEUR_MS =
        30_000`, armee sur un `503` non-`off_network` **seulement** : un `500`
        ou une erreur reseau ne prouvent rien de l etat du service, seulement
        de la requete. Les 36 × 8 s tombent a une sonde, et la fenetre
        **expire** — sans expiration, une panne de mars servirait des mois.
      **Les 5 tests, et deux d entre eux qui etaient d abord faux.** RED puis
      GREEN dans `place-source.test.ts` : `P025-01` la panne n introduit aucun
      sommet · `P025-02` l inventaire, lui, echoue toujours ouvert · `P025-03`
      apres une panne connue, la sonde suivante ne touche plus le reseau ·
      `P025-04` la memoire expire, bornee des deux cotes (0 appel pendant la
      fenetre, 1 appel apres) · `P025-05` un lieu MESURE survit a la panne qui
      suit. Deux de ces tests etaient **defectueux, et reussissaient ou
      echouaient pour la mauvaise raison** — il faut le dire, sinon la preuve
      est fausse :
      · `P025-05` accordait son `200` sur `6.8427`, la longitude du **Gouter**,
        alors qu il attendait `Chamonix` : le mock contredisait son propre
        resultat attendu. Corrige en comparant le **premier point** de l URL
        (le candidat), decode — `URLSearchParams` encode `,` et `;` en `%2C`
        et `%3B`, donc aucun fragment brut ne pouvait matcher.
      · `P025-04` armait la fenetre sur l horloge reelle puis installait une
        horloge factice **apres coup** : elle n avance donc pas la, et le test
        ne prouvait rien. Corrige en posant `T0` **avant** la premiere sonde.
      · Le `beforeEach(__resetWalkabilityMemo)` a du remonter au **niveau
        fichier** : la memoire de panne est un etat de MODULE. `P025-05` se
        terminant sur `provider_unavailable`, la fenetre restait armee et
        `P023-01` lisait son `off_network` comme un silence du fournisseur — il
        aurait passe pour la mauvaise raison.
      **Un second blocage, trouve et leve au passage : le typecheck etait
      deja en echec avant ce lot.** `src/app/api/users/search/route.ts`
      exportait `sanitizeSearchTerm`, `toPublicUser` et `PublicUser` ; Next.js
      interdit a un `route.ts` d exporter autre chose que son handler, donc
      `tsc` echouait et **le build de production aurait casse**. Les trois
      vivent desormais dans `src/lib/users/publicUser.ts` — corps compare
      ligne a ligne a l original, la seule difference etant le nom de la
      constante partagee —, la route n exporte plus que `dynamic` et `GET`, et
      le doublon de `PublicUser` que `PrepSetupSheets.tsx` portait aussi a ete
      supprime au profit d un `import type`. `tsc --noEmit` : **exit 0**.
      **Ce que P0.25 ne pretend pas avoir regle.** La panne du fournisseur, si.
      Et donc la **preuve ecran de bout en bout n est pas refaite** : aucune
      distance de marche reelle ne peut s afficher tant qu aucun fournisseur
      pedestre ne repond. C est P1.9, et c est exactement ce qui bloque encore
      P0.23, qui reste donc en **partiel**.
### P1 — Ce qui est RÉELLEMENT branché (à cocher après re-vérification)

- [ ] **P1.1** ✅ **Géocodage réel** — Open-Meteo puis Photon, en cascade, sans clé.
      Vérifié : `GET /api/geocode?q=Chamonix` → `HTTP 200`, `Chamonix-Mont-Blanc`,
      `45.92375 / 6.86933`. L'identifiant `geo-…` est une clé de cache locale, pas un
      identifiant de fournisseur : **ce n'est pas du mock**.
- [ ] **P1.2** ✅ **Météo réelle, accessible, inutilisée** — voir P0.2. Le service est bon,
      le contrat est bon ; il manque **un seul appel et un peu de mise en cache**.
- [ ] **P1.3** ✅ **Écriture en base réelle avec annulation** — `/api/adventure/commit`
      insère `trips` + `trip_steps` + `trip_collaborators` et **supprime le voyage si les
      étapes échouent**. `saveAdventure` refuse d'annoncer « enregistré » sans `tripId`
      réellement renvoyé. C'est le meilleur morceau de l'app : ne pas le casser.
- [ ] **P1.4** ✅ **Graphe social réel** — `/api/users/search` interroge `user_follows` et
      `public_profiles`.
- [ ] **P1.5** ✅ **IA réellement côté serveur** — `askAI` est serveur-only, la clé NVIDIA
      vit dans `.env.local` et **n'entre jamais dans le bundle**. Le schéma de sortie
      interdit volontairement tout champ prix : « l'IA propose, elle ne décide pas ».
      C'est la bonne règle — la conserver.
- [ ] **P1.6** ✅ **Onglet de jour fonctionnel** — J3 testé au clic : la sélection passe,
      le contenu change (« Eau et ravitaillement », 5 étapes), la pastille J3 est active.
      *Ce que l'utilisateur croyait cassé ici est réparé.*
- [ ] **P1.7** ✅ **Carte réelle** — MapLibre, tuiles OpenStreetMap France · Esri,
      zoom avant/arrière, vue globe, recentrage. Le socle cartographique est bon.
- [ ] **P1.8** ✅ **Tiroir « Étapes » fonctionnel** — s'ouvre, liste les 16 étapes groupées
      par jour, chaque ligne est cliquable. Le fond est à refaire (P0.9), la mécanique est
      bonne.
- [x] **P1.9** ✅ **Un fournisseur de routage PIÉTON réellement joignable** — les trois
      Valhalla mesures ne repondaient pas, donc *tout* `/api/route?mode=pieton` rendait
      `503 provider_unavailable` : c etait **la cause racine de P0.23**. **LEVE et
      PROUVE le 2026-09-28.**
      **Trouve a la mesure, et non a la lecture :** les deux Valhalla sont toujours
      morts (`valhalla1` INJOIGNABLE 10 632 ms, `valhalla` INJOIGNABLE 10 610 ms), mais
      **`routing.openstreetmap.de` repond en `200` / 132 ms**. C est un OSRM **a profil** :
      `routed-foot` (pieton) et `routed-bike` (velo), edites par le meme exploitant que le
      demon OSRM deja utilise. La voiture reste sur `router.project-osrm.org` : OSRM
      n expose que le graphe routier, y faire du pieton fausserait toute la mesure.
      **Trois pieges corriges au passage, chacun mesure :**
      1. `fetchJson` court-circuitait sur `!response.ok` : le `code: "NoRoute"` d une
         reponse `400` etait donc illisible. Il lit desormais `response.text()`.
      2. **le garde-fou d arrivee ne s appliquait qu a Valhalla.** Mont Blanc rendait
         `Ok` avec **115 km / 26 h**. `ARRIVAL_TOLERANCE_M = 500 m` s applique
         desormais aussi a OSRM — c etait le piege qui aurait laisse passer un sommet
         mesure comme une marche.
      3. le repli Valhalla ne se declenche **que sur panne**, jamais sur `off_network` :
         une mesure ne se remplace pas par une seconde opinion.
          **Ce raisonnement etait CORRECT tant que les deux fournisseurs
          couvraient le meme terrain — il devient FAUX des que leurs graphes
          different : c est tout l objet de P1.10.**
      **Preuve — service `/api/route` sonde en direct le 2026-09-28, Chamonix vers
      Les Houches (6.8693,45.9237 -> 6.7983,45.8917), les 3 modes sur les MEMES
      points :** pieton **7,384 km / 98,5 min = 4,50 km/h** (514 points de trace) *
      velo **7,139 km / 29,8 min = 14,37 km/h** (413 pts) * voiture **8,030 km /
      9,1 min = 53,19 km/h** (359 pts). Les 3 en `200`.
      **Les sommets sont refuses par la mesure, pas par une liste :** Mont Blanc
      (5 065 m), refuge du Gouter, Rifugio Torino, Charpoua, Servoz rendent tous
      `503 off_network`. Fin de trace Mont Blanc reellement mesuree :
      `[6.914489, 45.80269]`.
      **Un raisonnement faux, corrige avant d etre ecrit — a ne pas reproduire :**
      j avais d abord pose P019-11 comme « la marche est 4x plus longue que la voiture ».
      C est faux sur ces points : la voiture reelle vers Les Houches est **8 030 m**, et la
      marche y est plus **courte** (7,4 km de sentier contre 8,0 km de route). Le 1 529 m
      venait d un autre point de sonde. Le test a ete reecrit sur le bon invariant — la
      **vitesse** (pieton < velo < voiture, pieton dans 2–25 km/h) — et la fixture voiture
      alignee sur 52,95 km/h pour etre arithmetiquement exacte.
      **Preuve automatisee :** `p019-pedestrian-provider.test.ts`, **14 tests
      `P019-01`->`P019-14`, tous verts**. Suite complete **603 fichiers / 5 628 tests /
      0 echec**. `tsc --noEmit` **exit 0**.
      **Ce que P1.9 ne pretend pas avoir regle :** le fournisseur repond, mais
      **P0.23 reste ouvert** — la cause s est deplacee vers la source des lieux.

- [x] **P1.10** 🔴 ~~**Les lieux de montagne ne sont sur AUCUN graphe routier ou pieton
      libre : toute la phase `trace` echoue et l adventure affiche « a verifier »
      partout.**~~ **RÉPARÉ et VÉRIFIÉ le 2026-09-28** — BRouter `trekking` branché en
      **dernier recours du seul mode `pieton`**, après OSRM puis Valhalla. Il donne en plus le
      **dénivelé positif réel**, qu aucun autre moteur ne fournit et dont l écran a besoin.
      **Mesuré en direct** : `/api/route` Chamonix → refuge des Grands Mulets, `mode=pieton` = **HTTP 200**,
      **14,424 km / 323,05 min / D+ 2 100 m / 881 points de trace** — contre `503 off_network` avant. Les
      **négatifs sont prouvés aussi** : Pacifique → `503 off_network`, et `voiture` vers le refuge →
      `503 off_network`, c est à dire que **BRouter n est jamais appelé hors `pieton`**.
      **10 tests `P110-01`→`P110-10`** dont les fixtures sont des réponses réelles mesurées ; `P019-03` et
      `P019-06` réécrits sur leur **vrai invariant** (le garde-fou, et l honnêté de la politique de
      fournisseurs) au lieu de l ancien faux invariant. Suite **109 fichiers / 1 644 tests / 0 échec**,
      `tsc --noEmit` **exit 0**.
      **Ce que P1.10 ne prétend pas avoir réglé, à lire avant de décocher P0.23 :** le Gouter reste
      refusé (écart 870 m, au-delà des 500 m) — le garde-fou **fonctionne**, il n est pas un tampon. Et surtout
      **la phase `trace` n’est plus la cause du `a verifier`** : tant que le générateur ne produit que des
      coordonnées de grille et non des lieux réels, la distance réelle n a toujours rien à afficher.
      transfert de contexte concluait que `valhalla1.openstreetmap.de` etait
      redevenu joignable et qu il **atteignait** le refuge des Grands Mulets
      (9,241 km / 155,1 min). **C etait FAIT, et c etait une PIEGE.** Valhalla
      repond `200` en 252 ms, `trip.status = 0`, et sa derniere instruction dit
      textuellement *« You have arrived at your destination »* — **mais sa
      polyline decodee s arrete a 2 875 m du refuge.** Le fournisseur **ment dans
      son propre texte** ; seul le decompte de la geometrie, que notre garde-fou
      fait deja, dit la verite. C est exactement la valeur plausible que ce projet
      refuse : il suffisait de croire une phrase anglaise pour livrer un trajet
      qui n existe pas.
      **Les trois fournisseurs, mesures le 2026-09-28 sur le meme couple
      Chamonix (6.8693,45.9237) -> refuge des Grands Mulets (6.861252,45.86659) :**

      | fournisseur | reponse | ecart d arrivee reel | verdict du garde-fou |
      |---|---|---|---|
      | OSRM `routed-foot` (FOSSGIS) | `200` `Ok` 8 718 m / 124 min | **2 878 m** (le `waypoint` s accroche a `[6.837477, 45.886451]`) | refuse `off_network` |
      | Valhalla `pedestrian` | `200` status 0, 9,128 km / 153,7 min | **2 875 m** | refuse `off_network` |
      | **BRouter `trekking`** | `200` 14 424 m / **D+ 2 100 m** / 19 383 s | **18 m** | **accepte** |

      **La lecture juste :** `off_network` ne prouve pas que le lieu soit
      injoignable, il prouve que **le graphe de CE fournisseur** ne dessert pas
      le lieu. Les deux echecs a 2,87 km et le succes a 18 m sont la meme
      realite vue par deux cartes incompletes.
      **Pourquoi BRouter est le bon dernier recours, et pas un bricolage :** c est
      un moteur **dedie a la randonnee** (`trekking`), avec son propre modele
      d elevation, et il est le seul des trois a couvrir l approche d un refuge
      d altitude. Il donne en plus le **denivele positif reel** (`filtered
      ascend`), que ni OSRM ni Valhalla ne fournissent, et dont l ecran a
      besoin. Cout mesure : 53–361 ms, un appel **par troncon** (BRouter ne
      renvoie aucun index de jalon, donc un appel multi-points serait
      inexploitable). Limite assumee : le Gouter reste refuse (ecart **870 m**,
      au-dela des 500 m) — le garde-fou n est donc pas un tampon, et un lieu
      vraiment hors rando continuera d afficher « a verifier », **ce qui est le
      bon comportement**.
      **Fait, mesure, le 2026-09-28 :** Mont Blanc summit par BRouter =
      27 788 m / D+ 3 896 m / 10 h 13. Ce n est **pas** un mensonge : le denivele
      est coherent avec l altitude (4 808 m moins 1 035 m, en passant par le
      Gouter a 3 817 m et les Grands Mulets a 2 197 m), et la distance avec un
      aller-retour de glacier. C est **plus juste** que les 115 km / 26 h du
      graphe routier et les 146 km / 35 h de Valhalla. **Le test P019-03 devra donc
      etre reecrit sur son vrai invariant — le garde-fou, pas Mont Blanc** — et
      P019-06 pareil, sur l honnetete de la politique de fournisseurs.

### P2 — Boutons : chacun doit être cliqué et prouver qu'il fait quelque chose

- [ ] **P2.1** `Créer mon parcours` — **OK, testé** : bascule en étape 2 et génère 16 étapes.
- [ ] **P2.2** Onglets `Tout / J1 / J2 / J3` — **OK, testé** (P1.6). Vérifier en plus que
      la sélection **survit** au passage à l'étape 3.
- [ ] **P2.3** `Étapes` (tiroir programme) — **OK, testé** : s'ouvre et se referme.
- [ ] **P2.4** `Remplacer` sur une étape — **jamais testé**. Doit proposer des
      alternatives **réelles** et réellement différentes, pas un tirage au sort.
- [ ] **P2.5** `À conserver` — **jamais testé**.
- [ ] **P2.6** `Ajuster` — **jamais testé**. Doit ouvrir un tiroir en verre, pas une
      boîte de dialogue système.
- [ ] **P2.7** `Ajouter` — **jamais testé**. C'était le remplacement du « Ajouter une
      étape » par un défilement infini **géolocalisé sur le trajet** : non conforme tant
      que ce n'est pas fait.
- [ ] **P2.8** `Agrandir` / `Recentrer` de la carte — **jamais testé**.
- [ ] **P2.9** `Vers le départ` — **jamais testé**, et **recouvert** par P0.10.
- [ ] **P2.10** `Revenir à Créations` / `Revenir à Préparation` — **intégrité d'état** :
      ces deux entrées permettent de **sauter l'étape 2 sans l'avoir validée**. À
      supprimer ou à verrouiller.
- [ ] **P2.11** `Ouvrir les préférences du trajet` — **jamais testé**.
- [ ] **P2.12** Les tiroirs `Départ`, `Arrivée`, `Date`, `Temps`, `Participants` —
      **jamais testés en 393** dans cette session.
- [ ] **P2.13** Bouton d'enregistrement final — **jamais atteint** : bloqué par P0.1
      tant que les métriques sont fausses.

### P3 — La recette : pas de donnée fictive qui s'affiche

- [ ] **P3.1** Chaque nombre affiché est **recalculé** depuis une source
      (OSRM, Open-Meteo, Tripadvisor, Viator, Supabase) **ou absent de l'écran**.
      Jamais de valeur plausible inventée pour remplir.
- [ ] **P3.2** « À vérifier » est une **absence assumée**, jamais un défaut de calcul.
      Aujourd'hui, à chaque panne réseau, l'écran se remplit de « À vérifier » : au-delà
      d'un seuil, l'écran doit **prévenir** au lieu de répéter.
- [ ] **P3.3** Chaque activité, hébergement, restaurant et magasin proposé est **dans la
      base**, rattaché à un identifiant de lieu réel, avec une source lisible.
- [ ] **P3.4** Aucun jour ne peut afficher deux fois la même étape générique (P0.8).
- [ ] **P3.5** Les étapes proposées doivent être **validées géographiquement** : une
      activité nautique à 600 km du rivage, ou une plongée pour un groupe avec enfants,
      doit être rejetée **avant** l'affichage, pas après.
- [ ] **P3.6** Un build de contrôle refuse de démarrer si une constante de démonstration
      subsiste dans `src/features/adventure-prep`.

### P4 — Le moteur : puissant derrière, invisible devant

- [ ] **P4.1** L'IA n'est jamais **coupée** par un état résiduel : un échec de phase
      relance **uniquement la phase concernée**, le reste du programme est conservé.
- [ ] **P4.2** Bouton **« Réessayer »** explicite, toujours présent, dans chaque bandeau
      d'état dégradé.
- [ ] **P4.3** Écran de chargement intermédiaire entre l'étape 1 et l'étape 2, avec des
      étapes de génération **honnêtes** (« calcul du trajet », « choix des étapes »,
      « vérification des horaires ») — jamais une barre vide.
- [ ] **P4.4** Repli sur le moteur par règles **annoncé comme tel, avec une action**,
      pas présenté comme le résultat de l'IA.
- [ ] **P4.5** Prompt IA **accentué**, avec une passe de typographie française en sortie.
- [ ] **P4.6** Contrôle de cohérence du planning **exécuté**, et **signalé** quand il échoue.
- [x] **P4.7** ~~Un brouillon vieux de plus de X jours est signalé et **réinitialisable** en un geste.~~ **RÉPARÉ et VÉRIFIÉ le 2026-09-28**
      C’est P0.5, fermé ci-dessus : bandeau daté + **« Repartir sur un plan neuf »** en un geste (`proof/P05-01-perime.png` → `P05-02-apres-reinit.png`, regardées).

### P5 — Beauté pure, testée en 393 (captures de référence ci-dessus)

- [ ] **P5.1** Un seul verre, une seule recette. Le tiroir P0.9 et la carte P0.11 doivent
      **partir du même matériau** que la barre d'étapes, qui est correcte.
- [ ] **P5.2** Le CTA « Créer mon parcours » a un contraste faible sur le verre clair.
      Cible **4.5:1** minimum.
- [ ] **P5.3** Épaisseur de trait et opacité des pastilles de jour **uniformisées**.
- [ ] **P5.4** Une seule hiérarchie typographique par carte — le titre de P0.11.
- [ ] **P5.5** Le voile vert clair reste **léger** : la photo doit rester lisible sous le
      contenu, c'est le principe même du voile.
- [ ] **P5.6** Zéro chevauchement possible : barre de jours, bouton de contexte et
      navigation basse doivent avoir des **rôles de flux** distincts (P0.10).
- [ ] **P5.7** Un fond translucide et un aplat ne peuvent pas coexister pour un même
      composant : choisir la transparence ou l'opacité, jamais les deux.
