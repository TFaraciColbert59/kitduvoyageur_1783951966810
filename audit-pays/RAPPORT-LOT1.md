# REFONTE `/pays/[code]` — Lot 1 livré (coquille grammaire Compte)

**Worktree :** `/Users/fr168256/lkdv-pays` · **Branche :** `chantier/pays-refonte` (base `0e0a35e4`, commit de production)
**Serveur :** `http://127.0.0.1:4001` · **Données :** Supabase `icxyvwzfjbflcbqukpfz` (réelles), météo Open-Meteo, communauté réelle.
**Date :** 25 octobre 2026.

---

## 1. Ce qui est refondu

La fiche pays est passée d'une page qui défile **2 332 px** (jusqu'à 4 017 px) en cartes de verre sombre à un **écran verrouillé de la grammaire Compte**, à l'identique de la référence déployée mesurée :

| Part | Avant | Après | Référence |
|---|---|---|---|
| Écran | 2 332 px de haut, défile | **932 = innerHeight** | 932 |
| Base typo | 17 px blanc | **14 px / −0,14 / #172B24** | idem |
| Barre haute | pilule 80×32 + 1 bouton | **pilule h34 + 3 boutons 38** | idem |
| Carte | 11 cartes empilées | **1 carte 406 × 541 r24**, scroll interne | idem |
| Identité | hero 398×224 + 4 stats 90×58 r0 | **visuel 66 + 3 stats 101×39 r14** | idem |
| Bio | absente | **2 lignes 378 px, 12/15,6** | idem |
| Sections | rangée 430×102 + barre | **8 anneaux 72×56** (5 visibles, défile) | idem |
| Contenu | carrousels empilés | **grille 3 colonnes 406 gap 3, tuiles 134 r2** + liste | idem |
| Sélecteur | absent | **88×30, lentille 41,5×25** | idem |
| Barre basse | 74×60, 5 liens | **402×48, 5 boutons 80×44** | idem |
| Zone carte | MapLibre en erreur | **carte des repères réels** (données `points_interet_carte`) | mapzone 334,9 |

**Preuve : `npm run design:fidelity -- /pays/fr` → 19/19 ancres conformes** (et 19/19 sur `/compte`, la référence, ce qui valide que la porte mesure bien la grammaire et pas seulement notre écran).

---

## 2. Ce qui est conservé (aucune perte)

| Acquis | Sort |
|---|---|
| Route `/pays/[code]`, redirects middleware, `force-dynamic` | inchangés |
| Metadata + JSON-LD (`Place`, `WebPage`, `BreadcrumbList`) | inchangés (dans `page.tsx`) |
| 8 sections (`presentation` … `communaute`) | anneaux, mêmes clés, `?section=` toujours lu |
| Météo Open-Meteo | 2 lignes « Météo en direct » + « Vent · UV » (données réelles) |
| Fiche d'identité 10 champs + sources | drawer « Fiche d'identité » |
| Pratique (formalités, transport, budget, santé, électricité, climat) | 18 lignes réelles, vue liste |
| Destinations / Activités / Gastronomie | tuiles photo + liste (images réelles) |
| Communauté | **4 clubs + 4 carnets réels** (mêmes requêtes Supabase), en lignes |
| Vues historiques (Discovery, Klook, pratique IA) | drawer « Tout voir — <section> », montées telles quelles |
| Actions Atlas, Kit IA, recherche, PDF, sources | pilule + 3 boutons + drawers |
| Haptique, `?section=`, tests | conservés |

---

## 3. Fichiers

**Ajoutés**
- `src/components/pays/PaysGlassV8.tsx` — l'écran (composition de la grammaire, zéro valeur de matière).
- `src/design/account/liquid-lens.ts` — lentille réfractive extraite **telle quelle** du runtime Compte (7 filtres générés, `url(#lf…)`).
- `src/design/account/AccountDrawerHost.tsx` — drawer en place (boîte mesurée 12/48/406×541).
- `src/design/account/account-grammar-pins.css` — 2 épingles (collision du nom `.tb` avec la barre native) + responsive 768/1440 + boîte du drawer.
- `scripts/design/design-fidelity.mjs` (porte, 430×932, ±1 px) et `design-diff.mjs` (diff pixel seuillé).
- `package.json` : `npm run design:fidelity`, `npm run design:diff`.

