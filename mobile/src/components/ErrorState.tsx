import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { RotateCcw, WifiOff } from 'lucide-react-native';

import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';

export function ErrorState({
  title,
  body,
  onRetry,
  compact,
}: {
  title?: string;
  body?: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: compact ? 18 : 32,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.card,
        marginVertical: 8,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accentSoft,
          marginBottom: 10,
        }}
      >
        <WifiOff size={19} color={colors.accent} strokeWidth={2} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
        {title ?? t('s.errTitle')}
      </Text>
      <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 300 }}>
        {body ?? t('s.errBody')}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [
          {
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            borderRadius: 999,
            paddingHorizontal: 18,
            paddingVertical: 10,
            backgroundColor: colors.darkButton,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <RotateCcw size={14} color={colors.darkButtonText} strokeWidth={2.4} />
        <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 13.5 }}>{t('s.errRetry')}</Text>
      </Pressable>
    </View>
  );
}
