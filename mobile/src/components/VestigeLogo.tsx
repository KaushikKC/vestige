import React from 'react';
import { ViewStyle } from 'react-native';
import VestigeLogoSvg from '../../assets/vestige-logo.svg';

interface VestigeLogoProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export default function VestigeLogo({ size = 40, color, style }: VestigeLogoProps) {
  return (
    <VestigeLogoSvg
      width={size}
      height={size}
      style={style}
      {...(color ? { fill: color } : {})}
    />
  );
}
