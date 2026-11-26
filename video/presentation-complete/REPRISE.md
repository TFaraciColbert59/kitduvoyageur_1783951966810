# Reprise — état du film au 26/11/2026

**Branche de travail :** `claude/film-presentation-ultime`, partie de `claude/great-galileo-i6majd`. Le prompt est dans `PROMPT-CLAUDE-CODE.md`.

## Fait

| | Fichier |
|---|---|
| ✅ | **Inventaire** de `main` `d52a006`, sans changement depuis le 23/11 : `INVENTAIRE.md` |
| ✅ | **Script de tournage** en lecture seule, testé sur Manifeste et Pro : `tools/capture/tournage.cjs`, mode d'emploi dans `TOURNAGE.md` |
| ✅ | **Données de démo enrichies** avec l'accord de Tony, annulables : `tools/donnees/film-seed.sql` et `film-annuler.sql` |
| ✅ | **Références et bible** : `REFERENCES.md` et `BIBLE.md`. L'étude est faite d'après des analyses publiées, pas image par image. |
| ✅ | **Scénario v0**, à caler sur la musique : `SCENARIO.md` |

## Bloqué

- **Le réseau de la session cloud** refuse `*.supabase.co`, les tuiles de carte, Mixkit, TikTok, Instagram et X (403).
  - Le réglage se trouve sur claude.ai, dans un navigateur : Réglages › Capacités, « tous les domaines ».
- **Le mot de passe de `demo@lkdv.app`** : seul Tony l'a. Il va dans un fichier hors du dépôt (`PWFILE`).

## Ensuite, dans l'ordre

1. Vérifier le réseau :

   ```bash
   curl -sI https://icxyvwzfjbflcbqukpfz.supabase.co/auth/v1/health
   ```

2. Préparer l'app au SHA de `origin/main` :
   - `npm ci` ;
   - `.env.local` avec l'URL Supabase et la clé publique (anon), à récupérer par le connecteur Supabase (`get_publishable_keys`) ;
   - `next dev -p 3000`.
3. Lancer `tournage.cjs connexion`, puis `decouverte`. Regarder les planches, écarter tout ce qui est sale, ajuster `PLANS` et `GESTES`, puis lancer `plans` et `gestes`.
4. Filmer la page Live en local : le lien vit en mémoire du serveur, donc rien n'est écrit en base.
5. Musique :
   - télécharger et analyser la piste avec numpy (tempo, temps, drop, tonalité), ou composer une piste originale si aucune piste sous licence n'est joignable ;
   - caler `SCENARIO.md` sur la grille de ses temps.
6. Construction HyperFrames (skills `hyperframes` et `product-launch-motion` présents dans `.claude/skills` de cette branche), son, rendu 60 i/s, coupes 15 s et 16:9, contrôles, relecture par un sous-agent DA, `DECISIONS.md`, push.
