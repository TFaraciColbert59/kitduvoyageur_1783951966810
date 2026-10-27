# Création — 50 améliorations visuelles d’affichage de l’information

**Date :** 2026-10-27
**Périmètre strict :** drawer Création + sous-drawers formulaires. Aucun autre écran.
**Méthode :** `ui-ux-pro-max` (formulaires, divulgation progressive, labels, mobile), `apple-ui-designer` (HIG, feuilles, profondeur, motion), `ux-mobile` (toucher, feedback, états), `frontend-design` (identité, hiérarchie, copie).
**Exa MCP :** **non exposé dans cette session** (aucun serveur `exa` disponible). Les références ci-dessous viennent des docs officielles des librairies.

## Intention

Faire circuler l’information comme un **carnet de voyage** : ticket, étape, ruban d’itinéraire, balance de portage, tampon, aperçu. Pas de cartes génériques partout ; chaque sous-drawer a une **forme de lecture** adaptée à sa donnée.

## Librairies installées

| Besoin | Librairie |
|---|---|
| Feuilles/detents/gestes | `vaul` |
| Dates et plages | `react-day-picker` |
| Dépôt média | `react-dropzone` |
| Listes réordonnables | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| Longues listes | `@tanstack/react-virtual` |
| Popover / tabs / select / tooltip / accordion | Radix UI |
| Déjà présent | `framer-motion`, `cmdk`, `recharts` |

