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

---

## Passage du 2026-10-01 (Chromium 390×844, compte démo, `next dev` + Supabase de production)

Déroulé par Claude dans le conteneur cloud, sur un voyage réel créé par l'interface
(« Villard-de-Lans et ses environs », 3 jours). ✅ conforme · 🔧 écart trouvé puis corrigé · ⚠️ limite.

| § | Résultat |
|---|---|
| 0 | ✅ `/compas` sans aventure → création ; `/prepare`, `?tab=equipement`, `?nouvelle=1`, `/ai-configurator`, `/rapport-kit`, `/configurateur` → bonnes destinations. |
| 0 | 🔧 **Bloquant** : « Enregistrer mon aventure » échouait toujours (503) — la route insérait la ligne `owner` que la policy refuse, alors que le trigger la pose déjà. Corrigé (`d18dac8`). Après l'enregistrement : retour sur `/compas` (au lieu du hub). |
| 1 | ✅ Règle 2 j → 3 j + ✓ : dates 10–12 oct. enregistrées. Redécoupage des étapes seulement avec un parcours du catalogue (vérifié : jour 3 créé, titres et hébergements gardés). |
| 1 | ✅ Quand : prévision 16 j (pastilles pleines) puis tendance (cerclées), heure de départ conseillée et « au plus tard ». |
| 1 | ✅ Parcours (Autour, recherche, Mes randos, choisir) ; Sur le tracé (état vide honnête + crédit OSM). ⚠️ Catalogue : 1 169 parcours sur 1 170 dans le Nord, aucun dans les Alpes ; un parcours de test « Phase 3 E2E Sancy » est visible en production. |
| 1 | ✅ Dis-le avec l'IA (NVIDIA, 1,4 s) : « Compris par l'IA, vérifié par le Compas » ; aucun nombre inventé (« des amis » ne devient pas un effectif). |
| 2 | ✅ Équipe, « − » bloqué au nombre de membres, « + » (personne hors groupe), lien `/hub/groupe`. Enveloppe 300 € ; dépense saisie dans le hub visible dans le Compas. 🔧 « 14 € par jour et par personne » mélangeait dépenses et enveloppe. ⚠️ « Qui doit quoi » demande deux comptes membres : non testable avec un seul compte. |
| 3 | ✅ Nuits (une par nuit, « Noter ne réserve rien »), recherche RouteStack en mode test signalé, « Noter », retrait. 🔧 Offres de Chamonix et Katmandou pour un voyage ailleurs ; libellé de repli « Hôtel · Ville » noté comme un vrai lieu ; pastille « confirmée » pour une nuit seulement notée ; la tuile d'un jour ouvrait la nuit 1. ⚠️ Conversion de devise non testée (voyage en euros). |
| 4 | ✅ Trois axes, aucun score, sources datées. 🔧 « RAS » affiché alors que le dénivelé était inconnu et les alertes officielles non lues → « RAS partiel » + liste de ce qui n'est pas vérifié. Toujours pas branchés : alertes officielles, explication IA. |
| 5 | ✅ Conseils datés et sourcés ; « Mes kits » (aucun kit : message honnête) ; emballer/déballer. 🔧 Sac vide affiché « Prêt · rien de vital ne manque » ; « Ajouter » depuis un conseil ouvrait toute la boutique ; « ★ 0 » pour un produit sans avis. |
| 6 | ✅ Poignée : moyen → grand → moyen → petit → fermé ; aucun défilement horizontal (390/390). 🔧 Ligne qui débordait en petite hauteur ; onglet actif hors champ ; résumé de carte visible à travers le tiroir agrandi. |
| 7 | 🔧 **Contraste** : texte blanc sur verre clair (couche globale `liquid-ios27`), illisible sur un vrai paysage. Encre prise sur les primitives. « Raid » et « Expédition » affichés ensemble pour 2 jours → une seule table (maquette v8). |

Limites du conteneur (pas de l'application) : Overpass et `api.open-meteo.com` coupés ou lents par le
proxy, d'où des rendus serveur lents (~15 s) et une recherche de lieux pauvre dans le flux de création ;
Realtime (WebSocket) non supporté par le proxy.

