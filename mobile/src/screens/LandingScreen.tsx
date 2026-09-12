import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight, Bookmark, ChefHat, Flame, Globe, Library, ScanLine, Share2, Sparkles, Star, Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import { navigate } from '../navigation/rootRef';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';
import { GlassCard } from '../components/ui';

/**
 * Pre-login dashboard (rebuilt in 2.1.2).
 *
 * Every string comes from the i18n dictionary (`home.*` / `landing.*` /
 * `nav.*`), the layout mirrors itself for RTL, and the new features of the
 * last releases get their own cards: barcode tracking, household shopping,
 * community, AI Chef and the 10 languages.
 */
export function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useTranslation();
  const row = { flexDirection: (rtl ? 'row-reverse' : 'row') as 'row' | 'row-reverse' };
  const align = { textAlign: (rtl ? 'right' : 'left') as 'right' | 'left' };

  const features = [
    { icon: <Library size={19} color={colors.accent} />, title: t('home.f1t'), body: t('home.f1b') },
    { icon: <Sparkles size={19} color={colors.accent} />, title: t('home.f2t'), body: t('home.f2b') },
    { icon: <ScanLine size={19} color={colors.accent} />, title: t('home.f3t'), body: t('home.f3b') },
    { icon: <Users size={19} color={colors.accent} />, title: t('home.f4t'), body: t('home.f4b') },
    { icon: <Share2 size={19} color={colors.accent} />, title: t('home.f5t'), body: t('home.f5b') },
    { icon: <Globe size={19} color={colors.accent} />, title: t('home.f6t'), body: t('home.f6b') },
  ];

  const steps = [
    { n: 1, icon: <ChefHat size={15} color={colors.accentText} />, title: t('landing.createSpace'), body: t('landing.startDesc') },
    { n: 2, icon: <Library size={15} color={colors.accentText} />, title: t('nav.discover'), body: t('library.desc') },
    { n: 3, icon: <Flame size={15} color={colors.accentText} />, title: t('cooking.title'), body: t('tracker.desc') },
  ];

  const legal = [
    { page: 'impressum', label: t('legal.navImprint') },
    { page: 'datenschutz', label: t('legal.navPrivacy') },
    { page: 'cookies', label: t('legal.navCookies') },
    { page: 'agb', label: t('legal.navTerms') },
  ];

  return (
    <WashBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[{ paddingHorizontal: 20, paddingTop: insets.top + 16, alignItems: 'center', gap: 10 }, row]}>
          <Logo size={34} />
          <Text style={{ fontFamily: fonts.display, fontSize: 21, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4 }}>
            spoonful
          </Text>
          <View style={{ flex: 1 }} />
          <View style={{ borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>{t('home.badge')}</Text>
          </View>
        </View>

        {/* hero */}
        <View style={{ paddingHorizontal: 22, paddingTop: 26 }}>
          <Text style={[{ fontSize: 34, fontFamily: fonts.display, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.8, lineHeight: 40 }, align]}>
            {`${t('landing.headline1')} ${t('landing.headline2')}`}
          </Text>
          <Text style={[{ fontSize: 15, lineHeight: 24, color: colors.textSecondary, marginTop: 10 }, align]}>
            {t('landing.headlineDesc')}
          </Text>

          <FeaturePreview />

          <View style={[{ gap: 10, marginTop: 20, flexWrap: 'wrap' }, row]}>
            <Pressable
              onPress={() => navigate('Auth')}
              accessibilityRole="button"
              style={({ pressed }) => [{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.darkButtonText, fontWeight: '700', fontSize: 15.5 }}>{t('landing.getStarted')}</Text>
              <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
                <ArrowRight size={17} color={colors.darkButtonText} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => navigate('Auth')}
              accessibilityRole="button"
              style={({ pressed }) => [{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15.5 }}>{t('landing.signIn')}</Text>
            </Pressable>
          </View>

          {/* stats + social proof */}
          <View style={[{ gap: 8, marginTop: 16, flexWrap: 'wrap' }, row]}>
            <StatPill icon={<Library size={13} color={colors.accent} />} label={t('home.statRecipes')} />
            <StatPill icon={<Globe size={13} color={colors.accent} />} label={t('home.statCountries')} />
            <StatPill icon={<Sparkles size={13} color={colors.accent} />} label={t('home.statLangs')} />
          </View>
          <View style={[{ alignItems: 'center', gap: 6, marginTop: 14 }, row]}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={13} color="#eab308" fill="#eab308" />
            ))}
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('home.trust')}</Text>
          </View>
        </View>

        {/* what's new: feature cards */}
        <View style={{ paddingHorizontal: 20, marginTop: 30 }}>
          <Text style={[{ fontSize: 13, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.accent, marginBottom: 12 }, align]}>
            {t('home.everything')}
          </Text>
          {features.map((f) => (
            <GlassCard key={f.title} pad={15} radius={22} style={{ marginBottom: 10 }}>
              <View style={[{ gap: 12 }, row]}>
                <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                  {f.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 15.5, fontWeight: '700', color: colors.textPrimary }, align]}>{f.title}</Text>
                  <Text style={[{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 3 }, align]}>{f.body}</Text>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>

        {/* how it works */}
        <View style={{ paddingHorizontal: 20, marginTop: 26 }}>
          <Text style={[{ fontSize: 13, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.accent, marginBottom: 12 }, align]}>
            {t('landing.howItWorks')}
          </Text>
          <GlassCard pad={18} radius={24}>
            {steps.map((s) => (
              <View key={s.n} style={[{ gap: 13, marginVertical: 8 }, row]}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  {s.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 15.5, fontWeight: '700', color: colors.textPrimary }, align]}>{s.title}</Text>
                  <Text style={[{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 2 }, align]}>{s.body}</Text>
                </View>
              </View>
            ))}
          </GlassCard>
        </View>

        {/* final CTA */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <GlassCard pad={20} radius={24} variant="solid">
            <Text style={[{ fontSize: 22, fontFamily: fonts.display, fontWeight: '800', color: colors.textPrimary }, align]}>
              {t('landing.startCooking')}
            </Text>
            <Text style={[{ fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 6 }, align]}>
              {t('home.trustworthy')}
            </Text>
            <Pressable
              onPress={() => navigate('Auth')}
              accessibilityRole="button"
              style={({ pressed }) => [{ marginTop: 16, flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 14, backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 15.5 }}>{t('landing.createSpace')}</Text>
              <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
                <ArrowRight size={17} color={colors.accentText} />
              </View>
            </Pressable>
          </GlassCard>
        </View>

        {/* footer / legal */}
        <View style={[{ justifyContent: 'center', gap: 14, marginTop: 30, flexWrap: 'wrap', paddingHorizontal: 20 }, row]}>
          {legal.map((l) => (
            <Pressable key={l.page} onPress={() => navigate('Legal', { page: l.page as any })}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 11.5, color: colors.textMuted, textAlign: 'center', marginTop: 14 }}>
          {'© 2026 Spoonful'}
        </Text>
      </ScrollView>
    </WashBackground>
  );
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 11, paddingVertical: 7 }}>
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
    </View>
  );
}

