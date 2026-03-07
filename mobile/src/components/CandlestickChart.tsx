import React from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, TYPOGRAPHY } from '../constants/theme';
import { Candle } from '../lib/use-trade-candles';

interface Props {
  candles: Candle[];
  loading: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
// Account for 20px horizontal padding on each side in the parent content container
const CHART_WIDTH = SCREEN_WIDTH - 40;
const CHART_HEIGHT = 320;
const PAD = { top: 24, bottom: 36, left: 54, right: 16 };
const PLOT_W = CHART_WIDTH - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;
const VOLUME_HEIGHT = PLOT_H * 0.18;

export default function CandlestickChart({ candles, loading }: Props) {
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading market data...</Text>
      </View>
    );
  }

  if (candles.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="bar-chart-outline" size={48} color={COLORS.divider} />
        <Text style={styles.emptyText}>No trading activity yet</Text>
      </View>
    );
  }

  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || maxPrice * 0.1 || 1;
  const pricePad = priceRange * 0.05;
  const yMin = minPrice - pricePad;
  const yMax = maxPrice + pricePad;

  const maxVolume = Math.max(...candles.map((c) => c.volume), 1);

  const mapY = (price: number) =>
    PAD.top + (1 - (price - yMin) / (yMax - yMin)) * PLOT_H;

  const candleWidth = Math.max(2, Math.min(16, (PLOT_W / candles.length) * 0.7));
  const candleGap = PLOT_W / candles.length;

  const gridLines: { y: number; label: string }[] = [];
  for (let i = 0; i <= 4; i++) {
    const p = yMin + ((yMax - yMin) * i) / 4;
    gridLines.push({ y: mapY(p), label: (p / 1e9).toFixed(6) });
  }

  const timeLabels: { x: number; label: string }[] = [];
  const labelCount = Math.min(candles.length, 5);
  const step = Math.max(1, Math.floor(candles.length / labelCount));
  for (let i = 0; i < candles.length; i += step) {
    const c = candles[i];
    const x = PAD.left + i * candleGap + candleGap / 2;
    const d = new Date(c.timestamp * 1000);
    const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    timeLabels.push({ x, label });
  }

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Background Grid */}
        {gridLines.map((gl, i) => (
          <React.Fragment key={`g${i}`}>
            <Line
              x1={PAD.left} y1={gl.y} x2={CHART_WIDTH - PAD.right} y2={gl.y}
              stroke={COLORS.chartGrid} strokeWidth={1}
            />
            <SvgText
              x={PAD.left - 8} y={gl.y + 3}
              fill={COLORS.textTertiary} fontSize={8} fontFamily="SpaceGrotesk_600SemiBold"
              textAnchor="end"
            >
              {gl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-axis time labels */}
        {timeLabels.map((tl, i) => (
          <SvgText
            key={`t${i}`}
            x={tl.x} y={CHART_HEIGHT - 10}
            fill={COLORS.textTertiary} fontSize={9}
            fontFamily="SpaceGrotesk_600SemiBold"
            textAnchor="middle"
          >
            {tl.label}
          </SvgText>
        ))}

        {/* Volume bars */}
        {candles.map((c, i) => {
          const x = PAD.left + i * candleGap + (candleGap - candleWidth) / 2;
          const barH = (c.volume / maxVolume) * VOLUME_HEIGHT;
          const isGreen = c.close >= c.open;
          return (
            <Rect
              key={`v${i}`}
              x={x}
              y={PAD.top + PLOT_H - barH}
              width={candleWidth}
              height={barH}
              fill={isGreen ? COLORS.success : COLORS.error}
              opacity={0.25}
            />
          );
        })}

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const cx = PAD.left + i * candleGap + candleGap / 2;
          const isGreen = c.close >= c.open;
          const color = isGreen ? COLORS.success : COLORS.error;
          const bodyTop = mapY(Math.max(c.open, c.close));
          const bodyBottom = mapY(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          const wickTop = mapY(c.high);
          const wickBottom = mapY(c.low);

          return (
            <React.Fragment key={`c${i}`}>
              <Line
                x1={cx} y1={wickTop} x2={cx} y2={wickBottom}
                stroke={color} strokeWidth={1.5}
              />
              <Rect
                x={cx - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyH}
                fill={color}
                stroke={color}
                strokeWidth={0.5}
                rx={1}
              />
            </React.Fragment>
          );
        })}
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
  loadingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginTop: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginTop: 8,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
