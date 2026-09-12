import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTutorialTarget } from '../lib/tutorial';

/**
 * Thin wrapper that registers any UI area as a tutorial target.
 *
 * ```tsx
 * <TutorialTarget id="tut-library-search">
 *   <SearchField … />
 * </TutorialTarget>
 * ```
 *
 * The wrapper only holds a ref (no touch handlers), so the element inside keeps
 * working exactly as before. `collapsable={false}` makes sure Android keeps a
 * real native view, otherwise measureInWindow() would report the wrong frame.
 */
export function TutorialTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { ref } = useTutorialTarget(id);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export default TutorialTarget;
