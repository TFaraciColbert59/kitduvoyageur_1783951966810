# Audit UX/UI complet des 8 Drawers & Sous-drawers du HUB LKDV

**Références du Design System LKDV analysées :**
- **Coque & Navigation Communauté V2** : `CommunitySheetShell` (`CapsuleTabs`, `SheetMiniCapsule`, `LensPager`, `SortMenuButton`, `staticSlot`, `footer` collant, `SheetDetail` avec `< Retour` + titre + méta `1 / N`, `island` de confirmation/undo, `IdentityPill`, cartes `.lkdv-cv2-card`, puces `.lkdv-cv2-chip`).
- **Palette & Surfaces Liquid Glass Carnet V2** (`carnet-v2.css` / `compte-v8.css`) : `--page: #f5f2ec`, `--label: #172b24`, `--label2: #56665d`, `--sep: rgba(23,43,36,0.1)`, `--fill: rgba(23,43,36,0.09)`, `--fill3: rgba(255,255,255,0.62)`, `--tint: #17402c`, `--tint-ink: #fff`, `--good: #3d7a52`, `--warn: #b98a2e`, `--warn-bg: #fbf1dc`, `--bad: #a8443a`, `--bad-bg: #f5ddd9`, `--water: #3f93b8`, mode extérieur haute lisibilité `.outdoor`.

---

## 0. Socle transverse des Drawers du HUB (12 améliorations structurelles P0)

Avant même le contenu de chaque tiroir, le problème racine vient de la manière dont `HubCockpit.tsx` consomme `CommunitySheetShell` (`hideCapsule`, `hideDetailTitle`, un seul `pane` fourre-tout, inputs HTML bruts).

1. **[P0] Réactiver la navigation `CapsuleTabs` + `SheetMiniCapsule` avec `LensPager`** : remplacer l’empilement vertical fourre-tout par 2 à 3 sous-onglets glissables horizontalement par drawer (comme dans Explorer/Création Communauté).
2. **[P0] Réactiver la barre de sous-drawer `SheetDetail` (retirer `hideDetailTitle`)** : afficher `< Retour` à gauche, le titre centré tronqué proprement et le compteur `meta` à droite (`2 / 7`, `J1`, etc.) au lieu d’un titre perdu dans le corps qui scrolle.
3. **[P0] Utiliser le `staticSlot` de `CommunitySheetShell`** : épingler le bloc KPI / résumé essentiel (température, total dépensé, barre de progression étapes, sélecteur de jour) hors du scroll comme la barre de recherche Communauté.
4. **[P0] Utiliser le `footer` collant de `CommunitySheetShell`** : placer l’action primaire de chaque tiroir (ex. `+ Ajouter une dépense`, `+ Ajouter un moment`, `Démarrer l’étape`) dans un CTA plein `--tint` / `--tint-ink` collé en bas avec safe-area iOS, au lieu d’un chip gris noyé en bas de page.
5. **[P0] Remplacer tous les `<input>`, `<select>` et `<textarea>` HTML bruts par le kit de champs Liquid Glass de `CarnetCreateSheet`** : hauteur 44px minimum, fond `--fill3`, bordure `1px solid var(--sep)`, rayon concentrique, focus ring `--tint`, labels typographiques `--label2` en 12px.
6. **[P0] Créer une hiérarchie claire de boutons (3 niveaux)** : Primaire plein (`--tint`, texte `#fff`), Secondaire verre (`--fill3` + bordure `--sep`), Destructif / Alerte (`--bad-bg` / `--bad`). Aujourd’hui tous les boutons utilisent `.lkdv-cv2-chip` sans hiérarchie.
7. **[P0] Structurer les contenus en sections groupées (style iOS / Carnet)** : cartes `.lkdv-cv2-card` sur fond `--fill3` avec en-tête de section 11px `uppercase` tracking `0.06em` (`--label2`) et lignes séparées par `1px solid var(--sep)`.
8. **[P0] Brancher l’île de retour (`island` de `CommunitySheetShell`)** : afficher des toasts pill flottants en haut (« Dépense ajoutée · Annuler », « Étape démarrée », « Copie hors ligne enregistrée ») au lieu de `<p role="status">` bruts qui décalent la mise en page.
9. **[P0] Unifier la palette sémantique des statuts** : utiliser systématiquement les jetons Carnet (`--good`/`--mint` pour validé/terminé, `--warn`/`--warn-bg` pour attention/expire bientôt, `--bad`/`--bad-bg` pour expiré/erreur/danger, `--water` pour eau/météo).
10. **[P1] Masquer proprement la barre flottante du bas à l’ouverture** : poser `body.lkdv-dialog-open` comme dans `carnet-v2.css` pour éviter la superposition visuelle entre le drawer et la tabbar.
11. **[P1] États vides illustrés et actionnables** : aligner `<Status>` sur `.lkdv-cv2-empty` de Communauté avec icône dans pastille ronde `--fill`, titre court, sous-texte explicatif et CTA direct.
12. **[P1] Mode « Plein soleil / Outdoor » partagé avec Carnet** : reprendre la classe `.outdoor` de `carnet-v2.css` (contraste renforcé `--ga: 0.9`, police 15px) pour rendre tous les drawers lisibles en plein soleil sur sentier.

