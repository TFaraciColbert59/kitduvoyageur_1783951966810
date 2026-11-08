# Audit exhaustif des écarts : Maquette HTML vs Implémentation Fiche Carnet v2

Date : 2026-11-08  
Source de référence maquette : `handoff/carnet-v2/annexes/maquette-fiche-carnet.html` (290 Ko, HTML/CSS/JS vanilla)  
Captures de référence : `docs/audit/carnet-v2-2026-11-08/captures/maquette-390x844.png` vs `preview-carnet-390x844.png`  
Composants analysés : `src/components/carnet/v2/*` et `src/features/carnet/detail/*`

---

## Synthèse globale

L'implémentation v2 a réussi la transition vers l'architecture de données Next.js App Router + Supabase, le branchement de la carte réelle MapLibre (ADR-002), le moteur de tiroir `SlotShell` 5 onglets, l'affichage réactif des jours/moments et les interactions sociales (likes, commentaires, stories, clonage de kit, live position).

Cependant, plusieurs raffinements visuels et micro-interactions avancées présents dans le fichier HTML de démonstration ont été simplifiés ou différés. Voici la liste exhaustive de **toutes les différences relevées**.

---

## 1. Barre supérieure & Menus (`.top`, `.ig-top`)

| Élément maquette | Implémentation React | Écart & Impact visuel | Priorité |
|---|---|---|---|
| **Pilule titre `.rp` morphing** | `CarnetTopBarV2.tsx` (bouton standard + menu déroulant) | Dans la maquette, la pilule titre s'élargit avec un morphing fluide (`animation: morph .5s var(--ease-spring)`), possède un point vert d'édition pulsant `.edot` quand `isEditing`, et devient la feuille de menu `.rmenu`. En React, c'est un menu dropdown classique sans morphing géométrique. | Moyenne |
| **Bouton & Dialogue d'affichage `#popv`** | `CarnetTopBarV2.tsx` (state partiel) | La maquette propose un bouton verre circulaire ouvrant un panneau popover `.popv` contenant deux switches iOS haute fidélité : « Plein soleil » (mode outdoor) et « Réduire les animations ». Dans le code React, seul le basculement outdoor est partiellement exposé, sans le dialogue à deux commutateurs HIG. | Faible |
| **Bouton Notifications avec badge dynamique** | Présent dans `ig-top-r` de la maquette | Dans la maquette, une cloche avec badge de notification ouvre le tiroir d'activité avec filtre unifié. En React, l'icône redirige ou n'est pas connectée au même tiroir d'activité. | Faible |

---

## 2. Carte & Navigation altimétrique (`.mapzone`, `#acc`, `.tb`)

| Élément maquette | Implémentation React | Écart & Impact visuel | Priorité |
|---|---|---|---|
| **Accessoire d'altitude interactif `#acc` (Sparkline Scrubber)** | **ABSENT** dans `CarnetScreenV2.tsx` | **Écart majeur.** Dans la maquette, juste au-dessus de la barre d'onglets basse se trouve une capsule `.acc` avec profil SVG d'élévation (`.spk`), affichage du dénivelé (`+1 250 m`), et un scrubber tactile qui déplace en direct un curseur point `.sd` sur le tracé de la carte. En React, la barre d'onglets est posée seule sans ce widget altimétrique. | **HAUTE** |
| **Marqueurs de carte (SVG personnalisé vs WebGL)** | `CompteMap` (MapLibre WebGL) | Dans la maquette, les marqueurs sont en pur DOM/SVG (`.mk.carnet`, `.mk.nbadge` pour les nuits N1/N2/N3, `.mk.live` avec halo pulsant, et `.mk.zone` cercle en pointillés). `CompteMap` utilise des marqueurs MapLibre standards qui n'ont pas exactement le même styling verre / typographie monospace que les marqueurs HTML de la maquette. | Moyenne |
| **Poignée d'agrandissement de la carte `.mgrab`** | Bouton toggle `mapBig` dans le HUD | Dans la maquette, une poignée tactile `.mgrab` à cheval entre la carte et le profil permet de glisser verticalement pour passer en mode 69% carte. En React, l'agrandissement se fait par un bouton d'agrandissement classique. | Faible |
| **Lentille chromatique sur la barre d'onglets `.tb.drag`** | `FloatingLiquidTabBar` unifiée | Dans la maquette, la lentille possède des reflets chromatiques roses/bleus lors du glissement (`inset 2px 0 2px rgba(255,120,160,.18)`, `scale(1.14)`). La barre d'onglets unifiée du projet utilise l'effet de verre standard sans ces reflets spécifiques. | Faible |

---

## 3. Grille des moments & Gestes tactiles (`CarnetPostGrid`, `.ctx`)

