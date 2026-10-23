# Mentions d'affiliation par région (PLAN-100 6.4)

> **À valider par un juriste avant toute ouverture hors de France.** Ce document décrit ce que
> fait le code ; il ne dit pas ce qu'exige le droit. Aucune formulation ci-dessous n'a été relue
> par un professionnel du droit.

## Ce que fait le code

`src/features/affiliation/engine/disclosureRegion.ts` (pur, testé par
`tests/affiliation/disclosure-region.spec.ts`) choisit le texte affiché par
`<AffiliateDisclosure />` selon la **région** de la personne (code ISO `US` ou balise `en-GB`,
sinon la région de la langue du site : `fr` → France, `en` → États-Unis). Les textes sont dans
les dictionnaires (`affiliation.disclosure`, fr / en / es / de / it).

| Régime | Régions | Texte |
|---|---|---|
| `fr` | France | Mention française d'origine, **au caractère près** (rendu comparé à celui d'avant : `tests/affiliation/fixtures/affiliateDisclosure.fr.json`). |
| `eu` | Autres États membres de l'UE | Même mention (traduite dans la langue du site), sans note. |
| `us` | États-Unis | Note lue en tête : lien financier (« material connection ») et commission possible ; étiquette « Affiliate links (paid) ». |
| `uk` | Royaume-Uni | Note lue en tête : ces liens sont de la publicité ; étiquette compacte commençant par « Ad ». |
| `default` | Ailleurs, région inconnue | Mention actuelle, sans note. |

`rel="sponsored nofollow"` reste sur chaque lien d'offre (inchangé, `AffiliateLinkCard`, Compas).
Rien n'est allumé : la langue servie reste `fr` tant qu'aucun drapeau `NEXT_PUBLIC_I18N_*_ENABLED`
n'est posé, et aucun appel ne passe encore de `region` (la région vient donc de la langue).

## Références (à relire par le juriste)

- France / UE : Code de la consommation, art. L121-2 et L121-3 (pratiques commerciales
  trompeuses, contrôle DGCCRF) ; loi n° 2023-451 du 9 juin 2023 ; directive 2005/29/CE.
- États-Unis : FTC, *Guides Concerning the Use of Endorsements and Testimonials in Advertising*
  (16 CFR Part 255) — notion de « material connection », divulgation claire et visible.
- Royaume-Uni : CMA et ASA (CAP Code, règle 2.1 : une communication commerciale doit être
  reconnaissable comme telle) ; guide ASA/CMA sur les liens d'affiliation (étiquette « Ad »).

## Reste à faire

- Relecture juridique des cinq variantes et des traductions (es / de / it relues par une
  personne de chaque langue).
- Brancher une région réelle (réglage du compte ou balise du navigateur, sans écart
  d'hydratation) : aujourd'hui seule la langue du site décide.
- Mentions légales par région (`/mentions-legales`) : non traitées ici.
