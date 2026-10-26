# Messagerie — verre de la carte, décollage des bords, gestes au doigt

**Date :** 2026-10-26
**Commit :** 2ee4dd44
**Prod :** https://kitduvoyageur.faracitonyp.workers.dev/messagerie — version `eb0adeaa` (déployée 08:28 locale)

## Objectif

Trois demandes, une seule zone : la conversation.

1. Plus de fond sombre sur les bulles : matière translucide identique à la carte du Compte.
2. Contenu décollé des bords.
3. Animation de swipe entre les écrans, jouable au doigt.

## Référence

| Élément | Référence | Valeurs reprises |
|---|---|---|
| Matière de la carte | `compte-v8.css` `.cs` | `linear-gradient(180deg, rgba(255,255,255,calc(--ga + .3)), rgba(255,255,255,calc(--ga + .2)))`, `blur(calc(--gb + 18px)) saturate(1.8) brightness(1.05)`, mêmes ombres |
| Transition d'écran | `compte-v8.css` `.phone.mapbig` | `grid-template-rows` animé `.52s cubic-bezier(.32,.72,0,1)` |
| Feuille | `compte-apple-hig.css` `.sw-wrap[data-det]`, `.sheet` | glissement vertical, seuils 110 px / 0,55 px·ms⁻¹ |
| Rangée | `MessagesScreen` `.ig-feed-row` | swipe horizontal existant, conservé |

## Ce qui change

### Matière

- `.map` (zone de conversation) devient **la carte** : même dégradé et même `backdrop-filter` que `.cs`. La photo du fond devient une texture, plus un décor.
- `.bub` redevient un **chip plat translucide** posé sur cette carte : blanc `.68 → .52`, menthe `.78 → .62` pour « moi ». Plus de double verre (un seul verre par écran, règle de la grammaire).
- `prefers-reduced-transparency` : fonds pleins `#fbfaf6` / `#e7f0e8`.
- `content-visibility: auto` retiré de `.bub` (il annulait le `backdrop-filter` de la carte).

### Respiration

- Fil : `padding: 14px 16px 18px`, `scroll-padding-bottom: 18px` ; filet court ancré en bas (`margin-top: auto` sur le premier enfant).
- Composer : verre de la carte (`--ga` + `.32`), champ verre blanc `.52`, padding `10px 16px`.
- En-tête : hauteur 48, padding `0 18px 0 16px`, surface de verre.
- Carte liste : `12px 16px 54px`, rangées `8px 12px 8px 10px`, sélecteur `right: 12px`, `bottom: 10px`.
- Étiquette de jour : pastille blanche `.82` avec hairline.

### Écrans et gestes

- Sélection d'une conversation → `.phone.mapbig` : la carte liste se replie (`335px → 108px`), s'efface, le fil prend la place ; la barre basse sort (règle de la grammaire). Retour animé au clic sur ✕ ou au geste.
- `.mpane` : entrée `translateY(14px) scale(.995)` `.36s` ; sortie `.22s`.
- **Doigt** : tirer l'en-tête vers le bas fait suivre le volet (opacité liée), ferme au-delà de 84 px ou `0.7 px·ms⁻¹`. Tirer vers le haut ouvre la feuille au-delà de 28 px réels (résistance `0.5` à l'affichage).
- La capture de pointeur n'est posée qu'après 6 px : les boutons de l'en-tête gardent leur clic (régression attrapée en recette).
- Tiroir : suit le doigt, résistance après 120 px, ferme à 110 px ou `0.55 px·ms⁻¹`.
- Filtres : la liste glisse dans le sens du filtre (`slide-next` / `slide-prev`, `.26s`) au lieu du fondu mort.
- Tiroir de conversation : actions en 2 colonnes (Options / Accusés / Notifications / Quitter), volet derrière effacé (plus deux fils ni deux composers).

## Preuves (430 × 932, prod)

| Vérification | Mesure |
|---|---|
| Bulle « moi » | `linear-gradient(rgba(196,219,198,.78), rgba(174,203,177,.62))`, texte `rgb(23,43,36)` |
| Zone de conversation | `y 108 → 932` (plein écran), version `mapbig` |
| Fil | `padding: 14px 16px 18px` |
| Barre basse | `opacity: 0` dans un fil, revient à la fermeture |
| Clic « Ouvrir en grand » | feuille `data-det="open"`, volet `opacity: 0` |
| Glissement feuille | suivie puis fermeture (`open: false`, volet `1`) |
| Swipe haut en-tête | feuille ouverte |
| Glissement volet | `translateY(160px)` visible, fermeture, `.phone` revient à `hasnext` |
| Filtre « Directs » | classe `slide-next`, animation `mlist-next .26s` |
| Console | 0 erreur |

Captures : `audit-msg/F-list.png`, `F-conv.png`, `F-sheet.png`, `F-drag-pane.png`, `F-drag-sheet.png`.

## Tests

- `tsc --noEmit` : 0 erreur (worktree isolé au commit).
- `eslint` : 0 erreur sur `MessagesScreen.tsx`.
- `vitest` : 12 493 passants / 81 échecs **préexistants** (audit garde-fous, communauté v3, compte v8 — fichiers non touchés par ce lot). Aucun test ne mentionne la messagerie.

## Conflit de déploiement (à trancher)

Trois worktrees déploient le même Worker `kitduvoyageur` avec **deux designs de /messagerie** :

- celui-ci (`MessagesScreen`, grammaire Compte, clair) ;
- `lkdv-communaute-feed` / `lkdv-cf-demo` / `lkdv-cf-carnet` (`MessageInbox`, liste sombre plein écran).

Séquence observée le 2026-10-26 : mon déploiement `35a42744` à 07:21Z, puis `3b5ed0bd` (autre session) à 07:26Z, puis `eb0adeaa` (ce lot) à 07:28Z. Tant que les deux sessions tournent, la prod peut changer d'apparence sans commit de ce lot.

## Hors périmètre

- Virtualisation du fil, `useOptimistic`, images, recherche locale (lot C précédent).
- Présence en ligne, épingler/supprimer (schéma Supabase).
- Swipe horizontal entre les cinq écrans de l'application (Hub / Explorer / Communauté / Messages / Compte) : ce lot couvre les écrans **de la messagerie**.
