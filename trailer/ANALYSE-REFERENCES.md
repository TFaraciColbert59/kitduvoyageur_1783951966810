# Analyse des trois vidéos de référence

Mesure faite le 11/11/2026 : téléchargement avec yt-dlp, puis détection des coupes avec FFmpeg (`select='gt(scene,0.3)'`) et planches contact à 2 images/s. Les fichiers restent hors du dépôt (droits des auteurs) ; on n'en reprend que le rythme et la grammaire.

## Coupes mesurées

| Référence | Durée | Coupes (s) | Durée des plans | Ce qui ressort |
|---|---|---|---|---|
| TikTok, bande-annonce d'un jeu vidéo en Floride | 30,1 s | 1,77 · 4,23 · 5,07 · 7,80 · 9,33 · 10,87 · 12,93 · 14,30 · 16,90 · 18,43 · 19,97 · 21,90 · 22,53 · 23,83 · 25,73 · 26,37 | 0,6 à 2,7 s, moyenne 1,7 s | Plans aériens saturés, raccords par la couleur (rose, puis turquoise, puis or, puis néon), personnages en pleine action, nuit qui accélère le rythme, logo final tenu sur fond noir |
| Instagram, 10 lieux au Kazakhstan | 12,6 s | 1,12 · 2,36 · 3,56 · 4,72 · 5,84 · 8,04 · 9,08 · 10,08 · 11,36 | 1,0 à 1,25 s, d'une régularité de métronome | Une silhouette **minuscule** dans un paysage immense ; chaque plan a une couleur dominante différente (rouge, blanc, ocre, turquoise) ; caméra quasi fixe, l'impact vient de l'échelle et de la couleur |
| Instagram, Socotra (« another planet ») | 18,5 s | 6,64 · 8,40 · 9,84 · 11,36 · 12,64 · 14,24 · 15,80 · 17,20 | Un plan d'ouverture de 6,6 s, puis 1,4 à 1,8 s | Dune blanche en diagonale, éclat du soleil qui entre dans le cadre, une petite personne seule, contrastes violents de matière (sable, eau turquoise, arbres-dragons, grotte en contre-jour) |

## Ce qu'on garde pour LKDV

1. **Coupe sur le temps, 1,0 à 1,8 s.** Règle confirmée : aucun plan au-delà de 2 s sans coupure. Le plan d'ouverture de 6,6 s de Socotra est exactement ce qu'on s'interdit. Dans la trame v3, le plan le plus long dure 1,8 s.
2. **L'échelle.** Des plans « personnage minuscule dans un décor immense » ponctuent l'action (images 09, 19, 30, 35b), en alternance avec des très gros plans de matière (pied, roue, boucle). C'est cette alternance immense/minuscule qui donne la claque.
3. **Une couleur dominante par plan, et le raccord par la couleur.** Turquoise du lac → vert forêt → or du gravel → orange du feu → bleu de nuit.
4. **L'éclat du soleil comme coupe.** Le flare entre dans le cadre et blanchit l'image sur 2 à 4 images ; on l'utilise aux plans P01→P02, P26→P27 et P39→P40.
5. **La nuit accélère.** Le bivouac et le final ont des plans plus courts (0,8 à 1,2 s) jusqu'au logo.
6. **Pas de titres.** Les deux reels écrivent les noms des lieux à l'écran ; pas nous (aucune phrase à l'écran). L'identité passe par le HUD LKDV.

## Ajouts aux prompts ChatGPT

Ajouter cette phrase à la bible (Message 1) :

```
Grammaire visuelle : alterner des plans où le personnage est MINUSCULE dans un paysage immense (moins de 5 % de la hauteur de l'image, seul, au tiers central) et des très gros plans de matière. Chaque image a UNE couleur dominante franche et naturelle (turquoise, vert forêt, or, orange de feu, bleu nuit). Quand le soleil est dans le cadre, laisse un vrai éclat d'objectif.
```

Images à repasser en « personnage minuscule » : img09 (ajouter Léa minuscule sur un rocher au bord du lac, sauf quand l'image sert de photo de carnet : en générer deux versions, img09 sans personnage et img09b avec), img19, img30, img35b.
