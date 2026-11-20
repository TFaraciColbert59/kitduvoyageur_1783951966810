/**
 * Contournement local du blocage AI Gateway (carte bancaire exigée par Vercel) :
 * même AI SDK (`generateText`), même prompt, mais via NVIDIA NIM — le fournisseur
 * autorisé par CLAUDE.md. La clé est lue dans l'environnement, jamais écrite ici.
 *
 * Exécution :
 *   node --env-file=/Users/fr168256/Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/.env.local index-nvidia.ts
 */
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) throw new Error('NVIDIA_API_KEY absente de l’environnement');

const nim = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey
});

const { text } = await generateText({
  model: nim('nvidia/nemotron-3.5-lightning-30b-a3b'),
  prompt:
    'Invente une nouvelle fête et décris ses traditions en trois paragraphes : origine, rituels, symboles. Donne-lui un nom.'
});

console.log(text);