---

## 1. Drawer **Météo** (16 améliorations)

1. **[P0] Hero météo épinglé dans `staticSlot`** : carte verre haute avec grande icône météo colorée (48px), température en `clamp(2.4rem, 9vw, 3.2rem)` tabulaire, condition, min/max du jour et badge lieu (`Ma position` vs `Chamonix`).
2. **[P0] Mini-capsule `SheetMiniCapsule` à 3 onglets glissables** : `Aujourd’hui` · `10 jours` · `Vigilances`. Fini la page interminable qui mélange tout.
3. **[P0] Frise horaire horizontale scrollable (type Apple Weather / Carnet)** : dans l’onglet `Aujourd’hui`, cartes horaires 24h (`09h`, `12h`, `15h`…) avec icône, température, barre bleue `--water` de précipitations et flèche de vent.
4. **[P0] Grille Bento 2×2 de tuiles techniques** : Vent & rafales (km/h), Précipitations (mm + probabilité), Risque gel / altitude isotherme, Praticabilité terrain (`weatherAdvanced.ts` : Sec / Humide / Boueux / Neige-verglas avec badge « Estimation »).
5. **[P0] Cartes d’alertes officielles MeteoAlarm (P03-19) stylées par sévérité** : bandeau `--warn-bg`/`--warn` (Jaune/Orange) ou `--bad-bg`/`--bad` (Rouge) avec icône triangle, zone (`Haute-Savoie`), heure d’expiration et source `MeteoAlarm CAP 1.2` en badge discret.
6. **[P0] Carte Feux actifs NASA EONET (P03-20) dédiée** : état visuel vert `--mint`/`--good` quand 0 feu dans le rayon (« Aucun feu actif dans un rayon de 150 km · NASA EONET »), ou carte rouge avec distance en km et lien carte.
7. **[P0] Cartes « Impact sur le voyage » reliées au Kit & Étapes** : présenter les alertes dérivées (`deriveWeatherAlerts`) comme des cartes conseils avec icône sac/boussole et bouton pill droit `Ouvrir Kit →` / `Voir Étapes →`.
8. **[P1] Liste 10 jours avec barre de plage thermique visuelle** : pour chaque jour (`sam.`, `dim.`…), afficher icône + min à gauche + barre dégradée horizontale proportionnelle + max à droite + goutte de pluie si > 0 mm.
9. **[P1] Sélecteur de point météo en segment pill** : bascule tactile 2 segments `[ 📍 Ma position | ⛰️ Étape du jour ]` au lieu d’un bouton isolé, avec état de chargement spinner intégré.
10. **[P1] Badge de fraîcheur et source dans l’en-tête** : pilule discrète `MET Norway · À jour (< 5 min)` ou `Donnée ancienne` (fond `--warn-bg`), cliquable pour forcer l’actualisation.
11. **[P1] Sous-drawer détail d’un jour (`SheetDetail` avec swipe entre jours)** : activer `pages` + `onIndexChange` de `SheetDetail` pour glisser horizontalement de J+1 à J+10 avec compteur `2 / 10` dans la barre de titre.
12. **[P1] Courbe SVG température & pluie dans le sous-drawer jour** : sparkline fluide des 24 heures du jour sélectionné au lieu d’une simple liste `<ul>` de texte brut.
13. **[P1] Bandeau « Hors horizon (> 10 jours) » honnête** : quand l’utilisateur sélectionne un jour lointain (ex. J25 d’un trek de 30 j), afficher une carte explicative `--info` distinguant prévision et climatologie (`classifyWeatherHorizon`).
14. **[P1] Prévision multi-points le long du tracé (`sampleRouteWeatherPoints`)** : mini-comparateur Départ / Sommet / Arrivée pour voir l’écart thermique en altitude.
15. **[P2] Indicateurs Lever / Coucher du soleil & durée du jour** : carte arc solaire minimaliste essentielle en randonnée / bivouac.
16. **[P2] Skeleton de chargement Liquid Glass** : remplacer le texte brut `Recherche des prévisions…` par des blocs shimmer calibrés à la hauteur exacte du hero et des tuiles.

---

## 2. Drawer **Budget** (16 améliorations)

