import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

interface Stat {
  label: string;
  value: string;
}

interface Props {
  stats: Stat[];
}

export default function CompactStatRow({ stats }: Props) {
  return (
    <View style={styles.row}>
      {stats.map((stat, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.divider} />}
          <View style={styles.col}>
            <Text style={styles.value} numberOfLines={1}>{stat.value}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.xs,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.text,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
});
