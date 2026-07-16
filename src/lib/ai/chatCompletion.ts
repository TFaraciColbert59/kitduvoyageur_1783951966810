import { callAIEndpoint } from './aiClient';

const ENDPOINT = '/api/ai/chat-completion';

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
