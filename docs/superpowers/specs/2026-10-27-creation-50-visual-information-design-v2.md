# Création — 50 améliorations visuelles, v2 sourcée Exa

**Date :** 2026-10-27
**Périmètre :** drawer Création + sous-drawers Publication, Story, Carnet, Sortie, Kit, Club. Rien d’autre.
**Skills :** `ui-ux-pro-max`, `apple-ui-designer`, `ux-mobile`, `frontend-design`.
**Recherche :** Exa MCP (`web_search_exa`) + docs officielles.

## Recherche Exa — ce qui est retenu

| Source | Apport | Décision |
|---|---|---|
| [shadcn/ui — Drawer](https://ui.shadcn.com/docs/components/base/drawer) | Le Drawer shadcn est passé à **Base UI** (plus Vaul). | On garde la feuille LKDV existante ; pas de migration risquée. Vaul reste dispo pour un futur composant. |
| [shadcn/ui — Forms](https://ui.shadcn.com/docs/forms) | Formulaires React Hook Form + Zod, labels/erreurs structurés. | On garde RHF/Zod, on ajoute des **field shells** avec label visible + description + erreur locale. |
| [shadcn.io — File Upload Gallery](https://www.shadcn.io/blocks/file-upload-gallery-grid.mdx) | Grille de médias, cover, légendes, suppression, réordonnancement. | Contact sheet + cover + alt + dnd-kit. |
| [DayPicker](https://daypicker.dev/) | Range, localisation, WCAG 2.1 AA, mobile. | Calendrier de plage dans une feuille, pas un champ texte. |
| [Vaul](https://vaul.emilkowal.ski/) | Drawer gestuel, detents. | Disponible ; la feuille actuelle garde son comportement. |
| [dnd-kit](https://dndkit.com/) | Listes/grids réordonnables accessibles. | Médias, étapes, objets custom. |
| [react-dropzone](https://react-dropzone.js.org/) | Dépôt de fichiers accessible. | Zone média, avec fallback clavier. |
| [TanStack Virtual](https://tanstack.com/virtual/latest) | Listes longues virtualisées. | Inventaire Kit. |
| [Radix UI](https://www.radix-ui.com/primitives/docs/overview/introduction) | Popover, tabs, select, tooltip, accordion. | Toutes les divulgations progressives. |

### Design system généré — arbitrage
`ui-ux-pro-max` proposait **Aurora UI** (bleu ciel `#0EA5E9`, orange `#EA580C`) et **Cormorant/Crimson**. Je **rejette** ces trois choix : LKDV est déjà un univers vert forêt + verre + SF/system, et une serif académique casserait la lecture mobile. Je conserve uniquement :
- la structure **Scroll-Triggered Storytelling** comme progression ;
- le motion **stagger 300–450 ms** ;
- les règles de contraste, focus, reduced-motion.

## Intention
Chaque sous-drawer a **une forme documentaire** :
- Création = **passeport** ;
- Publication = **carte postale** ;
- Story = **viseur** ;
- Carnet = **ruban d’itinéraire** ;
- Sortie = **billet de départ** ;
- Kit = **balance de portage** ;
- Club = **écusson**.

Pas de grille de cartes identiques. Une information = une forme.

---

## A. Coquille Création (1–7)

1. **Sélecteur de format en billets** — 6 types, chaque billet a une encoche et un exemple de sortie ; le type actif s’ouvre de 8 px. *Radix Tabs + framer-motion.*
2. **Ligne de provenance** — `Brouillon · Photo · 2/4` avec point de sync, au lieu d’un titre. *CSS.*
3. **Colonne vertébrale d’étapes** — 4 tampons verticaux à gauche, reliés par un fil ; l’étape active est un anneau. *Radix Tabs.*
4. **Judas d’aperçu** — vignette 96×96 du rendu final, qui s’agrandit au tap et se replie au scroll. *framer-motion layout.*
5. **Pouls du brouillon** — point qui respire + « enregistré il y a 2 min », sans texte permanent. *CSS animation + reduced-motion.*
6. **Puces de contexte** — 3 max, dérivées du formulaire : lieu, audience, nombre de médias. *Radix Tooltip.*
7. **Squelette de formulaire** — la forme réelle des champs en ghost, shimmer 1,2 s, pas de spinner plein écran. *CSS skeleton.*

## B. Publication (8–16)

8. **Planche de formats** — Photo/Billet/Question/Événement en 4 tuiles avec silhouette et micro-exemple. *Radix Tabs.*
9. **Contact sheet média** — bande de vignettes 72 px, étoile de couverture, badge alt, compteur, réordre. *react-dropzone + dnd-kit.*
10. **Réglette de légende** — zone d’écriture avec graduations de caractères et compteur de mentions. *CSS + framer-motion.*
11. **Tampon de lieu** — mini-map + épingle + nom, au lieu d’un champ texte. *MapLibre + Radix Popover.*
12. **Constellation de tags** — chips dimensionnées par usage, maximum 5, ajout par popover. *Radix Popover.*
13. **Lentille d’audience** — trois couches visuelles (public, abonnés, club) avec « qui voit quoi ». *Radix Select.*
14. **Balance de sondage** — options en barres, pourcentage potentiel, ajout/suppression. *CSS + dnd-kit.*
15. **Billet d’événement** — date, heure, durée, participants sur un ticket à souche. *DayPicker + CSS.*
16. **Preuve de publication** — aperçu feed + reçu avec lien copiable, au lieu d’un toast seul. *framer-motion + toast existant.*

## C. Story (17–23)

17. **Viseur 9:16** — cadre avec zones sûres et zones UI exclues. *CSS + framer-motion.*
18. **Pile de calques** — overlays en cartes empilées, œil de visibilité, réordre. *dnd-kit.*
19. **Spécimen typographique** — 3 styles (légende, titre, citation), pas des sliders. *Radix Tabs.*
20. **Ruban de trim** — filmstrip, poignées, timecode, durée. *Pointer events + CSS.*
21. **Capsule de diffusion** — audience + droit de réponse en une pillule. *Radix Select.*
22. **Orbite d’upload** — anneau de progression sur la vignette, annulation locale. *framer-motion.*
23. **Contact sheet Story** — mini-téléphone avec segments de progression. *framer-motion.*

## D. Carnet (24–31)

24. **Mosaïque de couverture** — 1 grande + 2 petites, badge cover, réordre. *CSS grid + dnd-kit.*
25. **Ruban de dates** — départ/retour sur un ruban horizontal, nombre de nuits, calendrier en feuille. *DayPicker range.*
26. **Spine d’étapes** — jours en tampons : départ, arrivée, km, D+. *dnd-kit.*
27. **Ruban de route** — carte + ligne d’itinéraire + points d’étapes cliquables. *MapLibre.*
28. **Silhouette altimétrique** — courbe D+ en fond de spine, sans axes. *recharts.*
29. **Tableau logistique** — 4 tuiles : eau, nourriture, permis, météo ; statut prêt/à faire. *Radix Accordion.*
30. **Balance du kit lié** — carte kit avec poids et couverture. *CSS.*
31. **Bande de souvenirs + équipage** — pellicule photo, pile d’avatars, résumé visibilité. *framer-motion.*

## E. Sortie (32–38)

32. **Cartes de terrain** — 6 activités avec pictogramme et terrain, pas 6 onglets texte. *Radix Tabs.*
33. **Billet de départ** — date/heure/durée/fuseau sur un ticket. *DayPicker.*
34. **Épingle de rendez-vous** — carte compacte + itinéraire. *MapLibre.*
35. **Échelle de difficulté** — 4 marches visuelles, couleur en accent seulement. *SVG + framer-motion.*
36. **Jauge de capacité** — places remplies + liste d’attente + avatars. *CSS + Radix.*
37. **Manifeste de sécurité** — checklist avec badges « obligatoire ». *Radix Accordion.*
38. **Preuve de sortie** — aperçu événement avec date, lieu, places. *framer-motion.*

## F. Kit (39–44)

39. **Grand livre d’inventaire** — lignes virtualisées photo/nom/état/poids, sélection. *TanStack Virtual.*
40. **Pile de poids** — barre empilée base / porté / consommable + total. *recharts.*
41. **Anneau de catégories** — complétion segmentée par catégorie, tap sur segment. *SVG.*
42. **Cartes d’objets custom** — réordre, poignée, poids inline. *dnd-kit.*
43. **Matrice de portage** — besoin / possédé / manquant en 3 colonnes compactes. *CSS grid.*
44. **Passeport du kit** — carte de partage avec poids total et tampons de catégories. *framer-motion.*

## G. Club (45–50)

45. **Écusson du club** — cover, logo, nom, catégorie, lieu ; pas de bordure. *CSS.*
46. **Livre des règles** — accordéon numéroté, compteur de règles. *Radix Accordion.*
47. **Stepper d’adhésion** — une question à la fois, progression, aperçu des réponses. *Radix Tabs.*
48. **Cartes de mode** — ouvert / sur demande / invitation, avec qui peut entrer. *Radix Select.*
49. **Passe d’invitation** — lien, copie, expiration, QR. *Radix Popover.*
50. **Carte postale du club** — aperçu avec membres, prochain événement, CTA. *framer-motion.*

---

## Règles de fidélité

- **Une signature par sous-drawer**, pas 7 variations de la même carte.
- **Pas de titre de structure** : la forme et l’icône portent le sens ; les labels de formulaire restent visibles.
- **44×44** minimum, focus visible, `prefers-reduced-motion`.
- **Une seule couche de blur** par feuille ; pas de blur sur les listes longues.
- **Pas de nouvelle couleur** : tokens LKDV.
- **Divulgation progressive** : l’essentiel dans la feuille, le reste en popover/accordéon.
- **Pas de dépendance sans usage réel** : Vaul reste installé mais n’est pas imposé à la feuille actuelle.

## Lots

1. Coquille 1–7.
2. Publication 8–16.
3. Story 17–23.
4. Carnet 24–31.
5. Sortie 32–38.
6. Kit 39–44.
7. Club 45–50.
8. Recette mobile 430×932 + build Vercel.
