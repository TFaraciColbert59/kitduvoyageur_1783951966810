# Stories V2 — Matrice de parité

Légende : ✅ implémenté · 🟡 partiel · ⬜ non implémenté · 🧪 testé (preuve)

| Parcours | Contrat LKDV | État |
| --- | --- | --- |
| Découvrir | Rail mobile + desktop, soi en premier, « Ajouter », fade iOS, en-tête + compteur | ✅ |
| Découvrir | Squelettes de chargement, erreur explicite + nouvel essai, états invités | ✅ |
| Découvrir | Anneaux non-vu/vu (batché, sobre quand vu) | ✅ |
| Découvrir | Archives accessibles depuis le rail | ✅ (panneau « Mes archives ») |
| Ouvrir | Reprise à la première slide non vue | ⬜ (backlog) |
| Avancer/Revenir | Tap, **double tape = j'aime**, swipe, clavier (ignoré en saisie), fin → auteur suivant | ✅ |
| Pauser | Maintien, Espace, onglet caché, buffering, erreur, **saisie**, reprise | ✅ |
| Photo | 5 s, progression rAF pausable au point exact | ✅ |
| Vidéo | Lecture réelle, pause, son (préférence session), autoplay bloqué | ✅ |
| Publier | Photo/vidéo privée, multi-slide ≤5, légende, texte, audience, idempotence | ✅ |
| Publier | Recadrage 9:16, dessins | ⬜ (backlog) |
| Overlays | Texte (composition v1, rendu viewer) | ✅ (lean) |
| Overlays | Sondages/quiz/questions/curseur/décompte, mentions/liens | ⬜ (P2) |
| Audience | public/followers/close_friends/only_me (+ reply_policy) | ✅ ; club UI ⬜ |
| Vues | Unique, 1 s d'affichage, UI liste visiteurs (auteur) | ✅ |
| Likes | Bouton + double tape, idempotent, pas de compteur public | ✅ |
| Réponses DM | **Champ de réponse dans le viewer → messagerie canonique** (metadata story_reply) | ✅ |
| Archive | Expirées conservées, liste auteur, suppression définitive | ✅ |
| Purge | Cron serveur idempotent (tir quotidien), archives préservées | ✅ |
| Highlights | Albums « À la une » (créer/épingler/supprimer) | ✅ |
| Partage | DM/deep link, attribution, republication | ⬜ (P2) |
| Modération | Signaler/bloquer/supprimer/masquer (UI auteur) | ✅ |
| Sécurité média | URL privée inviolable, signed URL courte | ✅ (matrice prod 16/16) |
