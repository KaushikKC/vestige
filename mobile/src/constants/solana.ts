import { PublicKey } from "@solana/web3.js";

export const RPC_ENDPOINT =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(
  "4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf",
);

/**
 * Connection options that disable the BUILT-IN @solana/web3.js 429 retry logic.
 * web3.js retries 429s internally with its own exponential backoff + console.error logging.
 * We disable that to avoid double-retry storms (our fetchWithRetry + theirs = N*M retries).
 * Instead, we handle 429 retries ourselves in fetchWithRetry with controlled backoff.
 */
export const CONNECTION_CONFIG = {
  commitment: 'confirmed' as const,
  disableRetryOnRateLimit: true,
  fetch: fetchWithRetry,
};

/**
 * Custom fetch wrapper that retries on 429 (rate limit) with exponential backoff.
 * This is the ONLY retry layer — web3.js built-in retry is disabled via disableRetryOnRateLimit.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const MAX_RETRIES = 3;
  let delay = 500;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status !== 429 || attempt === MAX_RETRIES) {
        return res;
      }
    } catch (err) {
      // Network errors — retry those too
      if (attempt === MAX_RETRIES) throw err;
    }
    const jitter = delay * (0.8 + Math.random() * 0.4);
    await new Promise((r) => setTimeout(r, jitter));
    delay *= 2;
  }

  return fetch(input, init);
}
