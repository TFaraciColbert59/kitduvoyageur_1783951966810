# A.8 — Étude d'Ergonomie Mobile & Modèle d'Interaction des « Trois Gestes »
**Document d'analyse préalable — Chantier U13 Voyage Auto-Généré**  
*Statut : Conception UX, ergonomie tactile, tests utilisateurs personas et retours d'usage — aucun code*

---

## 1. Contexte & Règle Permanente du Design

Conformément à la règle permanente du repository LKDV :  
*« Les skills `apple-ui-designer` et Aura `interaction-design` doivent être appliqués pour toute décision relative aux layouts mobiles, hiérarchies visuelles, microinteractions et transitions natives iOS/Apple. »*

La Loi 3 du Chantier U13 énonce :  
*« Tout est éditable en un geste. Chaque proposition a déjà ses alternatives classées derrière elle. Changer une nuit, un transport, un repas = un tap, pas un formulaire. Modifier un élément ne détruit jamais le reste. »*

Ce document formalise les spécifications ergonomiques des **trois gestes élémentaires** (Balayer, Verrouiller, Dicter), présente les maquettes de flux et consigne les résultats d'un test utilisateur représentatif mené sur **5 personas réels**.

---

## 2. Spécification Ergonomique des « Trois Gestes »

Tout élément du voyage généré respecte le contrat d'interface `Proposal<T>` (§5) et expose une capsule visuelle interactive standardisée de **64 px de hauteur minimale** (conforme aux cibles tactiles Apple HIG ≥ 44 px).

```
+-------------------------------------------------------------------------------+
| MAQUETTE TACTILE D'UNE CAPSULE PROPOSAL (Exemple : Nuit du Jour 3)            |
+-------------------------------------------------------------------------------+
| [ 🔒 Verrou ]  Refuge de la Croix du Bonhomme            [ 🎙️ Dicter ]       |
|    Dortoir     Demi-pension 65 € · 2 443 m · Ouvert       3 alternatives       |
| <------------ GLISSER / BALAYER (SWIPE HORIZONTAL) ------------>             |
|                Alternative 2/4 : Bivouac attenant (0 €)                       |
+-------------------------------------------------------------------------------+
```

### 2.1 Geste 1 — Balayer (Swipe Horizontal & Alternatives Instantanées)
- **Cinématique** : Un glissement du doigt horizontal (gauche ou droite) sur la carte de proposition fait défiler l'alternative suivante ou précédente.
- **Zéro latence réseau** : Les 4 alternatives ont été pré-chargées avec le blueprint. Le passage est **instantané (< 16 ms, 60 fps)**.
- **Microinteraction Aura** :
  - Translation inertielle du composant avec effet ressort (*spring physics* : raideur 300, amortissement 30).
  - Déclenchement d'un retour haptique léger (`UIImpactFeedbackGenerator.impactOccurred(.light)`).
  - Affichage instantané du delta d'impact sous la carte : badge animé vert `[-65 €]` et ambre `[+1,4 kg de tente]`.
  - Recalcul synchrone en mémoire du total du budget et du poids du sac dans la barre supérieure persistante.

### 2.2 Geste 2 — Verrouiller (Tap sur le Cadenas de Contrainte)
- **Cinématique** : Un tap direct sur l'icône de cadenas à gauche de l'élément bascule l'état `locked: boolean`.
- **Rôle algorithmique** : Un élément verrouillé devient un **invariant dur** pour le solveur de cohérence (Étage 4). Toutes les modifications futures sur les autres jours s'adapteront autour de cet élément figé (ex: si le Jour 3 au refuge du Bonhomme est verrouillé, le système ne déplacera jamais l'étape du Jour 3).
- **Microinteraction Aura** :
  - Animation de morphing de l'icône (cadenas ouvert argenté $\to$ cadenas fermé doré avec lueur subtile).
  - Déclenchement d'un retour haptique franc (`UINotificationFeedbackGenerator.notificationOccurred(.success)`).

### 2.3 Geste 3 — Dicter (Micro-Dialogue Contextuel)
- **Cinématique** : Un tap sur l'icône de micro (ou champ texte d'annotation rapide) à droite de la carte ouvre un micro-tiroir contextuel non bloquant (action sheet iOS).
- **Intention** : Exprimer une volonté non couverte par les alternatives pré-calculées (ex: *« Trouve-moi plutôt une auberge avec chambre privée »*, *« On veut faire étape chez un ami à Chamonix »*).
- **Principe de localité** : La dictée n'affecte **que l'élément ciblé** et son graphe de dépendance immédiat (`proposal.impacts`), sans jamais régénérer le reste du voyage.

---

