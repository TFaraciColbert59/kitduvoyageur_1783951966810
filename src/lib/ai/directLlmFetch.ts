/**
 * Zero-dependency direct LLM completion helper (replaces @rocketnew/llm-sdk).
 * Supports OpenAI, Anthropic (Claude), Google Gemini (OpenAI-compat endpoint), and Perplexity.
 */

export interface DirectLlmMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

export interface DirectLlmRequest {
  model: string;
  messages: DirectLlmMessage[];
  api_key: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface DirectLlmChoice {
  message?: { role?: string; content?: string };
  delta?: { content?: string };
}

export interface DirectLlmResponse {
  choices: DirectLlmChoice[];
  model?: string;
  usage?: Record<string, unknown>;
}

function resolveEndpoint(model: string): { kind: 'anthropic' | 'openai-compat'; url: string; normalizedModel: string } {
  const trimmed = model.trim();
  if (trimmed.startsWith('claude-') || trimmed.startsWith('anthropic/')) {
    return {
      kind: 'anthropic',
      url: 'https://api.anthropic.com/v1/messages',
      normalizedModel: trimmed.replace(/^anthropic\//, ''),
    };
  }
  if (trimmed.startsWith('gemini/') || trimmed.startsWith('gemini-')) {
    return {
      kind: 'openai-compat',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      normalizedModel: trimmed.replace(/^gemini\//, ''),
    };
  }
  if (trimmed.startsWith('sonar') || trimmed.startsWith('perplexity/')) {
    return {
      kind: 'openai-compat',
      url: 'https://api.perplexity.ai/chat/completions',
      normalizedModel: trimmed.replace(/^perplexity\//, ''),
    };
  }
  return {
    kind: 'openai-compat',
    url: 'https://api.openai.com/v1/chat/completions',
    normalizedModel: trimmed.replace(/^openai\//, ''),
  };
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          yield payload;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function directLlmCompletion(
  req: DirectLlmRequest,
): Promise<DirectLlmResponse | AsyncIterable<unknown>> {
  const { kind, url, normalizedModel } = resolveEndpoint(req.model);

  if (kind === 'anthropic') {
    const systemMsg = req.messages.find((m) => m.role === 'system')?.content;
    const chatMessages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: normalizedModel,
        max_tokens: req.max_tokens ?? 2048,
        ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
        ...(systemMsg ? { system: systemMsg } : {}),
        messages: chatMessages,
        ...(req.stream ? { stream: true } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`) as Error & { statusCode?: number; llmProvider?: string };
      err.statusCode = res.status;
      err.llmProvider = 'ANTHROPIC';
      throw err;
    }

    if (req.stream && res.body) {
      return parseSseStream(res.body);
    }

    const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }>; model?: string; usage?: Record<string, unknown> };
    const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
    return {
      choices: [{ message: { role: 'assistant', content: text } }],
      model: json.model ?? normalizedModel,
      usage: json.usage,
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${req.api_key}`,
    },
    body: JSON.stringify({
      model: normalizedModel,
      messages: req.messages,
      ...(typeof req.max_tokens === 'number' ? { max_tokens: req.max_tokens } : {}),
      ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      ...(req.stream ? { stream: true } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`) as Error & { statusCode?: number; llmProvider?: string };
    err.statusCode = res.status;
    err.llmProvider = normalizedModel.startsWith('gemini') ? 'GEMINI' : 'OPEN_AI';
    throw err;
  }

  if (req.stream && res.body) {
    return parseSseStream(res.body);
  }

  return (await res.json()) as DirectLlmResponse;
}