1. **[P0] Hero budgétaire épinglé dans `staticSlot`** : grand chiffre dépensé (tabulaire 32px), enveloppe totale à côté, **barre de progression horizontale** verte (`--good`) → ambre (`--warn` > 85 %) → rouge (`--bad` > 100 %) et pilule de reste disponible.
2. **[P0] Mini-capsule à 3 onglets glissables** : `Dépenses` · `Catégories` · `Partage & Soldes`.
3. **[P0] Bouton primaire collé dans `footer`** : CTA plein `--tint` `+ Ajouter une dépense` accessible au pouce en permanence, ouvrant un **sous-drawer formulaire propre** (au lieu d’un formulaire inline écrasé dans le scroll).
4. **[P0] Sous-drawer d’ajout de dépense style `CarnetCreateSheet`** : gros champ montant numérique centré (36px, clavier `decimal`), grille de **chips catégories avec icônes** (Hébergement, Nourriture, Transport, Activité, Matériel, Autre) au lieu d’un `<select>` natif moche, sélecteur de payeur avec avatars `IdentityPill`.
5. **[P0] Switch visuel « Dépense réelle » vs « Prévisionnelle »** : contrôle segmenté clair permettant de filtrer ou saisir sans jamais confondre prévu et payé.
6. **[P0] Lignes de dépenses enrichies (style liste iOS / Communauté)** : pastille icône colorée par catégorie à gauche, titre + sous-titre (`Payé par Léa · J1 · Réel`), montant aligné à droite en gras tabulaire + chevron.
7. **[P0] Badge « Hors ligne · En attente »** sur les dépenses créées en zone blanche (pilule `--warn-bg` + icône nuage barré) au lieu du suffixe texte `(hors ligne)` dans le titre.
8. **[P0] Onglet `Catégories` avec barres proportionnelles** : chaque catégorie affiche icône + nom + compteur (`3 dépenses`) + montant + barre de pourcentage relative au total dépensé.
9. **[P0] Carte « Projection fin de voyage » lisible en un coup d’œil** : 3 mini-KPI côte à côte (`Rythme/jour`, `Projection fin`, `Marge / Dépassement` colorée `--good`/`--bad`) au lieu d’une phrase longue en `<p className={styles.meta}>`.
10. **[P0] Onglet `Partage & Soldes` avec `IdentityPill` + remboursements simplifiés (`computeExactSettlements`)** : cartes « Qui doit à qui » avec flèche `Camille → Léa · 14,50 €` et bouton `Marquer réglé`.
11. **[P1] Filtre rapide par jour / tout le voyage + `SortMenuButton`** : basculer entre `Jour J1` et `Tout le voyage` + tri par date ou montant (réutilisation directe de `SortMenuButton` de Communauté).
12. **[P1] Sous-drawer détail d’une dépense complet** : montant hero, carte métadonnées (catégorie, date, payeur avec avatar, statut réel/prévu), répartition exacte par participant, et boutons `Modifier` / `Supprimer` (avec confirmation `island`).
13. **[P1] Séparation claire multi-devises** : si le voyage contient plusieurs devises (EUR + CHF), afficher des cartes distinctes par devise sans jamais les additionner faussement.
14. **[P1] Lien vers l’étape ou la réservation associée** : si une dépense est liée à un refuge/billet, afficher une puce cliquable ouvrant le détail dans Paperasse ou Étapes.
15. **[P2] Photo de reçu / justificatif** : aperçu vignette cliquable dans le détail de dépense (même visionneuse média que Carnet).
16. **[P2] Action d’export CSV / résumé partageable** : bouton secondaire dans l’onglet Partage pour copier le récapitulatif des soldes dans le presse-papiers.

---

## 3. Drawer **Carte** (16 améliorations)

