# Écrans E1–E13 du trailer : où ils sont dans l'app, ce qui est capturé

Aperçu (13/11) : `https://kitduvoyageur-17839519668-git-491ef3-tonyfaracip-3325s-projects.vercel.app` (l'ancien `…-4iswur70z…` a disparu) (jeton par la variable `VERCEL_SHARE`, jamais écrit). Captures 430×932 à ×3 = **1290×2796**, iPhone, thème clair, `fr-FR`, géolocalisation simulée (Sorapis). Scripts : `trailer/tools/capture/` (`lib.mjs`, `probe.mjs`, `demo-probe.mjs`, `kit-studio.mjs`, `compas.mjs`, `steps.mjs`).

**Accès constaté sur l'aperçu (11/11)** : toutes les pages de l'app exigent une session (`src/middleware.ts`, `APP_ROUTES`) sauf `/explorer` ; `/kit-studio` renvoie vers `/connexion` côté client. L'essai anonyme est éteint ; seul le bouton « Connexion démo » (compte partagé `compas_demo_7e7b` / « Camille Démo », identifiants côté serveur) ouvre l'app. Les fonds de carte `tiles.openfreemap.org` sont refusés par le proxy de cette machine : l'Explorer affiche un globe vide ici (ce n'est pas un défaut de l'app).

| Écran | Plan | Route et état | Gestes | Compte | img09 | Libellés RÉELS (code) | Capturé |
|---|---|---|---|---|---|---|---|
| E1 | P07, P09 | `/carnets/[id]` d'un autre voyageur (carnet public), défilement puis grande photo du lac | ouvrir le carnet depuis `/communaute`, défiler | oui (page protégée) + un carnet publié contenant img09 | **oui** | titre du carnet, moments ; pas de libellé fixe vérifié | **non** : aucun carnet « Dolomites » avec img09 n'existe ; à semer |
| E2 | P12 | `/compas?nouvelle=1` → « Où veux-tu aller ? » → phrase → préparation | taper « Les Dolomites, 4 jours à 4 », Entrée | oui (démo) | non | « Où veux-tu aller ? », « Je lis ta phrase… », « Presque prêt · 1 point » | **oui** : `assets/screens/E02a-compas-ou-vide.png`, `E02b-…-ou-saisi.png`, `E02c-…-preparation.png`, `E02d-…-prepare.png` |
| E3 | P13 | `/compas?etape=nous` (même aventure) | ouvrir la capsule Nous | oui | non | « Avec d'autres · 4 personnes », « Personnes dans le voyage · 4 personnes · dont 3 sans compte dans le groupe », « Inviter quelqu'un » | **oui** : `E03-compas-nous.png` — sans les prénoms Léa/Sami/Inès/Tom (seule « Camille Démo · toi » apparaît : les 3 autres sont des places sans compte) |
| E4 | P15 | `/compas?etape=verdict` ou `/explorer` : itinéraire 3D sur les Dolomites | — | oui | non | — | **non** : fonds de carte bloqués ici, et le Compas a résolu « Dolomites » en **« Dolomitenblick » (Renon)** sans itinéraire (« Pas encore d'itinéraire ») : défaut réel du Compas à signaler |
| E5 | P16 | `/kit-studio` (mode Contenu, puis bilan) | pilule « 2,8 kg » → bilan | oui | non | cartes d'objets en **pictogrammes** (`ITEM_GLB_BY_ID` vide), sac `.glb` réel ; bilan : « Base sèche », « Prêt à 93 % », « À louer » / « À acheter » (lignes du chemin vers 100 %) ; fiche objet : « En prêt », « À louer » | **partiel** : `E05a-kit-studio-contenu.png`, `E05b-kit-studio-bilan.png` ; **pas** de prêt/location ni de total qui fond (le kit démo n'en contient pas) ; la carte « Tasse Thermos … F.C. Barcelona » (donnée démo, marque) est visible sur E05a |
| E6 | P17 | `/kit-studio`, mode Apparence (crayon) | toucher « Apparence du sac » | oui | non | **« Commander · 5 pièces · 471 € »** (`ui/OrderButton.tsx`) ; `orderCta` (« Commander N articles · X € ») de `strings.ts` n'est utilisé nulle part | **oui** : `E06-kit-studio-commander.png` (5 pièces, pas 2 articles) |
| E7 | P25 | `/explorer`, activité démarrée, onglet direct | démarrer une sortie | non (Explorer public) mais GPS simulé | non | Explorer v2 `LiveDirectTab` : « Distance », « Allure », « Temps », « D+ », chrono `0:00` | **non** : fonds de carte bloqués ici. Le cockpit `/randonnee-active` est **supprimé** (redirigé vers `/explorer`) : « 0,00 km · 00:00 · D+ 0 m » n'existe pas tel quel |
| E8 | P29 | idem, après une trace simulée de 6,4 km | rejouer une trace GPS | idem | non | idem (valeurs calculées par l'app) | **non** (même raison) |
| E9 | P31 | ajout d'un moment au carnet (appareil photo) | — | oui | **oui** | à vérifier dans `components/carnet/v2/CarnetDrawerV2.tsx` | **non** |
| E10 | P36 | `/explorer` activité en course | — | GPS simulé | non | « Allure » (en km/h), « Distance », « D+ » | **non** |
| E11 | P48 | carnet de Léa + retour terrain | onglet retour terrain du carnet | oui + carnet semé | non (photo du lac de Léa) | « Essentiel » (`CarnetDrawerV2.tsx`, filtres essentiel/utile/jamais_servi/defaillant/manquait) | **non** |
| E12 | P49 | publication du carnet | — | oui ; **écriture** (publication publique) | non | — | **non** (publication = écriture publique, hors brief) |
| E13 | P51 | `/communaute`, fil « Carnet · Instantané publié » | — | oui | non (photo de Léa) | « CARNET · INSTANTANÉ PUBLIÉ » | **non** : le fil démo montre des profils d'autres comptes ; rien gardé |

Libellés de la trame qui **n'existent pas** dans Kit Studio : « Prêté par Sami » (existe seulement dans le tiroir des clubs : « Prêté par **{nom}** (@pseudo) · catégorie », `components/clubs/drawer/ClubDrawerHost.tsx`), « Occasion » (absent de Kit Studio ; existe dans la création de publication communauté). Kit Studio dit « En prêt », « À louer », « À acheter ». Ailleurs : « Prêté à {nom} » (`GearRow.tsx`), « Prêté » (`OutingGear.tsx`, `KitCard.tsx`).

Écriture en base faite : **1 brouillon Compas** (« Mixte · Dolomitenblick », 4 personnes) dans le compte démo partagé. Aucune autre écriture, aucun compte créé.

## Écritures faites dans le compte démo « Camille Démo » (13/11/2026, par l'interface uniquement) — à retirer ensuite
1. **18:26–18:29 UTC** : trois essais du formulaire « Créer · Carnet » (`/communaute` → « Créer dans l'application » → onglet Carnet) **non envoyés**. La photo du moment est téléversée dès qu'on la choisit (« elle est téléversée maintenant… pas à l'envoi ») : **2 copies orphelines de la photo du lac** (img09 en JPEG) dans le stockage du compte démo, sans carnet rattaché.
2. **18:30 UTC** : carnet **« Dolomites · Lago di Sorapis »** créé par « Créer le carnet » : destination « Lago di Sorapis, Dolomites », 14–16/07/2026 (3 jours), 4 voyageurs, visibilité **Public**, récit « Le sentier 215 depuis Passo Tre Croci, puis le lac. », jour 1 « Passo Tre Croci → Lago di Sorapis », 1 moment Photo (lieu « Lago di Sorapis », « Arrivée au lac. », photo du lac = couverture).
   **Visibilité** : « Public » = « Visible par toute la communauté ». Si l'aperçu partage la base de production (projet Supabase unique), ce carnet est visible de **tous les utilisateurs de l'app en production**.
3. Carnet créé : `/carnets/0740a421-b41a-46bf-8372-3e9210fd9a03`. Il apparaît dans `/communaute` → recherche → onglet carnets en tête, sous l'étiquette **« CARNET DE LA SEMAINE »** : il est donc **mis en avant pour tous les utilisateurs** tant qu'il reste public. À retirer (ou repasser en « Privé ») après le tournage.
4. Aucune sortie enregistrée, aucun retour terrain, aucun verdict écrit : l'activité Explorer de E7/E8/E10 n'a été ni terminée ni sauvegardée (Explorer public, sans connexion).

## Mise à jour du 13/11 (prévaut sur le tableau ci-dessus pour E1, E7–E13)
| Écran | Fichier | Remarque |
|---|---|---|
| E1 | `E01a-carnet-sorapis.png`, `E01b-carnet-jour1-photo.png` | page du carnet du trailer ; **pas de défilement** (fiche fixe, « zéro défilement de page ») : E01a = vue Résumé, E01b = jour 1 avec la photo du lac. Pas de visionneuse plein écran trouvée (toucher la photo ouvre le tiroir). Carte du bas centrée sur la France, « Aucun tracé enregistré pour ce carnet. » |
| E7 | `E07-explorer-depart.png` | Explorer, Randonnée, « Suivi en cours », 0 m |
| E8 | `E08-explorer-trace-6k4.png` | 6,4 km · 4,0 km/h · 1 h 36 · D+ 172 m, trace visible |
| E9 | `E09-carnet-moment-photo.png` | formulaire Carnet, étape Jours, moment « Photo » avec la photo du lac, « Remplacer la photo », « Ajouter un moment » |
| E10 | `E10-explorer-en-course.png` | 2,1 km · 3,5 km/h ; caméra 3D enfoncée dans le relief (défaut réel) |
| E11 | `E11x-carnet-verdicts-vide.png` (**provisoire**) | onglet Sac → verdicts : « Tous · Essentiel · Utile · Jamais servi · Défaillant · Manquait », mais « Aucun verdict pour ce carnet. » : un verdict exige une sortie réelle liée au kit (non faite) |
| E12 | `E12-carnet-partage-public.png` | étape Partage : « Aperçu de la fiche », « Public · 4 voyageurs », bouton **« Créer le carnet »** (pas de bouton « Publier ») |
| E13 | `E13-communaute-carnets-semaine.png` | onglet carnets de la communauté : « CARNET DE LA SEMAINE » = notre carnet ; « Carnet · instantané publié » n'existe que sur des publications portant `snapshot_payload` (fils de club, `PostAttachments.tsx`), sans parcours de création trouvé |
| E4 | — | non retenté (budget) |
