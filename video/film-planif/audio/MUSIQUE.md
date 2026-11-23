# Musique originale « Rien oublié » (20,000 s)

Composée pour le film le 23/11/2026, dans l'esprit de la bande-son de la vidéo d'Anthropic envoyée par Tony. La référence a été mesurée (pas écoutée) : environ 92 BPM, tonalité de sol mineur (sol, si bémol, ré, fa), un départ presque silencieux, une pulsation grave continue, puis une fin qui s'éteint sur le logo.

## Version 2 (après l'écoute de Tony : « on dirait une intro YouTube de 2012 »)
La version 1 (nappes en dents de scie, grosse caisse, souffles de bruit blanc) est abandonnée. La version 2 est **poétique, épique et calme, avec un rythme régulier**, dans l'esprit de l'orgue d'*Interstellar* et de Max Richter :
- **orgue à tuyaux** (jeux de 16, 8, 4 et 2 2/3 pieds) pour la grandeur ;
- **piano feutré** : une note par mot au début, puis des croches régulières (sol, ré, si bémol, ré) qui battent comme une horloge, de plus en plus présentes ;
- **cordes** (ensemble à l'archet lent, vibrato) et **chœur « ah »** à partir de 12 s ;
- **aucune percussion** : seulement des roulements graves très doux aux changements d'accord ;
- grande salle de 4 s.

Courbe de sonie (momentanée) : environ −18 LUFS au début, −23 à la respiration (la Terre), montée de −16 à −9 de 8 à 16 s, sommet à −8,6 sur « Tout est prévu », retombée à −16 sur le logo. Intégré −13,3 LUFS, crête −1,0 dBFS, plage de sonie 6,4 LU.

## Ce qu'elle est
- **Instruments (v2)** : orgue, piano feutré, cordes, chœur. Tout est synthétisé de façon déterministe par `src/compose.py` (numpy). Aucun échantillon externe, donc aucun droit à payer.
- **Tempo** : 90 BPM, un temps = 0,6667 s, une mesure = 2,667 s. **Tonalité** : sol mineur.
- **Fichiers** : `musique-20s.wav` (48 kHz, stéréo, 24 bits, 960 000 échantillons) et `musique-20s.mp3` (192 kb/s).
- **Niveau (v2)** : −13,3 LUFS intégré, crête −1,0 dBFS, plage de sonie 6,4 LU.

## Calage sur le film
| Temps (s) | Musique | Image |
|---|---|---|
| 0,000 | grave et nappe dès l'image 0, puis une note de piano par mot (temps 0, 2, 3, 4, 5) | « Partir loin. Sans rien oublier. » |
| 4,667 – 8,000 | respiration : notes de verre aiguës, l'orgue s'ouvre, cinq notes de piano pour les cinq jours, les croches commencent à 6 s | la Terre, puis le tracé |
| 8,000 – 16,000 | crescendo : orgue et cordes sur Sol m → Mi bémol → Si bémol → Fa (2 s chacun), chœur à 12 s, croches du piano de plus en plus présentes | les 8 preuves |
| 16,000 | arrivée sur Si bémol majeur, plein orgue, cordes et chœur | « Tout est prévu. » |
| 18,000 | tout retombe sur un sol grave de l'orgue et une note aiguë de piano, extinction jusqu'à 20,000 | le logo |

`musique-20s-spectre.png` montre le spectre du montage, avec les sections bien visibles.