| Élément maquette | Implémentation React | Écart & Impact visuel | Priorité |
|---|---|---|---|
| **Menu contextuel Peek & Pop (`.ctx` / `#ctxbox`)** | **ABSENT** dans `CarnetScreenV2.tsx` | Dans la maquette, un appui long (460 ms) sur une vignette de la grille affiche un overlay flouté `.ctx` avec agrandissement dynamique de la photo et 5 actions rapides (J'aime, Commenter, Enregistrer, Partager, Signaler). En React, l'appui long ne fait rien ou ouvre directement la fiche de post sans aperçu flottant. | **HAUTE** |
| **Pastilles d'indicateur de type sur les tuiles** | `CarnetPostGrid.tsx` | Dans la maquette, chaque tuile de la grille affiche dans le coin supérieur une pastille verre miniature indiquant le type de moment (appareil photo, plume de récit, couvert de repas, tente de bivouac, panorama). En React, certaines vignettes n'affichent pas la pastille typée si le média est manquant. | Moyenne |
| **Swipe horizontal des jours (`CarnetDaySwipeView`)** | Présent mais sans inertie physique de friction | La maquette utilise un amorti `cubic-bezier(.16,1,.3,1)` avec résistance élastique sur les bords (overscroll bounce). Le composant React utilise un défilement CSS scroll-snap sans la résistance personnalisée. | Moyenne |

---

## 4. Tiroir unifié (`CarnetDrawerV2` / `SlotShell`)

| Élément maquette | Implémentation React | Écart & Impact visuel | Priorité |
|---|---|---|---|
| **Pilule flottante « Reprendre » (`.pill-resume`)** | **ABSENTE** dans `CarnetDrawerV2.tsx` | Dans la maquette, lors de la navigation dans la liste des objets du sac ou dans une sous-fiche, une pilule `.pill-resume` (« Reprendre la lecture ») reste ancrée en bas à gauche (`left: 10px; bottom: 10px`) pour revenir d'un geste à sa position. En React, seul le chevron `< Retour` en haut de la fiche est disponible. | **HAUTE** |
| **Verdicts matériel (Top / Flop / Neutre)** | Désactivés par fallback résilient (code PostgREST `42703`) | Dans la maquette, chaque objet du kit a un verdict stylisé (`.v-top` vert sauge, `.v-flop` terre cuite, `.v-neutre` gris perle) avec tri par verdict. En production, ces colonnes ne sont pas encore migrées sur la base distante, donc les verdicts ne sont pas affichés. | **HAUTE (données)** |
| **Animation d'ouverture cascade de lignes** | Affichage par bloc standard | La maquette applique un délai séquentiel échelonné (`0s / 0.03s / 0.06s / 0.09s / 0.1s`) sur chaque carte ou ligne lors de l'ouverture d'un onglet du tiroir. En React, le rendu se fait d'un bloc. | Faible |
| **Lentille Chiffres - Émissions & Budget** | Données simulées partielles | La maquette affiche un camembert d'émissions carbone estimées et une ventilation budgétaire. En React, ces sections sont réduites si les données ne sont pas présentes sur le carnet Supabase. | Faible |

---

## 5. Accès & Middleware (Authentification)

| Élément maquette | Implémentation React | Écart & Impact visuel | Priorité |
|---|---|---|---|
| **Consultation anonyme (Visiteur libre)** | **Bloquée par Middleware Next.js** (Redirection 307 vers `/connexion`) | La maquette HTML est immédiatement consultable par n'importe qui sans login. En production LKDV, le middleware Next.js impose une session active pour `/carnets/[id]`. C'est pourquoi un visiteur non authentifié voit la page de login au lieu de la fiche publique. | **HAUTE (décision produit)** |

---

## Plan d'action pour alignement à 100%

1. **Lot UI-1 (Barre altimétrique `#acc`) :** Intégrer le composant `CarnetAltitudeSparkline` au-dessus de `FloatingLiquidTabBar` avec synchronisation du curseur sur `CompteMap`.
2. **Lot UI-2 (Peek & Pop `.ctx`) :** Ajouter le composant `CarnetPeekContext` dans `CarnetScreenV2` déclenché par l'appui long sur `CarnetPostGrid`.
3. **Lot UI-3 (Pilule Reprendre) :** Injecter le bouton flottant `.pill-resume` dans le slot Sac et la fiche objet.
4. **Lot DB-1 (Supabase Production) :** Appliquer la migration `20261108100004_carnet_kits_clones.sql` sur Supabase pour activer les verdicts sans fallback.
5. **Lot PROD-1 (Middleware) :** Autoriser la lecture publique anonyme sur `/carnets/[id]` pour les carnets avec `visibility = 'public'`.
