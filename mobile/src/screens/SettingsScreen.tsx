import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import { ChevronRight, Check, Download, FileText, Globe, LogOut, Mail, Palette, Play, ShieldCheck, Star, Trash2, UserRound, Users } from 'lucide-react-native';
import { useAction, useAuthActions, useMutation, useQuery } from '../lib/convex-auth';
import { useTranslation, LANGUAGES, isRestartRequired, markLanguagePickerShown, tryReloadApp } from '../lib/i18n';
import { loadPrefs, savePrefs, NotifPrefs } from '../lib/notifications';
import { api } from '../lib/api';
import { APP_VERSION } from '../config';
import { colors, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { Divider, GlassCard, PageHeader, SectionLabel } from '../components/ui';
import { LanguagePicker } from '../components/LanguagePicker';
import { ProfileEditor } from '../components/ProfileEditor';
import { Popup } from '../components/Popup';
import { restartTutorial } from '../lib/tutorial';
import { clearCrashLog, getCrashLog, subscribeCrashLog } from '../lib/crash-log';
import { useAdminQuickReport, useCookingAdvanced } from '../lib/app-prefs';

function useCrashLog() {
  return useSyncExternalStore(subscribeCrashLog, getCrashLog, getCrashLog);
}

export function SettingsScreen() {
  const { signOut } = useAuthActions();
  const { t, lang } = useTranslation();
  const user = useQuery(api.users.currentUser);
  
  const isAdmin = useQuery(api.admin.isAdmin) === true;
  const [showFeedback, setShowFeedback] = useState(false);
  const errors = useCrashLog();
  const [langOpen, setLangOpen] = useState(false);
  
  const [popup, setPopup] = useState<{ title: string; body: string; restart?: boolean } | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  
  const [cookingAdvanced, setCookingAdvancedPref] = useCookingAdvanced();
  
  const [quickReport, setQuickReportPref] = useAdminQuickReport();
  
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPrefs().then((p) => { if (alive) setPrefs(p); });
    return () => { alive = false; };
  }, []);

  const togglePref = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const base: NotifPrefs = prev ?? { meal: true, drink: true, ai: true, added: true, admin: true };
      const next: NotifPrefs = { ...base, [key]: !base[key] };
      void savePrefs(next);
      return next;
    });
  };
  const [stars, setStars] = useState(5);
  const [sent, setSent] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const submitFeedback = useMutation(api.feedback.submit);
  const exportMyData = useAction(api.account.exportData);
  const deleteMyAccount = useMutation(api.account.deleteAccount);
  const household = useQuery(api.household.mine) as any;
  const createHousehold = useMutation(api.household.create);
  const makeInvite = useMutation(api.household.invite);
  const joinHousehold = useMutation(api.household.join);
  const leaveHousehold = useMutation(api.household.leave);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [hhBusy, setHhBusy] = useState(false);

  const hhRun = async (fn: () => Promise<any>, okMsg?: string) => {
    if (hhBusy) return;
    setHhBusy(true);
    try {
      const res = await fn();
      if (okMsg) Alert.alert(t('hh.title'), okMsg);
      return res;
    } catch (e) {
      Alert.alert(t('hh.title'), e instanceof Error ? e.message : String(e));
    } finally {
      setHhBusy(false);
    }
  };

  const createInvite = async () => {
    const res: any = await hhRun(() => makeInvite({}));
    const code = res?.code ?? res?.data?.code ?? null;
    if (code) {
      setInvite(code);
      void Share.share({ message: `${t('hh.shareText')}: ${code}` });
    }
  };

  
  const exportData = async () => {
    try {
      const data = await exportMyData({});
      const json = JSON.stringify(data, null, 2);
      await Share.share({
        title: 'Spoonful · my data',
        message: json.length > 120000 ? `${json.slice(0, 120000)}\n…(truncated)` : json,
      });
    } catch (e) {
      Alert.alert(t('s.xExportFailed'), e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const deleteAccountPrompt = () => {
    Alert.alert(
      'Delete your account?',
      'This removes your recipes, saved recipes, tracker entries, shopping list, comments and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteMyAccount({});
                await signOut();
              } catch (e) {
                Alert.alert(t('s.xAccountDeleteFailed'), e instanceof Error ? e.message : 'Please try again.');
              }
            })();
          },
        },
      ],
    );
  };

  const doSignOut = () => {
    Alert.alert(t('s.xSignOutTitle'), 'Are you sure you want to sign out of Spoonful?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const sendFeedback = async () => {
    const text = feedbackText.trim();
    if (!text) {
      Alert.alert(t('s.xAddMessage'), 'Please write a short message so we can help.');
      return;
    }
    setFeedbackBusy(true);
    try {
      await submitFeedback({
        rating: stars,
        text,
        name: user?.name ?? null,
        email: user?.email ?? null,
      });
      setSent(true);
      setFeedbackText('');
    } catch (e) {
      Alert.alert(t('s.xCouldNotSend'), e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setFeedbackBusy(false);
    }
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, paddingBottom: 32 }}>
        <PageHeader eyebrow={t('settings.settings')} title={t('settings.settings')} />

        <GlassCard pad={16} radius={20}>
          <Row label={t('ui.name')} value={user?.name || '-'} />
          <Divider />
          <Row label={t('ui.email')} value={user?.email || '-'} />
        </GlassCard>

        <Text style={label}>{t('settings.settings')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow icon={<Palette size={18} color={colors.accent} />} label={t('settings.theme')} onPress={() => navigate('Theme')} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow
            icon={<Globe size={18} color={colors.accent} />}
            label={t('settings.language')}
            value={LANGUAGES.find((l) => l.code === lang)?.native ?? lang}
            onPress={() => setLangOpen(true)}
          />
        </GlassCard>

        <Text style={label}>{t('ui.notifTitle')}</Text>
        <GlassCard pad={4} radius={20}>
          <PrefToggle title={t('ui.notifMeal')} desc={t('ui.notifMealDesc')} value={prefs?.meal ?? true} onChange={() => togglePref('meal')} />
          <PrefToggle title={t('ui.notifDrink')} desc={t('ui.notifDrinkDesc')} value={prefs?.drink ?? true} onChange={() => togglePref('drink')} />
          <PrefToggle title={t('ui.notifAi')} desc={t('ui.notifAiDesc')} value={prefs?.ai ?? true} onChange={() => togglePref('ai')} />
          <PrefToggle title={t('ui.notifAdded')} desc={t('ui.notifAddedDesc')} value={prefs?.added ?? true} onChange={() => togglePref('added')} />
          {isAdmin ? (
            <PrefToggle title={t('ui.notifAdmin')} desc={t('ui.notifAdminDesc')} value={prefs?.admin ?? true} onChange={() => togglePref('admin')} />
          ) : null}
        </GlassCard>

        <Text style={label}>{t('s.advSection')}</Text>
        <GlassCard pad={4} radius={20}>
          <PrefToggle
            title={t('s.advTitle')}
            value={cookingAdvanced}
            onChange={() => setCookingAdvancedPref(!cookingAdvanced)}
          />
        </GlassCard>

        {isAdmin ? (
          <>
            <Text style={label}>{t('s.adminSection')}</Text>
            <GlassCard pad={4} radius={20}>
              <PrefToggle
                title={t('s.adminQuickReport')}
                desc={t('s.adminQuickReportDesc')}
                value={quickReport}
                onChange={() => setQuickReportPref(!quickReport)}
              />
            </GlassCard>
          </>
        ) : null}

        <Text style={label}>{t('s.profileTitle')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow
            icon={<UserRound size={18} color={colors.accent} />}
            label={t('s.profileEdit')}
            value={String((user as any)?.name ?? '')}
            onPress={() => setProfileOpen(true)}
          />
        </GlassCard>
        <ProfileEditor visible={profileOpen} onClose={() => setProfileOpen(false)} />

        <Text style={label}>{t('ui.help')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow icon={<Mail size={18} color={colors.accent} />} label={t('ui.contact')} onPress={() => Linking.openURL('mailto:spoonfulsupport@gmail.com')} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Download size={18} color={colors.accent} />} label={t('ui.exportData')} onPress={() => void exportData()} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<LogOut size={18} color={colors.rose} />} label={t('nav.signOut')} tint={colors.rose} onPress={doSignOut} />
        </GlassCard>

        <Text style={label}>{t('legal.privacyTitle')} · {t('legal.navTerms')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow icon={<FileText size={18} color={colors.accent} />} label={t('legal.navImprint')} onPress={() => navigate('Legal', { page: 'impressum' })} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<ShieldCheck size={18} color={colors.accent} />} label={t('legal.navPrivacy')} onPress={() => navigate('Legal', { page: 'datenschutz' })} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<FileText size={18} color={colors.accent} />} label={t('legal.navCookies')} onPress={() => navigate('Legal', { page: 'cookies' })} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<FileText size={18} color={colors.accent} />} label={t('legal.navTerms')} onPress={() => navigate('Legal', { page: 'agb' })} />
        </GlassCard>

        <Text style={label}>{t('hh.title')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow
            icon={<Users size={18} color={colors.accent} />}
            label={household?.name ?? t('hh.title')}
            value={household ? `${(household.members ?? []).length}` : undefined}
            onPress={() => navigate('Main' as any, { screen: 'Household' } as any)}
          />
        </GlassCard>

        <Text style={label}>{t('ui.danger')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow icon={<Trash2 size={18} color={colors.rose} />} label={t('ui.deleteAccount')} tint={colors.rose} onPress={deleteAccountPrompt} />
        </GlassCard>

        {!showFeedback ? (
          <Pressable
            onPress={() => setShowFeedback(true)}
            style={({ pressed }) => [{ marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.8 : 1 }]}
          >
            <Star size={18} color="#eab308" fill="#eab308" />
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{t('s.xFeedbackTitle')}</Text>
          </Pressable>
        ) : sent ? (
          <GlassCard pad={16} radius={20} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.success }}>{t('s.xFeedbackThanks')}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Your feedback was sent straight to the Spoonful team. We read every message.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard pad={16} radius={20} style={{ marginTop: 18 }}>
            <SectionLabel>{t('s.xFeedbackAsk')}</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                  <Star size={28} color={n <= stars ? '#eab308' : colors.textSecondary} fill={n <= stars ? '#eab308' : 'transparent'} />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder={t('s.xPhFeedback')}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{ minHeight: 90, textAlignVertical: 'top', borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, color: colors.textPrimary, padding: 12, fontSize: 14, marginTop: 12 }}
            />
            <Pressable
              onPress={() => void sendFeedback()}
              disabled={feedbackBusy}
              style={({ pressed }) => [{ marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed || feedbackBusy ? 0.8 : 1 }]}
            >
              <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>{feedbackBusy ? 'Sending…' : 'Send feedback'}</Text>
            </Pressable>
          </GlassCard>
        )}

        <SectionLabel>{t('ui.tutorialSection')}</SectionLabel>
        <GlassCard pad={14} style={{ marginTop: 6 }}>
          <Pressable
            onPress={() => {
              void restartTutorial().then(() =>
                setPopup({ title: t('tut.resetTitle'), body: t('tut.resetBody') }),
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={t('tut.restart')}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.8 : 1 }]}
          >
            <Play size={18} color={colors.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{t('tut.restart')}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>{t('tut.restartHint')}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        </GlassCard>

        <SectionLabel>{t('s.errTitle')}</SectionLabel>
        <GlassCard pad={14} style={{ marginTop: 6 }}>
          {errors.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{t('s.errEmpty')}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textPrimary }}>
                {t('s.errCount', { n: errors.length })}
              </Text>
              {errors.slice(0, 5).map((entry) => (
                <View key={`${entry.at}-${entry.scope}`} style={{ borderRadius: 10, backgroundColor: colors.surfaceMuted, padding: 10 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>
                    {`${new Date(entry.at).toLocaleString()} · ${entry.scope}`}
                  </Text>
                  <Text numberOfLines={3} style={{ fontSize: 12.5, color: colors.textPrimary, marginTop: 2 }}>
                    {entry.message}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={() => void clearCrashLog()}
                accessibilityRole="button"
                accessibilityLabel={t('s.errClear')}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', opacity: pressed ? 0.8 : 1 }]}
              >
                <Trash2 size={15} color={colors.rose} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.rose }}>{t('s.errClear')}</Text>
              </Pressable>
            </View>
          )}
        </GlassCard>

        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 26 }}>© 2026 Spoonful · v{APP_VERSION}</Text>
      </ScrollView>

      <Modal visible={joinOpen} transparent animationType="slide" onRequestClose={() => setJoinOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{t('hh.join')}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 6 }}>{t('hh.joinHint')}</Text>
              <TextInput
                value={joinCode}
                onChangeText={(v) => setJoinCode(v.toUpperCase())}
                autoCapitalize="characters"
                placeholder={t('hh.code')}
                placeholderTextColor={colors.textSecondary}
                style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 12, color: colors.textPrimary, letterSpacing: 2, fontWeight: '700' }}
              />
              <Pressable
                onPress={() => {
                  if (!joinCode.trim()) return;
                  void hhRun(() => joinHousehold({ code: joinCode.trim() })).then(() => {
                    setJoinOpen(false);
                    setJoinCode('');
                  });
                }}
                style={({ pressed }) => [{ marginTop: 12, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={{ color: colors.darkButtonText, fontWeight: '800' }}>{t('hh.join')}</Text>
              </Pressable>
              <Pressable onPress={() => setJoinOpen(false)} style={{ marginTop: 10, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
      
        </KeyboardAvoidingView></Modal>
      <LanguagePicker
        visible={langOpen}
        onClose={() => setLangOpen(false)}
        onPicked={() => {
          if (isRestartRequired()) {
            setPopup({ title: t('langue.restartTitle'), body: t('langue.restartBody'), restart: true });
          } else {
            setPopup({ title: t('langue.changed'), body: t('langue.title') });
          }
        }}
      />
      <Popup
        visible={!!popup}
        onClose={() => setPopup(null)}
        closeLabel={t('common.close')}
        icon={<Globe size={20} color={colors.accent} />}
        title={popup?.title ?? ''}
        body={popup?.body}
        actions={
          popup?.restart
            ? [
                {
                  label: t('langue.restartNow'),
                  onPress: () => {
                    setPopup(null);
                    const reloaded = tryReloadApp();
                    if (!reloaded) markLanguagePickerShown();
                  },
                },
                { label: t('common.cancel'), variant: 'ghost', onPress: () => setPopup(null) },
              ]
            : [{ label: t('common.close'), onPress: () => setPopup(null) }]
        }
      />
    </Page>
  );
}

function buildSectionLabel() {
  return {
    fontSize: 11, fontWeight: '700' as const, color: colors.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    marginTop: 20, marginBottom: 6,
  };
}
let label = buildSectionLabel();
subscribeTheme(() => { label = buildSectionLabel(); });

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ fontSize: 15, color: colors.textPrimary }}>{l}</Text>
      <Text style={{ fontSize: 15, color: colors.textSecondary }}>{value}</Text>
    </View>
  );
}

function NavRow({ icon, label: l, value, tint, onPress }: { icon: React.ReactNode; label: string; value?: string; tint?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, opacity: pressed ? 0.7 : 1 }]}>
      {icon}
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: tint ?? colors.textPrimary }}>{l}</Text>
      {value ? <Text style={{ fontSize: 14, color: colors.textSecondary }}>{value}</Text> : null}
      <ChevronRight size={17} color={colors.textSecondary} />
    </Pressable>
  );
}

function PrefToggle({ title, desc, value, onChange }: { title: string; desc?: string; value: boolean; onChange: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{title}</Text>
        {desc ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.surfaceMuted, true: colors.accent }} thumbColor="#fff" />
    </View>
  );
}

