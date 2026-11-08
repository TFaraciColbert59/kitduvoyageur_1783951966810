# UGC Creative Studio — Skill Claude Code

**Version : 1.1 · 08/11/2026 · Langue de travail : FR (multilingue)**

Un seul skill réutilisable, **20 compétences** intégrées : cinq en brief, cinq en casting, cinq en production et cinq en validation. Il prépare des publicités UGC, des scripts et des storyboards tournables, mais peut aussi **produire réellement un MP4** par animation HTML/Canvas/SVG codée, Chrome headless et FFmpeg, avec piste audio et QA technique. Les créations « UGC authentique » requièrent toujours les véritables rushes d'un créateur autorisé. Le **rendu local codé** ne nécessite pas de service de génération vidéo payant ; Claude Code reste soumis à son propre abonnement et à ses quotas.

## Installation Claude Code — globale

1. Télécharger l'archive `ugc-creative-studio.zip`.
2. Décompresser le dossier **`ugc-creative-studio`** dans le répertoire personnel des skills Claude :

   ```bash
   mkdir -p ~/.claude/skills
   unzip -o ugc-creative-studio.zip -d ~/.claude/skills
   ```

   Résultat attendu : `~/.claude/skills/ugc-creative-studio/SKILL.md`.
3. Ouvrir une **nouvelle session Claude Code** et entrer :

   ```text
   /ugc-creative-studio full Crée une campagne vidéo UGC de 30 secondes pour mon produit à partir des éléments de ce projet.
   ```

Pour installer seulement dans un dépôt, décompresser l'archive dans `<repo>/.claude/skills/` plutôt que dans `~/.claude/skills/`.

**Windows / PowerShell :** décompresser l'archive dans `%USERPROFILE%\.claude\skills\` et vérifier que `ugc-creative-studio\SKILL.md` est directement dedans.

## Installation Claude.ai (si prise en charge du compte)

L'archive optionnelle `ugc-creative-studio-claude-ai.zip` contient directement `SKILL.md` et les références à sa racine ; utiliser l'interface des Skills personnalisés de Claude.ai si elle est disponible. Les chemins et commandes d'exécution sont optimisés pour **Claude Code** ; dans Claude.ai, les scripts facultatifs peuvent ne pas être disponibles. Il s'agit du **même** skill, sous un emballage différent.

## Démarrage rapide

```text
/ugc-creative-studio full Offre : ... / Objectif : préinscriptions / Cible : ... / Canal : TikTok et Instagram / Marché : France / Budget : pas de dépense sans accord.
/ugc-creative-studio brief Analyse cette page produit et prépare un brief publicitaire.
/ugc-creative-studio casting Trouve 5 créateurs UGC adaptés à ce brief, uniquement avec profils vérifiables et liens.
/ugc-creative-studio production Voici un brief validé. Propose 3 concepts et écris 3 scripts de 30 s.
/ugc-creative-studio qa Audite la publicité et les droits avant toute mise en ligne.
/ugc-creative-studio audit Voici le script et les rushes, indique les points faibles.
/ugc-creative-studio iterate Voici les métriques réelles de la campagne A/B ...
/ugc-creative-studio video Fais une publicité motion design MP4 de 15 s, verticale, avec un audio original, à partir du brief validé. Fais une preview avant le rendu final.
/ugc-creative-studio render Voici ma scène HTML et le storyboard ; capture les frames avec Chrome, exporte le MP4 FFmpeg, audite le résultat.
```

**Ce que le skill rend :** dossier `campaigns/<nom>/` avec brief, casting, concepts, scripts, storyboard, QA, protocole de test et manifeste vérifiable. Il peut fonctionner seulement sur le script/QA si tel est le besoin. **Avec Node 22 + Chrome/Chromium + FFmpeg :** MP4 réellement assemblé pour scènes de motion design codé ; **sans outil compatible :** production package sans faux MP4.

## Rendu vidéo local (nouveau dans v1.1)