1. **[P0] Carte plein cadre (`52dvh`) aux coins concentriques** : maximiser la surface utile de la carte Leaflet en tête du tiroir avec boutons flottants Liquid Glass (centrer sur trace, ma position GPS, couches, plein écran).
2. **[P0] Mini-capsule sous la carte à 3 onglets** : `Itinéraire` · `Points utiles (POI)` · `Signalements`.
3. **[P0] Profil de dénivelé SVG interactif haute finition (`ElevationStrip`)** : grille d’altitude discrète, remplissage dégradé vert `--accent`, curseur vertical au toucher qui met en surbrillance le point sur la carte + altitude/km exacts.
4. **[P0] Bandeau stats parcours compact (3 KPI)** : `Distance (km)` · `Dénivelé (+m)` · `Temps estimé` épinglés juste sous la carte en chiffres tabulaires.
5. **[P0] Onglet `Points utiles (POI)` branché sur `corridorPoiActions.ts` (`geo_pois`)** : filtres chips avec icônes `[ 💧 Eau | 🏠 Abris | ⛺ Bivouac ]`, liste triée par proximité avec altitude, statut potable/inconnu et bandeau discret obligatoire *« Source OSM — vérifier sur place »*.
6. **[P0] Onglet `Signalements` avec liste active + bouton `+ Signaler`** : afficher les signalements terrain réels (`hub_field_reports`), leur catégorie en pastille colorée, âge (`il y a 2 h`), compteur de confirmations et bouton tactile `👍 Confirmer (2)` branché sur `confirmHubFieldReport`.
7. **[P0] Sous-drawer de création de signalement (remplacer le form inline)** : grille visuelle de 8 tuiles icônes (Source tarie, Eau OK, Sentier fermé, Danger, Abri fermé, Neige/glace, Boue, Autre) + champ court + coordonnées pré-remplies + CTA plein en `footer`.
8. **[P0] Carte Pack hors-ligne visuelle et rassurante** : remplacer le bandeau texte par une carte dédiée avec jauge de stockage (`18 Ko`), date de mise à jour, liste de ce qui est inclus (`Trace + 7 étapes`), bouton primaire `Télécharger` ou destructif `Supprimer la copie`.
9. **[P0] Carte « Proposition de parcours organisateur » (révision club) mise en valeur** : bandeau `--warn-bg` quand une décision est en attente (`Révision R2 proposée · Adopter / Garder R1`), ouvrant directement la comparaison.
10. **[P1] Contrôle de guidage sur trace (`evaluateTrackGuidance`)** : bandeau live discret quand le GPS est actif indiquant `Sur la trace · 30 % · 7,0 km restants` ou alerte ambre `Hors trace (+85 m)`.
11. **[P1] Popover « Couches de la carte » (style affichage Carnet)** : interrupteurs propres pour afficher/masquer Étapes, Eau/Abris, Signalements, Positions du groupe.
12. **[P1] Marqueurs numérotés et colorés par statut d’étape** : vert `--good` pour terminée, accent `--tint` pulsant pour en cours, neutre pour prévue — harmonisés entre carte et liste Étapes.
13. **[P1] Synchronisation bidirectionnelle clic repère ↔ sous-drawer étape** : tapoter un repère ouvre le `SheetDetail` unifié de l’étape avec retour exact sur la carte au même niveau de zoom.
14. **[P1] Gestion élégante de l’indisponibilité tuiles (mode avion)** : overlay translucide non bloquant en coin supérieur (« Mode hors ligne · tracé local actif ») laissant la trace vectorielle et les repères 100 % lisibles.
15. **[P2] Sélecteur de jour en pilules flottantes sur le bord bas de la carte** : changer de J1 à J4 directement sans quitter le tiroir Carte.
16. **[P2] Bouton « Ouvrir dans Plans / Google Maps »** sur la fiche d’un point de départ (parking / gare) pour la navigation routière d’approche.

---

## 4. Drawer **Étapes** (16 améliorations)

1. **[P0] En-tête `staticSlot` avec rail de jours `J1..J4` + barre de progression** : sélecteur de jour animé + barre fine `1 / 3 étapes terminées` + badge d’état du voyage (`En cours` vert, `Planifié`, `En pause`).
2. **[P0] Vraie timeline verticale connectée (style Carnet)** : ligne verticale fine reliant les nœuds d’étapes avec pastilles d’état (`✓` vert terminée, point pulsant en cours, cercle vide prévue, barrée annulée) et horaire prévu aligné à gauche.
3. **[P0] Comparaison côte à côte Prévu vs Réel sur chaque carte d’étape** : `Prévu 08:15` en gris `--label2` + `Réel 08:20 (+5 min)` en badge coloré (`--good` à l’heure, `--warn` retard), distance et D+ en méta compacte.
4. **[P0] Pilotage du cycle de vie voyage (`TripLifecycleBar`) intégré proprement** : bouton d’état discret en haut ou dans le `footer` (ex. `Démarrer le voyage`, `Mettre en pause`, `Clôturer`) avec confirmation par `island` avant clôture, au lieu de 3 chips bruts qui mangent le haut du tiroir.
5. **[P0] Sous-drawer d’étape (`StepExecutionDetails`) repensé en 3 blocs clairs** :
   - **Bloc 1 (Hero)** : Titre, jour/lieu, badge statut large, chips distance & D+, ETA dynamique (`etaEngine.ts`).
   - **Bloc 2 (Chronologie réelle)** : carte structurée Départ réel / Arrivée réelle / Fin réelle avec icônes horloge.
   - **Bloc 3 (Actions terrain)** : bouton primaire plein en `footer` pour l’action suivante logique (`Démarrer` → `Marquer atteinte` → `Terminer`), et actions secondaires (`Reporter`, `Ignorer`, `Annuler`) dans un menu/rangée secondaire plus discret !
