import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';

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
    backgroundColor: '#111216',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },
  value: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.textTertiary,
  },
});
