import React from 'react';
import { View, ImageStyle, ViewStyle } from 'react-native';
import VestigeLogoSVG from './VestigeLogoSVG';

interface VestigeLogoProps {
  size?: number;
  style?: ViewStyle | ImageStyle;
}

export default function VestigeLogo({ size = 40, style }: VestigeLogoProps) {
  return (
    <View style={style}>
      <VestigeLogoSVG width={size} height={size} />
    </View>
  );
}

