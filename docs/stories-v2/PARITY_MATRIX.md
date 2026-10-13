# Stories V2 — Matrice de parité

Légende : ✅ implémenté · 🟡 partiel · ⬜ non implémenté · 🧪 testé (preuve)

| Parcours | Contrat LKDV | État |
| --- | --- | --- |
| Découvrir | Rail mobile + desktop, soi en premier, « Ajouter » | ✅ |
| Découvrir | Anneaux non-vu/vu | ✅ (story_views batché) |
| Ouvrir | Reprise à la première slide non vue | ⬜ (PR suivante) |
| Avancer/Revenir | Tap, swipe, clavier, fin → auteur suivant | ✅ |
| Pauser | Maintien, Espace, onglet caché, buffering, erreur | ✅ |
| Photo | 5 s, progression pausable au point exact | ✅ |
| Vidéo | Lecture réelle, pause, son, autoplay bloqué | ✅ player · ⬜ upload (phase 03) |
| Publier | Photo privée + légende + audience + idempotence | ✅ |
| Publier | Vidéo, recadrage, multi-slide, textes | ⬜ (phase 03) |
| Audience | public/followers/close_friends/only_me | ✅ UI + RLS ; club ⬜ |
| Vues | Unique, 1 s d'affichage, auteur privé | ✅ (enregistrement + lecture auteur en base ; UI liste visiteurs ⬜) |
| Likes | Like idempotent, pas de compteur public | ✅ |
| Réponses DM | Réponse privée via messagerie canonique | ⬜ (phase 05 suite) |
| Archive / Highlights | Privé, toggle, albums profil | ⬜ (phase 06) |
| Stickers / overlays | Sondage, quiz, questions, kit/parcours | ⬜ (phase 07) |
| Partage | DM/deep link, attribution, pas d'élargissement | ⬜ (phase 08) |
| Modération | Signaler/bloquer/masquer/supprimer | 🟡 (report/block/delete ✅ ; masquage UI ⬜) |
| Sécurité média | URL privée inviolable | ✅ (matrice prod 16/16) |
