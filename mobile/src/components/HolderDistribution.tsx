import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Connection, PublicKey } from '@solana/web3.js';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
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

      // Resolve owners for each token account
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
          // fallback to token account address
        }

        const pct = totalSupply > 0 ? (amount / totalSupply) * 100 : 0;
        items.push({
          owner,
          amount,
          pct,
          isVault: owner === vaultStr,
        });
      }

      // Sort by amount descending
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
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading holders...</Text>
      </View>
    );
  }

  const maxPct = holders.length > 0 ? holders[0].pct : 100;

  return (
    <View>
      <Text style={styles.headerTitle}>TOP HOLDERS</Text>

      {holders.length === 0 ? (
        <Text style={styles.emptyText}>No holders found</Text>
      ) : (
        holders.map((h, i) => (
          <View key={h.owner + i} style={styles.holderRow}>
            <Text style={styles.rank}>{i + 1}.</Text>
            <View style={styles.holderInfo}>
              <Text
                style={[
                  styles.holderWallet,
                  h.isVault && styles.vaultWallet,
                ]}
              >
                {h.isVault ? 'Launch Vault' : truncateWallet(h.owner)}
              </Text>
              <View style={styles.barRow}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.max((h.pct / maxPct) * 100, 2)}%`,
                      backgroundColor: h.isVault
                        ? COLORS.primary
                        : COLORS.accent,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.pctText}>{h.pct.toFixed(1)}%</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  holderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rank: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    width: 24,
  },
  holderInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  holderWallet: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
    fontWeight: '600',
    marginBottom: 4,
  },
  vaultWallet: {
    color: COLORS.primary,
  },
  barRow: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  pctText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
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
