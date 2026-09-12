import React, { Component, useSyncExternalStore, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConvexAuthProvider, useConvexAuth, useQuery } from './src/lib/convex-auth';
import { api } from './src/lib/api';
import { I18nProvider } from './src/lib/i18n';
import { requestNotifications, applyReminders } from './src/lib/notifications';
import { colors, fonts, getThemeId, subscribeTheme, applyTheme, loadStoredThemeId } from './src/theme';
import { hydrateOfflineCaches } from './src/lib/offline';
import { useRecoveryPending } from './src/lib/recovery';
import { navigationRef } from './src/navigation/rootRef';
import type { RootStackParamList } from './src/navigation/types';
import { AppShellProvider } from './src/navigation/Shell';
import { RootTabs } from './src/navigation/RootTabs';
import { VerifyGate } from './src/components/VerifyGate';
import { AnnouncementGate } from './src/components/AnnouncementGate';
import { UpdateGate } from './src/components/UpdateGate';
import { TutorialGate } from './src/components/TutorialGate';
import { logLoginEvent } from './src/lib/admin-login';

import { SpoonfulLogo as Logo } from './src/components/Logo';

import { LandingScreen } from './src/screens/LandingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { ShoppingScreen } from './src/screens/ShoppingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ThemeScreen } from './src/screens/ThemeScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { RecipeFormScreen } from './src/screens/RecipeFormScreen';
import { CookingScreen } from './src/screens/CookingScreen';
import { AdminScreen } from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function useThemeId(): string {
  return useSyncExternalStore(subscribeTheme, getThemeId, getThemeId);
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Logo size={72} />
      <Text style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 10, letterSpacing: -0.3 }}>spoonful</Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>Flipping through the recipe book…</Text>
    </View>
  );
}

/** Catches render errors so one screen can never kill the whole app. */
class CrashBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Unexpected error' };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, paddingHorizontal: 28 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>Something went wrong</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>{this.state.error}</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={({ pressed }) => [{ marginTop: 18, borderRadius: 999, backgroundColor: colors.darkButton, paddingHorizontal: 22, paddingVertical: 12, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>Try again</Text>
          </Pressable>
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
  // Ask once (Android 13+) so the app can notify about AI Chef results etc.
  useEffect(() => {
    void requestNotifications();
    void applyReminders();
  }, []);

  return (
    <AppShellProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Main">
        <Stack.Screen name="Main" component={RootTabs} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Shopping" component={ShoppingScreen} />
        <Stack.Screen name="Theme" component={ThemeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="RecipeForm" component={RecipeFormScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Cooking" component={CookingScreen} options={{ animation: 'fade' }} />
      </Stack.Navigator>
    </AppShellProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const recoveryPending = useRecoveryPending();
  const profile = useQuery(api.users.currentUser) as any;
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [cachedSession, setCachedSession] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [authWaitOver, setAuthWaitOver] = useState(false);
  const SESSION_KEY = 'spoonful:session';
  /** 2.1.2: the admin feed gets exactly one row per app start. */
  const loginLogged = React.useRef(false);

  useEffect(() => {
    let alive = true;
    void hydrateOfflineCaches(['mine', 'saved', 'tracker', 'shopping']);
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
      // Never leave the app stuck on the splash screen.
      if (alive) setThemeLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  // Remember that a signed-in session exists, so a later offline launch can
  // skip the auth spinner instead of being stuck on the loading screen.
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      setCachedSession(true);
      void AsyncStorage.setItem(SESSION_KEY, '1').catch(() => {});
      // 2.1.2: admins get a "somebody signed in" entry - once per app start.
      if (!loginLogged.current) {
        loginLogged.current = true;
        void logLoginEvent();
      }
    } else {
      setCachedSession(false);
      void AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      loginLogged.current = false;
    }
  }, [isAuthenticated, isLoading]);

  // If Convex Auth never resolves (e.g. no network at launch), stop waiting
  // after a few seconds and fall back to the cached session / public stack.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setAuthWaitOver(true), 4500);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!themeLoaded || !sessionHydrated || (isLoading && !authWaitOver)) {
    return <Splash />;
  }

  const signedIn = isAuthenticated || (authWaitOver && cachedSession);
  if (isAuthenticated && recoveryPending) {
    return <ResetPasswordScreen />;
  }
  // 2.0.0 first-start onboarding: three quick questions, skipped only once.
  if (isAuthenticated && profile && !profile.onboardedAt) {
    return <OnboardingScreen />;
  }
  return signedIn ? <SignedInStack key="signed" /> : <PublicStack key="public" />;
}

export default function App() {
  const themeId = useThemeId();
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ConvexAuthProvider>
          <NavigationContainer ref={navigationRef} key={themeId}>
            <CrashBoundary>
              <RootNavigator />
            </CrashBoundary>
          </NavigationContainer>
          {/* email confirmation: banner while the mail cannot be sent, lock afterwards */}
          <VerifyGate />
          {/* one-time popup message from the admin panel */}
          <AnnouncementGate />
          {/* 2.1.4: "new update" popup - shown on every start while the version is older */}
          <UpdateGate />
          {/* interactive in-app tour: new users right away, existing users once */}
          <TutorialGate />
        </ConvexAuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
