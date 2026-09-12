import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import { ChevronRight, Check, Download, FileText, Globe, LogOut, Mail, Palette, Play, ShieldCheck, Star, Trash2, Users } from 'lucide-react-native';
import { useAction, useAuthActions, useMutation, useQuery } from '../lib/convex-auth';
import { useTranslation, LANGUAGES, isRtlLanguage, isRestartRequired, markLanguagePickerShown, tryReloadApp, type Language } from '../lib/i18n';
import { loadPrefs, savePrefs, applyReminders, NotifPrefs } from '../lib/notifications';
import { api } from '../lib/api';
import { APP_VERSION } from '../config';
import { colors, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { Divider, GlassCard, PageHeader, SectionLabel } from '../components/ui';
import { LanguagePicker } from '../components/LanguagePicker';
import { Popup } from '../components/Popup';
import { restartTutorial } from '../lib/tutorial';

export function SettingsScreen() {
  const { signOut } = useAuthActions();
  const { t, lang, setLang } = useTranslation();
  const user = useQuery(api.users.currentUser);
  const [showFeedback, setShowFeedback] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  /** 2.1.2: every confirmation is a popup now (reset, restart, device language). */
  const [popup, setPopup] = useState<{ title: string; body: string; restart?: boolean } | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);

  useEffect(() => {
    let alive = true;
    loadPrefs().then((p) => { if (alive) setPrefs(p); });
    return () => { alive = false; };
  }, []);

  const togglePref = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const base: NotifPrefs = prev ?? { meal: true, drink: true, ai: true, added: true };
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
  // 2.0.0: household - share the shopping list with family or flatmates.
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

  /** GDPR: hand the whole export to the share sheet (no server storage). */
  const exportData = async () => {
    try {
      const data = await exportMyData({});
      const json = JSON.stringify(data, null, 2);
      await Share.share({
        title: 'Spoonful · my data',
        message: json.length > 120000 ? `${json.slice(0, 120000)}\n…(truncated)` : json,
      });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.');
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
                Alert.alert('Could not delete the account', e instanceof Error ? e.message : 'Please try again.');
              }
            })();
          },
        },
      ],
    );
  };

  const doSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of Spoonful?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const sendFeedback = async () => {
    const text = feedbackText.trim();
    if (!text) {
      Alert.alert('Add a message', 'Please write a short message so we can help.');
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
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setFeedbackBusy(false);
    }
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }}>
        <PageHeader eyebrow={t('settings.settings')} title={t('settings.settings')} />

        <GlassCard pad={16} radius={20}>
          <Row label={t('ui.name')} value={user?.name || '—'} />
          <Divider />
          <Row label={t('ui.email')} value={user?.email || '—'} />
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
        </GlassCard>

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
          {household ? (
            <>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{household.name}</Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 3 }}>
                  {t('hh.members')}: {(household.members ?? []).map((m: any) => m.name ?? '—').join(', ')}
                </Text>
                {invite ? (
                  <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '800', marginTop: 6 }}>
                    {t('hh.code')}: {invite}
                  </Text>
                ) : null}
              </View>
              <Divider style={{ marginLeft: 16 }} />
              <NavRow icon={<Users size={18} color={colors.accent} />} label={t('hh.invite')} onPress={() => void createInvite()} />
              <Divider style={{ marginLeft: 16 }} />
              <NavRow
                icon={<LogOut size={18} color={colors.rose} />}
                label={t('hh.leave')}
                tint={colors.rose}
                onPress={() =>
                  Alert.alert(t('hh.leaveConfirm'), t('hh.desc'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('hh.leave'), style: 'destructive', onPress: () => void hhRun(() => leaveHousehold({})) },
                  ])
                }
              />
            </>
          ) : (
            <>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 }}>{t('hh.desc')}</Text>
              </View>
              <Divider style={{ marginLeft: 16 }} />
              <NavRow
                icon={<Users size={18} color={colors.accent} />}
                label={t('hh.create')}
                onPress={() => void hhRun(() => createHousehold({ name: t('hh.title') }))}
              />
              <Divider style={{ marginLeft: 16 }} />
              <NavRow icon={<Check size={18} color={colors.accent} />} label={t('hh.join')} onPress={() => setJoinOpen(true)} />
            </>
          )}
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
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Report a problem / Feedback</Text>
          </Pressable>
        ) : sent ? (
          <GlassCard pad={16} radius={20} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.success }}>Thank you!</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              Your feedback was sent straight to the Spoonful team. We read every message.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard pad={16} radius={20} style={{ marginTop: 18 }}>
            <SectionLabel>How was Spoonful?</SectionLabel>
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
              placeholder="Tell us what happened or what we should improve…"
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
              // 2.1.2: full reset (storage + state) and an immediate restart.
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

        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 26 }}>© 2026 Spoonful · v{APP_VERSION}</Text>
      </ScrollView>

      {/* 2.0.0: join a household with the invite code */}
      <Modal visible={joinOpen} transparent animationType="slide" onRequestClose={() => setJoinOpen(false)}>
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
      </Modal>
      {/* 2.1.2: language picker + popups (reset done, restart for RTL) */}
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

/* 2.0.0 theme fix: rebuilt on every theme change. */
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

function PrefToggle({ title, desc, value, onChange }: { title: string; desc: string; value: boolean; onChange: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.surfaceMuted, true: colors.accent }} thumbColor="#fff" />
    </View>
  );
}

