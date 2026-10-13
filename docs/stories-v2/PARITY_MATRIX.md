# Stories V2 — Matrice de parité

Légende : ✅ implémenté · 🟡 partiel · ⬜ non implémenté · 🧪 testé (preuve)

| Parcours | Contrat LKDV | État |
| --- | --- | --- |
| Découvrir | Rail mobile + desktop, soi en premier, « Ajouter » | ✅ (rail iOS) |
| Découvrir | Anneaux non-vu/vu | ⬜ (phase 04 — `story_views`) |
| Ouvrir | Premier slide non vu, préchargement suivant | ⬜ (phase 04) |
| Avancer/Revenir | Tap, swipe, clavier, fin → auteur suivant | ✅ (viewer actuel) |
| Pauser | Maintien, onglet caché, overlays | 🟡 (maintien ✅, onglet ⬜ phase 02) |
| Photo | 5 s, progression | ✅ |
| Vidéo | Durée réelle, pause, son, autoplay bloqué | ⬜ (phase 02) |
| Publier | Photo privée + légende + idempotence | ✅ (phase 01) |
| Publier | Vidéo, recadrage, multi-slide, textes | ⬜ (phase 03) |
| Audience | public/followers/close_friends/club/only_me | 🟡 (SQL ✅, sélecteur UI phase 04) |
| Vues | Auteur seul, unique, batch | ⬜ (phase 05) |
| Likes / réponses | Like idempotent, DM canonique | ⬜ (phase 05) |
| Archive / Highlights | Privé, toggle, albums profil | ⬜ (phase 06) |
| Stickers / overlays | Sondage, quiz, questions, kit/parcours | ⬜ (phase 07) |
| Partage | DM/deep link, attribution, pas d'élargissement | ⬜ (phase 08) |
| Modération | Signaler/bloquer/masquer/supprimer | 🟡 (report/block/delete ✅ ; masquage UI ⬜) |
| Sécurité média | URL privée inviolable | ✅ (phase 01, `stories_v2_access.test.sql`) |
