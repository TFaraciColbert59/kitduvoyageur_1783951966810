#!/usr/bin/env node
/**
 * Pré-génération du cache « country-guides » (Chantier D) — script AUTONOME.
 *
 * Ne peut pas importer les modules server-only de src/lib/ai (Next RSC) :
 * duplique la boucle minimale — fetch OpenRouter direct + RPC set_ai_cache
 * (service role). ⚠️ La liste des questions est un doublon de
 * src/lib/ai/features/countryGuides.ts (COUNTRY_QUESTIONS) : les garder
 * synchronisées. Le prompt ci-dessous DOIT rester identique à buildGuidePrompt
 * pour produire les mêmes clés de cache.
 *
 * Référentiel pays : liste minimale intégrée (spot-runs et tests). La
 * pré-génération COMPLÈTE avec le référentiel complet passe par la route cron
 * /api/cron/refresh-country-guides (qui utilise src/lib/countries.ts).
 *
 * Usage :
 *   node scripts/ai/pregen-country-guides.mjs --country=NP
 *   node scripts/ai/pregen-country-guides.mjs --limit-countries=2 --offset=0
 *   node scripts/ai/pregen-country-guides.mjs --country=FR --force --dry-run
 *   node scripts/ai/pregen-country-guides.mjs --list-countries
 *
 * Env requis : OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Idempotent : les entrées de cache encore valides sont ignorées (sauf --force).
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const TTL_SECONDS = 2_592_000; // 30 jours
const MAX_TOKENS = 512;
const REASONING_BUDGET = 2000;

// ⚠️ Doublon synchronisé de COUNTRY_QUESTIONS (src/lib/ai/features/countryGuides.ts)
const QUESTIONS = [
  "L'eau du robinet est-elle potable ?",
  'Faut-il un filtre à eau ou des pastilles purificatrices ?',
  'Quel est le niveau de sécurité pour les voyageurs ?',
  'Quelles sont les zones à éviter ?',
  'Faut-il un visa, et comment l\'obtenir ?',
  'Quelle est la meilleure saison pour voyager ?',
  'Quel est le climat par grande période ?',
  'Quel budget quotidien prévoir ?',
  'Quelles prises électriques et quelle tension ?',
  'Quelle est la monnaie locale et faut-il du liquide ?',
  'Comment fonctionne le pourboire ?',
  'Quels sont les numéros d\'urgence ?',
  'Quels vaccins sont recommandés ?',
  'Que mettre dans la trousse de secours ?',
  'Faut-il une assurance voyage spécifique ?',
  'Comment se déplacer sur place (transport local) ?',
  'Peut-on louer une voiture, et avec quel permis ?',
  'Quelle connectivité : carte SIM locale, eSIM, wifi ?',
  'Quelles formalités douanières à l\'entrée ?',
  'Quels sont les plats typiques et les précautions alimentaires ?',
  'Quelle langue parle-t-on et l\'anglais suffit-il ?',
  'Quelles sont les règles culturelles et religieuses à respecter ?',
  'Quels équipements outdoor sont indispensables selon la saison ?',
  'Y a-t-il des risques naturels (altitude, séismes, faune) ?',
  'Quels sont les incontournables pour un premier voyage ?',
];

// Référentiel minimal du script (spot-runs) — le référentiel COMPLET vit dans
// src/lib/countries.ts et est utilisé par /api/cron/refresh-country-guides.
const COUNTRIES = [
  { code: 'FR', nom: 'France', capitale: 'Paris', langue: 'Français', monnaie_nom: 'Euro', monnaie_code: 'EUR', saison: 'Mai–septembre' },
  { code: 'NP', nom: 'Népal', capitale: 'Katmandou', langue: 'Népali', monnaie_nom: 'Roupie népalaise', monnaie_code: 'NPR', saison: 'Octobre–novembre, mars–avril' },
  { code: 'PE', nom: 'Pérou', capitale: 'Lima', langue: 'Espagnol', monnaie_nom: 'Sol', monnaie_code: 'PEN', saison: 'Mai–septembre' },
  { code: 'IS', nom: 'Islande', capitale: 'Reykjavík', langue: 'Islandais', monnaie_nom: 'Couronne islandaise', monnaie_code: 'ISK', saison: 'Juin–août' },
  { code: 'MA', nom: 'Maroc', capitale: 'Rabat', langue: 'Arabe', monnaie_nom: 'Dirham', monnaie_code: 'MAD', saison: 'Mars–mai, septembre–novembre' },
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

const apiKey = process.env.OPENROUTER_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !supabaseUrl || !serviceKey) {
  console.error('ERROR: OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dryRun = args['dry-run'] === true;
const force = args['force'] === true;
const offset = Number(args.offset ?? 0) || 0;
const limitCountries = args['limit-countries'] ? Number(args['limit-countries']) : undefined;
const maxQuestions = args['max-questions'] ? Number(args['max-questions']) : QUESTIONS.length;

if (args['list-countries']) {
  console.log(JSON.stringify(COUNTRIES, null, 2));
  process.exit(0);
}

const normalize = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const cacheKey = (prompt) =>
  createHash('sha256').update(`country-guides|${normalize(prompt)}|fr`).digest('hex');

const buildSystem = () =>
  'Tu es un guide de voyage francophone expert, précis et prudent. Réponds en français, ' +
  'en 80 à 150 mots, en texte brut (pas de JSON, pas de markdown, pas de liste à puces). ' +
  "Si une information est incertaine ou changeante (visa, sécurité, prix), dis-le explicitement " +
  "et renvoie vers les sources officielles — n'invente jamais un chiffre ou une règle.";

const buildPrompt = (countryName, question, context) =>
  `Contexte factuel du pays :\n${context}\n\nQuestion du voyageur : ${question}\n\nRéponds pour un voyageur qui prépare son kit et son itinéraire dans ce pays.`;

async function askOpenRouter(system, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com',
        'X-Title': 'LKDV',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        reasoning: { max_tokens: REASONING_BUDGET },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Réponse vide');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

let codes = args.country
  ? String(args.country).split(',').map((c) => c.trim().toUpperCase())
  : COUNTRIES.map((c) => c.code);
codes = [...new Set(codes)].slice(offset, limitCountries ? offset + limitCountries : undefined);

let generated = 0;
let skipped = 0;
let failed = 0;

for (const code of codes) {
  const country = COUNTRIES.find((c) => c.code === code);
  if (!country) {
    console.warn(`Pays absent du référentiel du script : ${code} — passez par /api/cron/refresh-country-guides pour le référentiel complet.`);
    failed += 1;
    continue;
  }
  const context = [
    `Pays : ${country.nom}`,
    `Capitale : ${country.capitale}`,
    `Langue(s) : ${country.langue}`,
    `Monnaie : ${country.monnaie_nom} (${country.monnaie_code})`,
    `Meilleure saison : ${country.saison}`,
  ].join('\n');
  const system = buildSystem();

  for (const question of QUESTIONS.slice(0, maxQuestions)) {
    const prompt = buildPrompt(country.nom, question, context);
    const key = cacheKey(prompt);
    try {
      if (!force) {
        const { data: existing } = await supabase.rpc('get_ai_cache', { p_cache_key: key });
        if (existing) {
          skipped += 1;
          continue;
        }
      }
      if (dryRun) {
        console.log(`[dry-run] ${country.nom} — ${question}`);
        generated += 1;
        continue;
      }
      const text = await askOpenRouter(system, prompt);
      const { error } = await supabase.rpc('set_ai_cache', {
        p_cache_key: key,
        p_feature: 'country-guides',
        p_response: { text, model: MODEL, degraded: false, provider: 'openrouter' },
        p_model: MODEL,
        p_provider: 'openrouter',
        p_ttl_seconds: TTL_SECONDS,
      });
      if (error) {
        console.error(`[set_ai_cache] ${country.nom}: ${error.message}`);
        failed += 1;
        continue;
      }
      generated += 1;
      console.log(`OK ${country.nom} — ${question}`);
    } catch (err) {
      failed += 1;
      console.error(`ECHOUÉ ${country.nom} — ${question}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

console.log(`\nTerminé : ${generated} générées, ${skipped} en cache, ${failed} échecs${dryRun ? ' (dry-run)' : ''}.`);
