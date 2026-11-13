/**
 * Exemple Vercel AI Gateway + AI SDK (hors production).
 *
 * Ce fichier n'est branché sur aucun écran ni agent du CRM : il sert à vérifier
 * la connexion au Gateway en local. Les agents LKDV restent sur NVIDIA NIM
 * (règle CLAUDE.md) ; cet exemple est une expérimentation isolée.
 *
 * Exécution : `node --env-file=.env.local index.ts`
 * La clé AI_GATEWAY_API_KEY est lue dans l'environnement, jamais écrite ici.
 */
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'moonshotai/kimi-k3',
  prompt:
    'Invente une nouvelle fête et décris ses traditions en trois paragraphes : origine, rituels, symboles. Donne-lui un nom.'
});

console.log(text);
