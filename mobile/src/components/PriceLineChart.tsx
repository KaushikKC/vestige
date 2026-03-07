import React from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS, TYPOGRAPHY } from '../constants/theme';
import { Candle } from '../lib/use-trade-candles';

interface Props {
  candles: Candle[];
  loading: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
// Same as CandlestickChart — fits inside content paddingHorizontal: 20 each side
const CHART_WIDTH = SCREEN_WIDTH - 40;
const CHART_HEIGHT = 320;
const PAD = { top: 28, bottom: 36, left: 56, right: 16 };
const PLOT_W = CHART_WIDTH - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;

export default function PriceLineChart({ candles, loading }: Props) {
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
        <Text style={styles.emptyText}>Loading market data...</Text>
      </View>
    );
  }

  if (candles.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="trending-down-outline" size={48} color={COLORS.divider} />
        <Text style={styles.emptyText}>No trades yet</Text>
        <Text style={styles.emptyHint}>Price chart will appear after the first trade</Text>
      </View>
    );
  }

  // Y-axis bounds from actual trade highs/lows
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const priceRange = maxP - minP || maxP * 0.1 || 1;
  const yPad = priceRange * 0.12;
  const yMin = minP - yPad;
  const yMax = maxP + yPad;

  const mapY = (p: number) => PAD.top + (1 - (p - yMin) / (yMax - yMin)) * PLOT_H;
  const mapX = (i: number) =>
    PAD.left + (candles.length === 1 ? PLOT_W / 2 : (i / (candles.length - 1)) * PLOT_W);

  // Points: use close price per candle
  const pts = candles.map((c, i) => ({ x: mapX(i), y: mapY(c.close), c }));

  // Line path
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Fill under the line
  const fillPath =
    pts.length > 1
      ? `${linePath} L ${pts[pts.length - 1].x} ${PAD.top + PLOT_H} L ${pts[0].x} ${
          PAD.top + PLOT_H
        } Z`
      : null;

  const last = pts[pts.length - 1];
  const lastCandle = candles[candles.length - 1];
  // Green if price went up (close > open), red if it went down
  const isUp = lastCandle.close >= lastCandle.open;
  const lineColor = isUp ? COLORS.success : COLORS.error;

  // Grid lines (horizontal)
  const gridLines: { y: number; label: string }[] = [];
  for (let i = 0; i <= 4; i++) {
    const p = yMin + ((yMax - yMin) * i) / 4;
    gridLines.push({ y: mapY(p), label: (p / 1e9).toFixed(5) });
  }

  // X-axis time labels
  const timeLabels: { x: number; label: string }[] = [];
  const labelStep = Math.max(1, Math.floor(candles.length / 4));
  for (let i = 0; i < candles.length; i += labelStep) {
    const d = new Date(candles[i].timestamp * 1000);
    timeLabels.push({
      x: mapX(i),
      label: `${d.getHours().toString().padStart(2, '0')}:${d
        .getMinutes()
        .toString()
        .padStart(2, '0')}`,
    });
  }

  const labelOnLeft = last.x > CHART_WIDTH * 0.65;

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.18} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {gridLines.map((gl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD.left}
              y1={gl.y}
              x2={CHART_WIDTH - PAD.right}
              y2={gl.y}
              stroke={COLORS.chartGrid}
              strokeWidth={1}
            />
            <SvgText
              x={PAD.left - 6}
              y={gl.y + 3}
              fill={COLORS.textTertiary}
              fontSize={8}
              fontFamily="SpaceGrotesk_600SemiBold"
              textAnchor="end"
            >
              {gl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-axis time labels */}
        {timeLabels.map((tl, i) => (
          <SvgText
            key={i}
            x={tl.x}
            y={CHART_HEIGHT - 8}
            fill={COLORS.textTertiary}
            fontSize={9}
            fontFamily="SpaceGrotesk_600SemiBold"
            textAnchor="middle"
          >
            {tl.label}
          </SvgText>
        ))}

        {/* Gradient fill under line */}
        {fillPath && <Path d={fillPath} fill="url(#priceFill)" />}

        {/* Price line */}
        <Path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Vertical dashed line at latest point */}
        <Line
          x1={last.x}
          y1={PAD.top}
          x2={last.x}
          y2={PAD.top + PLOT_H}
          stroke={lineColor}
          strokeWidth={1}
          strokeDasharray="4,3"
          opacity={0.4}
        />

        {/* Current price dot */}
        <Circle cx={last.x} cy={last.y} r={4} fill={lineColor} />
        <Circle cx={last.x} cy={last.y} r={9} fill={lineColor} opacity={0.15} />

        {/* Current price label */}
        <SvgText
          x={labelOnLeft ? last.x - 10 : last.x + 10}
          y={Math.max(last.y - 10, PAD.top + 12)}
          fill={lineColor}
          fontSize={10}
          fontFamily="SpaceGrotesk_700Bold"
          textAnchor={labelOnLeft ? 'end' : 'start'}
        >
          {(lastCandle.close / 1e9).toFixed(6)} SOL
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    backgroundColor: 'transparent',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginTop: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  emptyHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_500Medium',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
