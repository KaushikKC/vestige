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
  pMax: number;
  pMin: number;
  startTime: number;
  endTime: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 220;
const PAD = { top: 20, bottom: 40, left: 20, right: 20 };
const PLOT_W = SCREEN_WIDTH - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;

export default function PriceCurveChart({ pMax, pMin, startTime, endTime }: Props) {
  const data = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const duration = endTime - startTime;
    const elapsed = Math.max(0, Math.min(duration, now - startTime));
    const progress = duration > 0 ? elapsed / duration : 0;
    const currentPrice = pMax - (pMax - pMin) * progress;

    const mapX = (t: number) => PAD.left + ((t - startTime) / (duration || 1)) * PLOT_W;
    const mapY = (p: number) => PAD.top + (1 - (p - pMin) / ((pMax - pMin) || 1)) * PLOT_H;

    const nowX = mapX(Math.min(now, endTime));
    const nowY = mapY(currentPrice);

    const startX = PAD.left;
    const startY = mapY(pMax);
    const endX = PAD.left + PLOT_W;
    const endY = mapY(pMin);

    const curvePath = `M ${startX} ${startY} Q ${(startX + endX) / 2} ${startY} ${endX} ${endY}`;

    const horizontalGrid = [];
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
  }, [pMax, pMin, startTime, endTime]);

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

          {/* Grid lines */}
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

          {/* Labels */}
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