**Modifiés**
- `src/app/pays/[code]/CountryDetailClient.tsx` — coquille + drawer des vues historiques.
- `src/components/account/AccountBottomBar.tsx` — prop `renderAs="button"` (DOM de la référence : 5 boutons 80×44) ; le défaut `link` ne change rien aux autres écrans.
- `src/components/mobile-nav/MobileNavWrapper.tsx` — la fiche porte sa barre : nav globale masquée sur `/pays/xx`.

---

## 4. Captures

`audit-pays/` : `fr-apercu-430.png`, `fr-destinations-430.png`, `fr-activites-430.png`, `fr-culture-430.png`, `fr-gastronomie-430.png`, `fr-hebergements-430.png`, `fr-pratique-430.png`, `fr-communaute-430.png`, `fr-drawer-details-430.png`, `fr-768.png`, `fr-1440.png`, `diff-avant-apres.png`.
Avant : `/Users/fr168256/lkdv/audit/pays-2026-10-25/avant/`.

---

## 5. Recette

| Contrôle | Résultat |
|---|---|
| `design:fidelity /pays/fr` | **19/19** |
| `design:fidelity /compte` (référence) | **19/19** |
| `scrollHeight = innerHeight` 430 / 768 / 1440 | 932 / 1024 / 900 |
| Colonne 430 centrée à 768 et 1440 | 430 × 1024 et 430 × 900, aucun cadre téléphone |
| 8 sections cliquées, contenu réel vérifié | OK (météo 14 °C, 18 lignes pratique, 8 lignes communauté) |
| Drawer ouvert | 12/48/406×541, barre basse sortie |
| Erreurs console | 0 |
| Tests `pays` + `discovery` + `design` + `countries_geo` | **192 passés, 6 ignorés, 0 échec** |
| `tsc --noEmit` | en cours de vérification finale (voir §7) |

---

## 6. Décisions appliquées

1. **Socle** : grammaire réutilisée telle quelle (`compte-v8.css` + `compte-apple-hig.css` + primitives `src/components/account/*`), pas de nouvelle feuille d'écran. La lentille liquide est partagée.
2. **Desktop** : colonne 430 centrée + drawers. Les blocs desktop (nav, carte, table pratique, PDF) sont relogés : nav → pilule + barre, carte → mapzone, table pratique → section Pratique, PDF → bouton haut.
3. **Barre basse** : rendue à 48 px sur la fiche (les autres écrans seront alignés dans le lot dédié).
4. **Sections vides** : état vide honnête + action (Hébergements, Communauté sans publication).

---

## 7. Ce qui reste (lots suivants)

| Lot | Reste à faire |
|---|---|
| 4 bis | Tuiles typographiques pour les sections sans photo (aujourd'hui : bascule forcée en liste) |
| 5 | Drawer « Pratique » dédié (aujourd'hui la pratique est une liste dans la carte), partage, sources |
| 6 | Restyle grammatical des vues historiques montées dans le drawer (Discovery/Klook/Pratique IA encore en verre sombre) |
| 7 | Barre basse globale 48 px sur tous les écrans (décision 3) |
| 8 | Recette complète PT/NP (pays avec contenu), invité, 404, diff pixel par section |
| — | Zone carte : enrichir le rendu (contour pays depuis `countries_geo.geometry`) |

**Écarts documentés**
- `.pwrap`/`.stage` de la maquette Compte neutralisés en ≥768 (le vrai écran n'est pas un châssis de téléphone).
- Drawer : la grammaire a trois générations (`.sheet` `data-det`, `lkdv-drawer-root`) ; la fiche utilise la boîte mesurée (12/48/406×541) avec la typographie §2.
- La galerie de tuiles n'affiche pas de légende : la légende vit dans la liste (la référence met le texte dans le SVG de la tuile).
