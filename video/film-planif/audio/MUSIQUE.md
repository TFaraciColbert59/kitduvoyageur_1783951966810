# Musique originale « Rien oublié » (20,000 s)

Composée pour le film le 23/11/2026, dans l'esprit de la bande-son de la vidéo d'Anthropic envoyée par Tony. La référence a été mesurée (pas écoutée) : environ 92 BPM, tonalité de sol mineur (sol, si bémol, ré, fa), un départ presque silencieux, une pulsation grave continue, puis une fin qui s'éteint sur le logo.

## Ce qu'elle est
- **Instruments** : piano, nappe de cordes synthétiques, basse pulsée en croches, grosse caisse sourde et impacts graves. Tout est synthétisé de façon déterministe par `src/compose.py` (numpy). Aucun échantillon externe, donc aucun droit à payer.
- **Tempo** : 90 BPM, un temps = 0,6667 s, une mesure = 2,667 s. **Tonalité** : sol mineur.
- **Fichiers** : `musique-20s.wav` (48 kHz, stéréo, 24 bits, 960 000 échantillons) et `musique-20s.mp3` (192 kb/s).
- **Niveau** : −13,9 LUFS intégré, crête −1,0 dBFS, plage de sonie 6,1 LU.

## Calage sur le film
| Temps (s) | Musique | Image |
|---|---|---|
| 0,000 | grave et nappe dès l'image 0, puis une note de piano par mot (temps 0, 2, 3, 4, 5) | « Partir loin. Sans rien oublier. » |
| 4,667 – 8,000 | respiration : scintillement aigu, souffle qui monte, cinq notes pincées pour les cinq jours | la Terre, puis le tracé |
| 8,000 – 16,000 | pulsation : croches de basse, grosse caisse sur chaque temps, accords Sol m → Mi bémol → Si bémol → Fa ; une note de piano sur chaque coupe (toutes les 1,000 s) | les 8 preuves |
| 16,000 | résolution sur Si bémol majeur | « Tout est prévu. » |
| 18,000 | impact grave + accord aigu de sol, extinction jusqu'à 20,000 | le logo |

`musique-20s-spectre.png` montre le spectre du montage, avec les sections bien visibles.
