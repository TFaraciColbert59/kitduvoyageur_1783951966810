// Test bout en bout du flux IA : premier token, erreur, terminaison, texte.
// Usage : node scripts/perf/test-ai-stream.mjs <base>
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/perf/test-ai-stream.mjs <base>');
  process.exit(2);
}
const state = JSON.parse(fs.readFileSync(process.env.STORAGE_STATE || '/tmp/session-fresh.json', 'utf8'));
const cookie = state.cookies
  .filter((entry) => entry.name.startsWith('sb-'))
  .map((entry) => `${entry.name}=${entry.value}`)
  .join('; ');

const started = performance.now();
const response = await fetch(`${base}/api/ai/chat-completion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    task: 'fast',
    stream: true,
    maxTokens: 128,
    system: 'Réponds en une phrase courte, en français.',
    prompt: 'Dis bonjour à un voyageur et souhaite-lui un bon voyage.',
  }),
});
console.log('status', response.status, 'content-type', response.headers.get('content-type'));
if (!response.ok || !response.body) {
  console.log('body', (await response.text()).slice(0, 300));
  process.exit(1);
}
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let firstToken = null;
let text = '';
let done = null;
let error = null;
while (true) {
  const { done: finished, value } = await reader.read();
  if (finished) break;
  buffer += decoder.decode(value, { stream: true });
  let index;
  while ((index = buffer.indexOf('\n\n')) >= 0) {
    const frame = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 2);
    if (!frame.startsWith('data:')) continue;
    const payload = JSON.parse(frame.slice(5).trim());
    if (payload.type === 'chunk') {
      const delta = payload.chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        if (firstToken == null) firstToken = Math.round(performance.now() - started);
        text += delta;
      }
    } else if (payload.type === 'error') {
      error = payload;
    } else if (payload.type === 'done') {
      done = payload;
    }
  }
}
console.log(JSON.stringify({
  firstTokenMs: firstToken,
  totalMs: Math.round(performance.now() - started),
  textLength: text.length,
  text: text.slice(0, 120),
  done,
  error,
}, null, 2));
await reader.releaseLock();
