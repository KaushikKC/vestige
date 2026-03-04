import { useState, useCallback, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_ENDPOINT, CONNECTION_CONFIG } from '../constants/solana';

interface TradePoint {
  timestamp: number;
  price: number; // lamports per token
  volume: number; // SOL amount in lamports
  type: 'buy' | 'sell';
}

export interface Candle {
  timestamp: number; // bucket start
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export type Interval = '1m' | '5m' | '15m';

const INTERVAL_SECONDS: Record<Interval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
};

function aggregateCandles(trades: TradePoint[], interval: Interval): Candle[] {
  if (trades.length === 0) return [];

  const bucketSize = INTERVAL_SECONDS[interval];
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  const buckets = new Map<number, TradePoint[]>();
  for (const t of sorted) {
    const key = Math.floor(t.timestamp / bucketSize) * bucketSize;
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }

  const candles: Candle[] = [];
  for (const [ts, points] of buckets) {
    const prices = points.map((p) => p.price);
    candles.push({
      timestamp: ts,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: points.reduce((s, p) => s + p.volume, 0),
      buyVolume: points.filter((p) => p.type === 'buy').reduce((s, p) => s + p.volume, 0),
      sellVolume: points.filter((p) => p.type === 'sell').reduce((s, p) => s + p.volume, 0),
    });
  }

  return candles.sort((a, b) => a.timestamp - b.timestamp);
}

// Regex for on-chain logs:
// Buy: 500000000 lamports (net 495000000 after fees) -> 990000000 base tokens + 0 bonus entitled
const BUY_RE = /Buy:\s*(\d+)\s*lamports\s*\(net\s*\d+\s*after fees\)\s*->\s*(\d+)\s*base tokens/;
// Sell: 990000000 tokens -> 500000000 lamports (net 495000000 after fees)
const SELL_RE = /Sell:\s*(\d+)\s*tokens\s*->\s*(\d+)\s*lamports/;

export function useTradeCandles(launchPda: string) {
  const [trades, setTrades] = useState<TradePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval_] = useState<Interval>('5m');

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const conn = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
      // Use the launch PDA directly — it's written in every buy/sell transaction
      // and is reliably indexed by all RPC nodes.
      const sigs = await conn.getSignaturesForAddress(new PublicKey(launchPda), { limit: 50 });

      const parsed: TradePoint[] = [];
      const BATCH = 3;
      for (let i = 0; i < sigs.length; i += BATCH) {
        const batch = sigs.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((s) =>
            conn.getParsedTransaction(s.signature, {
              maxSupportedTransactionVersion: 0,
            })
          )
        );

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          const sig = batch[j];
          if (r.status !== 'fulfilled' || !r.value) continue;

          const tx = r.value;
          const logs = tx.meta?.logMessages || [];
          const timestamp = sig.blockTime || 0;
          if (!timestamp) continue;

          for (const log of logs) {
            const buyMatch = log.match(BUY_RE);
            if (buyMatch) {
              // Use BigInt for large token amounts to avoid precision loss
              const solAmount = Number(buyMatch[1]);
              const baseTokensBig = BigInt(buyMatch[2]);
              if (baseTokensBig > 0n) {
                // price = sol_lamports / raw_tokens — multiply by 1e9 to get lamports/display-token
                // then divide to get lamports per raw token for chart consistency
                const price = baseTokensBig > 0n
                  ? Number((BigInt(buyMatch[1]) * 10_000_000_000n) / baseTokensBig) / 10
                  : 0;
                parsed.push({
                  timestamp,
                  price,
                  volume: solAmount,
                  type: 'buy',
                });
              }
              break;
            }

            const sellMatch = log.match(SELL_RE);
            if (sellMatch) {
              const tokenAmountBig = BigInt(sellMatch[1]);
              const solGross = Number(sellMatch[2]);
              if (tokenAmountBig > 0n) {
                const price = tokenAmountBig > 0n
                  ? Number((BigInt(sellMatch[2]) * 10_000_000_000n) / tokenAmountBig) / 10
                  : 0;
                parsed.push({
                  timestamp,
                  price,
                  volume: solGross,
                  type: 'sell',
                });
              }
              break;
            }
          }
        }
      }

      setTrades(parsed);
    } catch (err) {
      console.warn('useTradeCandles fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [launchPda]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const candles = aggregateCandles(trades, interval);

  return {
    candles,
    loading,
    refresh: fetchTrades,
    interval,
    setInterval: setInterval_,
  };
}
