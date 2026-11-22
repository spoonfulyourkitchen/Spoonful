import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { View, type ViewProps } from 'react-native-web';

export type EdgeInsets = { top: number; right: number; bottom: number; left: number };
export type Rect = { x: number; y: number; width: number; height: number };

function readEnvInset(side: 'top' | 'right' | 'bottom' | 'left'): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side},0px);`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`) || '0');
  probe.remove();
  return Number.isFinite(value) ? value : 0;
}

export function useSafeAreaInsets(): EdgeInsets {
  const [insets, setInsets] = useState<EdgeInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
  useEffect(() => {
    const measure = () =>
      setInsets({
        top: readEnvInset('top'),
        right: readEnvInset('right'),
        bottom: readEnvInset('bottom'),
        left: readEnvInset('left'),
      });
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);
  return insets;
}

export function useSafeAreaFrame(): Rect {
  const [frame, setFrame] = useState<Rect>(() => ({
    x: 0,
    y: 0,
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));
  useEffect(() => {
    const measure = () => setFrame({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return frame;
}

const InsetsContext = createContext<EdgeInsets>({ top: 0, right: 0, bottom: 0, left: 0 });

export function SafeAreaProvider({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <InsetsContext.Provider value={insets}>{children}</InsetsContext.Provider>;
}

export const SafeAreaInsetsContext = InsetsContext;
export const SafeAreaFrameContext = createContext<Rect>({ x: 0, y: 0, width: 0, height: 0 });

export function SafeAreaConsumer({ children }: { children: (insets: EdgeInsets) => React.ReactNode }) {
  const insets = useContext(InsetsContext);
  return <>{children(insets)}</>;
}

export function SafeAreaView({
  children,
  style,
  edges = ['top', 'right', 'bottom', 'left'],
  mode: _mode,
  ...rest
}: ViewProps & { edges?: ('top' | 'right' | 'bottom' | 'left')[]; mode?: string }) {
  const insets = useContext(InsetsContext);
  const padding = useMemo(
    () => ({
      paddingTop: edges.includes('top') ? insets.top : 0,
      paddingRight: edges.includes('right') ? insets.right : 0,
      paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
      paddingLeft: edges.includes('left') ? insets.left : 0,
    }),
    [edges, insets],
  );
  return (
    <View {...rest} style={[padding, style]}>
      {children}
    </View>
  );
}

export const initialWindowMetrics = {
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

export function withSafeAreaInsets<T>(Component: React.ComponentType<T>) {
  return (props: T) => (
    <SafeAreaConsumer>{(insets) => <Component {...(props as any)} insets={insets} />}</SafeAreaConsumer>
  );
}
