
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

**Comptage honnete au 2026-09-28 :** 21 faits · 2 partiels · 181 restants.
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
| D1 | départ facultatif, CTA au strict nécessaire | ⚠ à faire | — |
| D2 | rail de familles déborde, « Neige » coupée | ⚠ à faire | `proof/A-01` |

**En cours :** lots A3, D1, D2, puis détail étape 2 et réécriture étape 1.

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
coupée. Le découpage净额 de la capture A-02 était un artefact de position, pas un défaut.

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

- [ ] D1 Écran intermédiaire entre l'étape 1 et l'étape 2
- [ ] D2 Phases réelles affichées (départ, recherche, vérification, eau/repas/nuit)
- [ ] D3 La carte se trace en direct pendant la génération
- [ ] D4 Échec partiel : « Une partie n'a pas abouti » + réessayer
- [ ] D5 IA seeded par le brief libre + statistiques des invités

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
- [ ] **P0.5** 🟠 **Un brouillon périmé est resservi sans avertissement.** « 16 étapes
      enregistrées » datées du **21 sept.** alors que nous sommes le **28 sept. 2026** :
      les dates sont **dans le passé**. `emptyDraft()` a `startDate: null` — c'est un
      brouillon `localStorage` d'une session précédente, jamais signalé, jamais proposé
      à réinitialiser. C'est aussi pour cela que la météo ne s'affiche pas.
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
- [ ] **P4.7** Un brouillon vieux de plus de X jours est signalé et **réinitialisable**
      en un geste (P0.5).

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