6. **[P0] Encart « Note interne éditeurs » visuellement distingué** : carte fond `--warn-bg` / bordure discrète avec icône cadenas 🔒 et mention `Visible uniquement par les éditeurs` (zéro ambiguïté de confidentialité).
7. **[P0] Indicateur de synchronisation hors-ligne sur la carte étape** : pastille `En attente de synchro` avec icône nuage, et résolution de conflit de version/plan en bannière claire avec bouton `Actualiser le suivi`.
8. **[P0] Section « Étapes retirées du plan » en accordéon propre** : section repliable en bas de journée avec badge compteur (`1 archivée`), icône archive et style atténué pour ne pas polluer les étapes actives.
9. **[P1] Swipe horizontal dans `SheetDetail` entre étapes du jour** : glisser de l’étape 1/3 à 2/3 puis 3/3 avec indicateur `2 / 3` en haut à droite.
10. **[P1] Action rapide « Décaler les prochaines étapes » (`shiftUpcomingSteps`)** : bouton `+15 min / +30 min` en cas de retard accumulé, avec aperçu avant validation et bouton `Annuler` dans l’`island`.
11. **[P1] Mini-capsule `Jour actif` · `Tout le voyage`** : permettre de voir d’un coup d’œil la vue condensée des 4 jours (ou 30 jours) groupés par en-tête `Jour 1 — sam. 21 nov.`.
12. **[P1] Pastilles logistiques par étape** : afficher des micro-badges icônes quand l’étape a un hébergement, un transport, un point d’eau ou une réservation liée (cliquable vers Paperasse).
13. **[P1] Badge lecture seule propre pour les participants confirmés** : reprendre la pilule `guestNotice` / lecture seule de Communauté (« Consultation seule · suivi piloté par les éditeurs »).
14. **[P1] Affichage des pauses non sportives & temps de pause** : bloc dédié pause repas / bivouac distinct du temps de marche actif.
15. **[P2] Bouton « Voir sur la carte » dans le sous-drawer étape** : bascule directe sur le tiroir Carte centré sur le marqueur de l’étape.
16. **[P2] Animation fluide d’accomplissement** : retour haptique léger (`useHapticFeedback`) + transition de la coche verte quand une étape passe à `Terminée` (respectant `prefers-reduced-motion`).

---

## 5. Drawer **Carnet** (16 améliorations)

1. **[P0] Alignement visuel 100 % sur `Carnet V2`** : adopter les vraies cartes moments de `carnet-v2.css` (miniature photo carrée arrondie à gauche, heure en badge `--mint`, titre/légende 2 lignes, lieu avec épingle, icône audio/vidéo si présent).
2. **[P0] CTA principal collé dans `footer`** : barre d’action rapide 1 geste avec bouton plein `--tint` `📷 Photo / Moment` + bouton rapide `🎙️ Note vocale` + `✍️ Note texte` pour raccourcir la capture terrain.
3. **[P0] Mini-capsule à 3 onglets** : `Moments du jour` · `Notes du voyage` · `Récit & Export`.
4. **[P0] Carte Brouillon hors-ligne mise en valeur** : quand un brouillon existe dans `CarnetDraftStore`, l’afficher comme une vraie carte carte-brouillon ambre (`--warn-bg`) avec horodatage, texte et 2 boutons clairs `Publier dans le carnet` / `Supprimer`.
5. **[P0] Formulaire hors-ligne toujours accessible en 1 geste** : ne pas afficher un `<textarea>` brut en vrac dans la liste, mais ouvrir le même sous-drawer `Ajouter un moment` qui bascule automatiquement en sauvegarde brouillon locale si `!isOnline`.
6. **[P0] Frise horaire visuelle (mini-timeline) en tête d’onglet** : pastilles des heures ayant des moments (`08h · 1`, `11h · 1`) cliquables pour filtrer instantanément.
7. **[P0] Pré-remplissage visible des faits réels en badges (P07-29)** : dans le sous-drawer de création, afficher les faits auto-détectés en chips éditables (`📅 J1 · 11:10`, `📍 Lacs des Chéserys`, `☀️ 12°C`, `👥 5 membres`).
8. **[P0] Onglet `Récit & Export` branché sur `storySummary.ts`** : aperçu propre du récit généré automatiquement (étapes réalisées + moments publiables, sans jamais exposer les notes éditeur), avec bouton `Copier le récit` et `Ouvrir le carnet complet`.
9. **[P0] Sous-drawer détail d’un moment (`SheetDetail` swipable)** : photo plein cadre bord à bord arrondi, légende typographique soignée, lecteur audio stylé Liquid Glass, méta lieu/heure/auteur (`IdentityPill`) et swipe entre moments du jour.
10. **[P1] Contrôle de visibilité explicite par moment (P07-32)** : badge clair sur chaque moment (`Privé brouillon` / `Groupe du voyage` / `Carnet public`) avec sélecteur segmenté.
11. **[P1] État « Carnet non créé » accueillant** : carte illustrée avec bénéfices en 1 ligne et CTA primaire plein `Créer le carnet privé du voyage` en `footer`.
12. **[P1] Grille galerie photo 3 colonnes** : bascule `Liste / Galerie` dans l’en-tête pour feuilleter rapidement toutes les photos du voyage comme dans l’onglet Médias de Carnet.
13. **[P1] Regroupement par jour dans l’onglet Notes** : cartes notes avec titre gras, extrait lisible et badge `J1` / `Général`.
14. **[P1] Indicateur d’upload photo privé avec barre de progression** : progression visuelle + bouton `Annuler` pendant l’envoi vers le bucket privé.
15. **[P2] Lien vers l’équipement mentionné** : afficher en chips les éléments de `carnetKitItems` tagués sur un moment.
16. **[P2] Mode lecture plein écran sans distraction** : bouton d’agrandissement sur les photos/vidéos avec geste pincer-zoomer.

