import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Bookmark, ChefHat, Flame, Library, Plus, Sparkles, UsersRound } from 'lucide-react-native';
import { useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { GlassCard } from '../components/ui';
import { useCachedList, OfflineBadge } from '../lib/offline';
import { useTranslation } from '../lib/i18n';

function greeting(t: (k: string) => string) {
  const h = new Date().getHours();
  return h < 12 ? t('dashboard.greeting1') : h < 17 ? t('dashboard.greeting2') : t('dashboard.greeting3');
}
function suggestion(t: (k: string) => string) {
  const h = new Date().getHours();
  const month = new Date().getMonth();
  const title = t('s.dashSub');
  if (h < 10) return { title, hint: t('dashboard.suffix1') };
  if (h < 14) return { title, hint: t('dashboard.suffix2') };
  if (h < 18) return { title, hint: t('dashboard.suffix3') };
  if (month === 11 || month <= 1) return { title, hint: t('dashboard.suffix3') };
  return { title, hint: t('dashboard.suffix3') };
}

/** Stable day bucket for a timestamp; '' for missing/invalid values. */
function dayKey(ts: unknown): string {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(0, 0, 0, 0);
  return String(d.getTime());
}

export function DashboardScreen() {
  const { t } = useTranslation();
  const user = useQuery(api.users.currentUser);
  const mineLive = useQuery(api.recipes.list);
  const { data: mineData, offline } = useCachedList('mine', mineLive);
  const savedLive = useQuery(api.savedRecipes.list);
  const { data: savedData } = useCachedList('saved', savedLive);
  const entriesLive = useQuery(api.calorieEntries.list);
  const { data: entriesData } = useCachedList('tracker', entriesLive);
  const mine: any[] = mineData ?? [];
  const saved: any[] = savedData ?? [];
  const entries: any[] = entriesData ?? [];
  const name = user?.name?.split(' ')[0] || 'Chef';
  const sug = suggestion(t);
  const todayCal = entries
    .filter((e: any) => dayKey(e.eatenAt) === dayKey(Date.now()))
    .reduce((s: number, e: any) => s + (Number(e.calories) || 0), 0);
  const kcalGoal = 2200;
  const kcalPct = kcalGoal > 0 ? Math.max(0, Math.min(100, Math.round((todayCal / kcalGoal) * 100))) : 0;
  const remaining = Math.max(0, kcalGoal - todayCal);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = dayKey(Date.now() - i * 86400000);
    if (!d) break;
    if (!entries.some((e: any) => dayKey(e.eatenAt) === d && (Number(e.calories) || 0) > 0)) break;
    streak++;
  }

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.accent, marginBottom: 5 }}>
          {greeting(t)}, {name}
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>{t('landing.tagline')}</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 5 }}>{t('s.dashSub')}</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Stat icon={<ChefHat size={18} color={colors.accent} />} value={`${mine.length}`} label={t('s.mineTitle')} />
          <Stat icon={<Bookmark size={18} color={colors.accent} />} value={`${saved.length}`} label={t('s.dashSaved')} />
          <Stat icon={<Flame size={18} color={colors.accent} />} value={`${todayCal}`} label={t('s.dashKcalToday')} />
        </View>

        {offline ? <OfflineBadge style={{ marginTop: 10 }} /> : null}

        {todayCal > 0 ? (
          <GlassCard pad={14} radius={20} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>Daily goal · {kcalGoal} kcal</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: kcalPct >= 100 ? colors.rose : colors.success }}>
                {remaining > 0 ? `${remaining} left` : 'Goal reached'}
                {streak > 1 ? ` · 🔥${streak}` : ''}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, marginTop: 8, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${kcalPct}%`, borderRadius: 4, backgroundColor: kcalPct >= 100 ? colors.rose : colors.accent }} />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard pad={16} radius={22} style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{sug.title}</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{sug.hint}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable onPress={() => navigate('Main', { screen: 'Library' })} style={quickPill}>
              <Library size={14} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{t('s.dashBrowse')}</Text>
            </Pressable>
            <Pressable onPress={() => navigate('Main', { screen: 'Assistant' })} style={quickPill}>
              <Sparkles size={14} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{t('s.dashAskAi')}</Text>
            </Pressable>
          </View>
        </GlassCard>

        <Text style={label}>{t('s.dashQuick')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <QuickLink icon={<ChefHat size={17} color={colors.accent} />} label={t('s.mineTitle')} onPress={() => navigate('Main', { screen: 'MyRecipes' })} />
          <QuickLink icon={<Flame size={17} color={colors.accent} />} label={t('s.dashTracker')} onPress={() => navigate('Main', { screen: 'Tracker' })} />
          <QuickLink icon={<UsersRound size={17} color={colors.accent} />} label={t('s.dashCommunity')} onPress={() => navigate('Community')} />
          <QuickLink icon={<Bookmark size={17} color={colors.accent} />} label={t('s.dashSaved')} onPress={() => navigate('Main', { screen: 'Saved' })} />
        </View>

        <Text style={label}>{t('onboarding.gettingStarted')}</Text>
        <GlassCard pad={14} radius={20}>
          <CheckRow done={(mine?.length ?? 0) > 0} label={t('s.dashFirstRecipe')} onPress={() => navigate('RecipeForm', {})} icon={<Plus size={15} color={colors.accent} />} />
          <CheckRow done={(saved?.length ?? 0) > 0} label={t('s.dashSaveFromLibrary')} onPress={() => navigate('Main', { screen: 'Library' })} icon={<Bookmark size={15} color={colors.accent} />} />
          <CheckRow done={false} label={t('s.dashTryAi')} onPress={() => navigate('Main', { screen: 'Assistant' })} icon={<Sparkles size={15} color={colors.accent} />} />
        </GlassCard>
      </ScrollView>
    </Page>
  );
}

/* 2.0.0 theme fix: rebuilt on every theme change. */
function buildDashboardStyles() {
  return {
    label: {
      fontSize: 11, fontWeight: '700' as const, color: colors.textSecondary,
      textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 20, marginBottom: 8,
    },
    quickPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      borderRadius: 999, backgroundColor: colors.accentSoft,
      paddingHorizontal: 12, paddingVertical: 7,
    },
  };
}
let dashboardStyles = buildDashboardStyles();
let label = dashboardStyles.label;
let quickPill = dashboardStyles.quickPill;
subscribeTheme(() => {
  dashboardStyles = buildDashboardStyles();
  label = dashboardStyles.label;
  quickPill = dashboardStyles.quickPill;
});

function Stat({ icon, value, label: l }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <GlassCard pad={12} radius={18} style={{ flex: 1, alignItems: 'center' }}>
      {icon}
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 6 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{l}</Text>
    </GlassCard>
  );
}

function QuickLink({ icon, label: l, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 11, opacity: pressed ? 0.7 : 1 }]}>
      {icon}
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.textPrimary }}>{l}</Text>
    </Pressable>
  );
}

function CheckRow({ done, label: l, onPress, icon }: { done: boolean; label: string; onPress: () => void; icon: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
      <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: done ? colors.success : colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {done ? <Text style={{ color: readableText(colors.success), fontWeight: '800' }}>✓</Text> : icon}
      </View>
      <Text style={{ fontSize: 14, color: done ? colors.textSecondary : colors.textPrimary, textDecorationLine: done ? 'line-through' : 'none', fontWeight: '500' }}>
        {l}
      </Text>
    </Pressable>
  );
}
