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
import { ChevronRight, Download, FileText, Globe, LogOut, Mail, Palette, Play, ShieldCheck, Star, Trash2, Upload, Users } from 'lucide-react-native';
import { convexClient, useAction, useAuthActions, useMutation, useQuery } from '../lib/convex-auth';
import { cacheRemove } from '../lib/offline';
import { hydrateAccountFromServer, importAccountData } from '../lib/account-sync';
import { readBackupFile, saveBackupToFolder } from '../lib/backup-file';
import { useTranslation, LANGUAGES, isRestartRequired, markLanguagePickerShown, tryReloadApp } from '../lib/i18n';
import { loadPrefs, savePrefs, NotifPrefs } from '../lib/notifications';
import { api } from '../lib/api';
import { APP_VERSION } from '../config';
import { colors, subscribeTheme } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { Divider, GlassCard, PageHeader } from '../components/ui';
import { LanguagePicker } from '../components/LanguagePicker';
import { ProfileEditor } from '../components/ProfileEditor';
import { Popup } from '../components/Popup';
import { restartTutorial } from '../lib/tutorial';
import { clearCrashLog, getCrashLog, subscribeCrashLog } from '../lib/crash-log';
import { useAdminQuickReport } from '../lib/app-prefs';

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
  
  const [quickReport, setQuickReportPref] = useAdminQuickReport();
  
  const [profileOpen, setProfileOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const L = (de: string, en: string) => (lang === 'de' ? de : en);

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
  const restartProfileRefresh = useMutation(api.users.restartProfileRefresh);
  const household = useQuery(api.household.mine) as any;
  const joinHousehold = useMutation(api.household.join);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
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

  
  const exportData = async () => {
    try {
      const data = await exportMyData({});
      const json = JSON.stringify(data, null, 2);
      const result = await saveBackupToFolder(json);
      if (result === 'saved') {
        Alert.alert(
          L('Gespeichert', 'Saved'),
          L('Deine Sicherung liegt als JSON-Datei im gewählten Ordner.', 'Your backup was saved as a JSON file in the folder you picked.'),
        );
        return;
      }
      if (result === 'cancelled') return;
      await Share.share({ title: 'Spoonful · my data', message: json });
    } catch (e) {
      Alert.alert(t('s.xExportFailed'), e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const pickBackup = async () => {
    try {
      const content = await readBackupFile();
      if (content) setImportText(content);
    } catch (e) {
      Alert.alert(L('Datei konnte nicht gelesen werden', 'Could not read file'), e instanceof Error ? e.message : String(e));
    }
  };

  const redoOnboarding = () => {
    void (async () => {
      try {
        await restartProfileRefresh({});
        Alert.alert(
          L('Profil neu einrichten', 'Set up profile again'),
          L(
            'Das Onboarding öffnet sich gleich. Deine Antworten werden diesmal mit deinem Konto gespeichert und sind nach einer Neuinstallation wieder da.',
            'The onboarding opens in a moment. This time your answers are saved to your account and come back after a reinstall.',
          ),
        );
      } catch (e) {
        Alert.alert(L('Hat nicht geklappt', 'Could not start'), e instanceof Error ? e.message : String(e));
      }
    })();
  };

  const runImport = async () => {
    if (importBusy) return;
    setImportBusy(true);
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(L('Das ist keine Spoonful-Sicherung.', 'This is not a Spoonful backup.'));
      }
      const counts = await importAccountData(parsed);
      const me = await convexClient.query(api.users.currentUser as any, {});
      await hydrateAccountFromServer(me);
      for (const key of ['mine', 'saved', 'tracker', 'shopping']) await cacheRemove(key);
      setImportOpen(false);
      setImportText('');
      const summary = Object.entries(counts ?? {})
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
        .join('\n');
      Alert.alert(
        L('Import abgeschlossen', 'Import complete'),
        summary || L('Deine Daten wurden übernommen.', 'Your data was restored.'),
      );
    } catch (e) {
      Alert.alert(L('Import fehlgeschlagen', 'Import failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setImportBusy(false);
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
        <PageHeader title={t('settings.settings')} />

        <Pressable
          onPress={() => setProfileOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('s.profileEdit')}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: colors.card,
              padding: 16,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accentSoft,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.accent }}>
              {(user?.name || user?.email || 'S').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
              {user?.name || t('s.profileTitle')}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
              {user?.email || ''}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        <ProfileEditor visible={profileOpen} onClose={() => setProfileOpen(false)} />

        <GlassCard pad={4} radius={20} style={{ marginTop: 12 }}>
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

        <Text style={label}>{t('hh.title')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow
            icon={<Users size={18} color={colors.accent} />}
            label={household?.name ?? t('hh.title')}
            value={household ? `${(household.members ?? []).length}` : undefined}
            onPress={() => navigate('Main' as any, { screen: 'Household' } as any)}
          />
        </GlassCard>

        <Text style={label}>{t('ui.help')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow
            icon={<Play size={18} color={colors.accent} />}
            label={t('tut.restart')}
            onPress={() => {
              void restartTutorial().then(() => setPopup({ title: t('tut.resetTitle'), body: t('tut.resetBody') }));
            }}
          />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Star size={18} color={colors.accent} />} label={t('s.xFeedbackTitle')} onPress={() => setShowFeedback(true)} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Download size={18} color={colors.accent} />} label={t('ui.exportData')} onPress={() => void exportData()} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Upload size={18} color={colors.accent} />} label={L('Daten importieren', 'Import my data')} onPress={() => setImportOpen(true)} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Users size={18} color={colors.accent} />} label={L('Profil & Ziele neu einrichten', 'Redo profile setup')} onPress={redoOnboarding} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Mail size={18} color={colors.accent} />} label={t('ui.contact')} onPress={() => Linking.openURL('mailto:spoonfulsupport@gmail.com')} />
        </GlassCard>

        {showFeedback ? (
          <GlassCard pad={16} radius={20} style={{ marginTop: 12 }}>
            {sent ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.success }}>{t('s.xFeedbackThanks')}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{t('s.xFeedbackAsk')}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                      <Star size={26} color={n <= stars ? '#eab308' : colors.textSecondary} fill={n <= stars ? '#eab308' : 'transparent'} />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder={t('s.xPhFeedback')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={{ minHeight: 84, textAlignVertical: 'top', borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted, color: colors.textPrimary, padding: 12, fontSize: 14, marginTop: 10 }}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => setShowFeedback(false)}
                    style={({ pressed }) => [{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void sendFeedback()}
                    disabled={feedbackBusy}
                    style={({ pressed }) => [{ flex: 2, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed || feedbackBusy ? 0.8 : 1 }]}
                  >
                    <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>{feedbackBusy ? 'Sending…' : t('s.xFeedbackSend')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </GlassCard>
        ) : null}

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

        <Text style={label}>{t('s.profileTitle')}</Text>
        <GlassCard pad={4} radius={20}>
          <NavRow icon={<LogOut size={18} color={colors.textPrimary} />} label={t('nav.signOut')} onPress={doSignOut} />
          <Divider style={{ marginLeft: 16 }} />
          <NavRow icon={<Trash2 size={18} color={colors.rose} />} label={t('ui.deleteAccount')} tint={colors.rose} onPress={deleteAccountPrompt} />
        </GlassCard>

        {errors.length > 0 ? (
          <>
            <Text style={label}>{t('s.errTitle')}</Text>
            <GlassCard pad={14} radius={20}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textPrimary }}>
                {t('s.errCount', { n: errors.length })}
              </Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {errors.slice(0, 3).map((entry) => (
                  <View key={`${entry.at}-${entry.scope}`} style={{ borderRadius: 10, backgroundColor: colors.surfaceMuted, padding: 10 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary }}>
                      {`${new Date(entry.at).toLocaleString()} · ${entry.scope}`}
                    </Text>
                    <Text numberOfLines={3} style={{ fontSize: 12.5, color: colors.textPrimary, marginTop: 2 }}>
                      {entry.message}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => void clearCrashLog()}
                accessibilityRole="button"
                accessibilityLabel={t('s.errClear')}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
              >
                <Trash2 size={15} color={colors.rose} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.rose }}>{t('s.errClear')}</Text>
              </Pressable>
            </GlassCard>
          </>
        ) : null}

        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 26 }}>© 2026 Spoonful · v{APP_VERSION}</Text>
      </ScrollView>

      <Modal visible={importOpen} transparent animationType="slide" onRequestClose={() => setImportOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28, maxHeight: '85%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{L('Daten importieren', 'Import my data')}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 6 }}>
                {L(
                  'Füge hier den Inhalt deiner Spoonful-Sicherung ein. Rezepte, Sammlungen, Mahlzeiten, Gewicht, Einkaufsliste und Onboarding werden übernommen. Vorhandene Einträge bleiben, doppelte werden übersprungen.',
                  'Paste the content of your Spoonful backup here. Recipes, collections, meals, weight, shopping list and onboarding are restored. Existing entries stay and duplicates are skipped.',
                )}
              </Text>
              <Pressable
                onPress={() => void pickBackup()}
                style={({ pressed }) => [{ marginTop: 10, borderRadius: 13, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                  {L('JSON-Datei auswählen', 'Choose JSON file')}
                </Text>
              </Pressable>
              <TextInput
                value={importText}
                onChangeText={setImportText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                placeholder='{"format":"spoonful-export-v2", …}'
                placeholderTextColor={colors.textSecondary}
                style={{ marginTop: 10, minHeight: 150, maxHeight: 300, textAlignVertical: 'top', borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 12, color: colors.textPrimary, fontSize: 12 }}
              />
              <Pressable
                onPress={() => void runImport()}
                disabled={importBusy || !importText.trim()}
                style={({ pressed }) => [{ marginTop: 12, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed || importBusy || !importText.trim() ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.darkButtonText, fontWeight: '800' }}>
                  {importBusy ? L('Wird importiert…', 'Importing…') : L('Sicherung einlesen', 'Restore backup')}
                </Text>
              </Pressable>
              <Pressable onPress={() => setImportOpen(false)} style={{ marginTop: 10, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