/**
 * Little illustration instead of a screenshot: a stack of mock cards that shows
 * what the app looks like (recipe tile, tracker line, shopping list row).
 */
function FeaturePreview() {
  return (
    <View style={{ marginTop: 20 }}>
      <GlassCard pad={14} radius={22}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ width: 74, height: 74, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={26} color={colors.accent} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 11, width: '78%', borderRadius: 6, backgroundColor: colors.surfaceMuted }} />
            <View style={{ height: 9, width: '56%', borderRadius: 5, backgroundColor: colors.surfaceMuted }} />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
              <View style={{ height: 8, width: 42, borderRadius: 4, backgroundColor: colors.accentSoft }} />
              <View style={{ height: 8, width: 34, borderRadius: 4, backgroundColor: colors.surfaceMuted }} />
            </View>
          </View>
          <Bookmark size={18} color={colors.accent} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          <View style={{ flex: 1, height: 34, borderRadius: 10, backgroundColor: colors.surfaceMuted }} />
          <View style={{ flex: 1, height: 34, borderRadius: 10, backgroundColor: colors.accentSoft }} />
          <View style={{ flex: 1, height: 34, borderRadius: 10, backgroundColor: colors.surfaceMuted }} />
        </View>
      </GlassCard>
    </View>
  );
}

export default LandingScreen;
