# Livraison du trailer LKDV 60 s — 14/11/2026

Deux fichiers, envoyés à Tony dans la conversation et rangés dans `trailer/livraison/` (non versionné : ils contiennent la musique) :

| Fichier | Format | Images | Durée | Son |
|---|---|---|---|---|
| `LKDV-trailer-16x9-final.mp4` | 1920×1080, 60 i/s, H.264 | 3 600 | 60,000 s | AAC 320 kb/s, −14,3 LUFS, crête −1,9 dBTP |
| `LKDV-trailer-9x16-final.mp4` | 1080×1920, 60 i/s, H.264 | 3 600 | 60,000 s | idem |

Bande son : mix v2 (`node tools/audio/build-all.mjs --v2`, voir `qa/SON-AUDIT.md`). Aucune image noire (blackdetect), aucun flash aux coupes (laplacien 1re/2e image ≤ 1,3 sauf P04 nuage et P44 plan fixe, vérifiés à l'œil).

## Refaire les fichiers

1. Recopier le mix dans le film s'il manque : `qa/mix-v1.wav` → `film/assets/audio/mix-v1.wav` (le film lit ce nom ; la livraison remplace la piste par le mix v2 à l'assemblage).
2. Rendre l'image en 6 tranches de 10 s (`--quality delivery --workers 2`), 16:9 depuis `film/`, 9:16 depuis un dossier posé par `tools/crops/stage-9x16.sh <dossier>`.
3. Assembler : liste concat avec `duration 10.000000` par tranche, `-c:v copy`, son `qa/mix-v2.wav` en AAC 320 kb/s avec `-aac_pns 0`, sans `-shortest` ni `-t`.

## Reste ouvert

- Écoute de Tony (liste précise dans `qa/SON-AUDIT.md`) ; licence de synchronisation de STORM II avant toute diffusion publique.
- P30→P31 : saut de lumière dans les images sources (une image de P31 à l'heure dorée le corrigerait).
- Écusson du sac : pictogramme montagne des images, pas encore remplacé par le logo exact.
- Compte démo : un carnet public « Dolomites · Lago di Sorapis » mis en avant ; à repasser en privé sur décision de Tony.
- Le trailer n'est ni fusionné dans `main` ni publié : décision de Tony.