Références : [shadcn/ui Forms](https://ui.shadcn.com/docs/forms), [Vaul](https://vaul.emilkowal.ski/), [React DayPicker](https://daypicker.dev/), [react-dropzone](https://react-dropzone.js.org/), [dnd-kit](https://dndkit.com/), [TanStack Virtual](https://tanstack.com/virtual/latest), [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover).

---

## A. Drawer Création — coquille (1–7)

1. **Sélecteur de type** — afficher chaque type comme une **mini-étiquette de format** : icône, mot-clé, exemple de sortie. *Radix Tabs + framer-motion.*
2. **Bandeau de contexte** — remplacer le vide par un **ticket** compact : type d’objet, étape courante, état du brouillon. *CSS + framer-motion.*
3. **Rail d’étapes vertical** — afficher les étapes comme des **tampons de passeport** sur le bord gauche, avec état terminé/actif/à venir. *Radix Tabs.*
4. **Aperçu flottant** — une carte d’aperçu **repliable** en haut, qui se réduit au scroll et montre le rendu réel. *framer-motion layout.*
5. **Anneau de progression** — un petit **anneau de complétion** dans le coin du footer, avec `3/5` et le temps de brouillon. *SVG + framer-motion.*
6. **Aides contextuelles** — des **puces d’information** (icône + valeur) au-dessus des champs, jamais un paragraphe. *Radix Tooltip.*
7. **État vide/chargement** — un **squelette de formulaire** qui reprend la forme des champs, pas un spinner plein écran. *CSS skeleton.*

## B. Publication (8–16)

8. **Galerie de formats** — Photo / Billet / Question / Événement en **tuiles avec silhouette** et micro-exemple. *Radix Tabs.*
9. **Contact sheet média** — bande horizontale de vignettes, **étoile de couverture**, badge alt et bouton réordonner. *react-dropzone + dnd-kit.*
10. **Surface de légende** — zone d’écriture avec **anneau de caractères** et compteur de mentions. *CSS + framer-motion.*
11. **Lieu** — **puce carte** avec mini-map, épingle et bouton retirer, au lieu d’un champ texte seul. *MapLibre existant + Radix Popover.*
12. **Tags** — **nuage de chips** avec compteur d’usage et bouton `+` discret. *Radix Popover.*
13. **Audience** — **carte de confidentialité** à trois couches visuelles : public, abonnés, club. *Radix Select.*
14. **Sondage** — **barres d’options** éditables avec pourcentage potentiel et bouton supprimer. *CSS + dnd-kit.*
15. **Événement** — **ticket horaire** : date, heure, durée, participants sur une ligne visuelle. *react-day-picker + CSS.*
16. **Aperçu + reçu** — carte feed réelle, puis **reçu de publication** avec lien copiable et état. *framer-motion + Sonner-like toast existant.*

## C. Story (17–23)

17. **Cadre 9:16** — afficher la zone sûre, les marges et la zone UI comme un **cadre de viseur**. *CSS + framer-motion.*
18. **Liste de calques** — overlays texte/lien en **pile de calques** réordonnables. *dnd-kit.*
19. **Barre de style texte** — **contrôles visuels** : fond, alignement, taille, couleur. *Radix Tooltip + Tabs.*
20. **Timeline média** — trim vidéo sous forme de **ruban** avec poignées. *CSS + pointer events.*
21. **Résumé audience/réponse** — **pillule de diffusion** avec icônes et état. *Radix Select.*
22. **Progression d’upload** — **anneau de progression** sur la vignette, pas une barre globale. *framer-motion.*
23. **Aperçu Story** — téléphone miniature avec overlays et progression. *framer-motion.*

## D. Carnet (24–31)

24. **Mosaïque de couverture** — 1 grande + 2 petites images, avec **badge cover**. *CSS grid + dnd-kit.*
25. **Plage de dates** — **calendrier double mois** et compteur de nuits dans une pillule. *react-day-picker.*
26. **Timeline d’étapes** — chaque jour est un **tampon vertical** : départ, arrivée, distance, D+. *dnd-kit.*
27. **Ruban d’itinéraire** — carte + **ruban de route** reliant les étapes, avec zoom. *MapLibre existant.*
28. **Profil altimétrique** — mini **courbe D+** sous la timeline, sans axe lourd. *recharts.*
29. **Logistique** — **checklist en cartes** : eau, nourriture, permis, météo, urgences. *Radix Accordion.*
30. **Kit lié** — **carte kit** avec poids et couverture, lien direct. *CSS card.*
31. **Récit & partage** — **bande de moments** (photos/citations) + **pile d’avatars** collaborateurs + résumé visibilité. *framer-motion.*

## E. Sortie (32–38)

32. **Cartes d’activité** — rando, bivouac, alpinisme, ski, vélo, eau avec **pictogramme + terrain**. *Radix Tabs.*
33. **Timeline date/heure** — **ticket de départ** avec durée et fuseau. *react-day-picker.*
34. **Point de rendez-vous** — **carte compacte** avec épingle et bouton itinéraire. *MapLibre.*
35. **Jauge de difficulté** — **échelle visuelle** (facile → engagé) avec couleur et texte. *SVG + framer-motion.*
36. **Capacité** — **barre de remplissage** participants + liste d’attente. *CSS + Radix Progress-like.*
37. **Sécurité** — **checklist de sécurité** avec icônes et état. *Radix Accordion.*
38. **Aperçu sortie** — carte événement avec date, lieu, places et CTA. *framer-motion.*

## F. Kit (39–44)

39. **Inventaire** — lignes **photo + nom + usure** avec jauge fine et sélection. *TanStack Virtual + CSS.*
40. **Pile de poids** — **barres empilées** base / porté / consommable, avec total. *recharts.*
41. **Anneau de complétude** — **score par catégorie** autour d’un anneau, pas un pourcentage seul. *SVG.*
42. **Objets custom** — **liste réordonnable** avec poignée, poids et catégorie. *dnd-kit.*
43. **Structure** — **groupes de catégories** avec compteurs et poids. *Radix Accordion.*
44. **Partage** — **carte kit** avec poids, items, visibilité et aperçu. *framer-motion.*

## G. Club (45–50)

45. **Identité** — **aperçu de marque** : cover, logo, nom, catégorie, lieu. *CSS + framer-motion.*
46. **Règles** — **accordéon de règles** avec compteur et état. *Radix Accordion.*
47. **Questions d’adhésion** — **stepper de questions** (1/3, 2/3), pas trois champs empilés. *Radix Tabs.*
48. **Modes d’adhésion** — **cartes visuelles** ouvert / sur demande / invitation. *Radix Select.*
49. **Lien d’invitation** — **carte de partage** avec URL, copie et QR potentiel. *Radix Popover.*
50. **Aperçu club** — carte club avec membres, événement et CTA. *framer-motion.*

---

## Règles transverses

- **Une information = une forme** : ticket, tampon, ruban, jauge, pile, calendrier.
- **Pas de label au-dessus de chaque bloc** : l’icône et la forme portent le sens ; le texte reste une valeur.
- **Divulgation progressive** : l’essentiel visible, le reste dans un popover/accordéon.
- **44×44** pour toute action, focus visible, reduced-motion.
- **Une seule couche de blur** par feuille ; pas de blur sur les listes longues.
- **Pas de nouvelle couleur** : tokens LKDV existants.
- **Pas de nouvelle dépendance UI** sans usage réel.

## Lots d’implémentation

1. Coquille : 1–7.
2. Publication : 8–16.
3. Story : 17–23.
4. Carnet : 24–31.
5. Sortie : 32–38.
6. Kit : 39–44.
7. Club : 45–50.
8. Recette visuelle + build Vercel.
