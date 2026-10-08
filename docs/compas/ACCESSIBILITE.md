# Compas — audit d'accessibilité (2026-10-06)

Référentiel : **WCAG 2.2 niveau AA** (exigé pour les services numériques grand public dans l'UE depuis le 28 juin 2025, European Accessibility Act).

## Méthode
- **axe-core 4** (`@axe-core/playwright`), règles `wcag2a/2aa/21a/21aa/22aa` + `best-practice`, sur 7 écrans réels connectés au compte démo, Chromium 390×844 : Où, Nous, Résa, Verdict, Kit, Compas vide (`?nouvelle=1`), `/connexion`.
- **Contraste mesuré au pixel** là où axe ne peut pas conclure (texte posé sur du verre et une carte) : texte rendu transparent, capture du fond réel derrière lui, ratio WCAG calculé pour chaque pixel ; on retient le 10ᵉ centile (seuils 4,5:1, 3:1 pour le grand texte).
- **Clavier** : 45 tabulations depuis le haut de page — nom accessible, focus visible, ordre.
- **Mouvement réduit** : `prefers-reduced-motion` coupe animations et transitions du Compas.

## Constat initial (production, 2026-10-06)
| Point | Constat |
|---|---|
| Contraste | 47 textes sous le seuil sur le verre (ratio 1,8 à 4,4) : verre à 19 % sur une carte sombre, gris secondaire `ink-500`, graduations et mentions à 50 % d'opacité |
| Bannière cookies | texte forcé en blanc sur la surface claire (ratio ≈ 2) |
| ARIA | `aria-label` sur des `div` sans rôle (rail des points d'intérêt, axes de risque) |
| `/connexion` | identifiants `email` / `password` en double (formulaire rendu en vue ordinateur et en vue mobile) |
| Cible tactile | poignée de la carte 64×22 px |
| Clavier | un arrêt vide après chaque onglet de la barre (icône rendue focalisable par `whileTap` de framer-motion) ; deux liens « Aller au contenu principal » |
| Lecteur d'écran | pas de titre `h1` sur le Compas ; carte annoncée « Map » |

## Corrections
- Verre par défaut **60 %** (réglage ☀ inchangé : 5 à 70 %, au choix de chacun), encres secondaire `ink-700` et tertiaire 78 %. Mode plein soleil : encre secondaire `ink-900`.
- Bannière cookies sur l'encre de la palette (`--lkv-ink-900`) avec `--lkv-on-dark` / `--lkv-on-dark-muted`.
- `role="group"` sur les groupes nommés ; `useId()` pour les champs de connexion.
- Poignée de carte 88×44 px.
- Icône des onglets hors tabulation (`tabIndex={-1}`, `aria-hidden`) ; un seul lien d'évitement (layout racine).
- `h1` du Compas (« Compas · nom de l'aventure », visible des lecteurs d'écran), « Nouvelle aventure » en `h1` ; canevas de carte nommé « Carte ».

## Résultat (local, même compte, mêmes écrans)
- axe WCAG 2.2 AA : **0 violation** sur les 7 écrans ; best-practice : 0 après le `h1`.
- Contraste au pixel : **0 texte sous le seuil** (47 avant).
- Clavier : lien d'évitement → 5 onglets → 5 étapes → contenu, sans arrêt vide ; focus visible partout.

## Limites
- Audit automatisé + clavier ; pas encore de passage avec VoiceOver / TalkBack sur appareil réel.
- Un voyageur qui baisse lui-même l'intensité du verre sous 60 % peut repasser sous le seuil sur une carte sombre (personnalisation volontaire).
