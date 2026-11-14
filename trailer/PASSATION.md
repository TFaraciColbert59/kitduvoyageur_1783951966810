# Passation — Trailer LKDV 60 s (état au 14/11/2026)

Tu reprends le chantier du trailer « Le Kit du Voyageur » (LKDV) là où la session précédente s'est arrêtée. Tout ce qu'il faut est ici : ne pose aucune question à Tony sur ce qui est écrit dans ce fichier, agis.

## 1. Qui, quoi, comment parler

- **Tony** est le propriétaire du projet. Il écrit en français, sans accents parfois, de façon directe ; réponds **toujours en français**, clair, sans jargon, sans flagornerie, chiffres honnêtes (y compris les échecs). Il est exigeant : le trailer sera vu par des milliers de personnes, il doit être « ultra propre et professionnel ».
- Dépôt : `TFaraciColbert59/kitduvoyageur_1783951966810`, dossier **`trailer/`** (le reste du dépôt est l'application LKDV, à ne pas toucher pour ce chantier).
- **Branche du chantier : `claude/eager-gates-e7wny4`**. PR en brouillon : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/161 (abonnée aux évènements ; ses échecs de CI sont tous antérieurs et propres à l'application — `database-gates` carnet_public_trace_scope, `quality-gates`, `visual-tests` ×3, Cloudflare Workers Builds — déjà commentés, ne rien faire).
- Pousser : `git push -u origin claude/eager-gates-e7wny4` (4 essais en cas d'erreur réseau ; `git pull --rebase` si un agent a poussé entre-temps). Pas de `git stash` nu.
- Trailer des commits (exact) :
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VCb79VPxRHJGPTESh4fDn3
  ```
  Aucun identifiant de modèle dans les messages de commit, la PR ou le code.

## 2. Règles dures données par Tony (verbatim quand c'est entre guillemets)

- Rôle de la session principale : **orchestrateur**. « Tu n'écris JAMAIS de code toi-même : pas de HTML, de CSS, de JS, de GSAP, de script, de commande FFmpeg complexe ni de shader. » « TOUT le code, les rendus, les scripts et les compositions sont faits par des sous-agents lancés avec l'outil Agent et le paramètre model: "opus" … sans exception. » La session principale lit, décide, briefe, vérifie (regarde les planches, mesure), écrit la doc et committe.
- Agents du chantier (`.claude/agents/`) : `sound-designer` (musique, calage, mix), `cosmos-vfx` (espace, nébuleuse, Terre, logo final, particules), `landscape-director` (mouvement des images, raccords), `ui-builder` (captures de l'app, incrustation des écrans de téléphone), `qa-critic` (relecture critique chiffrée, ne corrige pas), `trailer-chore` (tâches mécaniques). Toujours `model: "opus"`.
- « Le trailer ne part jamais en production et n'est jamais fusionné dans `main` sans l'accord de Tony. »
- « Aucun fichier soumis à droits dans le dépôt » : ni la musique, ni un rendu avec musique (`.gitignore` de `trailer/` couvre `assets/audio/*.mp3|wav`, `qa/*.wav`, `qa/*.mp4`, `livraison/`, `flow/clips/` à venir). Vérifier `git status` avant chaque commit.
- Règles créatives toujours valables : aucun texte à l'écran hors des écrans de téléphone, aucun HUD, logo net seulement à la fin (≈ 58–60 s), vraies captures de l'app dans les téléphones, couleurs interdites `#E4501C` et `#1C2620`. Moteur de rendu : HyperFrames (0.9.33).
- Secrets : jamais dans le chat ni dans un fichier. Une clé d'API se demande avec l'outil `request_credential` (formulaire sécurisé). `VERCEL_SHARE` jamais écrit dans un fichier.
- Budget : **10 € maximum** de dépenses externes. Rien de payant sans le go de Tony.

## 3. Où on en est (histoire courte)

1. Un premier trailer complet a été livré le 14/11 (16:9 et 9:16, 1920×1080, 60 i/s, 54 plans ≤ 2 s, musique STORM II, mix v2) : voir `qa/LIVRAISON.md`. Fichiers dans `trailer/livraison/` (non versionnés).
2. **Verdict de Tony : « diaporama », « poubelle ».** Cause reconnue : ce sont des images fixes (générées par Tony avec ChatGPT, `assets/footage/img*.png`, 1920×1080) avec seulement des mouvements de caméra ; aucune vie dans l'image.
3. Nouvelles décisions de Tony (à respecter) :
   - **Le film passe en 24 i/s** (60 s = 1 440 images ; temps à 136,9 BPM ≈ 10,52 images, mesure ≈ 1,753 s).
   - **Ouverture** : « au tout début j'ai ni ma nébuleuse pleine de couleur pour arriver sur la création du système solaire et à la Terre d'aujourd'hui en seconde max » → une nébuleuse colorée qui s'effondre, le Soleil qui s'allume, le disque/les planètes, puis la Terre d'aujourd'hui, très vite (≈ 1 s), en un mouvement continu.
   - « Il faut qu'on pense que ce sont de vrais acteurs, c'est avant tout un trailer. »
   - **Musique** : « on commence dans le silence au début de la musique en douceur, hésite pas à couper pour qu'elle tienne en 60 sec » (il avait d'abord parlé de démarrer sur un drop, puis a tranché pour le silence et l'intro douce).
   - « On se concentre sur le 16:9 pour l'instant » (le 9:16 viendra après validation du 16:9).
   - « Après on verra quand ce sera correctement animé » : téléphones, raccords fins, étalonnage, 9:16 passent après.
4. **Génération vidéo choisie : Google Flow avec l'abonnement Google AI Pro de Tony** (0 € de plus). Faits relevés le 14/11 (sources dans la conversation, à revérifier au besoin) :
   - 1 000 crédits/mois + 50 crédits/jour (non cumulables). **Veo 3.1 Lite = 10 crédits par vidéo**, 4/6/8 s, générée en 720p, **agrandissement 1080p gratuit** pour les abonnés, 24 i/s. Environ 100 vidéos/mois sur les crédits mensuels + 5/jour.
   - Veo 3.1 Fast et Quality s'arrêtent le **5 décembre 2026** dans Flow ; Lite et Omni Flash 1.2 restent.
   - Filigrane visible désactivable dans les réglages (sauf Inde, Corée du Sud, Vietnam) ; SynthID invisible reste.
   - Pas d'API avec l'abonnement : **c'est Tony qui génère dans Flow** à partir de fiches prêtes à copier, puis dépose les vidéos (1080p) dans la conversation ; la session les trie, les choisit, les intègre.
   - Usage commercial : Google ne revendique pas la propriété ; pas de licence commerciale explicite (risque faible, signalé à Tony).
   - Secours (si Flow bloque un plan) : OpenRouter, Veo 3.1 Lite 1080p sans son à 0,05 $/s (4 s = 0,20 $), image de début et de fin acceptées ; clé par `request_credential` (en-tête Authorization: Bearer). Rien de payant sans go. Écartés : Kling 3.0 (trop cher pour 10 €), offres gratuites à filigrane ou non commerciales.

5. **Mise à jour du 14/11 (session locale sur le Mac de Tony)** :
   - Tony : « avec Omni il peut tout créé comme un vrai studio je viens de voir ». Vérifié sur l'aide Google Flow (support.google.com/flow/answer/16352836 et 16526234) et le billet Google du 5/11/2026 : **Omni Flash 1.2** fait texte → vidéo, Frames → vidéo, Ingredients/References → vidéo (images de référence pour garder les mêmes personnages), retouche vidéo en conversation, prolongation, de 3 à 15 s. Coût : **3 crédits/s en 720p** (6 crédits/s de la 11e à la 15e), 1 crédit/s en 360p, agrandissement 1080p gratuit jusqu'à 10 s. Un plan de 4 s en 720p = 12 crédits (Veo 3.1 Lite : 10 crédits pour 4, 6 ou 8 s). Les qualités annoncées restent à prouver sur nos plans.
   - **L'essai Flow devient une comparaison** : prompt A lancé avec Veo 3.1 Lite et avec Omni Flash 1.2 sur P26, P37, P47 (6 vidéos), plus un bonus Omni en mode Ingredients (gros plan de Léa seule, cadrage qui n'existe pas en image). 7 vidéos, 90 crédits. Fichiers attendus dans `flow/clips/` : `p26-veo.mp4`, `p26-omni.mp4`, `p37-veo.mp4`, `p37-omni.mp4`, `p47-veo.mp4`, `p47-omni.mp4`, `p47-omni-ref.mp4`. Si Omni tient les visages en mode Ingredients, la suite n'est plus « animer 51 images fixes » mais tourner de vrais plans (autres angles, actions complètes) : à redécider avec Tony après l'essai.
   - **Décision de Tony ensuite (14/11) : « on utilise omniflash 1.2. on a 800 crédit. donne moi la feuille de route a suivre pas de A ou B juste ce qui faut. ensuite je t'envoi tout les plan. »** L'essai comparatif est abandonné. **`flow/FEUILLE-DE-ROUTE.md`** est le document en vigueur : 43 vidéos pour les 46 plans P06–P51 (une seule vidéo pour P07+P09, P13+P15, P48+P49), un prompt par plan écrit d'après l'image regardée, mode Frames, 720p, 3 s par défaut, 4 s pour les visages, 5 s pour les plans ★ ; 486 crédits, 314 de réserve. Fichiers attendus dans `flow/clips/` : `pNN.mp4` (reprise : `pNN-2.mp4`). P46 utilise image de début (img35a) et de fin (img35b). Écarts images/trame relevés à cette occasion : P16 (Léa est à plat ventre, téléphone posé sur la couette, pas au-dessus du visage), P33 (Malik court vers la caméra, pas de profil), P14 (img11 est un triptyque : plan le plus risqué), P39 (le dépassement a déjà eu lieu sur l'image), P50 (les montagnes sont celles d'img35, pas les Tre Cime). À la réception : regarder chaque vidéo image par image, mesurer (ffprobe : cadence, durée), puis remontage à 24 i/s sur la musique v3.
   - **Poste local** : dépôt dans `~/Projets/LKDV/lkdv` (branche du chantier extraite, `main` intact). `npm ci` fait dans `trailer/`. ffmpeg 6.0 et ffprobe ne sont pas dans le PATH : ils sont dans `trailer/node_modules/ffmpeg-static/` et `trailer/node_modules/ffprobe-static/bin/darwin/arm64/` (installés avec `npm install --no-save ffmpeg-static ffprobe-static`, accord de Tony ; à refaire après un `npm ci`). Pas de scipy ni de sox. Le MP3 est en place dans `assets/audio/storm-ii.mp3` (copié depuis Téléchargements, hors git).
   - P26 : les marcheurs **montent vers la gauche** (vérifié en agrandissant img45) ; la première version des fiches disait l'inverse, corrigé.

## 4. Ce qui tournait au moment de la passation (vérifie d'abord)

Deux sous-agents Opus ont été lancés juste avant la passation. Vérifie s'ils ont abouti (`git log --oneline -10`, présence des fichiers) ; sinon relance-les avec les mêmes consignes :

1. **Montage musical v3** (agent `sound-designer`) — attendu :
   - `qa/mix-v3.wav` (non versionné ; si absent et que le conteneur est neuf, le reconstruire avec le script versionné),
   - le script de reconstruction dans `tools/audio/` (ex. `build-all.mjs --v3`),
   - `qa/MUSIQUE-V3.md` (structure section par section, temps en s et en images 24 i/s, sources dans le morceau, raccords, moments clés, mesures),
   - `qa/mix-v3.beats.json` (chaque temps et début de mesure du montage v3 en s et en images 24 i/s, avec étiquettes).
   Consignes : musique seule (pas de SFX : les coupes image vont changer), silence au début (~0,3–1 s) puis le vrai début de STORM II en fondu doux, coupes seulement en fin de mesure/phrase sur un temps fort avec fondu court (10–40 ms) ou queue de réverbération, structure de trailer (silence → intro douce/espace → montée → premier grand moment → respiration intime → drop principal → coup final net sur le logo), exactement 60,000 s, −14 LUFS, crête ≤ −1,0 dBTP, 48 kHz 24 bits, vérification par mesures et planche de forme d'onde. Ne touche à aucune composition.
   - Matière : `assets/audio/storm-ii.mp3` (non versionné), `assets/audio/storm-ii.beats.json`, `MUSIQUE.md`, `qa/SON-AUDIT.md`, `tools/audio/`. **Si `assets/audio/storm-ii.mp3` manque (conteneur neuf), demande à Tony de redéposer le fichier MP3 de STORM II dans la conversation** (c'est la seule chose qui ne peut pas venir du dépôt), puis copie-le à ce chemin.
2. **Fiches Flow de l'essai** (agent généraliste Opus) — attendu `flow/FICHES-ESSAI.md` + `flow/clips/` ajouté au `.gitignore`. Contenu : réglages Flow pas à pas ; une fiche par plan avec image à importer, durée, prompts A et B en anglais (style prise de vue réelle 35 mm, une action physique en temps réel, micro-mouvements de vie, mouvement de caméra précis, personnages/tenues/décor identiques à l'image, aucun texte, pas de ralenti « IA »), ce qu'on doit voir, défauts éliminatoires, nom de fichier (`p26-a1.mp4`…) ; envoi des vidéos dans la conversation. Plans de l'essai : **P26** (`assets/footage/img45.png`, crête de Seceda, marcheurs minuscules), **P37** (`img28.png`, saut du coureur au-dessus du torrent), **un gros plan d'acteur sans téléphone** choisi par l'agent (candidats `img36.png` Léa au feu de bivouac / P47, `img20.png` la main tendue / P28). 6 générations, 60 crédits.

Quand les fiches sont prêtes : **envoie `flow/FICHES-ESSAI.md` à Tony avec `SendUserFile`** et dis-lui en deux phrases quoi faire (générer dans Flow, télécharger en 1080p, déposer les vidéos dans la conversation).

## 5. La suite, dans l'ordre (décidée avec Tony)

1. **Montage musical v3** (ci-dessus). Le relire : MUSIQUE-V3.md, planche, mesures ; proposer à Tony les 2–3 moments à écouter.
2. **Ouverture en code, de la nébuleuse à la Terre** (agent `cosmos-vfx`, Opus), lancée **après** la musique pour caler sur ses premières notes : une seule caméra continue sans coupe, nébuleuse pleine de couleurs (gaz qui tournent et s'effondrent), Soleil qui s'allume (éclair), disque de poussière et planètes qui filent, Terre d'aujourd'hui qui remplit le cadre, puis enchaînement sur la descente ; le tout ≈ 1 s pour la création, posé sur le silence puis l'entrée douce de la musique ; couleurs franches pour que les trois états se lisent ; 24 i/s, 1920×1080 ; composition autonome (ne pas brancher dans `film/index.html` avant validation) ; rendu de contrôle et planche d'images regardée. Matière existante : `film/compositions/p01–p05.html`, `film/lib/fx/` (core.js, traces.js, finale.js), images `img01–img05`, three@0.180.0 autorisé.
3. **Essai Flow** : réception des 6 vidéos de Tony → les regarder image par image (planches, extraction d'images), choisir, conformer en 24 i/s 1920×1080, intégrer dans le film à la place des plans fixes P26, P37 et du plan d'acteur, rendu de l'extrait avec la musique v3, l'envoyer à Tony. Il juge si « on croit à de vrais acteurs ».
4. Si l'essai est validé : fiches Flow pour tous les plans (P06–P51, ~40 plans après remontage ; 2 à 3 prises par plan ; plans de visage tenus 3–4 s possibles sur la respiration musicale), puis **remontage complet à 24 i/s sur la grille de `qa/mix-v3.beats.json`** (le film actuel est minuté en images à 60 i/s : `film/shots.json` startFrame/endFrame, `film/index.html`, compositions `p01–p54`), puis téléphones (incrustation des captures `assets/screens/E*` sur les écrans verts, à suivre image par image dans des vidéos qui bougent), étalonnage (LUT `film/assets/luts/lkdv-trailer.cube`), effets sonores, logo final, relecture `qa-critic`, rendu 16:9. Le 9:16 ensuite.

## 6. Repères techniques utiles

- Film : `film/index.html` (racine, `<audio id="music">` → `assets/audio/mix-v1.wav` à remplacer par le mix v3 au remontage), `film/shots.json` (54 plans : id, act, startFrame, endFrame à 60 i/s, sources, screen, code, cadre, action, raccord), `film/compositions/pNN.html`, `film/lib/` (fx, phone, reframe), `film/crops.json` + `tools/crops/` (9:16).
- Plans à téléphone (écran vert à incruster) : P07, P09, P12, P13, P15, P16, P17, P25, P29, P31, P36, P48, P49, P51 (écrans E1–E13, captures réelles dans `assets/screens/`, compte démo décrit dans `SCREENS.md`).
- Plans de code : P53 (tracés), P54 (logo). Espace : P01–P05 (+ P52 qui réutilise img03–05).
- Documents de référence : `TRAME-60s.md` (intention plan par plan), `PROMPTS-CHATGPT.md` (bible, fiches personnages Léa/Tom…, grille de contrôle des images), `PROMPTS-RETOUCHES.md`, `ANALYSE-REFERENCES.md`, `CONVENTIONS.md`, `MUSIQUE.md`, `qa/*.md` (rapports : REVIEW-FINAL, SON-AUDIT, ETALONNAGE-FILM, LIVRAISON…).
- Rendu HyperFrames : lint, `check --json`, `render --fps <fps> --start --end --quality draft|delivery --workers 2` ; rendus longs en tranches de 10 s reprenables, assemblage concat avec `duration 10.000000` par tranche, `-c:v copy`, son AAC 320 kb/s `-aac_pns 0`, sans `-shortest` ni `-t`.
- Vérifications avant de dire « fini » : ffprobe (nombre d'images, durée), blackdetect, ebur128 (−14 LUFS, crête), planches d'images regardées, pas de saut de netteté à la première image d'un plan.
- Réseau : `openrouter.ai` répond depuis le conteneur ; `fal.ai` n'était pas joignable par l'outil de lecture web. Pour lire le web, l'outil Exa (`web_fetch_exa`, `web_search_exa`) fonctionne.

## 7. Points ouverts à garder en tête (ne pas relancer Tony dessus sans raison)

- Licence de synchronisation de STORM II à obtenir avant toute diffusion publique.
- Compte démo : un carnet public « Dolomites · Lago di Sorapis » mis en avant comme « Carnet de la semaine » (à repasser en privé si Tony le décide) ; 2 photos de lac orphelines et des brouillons Compas dans le compte démo.
- P30→P31 : saut de lumière dans les images sources ; écusson du sac LKDV ONE pas encore remplacé par le vrai logo.
- Fusion dans `main` / publication : décision de Tony uniquement.
