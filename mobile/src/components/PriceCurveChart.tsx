import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

interface Props {
  pMax: number;          // starting price (lamports) at 0% supply sold
  pMin: number;          // ending price (lamports) at 100% supply sold
  tokenSupply: number;   // total base token supply (raw, 9 decimals)
  totalBaseSold: number; // base tokens sold so far (raw, 9 decimals)
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 220;
const PAD = { top: 20, bottom: 40, left: 20, right: 20 };
const PLOT_W = SCREEN_WIDTH - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;

export default function PriceCurveChart({ pMax, pMin, tokenSupply, totalBaseSold }: Props) {
  const data = useMemo(() => {
    const progress = tokenSupply > 0 ? Math.min(1, totalBaseSold / tokenSupply) : 0;
    // Inverted: price starts at pMax (0% sold) and decreases to pMin (100% sold)
    const currentPrice = pMax - (pMax - pMin) * progress;

    // X: 0% sold (left) → 100% sold (right)
    const mapX = (pct: number) => PAD.left + pct * PLOT_W;
    // Y: pMax at top, pMin at bottom (inverted axis — higher price = higher on chart)
    const mapY = (p: number) => PAD.top + ((pMax - p) / ((pMax - pMin) || 1)) * PLOT_H;

    const nowX = mapX(progress);
    const nowY = mapY(currentPrice);
    // Start point: top-left (pMax at 0% sold)
    const startX = mapX(0);
    const startY = mapY(pMax);
    // End point: bottom-right (pMin at 100% sold)
    const endX = mapX(1);
    const endY = mapY(pMin);

    const curvePath = `M ${startX} ${startY} Q ${(startX + endX) / 2} ${startY} ${endX} ${endY}`;

    const horizontalGrid: { y: number }[] = [];
    for (let i = 0; i <= 3; i++) {
      const p = pMin + ((pMax - pMin) * i) / 3;
      horizontalGrid.push({ y: mapY(p) });
    }

    return {
      nowX,
      nowY,
      startX,
      startY,
      endX,
      endY,
      curvePath,
      horizontalGrid,
    };
  }, [pMax, pMin, tokenSupply, totalBaseSold]);

  const { nowX, nowY, startX, startY, endX, endY, curvePath, horizontalGrid } = data;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bonding Curve</Text>
        <Text style={styles.headerValue}>{(pMax / 1e9).toFixed(4)} → {(pMin / 1e9).toFixed(4)} SOL</Text>
      </View>

      <View style={styles.container}>
        <Svg width={SCREEN_WIDTH - 40} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.accent} stopOpacity={0.1} />
              <Stop offset="1" stopColor={COLORS.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Grid lines (incoming UI) */}
          {horizontalGrid.map((line, i) => (
            <Line
              key={i}
              x1={0} y1={line.y} x2={SCREEN_WIDTH - 40} y2={line.y}
              stroke={COLORS.chartGrid}
              strokeWidth={1}
            />
          ))}

          {/* Fill */}
          <Path
            d={`${curvePath} L ${endX - PAD.left} ${CHART_HEIGHT - PAD.bottom} L ${startX - PAD.left} ${CHART_HEIGHT - PAD.bottom} Z`}
            fill="url(#chartFill)"
            transform={`translate(${-PAD.left}, 0)`}
          />

          {/* Curve */}
          <Path
            d={curvePath}
            fill="none"
            stroke={COLORS.accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            transform={`translate(${-PAD.left}, 0)`}
          />

          {/* Current point indicator */}
          <Line
            x1={nowX - PAD.left} y1={0} x2={nowX - PAD.left} y2={CHART_HEIGHT - PAD.bottom}
            stroke={COLORS.textTertiary}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.3}
          />

          {/* Labels (incoming UI) */}
          <SvgText
            x={0} y={CHART_HEIGHT - 10}
            fill={COLORS.textTertiary}
            fontSize={9}
            fontFamily="SpaceGrotesk_700Bold"
            letterSpacing={0.5}
          >
            START
          </SvgText>
          <SvgText
            x={SCREEN_WIDTH - 40} y={CHART_HEIGHT - 10}
            fill={COLORS.accent}
            fontSize={9}
            fontFamily="SpaceGrotesk_700Bold"
            textAnchor="end"
            letterSpacing={0.5}
          >
            GRADUATE
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#17181D',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.textTertiary,
  },
  headerValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
  container: {
    width: '100%',
    height: CHART_HEIGHT,
    overflow: 'hidden',
  },
});
