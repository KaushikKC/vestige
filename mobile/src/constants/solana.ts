import { PublicKey } from "@solana/web3.js";

export const RPC_ENDPOINT =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(
  "4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf",
);

/**
 * Custom fetch wrapper that retries on 429 (rate limit) with exponential backoff.
 * Pass as the `fetch` option to `new Connection(url, { fetch: fetchWithRetry })`.
 */
export const fetchWithRetry: typeof fetch = async (input, init) => {
  const MAX_RETRIES = 3;
  let delay = 400; // start at 400ms

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status !== 429 || attempt === MAX_RETRIES) {
        return res;
      }
    } catch (err) {
      // Network errors (e.g. DNS, timeout) — retry those too
      if (attempt === MAX_RETRIES) throw err;
    }
    // Add jitter (±20%) to avoid thundering herd
    const jitter = delay * (0.8 + Math.random() * 0.4);
    await new Promise((r) => setTimeout(r, jitter));
    delay *= 2;
  }

  // Unreachable, but TypeScript needs it
  return fetch(input, init);
};
