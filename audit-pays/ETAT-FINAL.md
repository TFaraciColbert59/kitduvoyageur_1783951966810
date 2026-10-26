# État final — fiche pays (26/10/2026)

## En production

| | |
|---|---|
| URL | https://kitduvoyageur.faracitonyp.workers.dev/pays/fr |
| Version | `bec7e8aa-4298-4237-82ed-939c71a5c700` (100 %) |
| `design:fidelity` | **17/17 · 17/17 · 17/17** (430 / 768 / 1440), revérifié à 90 s |
| Tests | 73/73 (pays) · 202/202 (pays + discovery + formatage) |

## Livré

**Coquille** : écran verrouillé 932, carte 406×541,1, mapzone 334,9, barre 402×48 — inchangés, porte verte.

**Contenu**
- Cartes unifiées : photo (vedette 16/9 puis 16/10) avec badges + légende ; sections sans photo en **cartes compactes** (icône, titre, valeur, tag).
- Aucune bordure entre contenu et cartes.
- Recherche locale + chips de catégorie (libellé court, état actif tint, fermeture au choix).
- États : vide spécifique par section avec action réelle, « aucun résultat » avec effacement, **image cassée → placeholder typographique**, **squelettes** aux dimensions des cartes (communauté).
- Formatage : insécables, `tabular-nums`, distances/dénivelés, plages de dates, dates relatives, **pluriels**.
- Sources dédupliquées par URL + domaine + `rel="noopener"`.
- Accessibilité : `alt` descriptifs, `aria-label` des cartes, `aria-live` du compteur.

**Carte** : déplaçable au doigt, zoom +/−/recentrage, échelle 3 positions, attribution au-dessus de la barre, état « Glissez pour déplacer ».

**Sélecteur** : pilule en bas à droite, menu 2 colonnes, fermeture au clic extérieur et à Échap, masqué quand un volet est ouvert.

**Drawer** : 406 × 708,3, poignée, nav 5 lentilles (comme le profil, sans bouton fermer), titre + sous-titre dans le contenu, groupes à compteurs, carte de synthèse, boutons `primary`/`ghost`, volets Fiche · Pratique · Sources · Détails · Partager.

## Reste — décisions nécessaires

1. **Carnet refondu absent de Cloudflare** : la branche `cloudflare/vinext` porte une **autre implémentation** du carnet (`CarnetCardDrawer`, `CarnetMomentGrid`, `CarnetSubCapsule`, `panes/`). Porter la version de `chantier/pays-refonte` écraserait cette évolution. Il faut trancher : merger les deux, ou refondre la version vinext.
2. **Hub `/carnets`** : encore legacy (17 px, deux barres). Même question de branche.
3. **Prod** : ne jamais lancer deux `vinext-cloudflare deploy` en parallèle — trois déploiements concurrents ont déjà écrasé la bonne version (`3c0cc05c` observé après `58094d41`). Vérifier après déploiement : l'API doit renvoyer la version affichée par la CLI.
