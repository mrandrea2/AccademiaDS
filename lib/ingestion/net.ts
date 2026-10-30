import { ApiError } from "./auth";
/** Bound decompressed response bytes before JSON parsing (including OCR adapters). */
export async function limitedJson(
  response: Response,
  maxBytes = 1000000,
): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new ApiError(502, "Risposta esterna oltre il limite consentito.");
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, "Risposta esterna vuota.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes)
        throw new ApiError(502, "Risposta esterna oltre il limite consentito.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(502, "Risposta esterna non JSON.");
  }
}
