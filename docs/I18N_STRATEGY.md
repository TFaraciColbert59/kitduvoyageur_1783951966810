# Stratégie d'Internationalisation & Multi-Unités (LKDV)

## 1. Objectifs
Offrir une expérience alpine et voyage sans friction pour la communauté francophone et internationale, tant en Europe qu'en Amérique du Nord ou en Asie.

## 2. Unités Supportées
- **Distances** : Mètres et kilomètres (`metric`) / Pieds et miles (`imperial`).
- **Dénivelés** : Mètres (`metric`) / Pieds (`imperial`).
- **Poids** : Grammes et kilogrammes (`metric`) / Onces et livres (`imperial`).
- **Devises** : EUR, USD, GBP, CHF, CAD, JPY via `Intl.NumberFormat`.
- **Dates civiles** : Format sans décalage UTC (`Intl.DateTimeFormat(locale, { timeZone: 'UTC' })`).

## 3. Langues Cibles & Calendrier de Déploiement
| Langue | Code | Statut | Cible |
|---|---|---|---|
| Français | `fr` | Natif / Complet | En production |
| Anglais | `en` | Clés extraites / Dictionnaire prêt | Phase suivante |
| Espagnol | `es` | Planifié | Q1 2027 |
| Allemand | `de` | Planifié | Q2 2027 |

## 4. Architecture Technique
- Extraction centralisée des libellés dans `src/lib/i18n/translations/`.
- Formatage sans effet de bord dans `src/lib/i18n/formatters.ts`.
- Préférence utilisateur persistée dans les métadonnées de profil Supabase et miroir local.