---

## 6. Drawer **Kits** (16 améliorations)

1. **[P0] En-tête `staticSlot` avec 3 cartes KPI Poids + Progression** : `Poids total (4,65 kg)` · `Préparés (7 / 10)` avec barre de progression · alerte rouge/ambre `2 vitaux à préparer` si `vitalUnpackedCount > 0`.
2. **[P0] Mini-capsule à 3 onglets** : `À préparer` · `Poids & Conso` · `Partagé & 3D`.
3. **[P0] Vraies cases à cocher tactiles (44×44px) style iOS/LKDV** : remplacer le `<input type="checkbox">` natif minuscule à droite par une pastille ronde animée `--tint` avec coche blanche à gauche de la ligne, toute la ligne étant cliquable !
4. **[P0] Groupement visuel par priorité / catégorie** : section `Vitaux` en tête (bordure/badge `--bad` si non préparé), puis `Équipement de base`, `Porté sur soi`, `Consommables` — fini la liste `<ul>` plate sans structure.
5. **[P0] Badges visuels sémantiques sur chaque item** : remplacer la chaîne de texte `· Préparé · 1,18 kg · Partagé · Vital` par des micro-badges propres (`Vital` rouge doux, `Partagé` vert doux, `1,18 kg` tabulaire à droite).
6. **[P0] Barre empilée visuelle de répartition du poids (onglet `Poids & Conso`)** : barre horizontale 3 couleurs (`Base` vert foncé, `Porté` sauge, `Consommables` bleu eau) avec légende chiffrée en kg et %.
7. **[P0] Carte Autonomie Eau, Nourriture & Énergie branchée sur `consumablesTracker.ts`** : 3 tuiles claires (`💧 Eau : 40 L sur 4 j / 5 pers.`, `🍽️ Repas : 60`, `🔋 Batterie : ~21 h GPS`) avec adaptation automatique si alerte chaleur météo.
8. **[P0] Onglet `Partagé & 3D` : attribution claire des objets partagés** : afficher chaque objet partagé (`Tente 2 places`, `Réchaud`, `Trousse secours`) avec l’avatar `IdentityPill` de son porteur (`Porté par Hugo`) et bouton `Réattribuer` (connecté à `assign_trip_shared_item`).
9. **[P0] Scène 3D (`HubKitPreview`) dans un conteneur propre et repliable** : ne plus bloquer le haut du tiroir avec un grand cadre vide quand aucun kit 3D n’est configuré ; placer la scène 3D dans l’onglet dédié avec état vide élégant + lien `Configurer dans Kit Studio`.
10. **[P1] Filtres rapides chips dans `À préparer`** : `[ Tous | Restants (3) | Vitaux | Partagés ]` pour cocher son sac en 30 secondes la veille du départ.
11. **[P1] Indicateur d’état d’usure (`evaluateGearMaintenance`)** : badge discret `À vérifier` (`--warn-bg`) sur les objets marqués `use` ou `a_remplacer` (ex. la frontale usée de Léa) et tag `Prêté` / `Loué`.
12. **[P1] Barre d’action `footer` collante** : CTA `Gérer dans Kit Voyage` ou `+ Ajouter un objet` + compteur dynamique `Reste 3 objets`.
13. **[P1] Feedback haptique + barré doux sur les items préparés** : quand on coche un article, opacité douce `0.62`, titre légèrement atténué, mise à jour instantanée du poids préparé et toast `island` si mode hors-ligne.
14. **[P1] Sous-drawer détail d’un objet du kit** : poids unitaire × quantité, catégorie, état d’usure, propriétaire/porteur, notes et bascule préparé/partagé.
15. **[P1] État lecture seule soigné pour les participants confirmés** : carte explicative propre au lieu d’un bloc texte sec, tout en montrant les objets partagés assignés au groupe.
16. **[P2] Option « Réinitialiser les coches » (avec confirmation `island`)** : pratique pour réutiliser un kit sur une nouvelle sortie.

