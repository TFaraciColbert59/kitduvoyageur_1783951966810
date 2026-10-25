# Constats — étapes Où et Résa (phase 7)

Banc : `tests/e2e-compas-full/ou/controles-*.spec.ts` et `resa/controles-1-resa.spec.ts`, aperçu
`kitduvoyageur-1783951966810-9gsrib57l.vercel.app`, passage `proof/compas-full/ouresa-010208`
(80 contrôles sur 88 vérifiés). Un scénario qui révèle un défaut de l'application reste en échec.

## Défauts de l'application

### O-01 — « Annuler la préparation » ferme l'aventure
- Où : carte Où, bouton « Annuler la préparation » (scénario « Annuler la préparation » défait le prérempli…, **en échec**).
- Observé : après l'annulation, `/compas` affiche « Quelle aventure préparer ? » (choix du voyage) au lieu de l'aventure ; il faut la rouvrir par le choix de voyage pour voir « Tout préparer pour moi ». Reproduit sur deux espaces d'essai.
- Attendu : rester sur l'aventure, avec « Tout préparer pour moi » à la place du bouton.

### O-03 — une nuit jamais choisie est dite « Noté »
- Où : Résa › Nuits, ligne de chaque nuit et carte Résa.
- Observé : après préparation, la nuit 1 contient déjà « Hébergement à réserver · <lieu> » et porte la pastille « Noté » (la carte Résa l'annonce « Noté : … (non réservé) ») sans que la personne ait rien noté. Effacer le champ + OK la ramène à « nuit à trouver ».
- Attendu : un texte proposé par le Compas ne devrait pas se lire comme un hébergement noté (doctrine « rien d'inventé »).
- Note : le scénario ne l'échoue pas (annotation `constat`), il vérifie le geste de saisie.

### O-04 — « depuis Lyon » n'est pas retenu à la préparation (à confirmer)
- Où : Compas vide, phrase « une randonnée à Chamonix depuis Lyon ».
- Observé : le résumé « Voici ce que j'ai compris » n'a pas de ligne Départ ; après préparation, la carte Où n'affiche pas « Effacer le départ ». Dans le tiroir Où, « Dis-le » lit bien « Départ : Lyon » mais propose aussi « Destination : Lyon » pour « départ de Lyon » (« Appliquer (2) »).
- Attendu : le départ dit est retenu et la destination ne change pas.

### O-05 — « Tout préparer pour moi » est lent (observation)
- Observé : de 80 s à plus de 5 min (jusqu'à plus de 15 min lors d'un passage) pour refaire le prérempli d'une aventure déjà préparée en 15 s ; pendant ce temps les contrôles sont grisés. Chaque retouche d'une aventure préparée (activité, durée, nuit) relance une réadaptation de 1 à 3 min. Le banc annule d'abord la préparation pour que les 17 tuiles répondent en 1 à 3 s.

### O-06 — aucun bandeau « mode test » sur la recherche d'hébergement (à confirmer)
- Observé : Résa › Nuits › « Chercher » rend de vrais hôtels avec prix (« tarif à revalider avant tout paiement ») sans la mention « mode test » ; le bandeau n'apparaît que si la réponse est en `sandbox`. Si l'aperçu devait être en bac à sable, il ne l'est pas. Rien n'a été réservé (lecture seule).

## Contrôles non testés en session (raison)

| Contrôle | Raison |
|---|---|
| Où › Parcours › « Un jour de moins / de plus » et « Choisir ce parcours » | Le catalogue de parcours de l'aperçu ne renvoie aucun résultat depuis le départ des aventures d'essai (recherche et « Autour » vides) ; la fiche d'un parcours n'est atteinte que si le catalogue répond. « Choisir » écrirait de plus un parcours réel. Les boutons de jours n'existent que sans durée fixée. |
| Où › Préférences › « Voir le groupe » | N'apparaît que pour une personne en lecture seule (collaborateur) ; il faut deux comptes. |
| Où › carte › « Effacer le départ » | Voir O-04 : aucun départ dit n'est retenu par la préparation ; l'appliquer par « Dis-le » changerait aussi la destination. |
| Où › Quand › case du calendrier | Le calendrier dépend de la météo (MET Norway / NASA POWER) : absent selon les passages (annotation « non testé »). |
| Résa › Nuits › « Voir l'offre » | Les offres rendues n'ont pas d'adresse sur l'aperçu. |
| Résa › Offres › lien partenaire (Extras) | Aucune offre partenaire pour ces destinations. |

Les liens partenaires exercés (Parcours › activités guidées, Nuits › hôtels, Offres › Activités) sont
cliqués avec la cible interceptée par le banc : le partenaire et la redirection `/go/…` ne reçoivent
jamais la requête, aucun clic d'affiliation n'est enregistré, aucune réservation n'est lancée.

## Limites du banc rencontrées

- L'ouverture d'un « essai sans compte » est limitée par connexion (« réessaie dans une heure ») :
  les rejeux utilisent `COMPAS_REUSE_STATE=<état d'un espace déjà créé>` (aides `ou/_fx.ts`).
- Le dernier passage a réutilisé l'espace d'essai créé et préparé par le passage `ouresa-004731`.
- `ou/fumee.spec.ts` et `resa/fumee.spec.ts` (fixtures du banc, pas les miennes) ont échoué dans ce
  passage faute de pouvoir ouvrir un nouvel essai.
