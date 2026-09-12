import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check, Moon, Sun } from 'lucide-react-native';
import { applyTheme, getThemeId, themes } from '../theme';
import { colors, fonts } from '../theme';
import { Page } from '../navigation/Shell';
import { GlassCard, PageHeader } from '../components/ui';
import { useSyncExternalStore } from 'react';
import { subscribeTheme } from '../theme';

function useThemeId(): string {
  return useSyncExternalStore(subscribeTheme, getThemeId, getThemeId);
}

export function ThemeScreen() {
  const selected = useThemeId();
  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }}>
        <PageHeader
          eyebrow="Personalize"
          title="Choose a theme"
          subtitle="Pick a look that matches your mood. Your choice is saved and stays across sessions."
        />

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={pillRow}>
            <Sun size={15} color={colors.accent} />
            <Text style={{ fontSize: 13, color: colors.textPrimary }}>Light themes</Text>
          </View>
          <View style={pillRow}>
            <Moon size={15} color={colors.accent} />
            <Text style={{ fontSize: 13, color: colors.textPrimary }}>Dark themes</Text>
          </View>
        </View>

        {themes.map((theme) => {
          const active = selected === theme.id;
          return (
            <Pressable key={theme.id} onPress={() => applyTheme(theme.id)} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
              <GlassCard
                pad={14}
                radius={20}
                variant="solid"
                style={[
                  { marginBottom: 12, borderWidth: active ? 2 : 1, borderColor: active ? theme.accent : colors.cardBorder },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
                    {theme.colors.map((c, i) => (
                      <View key={i} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }} />
                    ))}
                  </View>
                  {active ? (
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={15} color={theme.accentText} strokeWidth={3} />
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary, fontFamily: fonts.display }}>{theme.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>{theme.tagline}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <View style={{ height: 34, flex: 0.7, borderRadius: 9, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder }} />
                  <View style={{ width: 30, height: 34, borderRadius: 9, backgroundColor: theme.accent }} />
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </Page>
  );
}

/* 2.0.0 theme fix: rebuilt on every theme change. */
function buildPillRow() {
  return {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6,
  };
}
let pillRow = buildPillRow();
subscribeTheme(() => { pillRow = buildPillRow(); });
