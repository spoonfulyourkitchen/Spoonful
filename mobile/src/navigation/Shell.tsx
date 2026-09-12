import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, Text, View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle, Bookmark, ChefHat, Flame, Home, Library, LogOut, Menu,
  MessageCircle, Palette, Search, Settings, Shield, ShoppingCart, Sparkles,
  UsersRound, X,
} from 'lucide-react-native';
import { useQuery, useAuthActions } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts, glassShadow, subscribeTheme } from '../theme';
import { SpoonfulLogo as Logo } from '../components/Logo';
import { WashBackground } from '../components/GlassBackground';
import { useAiTask, clearAiTask } from '../lib/aiTask';
import { navigate } from './rootRef';

type ShellContextValue = { open: () => void; close: () => void; toggle: () => void };
const ShellContext = createContext<ShellContextValue>({
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function useAppShell(): ShellContextValue {
  return useContext(ShellContext);
}

/* AI status indicator — spinner / "recipe ready" chip / error chip. */
function RingSpinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ width: 14, height: 14, transform: [{ rotate }] }}>
      <Svg width={14} height={14}>
        <Circle cx={7} cy={7} r={5} stroke={colors.accent} strokeWidth={2} fill="none" strokeDasharray="20 12" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

export function AiStatusIndicator() {
  const task = useAiTask();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (task.status === 'done' || task.status === 'error') {
      setExpired(false);
      const timer = setTimeout(() => setExpired(true), 60000);
      return () => clearTimeout(timer);
    }
    setExpired(false);
  }, [task]);

  if (task.status === 'running') {
    return (
      <View style={styles.aiRunning}>
        <RingSpinner />
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>AI working…</Text>
      </View>
    );
  }
  if (task.status === 'done' && !expired) {
    return (
      <Pressable
        onPress={() => { clearAiTask(); navigate('Main', { screen: 'Assistant' }); }}
        style={({ pressed }) => [styles.aiDone, pressed && { opacity: 0.8 }]}
      >
        <Sparkles size={12} color={colors.accent} strokeWidth={2.5} />
        <Text numberOfLines={1} style={styles.aiDoneText}>
          {task.recipeTitle}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: colors.accent }}>READY</Text>
      </Pressable>
    );
  }
  if (task.status === 'error' && !expired) {
    return (
      <Pressable
        onPress={() => { clearAiTask(); navigate('Main', { screen: 'Assistant' }); }}
        style={({ pressed }) => [styles.aiError, pressed && { opacity: 0.8 }]}
      >
        <AlertTriangle size={11} color={colors.rose} strokeWidth={2.5} />
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.rose }}>Try again</Text>
      </Pressable>
    );
  }
  return null;
}

const aiPill: any = {
  flexDirection: 'row', alignItems: 'center',
  borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
};
/* 2.0.0 theme fix: rebuilt on every theme change, otherwise the AI pills keep
   the colours of the theme the app was started with. */
function buildShellStyles() {
  return {
    aiRunning: { ...aiPill, gap: 6, borderColor: colors.cardBorder, backgroundColor: colors.card },
    aiDone: { ...aiPill, gap: 5, borderColor: colors.accent, backgroundColor: colors.accentSoft },
    aiDoneText: { maxWidth: 110, fontSize: 11.5, fontWeight: '700' as const, color: colors.textPrimary },
    aiError: { ...aiPill, gap: 4, borderColor: colors.rose, backgroundColor: colors.roseBg },
  };
}
let styles = buildShellStyles();
subscribeTheme(() => { styles = buildShellStyles(); });

