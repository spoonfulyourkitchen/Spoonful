import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTutorialTarget } from '../lib/tutorial';

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
