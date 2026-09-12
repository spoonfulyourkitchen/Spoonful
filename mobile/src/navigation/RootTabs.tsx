import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bookmark,
  ChefHat,
  Flame,
  Library,
  MessageCircle,
  ShoppingCart,
  UsersRound,
} from 'lucide-react-native';

import { colors } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useTutorialTarget } from '../lib/tutorial';
import { LibraryScreen } from '../screens/LibraryScreen';
import { MyRecipesScreen } from '../screens/MyRecipesScreen';
import { AssistantScreen } from '../screens/AssistantScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { TrackerScreen } from '../screens/TrackerScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { ShoppingScreen } from '../screens/ShoppingScreen';

const Tab = createBottomTabNavigator();

export type RootTabScreenNames =
  | 'Library' | 'MyRecipes' | 'Assistant' | 'Saved' | 'Tracker' | 'Community' | 'Shopping';

const ORDER: RootTabScreenNames[] = ['Library', 'MyRecipes', 'Assistant', 'Saved', 'Tracker', 'Community', 'Shopping'];

const ICONS: Record<RootTabScreenNames, React.ComponentType<any>> = {
  Library,
  MyRecipes: ChefHat,
  Assistant: MessageCircle,
  Saved: Bookmark,
  Tracker: Flame,
  Community: UsersRound,
  Shopping: ShoppingCart,
};

const TAB_KEY: Record<RootTabScreenNames, string> = {
  Library: 'nav.discover',
  MyRecipes: 'nav.kitchen',
  Assistant: 'nav.ai',
  Saved: 'nav.saved',
  Tracker: 'nav.tracker',
  Community: 'nav.community',
  Shopping: 'nav.shopping',
};

const SCREENS: Record<RootTabScreenNames, React.ComponentType<any>> = {
  Library: LibraryScreen,
  MyRecipes: MyRecipesScreen,
  Assistant: AssistantScreen,
  Saved: SavedScreen,
  Tracker: TrackerScreen,
  Community: CommunityScreen,
  Shopping: ShoppingScreen,
};

function TabIcon({ name, focused }: { name: RootTabScreenNames; focused: boolean }) {
  const Icon = ICONS[name];
  return (
    <View
      style={{
        width: 44,
        height: 26,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.accentSoft : 'transparent',
      }}
    >
      <Icon size={21} strokeWidth={focused ? 2.5 : 2} color={focused ? colors.accent : colors.textSecondary} />
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

/**
 * One tab of the bottom bar. Each tab doubles as a tutorial target, so the tour
 * can highlight it and only finish the step when the user really taps it.
 */
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
  const target = useTutorialTarget(`tut-tab-${name}`, { onPress });
  return (
    <Pressable
      ref={target.ref as any}
      collapsable={false}
      onPress={target.onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      style={({ pressed }) => [
        { width, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <TabIcon name={name} focused={focused} />
      <TabLabel name={name} focused={focused} />
    </Pressable>
  );
}

/** Horizontally scrollable bottom bar: same item width as before, extra tabs slide in. */
function ScrollableTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Keeps the exact original width per tab; more tabs simply overflow to the right.
  const itemW = Math.max(70, Math.round(width / 5));
  const themeIsDark = colors.dark;
  return (
    <View
      style={{
        backgroundColor: themeIsDark ? colors.bottomBar : 'rgba(255,255,255,0.95)',
        borderTopWidth: 1,
        borderTopColor: colors.cardBorder,
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
