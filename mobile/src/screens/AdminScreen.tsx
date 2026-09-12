import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, ChevronDown, ChevronUp, Flag, ListChecks, LogIn, MessageSquare, Rocket, Shield, Star, Trash2, UsersRound, XCircle } from 'lucide-react-native';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText } from '../theme';
import { Page } from '../navigation/Shell';
import { navigate } from '../navigation/rootRef';
import { GlassCard, PageHeader, Segmented, TextField } from '../components/ui';
import { RecipeImage } from '../components/RecipeImage';
import { useTranslation } from '../lib/i18n';
import { useAdminLoginAlerts } from '../lib/admin-login';
import { APP_VERSION } from '../config';

type Tab = 'Users' | 'Mods' | 'Feedback' | 'Reports' | 'Reviews' | 'Broadcast' | 'Logins';

const REASONS: { value: 'no_photo' | 'harmless' | 'other'; label: string }[] = [
  { value: 'no_photo', label: 'No photo' },
  { value: 'harmless', label: 'Harmless / too plain' },
  { value: 'other', label: 'Other' },
];

export function AdminScreen() {
  const myRole = useQuery(api.admin.myRole);
  const isAdmin = myRole === 'admin';
  const canModerate = myRole === 'admin' || myRole === 'mod';
  const users = useQuery(api.admin.getAllUsers);
  const feedback = useQuery(api.admin.getAllFeedback);
  const reports = useQuery(api.admin.getImageReports);
  const adminEmails = useQuery(api.admin.getAdminEmails);
  const openCount = useQuery(api.admin.openReportCount);

  const toggleAdmin = useMutation(api.admin.toggleAdmin);
  const addAdminEmail = useMutation(api.admin.addAdminEmail);
  const removeAdminEmail = useMutation(api.admin.removeAdminEmail);
  const markFeedbackRead = useMutation(api.admin.markFeedbackRead);
  const deleteFeedback = useMutation(api.admin.deleteFeedback);
  const resolveReport = useMutation(api.admin.resolveImageReport);
  const dismissReport = useMutation(api.admin.dismissImageReport);
  const pendingShares = useQuery((api.sharing as any).pendingShares);
  const reviewShare = useMutation((api.sharing as any).reviewShare);
  const setRole = useMutation(api.admin.setRole);
  // 2.0.0: broadcast a one-time popup message to all users.
  const announcements = useQuery(api.announcement.list) as any[] | undefined;
  const sendAnnouncement = useMutation(api.announcement.send);
  const deactivateAnnouncement = useMutation(api.announcement.deactivate);
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bBusy, setBBusy] = useState(false);
  const [bNote, setBNote] = useState<string | null>(null);

  /* 2.1.4: "new update" notice - only users on an OLDER version see it. */
  const updateNotices = useQuery(api.updates.list) as any[] | undefined;
  const postUpdate = useMutation(api.updates.post);
  const deactivateUpdate = useMutation(api.updates.deactivate);
  const [uVersion, setUVersion] = useState(APP_VERSION);
  const [uUrl, setUUrl] = useState('');
  const [uTitle, setUTitle] = useState('');
  const [uBody, setUBody] = useState('');
  const [uBusy, setUBusy] = useState(false);
  const [uNote, setUNote] = useState<string | null>(null);

  const publishUpdate = async () => {
    if (uBusy) return;
    setUNote(null);
    if (!uVersion.trim() || !uUrl.trim()) {
      setUNote(t('s.upNeedFields'));
      return;
    }
    setUBusy(true);
    try {
      await postUpdate({
        version: uVersion.trim(),
        url: uUrl.trim(),
        title: uTitle.trim() || t('s.upBox'),
        body: uBody.trim(),
      });
      setUUrl('');
      setUBody('');
      setUNote(t('s.upPublished'));
    } catch (e) {
      setUNote(e instanceof Error ? e.message : t('err.saveFailed'));
    } finally {
      setUBusy(false);
    }
  };

  const publish = async () => {
    if (bBusy) return;
    if (bTitle.trim().length < 3 || bBody.trim().length < 5) {
      setBNote('Please add a title and a message.');
      return;
    }
    setBBusy(true);
    setBNote(null);
    try {
      await sendAnnouncement({ title: bTitle.trim(), body: bBody.trim() });
      setBTitle('');
      setBBody('');
      setBNote('Sent - every user sees this popup once.');
    } catch (e) {
      setBNote(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setBBusy(false);
    }
  };

  const [tab, setTab] = useState<Tab>('Users');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<'no_photo' | 'harmless' | 'other' | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { t } = useTranslation();

  /* 2.1.2: admin-only login feed (local notification + list, no data for users) */
  const loginAlerts = useAdminLoginAlerts({
    title: () => t('adminAlert.loginTitle'),
    body: (name, device) =>
      t('adminAlert.loginBody', { name, device, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
  });

  // Mods get Reports/Feedback/Reviews but not the user-management area.
  useEffect(() => {
    if (canModerate && !isAdmin && tab === 'Users') setTab('Reviews');
  }, [canModerate, isAdmin, tab]);

  if (canModerate === false) {
    return (
      <Page>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={28} color={colors.textSecondary} />
          </View>
          <Text style={{ fontSize: 19, fontWeight: '700', color: colors.textPrimary, marginTop: 14 }}>{t('admin.accessDenied')}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
            {t('admin.needAdmin')}
          </Text>
        </View>
      </Page>
    );
  }

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    setError(null);
    try {
      await addAdminEmail({ email });
      setNewEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add email.');
    } finally {
      setAdding(false);
    }
  };

  const toggleUser = (u: any) => {
    Alert.alert(u.role === 'admin' ? 'Remove admin' : 'Make admin', `${u.name} — change role?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => { try { toggleAdmin({ targetUserId: u._id }); } catch { /* reactive */ } } },
    ]);
  };

  const chooseMod = (u: any, makeMod: boolean) => {
    Alert.alert(makeMod ? 'Make moderator' : 'Remove as moderator', `${u.name} — ${makeMod ? 'can review recipes, reports and feedback' : 'loses moderation rights'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: makeMod ? 'Make mod' : 'Remove',
        style: makeMod ? 'default' : 'destructive',
        onPress: () => { try { void setRole({ userId: u._id, role: makeMod ? 'mod' : 'user' }); } catch { /* reactive */ } },
      },
    ]);
  };

  const confirmDelete = (title: string, onConfirm: () => void) => {
    Alert.alert(`${t('common.delete')}?`, title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const safe = (fn: any) => { try { fn(); } catch { /* reactive */ } };

  return (
    <Page>
      <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
        <PageHeader eyebrow={t('s.adminEyebrow')} title={t('nav.adminPanel')} subtitle={t('admin.desc')} />
        {openCount ? (
          <Text style={{ fontSize: 13, color: colors.accent, marginBottom: 6 }}>{openCount} open image report(s)</Text>
        ) : null}
        <Segmented
          options={isAdmin
            ? [{ value: 'Users', label: 'Users' }, { value: 'Mods', label: 'Mods' }, { value: 'Feedback', label: 'Feedback' }, { value: 'Reports', label: 'Reports' }, { value: 'Reviews', label: 'Reviews' }, { value: 'Broadcast', label: 'Broadcast' }, { value: 'Logins', label: t('adminAlert.listTitle') }]
            : [{ value: 'Feedback', label: 'Feedback' }, { value: 'Reports', label: 'Reports' }, { value: 'Reviews', label: 'Reviews' }]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 10, paddingBottom: 30 }}>
        {tab === 'Reviews' ? (
          <>
            {pendingShares === undefined ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('s.adminLoadShares')}</Text>
            ) : (pendingShares as any[]).length === 0 ? (
              <GlassCard pad={18} radius={20} style={{ alignItems: 'center' }}>
                <ListChecks size={20} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{t('s.adminNoShares')}</Text>
              </GlassCard>
            ) : (
              (pendingShares as any[]).map((s: any) => (
                <GlassCard key={s._id} pad={14} radius={18} variant="solid">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ListChecks size={16} color={colors.medium} />
                    <Pressable
                      onPress={() => navigate('RecipeDetail', {
                        recipeId: s.sourceRecipeId ?? s._id,
                        title: s.title,
                        source: 'community',
                        recipe: {
                          id: s.sourceRecipeId ?? s._id,
                          title: s.title,
                          description: s.description ?? '',
                          ingredients: s.ingredients ?? [],
                          steps: s.steps ?? [],
                          prepTime: s.prepTime ?? 0,
                          cookTime: s.cookTime ?? 0,
                          cuisine: s.cuisine ?? 'Other',
                          dietaryRestrictions: s.dietaryRestrictions ?? [],
                          imageUrl: s.imageUrl,
                          difficulty: s.difficulty ?? 'medium',
                          calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat,
                        },
                      })}
                      style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent, textDecorationLine: 'underline' }} numberOfLines={1}>{s.title}</Text>
                    </Pressable>
                    <View style={{ borderRadius: 999, backgroundColor: colors.mediumBg, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.medium }}>{t('s.adminPending')}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>by {s.ownerName || 'Unknown'} · {s.imageUrl ? 'with photo' : 'no photo'} · tap title for full preview</Text>
                  <Pressable onPress={() => setOpenId(openId === s._id ? null : s._id)} style={({ pressed }) => [{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, opacity: pressed ? 0.7 : 1 }]}>
                    {openId === s._id ? <ChevronUp size={15} color={colors.accent} /> : <ChevronDown size={15} color={colors.accent} />}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                      {openId === s._id ? 'Hide preview' : 'Preview photo + description'}
                    </Text>
                  </Pressable>
                  {openId === s._id ? (
                    <View style={{ marginTop: 8 }}>
                      {s.imageUrl ? (
                        <RecipeImage uri={s.imageUrl} style={{ width: '100%', height: 150, borderRadius: 12 }} />
                      ) : (
                        <View style={{ width: '100%', height: 150, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                          <ListChecks size={22} color={colors.textSecondary} />
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>{t('s.adminNoPhoto')}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textPrimary, marginTop: 10 }}>{s.description || 'No description provided by the cook.'}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
                        {(s.ingredients ?? []).length} ingredients · {(s.steps ?? []).length} steps · Tap the title above for the full recipe
                      </Text>
                    </View>
                  ) : null}

                  {rejectId === s._id ? (
                    <View style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {REASONS.map((r) => (
                          <Pressable key={r.value} onPress={() => setRejectReason(r.value)} style={({ pressed }) => [{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: rejectReason === r.value ? colors.rose : colors.cardBorder, backgroundColor: rejectReason === r.value ? colors.roseBg : colors.card, opacity: pressed ? 0.7 : 1 }]}>
                            <Text style={{ fontSize: 12, fontWeight: rejectReason === r.value ? '800' : '600', color: rejectReason === r.value ? colors.rose : colors.textPrimary }}>{r.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextField value={rejectNote} onChangeText={setRejectNote} placeholder={t('s.adminRejectPh')} style={{ marginTop: 8 }} />
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Pressable onPress={() => setRejectId(null)} style={({ pressed }) => [{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }]}>
                          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('common.cancel')}</Text>
                        </Pressable>
                        <Pressable onPress={() => { try { void reviewShare({ sharedRecipeId: s._id, approve: false, reason: rejectReason ?? 'other', note: rejectNote.trim() }); setRejectId(null); setRejectNote(''); setRejectReason(null); } catch { /* reactive */ } }} style={({ pressed }) => [{ flex: 2, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: colors.rose, opacity: pressed ? 0.85 : 1 }]}>
                          <Text style={{ color: readableText(colors.rose), fontWeight: '800' }}>{t('s.adminRejectShare')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Pressable onPress={() => { try { void reviewShare({ sharedRecipeId: s._id, approve: true }); } catch { /* reactive */ } }} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, backgroundColor: colors.successBg, opacity: pressed ? 0.8 : 1 }]}>
                        <CheckCircle2 size={15} color={colors.success} />
                        <Text style={{ color: colors.success, fontWeight: '800' }}>{t('s.adminApprove')}</Text>
                      </Pressable>
                      <Pressable onPress={() => { setRejectId(s._id); setRejectReason(null); setRejectNote(''); }} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, backgroundColor: colors.roseBg, opacity: pressed ? 0.8 : 1 }]}>
                        <XCircle size={15} color={colors.rose} />
                        <Text style={{ color: colors.rose, fontWeight: '800' }}>{t('s.adminReject')}</Text>
                      </Pressable>
                    </View>
                  )}
                </GlassCard>
              ))
            )}
          </>
        ) : tab === 'Mods' ? (
          <>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{t('s.adminChooseMods')}</Text>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 10 }}>Moderators can approve community recipes and see reports & feedback — but not user management.</Text>
            {users === undefined ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('s.adminLoadUsers')}</Text>
            ) : (users as any[]).length === 0 ? (
              <GlassCard pad={18} radius={20} style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>{t('s.adminNoUsers')}</Text>
              </GlassCard>
            ) : (
              (users as any[]).map((u) => (
                <GlassCard key={u._id} pad={14} radius={18} variant="solid">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: u.role === 'admin' ? colors.accentSoft : u.role === 'mod' ? colors.mediumBg : colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <UsersRound size={17} color={u.role === 'admin' ? colors.accent : u.role === 'mod' ? colors.medium : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{u.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{u.email}</Text>
                    </View>
                    {u.role !== 'user' ? (
                      <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: u.role === 'admin' ? colors.accentSoft : colors.mediumBg }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: u.role === 'admin' ? colors.accent : colors.medium }}>{u.role === 'admin' ? 'ADMIN' : 'MOD'}</Text>
                      </View>
                    ) : null}
                  </View>
                  {u.role !== 'admin' ? (
                    <View style={{ marginTop: 10 }}>
                      <MiniAction
                        danger={u.role === 'mod'}
                        label={u.role === 'mod' ? 'Remove mod' : 'Make mod'}
                        onPress={() => chooseMod(u, u.role !== 'mod')}
                        icon={<UsersRound size={13} color={u.role === 'mod' ? colors.rose : colors.textPrimary} />}
                      />
                    </View>
                  ) : null}
                </GlassCard>
              ))
            )}
          </>
        ) : tab === 'Users' ? (
          <>
            <GlassCard pad={14} radius={20}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 }}>{t('s.adminAdminsEmail')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {(adminEmails ?? []).map((e: string) => (
                  <Pressable key={e} onPress={() => confirmDelete(`Remove ${e}?`, () => safe(() => removeAdminEmail({ email: e })))} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Shield size={12} color={colors.accent} />
                    <Text style={{ fontSize: 12, color: colors.accent }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <TextField value={newEmail} onChangeText={setNewEmail} placeholder={t('s.adminAddAdminPh')} autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 0 }} />
                </View>
                <Pressable onPress={() => void addEmail()} disabled={adding} style={({ pressed }) => [{ borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: pressed || adding ? 0.7 : 1 }]}>
                  <Text style={{ color: colors.accentText, fontWeight: '700' }}>Add</Text>
                </Pressable>
              </View>
              {error ? <Text style={{ color: colors.rose, fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
            </GlassCard>

            {users === undefined ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('s.adminLoadUsers')}</Text>
            ) : (users as any[]).length === 0 ? (
              <GlassCard pad={18} radius={20} style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>{t('s.adminNoUsers')}</Text>
              </GlassCard>
            ) : (
              (users as any[]).map((u) => (
                <GlassCard key={u._id} pad={14} radius={18} variant="solid">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: u.role === 'admin' ? colors.accentSoft : colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <UsersRound size={17} color={u.role === 'admin' ? colors.accent : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{u.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{u.email}</Text>
                    </View>
                    {u.role === 'admin' ? (
                      <View style={{ borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>{t('s.adminBadge')}</Text>
                      </View>
                    ) : null}
                    <Pressable onPress={() => toggleUser(u)} style={({ pressed }) => [{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{u.role === 'admin' ? 'Remove' : 'Promote'}</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        ) : tab === 'Feedback' ? (
          <>
            {feedback === undefined ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('s.adminLoadFb')}</Text>
            ) : (feedback as any[]).length === 0 ? (
              <GlassCard pad={18} radius={20} style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>{t('s.adminNoFb')}</Text>
              </GlassCard>
            ) : (
              (feedback as any[]).map((f: any) => (
                <GlassCard key={f._id} pad={14} radius={18} variant="solid" style={{ opacity: f.read ? 0.75 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={15} color={f.read ? colors.textSecondary : colors.accent} />
                    <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{f.userName || f.userEmail || 'Anonymous'}</Text>
                    {f.rating != null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Star size={13} color="#eab308" fill="#eab308" />
                        <Text style={{ fontSize: 12, color: colors.textPrimary }}>{f.rating}/5</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textPrimary, marginTop: 8 }}>{f.text}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {!f.read ? <MiniAction label={t('s.adminMarkRead')} onPress={() => safe(() => markFeedbackRead({ feedbackId: f._id }))} /> : null}
                    <MiniAction danger label={t('common.delete')} onPress={() => confirmDelete('Delete this feedback?', () => safe(() => deleteFeedback({ feedbackId: f._id })))} icon={<Trash2 size={13} color={colors.rose} />} />
                  </View>
                </GlassCard>
              ))
            )}
          </>
        ) : tab === 'Reports' ? (

          <>
            {reports === undefined ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('s.adminLoadRep')}</Text>
            ) : (reports as any[]).length === 0 ? (
              <GlassCard pad={18} radius={20} style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>{t('s.adminNoRep')}</Text>
              </GlassCard>
            ) : (
              (reports as any[]).map((r: any) => (
                <GlassCard key={r._id} pad={14} radius={18} variant="solid">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Flag size={15} color={colors.rose} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>{r.recipeTitle || r.recipeKey}</Text>
                    <Text style={{ fontSize: 11, color: r.status === 'open' ? colors.rose : colors.textSecondary, textTransform: 'uppercase' }}>{r.status}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>{r.reason}{r.message ? ` — ${r.message}` : ''}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{r.reporterName} · {r.reporterEmail || 'no email'}</Text>
                  {r.status === 'open' ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <MiniAction label={t('s.adminResolve')} onPress={() => safe(() => resolveReport({ reportId: r._id }))} icon={<CheckCircle2 size={13} color={colors.accent} />} />
                      <MiniAction danger label={t('s.adminDismiss')} onPress={() => safe(() => dismissReport({ reportId: r._id }))} icon={<XCircle size={13} color={colors.rose} />} />
                    </View>
                  ) : null}
                </GlassCard>
              ))
            )}
          </>
        ) : tab === 'Logins' ? (
          <>
            {/* 2.1.2: who signed in - admins only (empty list for everyone else) */}
            <GlassCard pad={14} radius={18}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LogIn size={16} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{t('adminAlert.listTitle')}</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {t('adminAlert.onlyAdmins')}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                {loginAlerts.isAdmin ? t('adminAlert.liveOn') : t('adminAlert.liveOff')}
              </Text>
              {loginAlerts.unread ? (
                <Pressable
                  onPress={() => void loginAlerts.markSeen()}
                  accessibilityRole="button"
                  style={({ pressed }) => [{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12.5 }}>
                    {`${loginAlerts.unread} · ${t('adminAlert.markSeen')}`}
                  </Text>
                </Pressable>
              ) : null}
            </GlassCard>

            {loginAlerts.events.length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>{t('adminAlert.empty')}</Text>
            ) : (
              loginAlerts.events.map((e) => (
                <GlassCard key={e.id} pad={13} radius={16} style={{ opacity: e.seen ? 0.62 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {e.name || e.email || '—'}
                    </Text>
                    {e.seen ? null : (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                    {`${t('adminAlert.device')}: ${e.device || '—'}${e.platform ? ` · ${e.platform}` : ''}${e.appVersion ? ` · v${e.appVersion}` : ''}`}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                    {e.at ? new Date(e.at).toLocaleString() : ''}
                  </Text>
                </GlassCard>
              ))
            )}
          </>
        ) : tab === 'Broadcast' ? (
          <>
            {/* 2.1.4: update box on top - older versions get the popup on every start */}
            <GlassCard pad={16} radius={20}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Rocket size={16} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{t('s.upBox')}</Text>
                <View style={{ borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>{`v${APP_VERSION}`}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>{t('s.upHint')}</Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextField label={t('s.upVersion')} value={uVersion} onChangeText={setUVersion} autoCapitalize="none" />
                </View>
                <View style={{ flex: 2 }}>
                  <TextField label={t('s.upTitleField')} value={uTitle} onChangeText={setUTitle} placeholder={t('s.upBox')} />
                </View>
              </View>
              <TextField
                label={t('s.upUrl')}
                value={uUrl}
                onChangeText={setUUrl}
                placeholder={t('s.upUrlPh')}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ marginTop: 8 }}
              />
              <TextField
                value={uBody}
                onChangeText={setUBody}
                placeholder={t('s.upBodyPh')}
                multiline
                style={{ marginTop: 8 }}
              />
              {uNote ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>{uNote}</Text> : null}
              <Pressable
                onPress={() => void publishUpdate()}
                disabled={uBusy}
                style={({ pressed }) => [
                  { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed || uBusy ? 0.8 : 1 },
                ]}
              >
                <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>
                  {uBusy ? t('common.loading') : t('s.upPublish')}
                </Text>
              </Pressable>
            </GlassCard>

            {(updateNotices ?? []).map((u: any) => (
              <GlassCard key={u._id} pad={14} radius={18} style={{ marginTop: 10, opacity: u.active ? 1 : 0.6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Rocket size={14} color={u.active ? colors.accent : colors.textSecondary} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                    {`${u.title || t('s.upBox')} · v${u.version}`}
                  </Text>
                  {u.active ? (
                    <MiniAction danger label={t('s.upDeactivate')} onPress={() => safe(() => deactivateUpdate({ id: u._id }))} icon={<XCircle size={13} color={colors.rose} />} />
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('s.upInactive')}</Text>
                  )}
                </View>
                {u.body ? <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>{u.body}</Text> : null}
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>{u.url}</Text>
              </GlassCard>
            ))}

            <GlassCard pad={16} radius={20}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{t('s.adminPopup')}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>
                {t('s.adminPopupHint')}
              </Text>
              <TextField value={bTitle} onChangeText={setBTitle} placeholder={t('s.adminPopupTitlePh')} style={{ marginTop: 12 }} />
              <TextField value={bBody} onChangeText={setBBody} placeholder={t('s.adminPopupBodyPh')} multiline style={{ marginTop: 8 }} />
              {bNote ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>{bNote}</Text> : null}
              <Pressable
                onPress={() => void publish()}
                disabled={bBusy}
                style={({ pressed }) => [
                  { marginTop: 12, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.darkButton, opacity: pressed || bBusy ? 0.8 : 1 },
                ]}
              >
                <Text style={{ color: colors.darkButtonText, fontWeight: '700' }}>{bBusy ? t('common.loading') : t('s.adminSendAll')}</Text>
              </Pressable>
            </GlassCard>

            {(announcements ?? []).map((a: any) => (
              <GlassCard key={a._id} pad={14} radius={18} style={{ marginTop: 10, opacity: a.active ? 1 : 0.6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{a.title}</Text>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>{a.body}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase' }}>
                    {a.active ? 'active' : 'archived'}
                  </Text>
                  {a.active ? (
                    <MiniAction danger label={t('s.adminArchive')} onPress={() => safe(() => deactivateAnnouncement({ id: a._id }))} />
                  ) : null}
                </View>
              </GlassCard>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Page>
  );
}
function MiniAction({ label, onPress, danger, icon }: { label: string; onPress: () => void; danger?: boolean; icon?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: danger ? colors.roseBg : colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '600', color: danger ? colors.rose : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}