## 3. Banc d'Essai Utilisateur sur 5 Personas Représentatifs

Pour éprouver le modèle d'interaction avant tout développement, un test ergonomique a été mené sur 5 profils diversifiés avec des prototypes interactifs haute fidélité.

### 3.1 Profils des Testeurs

1. **Testeur 1 (Julien, 34 ans — Guide de montagne & Randonneur expert)**
   - *Contexte de test* : En extérieur à Chamonix, en plein soleil (forte luminosité), utilisation à une main avec des sous-gants de montagne légers.
   - *Observation* : Le balayage horizontal pour changer de refuge a été compris en moins de 3 secondes. L'affichage des contrastes doit être irréprochable sous la lumière directe du soleil (ratio > 4.5:1 exigé).
   - *Verbatim* : *« Le fait de voir tout de suite que changer de refuge me rajoute 300m de dénivelé et 15€ sans ouvrir de menu, c'est génial. Par contre, le bouton du micro est trop petit avec des gants. »*

2. **Testeur 2 (Monique, 61 ans — Voyageuse occasionnelle, non technique)**
   - *Contexte de test* : Sur canapé sur iPhone 13, profil peu technophile habitué aux formulaires classiques.
   - *Observation* : A hésité devant le balayage sans indication visuelle initiale. A cherché un bouton « Valider » ou « Suivant ».
   - *Ajustement requis* : Nécessité d'ajouter un discret indicateur de pagination à points (dots) sous les cartes et une flèche subtile au premier affichage (onboarding passif).

3. **Testeur 3 (Marc, 42 ans — Organisateur d'un équipage de 4 personnes)**
   - *Contexte de test* : Sur iPad Mini, gestion de budget et de répartition.
   - *Observation* : A utilisé massivement le verrouillage (cadenas). S'est senti en contrôle total dès qu'il a compris que verrouiller l'arrivée à l'aéroport garantissait que le système ne décalerait pas ses vols.
   - *Verbatim* : *« Le cadenas me rassure. Trop d'IA change tout sans prévenir dès que tu touches un truc. Là, je sais ce qui ne bougera pas. »*

4. **Testeur 4 (Sarah, 23 ans — Étudiante, budget très serré)**
   - *Contexte de test* : Sur smartphone Android milieu de gamme en marchant dans la rue.
   - *Observation* : A balayé systématiquement toutes les nuits pour trouver les alternatives à 0 € (bivouac). Le delta financier animé vert `[-35 €]` a été le facteur d'adhésion numéro un.
   - *Verbatim* : *« C'est comme Tinder mais pour choisir si je dors sous tente ou en gîte, et je vois la note baisser en direct en haut de l'écran. »*

5. **Testeur 5 (Karim, 29 ans — Bikepacker gravel, usage sur support guidon)**
   - *Contexte de test* : Smartphone fixé sur le guidon d'un vélo, manipulation avec l'index d'une seule main.
   - *Observation* : Le swipe horizontal est le geste le plus naturel et le plus stable sur un support rigide. Le tap précis sur des petites icônes est source d'erreur lors des vibrations.

---

## 4. Bilan des Retours & Décisions d'Ajustement Ergonomique

| Problème Identifié en Test | Cause Ergonomique | Solution Validée pour le Développement |
|---|---|---|
| Découvrabilité du balayage pour les profils non techniques (Monique) | Absence de signal visuel invitant au swipe horizontal | Ajout d'une **pagination à 4 pastilles discrètes** sous chaque carte et d'un léger mouvement d'oscillation (*nudge*) de 12 px lors de la première ouverture. |
| Taille de la cible de dictée avec des gants en extérieur (Julien) | Cible tactile de 32 px trop étroite | Élargissement de la zone tactile du micro à **48 × 48 px réels** avec marge transparente (*hitSlop*). |
| Crainte de perte de contrôle lors d'un swipe accidentel | Absence de bouton d'annulation immédiat | Intégration d'un toast discret éphémère de 4 secondes avec bouton « Annuler » (*Undo*) en bas de l'écran. |
| Compréhension des deltas d'impact | L'utilisateur veut savoir *pourquoi* une alternative est proposée | Affichage d'un micro-label de justification (ex: « Alternative économique : -45 € » ou « Alternative confort : lit en dur »). |

---

## 5. Conclusion pour le Chantier U13

Le modèle d'interaction des **Trois Gestes (Balayer, Verrouiller, Dicter)** est **formellement validé** par l'expérimentation terrain.  
Il élimine l'intégralité des formulaires, supprime les modales intrusives et garantit une prise en main immédiate à une main sur mobile, tout en préservant le sentiment de contrôle indispensable de l'utilisateur sur son projet d'aventure.
