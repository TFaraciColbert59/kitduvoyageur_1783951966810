# REVIEW — Trailer LKDV « Une phrase suffit » (première version)

## Choix créatifs

- Construit : la piste **A « Une phrase suffit »** (`STORYLINES.md`) : une phrase saisie dans le Compas traverse tout le film
  (carte → groupe → kit → sac 3D → terrain → carnet/communauté → badge). Non construites : B « Le sac qui se remplit », C « Avant / après ».
- Inspirations reçues (2 reels Instagram, 6 TikTok ; 5 TikTok et 2 reels téléchargés, 1 TikTok indisponible) : reprises comme grammaire,
  pas copiées — cartes photo arrondies qui défilent sur le temps (reels voyage), interface produit agrandie qui agit (Qonto, Spotify),
  vol de carte vers un lieu réel (Google Maps), titres mot à mot avec un mot en italique (motion designer « 5 étapes »).
- Look : le Liquid Glass du Compas sur les vraies photos de la marque ; accent italique EB Garamond (substitut libre de Georgia).
- Accroche : la phrase d'accueil réelle du site, « Là où la carte se termine. »
- Musique : « Ambient Uplift » (Soundrider/Dope, CC BY 3.0), lue à partir de 14,565 s pour que l'intro calme porte l'envie et les questions,
  et que la piste s'ouvre exactement sur le clic « Préparer mon aventure » (11,70 s).

## Ce qui a été mesuré / seulement regardé

- `hyperframes check` : 0 erreur. Avertissements gardés volontairement :
  - `line_unread` sur les textes d'interface du Compas (description, mention IA, placeholder) : c'est le décor réel du panneau, pas un texte à lire ; la phrase tapée et le bouton, eux, sont lisibles.
  - `text_below_floor` sur les étiquettes secondaires des panneaux « Nous » / « Kit » et du Kit Studio (22–26 px) : contexte d'interface reproduit à l'échelle 1,6×.
  - `console_warning` Three.js (`KHR_parallel_shader_compile`) : sans effet sur le rendu logiciel.
- Revue image par image : `snapshot --review` (beats, coupes, largeur téléphone 360 px) puis captures ciblées après corrections.
- Son : niveaux et points d'impact **mesurés** (`hyperframes audio`), **pas écoutés**. Le mix n'a été entendu par personne.

## Corrections faites après la première revue

- P0 · 0–4 s · fond vert uni derrière les cartes photo (le « vide sombre » banni) → fonds flous des mêmes photos qui suivent chaque carte.
- P1 · 41 s · écran SOS presque vide → écran « Refuge du Lac Blanc » (refuges et points d'eau).
- P1 · 19,2 s · les puces d'étapes disparaissaient à la coupe → elles glissent avec la carte puis s'effacent.
- P1 · audio · effets sans durée qui se prolongeaient jusqu'à la fin → durées réelles, pistes séparées ; riser et impact calés sur leur pic mesuré.
- P2 · fin · bouton « lekitduvoyageur.fr » recentré sous le badge ; crédit Esri ajouté sur la carte de la scène « groupe ».

## Plan le plus faible et pistes

- **Écrans téléphone (38–56 s)** : captures existantes en 1× (390 px de large) pour la plupart ; lisibles mais moins nets que le reste.
  Avec un compte de démonstration qui fonctionne en production (la connexion démo répond `demo_login_failed`), refaire ces captures en 3×
  et filmer le Compas en vrai au lieu de le reconstruire.
- Le Compas, le groupe et le kit montrent le **jeu de démonstration** (`labData.ts`) : à remplacer par un voyage réel quand il y en aura un à montrer.
- Variante verticale 9:16 pour TikTok/Reels : même histoire, à recadrer scène par scène (non faite).
- La raie claire de l'imagerie Esri près du Cirque de Troumouse est dans la donnée satellite elle-même.
