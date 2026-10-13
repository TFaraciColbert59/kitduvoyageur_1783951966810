/**
 * F-030 — Porte E2E « pièces jointes durables, deux identités réelles ».
 *
 * Vérifie, contre un projet Supabase de TEST (jamais la prod) :
 *   1. A téléverse un fichier sur le bucket privé message-attachments ;
 *   2. A enregistre la CLÉ durable dans un message de la conversation A↔B ;
 *   3. B (destinataire) résout une URL signée et télécharge le contenu ;
 *   4. C (tiers non membre) ne peut PAS signer ni télécharger l'objet ;
 *   5. la clé reste exploitable après relecture des messages (durabilité).
 *
 * Activation : SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY +
 * SUPABASE_TEST_SERVICE_ROLE_KEY (voir .github/workflows/ci.yml, porte Gate 5.1,
 * opt-in via la variable de dépôt LKDV_E2E_ENABLED). Sans configuration, le
 * script s'arrête proprement (SKIP) pour ne jamais rougir la CI des invariants.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.log('SKIP — SUPABASE_TEST_URL / ANON / SERVICE_ROLE absents (porte opt-in).');
  process.exit(0);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL — ${message}`);
    process.exit(1);
  }
}

const stamp = Date.now();
const password = `e2e-${stamp}-password-123`;
const emails = {
  a: `storage-e2e-a-${stamp}@test.local`,
  b: `storage-e2e-b-${stamp}@test.local`,
  c: `storage-e2e-c-${stamp}@test.local`,
};

const created = {};

async function main() {
  // ── Identités synthétiques ────────────────────────────────────────────────
  for (const key of ['a', 'b', 'c']) {
    const { data, error } = await admin.auth.admin.createUser({
      email: emails[key],
      password,
      email_confirm: true,
    });
    assert(!error && data.user, `création utilisateur ${key}: ${error?.message}`);
    created[key] = data.user.id;
  }

  const clientA = createClient(URL, ANON, { auth: { persistSession: false } });
  const clientB = createClient(URL, ANON, { auth: { persistSession: false } });
  const clientC = createClient(URL, ANON, { auth: { persistSession: false } });
  for (const [key, client] of [['a', clientA], ['b', clientB], ['c', clientC]]) {
    const { error } = await client.auth.signInWithPassword({ email: emails[key], password });
    assert(!error, `connexion ${key}: ${error?.message}`);
  }

  // ── Conversation A↔B (RPC réelle) ─────────────────────────────────────────
  const { data: convId, error: rpcError } = await clientA.rpc('get_or_create_direct_conversation', {
    p_target_user_id: created.b,
  });
  assert(!rpcError && convId, `RPC DM: ${rpcError?.message}`);
  created.convId = convId;

  // ── A téléverse une pièce jointe ─────────────────────────────────────────
  const fileName = `${convId}/${created.a}/${stamp}_e2e.png`;
  const fileBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // en-tête PNG
  const { error: uploadError } = await clientA.storage
    .from('message-attachments')
    .upload(fileName, fileBytes, { contentType: 'image/png', upsert: false });
  assert(!uploadError, `upload A: ${uploadError?.message}`);
  created.fileName = fileName;

  // ── A enregistre la clé durable dans un message ──────────────────────────
  const { data: message, error: insertError } = await clientA
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_id: created.a,
      content: fileName,
      message_type: 'image',
    })
    .select('id')
    .single();
  assert(!insertError && message?.id, `insert message A: ${insertError?.message}`);
  created.messageId = message.id;

  // ── B résout une URL signée et télécharge ────────────────────────────────
  const { data: signedB, error: signedErrorB } = await clientB.storage
    .from('message-attachments')
    .createSignedUrl(fileName, 60);
  assert(!signedErrorB && signedB?.signedUrl, `B signe l'objet: ${signedErrorB?.message}`);
  const downloadB = await fetch(signedB.signedUrl);
  assert(downloadB.ok, `B télécharge l'objet (HTTP ${downloadB.status})`);

  // ── C (tiers non membre) : ni message, ni signature, ni téléchargement ───
  const { data: messagesForC } = await clientC
    .from('messages')
    .select('id')
    .eq('conversation_id', convId);
  assert((messagesForC ?? []).length === 0, 'C ne voit aucun message de la conversation A↔B');

  const { data: signedC, error: signedErrorC } = await clientC.storage
    .from('message-attachments')
    .createSignedUrl(fileName, 60);
  assert(!signedC?.signedUrl || Boolean(signedErrorC), 'C ne peut pas signer l’objet d’autrui');

  // ── Durabilité : relecture des messages puis nouvelle signature ──────────
  const { data: reloaded, error: reloadError } = await clientB
    .from('messages')
    .select('id, content')
    .eq('conversation_id', convId);
  assert(!reloadError, `B relit les messages: ${reloadError?.message}`);
  const stored = (reloaded ?? []).find((row) => row.id === message.id);
  assert(stored?.content === fileName, 'le message porte toujours la clé durable après relecture');

  const { data: signedB2, error: signError2 } = await clientB.storage
    .from('message-attachments')
    .createSignedUrl(stored.content, 60);
  assert(!signError2 && signedB2?.signedUrl, 'B renouvelle son accès à la pièce jointe');

  console.log('PASS — pièce jointe durable : A téléverse, B accède, C est refusé, la clé survit au reload.');
}

async function cleanup() {
  try {
    if (created.fileName) {
      await admin.storage.from('message-attachments').remove([created.fileName]);
    }
  } catch {
    /* nettoyage best-effort */
  }
  try {
    if (created.convId) await admin.from('conversations').delete().eq('id', created.convId);
  } catch {
    /* ignore */
  }
  for (const key of ['a', 'b', 'c']) {
    try {
      if (created[key]) await admin.auth.admin.deleteUser(created[key]);
    } catch {
      /* ignore */
    }
  }
}

try {
  await main();
} catch (error) {
  console.error('FAIL — erreur inattendue :', error);
  process.exitCode = 1;
} finally {
  await cleanup();
  process.exit(process.exitCode ?? 0);
}