/* Glass main header (mobile): logo · AI status · hamburger. */
export function MainHeader() {
  const insets = useSafeAreaInsets();
  const { toggle } = useAppShell();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.dark ? colors.header : 'rgba(248,245,240,0.82)',
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 54, paddingHorizontal: 14, gap: 6 }}>
        <Pressable onPress={() => navigate('Dashboard')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Logo size={30} />
          <Text style={{ fontFamily: fonts.display, fontSize: 19, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 }}>
            spoonful
          </Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <AiStatusIndicator />
        </View>

        <Pressable
          onPress={toggle}
          hitSlop={8}
          style={({ pressed }) => [
            { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
            pressed && { backgroundColor: colors.card },
          ]}
        >
          <Menu size={23} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

/* Page — full screen with glass wash + sticky header. */
export function Page({
  children,
  header = true,
  contentStyle,
}: {
  children: React.ReactNode;
  header?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <WashBackground>
      {header ? <MainHeader /> : null}
      <View style={[{ flex: 1, paddingBottom: insets.bottom }, contentStyle]}>{children}</View>
    </WashBackground>
  );
}

/* ---------------------------------------------------------------------------
   Right-side drawer (86% width, max 24rem) slides in from the right over a
   dim backdrop. Contains search, pages, more links, sign out + legal footer.
   ------------------------------------------------------------------------- */
const LEGAL = [
  { page: 'impressum', label: 'Impressum' },
  { page: 'datenschutz', label: 'Datenschutz' },
  { page: 'cookies', label: 'Cookies' },
  { page: 'agb', label: 'AGB' },
] as const;

function DrawerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const myRole = useQuery(api.admin.myRole);
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (visible) {
      translateX.setValue(1);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: 1, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateX, backdrop]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3,
      onPanResponderMove: (_e, g) => {
        const base = (translateX as any)._value;
        const next = Math.max(0, Math.min(1, base + g.dx / 900));
        translateX.setValue(next);
        backdrop.setValue(1 - next);
      },
      onPanResponderRelease: () => {
        const v = (translateX as any)._value;
        if (v > 0.42) {
          Animated.parallel([
            Animated.timing(translateX, { toValue: 1, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          Animated.parallel([
            Animated.timing(translateX, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.timing(translateX, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start();
      },
    }),
  ).current;

  const go = (route: any, params?: any) => {
    onClose();
    setTimeout(() => navigate(route, params), 140);
  };
  const goTab = (screen: string) => go('Main', { screen });
  const ic = (color: string) => ({ size: 19, color, strokeWidth: 2 }) as const;

  const Row = ({
    icon, label, onPress, tint, active,
  }: { icon: React.ReactNode; label: string; onPress: () => void; tint?: string; active?: boolean }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12,
          backgroundColor: active ? colors.accentSoft : 'transparent',
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      {icon}
      <Text style={{ fontSize: 15, fontWeight: active ? '700' : '500', color: tint ?? colors.textPrimary }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheetAbs, { opacity: backdrop, backgroundColor: 'rgba(15,23,42,0.45)' }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            {
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: '86%', maxWidth: 384,
              backgroundColor: colors.dark ? colors.card : '#fdfbf7',
              paddingTop: insets.top,
              transform: [{
                translateX: translateX.interpolate({ inputRange: [0, 1], outputRange: [0, 900] }),
              }],
            },
            glassShadow('lg'),
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Logo size={30} />
              <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Spoonful</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder }}
            >
              <X size={17} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
            <Pressable
              onPress={() => goTab('Library')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}
            >
              <Search size={16} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>Search recipes…</Text>
            </Pressable>

            <DrawerLabel>Pages</DrawerLabel>
            <Row icon={<Library {...ic(colors.accent)} />} label="Library" onPress={() => goTab('Library')} />
            <Row icon={<ChefHat {...ic(colors.accent)} />} label="My Recipes" onPress={() => goTab('MyRecipes')} />
            <Row icon={<MessageCircle {...ic(colors.accent)} />} label="AI Chef" onPress={() => goTab('Assistant')} />
            <Row icon={<Bookmark {...ic(colors.accent)} />} label="Saved" onPress={() => goTab('Saved')} />
            <Row icon={<Flame {...ic(colors.accent)} />} label="Tracker" onPress={() => goTab('Tracker')} />

            <DrawerLabel>More</DrawerLabel>
            <Row icon={<Home {...ic(colors.accent)} />} label="Dashboard" onPress={() => go('Dashboard')} />
            <Row icon={<UsersRound {...ic(colors.accent)} />} label="Community" onPress={() => go('Community')} />
            <Row icon={<ShoppingCart {...ic(colors.accent)} />} label="Shopping list" onPress={() => go('Shopping')} />
            <Row icon={<Palette {...ic(colors.accent)} />} label="Theme" onPress={() => go('Theme')} />
            <Row icon={<Settings {...ic(colors.accent)} />} label="Settings" onPress={() => go('Settings')} />
            {myRole === 'admin' || myRole === 'mod' ? <Row icon={<Shield {...ic(colors.accent)} />} label={myRole === 'admin' ? 'Admin panel' : 'Moderation'} onPress={() => go('Admin')} /> : null}

            <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: 12 }} />
            <Row icon={<LogOut {...ic(colors.rose)} />} label="Sign out" tint={colors.rose} onPress={() => { onClose(); setTimeout(() => signOut(), 200); }} />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingHorizontal: 8 }}>
              {LEGAL.map((l) => (
                <Pressable key={l.page} onPress={() => go('Legal', { page: l.page })}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 12, paddingHorizontal: 8 }}>© 2026 Spoonful</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DrawerLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 2, marginLeft: 8, marginTop: 10 }}>
      {children}
    </Text>
  );
}

const StyleSheetAbs: any = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/** Slim right-edge strip: swipe left to open the drawer. */
function EdgeOpenStrip({ onOpen }: { onOpen: () => void }) {
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: (_e, g) => {
        if (g.dx < -12) onOpen();
      },
    }),
  ).current;
  return <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 18 }} {...pan.panHandlers} />;
}

/* Provider — mounted once around the signed-in navigator. */
export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = React.useMemo(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((o) => !o),
    }),
    [],
  );
  return (
    <ShellContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {!open ? <EdgeOpenStrip onOpen={() => setOpen(true)} /> : null}
      </View>
      <DrawerSheet visible={open} onClose={() => setOpen(false)} />
    </ShellContext.Provider>
  );
}
