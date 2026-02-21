import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface VestigeLogoProps {
  size?: number;
  variant?: 'light' | 'dark';
}

export default function VestigeLogo({ size = 40, variant = 'dark' }: VestigeLogoProps) {
  const color = variant === 'light' ? '#FFFFFF' : '#1D04E1';

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Bold V */}
      <Path
        d="M10 10 L24 38 L38 10"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lock: shackle */}
      <Path
        d="M24 22 L24 22 C27.3 22 30 24.7 30 28 L30 34 C30 36.2 28.2 38 26 38 L22 38 C19.8 38 18 36.2 18 34 L18 28 C18 24.7 20.7 22 24 22 Z"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lock: keyhole dot */}
      <Circle cx={24} cy={31} r={2.5} fill={color} />
    </Svg>
  );
}
