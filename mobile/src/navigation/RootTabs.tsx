import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bookmark,
  ChefHat,
  Flame,
  Home,
  Library,
  MessageCircle,
  ShoppingCart,
  UsersRound,
} from 'lucide-react-native';

import { colors } from '../theme';
import { navigate } from './rootRef';
import { openBarcode } from '../components/BarcodeHost';
import { setPendingBarcode } from '../lib/scan-bus';
import { useTranslation } from '../lib/i18n';
import { useTutorialTarget } from '../lib/tutorial';

import { LibraryScreen } from '../screens/LibraryScreen';
import { MyRecipesScreen } from '../screens/MyRecipesScreen';
import { AssistantScreen } from '../screens/AssistantScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { TrackerScreen } from '../screens/TrackerScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { ShoppingScreen } from '../screens/ShoppingScreen';
import { HouseholdScreen } from '../screens/HouseholdScreen';

const Tab = createBottomTabNavigator();

export type RootTabScreenNames =
  | 'Library' | 'MyRecipes' | 'Assistant' | 'Saved' | 'Tracker' | 'Community' | 'Shopping' | 'Household';

const ORDER: RootTabScreenNames[] = ['Library', 'MyRecipes', 'Assistant', 'Saved', 'Tracker', 'Community', 'Shopping', 'Household'];

const ICONS: Record<RootTabScreenNames, React.ComponentType<any>> = {
  Library,
  MyRecipes: ChefHat,
  Assistant: MessageCircle,
  Saved: Bookmark,
  Tracker: Flame,
  Community: UsersRound,
  Shopping: ShoppingCart,
  Household: Home,
};

const TAB_KEY: Record<RootTabScreenNames, string> = {
  Library: 'nav.discover',
  MyRecipes: 'nav.kitchen',
  Assistant: 'nav.ai',
  Saved: 'nav.saved',
  Tracker: 'nav.tracker',
  Community: 'nav.community',
  Shopping: 'nav.shopping',
  Household: 's.hhTab',
};

const SCREENS: Record<RootTabScreenNames, React.ComponentType<any>> = {
  Library: LibraryScreen,
  MyRecipes: MyRecipesScreen,
  Assistant: AssistantScreen,
  Saved: SavedScreen,
  Tracker: TrackerScreen,
  Community: CommunityScreen,
  Shopping: ShoppingScreen,
  Household: HouseholdScreen,
};

function TabIcon({ name, focused }: { name: RootTabScreenNames; focused: boolean }) {
  const Icon = ICONS[name];
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.12 : 1, damping: 9, stiffness: 240, mass: 0.6, useNativeDriver: true }),
      Animated.timing(glow, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused, scale, glow]);
  return (
    <View
      style={{
        width: 44,
        height: 26,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 14,
          backgroundColor: colors.accentSoft,
          opacity: glow,
        }}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon size={21} strokeWidth={focused ? 2.5 : 2} color={focused ? colors.accent : colors.textSecondary} />
      </Animated.View>
    </View>
  );
}

function TabLabel({ name, focused }: { name: RootTabScreenNames; focused: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '500',
          color: focused ? colors.accent : colors.textSecondary,
        }}
        numberOfLines={1}
      >
        {t(TAB_KEY[name])}
      </Text>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? colors.accent : 'transparent', marginTop: 2 }} />
    </View>
  );
}

function TabButton({
  name,
  focused,
  width,
  onPress,
}: {
  name: RootTabScreenNames;
  focused: boolean;
  width: number;
  onPress: () => void;
}) {
  
  const onLongPress =
    name === 'Tracker'
      ? () => {
          openBarcode({
            accept: 'numeric',
            onCode: (code) => {
              setPendingBarcode(code);
              navigate('Tracker');
            },
          });
        }
      : undefined;
  const target = useTutorialTarget(`tut-tab-${name}`, { onPress });
  return (
    <Pressable
      ref={target.ref as any}
      collapsable={false}
      onPress={target.onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      style={({ pressed }) => [
        { width, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: focused ? colors.accentSoft : 'transparent',
        }}
      >
        <TabIcon name={name} focused={focused} />
        <TabLabel name={name} focused={focused} />
      </View>
    </Pressable>
  );
}

function ScrollableTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const itemW = Math.max(70, Math.round(width / 5));
  return (
    <View
      style={{
        backgroundColor: colors.bottomBar,
        borderTopWidth: 1,
        borderTopColor: colors.cardBorder,
        paddingTop: 2,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 6, paddingRight: 6, paddingTop: 5, paddingBottom: Math.max(insets.bottom, 4) }}
      >
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const name = route.name as RootTabScreenNames;
          return (
            <TabButton
              key={route.key}
              name={name}
              focused={focused}
              width={itemW}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

export function RootTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <ScrollableTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      {ORDER.map((name) => (
        <Tab.Screen key={name} name={name} component={SCREENS[name]} />
      ))}
    </Tab.Navigator>
  );
}

export default RootTabs;
