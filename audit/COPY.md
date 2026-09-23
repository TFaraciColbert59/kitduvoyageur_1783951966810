# Charte de Micro-Copie & Épuration du Jargon — LKDV iOS 27

Pour un lancement grand public digne des standards Apple, l'interface ne doit laisser transparaître **aucun terme technique interne, aucun statut de sprint, ni jargon d'ingénierie**.

---

## 1. Table de Remplacement du Jargon Interne

| Terme / Jargon repéré | Écran(s) concerné(s) | Terme Grand Public iOS 27 | Justification HIG |
|:----------------------|:---------------------|:--------------------------|:------------------|
| `PHASE 3/5`, `PHASE 5` | `/rapport-expedition`, `/fidelite` | *Supprimé* ou remplacé par l'étape concrète (ex: `Bilan final`, `Niveau Élite`) | L'utilisateur n'a pas à voir la roadmap de développement du produit. |
| `TIER 1 / TIER 2` | `/abonnements`, `/fidelite` | `Essentiel`, `Aventurier`, `Expédition` | Clarté et poésie outdoor plutôt que langage corporate SaaS. |
| `Données réelles` | `/preparer-sentier/[id]`, `/explorer` | `Données terrain vérifiées` | Plus rassurant, évite de sous-entendre que le reste est "faux". |
| `Secours démo` | `/securite`, `/hub/securite` | `Simulation d'urgence` | Évite toute confusion dramatique en montagne. |
| `Fixtures locales` | `/preparer-sentier/apercu` | `Aperçu démonstration` | Terminologie de test logiciel bannie de l'UI finale. |
| `Moyenne bayésienne` | `/lieux/[slug]` | `Score de fiabilité LKDV` | L'algorithme mathématique ne doit pas être exposé en brut. |
| `BigBuy` | `/produit/[slug]` | `Partenaire Certifié LKDV` | Nom de grossiste dropshipping à masquer impérativement. |
| `Paypal` | `/checkout`, `/recompenses` | `PayPal` | Respect strict de la casse officielle de la marque. |
| `document(s)`, `membre(s)` | `/hub/documents`, `/clubs` | Formats pluriels stricts via ICU (`1 document`, `3 documents`) | Règle de grammaire et typographie française élégante. |
| `0 pts` avec message d'erreur | `/recompenses` | Afficher uniquement l'état d'erreur avec bouton de reconnexion | Évite d'induire en erreur l'utilisateur avec un faux solde nul. |

---

## 2. Règles Typographiques Françaises (Intl fr-FR)

1. **Monnaie** : Espace insécable fine avant le symbole `€` : `55,00 €` (et non `55.00€` ou `55.00 €`).
2. **Pourcentages** : Espace insécable avant `%` : `100 %` (et non `100%`).
3. **Ponctuation double** : Espace insécable avant `:`, `;`, `?`, `!` : `Poids total : 3,2 kg`.
4. **Abréviations calendaires** : Formats normalisés selon Intl : `19 juil. 2026` (et non `19/07/26` ou `Jul 19`).
5. **Chiffres et métriques** : Utilisation systématique de la virgule décimale (`3,3 L`, `12,4 km`) et de la police avec chiffres tabulaires (`font-variant-numeric: tabular-nums`).
