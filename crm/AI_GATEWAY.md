# AI SDK — Vercel AI Gateway et contournement local

## 1. Ce qui est demandé

`index.ts` : `generateText` (AI SDK), modèle `moonshotai/kimi-k3`, via Vercel AI Gateway, clé `AI_GATEWAY_API_KEY` dans `.env.local` (ignoré par Git).

## 2. État réel

- La clé Gateway **s'authentifie** (plus de `GatewayAuthenticationError`).
- Vercel refuse ensuite la requête : `403 customer_verification_required — AI Gateway requires a valid credit card on file to service requests`.
- Aucun moyen de contourner ce point côté API : c'est une vérification de facturation de l'équipe Vercel. Aucune carte n'a été ajoutée (budget 0 €).

## 3. Contournement sans argent (vérifié)

`index-nvidia.ts` utilise **le même AI SDK** (`generateText`) avec NVIDIA NIM, fournisseur autorisé par `CLAUDE.md` :

```bash
node --env-file=/Users/fr168256/Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/.env.local index-nvidia.ts
```

Résultat : texte généré (fête « Lumenaris »), code de sortie 0. La clé NVIDIA n'est jamais copiée dans le dépôt ; elle est lue depuis l'environnement.

## 4. Repasser sur le Gateway plus tard

Dès qu'une carte est ajoutée à l'équipe Vercel (crédits gratuits débloqués) :

```bash
node --env-file=.env.local index.ts
```

Aucun changement de code n'est nécessaire.
