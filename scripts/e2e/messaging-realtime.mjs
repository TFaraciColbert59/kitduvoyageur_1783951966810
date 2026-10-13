/**
 * F-003/F-030 — Porte E2E « temps réel, deux clients réels ».
 *
 * Vérifie, contre un projet Supabase de TEST (jamais la prod) :
 *   1. A et B se connectent (sessions distinctes) ;
 *   2. A crée la conversation directe (RPC) et écrit un message ;
 *   3. B, abonné à postgres_changes (messages, filtre conversation), reçoit
 *      l'événement SANS recharger.
 *
 * Activation : SUPABASE_TEST_URL + SUPABASE_TEST_ANON_KEY +
 * SUPABASE_TEST_SERVICE_ROLE_KEY (voir .github/workflows/ci.yml, porte Gate 5.2).
 * Sans configuration, SKIP propre.
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
const password = `e2e-rt-${stamp}-password`;
const emailA = `rt-e2e-a-${stamp}@test.local`;
const emailB = `rt-e2e-b-${stamp}@test.local`;
const created = {};

async function main() {
  for (const [key, email] of [['a', emailA], ['b', emailB]]) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert(!error && data.user, `création utilisateur ${key}: ${error?.message}`);
    created[key] = data.user.id;
  }

  const clientA = createClient(URL, ANON, { auth: { persistSession: false } });
  const clientB = createClient(URL, ANON, { auth: { persistSession: false } });
  assert(!(await clientA.auth.signInWithPassword({ email: emailA, password })).error, 'connexion A');
  assert(!(await clientB.auth.signInWithPassword({ email: emailB, password })).error, 'connexion B');

  const { data: convId, error: rpcError } = await clientA.rpc('get_or_create_direct_conversation', {
    p_target_user_id: created.b,
  });
  assert(!rpcError && convId, `RPC DM: ${rpcError?.message}`);
  created.convId = convId;

  let received = null;

  // Le projet de test peut démarrer le tenant realtime à froid : on retente
  // une fois après quelques secondes si le premier événement n'arrive pas.
  const waitForEvent = async () => {
    received = null;
    const channelB = clientB
      .channel(`rt-ci-${stamp}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          received = payload.new;
        }
      );

    const subscribed = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 15000);
      channelB.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
    if (!subscribed) {
      await clientB.removeChannel(channelB);
      return false;
    }

    const content = `message temps réel ${stamp}`;
    const { error: insertError } = await clientA
      .from('messages')
      .insert({ conversation_id: convId, sender_id: created.a, content });
    assert(!insertError, `insert message A: ${insertError?.message}`);

    const deadline = Date.now() + 15000;
    while (!received && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await clientB.removeChannel(channelB);
    return received?.content === content;
  };

  let ok = await waitForEvent();
  if (!ok) {
    console.log('Premier essai sans événement (tenant realtime à froid) — nouvelle tentative…');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    ok = await waitForEvent();
  }
  assert(ok, 'B reçoit le message de A sans rechargement');
  created.messageId = received.id;

  console.log('PASS — temps réel : B reçoit le message de A via postgres_changes.');
}

async function cleanup() {
  try {
    if (created.messageId) await admin.from('messages').delete().eq('id', created.messageId);
    if (created.convId) await admin.from('conversations').delete().eq('id', created.convId);
  } catch {
    /* ignore */
  }
  for (const key of ['a', 'b']) {
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
