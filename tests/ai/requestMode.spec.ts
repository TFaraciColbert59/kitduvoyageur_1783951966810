import { describe, it, expect } from 'vitest';

import {
  resolveAiMode,
  derivePromptAndSystem,
  buildSsePayload,
  DEFAULT_LKDV_SYSTEM,
} from '../../src/lib/ai/requestMode';

describe('src/lib/ai/requestMode — résolution de mode + dérivation', () => {
  describe('resolveAiMode', () => {
    const apiKeysWithGemini = { GEMINI: 'key-gemini' };

    it('TEST-MODE-01: provider legacy demandé ET clé présente → mode legacy', () => {
      const result = resolveAiMode(
        {
          provider: 'GEMINI',
          model: 'gemini-pro',
          messages: [{ role: 'user', content: 'salut' }],
        },
        apiKeysWithGemini,
      );
      expect(result).toMatchObject({ ok: true, mode: 'legacy' });
    });

    it('TEST-MODE-02: provider legacy demandé mais clé absente → mode nemotron (défaut)', () => {
      const result = resolveAiMode(
        {
          provider: 'ANTHROPIC',
          model: 'claude-x',
          messages: [{ role: 'user', content: 'salut' }],
        },
        apiKeysWithGemini,
      );
      expect(result).toMatchObject({ ok: true, mode: 'nemotron' });
    });

    it('TEST-MODE-03: sans provider → mode nemotron, task par défaut fast', () => {
      const result = resolveAiMode({ prompt: 'bonjour' }, apiKeysWithGemini);
      expect(result).toMatchObject({ ok: true, mode: 'nemotron' });
      if (result.ok) expect(result.body.task).toBe('fast');
    });

    it('TEST-MODE-04: provider "nemotron" explicite → mode nemotron', () => {
      const result = resolveAiMode({ provider: 'nemotron', task: 'heavy', prompt: 'x' }, {});
      expect(result).toMatchObject({ ok: true, mode: 'nemotron' });
    });

    it('TEST-MODE-05: body invalide (messages non tableau) → ok:false avec issues', () => {
      const result = resolveAiMode(
        { provider: 'GEMINI', model: 'm', messages: 'pas-un-tableau' },
        apiKeysWithGemini,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    });

    it('TEST-MODE-06: valeurs par défaut stream=false et parameters={}', () => {
      const result = resolveAiMode({ prompt: 'x' }, {});
      if (result.ok) {
        expect(result.body.stream).toBe(false);
        expect(result.body.parameters).toEqual({});
      } else {
        expect.unreachable();
      }
    });
  });

  describe('derivePromptAndSystem', () => {
    it('TEST-MODE-07: prompt direct prioritaire sur les messages', () => {
      const derived = derivePromptAndSystem({
        prompt: 'question directe',
        system: 'sys direct',
        messages: [
          { role: 'system', content: 'sys message' },
          { role: 'user', content: 'user message' },
        ],
      });
      expect(derived).toEqual({ system: 'sys direct', prompt: 'question directe' });
    });

    it('TEST-MODE-08: sans prompt direct, utilise le dernier message user', () => {
      const derived = derivePromptAndSystem({
        messages: [
          { role: 'user', content: 'première' },
          { role: 'assistant', content: 'réponse' },
          { role: 'user', content: 'dernière' },
        ],
      });
      expect(derived?.prompt).toBe('dernière');
    });

    it('TEST-MODE-09: system dérivé du dernier message system si absent du body', () => {
      const derived = derivePromptAndSystem({
        messages: [
          { role: 'system', content: 'sys1' },
          { role: 'user', content: 'q' },
          { role: 'system', content: 'sys2' },
        ],
      });
      expect(derived?.system).toBe('sys2');
    });

    it('TEST-MODE-10: sans system du tout → DEFAULT_LKDV_SYSTEM (garde-fous explicites)', () => {
      const derived = derivePromptAndSystem({ messages: [{ role: 'user', content: 'q' }] });
      expect(derived?.system).toBe(DEFAULT_LKDV_SYSTEM);
      expect(DEFAULT_LKDV_SYSTEM.length).toBeGreaterThan(50);
    });

    it('TEST-MODE-11: ni prompt ni message user → null (appelant renvoie 400)', () => {
      expect(derivePromptAndSystem({ messages: [{ role: 'assistant', content: 'seulement moi' }] })).toBeNull();
      expect(derivePromptAndSystem({})).toBeNull();
    });
  });

  describe('buildSsePayload', () => {
    it('TEST-MODE-12: payload SSE = 3 frames start/chunk/done (contrat client conservé)', () => {
      const payload = buildSsePayload('texte', true);
      const frames = payload
        .split('\n\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => JSON.parse(l.slice(6)));

      expect(frames).toEqual([
        { type: 'start' },
        { type: 'chunk', chunk: { text: 'texte', degraded: true } },
        { type: 'done' },
      ]);
    });
  });
});
