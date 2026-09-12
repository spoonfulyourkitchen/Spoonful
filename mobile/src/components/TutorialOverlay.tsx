import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Pointer, X } from 'lucide-react-native';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';
import {
  completeTutorial,
  hasTutorialTarget,
  markTargetFailed,
  nextStep,
  pauseTutorial,
  prevStep,
  resolveTutorialText,
  skipStep,
  skipTutorial,
  tutorialProgressLabel,
  tutorialSteps,
  useTutorial,
  useTutorialTargetRect,
  type TutorialStep,
} from '../lib/tutorial';

/**
 * The visual part of the tour: dimmed background, spotlight on the target,
 * an animated pointer and the coach mark with progress, skip options and the
 * finish screen.
 *
 * Nothing here blocks the tour: the dimmed panes swallow taps, but the
 * spotlight is a real hole, so the element the pointer shows can be pressed.
 */

/** Hint per expected action - resolved through the i18n dictionary. */
const HINT_KEYS: Record<string, string> = {
  tap: 'tut.hintTap',
  input: 'tut.hintInput',
  scroll: 'tut.hintScroll',
  missing: 'tut.hintMissing',
};

const DIM = 'rgba(10,10,14,0.58)';

export function TutorialOverlay() {
  const { t, rtl } = useTranslation();
  const { visible, progress, currentId, missingTarget } = useTutorial();
  const steps = tutorialSteps();
  const step: TutorialStep | undefined = steps[progress.stepIndex];
  const stepIndex = progress.stepIndex;
  const total = steps.length;
  const prog = tutorialProgressLabel();
  const rowDir = { flexDirection: (rtl ? 'row-reverse' : 'row') as 'row' | 'row-reverse' };
  const rect = useTutorialTargetRect(step?.targetId);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  /* Accessibility: respect "remove animations". */
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(!!on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => setReduceMotion(!!on));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  /* Screenreader: read the step out loud whenever it changes. */
  const title = resolveTutorialText(step?.title);
  const body = resolveTutorialText(step?.text);
  useEffect(() => {
    if (!visible || (!title && !body)) return;
    AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
  }, [visible, currentId, title, body]);

  const pad = step?.padding ?? 8;
  const wide = !!step?.wide;
  const spot = useMemo(() => {
    if (!rect) return null;
    if (wide) {
      // Full-width band (lists, long sections): stays visible while scrolling.
      return {
        x: 5,
        y: Math.max(0, rect.y - 90),
        width: screenW - 10,
        height: Math.min(screenH - 60, rect.height + 120),
      };
    }
    return {
      x: Math.max(0, rect.x - pad),
      y: Math.max(0, rect.y - pad),
      width: Math.min(screenW, rect.width + pad * 2),
      height: Math.min(screenH, rect.height + pad * 2),
    };
  }, [rect, wide, pad, screenW, screenH]);

  /* Animations run on the native driver so the app never stutters. */
  const pulse = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible || !spot || reduceMotion) return;
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const hand = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    ring.start();
    hand.start();
    return () => {
      ring.stop();
      hand.stop();
    };
  }, [visible, spot, reduceMotion, pulse, bounce]);

  if (!visible || !step) return null;

  const isLastStep = step.id === 'done' || stepIndex >= total - 1;
  const needsAction = step.expect !== 'observe';
  const targetGone = missingTarget || (!!step.targetId && !hasTutorialTarget(step.targetId));
  const hint = needsAction ? t(HINT_KEYS[step.expect] ?? 'tut.hintTap') : '';

  /* Coach mark placement: below the spotlight when there is room, else above. */
  const cardTop = spot
    ? spot.y + spot.height + 14 + 220 < screenH
      ? spot.y + spot.height + 14
      : Math.max(24, spot.y - 230)
    : Math.max(80, screenH / 2 - 160);

  return (
    /**
     * 2.1.1: deliberately *not* a Modal. A React Native Modal gets its own
     * native window, so nothing underneath it can be tapped - the user could
     * see the highlighted button through the hole but could not press it.
     * Rendered as a sibling of the navigator, the dimmed panes have
     * pointerEvents="none", so taps inside the spotlight reach the real app.
     */
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 900, elevation: 900 }}
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
        {/* Dimming around the target - the target itself stays touchable. */}
        {spot ? (
          <>
            {/* 2.1.1: these panes swallow touches, so only the highlighted spot
                stays active - the hole above the target is a real opening and
                the decorative frame below never blocks it. */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: spot.y, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: spot.y + spot.height, bottom: 0, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: 0, top: spot.y, width: spot.x, height: spot.height, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: spot.x + spot.width, right: 0, top: spot.y, height: spot.height, backgroundColor: DIM }} />
            {/* spotlight frame */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', left: spot.x, top: spot.y, width: spot.width, height: spot.height,
                borderRadius: 16, borderWidth: 2, borderColor: colors.accent,
              }}
            />
            {/* ripple */}
            {needsAction && !reduceMotion && !targetGone ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: spot.x + spot.width / 2 - 26,
                  top: spot.y + spot.height / 2 - 26,
                  width: 52, height: 52, borderRadius: 26,
                  borderWidth: 2, borderColor: colors.accent,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.7] }) }],
                }}
              />
            ) : null}
            {/* 2.1.1: app-coloured pointer symbol instead of an emoji */}
            {needsAction && !targetGone ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: Math.min(screenW - 46, spot.x + spot.width / 2 - 14),
                  top: Math.max(4, spot.y + spot.height - 14),
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accentSoft,
                  transform: [{ translateY: reduceMotion ? 0 : bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }) }],
                }}
              >
                <Pointer size={18} color={colors.accent} fill={colors.accent} strokeWidth={2} />
              </Animated.View>
            ) : null}
          </>
        ) : (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: DIM }} />
        )}

        {/* Coach mark */}
        <View style={{ position: 'absolute', left: 16, right: 16, top: cardTop }}>
          <View
            accessible
            accessibilityLabel={`${title}. ${body}`}
            style={{
              borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder,
              backgroundColor: colors.card, padding: 16, shadowColor: colors.shadowStrong,
              shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8,
            }}
          >
            {/* progress: "Schritt 3 von 8" + global skip */}
            <View style={[{ alignItems: 'center', gap: 10 }, rowDir]}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.accent, letterSpacing: 0.3 }}>
                {t('tut.stepOf', { n: prog.index, total: prog.total })}
              </Text>
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
                <View style={{ height: 4, width: `${Math.round((prog.index / Math.max(1, prog.total)) * 100)}%`, backgroundColor: colors.accent }} />
              </View>
              <Pressable
                onPress={() => void skipTutorial()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('tut.skipTour')}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {isLastStep ? <SuccessMark reduceMotion={reduceMotion} /> : null}

            {title ? (
              <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 12, textAlign: rtl ? 'right' : 'left' }}>
                {title}
              </Text>
            ) : null}
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 4, textAlign: rtl ? 'right' : 'left' }}>{body}</Text>

            {needsAction ? (
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: targetGone ? colors.rose : colors.accent, marginTop: 10, textAlign: rtl ? 'right' : 'left' }}>
                {targetGone ? t('tut.hintMissing') : hint}
              </Text>
            ) : null}

            <View style={[{ alignItems: 'center', gap: 10, marginTop: 14 }, rowDir]}>
              <Pressable
                onPress={() => prevStep()}
                disabled={stepIndex === 0}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('tut.back')}
                style={({ pressed }) => [
                  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder, opacity: stepIndex === 0 ? 0.4 : pressed ? 0.7 : 1 },
                ]}
              >
                <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
                  <ChevronLeft size={18} color={colors.textPrimary} />
                </View>
              </Pressable>
              <Pressable
                onPress={() => void pauseTutorial()}
                accessibilityRole="button"
                accessibilityLabel={t('tut.later')}
                style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('tut.later')}</Text>
              </Pressable>
              {isLastStep ? null : (
                <Pressable
                  onPress={() => skipStep()}
                  accessibilityRole="button"
                  accessibilityLabel={t('tut.skipStep')}
                  style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, textDecorationLine: 'underline' }}>
                    {t('tut.skipStep')}
                  </Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              {/* "Weiter" is always there, so a step can never trap the user. */}
              <Pressable
                onPress={() => {
                  if (isLastStep) {
                    void completeTutorial();
                    return;
                  }
                  if (targetGone) void markTargetFailed();
                  nextStep();
                }}
                accessibilityRole="button"
                accessibilityLabel={isLastStep ? t('tut.letsGo') : t('tut.next')}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 14 }}>
                  {isLastStep ? t('tut.letsGo') : t('tut.next')}
                </Text>
                {isLastStep ? null : (
                  <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
                    <ChevronRight size={16} color={colors.darkButtonText} />
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>
    </View>
  );
}

/** Success mark for the last step (2.1.1: app colours, no emoji, no confetti). */
function SuccessMark({ reduceMotion }: { reduceMotion: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, reduceMotion]);

  return (
    <View style={{ marginTop: 14, alignItems: 'center' }}>
      <Animated.View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: reduceMotion ? 1 : anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.04] }) }],
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success }}>
          <Check size={22} color={colors.card} strokeWidth={3} />
        </View>
      </Animated.View>
    </View>
  );
}

export default TutorialOverlay;
