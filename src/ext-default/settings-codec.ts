/**
 * Default settings codec: settings.json is stored as plain JSON.
 *
 * A cloud shell substitutes its own `src/ext/settings-codec.ts` (gitignored,
 * linked in at build time) to encrypt stored values (e.g. BYOK API keys).
 */
export async function encodeEnvStore(plaintext: string): Promise<string> {
    return plaintext;
}

export async function decodeEnvStore(stored: string): Promise<string> {
    return stored;
}