---

## 7. Drawer **Paperasse** (16 améliorations)

1. **[P0] Carte « Prochain document / billet » épinglée dans `staticSlot` (style Apple Wallet)** : mettre immédiatement en avant le prochain billet ou la réservation du jour (`Refuge du Lac Blanc · Dossier #LB-8842 · Aujourd’hui`) avec bouton rapide `Copier n° dossier`.
2. **[P0] Mini-capsule à 3 onglets** : `Portefeuille` · `À réserver` · `Urgences & Règles`.
3. **[P0] Bouton primaire collé dans `footer`** : `+ Ajouter une confirmation / billet` plein `--tint` ouvrant un **sous-drawer formulaire propre** (au lieu d’un formulaire HTML brut inline).
4. **[P0] Badges d’expiration colorés sémantiques (`evaluateDocumentExpiry`)** :
   - Expiré → pilule `--bad-bg` / `--bad` (`Expiré · 18 mois`)
   - Aujourd’hui / ≤ 30 j → pilule `--warn-bg` / `--warn` (`Expire dans 3 j`)
   - Valide → pilule `--mint` / `--good` (`Valide · 2027`)
5. **[P0] Cartes documents typées par icône** : pastille icône distincte pour Passeport/CNI (`id-card`), Assurance (`shield`), Billet transport (`ticket`), Réservation hébergement (`bed`), Médical (`heart-pulse`).
6. **[P0] Badge de confidentialité par titulaire (`canViewDocumentByHolder`)** : icône cadenas 🔒 `Personnel · Titulaire uniquement` sur passeport/médical vs `Partagé éditeurs` sur réservations refuge.
7. **[P0] Onglet `À réserver` avec statuts visuels clairs** : séparer `À réserver`, `En attente` et `À vérifier` (étapes hébergement/transport sans réservation enregistrée) avec bouton `Marquer réservé` ou lien direct vers l’étape.
8. **[P0] Sous-drawer détail document style passe d’embarquement** : grande carte blanche/verre avec intitulé, numéro de dossier en police monospace copiable en 1 tap, date d’échéance, badge santé, et bouton `Enregistrer hors ligne`.
9. **[P1] Badge « Disponible hors ligne » sur les billets essentiels** : indicateur vert confirmant que les références et numéros de dossier restent lisibles en mode avion au refuge ou à la gare.
10. **[P1] Onglet `Urgences & Règles` branché sur `buildDestinationSafetyBrief`** : carte numéros d’urgence locaux (`112`, `1414 REGA` en Suisse, `911` US/CA) avec boutons `tel:` directs + rappel réglementaire bivouac/parcs nationaux.
11. **[P1] Lien bidirectionnel Réservation ↔ Étape ↔ Budget** : dans le détail d’une réservation, afficher deux puces directes `Voir l’étape J1` et `Voir la dépense 195 €`.
12. **[P1] Alerte groupée en tête si ≥ 1 document expiré** : bannière compacte `--bad-bg` *« 1 document expiré (Carte d’identité) — à vérifier avant le départ »* cliquable pour ouvrir le document concerné.
13. **[P1] Historique des changements de réservation (`diffReservationChange`)** : afficher une micro-ligne discrète quand une date ou un statut de réservation a changé.
14. **[P1] Champ date & sélecteur type stylés Liquid Glass** dans `PaperasseQuickAdd` (chips visuels `[ Réservation | Billet | Assurance | Identité ]` au lieu du `<select>` brut).
15. **[P2] Aperçu PDF / image intégré** : quand un vrai fichier justificatif est attaché, bouton `Voir le justificatif` dans la visionneuse plein écran.
16. **[P2] Action « Partager le n° de réservation au groupe »** : copier un résumé propre (sans document personnel) pour l’envoyer aux compagnons.

---

## 8. Drawer **Groupe** (16 améliorations)

