# Skills tiers inclus dans `.claude/skills/`

| Skill | Rôle dans le projet | Dépôt | Licence | Commit |
| --- | --- | --- | --- | --- |
| hyperframes, hyperframes-cli, hyperframes-registry, media-use | Moteur de rendu unique | github.com/heygen-com/hyperframes | Apache-2.0 | 0b531bc |
| gsap-core, gsap-timeline, gsap-plugins, gsap-performance, gsap-utils | Animation, easing, timelines | github.com/greensock/gsap-skills | MIT | aed9cfd |
| lemo-opuscar (+ `docs/references/lemo-opuscar/`) | Direction artistique et langage cinématographique, référence seulement | github.com/lemomo-ai/lemo-opuscar | MIT | 9eb7739 |
| motion-design | Méthodologie (carte des temps, stills d'abord, brouillon avant master, critiques), référence seulement | github.com/howseen-ai/claude-motion-design | MIT | 3d90d34 |
| onetake (sans `assets/`, `cases/`, `gallery/`) | Continuité visuelle des transitions, référence seulement | github.com/feitangyuan/onetake | PolyForm Noncommercial 1.0.0 (voir ci-dessous) | abb6d17 |
| ffmpeg-media-processing (skill `media-processing` renommé) | Mixage, encodage, contrôles | github.com/mrgoonie/claudekit-skills | MIT (déclaré dans l'en-tête du skill) | 80113d8 |

## Licence à risque : OneTake

- **OneTake** (github.com/feitangyuan/onetake, commit abb6d17) est sous **PolyForm Noncommercial 1.0.0** : usage commercial non autorisé sans accord de l'auteur. Un trailer d'un produit commercial est probablement un usage commercial. Installé sur décision explicite de l'utilisateur (10/11/2026), en référence de continuité seulement, sans son moteur ni ses dossiers de démos. Pour une diffusion commerciale propre : obtenir une licence auprès de l'auteur, ou retirer `.claude/skills/onetake/`.

## Remarques

- Conserver les fichiers de licence et mentions de droit d'auteur présents dans chaque dossier de skill.
- Le skill `hyperframes` demande d'exécuter `npx hyperframes events --skill=hyperframes` au démarrage : cela envoie le nom du skill avec la télémétrie habituelle de la CLI (liée au compte si connecté). Voir `CLAUDE.md` pour la consigne retenue.
