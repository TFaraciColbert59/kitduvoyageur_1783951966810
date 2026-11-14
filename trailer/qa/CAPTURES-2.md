# Captures, deuxième passe (13/11/2026)

Aperçu : `https://kitduvoyageur-17839519668-git-491ef3-tonyfaracip-3325s-projects.vercel.app` (jeton passé par `VERCEL_SHARE`, jamais écrit). Fonds de carte OpenFreeMap : ils se chargent maintenant. Toutes les captures font 1290×2796 (vérifié).

- **E7** `assets/screens/E07-explorer-depart.png` : « Randonnée · Suivi en cours », « Direct », 0:04, « DISTANCE 0 m · ALLURE — · TEMPS 0:00 · D+ 0 m », « SOS ».
- **E8** `E08-explorer-trace-6k4.png` : « 6,4 km · 4,0 km/h · 1 h 36 · D+ 172 m », chrono 1:49:11, trace sur la carte 3D.
- **E10** `E10-explorer-en-course.png` : « 2,1 km · 3,5 km/h · 36:18 · D+ 89 m ». Défaut réel de l'app : la caméra 3D est enfoncée dans le relief.
- Méthode E7/E8/E10 (`tools/capture/explorer-live.mjs`) : Explorer public, sans connexion. Le GPS et l'horloge de l'appareil sont simulés dans la page (trace Tre Croci → Sorapis de 6,42 km, ≈ 1 m/s) et l'app calcule elle-même les chiffres. Rien n'est enregistré.
- **E1** `E01a-carnet-sorapis.png` (vue Résumé), `E01b-carnet-jour1-photo.png` (jour 1, photo du lac). La fiche ne défile pas (mise en page fixe). Je n'ai pas trouvé de vue de la photo en plein écran. La carte du bas est centrée sur la France avec « Aucun tracé enregistré pour ce carnet. »
- **E9** `E09-carnet-moment-photo.png` : moment « Photo », lieu « Lago di Sorapis », photo jointe, « Remplacer la photo ».
- **E11** `E11x-carnet-verdicts-vide.png` est **provisoire**. Le filtre « Essentiel » est réel, mais l'écran affiche « Aucun verdict pour ce carnet. » : un verdict exige une sortie liée au kit, qui n'a pas été faite.
- **E12** `E12-carnet-partage-public.png` : « Public · 4 voyageurs », bouton réel **« Créer le carnet »** (il n'y a pas de bouton « Publier »).
- **E13** `E13-communaute-carnets-semaine.png` : notre carnet en tête de l'onglet carnets, sous « CARNET DE LA SEMAINE ». Le libellé « Carnet · instantané publié » n'a pas de parcours de création trouvé.
- **E4** : non retenté (budget épuisé).

**Écritures dans le compte démo** (liste détaillée dans `SCREENS.md`) :
- Carnet public « Dolomites · Lago di Sorapis » (`/carnets/0740a421-…`, 18:30 UTC), 1 jour, 1 moment photo.
- 2 photos orphelines dans le stockage : elles sont téléversées dès qu'on les choisit, lors des essais non envoyés.
- Aucune sortie, aucun retour terrain.

**À décider par Tony** :
1. Le carnet est public et mis en avant comme « Carnet de la semaine », visible de tous les utilisateurs si la base est celle de la production. Faut-il le garder pendant le tournage puis le retirer ?
2. E11 : accepter l'écran vide ou faire une vraie sortie liée au kit.
3. E10 : accepter le défaut de caméra.
4. E4 : reste à faire.
