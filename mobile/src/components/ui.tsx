import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Search } from 'lucide-react-native';

import { colors, fonts, glassShadow, readableText } from '../theme';

/* ============================================================================
   Spoonful design-system primitives (light glassmorphism).
   Rebuild of the web app's .glass / .glass-card / .solid-card / .glass-input
   / .glass-btn surfaces for React Native.
   ========================================================================== */

type Radius = number | 'full';

function radiusOf(r: Radius): number {
  return r === 'full' ? 999 : r;
}

/* ---------------------------------------------------------------------------
   Glass surface — translucent frosty panel (light) or theme-card (dark).
   RN has no backdrop-blur, so light panels use a translucent white that is
   visually close to bg-white/45 while keeping a white top highlight + border.
   ------------------------------------------------------------------------- */
export function GlassCard({
  children,
  variant = 'glass',
  pad = 16,
  radius = 22,
  style,
}: {
  children: React.ReactNode;
  variant?: 'glass' | 'glassDark' | 'solid';
  pad?: number;
  radius?: Radius;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'solid' ? colors.card
      : variant === 'glassDark' ? (colors.dark ? colors.card : 'rgba(30,41,59,0.9)')
        : colors.dark ? colors.card
          : 'rgba(255,255,255,0.55)';
  const highlight =
    colors.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
  const border =
    colors.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)';
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radiusOf(radius),
          borderWidth: 1,
          borderColor: border,
          borderTopColor: highlight,
          padding: pad,
          overflow: 'hidden',
        },
        glassShadow(variant === 'solid' ? 'sm' : 'md'),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------------------
   Press scale — mimics the web "btn-press" (scale 0.97) on every pressable.
   ------------------------------------------------------------------------- */
export function PressScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  hitSlop,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        { opacity: disabled ? 0.45 : 1 },
        pressed && !disabled ? { transform: [{ scale: 0.97 }] } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ---------------------------------------------------------------------------
   Buttons.
   - variant "dark"   → bg-slate-950 (near-black) like the web auth CTAs
   - variant "accent" → amber/orange fill (theme accent)
   - variant "ghost"  → translucent white with border
   - variant "danger" → rose ghost
   ------------------------------------------------------------------------- */
export function AppButton({
  label,
  onPress,
  disabled,
  busy,
  variant = 'accent',
  icon,
  style,
  labelStyle,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'accent' | 'dark' | 'ghost' | 'danger';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: object;
}) {
  const palettes: Record<string, { bg: string; fg: string; border?: string; pressedBg: string }> = {
    accent: { bg: colors.accent, fg: colors.accentText, pressedBg: colors.darkButtonPressed },
    dark: { bg: colors.darkButton, fg: colors.darkButtonText, pressedBg: colors.darkButtonPressed },
    ghost: { bg: colors.dark ? colors.card : 'rgba(255,255,255,0.6)', fg: colors.textPrimary, border: colors.cardBorder, pressedBg: colors.surfaceMuted },
    danger: { bg: 'rgba(225,29,72,0.1)', fg: colors.rose, border: colors.roseBg, pressedBg: colors.roseBg },
  };
  const p = palettes[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        { opacity: disabled || busy ? 0.5 : 1 },
        pressed && !disabled && !busy ? { transform: [{ scale: 0.97 }] } : null,
        style,
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: pressed ? p.pressedBg : p.bg,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderWidth: p.border ? 1 : 0,
              borderColor: p.border,
            },
            variant === 'dark' && glassShadow('sm'),
            variant === 'accent' && { shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
          ]}
        >
          {busy ? <ActivityIndicator color={p.fg} size="small" /> : icon}
          <Text style={[{ color: p.fg, fontWeight: '700', fontSize: 16 }, labelStyle]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled, style }: { label: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <AppButton label={label} onPress={onPress} disabled={disabled} variant="dark" style={style} />;
}

/* ---------------------------------------------------------------------------
   Chip / pill — fully rounded selectable chip.
   ------------------------------------------------------------------------- */
export function Chip({
  label,
  active,
  onPress,
  onLongPress,
  tone = 'accent',
  icon,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: 'accent' | 'neutral' | 'rose' | 'green';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const activeBg = tone === 'rose' ? colors.rose : tone === 'green' ? colors.success : colors.accent;
  // contrast is picked automatically, so the chip stays readable in every theme
  const activeFg = tone === 'accent' ? colors.accentText : readableText(activeBg);
  const chip = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          borderRadius: 999,
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderWidth: 1,
          borderColor: active ? 'transparent' : colors.cardBorder,
          backgroundColor: active ? activeBg : colors.dark ? colors.card : 'rgba(255,255,255,0.7)',
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? activeFg : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
  if (!onPress) return chip;
  return (
    <PressScale onPress={onPress} onLongPress={onLongPress} hitSlop={4}>
      {chip}
    </PressScale>
  );
}

export const Pill = Chip;

/* ---------------------------------------------------------------------------
   Text field — the web .glass-input look (light surface, accent focus ring).
   ------------------------------------------------------------------------- */
export function TextField(
  props: TextInputProps & { label?: string; icon?: React.ReactNode; inputStyle?: object },
) {
  const { label, icon, inputStyle, style, ...rest } = props;
  return (
    <View style={[{ marginBottom: 14 }, style as StyleProp<ViewStyle>]}>
      {label ? (
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.dark ? colors.card : 'rgba(255,255,255,0.7)', borderColor: colors.cardBorder },
        ]}
      >
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.textPrimary }, inputStyle]}
          {...rest}
        />
      </View>
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  iconRight,
  onIconRightPress,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  iconRight?: React.ReactNode;
  onIconRightPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.dark ? colors.card : 'rgba(255,255,255,0.7)',
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: 14,
          paddingHorizontal: 12,
        },
        style,
      ]}
    >
      <Search color={colors.textSecondary} size={18} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? 'Search'}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary }}
      />
      {iconRight ? (
        <Pressable onPress={onIconRightPress} hitSlop={8}>
          {iconRight}
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------
   Page header (eyebrow + display title + optional subtitle).
   ------------------------------------------------------------------------- */
export function PageHeader({ eyebrow, title, subtitle, style }: { eyebrow?: string; title: string; subtitle?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {eyebrow ? (
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.accent, marginBottom: 5 }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={{ fontSize: 30, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: fonts.display }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 6 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------
   Segmented control (web segmented pill toggle).
   ------------------------------------------------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.dark ? colors.card : 'rgba(255,255,255,0.55)',
        padding: 3,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressScale key={o.value} onPress={() => onChange(o.value)} style={{ flex: 1 }}>
            <View
              style={{
                paddingVertical: 9,
                borderRadius: 9,
                alignItems: 'center',
                backgroundColor: active ? colors.darkButton : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? readableText(colors.darkButton) : colors.textSecondary }}>{o.label}</Text>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------------------
   Empty state block.
   ------------------------------------------------------------------------- */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accentSoft,
          marginBottom: 12,
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>{title}</Text>
      {body ? (
        <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginVertical: 12 }, style]} />;
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Text style={[{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }, style]}>
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------------------
   Value cell inside nutrition grids etc.
   ------------------------------------------------------------------------- */
export function InfoBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: accent ? colors.accent : colors.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
});
