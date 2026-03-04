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
import { COLORS, SPACING, RADIUS, FONT_SIZE, TYPOGRAPHY } from '../constants/theme';
import { VestigeClient } from '../lib/vestige-client';
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
      const [vaultPda] = VestigeClient.deriveVaultPda(
        new PublicKey(launchPda)
      );

      const sigs = await conn.getSignaturesForAddress(vaultPda, { limit: 20 });

      const parsed: TradeItem[] = [];
      // Fetch in small batches to avoid rate limits
      const BATCH = 5;
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

          for (const log of logs) {
            if (log.includes('Buy:')) {
              type = 'buy';
              const match = log.match(/lamports:\s*(\d+)/);
              if (match) solAmount = parseInt(match[1], 10);
              break;
            }
            if (log.includes('Sell:')) {
              type = 'sell';
              const match = log.match(/lamports:\s*(\d+)/);
              if (match) solAmount = parseInt(match[1], 10);
              break;
            }
          }

          // Fallback: detect by SOL balance changes
          if (!type && tx.meta) {
            const preBalances = tx.meta.preBalances;
            const postBalances = tx.meta.postBalances;
            if (preBalances.length > 0 && postBalances.length > 0) {
              const diff = postBalances[0] - preBalances[0];
              if (diff < -10000) {
                type = 'buy';
                solAmount = Math.abs(diff);
              } else if (diff > 10000) {
                type = 'sell';
                solAmount = diff;
              }
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
        <View style={[styles.indicator, { backgroundColor: isBuy ? COLORS.accent : COLORS.error }]} />
        <Text style={styles.tradeWallet}>{truncateWallet(item.wallet)}</Text>
        <Text
          style={[
            styles.tradeAmount,
            { color: isBuy ? COLORS.accent : COLORS.error },
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
        <ActivityIndicator color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Recent Trades</Text>
        <TouchableOpacity onPress={fetchTrades} activeOpacity={0.7} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {trades.length === 0 ? (
        <Text style={styles.emptyText}>No trades yet</Text>
      ) : (
        <View style={styles.listContainer}>
          {trades.map((item) => (
            <React.Fragment key={item.signature}>
              {renderItem({ item })}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
  },
  refreshBtn: {
    backgroundColor: '#111216',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  refreshText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.accent,
    textTransform: 'uppercase',
  },
  listContainer: {
    backgroundColor: '#17181D',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  tradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.02)',
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  tradeWallet: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  tradeAmount: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginRight: 16,
    letterSpacing: -0.2,
  },
  tradeTime: {
    color: COLORS.textTertiary,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_500Medium',
    minWidth: 56,
    textAlign: 'right',
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
    textAlign: 'center',
    paddingVertical: 48,
    backgroundColor: '#17181D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
});
