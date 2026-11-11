# Réception des images — trailer LKDV

Généré par `node tools/reception/check-footage.mjs` le 2026-11-11 23:16 (heure locale), dossier `assets/footage`. Ce fichier est réécrit à chaque passage ; l'outil ne modifie jamais les images.

- Images du film : **51 reçues / 50 obligatoires** (+ img21, plan de réserve facultatif ; 51 prompts au total).
- Fiches personnages : **7 / 7**.
- Manquantes obligatoires (0) : aucune.
- Défauts bloquants : img07, img42 · alertes à vérifier à l'œil : F7.
- Noms presque justes (reconnus, à renommer) : aucun.
- Fichiers inattendus (non reconnus, non contrôlés) : aucun.
- OCR : non testable : désactivé (--no-ocr).
- Code de sortie : 1 (0 = complet et sans défaut bloquant, 1 = défaut bloquant, 2 = il manque des images obligatoires).

Décompte : la trame numérote img01 à img49 (49 numéros). img35 n'existe pas seule : elle est remplacée par la paire img35a/img35b, et img09b s'ajoute à img09. Cela donne 49 − 1 + 3 = **51 prompts**, dont img21 (« Inès pointe l'horizon »), plan de réserve sans plan dans la trame : **50 images obligatoires + 1 facultative**.

Lecture d'une ligne : « DÉFAUT » bloque la réception ; « alerte » est à vérifier à l'œil. Après la flèche, la phrase à renvoyer à ChatGPT, reprise mot pour mot de `PROMPTS-CHATGPT.md` (« phrase ajoutée » ou « adaptée » quand les prompts n'en prévoient pas).

## Images du film

- **img01** (P01) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img02** (P02) — OK [1920×1080, 3,3 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img03** (P03) — OK [1920×1080, 2,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img04** (P04) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img05** (P05) — OK [1920×1080, 3,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img06** (P06) — OK [1920×1080, 3,0 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img07** (P07, P09 · téléphone) — DÉFAUT : coin(s) masqué(s) : bas droit (50 % vert) → « L'écran du téléphone doit être un vert chroma uni pur #00FF00, mat, sans reflet ni icône, avec les quatre coins arrondis nets et visibles, sans lueur verte sur la peau. » [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img08** (P08) — OK [1920×1080, 2,4 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img09** (P10) — OK [1920×1080, 3,0 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img09b** (P30) — OK [1920×1080, 3,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img10** (P11) — OK [1920×1080, 2,9 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img40** (P12 · téléphone) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img41** (P13, P15 · téléphone) — OK [1920×1080, 2,3 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img11** (P14) — OK [1920×1080, 2,8 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img42** (P16 · téléphone) — DÉFAUT : motif dans l'écran (icône, reflet ou contenu) : 0.46 % de sa surface → « L'écran du téléphone doit être un vert chroma uni pur #00FF00, mat, sans reflet ni icône, avec les quatre coins arrondis nets et visibles, sans lueur verte sur la peau. » [1920×1080, 3,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img43** (P17 · téléphone) — OK [1920×1080, 2,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; 2 coins visibles sur 4 (deux suffisent pour img43) ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img44** (P18) — OK [1920×1080, 2,7 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img12** (P19) — OK [1920×1080, 2,9 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (tenue de ville)
- **img13** (P20) — OK [1920×1080, 3,1 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img14** (P21) — OK [1920×1080, 3,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img15** (P22) — OK [1920×1080, 2,8 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img16** (P23) — OK [1920×1080, 3,3 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img17** (P24) — OK [1920×1080, 2,8 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img18** (P25 · téléphone) — OK [1920×1080, 2,7 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img45** (P26) — OK [1920×1080, 3,1 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img19** (P27) — OK [1920×1080, 3,0 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img20** (P28) — OK [1920×1080, 2,9 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img46** (P29 · téléphone) — OK [1920×1080, 2,7 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img21** (facultative) — OK [1920×1080, 2,3 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img22** (P31 · téléphone) — OK [1920×1080, 3,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img23** (P32) — OK [1920×1080, 3,3 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img24** (P33) — OK [1920×1080, 2,9 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img25** (P34) — OK [1920×1080, 3,1 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img26** (P35) — OK [1920×1080, 3,4 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img27** (P36 · téléphone) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img28** (P37) — OK [1920×1080, 3,2 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img47** (P38) — OK [1920×1080, 3,7 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img29** (P39) — OK [1920×1080, 3,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img30** (P40) — OK [1920×1080, 3,4 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img31** (P41) — OK [1920×1080, 3,0 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img32** (P42) — OK [1920×1080, 3,9 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img48** (P43) — OK [1920×1080, 3,4 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img33** (P44) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img34** (P45) — OK [1920×1080, 3,0 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert sauge clair (doudoune crème la nuit)
- **img35a** (P46) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert forêt (silhouettes), veste beige sable (silhouettes), veste vert sauge clair (silhouettes), veste bleu encre (silhouettes)
- **img35b** (P46) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img36** (P47) — OK [1920×1080, 2,7 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste vert sauge clair (doudoune crème la nuit)
- **img37** (P48, P49 · téléphone) — OK [1920×1080, 2,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img49** (P50) — OK [1920×1080, 2,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K
- **img38** (P51 · téléphone) — OK [1920×1080, 2,9 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K ; couleurs non évaluées : veste en jean délavée (couleur introuvable dans la fiche F7)
- **img39** (P53) — OK [1920×1080, 2,8 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K

## Fiches personnages

- **F1-lea.png** — OK [1920×1080, 2,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : veste vert forêt #3E3C39, sac LKDV ONE vert olive #7A7648
- **F1-lea-ville.png** (facultative) — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : 
- **F2-sami.png** — OK [1920×1080, 2,7 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : veste beige sable #B69E87
- **F3-ines.png** — OK [1920×1080, 2,4 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : veste vert sauge clair #D0C2B3
- **F4-tom.png** — OK [1920×1080, 2,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : veste bleu encre #302F31
- **F5-malik.png** — OK [1920×1080, 2,5 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : t-shirt ivoire #D1C6C2
- **F6-clara.png** — OK [1920×1080, 2,6 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : maillot bordeaux #563035
- **F7-noah.png** — alerte : veste en jean délavée introuvable dans la fiche (le contrôle de couleur de ce personnage est sauté) [1920×1080, 2,3 Mo, RVB, sans profil (sRGB supposé)] — notes : ×2,00 pour la 4K — références mesurées : veste en jean délavée introuvable

## Paires

- **img35a/img35b** — OK (dxPct 0, dyPct 0, shiftPct 0, ncc0 0.655, nccBest 0.655)
- **img09/img22** — OK (bhatt 0.922, turq09Pct 34.6, turq22Pct 21.5)

## Méthode et seuils

- Format : 16:9 à ±1 % ; côté long ≥ 1536 px (bible : « 1536×1024 minimum ») ; note d'agrandissement sous 1920×1080 et sous 3840×2160 ; RVB requis, profil non sRGB et transparence signalés.
- Écran (plans dont le prompt demande #00FF00) : plus grande zone avec g ≥ 140, r et b ≤ 110, g − max(r, b) ≥ 80 (au moins 0.3 % de l'image), sinon écran blanc uni de repli. Pureté : moyenne à moins de 60 de (0, 255, 0) ; uniformité : écart-type ≤ 10. Coins : les quatre points extrêmes de la zone, hors cadre s'ils touchent le bord, masqués si moins de 75 % des points voisins sont verts ; netteté : largeur de transition 10–90 % du bord ≤ 0.4 % de la largeur de l'image. img43 : deux coins suffisent (son prompt). Lueur : part de pixels teintés vert chroma dans un anneau autour de l'écran comparée au reste de l'image.
- Texte : OCR en texte épars sur toute l'image, zone de l'écran masquée ; mot retenu si confiance ≥ 70 % et au moins 3 lettres ou 2 chiffres. Un filigrane très pâle peut échapper au moteur.
- Personnages : la couleur de référence est mesurée sur la fiche (pixels proches de la couleur nommée dans le prompt et éloignés du fond gris). Dans l'image, « absente » = aucun groupe de pixels à ΔE < 25 ; « décalée » = rien à ΔE < 12 mais une teinte voisine. C'est une alerte : une forêt ou une ombre peuvent contenir la bonne couleur sans le personnage, l'œil tranche.
- Paires : img35a/img35b, corrélation des contours (320×180, bas de l'image) et recherche du décalage (max 1 % de la largeur) ; img09/img22, ressemblance des histogrammes teinte–saturation et part de turquoise (alerte seulement : img22 est un plan par-dessus l'épaule).
