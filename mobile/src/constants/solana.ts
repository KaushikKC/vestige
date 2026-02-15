import { PublicKey } from '@solana/web3.js';

export const RPC_ENDPOINT = 'https://api.devnet.solana.com';
export const PROGRAM_ID = new PublicKey('4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf');

/**
 * Custom fetch wrapper that retries on 429 (rate limit) with exponential backoff.
 * Pass as the `fetch` option to `new Connection(url, { fetch: fetchWithRetry })`.
 */
export const fetchWithRetry: typeof fetch = async (input, init) => {
  const MAX_RETRIES = 4;
  let delay = 500; // start at 500ms

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt === MAX_RETRIES) {
      return res;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }

  // Unreachable, but TypeScript needs it
  return fetch(input, init);
};
