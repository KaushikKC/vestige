import React from 'react';
import { View, ImageStyle, ViewStyle } from 'react-native';
import VestigeLogoSVG from './VestigeLogoSVG';

interface VestigeLogoProps {
  size?: number;
  /** Logo color (e.g. #3D4B9C). Omit to use default. */
  color?: string;
  style?: ViewStyle | ImageStyle;
}

export default function VestigeLogo({ size = 40, color = '#3D4B9C', style }: VestigeLogoProps) {
  return (
    <View style={style}>
      <VestigeLogoSVG width={size} height={size} color={color} />
    </View>
  );
}

