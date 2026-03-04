import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Connection, PublicKey } from '@solana/web3.js';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
import { RPC_ENDPOINT, CONNECTION_CONFIG } from '../constants/solana';

interface TradeFeedProps {
  launchPda: string;
  tokenMint: string;
}

interface TradeItem {
  signature: string;
  type: 'buy' | 'sell';
  wallet: string;
  solAmount: number;
  timestamp: number;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncateWallet(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

export default function TradeFeed({ launchPda }: TradeFeedProps) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const conn = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
      // Use the launch PDA directly — it's written in every buy/sell tx and reliably indexed
      const sigs = await conn.getSignaturesForAddress(new PublicKey(launchPda), { limit: 20 });

      const parsed: TradeItem[] = [];
      // Fetch in small batches to avoid rate limits
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

          let type: 'buy' | 'sell' | null = null;
          let solAmount = 0;

          // Log format: "Buy: 500000000 lamports (net 495000000 after fees) -> ..."
          // Log format: "Sell: 990000000 tokens -> 500000000 lamports (net 495000000 after fees)"
          for (const log of logs) {
            const buyMatch = log.match(/Buy:\s*(\d+)\s*lamports/);
            if (buyMatch) {
              type = 'buy';
              solAmount = Number(buyMatch[1]);
              break;
            }
            const sellMatch = log.match(/Sell:\s*\d+\s*tokens\s*->\s*(\d+)\s*lamports/);
            if (sellMatch) {
              type = 'sell';
              solAmount = Number(sellMatch[1]);
              break;
            }
          }

          if (type) {
            const wallet =
              tx.transaction.message.accountKeys[0]?.pubkey?.toBase58() || '';
            parsed.push({
              signature: sig.signature,
              type,
              wallet,
              solAmount,
              timestamp: sig.blockTime || 0,
            });
          }
        }
      }

      setTrades(parsed);
    } catch (err) {
      console.warn('TradeFeed fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [launchPda]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const renderItem = ({ item }: { item: TradeItem }) => {
    const isBuy = item.type === 'buy';
    return (
      <View style={styles.tradeItem}>
        <Text style={[styles.tradeIcon, { color: isBuy ? COLORS.success : COLORS.error }]}>
          {isBuy ? '\u25CF' : '\u25CF'}
        </Text>
        <Text style={styles.tradeWallet}>{truncateWallet(item.wallet)}</Text>
        <Text
          style={[
            styles.tradeAmount,
            { color: isBuy ? COLORS.success : COLORS.error },
          ]}
        >
          {isBuy ? '+' : '-'}
          {(item.solAmount / 1e9).toFixed(4)} SOL
        </Text>
        <Text style={styles.tradeTime}>{timeAgo(item.timestamp)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading trades...</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>TRADES</Text>
        <TouchableOpacity onPress={fetchTrades} activeOpacity={0.7}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {trades.length === 0 ? (
        <Text style={styles.emptyText}>No trades yet</Text>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={(item) => item.signature}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  refreshText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  tradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  tradeIcon: {
    fontSize: 10,
    marginRight: SPACING.sm,
  },
  tradeWallet: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  tradeAmount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginRight: SPACING.sm,
  },
  tradeTime: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    minWidth: 48,
    textAlign: 'right',
  },
  loadingWrap: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
