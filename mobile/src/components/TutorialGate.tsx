import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Play, X } from 'lucide-react-native';
import { useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts } from '../theme';
import { useTranslation, deviceLanguageNeedsChoice, wasLanguagePickerShown, markLanguagePickerShown, clearDeviceLanguageAsk, LANGUAGES } from '../lib/i18n';
import { TutorialOverlay } from './TutorialOverlay';
import { LanguagePicker } from './LanguagePicker';
import {
  hydrateTutorial,
  resumeTutorial,
  setTutorialLanguage,
  shouldAutoStart,
  startTutorial,
  useTutorial,
} from '../lib/tutorial';
// Registers the step configuration as a side effect of loading the gate.
import '../lib/tutorial-steps';

/**
 * Wires the tour into the app (2.0.0):
 *
 * - brand new users: the tour starts right after registration/onboarding,
 * - existing users: it starts once on the next app start, as long as the tour
 *   was not completed (skipped users get the "continue" pill instead),
 * - a completed tour only reopens when a newer tour version adds new steps,
 * - "continue later" keeps the exact step and offers the pill on the next start.
 */
export function TutorialGate() {
  const { t, lang } = useTranslation();
  const { visible, progress } = useTutorial();
  const profile = useQuery(api.users.currentUser) as any;
  const [ready, setReady] = useState(false);
  const [pillHidden, setPillHidden] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    setTutorialLanguage(lang);
  }, [lang]);

  useEffect(() => {
    let alive = true;
    void hydrateTutorial().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Auto start once per app run - never in guest mode (no profile yet).
  useEffect(() => {
    if (!ready || startedRef.current || profile === undefined) return;
    startedRef.current = true;
    void (async () => {
      if (!(await shouldAutoStart())) return;
      // Brand new accounts (just onboarded) get the tour straight away,
      // everyone else after the shell has settled.
      const onboardedAt = Number(profile?.onboardedAt ?? 0);
      const isFresh = onboardedAt > 0 && Date.now() - onboardedAt < 10 * 60 * 1000;
      setTimeout(() => {
        void startTutorial();
      }, isFresh ? 1200 : 2200);
    })();
  }, [ready, profile]);

  const showPill =
    ready &&
    !visible &&
    !pillHidden &&
    (progress.state === 'paused' || progress.state === 'skipped' || progress.state === 'failed_target');

  // 2.1.2: the phone language is not translated -> soft hint with a picker.
  const [langHint, setLangHint] = useState(false);
  useEffect(() => {
    if (!ready || wasLanguagePickerShown()) return;
    if (!deviceLanguageNeedsChoice()) return;
    const timer = setTimeout(() => setLangHint(true), 2600);
    return () => clearTimeout(timer);
  }, [ready]);

  const closeLangHint = () => {
    setLangHint(false);
    markLanguagePickerShown();
    void clearDeviceLanguageAsk();
  };

  return (
    <>
      <TutorialOverlay />
      {showPill ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 92, alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder,
              backgroundColor: colors.card, paddingLeft: 14, paddingRight: 6, paddingVertical: 8,
              shadowColor: colors.shadowStrong, shadowOpacity: 0.16, shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 }, elevation: 6,
            }}
          >
            <Pressable
              onPress={() => void resumeTutorial()}
              accessibilityRole="button"
              accessibilityLabel={t('tut.resume')}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.8 : 1 }]}
            >
              <Play size={15} color={colors.accent} strokeWidth={2.4} />
              <Text style={{ fontFamily: fonts.display, fontSize: 13.5, fontWeight: '800', color: colors.textPrimary }}>
                {t('tut.resume')}
              </Text>
            </Pressable>
            <Pressable onPress={() => setPillHidden(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <X size={15} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <LanguagePicker
        visible={langHint}
        onClose={closeLangHint}
        hintBody={t('langue.unsupportedBody')}
      />
    </>
  );
}

export default TutorialGate;
