# Spécification produit — Kit Studio v2

Référence visuelle et comportementale : `reference/Kit_Studio_v2.html` (ouvrir dans WebKit mobile 402 × 874) et `reference/screens/`. En cas d'écart entre ce texte et la maquette v2, **la maquette v2 prévaut** pour le rendu, ce texte pour le code.

## Écran unique : la scène + le tiroir
- **Scène** : fond paysage, table, sac LKDV ONE en 3D au centre. Rien d'autre à l'écran que : la **pilule du poids** (bague de remplissage, kg, pastille de blocages) et le **tiroir**. Pas de barre haute, pas de bouton retour flottant (le retour passe par le tiroir ou le geste système).
- **Tiroir fermé** : seule la poignée blanche (140 × 30 px, barre 40 × 5) reste visible en bas ; la pilule est en haut.
- **Tiroir ouvert** (ouverture automatique 750 ms après l'entrée) : hauteur = 30 % de l'écran ; la pilule glisse jusqu'à 2 px au-dessus ; le sac monte et recule légèrement pour rester centré dans l'espace libre.

## Vues du tiroir (une seule à la fois, la nouvelle remplace l'ancienne)
| Vue | Contenu | Barre basse |
|---|---|---|
| **Cartes — Contenu** | Rail de cartes carrées (objets du catalogue, filtrés par famille) | Capsule de mode (gauche : Contenu / Apparence), points de pagination (centre), capsule de familles (droite : 6 icônes) |
| **Cartes — Apparence** | Cartes d'options de la pièce (coloris, forme du sac, modules, accessoires, matière, finition), bouton **Commander · N pièces · prix** sous les cartes quand il y a quelque chose à commander | Capsule de mode, points, capsule de catégories (forme, modules, coloris…) |
| **Bilan** (toucher la pilule) | 4 pages : poids et répartition, équilibre, journée par journée, « Prêt à N % » avec blocages | Bouton grille (retour aux cartes) + capsule de pages (icônes seules) |
| **Fiche objet** (toucher une carte du sac) | En-tête, 6 mesures en grille, notes, action (Retirer du sac / Mettre dans le sac) ; pages Échanger, Histoire | idem |
| **Sac / Pièce** | Configuration du corps, du châssis, des modules | idem |
| **Commande** | « Ta configuration », lignes de pièces, total, validation | idem |
| **Deck** | « Remplir le sac » et « Débrief » en cartes à valider une à une | idem |

## Interactions
- Glisser une carte vers le sac : l'objet suit le doigt (vol), la zone cible s'éclaire, avertissement si zone pleine (sans toast : la carte de la zone clignote et un retour haptique `warn` part).
- Appui long sur une option (mode Apparence) : essai sur le sac ; relâcher = garder ; glisser vers le haut = annuler. Le bouton **Annuler** n'existe plus en flottant : une icône ↺ vit dans la capsule de mode quand une annulation est possible.
- Orbite au doigt (1 doigt), inclinaison verticale, pincement = pièces séparées, double toucher = recentrer.
- Toucher la poignée ou glisser vers le bas : le tiroir se ferme (la pilule remonte). Échap ferme d'abord la vue ouverte, puis le tiroir, puis quitte.
- Mouvement réduit : pas de rebond, transitions ≤ 120 ms, caméra sans amortissement.

## États obligatoires pour chaque vue
Chargement (squelette de cartes, jamais de spinner plein écran), vide (`EmptyState`), erreur (⚠ + message + « Réessayer »), hors ligne (la scène et le dernier kit local restent utilisables ; l'envoi de commande est désactivé avec explication dans le tiroir).

## Textes
Français, tutoiement, vocabulaire du dépôt (« kit », « lignée », jamais de vocabulaire génétique, jamais de grade ni de classement). Espace insécable avant `%`, `:`, `€`. Poids : `820 g` sous 1 kg, `10,3 kg` au-dessus.

## Ce qu'on ne fait pas
Pas de titre ni de sous-titre flottant sur la scène, pas de toast, pas de bulle d'aide de découverte (la découverte passe par des états vides explicites), pas de bordure colorée, pas de bouton flottant, pas de menu qui s'ouvre vers le haut de l'écran.
