import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Connection, PublicKey } from '@solana/web3.js';
import { COLORS, SPACING, RADIUS, FONT_SIZE, TYPOGRAPHY } from '../constants/theme';
import { VestigeClient, TOKEN_PRECISION } from '../lib/vestige-client';
import { RPC_ENDPOINT, CONNECTION_CONFIG } from '../constants/solana';

interface HolderDistributionProps {
  launchPda: string;
  tokenMint: string;
  totalSupply: number;
}

interface HolderItem {
  owner: string;
  amount: number;
  pct: number;
  isVault: boolean;
}

function truncateWallet(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

export default function HolderDistribution({
  launchPda,
  tokenMint,
  totalSupply,
}: HolderDistributionProps) {
  const [holders, setHolders] = useState<HolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHolders = useCallback(async () => {
    setLoading(true);
    try {
      const conn = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
      const mint = new PublicKey(tokenMint);
      const [vaultPda] = VestigeClient.deriveVaultPda(
        new PublicKey(launchPda)
      );
      const vaultStr = vaultPda.toBase58();

      const result = await conn.getTokenLargestAccounts(mint);
      const accounts = result.value.slice(0, 10);

      const items: HolderItem[] = [];
      for (const acct of accounts) {
        const amount = parseFloat(acct.amount);
        if (amount === 0) continue;

        let owner = acct.address.toBase58();
        try {
          const info = await conn.getParsedAccountInfo(acct.address);
          if (info.value && 'parsed' in info.value.data) {
            owner = info.value.data.parsed?.info?.owner || owner;
          }
        } catch {
          // fallback
        }

        const pct = totalSupply > 0 ? (amount / totalSupply) * 100 : 0;
        items.push({
          owner,
          amount,
          pct,
          isVault: owner === vaultStr,
        });
      }

      items.sort((a, b) => b.amount - a.amount);
      setHolders(items);
    } catch (err) {
      console.warn('HolderDistribution fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [launchPda, tokenMint, totalSupply]);

  useEffect(() => {
    fetchHolders();
  }, [fetchHolders]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading holders...</Text>
      </View>
    );
  }

  const maxPct = holders.length > 0 ? holders[0].pct : 100;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Holder Distribution</Text>
      </View>

      <View style={styles.listContainer}>
        {holders.length === 0 ? (
          <Text style={styles.emptyText}>No holders found</Text>
        ) : (
          holders.map((h, i) => (
            <View key={h.owner + i} style={[styles.holderRow, i === holders.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.holderInfo}>
                <View style={styles.labelRow}>
                  <Text
                    style={[
                      styles.holderWallet,
                      h.isVault && styles.vaultWallet,
                    ]}
                  >
                    {h.isVault ? 'Bonding Curve' : truncateWallet(h.owner)}
                  </Text>
                  <Text style={styles.pctText}>{h.pct.toFixed(1)}%</Text>
                </View>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${Math.max((h.pct / maxPct) * 100, 2)}%`,
                        backgroundColor: h.isVault ? COLORS.text : COLORS.accent,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.textTertiary,
  },
  listContainer: {
    backgroundColor: '#17181D',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  holderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  rank: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    width: 28,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  holderInfo: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  holderWallet: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  vaultWallet: {
    color: COLORS.accent,
  },
  barContainer: {
    height: 4,
    backgroundColor: '#0C0D10',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  pctText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
