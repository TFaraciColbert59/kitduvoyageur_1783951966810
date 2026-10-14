# Stories V2 — Matrice de parité

Légende : ✅ implémenté · 🟡 partiel · ⬜ non implémenté · 🧪 testé (preuve)

| Parcours | Contrat LKDV | État |
| --- | --- | --- |
| Découvrir | Rail mobile + desktop, soi en premier, « Ajouter », fade iOS | ✅ |
| Découvrir | Anneaux non-vu/vu (batché, sobre quand vu) | ✅ |
| Découvrir | Archives accessibles depuis le rail | ✅ (panneau « Mes archives ») |
| Ouvrir | Reprise à la première slide non vue | ⬜ (backlog) |
| Avancer/Revenir | Tap, swipe, clavier, fin → auteur suivant, anti-double | ✅ |
| Pauser | Maintien, Espace, onglet caché, buffering, erreur, reprise | ✅ |
| Photo | 5 s, progression rAF pausable au point exact | ✅ |
| Vidéo | Lecture réelle, pause, son (préférence session), autoplay bloqué | ✅ |
| Publier | Photo/vidéo privée, **multi-slide ≤5**, légende, audience, idempotence | ✅ |
| Publier | Recadrage 9:16, dessins | ⬜ (backlog) |
| Overlays | **Texte** (composition v1, rendu viewer) | ✅ (lean) |
| Overlays | Sondages/quiz/questions/curseur/décompte, mentions/liens | ⬜ (P2) |
| Audience | public/followers/close_friends/only_me | ✅ ; club UI ⬜ |
| Vues | Unique, 1 s d'affichage, auteur privé (base) | ✅ ; UI liste visiteurs ⬜ |
| Likes | Idempotent, pas de compteur public | ✅ |
| Réponses DM | Réponse privée via messagerie canonique | ⬜ (P2) |
| Archive | Expirées conservées, liste auteur, suppression définitive | ✅ |
| Purge | Cron serveur idempotent, archives préservées, multi-bucket | ✅ (route ; planification opérateur) |
| Highlights | Albums « À la une » | 🟡 (tables+RLS appliquées ; UI gestion ⬜) |
| Partage | DM/deep link, attribution, republication | ⬜ (P2) |
| Modération | Signaler/bloquer/supprimer | ✅ ; masquage UI ⬜ |
| Sécurité média | URL privée inviolable, signed URL courte | ✅ (matrice prod 16/16) |
