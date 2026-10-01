# Compas — check-list de test réel

À faire sur l'aperçu Vercel (`/compas`) avec un compte qui a déjà un voyage (le vôtre).
Chaque ligne : **geste → résultat attendu**. Noter ce qui diffère, avec une capture.

> Le compte `claude-demo@lkdv-test.dev` n'a aucun voyage : il montre seulement le flux de création d'aventure.

## 0. Arrivée
- Ouvrir `/compas` → l'écran s'affiche (pas de page blanche, pas d'erreur).
- Ouvrir `/prepare`, `/prepare?tab=equipement`, `/prepare?nouvelle=1` → atterrissent sur `/compas`, `/compas?etape=kit`, `/compas?nouvelle=1`.
- Sans aventure active, ou `?nouvelle=1` → flux de création d'aventure.

## 1. Où et quand
- Règle de durée : glisser 4 j → 5 j puis ✓ → les dates changent et les étapes sont redécoupées (vérifier dans le hub).
- Quand → calendrier : prévision réelle (16 jours) puis tendance étiquetée ; heure de départ conseillée.
- Parcours : « Autour », recherche « Vercors », « Mes randos » ; choisir un parcours → étapes créées sans rien supprimer.
- Sur le tracé : points d'eau, abris, vues ; filtre par catégorie ; crédit OpenStreetMap ; points aussi sur la carte.
- Dis-le : « 3 jours à 4, départ samedi, bivouac, tranquille » → propositions cochables ; **un nombre absent de la phrase est refusé** ; « Compris par l'IA » si la clé IA est active, sinon règles seules.

## 2. Nous
- Équipe : allure et niveau de chaque membre (« non renseigné » sinon), rythme du groupe.
- Nombre de personnes ± (éditeur) ; le bouton « − » ne descend pas sous le nombre de membres.
- Budget : « Qui doit quoi » avec des dépenses réelles partagées ; une dépense à parts libres est signalée comme non incluse.
- Invitations et rôles → renvoi vers `/hub/groupe` uniquement.

## 3. Résa
- Nuits : une ligne par nuit ; noter un hébergement ne réserve rien.
- Recherche d'hébergement (si RouteStack actif sur Vercel) : « Chercher » → offres ; **mode test signalé** ; « Noter » écrit le nom ; « Voir l'offre » ouvre le lien partenaire ; aucun paiement n'est lancé.
- Offres : bandeau de transparence affiché, liens `sponsored nofollow`.
- Total des réservations converti si le voyage n'est pas en euros (taux BCE et date affichés).

## 4. Verdict
- Trois axes (physique, technique, conjoncturel) : « non évalué » quand la donnée manque, jamais « RAS » par défaut.
- Chaque signal : source et date. Aucun score.
- **Pas encore branchés** : alertes officielles (Meteoalarm) et explication IA du verdict.

## 5. Kit
- Conseils : pluie, froid, chaleur, frontale, eau ; chacun cite jour, valeur et source.
- Mes kits : appliquer un de ses kits ajoute seulement les objets absents.
- Porteur, emballage, objets vitaux manquants, objets prêtés.

## 6. Tiroirs et gestes
- Poignée : tirer vers le haut/bas → petit, moyen, grand ; depuis « petit », tirer vers le bas ferme.
- Onglets de tiroir qui défilent sans chevauchement (5 à 6 onglets).
- Aucun défilement horizontal de la page ; barre d'onglets et zones tactiles utilisables au pouce.

## 7. À signaler en priorité
Tout écart avec la maquette v8 (espacements, matière du verre, textes), toute erreur à l'écran, tout chiffre qui paraît faux.
