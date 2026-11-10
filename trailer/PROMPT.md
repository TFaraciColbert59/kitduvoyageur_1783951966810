# Prompt de lancement (à coller dans Claude Code, session `claude-fable-5-2`, à la racine de ce dossier)

Tu es l'orchestrateur de la réalisation du trailer de 60 secondes de l'app « Le Kit du Voyageur » (LKDV).

1. Lis intégralement `CLAUDE.md` (règles permanentes, répartition des agents, portes de qualité), puis le storyboard `storyboard/LKDV — Trailer 60 s.md` en entier, sans en sauter une section. Le storyboard est la référence narrative et visuelle.
2. Charge le skill `hyperframes` puis `hyperframes-cli`. HyperFrames est le seul moteur de rendu. GSAP porte l'animation, Lemo-Opuscar et Motion Design ne sont que des références (voir `CLAUDE.md` §2), OneTake sert de référence de continuité (chaque temps naît du précédent), le skill FFmpeg sert au mixage, à l'encodage et aux contrôles.
3. Suis les phases P0 à P7 de `CLAUDE.md`. Délègue à `cosmos-vfx`, `landscape-director` (Opus, high), `ui-builder`, `sound-designer` (Sonnet, medium), `chore` (Sonnet, low) et fais relire chaque acte par `qa-critic`. Lance en parallèle les périmètres indépendants.
4. Respecte la timeline exacte du storyboard, les éléments du vrai design system LKDV (dépôt `TFaraciColbert59/kitduvoyageur_1783951966810`, jetons, matériau du Compas, polices, icônes, logo) et les transitions définies. Aucune phrase à l'écran ; le logo reste fondu dans le décor aux moments prévus ; l'identité LKDV passe par l'interface, le logo et un étalonnage léger ; les plans au sol gardent leurs couleurs réelles.
5. Commence par P0 : audit, copie des assets du design system, état des ressources manquantes (les 21 images de `assets/footage/`, la musique). Pose **une seule question groupée** à l'utilisateur pour ce qui manque, avec ta recommandation par défaut, puis avance sans attendre sur tout ce qui est indépendant.
6. Livrable final : un film de 60 secondes, 1920 × 1080, 60 i/s, 3 600 images, audio synchronisé, avec une déclinaison verticale 9:16 recomposée. Avant l'export du MP4 définitif, contrôle les images clés, les transitions, la continuité, le rythme et la qualité visuelle, et écris le résultat honnête dans `qa/REVIEW.md`.

Premier message attendu de ta part : une phrase disant ce que tu lances, puis la liste des agents démarrés pour P0.
