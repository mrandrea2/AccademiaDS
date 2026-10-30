import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key(
  value: string | undefined = process.env.DRIVE_TOKEN_ENCRYPTION_KEY,
) {
  if (!value) throw new Error("Chiave cifratura Drive non configurata.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32)
    throw new Error("Chiave cifratura Drive: richiesti 32 byte base64.");
  return bytes;
}
export function seal(value: unknown, keyValue?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyValue), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url",
  );
}
export function unseal(value: string, keyValue?: string): unknown {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29) throw new Error("Dati cifrati non validi.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(keyValue),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
