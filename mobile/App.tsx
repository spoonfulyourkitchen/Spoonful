import React, { Component, useSyncExternalStore, useEffect, useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConvexAuthProvider, useConvexAuth, useQuery } from './src/lib/convex-auth';
import { useLocalTestStage } from './src/lib/local-test';
import { ProfileRefreshGate } from './src/components/ProfileRefreshGate';
import { api } from './src/lib/api';
import { I18nProvider } from './src/lib/i18n';
import { AppNoticeHost } from './src/components/AppNotice';
import { requestNotifications, applyReminders } from './src/lib/notifications';
import { colors, fonts, getThemeId, subscribeTheme, applyTheme, loadStoredThemeId } from './src/theme';
import { hydrateOfflineCaches } from './src/lib/offline';
import { hydrateLocalOnboarded, useLocalOnboarded } from './src/lib/onboarding';
import { hydrateAccountFromServer } from './src/lib/account-sync';
import { hydrateShoppingLocal } from './src/lib/shopping-local';
import { hydrateTrackerLocal } from './src/lib/tracker-local';
import {
  getNutritionProfile,
  goalTagFromOnboarding,
  hydrateNutritionProfile,
  setNutritionProfile,
} from './src/lib/nutrition-profile';
import { readIntroAnswers } from './src/lib/intro-answers';
import { useRecoveryPending } from './src/lib/recovery';
import { navigationRef } from './src/navigation/rootRef';
import { webLinking } from './src/navigation/web-linking';
import type { RootStackParamList } from './src/navigation/types';
import { AppShellProvider } from './src/navigation/Shell';
import { RootTabs } from './src/navigation/RootTabs';
import { VerifyGate } from './src/components/VerifyGate';
import { PhotoCropHost } from './src/components/PhotoCropModal';
import { BarcodeHost } from './src/components/BarcodeHost';
import { useSharedVideoLink } from './src/lib/share-target';
import { navigate } from './src/navigation/rootRef';
import { AnnouncementGate } from './src/components/AnnouncementGate';
import { AdminAlertsGate } from './src/components/AdminAlertsGate';
import { UpdateGate } from './src/components/UpdateGate';
import { TutorialGate } from './src/components/TutorialGate';
import { ReviewGate } from './src/components/ReviewGate';
import { logLoginEvent } from './src/lib/admin-login';
import { hydrateCrashLog, installGlobalErrorHandler, recordError } from './src/lib/crash-log';
import { translate, tryReloadApp } from './src/lib/i18n';

installGlobalErrorHandler();

import { SpoonfulLogoPlain as Logo } from './src/components/Logo';

import { LandingScreen } from './src/screens/LandingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ShoppingScreen } from './src/screens/ShoppingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ThemeScreen } from './src/screens/ThemeScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { RecipeFormScreen } from './src/screens/RecipeFormScreen';
import { CookingScreen } from './src/screens/CookingScreen';
import { AdminScreen } from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function useThemeTick(): void {
  useSyncExternalStore(subscribeTheme, getThemeId, getThemeId);
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Logo size={72} />
      <Text style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 10, letterSpacing: -0.3 }}>spoonful</Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>{translate('common.loading')}</Text>
    </View>
  );
}

class CrashBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Unexpected error' };
  }
  componentDidCatch(error: unknown) {
    recordError('screen', error);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, paddingHorizontal: 28 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>{translate('s.xCrashTitle')}</Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>{translate('s.errBody')}</Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 10 }}>
            {translate('s.xCrashSaved')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => this.setState({ error: null })} style={({ pressed }) => [{ marginTop: 18, borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 22, paddingVertical: 12, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{translate('s.xCrashTryAgain')}</Text>
            </Pressable>
            <Pressable onPress={() => tryReloadApp()} style={({ pressed }) => [{ marginTop: 18, borderRadius: 999, backgroundColor: colors.darkButton, paddingHorizontal: 22, paddingVertical: 12, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>{translate('s.xCrashRestart')}</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

function PublicStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
    </Stack.Navigator>
  );
}

function SignedInStack() {
  useEffect(() => {
    void (async () => {
      const want = await AsyncStorage.getItem('spoonful:want-reminders').catch(() => null);
      if (want === '0') return;
      await requestNotifications().catch(() => {});
      await applyReminders().catch(() => {});
    })();
  }, []);

  
  useSharedVideoLink((url) => {
    navigate('Main', { screen: 'Assistant' } as any);
    void url;
  });

  return (
    <AppShellProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Main">
        <Stack.Screen name="Main" component={RootTabs} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Shopping" component={ShoppingScreen} />
        <Stack.Screen name="Theme" component={ThemeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="RecipeForm" component={RecipeFormScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Cooking" component={CookingScreen} options={{ animation: 'fade' }} />
      </Stack.Navigator>
      {}
      <PhotoCropHost />
      {}
      <BarcodeHost />
    </AppShellProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading, event } = useConvexAuth();
  const localOnboarded = useLocalOnboarded();
  const recoveryPending = useRecoveryPending();
  const profile = useQuery(api.users.currentUser) as any;
  const localTestStage = useLocalTestStage();
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [cachedSession, setCachedSession] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [authWaitOver, setAuthWaitOver] = useState(false);
  const SESSION_KEY = 'spoonful:session';
  
  const loginLogged = React.useRef(false);
  const accountHydrated = React.useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void hydrateOfflineCaches(['mine', 'saved', 'tracker', 'shopping']);
    void hydrateShoppingLocal();
    void hydrateTrackerLocal();
    void hydrateCrashLog();
    void hydrateLocalOnboarded();
    void (async () => {
      await hydrateNutritionProfile();
      const intro = await readIntroAnswers();
      if (!intro?.completedAt) return;
      const stored = getNutritionProfile();
      if ((stored.syncedAt ?? 0) >= intro.completedAt) return;
      setNutritionProfile({
        sex: intro.sex,
        age: intro.age,
        height: intro.height,
        weight: intro.weight,
        activity: intro.activity,
        goal: goalTagFromOnboarding(intro.goal),
        targetWeight: intro.targetWeight || undefined,
        syncedAt: intro.completedAt,
      });
    })();
    AsyncStorage.getItem(SESSION_KEY).then((v) => {
      if (alive) {
        setCachedSession(v === '1');
        setSessionHydrated(true);
      }
    }).catch(() => { if (alive) setSessionHydrated(true); });
    loadStoredThemeId().then((id) => {
      if (alive) {
        applyTheme(id);
        setThemeLoaded(true);
      }
    }).catch(() => {
      if (alive) setThemeLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      accountHydrated.current = null;
      return;
    }
    const id = profile?.id;
    if (!id || accountHydrated.current === id) return;
    accountHydrated.current = id;
    void hydrateAccountFromServer(profile);
  }, [isAuthenticated, profile]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      setCachedSession(true);
      void AsyncStorage.setItem(SESSION_KEY, '1').catch(() => {});
      if (!loginLogged.current) {
        loginLogged.current = true;
        void logLoginEvent();
      }
      return;
    }
    if (event === 'SIGNED_OUT') {
      setCachedSession(false);
      void AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      loginLogged.current = false;
    }
  }, [isAuthenticated, isLoading, event]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setAuthWaitOver(true), 4500);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!themeLoaded || !sessionHydrated || (isLoading && !authWaitOver)) {
    return <Splash />;
  }

  const signedIn = isAuthenticated || cachedSession || localTestStage === 'active';
  if (isAuthenticated && recoveryPending) {
    return <ResetPasswordScreen />;
  }
  if (isAuthenticated && profile && !profile.onboardedAt && !localOnboarded) {
    return <OnboardingScreen />;
  }
  return signedIn ? <SignedInStack key="signed" /> : <PublicStack key="public" />;
}

export default function App() {
  useThemeTick();
  // React Navigation paints its own background between screens. Without this
  // it stays light grey (#f2f2f2) even in a dark theme.
  const baseNavTheme = colors.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.cardBorder,
      primary: colors.accent,
      notification: colors.accent,
    },
  };
  

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={colors.dark ? 'light-content' : 'dark-content'} backgroundColor={colors.header} />
      <I18nProvider>
        <ConvexAuthProvider>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <NavigationContainer theme={navTheme as any} ref={navigationRef} linking={webLinking as any} documentTitle={{ enabled: false }}>
              <CrashBoundary>
                <RootNavigator />
              </CrashBoundary>
            </NavigationContainer>
          </KeyboardAvoidingView>
          {}
          <AppNoticeHost />
          {}
          <VerifyGate />
          {}
          <AnnouncementGate />
          {}
          <UpdateGate />
          {}
          <AdminAlertsGate />
          {}
          <TutorialGate />
          <ReviewGate />
          {}
          <ProfileRefreshGate />
        </ConvexAuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
