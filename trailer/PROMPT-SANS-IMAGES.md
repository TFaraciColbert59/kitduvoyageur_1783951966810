# Prompt : avancer sans les images (à envoyer à la session d'orchestration)

```
Les images ChatGPT ne sont pas encore là. Avance dès maintenant sur tout ce qui n'en dépend pas, en parallèle et en arrière-plan, toujours avec des sous-agents en Opus 5.5 pour le code. Ne t'arrête pas pour des points d'étape. Tu ne reviens vers moi que pour un vrai blocage ou une décision qui m'appartient.

1. P1 — Squelette de timeline (chore puis landscape-director)
   - Dans trailer/film/, une composition HyperFrames de 3 600 images à 60 i/s, avec les 54 plans aux coupes exactes de TRAME-60s.md v4.1 et le montage musical storm-ii-montage-60s.wav.
   - Chaque plan reçoit un gabarit nommé (P01…P54), qui pointe vers son image prévue (assets/footage/imgXX.png). Tant que l'image manque, une carte provisoire en tient lieu : couleur de l'acte, numéro du plan, intention.
   - Dès qu'une image arrivera, elle devra remplacer sa carte sans toucher au minutage.
   - Livrable : un rendu de travail de 60 s à 30 i/s (qa/animatic-v1.mp4, non versionné), plus un snapshot par acte.

2. P3 — Tout ce qui est 100 % code (cosmos-vfx)
   - P53–P54 : la Terre de nuit en code ou en plaque provisoire, les milliers de tracés sauge qui s'allument puis convergent, et le logo LKDV (public/assets/logo-mark.svg) qui se forme et devient net à 58,00 s, calé sur l'impact.
   - La bibliothèque de transitions réutilisables : flash solaire, flou radial de chute, traversée de nuage, traversée de vitre, éclat d'objectif, étincelle qui monte, remontée accélérée (P52).
   - Le logo fondu dans le halo de l'atmosphère pour P01, prêt à poser sur img01.
   - Contrôle avec snapshot et keyframes ; qa-critic relit.

3. P6 — Son (sound-designer), entièrement indépendant des images
   - Reconstruire storm-ii-montage-60s.wav (commande dans MUSIQUE.md), puis vérifier chaque raccord par mesure (hyperframes audio, spectre avant et après chaque raccord) et signaler ceux qui risquent de s'entendre, en priorité à 33,48 s et 51,00 s.
   - Une banque d'effets libres de droits (CC0 ou générés), avec leur provenance notée dans un fichier : whooshes, impacts, clac de boucle, souffle, vent d'altitude, crépitement du feu, rails, gravillons, notification.
   - Une piste d'effets calée sur les 54 coupes, puis un mix à -14 LUFS intégrés et -1 dBTP.
   - Livrable : qa/mix-v1.wav et le rapport de mesures.

4. P2 et P5 préparés — Téléphones et logo (ui-builder)
   - La chaîne d'incrustation, testée sur une plaque d'essai que tu fabriques toi-même (une main tenant un téléphone à écran vert, ou un rendu 3D) : détection automatique de l'écran vert, suivi des quatre coins, déformation perspective, reflet de vitre, flou de mouvement, adaptation à la lumière de la scène.
   - La chaîne de remplacement de l'écusson du sac LKDV ONE par le vrai logo, testée sur les rendus de trailer/assets/ref/.
   - Les captures E1–E13 : prépare la liste exacte des écrans, des routes et des données de démonstration nécessaires (voyage Dolomites, 4 participants, kit avec objets « Prêté par Sami », « À louer », « Occasion », commande, carnet).
     - Capture tout de suite ceux qui ne demandent pas de compte rempli.
     - Pour ceux qui demandent un compte de démonstration, dis-moi en UNE question groupée ce qu'il te faut (accès, compte) avec ta recommandation.
     - E1 et E9 attendent img09, la photo du lac.

5. Outil de réception des images (chore)
   - Un script qui contrôle chaque image déposée dans assets/footage/ :
     - nom attendu et liste des manquantes ;
     - format 16:9 et résolution ;
     - présence et netteté des quatre coins de l'écran vert sur les plans de téléphone ;
     - texte parasite (OCR) ;
     - dérive de couleur d'un personnage par rapport à sa fiche, si les fiches sont là.
   - Il écrit qa/RECEPTION.md avec une ligne par image (OK, ou défaut avec la phrase de correction à renvoyer à ChatGPT, tirée de PROMPTS-CHATGPT.md).

6. Étalonnage et 9:16 (landscape-director)
   - Une LUT commune (noirs encre verte proches de #0B1F17, hautes lumières crème proches de #FAF8F5, verts retenus), testée avec grade-compare sur les rendus du sac et sur des images libres de droits de montagne, en attendant les vraies.
   - Le système de recomposition verticale 9:16 : un cadre de recadrage par plan, défini en pourcentage de l'image, à ajuster quand les images arriveront.

Règles : portes HyperFrames (check, lint, validate) et snapshots relus avant chaque commit. Commits clairs, poussés sur claude/eager-gates-e7wny4. Aucun fichier soumis à droits dans le dépôt (musique, rendus avec musique). Quand une image arrive dans assets/footage/, passe-la par l'outil de réception et intègre-la.

Fais-moi un seul compte rendu quand ces six chantiers sont terminés : ce qui est fait, avec preuves (chemins, snapshots, mesures), ce qui reste, et les vrais blocages.
```