1. **[P0] En-tête `staticSlot` avec résumé collectif + compteur** : `5 membres actifs` (avatar stack chevauché de 4 avatars max + `+1`), nombre d’invitations en attente si > 0, et badge statut partage de position (`Partage actif` vert ou `Position masquée`).
2. **[P0] Mini-capsule à 3 onglets** : `Membres` · `Positions` · `Sécurité`.
3. **[P0] Cartes membres enrichies autour de `IdentityPill`** : avatar, nom complet, badge rôle coloré (`Responsable` en `--tint`, `Collaborateur` en `--accent`, `Participant` en `--fill`), pastille de présence (`Confirmé ✓`), et chevron vers la fiche participant.
4. **[P0] Pagination fluide en blocs glissants de 3 (pour 4 à 50+ membres)** : remplacer les 2 chips texte `Précédents` / `Suivants` par une **barre de pagination tactile élégante** (points/indicateur `1 / 17` + boutons flèches 44px + support du glisser horizontal `LensPager`).
5. **[P0] Onglet `Positions` dédié à la progression relative sur le tracé (`compareMemberProgress`)** : schéma vertical simple de la trace montrant qui est `devant (+1,4 km)`, `au même niveau` ou `derrière`, avec heure du dernier relevé (`il y a 4 min`), niveau de batterie (`🔋 84 %`) et badge ambre si donnée > 15 min (`Donnée ancienne`).
6. **[P0] Interrupteur Switch iOS pour « Partager ma position au groupe »** : remplacer le bouton chip texte par un vrai **toggle switch Liquid Glass** dans une carte explicative précisant la durée (TTL 4h) et la révocation immédiate.
7. **[P0] Onglet `Sécurité` structuré en 3 cartes claires (sans mélange avec la liste des membres)** :
   - **Carte 1 (Urgence officielle)** : bouton rouge `--bad` plein largeur `📞 Appeler les secours officiels · 112` avec mention honnête *« Seuls les secours officiels assurent la prise en charge d’urgence »*.
   - **Carte 2 (Mes contacts privés)** : liste des contacts enregistrés dans `trip_safety_contacts` (`Claire Fontaine · Téléphone`, cadenas 🔒 *Visible uniquement par toi*) + bouton `+ Ajouter un contact`.
   - **Carte 3 (Lien `/hub/securite`)** : accès aux checkpoints et paramètres avancés.
8. **[P0] Sous-drawer d’ajout de contact d’urgence stylé** : champs propres nom, chips canal `[ Téléphone | SMS | E-mail ]`, numéro/email et case de consentement explicite + CTA plein en `footer`.
9. **[P0] Fiche participant (`SheetDetail`) vraiment utile (P07-49)** : grand avatar `IdentityPill`, rôle + badge `Participation confirmée`, dernière progression relative si partagée (ou mention sobre « Position non partagée »), **liste des objets partagés portés** par cette personne (`Tente 2 places`), et bouton `Voir le profil`.
10. **[P1] Filtre / regroupement par sous-groupe (`summarizeSubgroups`)** : quand un grand groupe est divisé (ex. `Allure rapide` / `Allure tranquille`), afficher des pills de filtrage et les compteurs `présents / absents / en attente`.
11. **[P1] Section « Invitations en attente » dédiée** : cartes distinctes avec statut `En attente de confirmation` et bouton `Relancer` / `Gérer dans le groupe`.
12. **[P1] Bannière honnête sur les positions non comparables** : si un membre suit une autre révision de tracé ou a un GPS imprécis, afficher `Position non comparable` sans jamais inventer un classement erroné.
13. **[P1] Action rapide « Inviter un participant » collée dans `footer`** de l’onglet `Membres` (pour les éditeurs).
14. **[P1] Bloc « Décisions du groupe » (`resolveCollectiveDecision`)** : carte de sondage rapide (ex. choix de variante ou horaire départ) affichant les votes et le gagnant / égalité.
15. **[P2] Recherche rapide de membre au-delà de 9 participants** : champ de filtre compact dans `staticSlot` pour retrouver instantanément un randonneur dans un groupe de 50.
16. **[P2] Bouton `Copier ma position GPS`** dans l’onglet Sécurité : copie `45.9806° N, 6.8919° E · Alt. 2352 m` en 1 tap pour la dicter au 112/PGHM.

---

## Synthèse & Plan d’exécution recommandé

| Périmètre | Nb améliorations | Impact visuel immédiat |
| --- | :---: | --- |
| **Socle transverse (`CommunitySheetShell` + Liquid Glass)** | **12** | Transforme d’un coup les 8 drawers (onglets, headers, CTA collants, inputs, badges, toasts) |
| **Météo** | **16** | Hero météo + frise 24h + tuiles 2×2 + cartes MeteoAlarm/NASA |
| **Budget** | **16** | Jauge budget + sous-drawer saisie montant + catégories + soldes |
| **Carte** | **16** | Carte 52dvh + onglets POI/Signalements + profil interactif + pack |
| **Étapes** | **16** | Timeline connectée + prévu/réel + CTA suivant + note cadenas |
| **Carnet** | **16** | Cartes Carnet V2 + barre capture 1 geste + récit + brouillon ambre |
| **Kits** | **16** | KPI poids + vraies coches rondes + barre poids + autonomie + porteurs |
| **Paperasse** | **16** | Carte Wallet prochain billet + badges expiration + onglet Urgences |
| **Groupe** | **16** | Onglets Membres/Positions/Sécurité + switch live + carte 112 + fiche riche |
| **TOTAL** | **140** | **Refonte complète alignée 100 % sur Communauté & Carnet** |
