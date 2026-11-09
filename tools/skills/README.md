# UGC Creative Studio — pack Claude

Cette zone contient le skill publicitaire UGC Creative Studio v1.1 (20 compétences : brief, casting, production, validation) avec son moteur de rendu HTML/Canvas/SVG → Chrome → FFmpeg.

## Installation dans Claude Code (depuis ce dépôt)

Depuis la racine du dépôt :

```bash
mkdir -p ~/.claude/skills
unzip -o tools/skills/ugc-creative-studio.zip -d ~/.claude/skills
```

Ou pour une installation limitée au projet :

```bash
mkdir -p .claude/skills
unzip -o tools/skills/ugc-creative-studio.zip -d .claude/skills
```

L'archive contient le dossier complet `ugc-creative-studio/`, avec `SKILL.md`, références, scripts, tests et exemples.

Commande de départ :

```text
/ugc-creative-studio full Crée une publicité UGC de 30 secondes pour LKDV, avec brief, casting, storyboard, production vidéo locale si réalisable, et contrôle qualité. Ne dépense rien et ne publie rien sans mon accord.
```

**Sécurité :** éviter toute divulgation d'informations confidentielles sur les produits LKDV ; aucune dépense ni publication automatique.
