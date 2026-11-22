

import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { colors, rgbaHelper } from '../theme';

export function Collapsible({
  title,
  subtitle,
  icon,
  right,
  open,
  onToggle,
  children,
  style,
  tone = 'default',
  bare = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'accent';
  
  bare?: boolean;
}) {
  const accent = tone === 'accent';
  if (bare) {
    return (
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, opacity: pressed ? 0.8 : 1 }, style]}
      >
        {icon}
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: colors.textPrimary }}>
          {title}
        </Text>
        {right ? <View style={{ marginLeft: 6 }}>{right}</View> : null}
        <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 6 }} />
        {open ? <ChevronUp size={17} color={colors.textSecondary} /> : <ChevronDown size={17} color={colors.textSecondary} />}
      </Pressable>
    );
  }
  return (
    <View
      style={[
        {
          marginBottom: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: accent ? rgbaHelper(colors.accent, 0.3) : colors.cardBorder,
          backgroundColor: colors.card,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 13, opacity: pressed ? 0.8 : 1 }]}
      >
        {icon}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: colors.textPrimary }}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
        <View style={{ width: 34, height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 4 }} />
        {open ? <ChevronUp size={17} color={colors.textSecondary} /> : <ChevronDown size={17} color={colors.textSecondary} />}
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{children}</View> : null}
    </View>
  );
}

export default Collapsible;
