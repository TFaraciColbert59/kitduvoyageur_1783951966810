import { callAIEndpoint } from './aiClient';

const ENDPOINT = '/api/ai/chat-completion';

export const GEMINI_PROVIDER = 'GEMINI';
export const GEMINI_DEFAULT_MODEL = 'gemini/gemini-2.0-flash';

export async function getChatCompletion(
  provider: string,
  model: string,
  messages: object[],
  parameters: object = {}
) {
  return callAIEndpoint(ENDPOINT, {
    provider,
    model,
    messages,
    stream: false,
    parameters,
  });
}

export async function getStreamingChatCompletion(
  provider: string,
  model: string,
  messages: object[],
  onChunk: (chunk: unknown) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  parameters: object = {}
) {
  let completeCalled = false;
  const safeComplete = () => {
    if (!completeCalled) {
      completeCalled = true;
      onComplete();
    }
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages, stream: true, parameters }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `HTTP error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Stream ended — flush remaining buffer and mark complete
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk' && data.chunk) onChunk(data.chunk);
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
        safeComplete();
        break;
      }

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk' && data.chunk) {
              onChunk(data.chunk);
            } else if (data.type === 'done') {
              safeComplete();
            } else if (data.type === 'error') {
              console.error('API Route Error:', {
                error: data.error,
                details: data.details,
              });
              onError(new Error(data.error));
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    onError(error instanceof Error ? error : new Error('Streaming error'));
  }
}

export interface StreamChatHandlers {
  onDelta: (delta: string) => void;
  onDone?: (meta: { degraded: boolean; model?: string; provider?: string }) => void;
  signal?: AbortSignal;
}

/**
 * Flux SSE du routeur LKDV par défaut (`askAIStream`).
 *
 * Le parseur est volontairement local au client : les frames sont
 * `{type:'start'|'chunk'|'done'|'error'}` et `chunk.choices[0].delta.content`.
 * Une erreur, une fin sans `done` ou un JSON invalide terminent le flux en
 * erreur : on n'appelle jamais `onDone` après `onError`.
 */
export async function streamChatCompletion(
  payload: { task?: 'fast' | 'heavy'; system?: string; prompt?: string; maxTokens?: number; reasoningBudget?: number },
  { onDelta, onDone, signal }: StreamChatHandlers
): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { details?: string; error?: string };
      message = data.details || data.error || message;
    } catch {
      /* corps non JSON */
    }
    throw new Error(message);
  }
  if (!response.body) throw new Error('Flux IA illisible');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal = false;
  try {
    while (!terminal) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1_000_000) throw new Error('Flux IA trop long');
      let match = buffer.match(/\r\n\r\n|\n\n|\r\r/);
      while (match && match.index !== undefined) {
        const raw = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        terminal = handleFrame(raw, onDelta, onDone);
        if (terminal) break;
        match = buffer.match(/\r\n\r\n|\n\n|\r\r/);
      }
    }
    if (!terminal) throw new Error('Flux IA interrompu');
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* déjà fermé */
    }
    reader.releaseLock();
  }
}

function handleFrame(
  raw: string,
  onDelta: (delta: string) => void,
  onDone?: StreamChatHandlers['onDone']
): boolean {
  const dataLines: string[] = [];
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length === 0) return false;
  const data = dataLines.join('\n').trim();
  if (!data) return false;

  let frame: {
    type?: string;
    chunk?: { choices?: Array<{ delta?: { content?: unknown } }>; text?: unknown };
    error?: string;
    degraded?: boolean;
    model?: string;
    provider?: string;
  };
  try {
    frame = JSON.parse(data) as typeof frame;
  } catch {
    throw new Error('Flux IA invalide');
  }
  if (frame.type === 'error') {
    throw new Error(frame.error || 'Flux IA interrompu');
  }
  if (frame.type === 'done') {
    onDone?.({
      degraded: frame.degraded === true,
      model: typeof frame.model === 'string' ? frame.model : undefined,
      provider: typeof frame.provider === 'string' ? frame.provider : undefined,
    });
    return true;
  }
  if (frame.type === 'chunk') {
    const content = frame.chunk?.choices?.[0]?.delta?.content ?? frame.chunk?.text;
    if (typeof content === 'string' && content.length > 0) onDelta(content);
  }
  return false;
}
