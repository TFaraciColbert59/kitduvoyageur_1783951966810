// Client Supabase service_role. La clé n'est jamais affichée.
import { createClient } from '@supabase/supabase-js';
import { config } from './env.mjs';
import { chunk } from './batch.mjs';

export const db = createClient(config.url, config.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'lkdv-world-seed' } },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn, attempts = 5) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const wait = 400 * 2 ** i;
      console.warn(`  ↻ ${label} — tentative ${i + 1}/${attempts} dans ${wait}ms (${err.message})`);
      await sleep(wait);
    }
  }
  throw last;
}

export async function listAllUsers() {
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await withRetry('auth.listUsers', () =>
      db.auth.admin.listUsers({ page, perPage: 1000 })
    );
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function findUserByEmail(email) {
  const users = await listAllUsers();
  return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) ?? null;
}

export async function ensureAuthUser({ email, password, fullName, avatarUrl, resetPassword = false }) {
  const metadata = { full_name: fullName, avatar_url: avatarUrl };
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (!error && data?.user) return { user: data.user, created: true };

  const existing = await findUserByEmail(email);
  if (!existing) {
    throw new Error(`Création auth impossible pour ${email}: ${error?.message || 'inconnu'}`);
  }
  if (resetPassword) {
    const { error: updErr } = await db.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (updErr) throw new Error(`Mise à jour auth ${email}: ${updErr.message}`);
  }
  return { user: existing, created: false };
}

export async function updateAuthUser(userId, patch) {
  const { error } = await db.auth.admin.updateUserById(userId, patch);
  if (error) throw new Error(`auth.updateUserById: ${error.message}`);
}

export async function selectAll(table, columns = '*', apply = (q) => q, { pageSize = 1000, maxPages = 60 } = {}) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    let q = db.from(table).select(columns).range(from, from + pageSize - 1);
    q = apply(q);
    const { data, error } = await withRetry(`select ${table}`, () => q);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export async function countRows(table, apply = (q) => q) {
  let q = db.from(table).select('*', { count: 'exact', head: true });
  q = apply(q);
  const { count, error } = await withRetry(`count ${table}`, () => q);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

export async function upsertRows(table, rows, { onConflict = 'id', ignoreDuplicates = false, batchSize = 200 } = {}) {
  if (!rows.length) return 0;
  let total = 0;
  for (const part of chunk(rows, batchSize)) {
    const { error } = await withRetry(`upsert ${table}`, () =>
      db.from(table).upsert(part, { onConflict, ignoreDuplicates })
    );
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
    total += part.length;
  }
  return total;
}

export async function insertRows(table, rows, { batchSize = 200 } = {}) {
  if (!rows.length) return 0;
  let total = 0;
  for (const part of chunk(rows, batchSize)) {
    const { error } = await withRetry(`insert ${table}`, () => db.from(table).insert(part));
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    total += part.length;
  }
  return total;
}

export async function updateRows(table, patch, apply) {
  let q = db.from(table).update(patch);
  q = apply(q);
  const { error } = await withRetry(`update ${table}`, () => q);
  if (error) throw new Error(`update ${table}: ${error.message}`);
}

export async function deleteIds(table, ids) {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids, 200)) {
    const { error } = await withRetry(`delete ${table}`, () => db.from(table).delete().in('id', part));
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    total += part.length;
  }
  return total;
}

export async function rpc(name, args) {
  const { data, error } = await withRetry(`rpc ${name}`, () => db.rpc(name, args));
  if (error) throw new Error(`rpc ${name}: ${error.message}`);
  return data;
}

export { withRetry, sleep };
