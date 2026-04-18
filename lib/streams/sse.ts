export async function readJsonSseStream(
  stream: ReadableStream<Uint8Array>,
  onMessage: (value: unknown) => void | Promise<void>,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = await flushBuffer(buffer, onMessage);
    }

    buffer += decoder.decode();
    await flushBuffer(buffer, onMessage);
  } finally {
    reader.releaseLock();
  }
}

async function flushBuffer(
  buffer: string,
  onMessage: (value: unknown) => void | Promise<void>,
) {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;

    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      await onMessage(JSON.parse(payload));
    } catch {}
  }

  return remainder;
}
