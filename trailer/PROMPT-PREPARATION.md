# Prompt de préparation : session Claude Code du trailer LKDV

**Avant d'envoyer le prompt :** ouvre une nouvelle session Claude Code sur le dépôt `TFaraciColbert59/kitduvoyageur_1783951966810`, branche `claude/eager-gates-e7wny4`. Règle le modèle sur **Fable 5.2** (`/model claude-fable-5-2`) avec l'effort **élevé** (high). Copie ensuite le bloc ci-dessous en entier et **joins le fichier `STORM II - GENER8ION 320k.mp3`** au même message.

---

```
Tu es l'ORCHESTRATEUR du trailer de 60 secondes de l'app « Le Kit du Voyageur » (LKDV). Ce message est une PRÉPARATION : tu installes, tu lis, tu vérifies, tu crées tes agents, puis tu réponds « ok ». Tu ne commences PAS la production.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. RÉPARTITION DES MODÈLES (obligatoire, demande explicite et durable de Tony)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Toi, session principale en Fable 5.2, effort élevé : tu orchestres, tu décides, tu planifies, tu relis et tu valides. Tu n'écris JAMAIS de code toi-même : pas de HTML, de CSS, de JS, de GSAP, de script, de commande FFmpeg complexe ni de shader.
- TOUT le code, les rendus, les scripts et les compositions sont faits par des sous-agents lancés avec l'outil Agent et le paramètre model: "opus" (Opus 5.5), sans exception, quel que soit le rôle.
- Cette règle REMPLACE, pour ce chantier uniquement, le routage Haiku/Sonnet du §1.9 du CLAUDE.md du dépôt. Le reste du CLAUDE.md s'applique (honnêteté des chiffres, pas de git stash nu, regex écrites avec l'outil Edit, etc.).
- Lance en parallèle les périmètres indépendants, en arrière-plan.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CONTEXTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LE FILM
- 60 s, 1920×1080, 60 i/s, soit 3 600 images, avec l'audio synchronisé, plus une déclinaison verticale 9:16 recomposée (pas un simple recadrage aveugle).
- 54 plans. AUCUN plan ne dure plus de 2 s sans coupure. Toutes les coupes sont déjà posées sur les temps de la musique : plans de 0,44 à 2,00 s.
- Histoire, une boucle d'inspiration. Espace → descente → Léa voit un carnet LKDV sur son téléphone (photo d'un lac) → elle prépare l'aventure avec le Compas → dans Kit Studio, elle part presque sans argent grâce au prêt, à la location et à l'occasion, et commande son sac LKDV ONE 45 → colis → départ → montagne avec ses trois amis → un coureur prend le relais → puis une cycliste → bivouac → Léa publie son carnet → un inconnu dans un bus de nuit le découvre → remontée vers l'espace → des milliers de tracés forment le logo.
- Huit plans « ★ » à couper le souffle : humains minuscules face aux Dolomites (Seceda, Tre Cime, Sorapis, Tofana, gravel doré, épingle, Passo Giau, bivouac sous la Voie lactée).

RÈGLES DE CRÉATION
- Aucune phrase à l'écran. Le seul texte visible est celui de la vraie app, et uniquement sur les téléphones.
- PAS DE HUD FLOTTANT. L'app n'apparaît que sur un vrai téléphone tenu par un personnage. Les écrans sont des CAPTURES RÉELLES de l'app LKDV, incrustées sur l'écran vert (#00FF00) des images, avec suivi des quatre coins, reflet de vitre, flou de mouvement et lumière de la scène.
- Logo : fondu dans le halo de l'atmosphère à 0:00, puis net uniquement de 58 à 60 s. L'écusson du sac LKDV ONE (rendu par ChatGPT sans lettres) est remplacé par le vrai logo, suivi plan par plan.
- Les plans au sol gardent leurs couleurs réelles. L'identité LKDV passe par l'interface, le sac, le logo et un étalonnage léger (noirs encre verte proches de #0B1F17, hautes lumières crème proches de #FAF8F5).
- Continuité façon OneTake : chaque plan naît du précédent (mouvement, forme, couleur, élément qui traverse le cadre).
- La caméra bouge en permanence : poussées, filés, rampes de vitesse, FPV, parallaxe 2,5D.

DOCUMENTS DE RÉFÉRENCE (à lire en entier, sans sauter de section)
- trailer/TRAME-60s.md : la trame v4.1, calée sur la musique, seconde par seconde, avec les 54 plans, les images de début et de fin de chaque plan, les 13 écrans E1–E13 à capturer et la finition attendue. C'EST LA RÉFÉRENCE.
- trailer/PROMPTS-CHATGPT.md : la bible visuelle, les 7 personnages et les 51 images que Tony génère dans ChatGPT (img01 à img49, img09b, img35a/b).
- trailer/ANALYSE-REFERENCES.md : les coupes mesurées sur les 3 vidéos de référence et ce qu'on en garde.
- trailer/MUSIQUE.md : la structure de STORM II, le montage musical de 60 s coupé sur les premiers temps de mesure (drop 1 à 5,41 s, drop 2 à 33,48 s, outro à 47,47 s, impact final à 58,00 s) et la commande FFmpeg. Les temps sont dans trailer/assets/audio/storm-ii.beats.json. Les 54 coupes de la trame v4.1 sont déjà posées sur les temps : ne les déplace pas sans raison.
- trailer/assets/ref/ : rendus HD du vrai sac LKDV ONE 45 et 25 (faits avec trailer/tools/render-bag.mjs).
- CLAUDE.md à la racine : les règles permanentes du dépôt et le design system.

DESIGN SYSTEM LKDV (le vrai, dans le dépôt)
- Jetons : src/styles/tokens.css (variables --lkv-*), DESIGN_SYSTEM.md, docs/Design-tokens.md. Forest #17402C, Sage #5B7F55, Stone #FAF8F5. Interdits : #E4501C et #1C2620.
- Matériau du Compas : verre Liquid Glass v8 (docs/compas/DESIGN_REFERENCE.md), capsule d'étapes Où · Nous · Résa · Verdict · Kit.
- Polices : src/app/fonts (Inter, Manrope, Instrument Serif, IBM Plex Mono). Vérifie dans tokens.css lesquelles sont réellement utilisées.
- Logo : public/assets/logo-mark.svg, public/assets/images/logo-mark.svg, public/logo.png.
- Modèles 3D : public/assets/bags/*.glb (10 sacs) et public/assets/modules/*.glb (15 modules). Versions HD des LKDV ONE sur Supabase Storage (URL dans les fichiers *.manifest.json, clé assets.hd.url). Les objets du kit n'ont PAS de modèle 3D (ITEM_GLB_BY_ID vide) : dans Kit Studio, ils apparaissent en pictogrammes, comme dans l'app réelle.
- Fonctions réelles montrées dans le film, vérifiées dans le code :
  - prêt entre membres (« prêt gratuit pour ta tribu », « Prêté à … ») ;
  - location (« À louer ») ;
  - occasion vérifiée (marketplace, Trust Score) ;
  - commande depuis Kit Studio (bouton « Commander N articles · X € », src/features/kit-studio/ui/strings.ts) ;
  - carnets ;
  - Compas ;
  - Explorer ;
  - cockpit de randonnée (/randonnee-active).

OUTILS ET MOTEUR
- HyperFrames est le SEUL moteur de rendu (npm hyperframes@0.9.33, déjà dans trailer/package.json). GSAP porte toute l'animation. Lemo-Opuscar et Motion Design ne sont que des références de style. FFmpeg sert au mixage, à l'encodage et aux contrôles.
- Chromium et Playwright sont préinstallés ; ne lance PAS « playwright install ». three@0.180.0 est dans trailer/. yt-dlp est disponible.
- Commandes HyperFrames utiles :
  - beats : détecter les temps de la musique ;
  - audio : mesurer où tombent les sons ;
  - measure : mesurer une vidéo (coupes, mouvement) ;
  - snapshot et keyframes : contrôler les images clés ;
  - check, lint, validate : portes de qualité ;
  - grade-compare : comparer des étalonnages ;
  - render : rendu final.

RESSOURCES ATTENDUES (leur absence n'est PAS un blocage de la préparation)
- trailer/assets/footage/ : les 51 images générées par Tony dans ChatGPT, nommées exactement img01.png … img49.png, img09b.png, img35a.png, img35b.png, plus les fiches personnages F1-lea.png à F7-noah.png (références de cohérence des visages).
- La musique « STORM II » est FOURNIE et analysée (136,9 BPM). Le fichier n'est pas versionné : Tony le joint à ce message. Place-le dans trailer/assets/audio/storm-ii.mp3, puis refais trailer/assets/audio/storm-ii-montage-60s.wav avec la commande de trailer/MUSIQUE.md. La licence du titre est à vérifier avant toute diffusion publique.
- Les 13 écrans réels E1–E13 : à capturer plus tard sur l'aperçu Vercel avec un compte de démonstration rempli (voyage dans les Dolomites, 4 participants, kit, carnet).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PRÉPARATION À FAIRE MAINTENANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
a) Git
   - git fetch origin claude/eager-gates-e7wny4, puis travaille sur cette branche.
   - Pousse avec : git push -u origin claude/eager-gates-e7wny4.
   - Le trailer ne part jamais en production et n'est jamais fusionné dans main sans l'accord de Tony.
b) Lecture : lis en entier les cinq documents de référence ci-dessus.
c) Dépendances
   - Dans trailer/, lance npm ci.
   - Si l'import de playwright échoue, crée un lien de trailer/node_modules/playwright vers la copie globale ($(npm root -g)/playwright).
   - Télécharge à nouveau les .glb HD des LKDV ONE 45 et 25 dans trailer/assets/3d/ (dossier ignoré par git).
d) Skills (installe ceux qui manquent, sans réinstaller ceux qui sont déjà là)
   - Skills HyperFrames et GSAP : « npx hyperframes skills », puis « npx hyperframes skills check ». Tu dois avoir au minimum hyperframes, hyperframes-cli et gsap.
   - « npx hyperframes doctor » doit passer (Chrome et FFmpeg).
   - Un skill FFmpeg (mixage, encodage, contrôles) : cherche-le avec SearchSkills, ou dans le catalogue des plugins avec SearchPlugins. S'il n'existe pas, note-le : tu t'en passeras.
   - Skills déjà présents à utiliser : dispatching-parallel-agents, writing-plans, executing-plans, verification-before-completion, systematic-debugging, et .agents/skills/interaction-design (Aura) pour le mouvement.
   - Charge les skills hyperframes, puis hyperframes-cli, et lis-les.
e) Agents du chantier : crée-les dans .claude/agents/, chacun avec « model: opus » dans son en-tête et un périmètre écrit précis.
   - cosmos-vfx : espace, Terre, descente et remontée, tracés convergents et logo final (P01–P05, P52–P54), particules, éclats solaires, transitions.
   - landscape-director : animation des 51 images (parallaxe 2,5D par séparation de profondeur, poussées, filés, rampes, flou de mouvement), raccords OneTake, plans ★.
   - ui-builder : captures réelles de l'app (E1–E13) à 1290×2796, incrustation sur les écrans verts (suivi des coins, reflet, flou, lumière), remplacement de l'écusson du sac par le vrai logo.
   - sound-designer : beats de STORM II, calage image par image des coupes, impacts, souffles et whooshes, mixage à -14 LUFS.
   - chore : tâches mécaniques (renommage, manifestes, encodages, nettoyage).
   - qa-critic : relecture de chaque acte (images clés, transitions, continuité, rythme, plans ≤ 2 s, aucun texte hors téléphone, qualité visuelle). Avis franc et chiffré.
f) Squelette du projet : vérifie qu'un projet HyperFrames peut être initialisé dans trailer/film/. N'écris aucune scène : vérifie seulement que l'init et un rendu de test de 2 s à 60 i/s fonctionnent, puis supprime le rendu de test.
g) Inventaire : liste ce qui est présent et ce qui manque (images, audio, écrans), sans rien demander à Tony pour l'instant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. CE QUE TU FERAS APRÈS (ne pas commencer maintenant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P1 Squelette de timeline dans HyperFrames : 54 plans, des images 0 à 3 600, avec un gabarit par plan aux durées exactes de la trame v4.1.
P2 Captures des 13 écrans réels de l'app (ui-builder).
P3 Espace, descente, remontée, tracés et logo, entièrement en code (cosmos-vfx).
P4 Animation des 51 images et raccords (landscape-director), dès que les images arrivent.
P5 Incrustation des téléphones et du logo sur le sac (ui-builder).
P6 Son : écoute et validation des raccords du montage musical, design sonore (impacts, souffles, whooshes, masquage des raccords à 33,48 s et 51,00 s), mixage à -14 LUFS (sound-designer).
P7 Contrôle complet : images clés, transitions, continuité, rythme, qualité visuelle (qa-critic, acte par acte), puis résultat honnête dans trailer/qa/REVIEW.md, puis export du MP4 définitif 16:9 (3 600 images, 60 i/s) et de la version 9:16 recomposée.
Avant chaque commit : les portes HyperFrames (check, lint, validate) et des snapshots relus. Pousse sur claude/eager-gates-e7wny4.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. FIN DE LA PRÉPARATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quand tout est prêt, réponds exactement : ok
Seule exception : un VRAI blocage qui empêche de travailler (outil impossible à installer, accès refusé, rendu de test qui échoue). Dans ce cas, réponds « ok » suivi d'une seule ligne par blocage. Les images, la musique et les écrans manquants ne sont pas des blocages.
```
