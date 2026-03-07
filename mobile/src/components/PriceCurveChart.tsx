import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Text as SvgText,
} from "react-native-svg";
import { COLORS, TYPOGRAPHY } from "../constants/theme";

interface Props {
  pMax: number; // starting price (lamports) at 0% SOL raised
  pMin: number; // ending price (lamports) at 100% SOL raised (graduation)
  totalSolCollected: number; // SOL raised so far (lamports)
  graduationTarget: number; // SOL needed to graduate (lamports)
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_HEIGHT = 220;
const PAD = { top: 20, bottom: 40, left: 20, right: 20 };
// SVG lives inside outerContainer (padding:20 each side) which is inside content (paddingHorizontal:20 each side)
// Available width = SCREEN_WIDTH - 20 - 20 (screen margins) - 20 - 20 (outerContainer padding) = SCREEN_WIDTH - 80
const SVG_W = SCREEN_WIDTH - 80;
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = CHART_HEIGHT - PAD.top - PAD.bottom;

export default function PriceCurveChart({
  pMax,
  pMin,
  totalSolCollected,
  graduationTarget,
}: Props) {
  const data = useMemo(() => {
    const T = graduationTarget > 0 ? Math.min(1, totalSolCollected / graduationTarget) : 0;
    const currentPrice = pMax - (pMax - pMin) * T;

    // All coordinates in SVG space (no translate needed)
    // Bezier: P0=(PAD.left,PAD.top), ctrl=(PAD.left+PLOT_W/2,PAD.top), P2=(PAD.left+PLOT_W,PAD.top+PLOT_H)
    // x(t) = PAD.left + t*PLOT_W  (linear)
    // y(t) = PAD.top + t²*PLOT_H  (quadratic)
    const x0 = PAD.left;
    const y0 = PAD.top;
    const xE = PAD.left + PLOT_W;
    const yE = PAD.top + PLOT_H;

    const nowX = PAD.left + T * PLOT_W;
    const nowY = PAD.top + T * T * PLOT_H;

    // Realized bezier [0→T] via De Casteljau subdivision
    const realizedPath =
      T > 0.001
        ? `M ${x0} ${y0} Q ${x0 + (T * PLOT_W) / 2} ${y0} ${nowX} ${nowY}`
        : null;

    // Potential bezier [T→1] via De Casteljau subdivision
    // ctrl = (1-T)*P1 + T*P2, where P1=(PAD.left+PLOT_W/2, PAD.top)
    const potCtrlX = PAD.left + (PLOT_W * (1 + T)) / 2;
    const potCtrlY = PAD.top + T * PLOT_H;
    const potentialPath = `M ${nowX} ${nowY} Q ${potCtrlX} ${potCtrlY} ${xE} ${yE}`;

    // Fill only under the realized portion
    const fillPath =
      T > 0.001
        ? `M ${x0} ${y0} Q ${x0 + (T * PLOT_W) / 2} ${y0} ${nowX} ${nowY} L ${nowX} ${CHART_HEIGHT - PAD.bottom} L ${x0} ${CHART_HEIGHT - PAD.bottom} Z`
        : null;

    const horizontalGrid: { y: number }[] = [];
    for (let i = 0; i <= 3; i++) {
      const p = pMin + ((pMax - pMin) * i) / 3;
      const y = PAD.top + ((pMax - p) / (pMax - pMin || 1)) * PLOT_H;
      horizontalGrid.push({ y });
    }

    return {
      nowX,
      nowY,
      currentPrice,
      realizedPath,
      potentialPath,
      fillPath,
      horizontalGrid,
    };
  }, [pMax, pMin, totalSolCollected, graduationTarget]);

  const {
    nowX,
    nowY,
    currentPrice,
    realizedPath,
    potentialPath,
    fillPath,
    horizontalGrid,
  } = data;
  const priceLabelText = (currentPrice / 1e9).toFixed(6) + " SOL";
  // Anchor label left/right depending on position to avoid clipping
  const labelAnchor = (nowX - PAD.left) > PLOT_W * 0.65 ? "end" : "start";
  const labelX = labelAnchor === "end" ? nowX - 10 : nowX + 10;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bonding Curve</Text>
        <Text style={styles.headerValue}>
          {(pMax / 1e9).toFixed(4)} → {(pMin / 1e9).toFixed(4)} SOL
        </Text>
      </View>

      <View style={styles.container}>
        <Svg width={SVG_W} height={CHART_HEIGHT}>
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
              x1={PAD.left}
              y1={line.y}
              x2={SVG_W - PAD.right}
              y2={line.y}
              stroke={COLORS.chartGrid}
              strokeWidth={1}
            />
          ))}

          {/* Potential (remaining) curve — dim dashed */}
          <Path
            d={potentialPath}
            fill="none"
            stroke={COLORS.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="5,4"
            opacity={0.35}
          />

          {/* Fill under realized portion */}
          {fillPath && (
            <Path d={fillPath} fill="url(#chartFill)" />
          )}

          {/* Realized (traded) curve — bright solid */}
          {realizedPath && (
            <Path
              d={realizedPath}
              fill="none"
              stroke={COLORS.accent}
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          {/* Current point indicator - vertical dashed line */}
          <Line
            x1={nowX}
            y1={0}
            x2={nowX}
            y2={CHART_HEIGHT - PAD.bottom}
            stroke={COLORS.accent}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.5}
          />

          {/* Current price label */}
          <SvgText
            x={labelX}
            y={Math.max(nowY - 10, PAD.top + 4)}
            fill={COLORS.accent}
            fontSize={10}
            fontFamily="SpaceGrotesk_700Bold"
            textAnchor={labelAnchor}
          >
            {priceLabelText}
          </SvgText>

          {/* Current position dot ON the bezier curve */}
          <Circle cx={nowX} cy={nowY} r={5} fill={COLORS.accent} />
          <Circle
            cx={nowX}
            cy={nowY}
            r={9}
            fill={COLORS.accent}
            opacity={0.2}
          />

          {/* Labels (incoming UI) */}
          <SvgText
            x={0}
            y={CHART_HEIGHT - 10}
            fill={COLORS.textTertiary}
            fontSize={9}
            fontFamily="SpaceGrotesk_700Bold"
            letterSpacing={0.5}
          >
            START
          </SvgText>
          <SvgText
            x={SVG_W}
            y={CHART_HEIGHT - 10}
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
    backgroundColor: "#17181D",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontFamily: "SpaceGrotesk_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.textTertiary,
  },
  headerValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 11,
  },
  container: {
    width: "100%",
    height: CHART_HEIGHT,
    overflow: "hidden",
  },
});
