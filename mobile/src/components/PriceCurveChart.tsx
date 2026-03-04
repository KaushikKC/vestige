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
  pMax: number;          // starting price (lamports) at 0% supply sold
  pMin: number;          // ending price (lamports) at 100% supply sold
  tokenSupply: number;   // total base token supply (raw, 9 decimals)
  totalBaseSold: number; // base tokens sold so far (raw, 9 decimals)
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 320;
const PAD = { top: 24, bottom: 36, left: 54, right: 16 };
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

    // Y-axis: 5 price grid lines from pMin to pMax
    const gridLines: { y: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const p = pMin + ((pMax - pMin) * i) / 4;
      gridLines.push({ y: mapY(p), label: (p / 1e9).toFixed(4) });
    }

    // X-axis: supply % labels
    const xLabels = [
      { x: mapX(0), label: '0%' },
      { x: mapX(0.25), label: '25%' },
      { x: mapX(0.5), label: '50%' },
      { x: mapX(0.75), label: '75%' },
      { x: mapX(1), label: '100%' },
    ];

    // Filled area polygon under the sold portion (top-left corner to current position)
    // The sold area goes from (startX, startY) diagonally down to (nowX, nowY),
    // then down to the x-axis baseline, then back left.
    const gradientPoints = [
      `${startX},${startY}`,
      `${nowX},${nowY}`,
      `${nowX},${PAD.top + PLOT_H}`,
      `${startX},${PAD.top + PLOT_H}`,
    ].join(' ');

    const priceBadgeLabel = (currentPrice / 1e9).toFixed(5) + ' SOL';
    const pctLabel = (progress * 100).toFixed(1) + '%';

    return {
      nowX, nowY, startX, startY, endX, endY,
      gridLines, xLabels, gradientPoints,
      priceBadgeLabel, pctLabel, progress,
    };
  }, [pMax, pMin, tokenSupply, totalBaseSold]);

  const {
    nowX, nowY, startX, startY, endX, endY,
    gridLines, xLabels, gradientPoints,
    priceBadgeLabel, pctLabel, progress,
  } = data;

  const hasSales = progress > 0;

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={CHART_HEIGHT}>
        {/* Background */}
        <Rect x={0} y={0} width={SCREEN_WIDTH} height={CHART_HEIGHT} fill={COLORS.chartArea} />

        {/* Horizontal grid lines + Y-axis price labels */}
        {gridLines.map((gl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD.left} y1={gl.y} x2={PAD.left + PLOT_W} y2={gl.y}
              stroke={COLORS.chartGrid} strokeWidth={0.5}
            />
            <SvgText
              x={PAD.left - 6} y={gl.y + 3}
              fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily="monospace"
              textAnchor="end"
            >
              {gl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Vertical supply% grid lines + X-axis labels */}
        {xLabels.map((xl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={xl.x} y1={PAD.top} x2={xl.x} y2={PAD.top + PLOT_H}
              stroke={COLORS.chartGrid} strokeWidth={0.5} strokeDasharray="4,4"
            />
            <SvgText
              x={xl.x} y={CHART_HEIGHT - 8}
              fill="rgba(255,255,255,0.6)" fontSize={9}
              textAnchor="middle"
            >
              {xl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Gradient fill under sold portion of curve */}
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {hasSales && (
          <Polygon points={gradientPoints} fill="url(#areaGrad)" />
        )}

        {/* Solid line: 0% → current% (sold portion, descending) */}
        <Line
          x1={startX} y1={startY}
          x2={hasSales ? nowX : startX} y2={hasSales ? nowY : startY}
          stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round"
        />

        {/* Dashed line: current% → 100% (future potential, continuing descent) */}
        <Line
          x1={hasSales ? nowX : startX} y1={hasSales ? nowY : startY}
          x2={endX} y2={endY}
          stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round"
          strokeDasharray="6,4" opacity={0.3}
        />

        {/* Current position vertical dashed line */}
        {hasSales && (
          <Line
            x1={nowX} y1={PAD.top} x2={nowX} y2={PAD.top + PLOT_H}
            stroke="#FFFFFF" strokeWidth={0.8} strokeDasharray="4,4" opacity={0.3}
          />
        )}

        {/* Current price dot */}
        {hasSales && (
          <>
            <Circle cx={nowX} cy={nowY} r={8} fill="#FFFFFF" opacity={0.3} />
            <Circle cx={nowX} cy={nowY} r={5} fill="#FFFFFF" />
            <Circle cx={nowX} cy={nowY} r={3} fill="#000000" />
          </>
        )}

        {/* Price badge */}
        {hasSales && (
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
              {priceBadgeLabel} · {pctLabel}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CHART_HEIGHT,
  },
});
