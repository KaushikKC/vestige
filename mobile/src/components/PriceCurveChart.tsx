import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Rect,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface Props {
  pMax: number;
  pMin: number;
  startTime: number;
  endTime: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 320;
const PAD = { top: 24, bottom: 36, left: 54, right: 16 };
const PLOT_W = SCREEN_WIDTH - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;

export default function PriceCurveChart({ pMax, pMin, startTime, endTime }: Props) {
  const data = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const duration = endTime - startTime;
    const elapsed = Math.max(0, Math.min(duration, now - startTime));
    const progress = duration > 0 ? elapsed / duration : 0;
    const currentPrice = pMax - (pMax - pMin) * progress;
    const ended = now >= endTime;
    const notStarted = now < startTime;

    const mapX = (t: number) => PAD.left + ((t - startTime) / (duration || 1)) * PLOT_W;
    const mapY = (p: number) => PAD.top + (1 - (p - pMin) / ((pMax - pMin) || 1)) * PLOT_H;

    const nowX = mapX(Math.min(now, endTime));
    const nowY = mapY(currentPrice);

    // Y-axis grid: 5 evenly spaced prices
    const gridLines: { y: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const p = pMin + ((pMax - pMin) * i) / 4;
      gridLines.push({ y: mapY(p), label: (p / 1e9).toFixed(4) });
    }

    // X-axis time labels
    const timeLabels: { x: number; label: string }[] = [
      { x: PAD.left, label: 'Start' },
      { x: PAD.left + PLOT_W * 0.25, label: '+' + formatDuration(duration * 0.25) },
      { x: PAD.left + PLOT_W * 0.5, label: '+' + formatDuration(duration * 0.5) },
      { x: PAD.left + PLOT_W * 0.75, label: '+' + formatDuration(duration * 0.75) },
      { x: PAD.left + PLOT_W, label: 'End' },
    ];

    // Gradient polygon points (only up to "now")
    const gradientPoints = `${PAD.left},${mapY(pMax)} ${nowX},${nowY} ${nowX},${PAD.top + PLOT_H} ${PAD.left},${PAD.top + PLOT_H}`;

    // Price badge label
    const priceBadgeLabel = (currentPrice / 1e9).toFixed(5) + ' SOL';

    return {
      nowX, nowY, currentPrice, ended, notStarted,
      gridLines, timeLabels, gradientPoints, priceBadgeLabel,
      startY: mapY(pMax), endX: PAD.left + PLOT_W, endY: mapY(pMin),
    };
    // Update roughly every 10 seconds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pMax, pMin, startTime, endTime, Math.floor(Date.now() / 10000)]);

  const {
    nowX, nowY, ended, notStarted,
    gridLines, timeLabels, gradientPoints, priceBadgeLabel,
    startY, endX, endY,
  } = data;

  const active = !ended && !notStarted;

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={CHART_HEIGHT}>
        {/* Background */}
        <Rect x={0} y={0} width={SCREEN_WIDTH} height={CHART_HEIGHT} fill={COLORS.chartArea} />

        {/* Horizontal grid lines + Y-axis labels */}
        {gridLines.map((gl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD.left} y1={gl.y} x2={PAD.left + PLOT_W} y2={gl.y}
              stroke={COLORS.chartGrid} strokeWidth={0.5}
            />
            <SvgText
              x={PAD.left - 6} y={gl.y + 3}
              fill="rgba(255, 255, 255, 0.6)" fontSize={9} fontFamily="monospace"
              textAnchor="end"
            >
              {gl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Vertical time grid lines */}
        {timeLabels.map((tl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={tl.x} y1={PAD.top} x2={tl.x} y2={PAD.top + PLOT_H}
              stroke={COLORS.chartGrid} strokeWidth={0.5} strokeDasharray="4,4"
            />
            <SvgText
              x={tl.x} y={CHART_HEIGHT - 8}
              fill="rgba(255, 255, 255, 0.6)" fontSize={9}
              textAnchor="middle"
            >
              {tl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Gradient fill (up to now) */}
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {active && (
          <Polygon points={gradientPoints} fill="url(#areaGrad)" />
        )}

        {/* Solid past line */}
        <Line
          x1={PAD.left} y1={startY}
          x2={active ? nowX : endX} y2={active ? nowY : endY}
          stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round"
        />

        {/* Dashed future line */}
        {active && (
          <Line
            x1={nowX} y1={nowY} x2={endX} y2={endY}
            stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round"
            strokeDasharray="6,4" opacity={0.3}
          />
        )}

        {/* "Now" vertical dashed line */}
        {active && (
          <Line
            x1={nowX} y1={PAD.top} x2={nowX} y2={PAD.top + PLOT_H}
            stroke="#FFFFFF" strokeWidth={0.8} strokeDasharray="4,4"
            opacity={0.3}
          />
        )}

        {/* Current price dot */}
        {active && (
          <>
            <Circle cx={nowX} cy={nowY} r={8} fill="#FFFFFF" opacity={0.3} />
            <Circle cx={nowX} cy={nowY} r={5} fill="#FFFFFF" />
            <Circle cx={nowX} cy={nowY} r={3} fill="#000000" />
          </>
        )}

        {/* Price badge */}
        {active && (
          <>
            <Rect
              x={Math.min(SCREEN_WIDTH - 110, Math.max(PAD.left, nowX - 45))}
              y={nowY - 26}
              width={90} height={18} rx={9}
              fill={COLORS.text}
            />
            <SvgText
              x={Math.min(SCREEN_WIDTH - 65, Math.max(PAD.left + 45, nowX))}
              y={nowY - 14}
              fill="#FFFFFF" fontSize={9} fontFamily="monospace"
              textAnchor="middle"
            >
              {priceBadgeLabel}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const d = Math.floor(seconds / 86400);
  if (d >= 1) return `${d}d`;
  return `${h}h`;
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CHART_HEIGHT,
  },
});