**Prérequis :** Node.js 22+, Chrome ou Chromium, FFmpeg avec `libx264`, Python 3.10+ pour générer une piste originale et inspecter la vidéo. Sur ton Mac, la détection du Chrome installé est automatique dans la plupart des cas.

```bash
cd ~/.claude/skills/ugc-creative-studio
python3 scripts/generate_audio.py --output /tmp/demo-ugc.wav --seconds 3 --seed 42
node scripts/render_video.mjs examples/motion-demo/index.html \
  --output /tmp/demo-ugc.mp4 --duration 3 --fps 24 \
  --width 540 --height 960 --audio /tmp/demo-ugc.wav \
  --stills /tmp/demo-ugc-stills
python3 scripts/inspect_video.py /tmp/demo-ugc.mp4 \
  --duration 3 --fps 24 --width 540 --height 960 --require-audio --json
```

Le moteur fonctionne en local et sans `npm install`. Le fichier `scene.html` doit être **autonome** : scripts et styles inclus ; aucun HTTP externe, CDN ni asset disque relatif. Pour clips humains réels, utiliser une production UGC autorisée ou un montage hybride. Les vidéos issues du moteur ne sont **jamais automatiquement approuvées pour diffusion**.

Consulter `references/rendering-pipeline.md` (architecture, préflight, QA) et `references/visual-style-library.md` (15 familles visuelles et sources des sept ressources).

## Contrôle local facultatif

Python 3.10+ (standard library uniquement) :

```bash
python3 ~/.claude/skills/ugc-creative-studio/scripts/verify_campaign.py campaigns/ma-campagne --goal preproduction
python3 ~/.claude/skills/ugc-creative-studio/scripts/verify_campaign.py campaigns/ma-campagne --goal publish
```

Ces contrôles ne vérifient que la structure : la véracité des claims, les contrats, l'obtention des droits, la lecture du MP4, les politiques applicables et la décision finale restent à vérifier par des personnes habilitées.

Tests du validateur :

```bash
python3 -m unittest discover -s ~/.claude/skills/ugc-creative-studio/tests -v
```

## Composition

```text
ugc-creative-studio/
├── SKILL.md                       # Unique skill et orchestration
├── README.md
├── references/
│   ├── brief.md                  # B1–B5
│   ├── casting.md                # C1–C5
│   ├── production.md             # P1–P5
│   ├── validation.md             # Q1–Q5
│   ├── platforms-compliance.md
│   ├── templates.md
│   ├── research-notes.md
│   ├── rendering-pipeline.md
│   └── visual-style-library.md
├── scripts/
│   ├── verify_campaign.py
│   ├── render_video.mjs            # Chrome CDP → FFmpeg, Node 22+, sans npm
│   ├── generate_audio.py          # musique originale déterministe, WAV
│   └── inspect_video.py           # contrôle ffprobe indépendant
├── tests/
│   ├── test_verify_campaign.py
│   └── test_render_pipeline.py
├── evals/
│   └── evaluations.json
└── examples/
    ├── fictional-trail-app.md
    └── motion-demo/index.html
```

## Transparence et confidentialité

- Dossier original, **non affilié à Influee**, ni à TikTok, Meta, Google, Anthropic ou à une agence UGC.
- Toute recherche live dépend de l'accès de Claude Code aux outils et aux sources autorisées. Aucun compte de créateur inventé.
- Le rendu codé s'exécute en local quand il est demandé ; aucune publicité n'est envoyée, publiée, payée ni générée par un service externe sans action explicite et environnement approprié.
- Éviter l'envoi de secrets commerciaux, références non publiées, plans techniques ou données personnelles à des APIs tierces non autorisées.
- Les exigences légales sont consultables dans `references/platforms-compliance.md` et doivent être **revérifiées** avant diffusion.

**Licence :** MIT — fichiers originaux du package. Les sources citées restent propriété de leurs auteurs.