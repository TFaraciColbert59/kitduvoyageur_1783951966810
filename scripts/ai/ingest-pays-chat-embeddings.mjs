#!/usr/bin/env node
/**
 * Ingestion RAG du mini-chat pays — script AUTONOME (POC, phase RAG §3/§4).
 *
 * Lit les blocs publics country_content_blocks (degraded=false), les découpe
 * en chunks, les embedde via OpenRouter et reconstruit pays_chat_embeddings
 * par pays (DELETE + INSERT : idempotent par reconstruction).
 *
 * Ne peut pas importer src/features/pays/chat/paysChatChunking.ts (module TS
 * avec alias @/) : la fonction chunkMarkdown ci-dessous en est la COPIE —
 * les garder synchronisées (même convention que pregen-country-guides.mjs).
 *
 * Usage :
 *   node scripts/ai/ingest-pays-chat-embeddings.mjs --country=FR --dry-run
 *   node scripts/ai/ingest-pays-chat-embeddings.mjs --limit-countries=2 --dry-run
 *   node scripts/ai/ingest-pays-chat-embeddings.mjs --country=FR,IS
 *
 * Env requis : OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Jamais d'exécution sans --dry-run d'abord en
 * local ; l'écriture distante exige une approbation explicite (prod).
 */

import { createClient } from '@supabase/supabase-js';

const EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small'; // 1536D, cf. migration
const MAX_CHUNK_CHARS = 1500;
const MAX_BLOCKS_PER_COUNTRY = 50;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const dryRun = args['dry-run'] === true || args['dry-run'] === 'true';
const onlyCountry = typeof args.country === 'string' ? args.country.toUpperCase() : null;
const limitCountries = args['limit-countries'] ? Number(args['limit-countries']) : null;

const OR_KEY = process.env.OPENROUTER_API_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!OR_KEY || !SB_URL || !SB_SVC) {
  console.error('Env manquant : OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY requis.');
  process.exit(1);
}

// ── COPIE de src/features/pays/chat/paysChatChunking.ts (garder synchro) ──
function chunkMarkdown(markdown, maxChars = MAX_CHUNK_CHARS) {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return [];
  const chunks = [];
  let current = '';
  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = '';
  };
  for (const para of paragraphs) {
    if (para.length <= maxChars && (current + (current ? '\n\n' : '') + para).length <= maxChars) {
      current = current.length === 0 ? para : `${current}\n\n${para}`;
      continue;
    }
    if (current.length > 0 && para.length <= maxChars) {
      flush();
      current = para;
      continue;
    }
    flush();
    const words = para.split(/\s+/).filter((w) => w.length > 0);
    let piece = '';
    for (const word of words) {
      if (word.length > maxChars) {
        if (piece.length > 0) {
          chunks.push(piece);
          piece = '';
        }
        for (let i = 0; i < word.length; i += maxChars) chunks.push(word.slice(i, i + maxChars));
        continue;
      }
      const next = piece.length === 0 ? word : `${piece} ${word}`;
      if (next.length > maxChars) {
        chunks.push(piece);
        piece = word;
      } else {
        piece = next;
      }
    }
    if (piece.length > 0) current = piece;
  }
  flush();
  return chunks;
}
// ── fin copie ──

async function embedBatch(texts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OR_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lekitduvoyageur.fr',
        'X-Title': 'LKDV',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter embeddings HTTP ${res.status}`);
    const data = await res.json();
    const vecs = (data?.data ?? []).map((d) => d.embedding);
    if (vecs.length !== texts.length || !vecs.every((v) => Array.isArray(v) && v.length === 1536)) {
      throw new Error('Réponse embeddings inattendue (dimension ≠ 1536)');
    }
    return vecs;
  } finally {
    clearTimeout(timer);
  }
}

const supabase = createClient(SB_URL, SB_SVC);

async function countries() {
  const { data, error } = await supabase
    .from('country_content_blocks')
    .select('country_code')
    .eq('degraded', false);
  if (error) throw new Error(`Lecture blocs: ${error.message}`);
  const codes = [...new Set((data ?? []).map((r) => r.country_code))].sort();
  const filtered = onlyCountry ? codes.filter((c) => c === onlyCountry) : codes;
  return limitCountries ? filtered.slice(0, limitCountries) : filtered;
}

let inserted = 0;
let failed = 0;

for (const code of await countries()) {
  try {
    const { data: blocks, error } = await supabase
      .from('country_content_blocks')
      .select('block_type, content_md')
      .eq('country_code', code)
      .eq('degraded', false)
      .limit(MAX_BLOCKS_PER_COUNTRY);
    if (error) throw new Error(error.message);
    const rows = [];
    for (const b of blocks ?? []) {
      for (const chunk of chunkMarkdown(b.content_md ?? '')) {
        rows.push({ country_code: code, block_type: b.block_type, chunk_text: chunk });
      }
    }
    if (dryRun) {
      console.log(`[dry-run] ${code} : ${rows.length} chunks (${(blocks ?? []).length} blocs)`);
      inserted += rows.length;
      continue;
    }
    const vecs = await embedBatch(rows.map((r) => r.chunk_text));
    const { error: delErr } = await supabase.from('pays_chat_embeddings').delete().eq('country_code', code);
    if (delErr) throw new Error(`DELETE ${code}: ${delErr.message}`);
    const payload = rows.map((r, i) => ({ ...r, embedding: vecs[i], model: EMBEDDING_MODEL }));
    const { error: insErr } = await supabase.from('pays_chat_embeddings').insert(payload);
    if (insErr) throw new Error(`INSERT ${code}: ${insErr.message}`);
    inserted += rows.length;
    console.log(`OK ${code} : ${rows.length} chunks`);
  } catch (err) {
    failed += 1;
    console.error(`ÉCHOUÉ ${code}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\nTerminé : ${inserted} chunks, ${failed} échecs${dryRun ? ' (dry-run)' : ''}.`);
