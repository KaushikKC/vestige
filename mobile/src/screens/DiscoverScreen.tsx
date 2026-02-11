import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PublicKey } from '@solana/web3.js';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
import { LaunchData } from '../lib/vestige-client';
import { useVestige } from '../lib/use-vestige';
import LaunchCard from '../components/LaunchCard';
import WalletButton from '../components/WalletButton';
import { DiscoverStackParamList } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'DiscoverList'>;
};

export default function DiscoverScreen({ navigation }: Props) {
  const { getAllLaunches } = useVestige();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pdaInput, setPdaInput] = useState('');

  const fetchLaunches = useCallback(async () => {
    try {
      const data = await getAllLaunches();
      setLaunches(data);
    } catch (err) {
      console.warn('Failed to fetch launches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAllLaunches]);

  useEffect(() => {
    fetchLaunches();
  }, [fetchLaunches]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLaunches();
  }, [fetchLaunches]);

  const goToLaunch = (pda: string) => {
    navigation.navigate('LaunchDetail', { launchPda: pda });
  };

  const handlePdaSearch = () => {
    const trimmed = pdaInput.trim();
    if (!trimmed) return;
    try {
      new PublicKey(trimmed);
      goToLaunch(trimmed);
      setPdaInput('');
    } catch {
      // Invalid public key
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <WalletButton />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Paste Launch PDA..."
          placeholderTextColor={COLORS.textMuted}
          value={pdaInput}
          onChangeText={setPdaInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.goButton} onPress={handlePdaSearch}>
          <Text style={styles.goButtonText}>Go</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={launches}
          keyExtractor={(item) => item.publicKey.toBase58()}
          renderItem={({ item }) => (
            <LaunchCard
              launch={item}
              onPress={() => goToLaunch(item.publicKey.toBase58())}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No launches found</Text>
              <Text style={styles.emptySubtext}>
                Pull to refresh or paste a Launch PDA above
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  goButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  goButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xxl,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
});
