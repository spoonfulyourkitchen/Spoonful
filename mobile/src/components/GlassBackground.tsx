import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, usesSolidStyle } from '../theme';

const WashLayers = React.memo(function WashLayers({
  mint,
  sky,
  amber,
  soft,
  washOpacity,
  amberOpacity,
}: {
  mint: string;
  sky: string;
  amber: string;
  soft: string;
  washOpacity: number;
  amberOpacity: number;
}) {
  return (
    <Svg pointerEvents="none" style={StyleSheet_absolute}>
      <Defs>
        <RadialGradient id="wash1" cx="15%" cy="12%" r="75%" fx="15%" fy="12%">
          <Stop offset="0" stopColor={mint} stopOpacity={0.55 * washOpacity} />
          <Stop offset="0.6" stopColor={mint} stopOpacity={0.1 * washOpacity} />
          <Stop offset="1" stopColor={mint} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="wash2" cx="88%" cy="90%" r="80%" fx="88%" fy="90%">
          <Stop offset="0" stopColor={sky} stopOpacity={0.6 * washOpacity} />
          <Stop offset="0.6" stopColor={sky} stopOpacity={0.12 * washOpacity} />
          <Stop offset="1" stopColor={sky} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="wash3" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={amber} stopOpacity={amberOpacity} />
          <Stop offset="0.55" stopColor={amber} stopOpacity={0.12 * amberOpacity} />
          <Stop offset="1" stopColor={amber} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="wash4" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={soft} stopOpacity={0.22 * washOpacity} />
          <Stop offset="0.7" stopColor={soft} stopOpacity={0.05 * washOpacity} />
          <Stop offset="1" stopColor={soft} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash1)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#wash2)" />
      <Rect x="-18%" y="-10%" width="45%" height="45%" fill="url(#wash3)" />
      <Rect x="62%" y="42%" width="60%" height="60%" fill="url(#wash4)" />
    </Svg>
  );
});

export function WashBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const washOpacity = colors.dark ? 0.14 : 1;
  const amberOpacity = colors.dark ? 0.1 : 0.3;
  const mint = colors.dark ? '#134e4a' : '#a7f3d0';
  const sky = colors.dark ? '#155e75' : '#bae6fd';
  const amber = colors.dark ? '#b45309' : '#fde68a';
  const soft = colors.dark ? '#7c3aed' : '#f3e8ff';
  

  const plain = usesSolidStyle();

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }, style]}>
      {plain ? null : (
        <WashLayers
          mint={mint}
          sky={sky}
          amber={amber}
          soft={soft}
          washOpacity={washOpacity}
          amberOpacity={amberOpacity}
        />
      )}
      {children}
    </View>
  );
}

const StyleSheet_absolute: any = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
