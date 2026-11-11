# Réception des images — trailer LKDV

Généré par `node tools/reception/check-footage.mjs` le 2026-11-11 13:50 (heure locale), dossier `assets/footage` (dossier absent). Ce fichier est réécrit à chaque passage ; l'outil ne modifie jamais les images.

- Images du film : **0 reçues / 50 obligatoires** (+ img21, plan de réserve facultatif ; 51 prompts au total).
- Fiches personnages : **0 / 7**.
- Manquantes obligatoires (57) : F1-lea.png, F2-sami.png, F3-ines.png, F4-tom.png, F5-malik.png, F6-clara.png, F7-noah.png, img01.png, img02.png, img03.png, img04.png, img05.png, img06.png, img07.png, img08.png, img09.png, img09b.png, img10.png, img40.png, img41.png, img11.png, img42.png, img43.png, img44.png, img12.png, img13.png, img14.png, img15.png, img16.png, img17.png, img18.png, img45.png, img19.png, img20.png, img46.png, img22.png, img23.png, img24.png, img25.png, img26.png, img27.png, img28.png, img47.png, img29.png, img30.png, img31.png, img32.png, img48.png, img33.png, img34.png, img35a.png, img35b.png, img36.png, img37.png, img49.png, img38.png, img39.png.
- Défauts bloquants : aucun · alertes à vérifier à l'œil : aucune.
- Noms presque justes (reconnus, à renommer) : aucun.
- Fichiers inattendus (non reconnus, non contrôlés) : aucun.
- OCR : non lancé (aucune image reçue).
- Code de sortie : 2 (0 = complet et sans défaut bloquant, 1 = défaut bloquant, 2 = il manque des images obligatoires).

Décompte : la trame numérote img01 à img49 (49 numéros). img35 n'existe pas seule : elle est remplacée par la paire img35a/img35b, et img09b s'ajoute à img09. Cela donne 49 − 1 + 3 = **51 prompts**, dont img21 (« Inès pointe l'horizon »), plan de réserve sans plan dans la trame : **50 images obligatoires + 1 facultative**.

Lecture d'une ligne : « DÉFAUT » bloque la réception ; « alerte » est à vérifier à l'œil. Après la flèche, la phrase à renvoyer à ChatGPT, reprise mot pour mot de `PROMPTS-CHATGPT.md` (« phrase ajoutée » ou « adaptée » quand les prompts n'en prévoient pas).

## Images du film

- **img01** (P01) — manquante
- **img02** (P02) — manquante
- **img03** (P03) — manquante
- **img04** (P04) — manquante
- **img05** (P05) — manquante
- **img06** (P06) — manquante
- **img07** (P07, P09 · téléphone) — manquante
- **img08** (P08) — manquante
- **img09** (P10) — manquante
- **img09b** (P30) — manquante
- **img10** (P11) — manquante
- **img40** (P12 · téléphone) — manquante
- **img41** (P13, P15 · téléphone) — manquante
- **img11** (P14) — manquante
- **img42** (P16 · téléphone) — manquante
- **img43** (P17 · téléphone) — manquante
- **img44** (P18) — manquante
- **img12** (P19) — manquante
- **img13** (P20) — manquante
- **img14** (P21) — manquante
- **img15** (P22) — manquante
- **img16** (P23) — manquante
- **img17** (P24) — manquante
- **img18** (P25 · téléphone) — manquante
- **img45** (P26) — manquante
- **img19** (P27) — manquante
- **img20** (P28) — manquante
- **img46** (P29 · téléphone) — manquante
- **img21** (facultative) — manquante (plan de réserve facultatif)
- **img22** (P31 · téléphone) — manquante
- **img23** (P32) — manquante
- **img24** (P33) — manquante
- **img25** (P34) — manquante
- **img26** (P35) — manquante
- **img27** (P36 · téléphone) — manquante
- **img28** (P37) — manquante
- **img47** (P38) — manquante
- **img29** (P39) — manquante
- **img30** (P40) — manquante
- **img31** (P41) — manquante
- **img32** (P42) — manquante
- **img48** (P43) — manquante
- **img33** (P44) — manquante
- **img34** (P45) — manquante
- **img35a** (P46) — manquante
- **img35b** (P46) — manquante
- **img36** (P47) — manquante
- **img37** (P48, P49 · téléphone) — manquante
- **img49** (P50) — manquante
- **img38** (P51 · téléphone) — manquante
- **img39** (P53) — manquante

## Fiches personnages

- **F1-lea.png** — manquante
- **F1-lea-ville.png** (facultative) — manquante (seconde fiche de Léa, tenue de ville ; nom proposé, absent des prompts)
- **F2-sami.png** — manquante
- **F3-ines.png** — manquante
- **F4-tom.png** — manquante
- **F5-malik.png** — manquante
- **F6-clara.png** — manquante
- **F7-noah.png** — manquante

## Paires

- **img35a/img35b** — non mesurée : les deux images ne sont pas encore reçues.
- **img09/img22** — non mesurée : les deux images ne sont pas encore reçues.

## Méthode et seuils

- Format : 16:9 à ±1 % ; côté long ≥ 1536 px (bible : « 1536×1024 minimum ») ; note d'agrandissement sous 1920×1080 et sous 3840×2160 ; RVB requis, profil non sRGB et transparence signalés.
- Écran (plans dont le prompt demande #00FF00) : plus grande zone avec g ≥ 140, r et b ≤ 110, g − max(r, b) ≥ 80 (au moins 0.3 % de l'image), sinon écran blanc uni de repli. Pureté : moyenne à moins de 60 de (0, 255, 0) ; uniformité : écart-type ≤ 10. Coins : les quatre points extrêmes de la zone, hors cadre s'ils touchent le bord, masqués si moins de 75 % des points voisins sont verts ; netteté : largeur de transition 10–90 % du bord ≤ 0.4 % de la largeur de l'image. img43 : deux coins suffisent (son prompt). Lueur : part de pixels teintés vert chroma dans un anneau autour de l'écran comparée au reste de l'image.
- Texte : OCR en texte épars sur toute l'image, zone de l'écran masquée ; mot retenu si confiance ≥ 70 % et au moins 3 lettres ou 2 chiffres. Un filigrane très pâle peut échapper au moteur.
- Personnages : la couleur de référence est mesurée sur la fiche (pixels proches de la couleur nommée dans le prompt et éloignés du fond gris). Dans l'image, « absente » = aucun groupe de pixels à ΔE < 25 ; « décalée » = rien à ΔE < 12 mais une teinte voisine. C'est une alerte : une forêt ou une ombre peuvent contenir la bonne couleur sans le personnage, l'œil tranche.
- Paires : img35a/img35b, corrélation des contours (320×180, bas de l'image) et recherche du décalage (max 1 % de la largeur) ; img09/img22, ressemblance des histogrammes teinte–saturation et part de turquoise (alerte seulement : img22 est un plan par-dessus l'épaule).
