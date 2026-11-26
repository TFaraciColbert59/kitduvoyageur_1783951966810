# Trailer LKDV 60 s — Inventaire de préparation

État relevé le 11/11/2026 sur la branche `claude/eager-gates-e7wny4`, dans un conteneur neuf. Chaque ligne vient d'une commande lancée ce jour-là.

## Prêt

| Élément | État | Preuve |
|---|---|---|
| Documents de référence | Lus en entier : `TRAME-60s.md`, `PROMPTS-CHATGPT.md`, `ANALYSE-REFERENCES.md`, `MUSIQUE.md`, `CLAUDE.md` | 5 sur 5 |
| Dépendances `trailer/` | `npm ci` passé ; `hyperframes` 0.9.33, `three` 0.180.0 | `npx hyperframes --version` |
| Playwright | `require('playwright')` fonctionne depuis `trailer/` sans lien à créer | import testé |
| HyperFrames `doctor` | Chrome, FFmpeg 6.1.1, FFprobe, Node 22 : passés. Échecs seulement sur des options inutiles ici (whisper, TTS, MusicGen, Docker) | `npx hyperframes doctor` |
| Skills HyperFrames | 9 installés et à jour : `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `figma`, `slideshow`, `remotion-to-hyperframes`, `reverse-any-video`, `style-sampling` | `npx hyperframes skills check` : « 9 current » |
| Skills du dépôt | `dispatching-parallel-agents`, `writing-plans`, `executing-plans`, `verification-before-completion`, `systematic-debugging`, `interaction-design` (Aura) présents | `.agents/skills/` |
| Modèles 3D HD | `assets/3d/lkdv-one-45.hd.glb` (49 501 776 octets, égal au manifeste) et `lkdv-one-25.hd.glb` (37 519 556 octets), ignorés par git | HTTP 200 |
| Références du sac | 9 rendus dans `assets/ref/` | présents |
| Temps de la musique | `assets/audio/storm-ii.beats.json` (380 temps, 136,9 BPM) | présent |
| Projet HyperFrames | `trailer/film/` initialisé (gabarit vide, aucune scène) ; `check` : 0 erreur, 0 avertissement | `npx hyperframes check --json` |
| Rendu de test | 2 s à 60 i/s : 120 images, 1920×1080, H.264, rendu en 7,2 s, puis supprimé | `ffprobe -count_frames` |
| Agents | `cosmos-vfx`, `landscape-director`, `ui-builder`, `sound-designer`, `trailer-chore`, `qa-critic` dans `.claude/agents/`, tous en `model: opus` | fichiers créés |
| Logo et polices | `public/assets/logo-mark.svg`, `public/assets/images/logo-mark.svg`, `public/logo.png` ; polices réellement appelées par `tokens.css` : Inter, Manrope, IBM Plex Mono, Instrument Serif (toutes dans `src/app/fonts`) | présents |

## Manquant (aucun n'est un blocage)

| Élément | Attendu | Présent |
|---|---|---|
| Images du film | 51 dans `assets/footage/` (`img01.png` … `img49.png`, `img09b.png`, `img35a.png`, `img35b.png`) | 0 (dossier absent) |
| Fiches personnages | 7 (`F1-lea.png` … `F7-noah.png`) | 0 |
| Musique | `assets/audio/storm-ii.mp3` | Absente : aucune pièce jointe n'est arrivée dans la session |
| Montage musical | `assets/audio/storm-ii-montage-60s.wav` | À refaire dès que le MP3 est là (commande dans `MUSIQUE.md`) |
| Écrans de l'app | 13 (E1–E13, 1290×2796) | 0 ; à capturer sur l'aperçu Vercel avec un compte de démonstration rempli |
| Maquette de rythme | `qa/maquette-rythme.mp4` (non versionnée) | Absente, à refaire avec la musique |

## Écarts par rapport à la consigne, à connaître

1. **Pas de skill « gsap » séparé.** HyperFrames 0.9.33 ne publie que les 9 skills ci-dessus (`skills update gsap` répond « Unknown skill »). GSAP est couvert par `hyperframes/references/motion.md`, `runtimes.md` et `npx hyperframes docs gsap`.
2. **Skill FFmpeg.** Aucun skill de compte. Le catalogue des plugins propose `ffmpeg-llm` (communautaire) : une carte d'installation a été affichée à Tony. Sans lui, on s'en passe : FFmpeg 6.1.1 est installé, et `media-use` couvre le mixage et les niveaux.
3. **Agent `trailer-chore` et non `chore`.** `.claude/agents/chore.md` existe déjà (Haiku, routage §1.9 du dépôt). Pour ne pas le remplacer hors de ce chantier, l'agent mécanique du trailer s'appelle `trailer-chore`, en Opus.
4. **`validate` est un alias déprécié de `check`** dans cette version : la porte unique est `npx hyperframes check --json` (lint, exécution, mise en page, contraste), plus `lint` pendant l'écriture.
5. **Les skills HyperFrames vivent dans `~/.claude/skills`**, hors du dépôt : dans un conteneur neuf, relancer `npx hyperframes skills`.
6. **Mesures de niveau sonore** : `doctor` prévient qu'elles ne sont comparables qu'avec FFmpeg 8.0.1 ; ici 6.1.1. Les chiffres LUFS porteront la version.
7. **GSAP est chargé depuis un CDN** dans le gabarit (`cdn.jsdelivr.net/npm/gsap@3.15.0`). Le rendu de test a passé ; une copie locale sera plus sûre pour le rendu final.
