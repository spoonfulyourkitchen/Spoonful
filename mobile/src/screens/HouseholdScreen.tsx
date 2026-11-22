

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Alert } from '../lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell, Camera, Check, ChefHat, MoreHorizontal, Plus, QrCode, Search, Share2,
  ShoppingCart, Trash2, UsersRound, Utensils, X,
} from 'lucide-react-native';

import { AppButton, EmptyState, GlassCard, PageHeader, SectionLabel } from '../components/ui';
import { QrCodeView } from '../components/QrCodeView';
import { Collapsible } from '../components/Collapsible';
import { HouseholdQrScannerModal } from '../components/HouseholdQrScannerModal';
import { useTranslation } from '../lib/i18n';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts, rgbaHelper } from '../theme';
import { navigate } from '../navigation/rootRef';
import { showAdminLoginAlert } from '../lib/notifications';
import { recipeLines } from '../lib/recipe';
import {
  addExpense, addNamesToShopping, addNote, addPlanEntry, addTask,
  fetchEvents, fetchExpenses, fetchHouseholdLists, fetchMembers, fetchNotes, fetchPlan, fetchStats, fetchTasks,
  removeHouseholdList, updateHouseholdList, type HhList,
  logEvent, removeExpense, removeNote, removePlanEntry, removeTask,
  setHouseholdRole, setTaskDone,
  type HhEvent, type HhExpense, type HhMember, type HhNote, type HhPlanEntry, type HhStats, type HhTask,
} from '../lib/household';

export function HouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();

  const household = useQuery(api.household.mine) as any;
  const cooking = useQuery(api.householdCooking.state) as any[] | undefined;
  const shopping = useQuery(api.shoppingList.list) as any[] | undefined;
  const myProfile = useQuery(api.users.currentUser) as any;
  const myRecipes = useQuery(api.recipes.list) as any[] | undefined;
  const savedRecipes = useQuery(api.savedRecipes.list) as any[] | undefined;

  const createHousehold = useMutation(api.household.create);
  const makeInvite = useMutation(api.household.invite);
  const joinHousehold = useMutation(api.household.join);
  const leaveHousehold = useMutation(api.household.leave);
  const setCheckedMany = useMutation(api.shoppingList.setCheckedMany);
  const addManyShopping = useMutation(api.shoppingList.addMany);

  const [members, setMembers] = useState<HhMember[]>([]);
  const [tasks, setTasks] = useState<HhTask[]>([]);
  const [plan, setPlan] = useState<HhPlanEntry[]>([]);
  const [notes, setNotes] = useState<HhNote[]>([]);
  const [expenses, setExpenses] = useState<HhExpense[]>([]);
  const [events, setEvents] = useState<HhEvent[]>([]);
  const [stats, setStats] = useState<HhStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  
  const [lists, setLists] = useState<HhList[]>([]);
  const [openList, setOpenList] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  
  const [pickDay, setPickDay] = useState<number | null>(null);
  const [pickTab, setPickTab] = useState<'lib' | 'mine' | 'saved'>('lib');
  const [pickQuery, setPickQuery] = useState('');

  const me = String(myProfile?.name || myProfile?.email || t('s.hhYou'));
  const hasHousehold = !!household;
  const isAdmin = members.some((m) => m.userId === myProfile?.id && m.householdRole === 'admin');

  
  const dayLabel = (i: number) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'short' });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, tk, pl, nt, ex, ev, st, hl] = await Promise.all([
        fetchMembers(), fetchTasks(), fetchPlan(), fetchNotes(), fetchExpenses(), fetchEvents(), fetchStats(), fetchHouseholdLists(),
      ]);
      setLists(hl);
      setMembers(m);
      setTasks(tk);
      setPlan(pl);
      setNotes(nt);
      setExpenses(ex);
      setEvents(ev);
      setStats(st);
    } finally {
      setLoading(false);
    }
  }, []);

  
  useEffect(() => {
    if (!hasHousehold) return;
    void refresh();
  }, [hasHousehold, household?.name, refresh]);

  const run = async (fn: () => Promise<any>, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      after?.();
      await refresh();
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const code = useMemo(() => {
    if (invite) return invite;
    const raw = String(household?.invite_code ?? household?.code ?? household?.inviteCode ?? '');
    return raw || null;
  }, [invite, household]);

  
  useEffect(() => {
    if (!qrOpen || code) return;
    (async () => {
      try {
        const res: any = await makeInvite({});
        setInvite(res?.code ?? res?.data?.code ?? null);
      } catch {}
    })();
  }, [qrOpen, code, makeInvite]);

  const qrValue = code ? `SPOONFUL-HH:${code}` : '';

  
  const openQr = () => setQrOpen(true);

  const shareCode = async () => {
    setBusy(true);
    try {
      let value = code;
      if (!value) {
        const res: any = await makeInvite({});
        value = res?.code ?? res?.data?.code ?? null;
        setInvite(value);
      }
      if (value) await Share.share({ message: `${t('hh.shareText')}: ${value}` });
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const doCreate = () => run(() => createHousehold({ name: nameDraft.trim() || `${me} ${t('hh.title')}` }));
  const doJoin = () =>
    run(() => joinHousehold({ code: joinCode.trim().toUpperCase() }), () => {
      setJoinCode('');
    });

  
  const [scanOpen, setScanOpen] = useState(false);
  const onScannedCode = (raw: string) => {
    const value = String(raw ?? '').trim();
    const codePart = value.includes(':') ? value.split(':').pop() ?? '' : value;
    const clean = codePart.trim().toUpperCase();
    if (!clean) return;
    setJoinCode(clean);
    void run(() => joinHousehold({ code: clean }), () => setJoinCode(''));
  };
  const doLeave = () =>
    Alert.alert(t('hh.leaveConfirm'), undefined, [
      { text: t('s.cropCancel'), style: 'cancel' },
      { text: t('hh.leave'), style: 'destructive', onPress: () => void run(() => leaveHousehold({})) },
    ]);

  
  const others = (cooking ?? []).filter((c) => c.userId !== myProfile?.id && Date.now() - c.at < 12 * 3600 * 1000);

  
  const openShopping = (shopping ?? []).filter((i: any) => !i.checked);
  const shareShopping = async () => {
    const names = openShopping.map((i: any) => String(i.name ?? '')).filter(Boolean);
    const body = names.length ? `${t('shopping.title')}: ${names.join(', ')}` : t('s.hhFeedEmpty');
    try {
      await Share.share({ message: body });
      await logEvent(me, 'shopping', `${names.length} × ${t('s.shopSharedOk')}`);
    } catch {}
  };
  const clearShopping = () => {
    const ids = openShopping.map((i: any) => i.id).filter(Boolean);
    if (!ids.length) return;
    void run(() => setCheckedMany({ ids, checked: true }));
  };

  
  const libPage = useQuery(api.recipes.libraryPage, { search: pickTab === 'lib' ? pickQuery : '', limit: 24, offset: 0 }) as any;
  const pickerItems: any[] = useMemo(() => {
    if (pickTab === 'lib') return (libPage?.items ?? []) as any[];
    if (pickTab === 'mine') return (myRecipes ?? []) as any[];
    return (savedRecipes ?? []) as any[];
  }, [pickTab, libPage, myRecipes, savedRecipes]);

  const addRecipeToPlan = (recipe: any, withIngredients: boolean) => {
    if (pickDay == null) return;
    const title = String(recipe?.title ?? '');
    const day = pickDay;
    void run(
      async () => {
        await addPlanEntry(day, 'dinner', title);
        if (withIngredients) {
          const lines = recipeLines(recipe?.ingredients)
            .map((l) => l.replace(/^[\d\s.,/-]+/, '').trim())
            .filter(Boolean);
          if (lines.length) await addManyShopping({ items: lines.map((name) => ({ name, recipeTitle: title })) });
        }
        await logEvent(me, 'plan', title);
      },
      () => setPickDay(null),
    );
  };
  const planToShopping = (entry: HhPlanEntry) => run(() => addNamesToShopping([entry.title], entry.title));

  
  const doAddTask = () =>
    run(() => addTask(taskDraft, null, null), () => {
      setTaskDraft('');
    });
  const toggleTask = (tk: HhTask) => run(() => setTaskDone(tk.id, !tk.done));

  
  const doAddExpense = () =>
    run(() => addExpense(expenseTitle, Number(expenseAmount.replace(',', '.')), me), () => {
      setExpenseTitle('');
      setExpenseAmount('');
    });
  const doAddNote = () =>
    run(() => addNote(noteDraft, me), () => {
      setNoteDraft('');
    });
  const balance = useMemo(() => {
    const sum = expenses.reduce((s, e) => s + e.amount, 0);
    const mine = expenses.filter((e) => e.userId === myProfile?.id).reduce((s, e) => s + e.amount, 0);
    const per = members.length || 1;
    return { sum, diff: mine - sum / per };
  }, [expenses, members.length, myProfile?.id]);

  
  const toggleHhItem = (list: HhList, index: number) => {
    const next = list.items.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it));
    setLists((all) => all.map((l) => (l.id === list.id ? { ...l, items: next } : l)));
    void updateHouseholdList(list.id, next);
  };

  
  const takeList = (list: HhList) =>
    run(async () => {
      const names = list.items.map((it) => it.name).filter(Boolean);
      if (names.length) await addManyShopping({ items: names.map((name) => ({ name, recipeTitle: list.title })) });
      await removeHouseholdList(list.id);
    }, () => setOpenList(null));

  const doRemind = () => {
    const body = t('s.hhRemindBody', { n: tasks.filter((x) => !x.done).length, m: openShopping.length });
    void showAdminLoginAlert(t('s.hhRemindTitle'), body);
    void logEvent(me, 'remind', body);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 46 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <PageHeader
              eyebrow={t('s.hhEyebrow')}
              title={hasHousehold ? String(household?.name ?? t('hh.title')) : t('hh.title')}
              subtitle={hasHousehold ? undefined : t('s.hhSubtitle')}
            />
          </View>
          {hasHousehold ? (
            <Pressable
              onPress={() => void openQr()}
              accessibilityLabel={t('s.hhQr')}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.accentSoft, opacity: pressed ? 0.75 : 1 }]}
            >
              <QrCode size={16} color={colors.accent} />
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{t('s.hhQr')}</Text>
            </Pressable>
          ) : null}
        </View>

        {!hasHousehold ? (
          <GlassCard variant="solid" pad={18}>
            <EmptyState icon={<UsersRound size={22} color={colors.accent} />} title={t('s.hhNoneTitle')} body={t('s.hhNoneBody')} />
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t('s.hhNamePh')}
              placeholderTextColor={colors.textSecondary}
              style={inputStyle}
            />
            <AppButton label={t('hh.create')} variant="dark" busy={busy} onPress={() => void doCreate()} />
            <View style={{ height: 12 }} />
            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={t('s.hhJoinPh')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              style={inputStyle}
            />
            <AppButton label={t('hh.join')} variant="ghost" disabled={!joinCode.trim() || busy} onPress={() => void doJoin()} />
            <Pressable
              onPress={() => setScanOpen(true)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10, borderRadius: 14, paddingVertical: 12, backgroundColor: colors.accentSoft, opacity: pressed ? 0.75 : 1 }]}
            >
              <QrCode size={16} color={colors.accent} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>{t('s.scanLive')}</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <>
            <GlassCard variant="solid" pad={16} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: colors.textSecondary }}>
                    {t('feat.household')}
                  </Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 19, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>
                    {String(household?.name ?? t('hh.title'))}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <UsersRound size={13} color={colors.accent} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>{members.length}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <View style={{ flex: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 }}>{openShopping.length}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t('s.hhShoppingOpen')}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 }}>{tasks.filter((x) => !x.done).length}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t('s.hhTasksSection')}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, padding: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 }}>{plan.length}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t('s.hhPlanSection')}</Text>
                </View>
              </View>
            </GlassCard>

            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhShoppingSection')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={15} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.textPrimary }}>
                  {openShopping.length} {t('s.hhShoppingOpen')}
                </Text>
                <MiniBtn label={t('s.shopShareHh')} icon={<Share2 size={12} color={colors.accent} />} onPress={() => void shareShopping()} />
              </View>
              {openShopping.length ? (
                <Pressable onPress={clearShopping} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, borderRadius: 11, paddingVertical: 9, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
                  <Check size={13} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.hhShoppingClear')}</Text>
                </Pressable>
              ) : null}
            </GlassCard>

            {lists.length ? <SectionLabel style={{ marginTop: 18 }}>{t('s.hhLists')}</SectionLabel> : null}
            {lists.length ? (
            <GlassCard variant="solid" pad={14}>
              {lists.map((list) => (
                <Collapsible
                  key={list.id}
                  title={list.title}
                  subtitle={`${list.ownerName} · ${list.items.filter((i) => !i.checked).length}/${list.items.length}`}
                  open={openList === list.id}
                  onToggle={() => setOpenList(openList === list.id ? null : list.id)}
                >
                  {list.items.map((it, idx) => (
                    <Pressable key={`${it.name}-${idx}`} onPress={() => toggleHhItem(list, idx)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                      <View style={{ width: 21, height: 21, borderRadius: 7, borderWidth: 2, borderColor: it.checked ? colors.success : colors.textSecondary, backgroundColor: it.checked ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {it.checked ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: it.checked ? colors.textSecondary : colors.textPrimary, textDecorationLine: it.checked ? 'line-through' : 'none' }}>{it.name}</Text>
                    </Pressable>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <MiniBtn label={t('s.hhListTake')} onPress={() => void takeList(list)} />
                    <MiniBtn label={t('s.hhListRemove')} danger onPress={() => void run(() => removeHouseholdList(list.id))} />
                  </View>
                </Collapsible>
              ))}
            </GlassCard>
            ) : null}

            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhPlanSection')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              {!plan.length ? <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 8 }}>{t('s.hhPlanEmpty')}</Text> : null}
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const entries = plan.filter((p) => p.day === day);
                return (
                  <View key={day} style={{ paddingVertical: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ width: 32, fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{dayLabel(day - 1)}</Text>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: entries.length ? colors.textPrimary : colors.textMuted }}>
                        {entries.length ? entries.map((e) => e.title).join(' · ') : '-'}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setPickTab('lib');
                          setPickQuery('');
                          setPickDay(day);
                        }}
                        hitSlop={6}
                        style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}
                      >
                        <Plus size={15} color={colors.accent} />
                      </Pressable>
                    </View>
                    {entries.map((e) => (
                      <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 32, marginTop: 4 }}>
                        <Utensils size={12} color={colors.textSecondary} />
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>{e.title}</Text>
                        <MiniBtn label={t('s.hhPlanToShop')} icon={<ShoppingCart size={12} color={colors.accent} />} onPress={() => void planToShopping(e)} />
                        <Pressable onPress={() => void run(() => removePlanEntry(e.id))} hitSlop={6}>
                          <Trash2 size={13} color={colors.rose} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                );
              })}
            </GlassCard>

            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhTasksSection')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={taskDraft}
                  onChangeText={setTaskDraft}
                  placeholder={t('s.hhTaskPh')}
                  placeholderTextColor={colors.textSecondary}
                  style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                />
                <Pressable onPress={() => void doAddTask()} style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                  <Plus size={17} color={colors.accent} />
                </Pressable>
              </View>
              {tasks.map((tk) => (
                <View key={tk.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 }}>
                  <Pressable
                    onPress={() => void toggleTask(tk)}
                    style={{ width: 23, height: 23, borderRadius: 8, borderWidth: 2, borderColor: tk.done ? colors.success : colors.textSecondary, backgroundColor: tk.done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {tk.done ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
                  </Pressable>
                  <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, color: tk.done ? colors.textSecondary : colors.textPrimary, textDecorationLine: tk.done ? 'line-through' : 'none' }}>
                    {tk.title}{tk.assignedName ? ` · ${tk.assignedName}` : ''}
                  </Text>
                  <Pressable onPress={() => void run(() => removeTask(tk.id))} hitSlop={6}>
                    <Trash2 size={14} color={colors.rose} />
                  </Pressable>
                </View>
              ))}
            </GlassCard>

            <Pressable
              onPress={() => setMoreOpen((v) => !v)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: 12, opacity: pressed ? 0.75 : 1 }]}
            >
              <MoreHorizontal size={16} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>{moreOpen ? t('s.hhLess') : t('s.hhMore')}</Text>
            </Pressable>

            {moreOpen ? (
              <>
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhMembers')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {members.map((m) => (
                  <Pressable
                    key={m.userId}
                    onLongPress={() => (isAdmin && m.userId !== myProfile?.id ? void run(() => setHouseholdRole(m.userId, m.householdRole === 'admin' ? 'member' : 'admin')) : undefined)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingLeft: 5, paddingRight: 11, paddingVertical: 5, backgroundColor: colors.surfaceMuted }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>{(m.name || '?').slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: colors.textPrimary }}>
                      {m.name}{m.userId === myProfile?.id ? ` (${t('s.hhYou')})` : ''}
                    </Text>
                    {m.householdRole === 'admin' ? <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.accent }}>★</Text> : null}
                  </Pressable>
                ))}
                {!members.length && loading ? <ActivityIndicator color={colors.accent} /> : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <MiniBtn label={t('s.hhShareHh')} icon={<Share2 size={13} color={colors.accent} />} onPress={() => void shareCode()} />
                <MiniBtn label={t('s.hhRemind')} icon={<Bell size={13} color={colors.textSecondary} />} onPress={doRemind} />
              </View>
            </GlassCard>

            {others.length ? (
              <>
                <SectionLabel style={{ marginTop: 18 }}>{t('s.hhCookingNow')}</SectionLabel>
                <GlassCard variant="solid" pad={14}>
                  {others.slice(0, 3).map((c) => (
                    <Pressable
                      key={c.userId}
                      onPress={() => navigate('RecipeDetail', { recipeId: c.recipeKey, title: c.title, source: 'mine' })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
                    >
                      <ChefHat size={15} color={colors.accent} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>
                        {t('s.cookHouseholdAt', { name: c.name || '-', n: c.step + 1, total: c.total })}{c.title ? ` · ${c.title}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </GlassCard>
              </>
            ) : null}


                <SectionLabel style={{ marginTop: 18 }}>{t('s.hhExpenses')}</SectionLabel>
                <GlassCard variant="solid" pad={14}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      value={expenseTitle}
                      onChangeText={setExpenseTitle}
                      placeholder={t('s.hhExpensePh')}
                      placeholderTextColor={colors.textSecondary}
                      style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                    />
                    <TextInput
                      value={expenseAmount}
                      onChangeText={setExpenseAmount}
                      placeholder="€"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      style={[inputStyle, { width: 72, marginBottom: 0 }]}
                    />
                    <Pressable onPress={() => void doAddExpense()} style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                      <Plus size={17} color={colors.accent} />
                    </Pressable>
                  </View>
                  {expenses.slice(0, 8).map((e) => (
                    <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>{e.title}</Text>
                      <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{e.payerName}</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{e.amount.toFixed(2)} €</Text>
                      <Pressable onPress={() => void run(() => removeExpense(e.id))} hitSlop={6}>
                        <Trash2 size={13} color={colors.rose} />
                      </Pressable>
                    </View>
                  ))}
                  <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
                    {t('s.hhSum')}: {balance.sum.toFixed(2)} € · {t('s.hhSaldo')}: {balance.diff >= 0 ? '+' : ''}{balance.diff.toFixed(2)} €
                  </Text>
                </GlassCard>

                <SectionLabel style={{ marginTop: 18 }}>{t('s.hhNotes')}</SectionLabel>
                <GlassCard variant="solid" pad={14}>
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder={t('s.hhNotePh')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    style={[inputStyle, { minHeight: 54, textAlignVertical: 'top' }]}
                  />
                  <MiniBtn label={t('s.hhAdd')} icon={<Plus size={13} color={colors.accent} />} onPress={() => void doAddNote()} />
                  {notes.slice(0, 6).map((n) => (
                    <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12.5, color: colors.textPrimary }}>{n.body}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{n.authorName}</Text>
                      </View>
                      <Pressable onPress={() => void run(() => removeNote(n.id))} hitSlop={6}>
                        <Trash2 size={13} color={colors.rose} />
                      </Pressable>
                    </View>
                  ))}
                </GlassCard>

                <SectionLabel style={{ marginTop: 18 }}>{t('s.hhStats')}</SectionLabel>
                <GlassCard variant="solid" pad={14}>
                  <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {t('s.hhStatCooks')}: {stats?.cookingSessions ?? others.length} · {t('s.hhStatTasks')}: {stats?.tasksDone ?? tasks.filter((x) => x.done).length}/{tasks.length} · {t('s.hhStatSpend')}: {balance.sum.toFixed(2)} €
                  </Text>
                  {events.slice(0, 4).map((ev) => (
                    <Text key={ev.id} numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                      {ev.actorName} {ev.text}
                    </Text>
                  ))}
                  <View style={{ marginTop: 12 }}>
                    <MiniBtn label={t('hh.leave')} danger icon={<X size={13} color={colors.rose} />} onPress={doLeave} />
                  </View>
                </GlassCard>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={pickDay != null} transparent animationType="fade" onRequestClose={() => setPickDay(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.55), justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, maxHeight: '82%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('s.hhPickRecipe')}</Text>
                <Pressable onPress={() => setPickDay(null)} hitSlop={8}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                {([
                  { key: 'lib', label: t('s.hhPlanFromLib') },
                  { key: 'mine', label: t('s.hhPlanFromMine') },
                  { key: 'saved', label: t('s.hhPlanFromSaved') },
                ] as const).map((tab) => (
                  <Pressable
                    key={tab.key}
                    onPress={() => setPickTab(tab.key)}
                    style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, backgroundColor: pickTab === tab.key ? colors.darkButton : colors.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: pickTab === tab.key ? colors.darkButtonText : colors.textSecondary }}>
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {pickTab === 'lib' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderRadius: 12, backgroundColor: colors.surfaceMuted, paddingHorizontal: 12 }}>
                  <Search size={15} color={colors.textSecondary} />
                  <TextInput
                    value={pickQuery}
                    onChangeText={setPickQuery}
                    placeholder={t('s.hhPickRecipe')}
                    placeholderTextColor={colors.textSecondary}
                    style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary }}
                  />
                </View>
              ) : null}

              <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {pickerItems.slice(0, 40).map((r, i) => (
                  <View key={String(r?.recipeKey ?? r?._id ?? r?.id ?? i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                    <Utensils size={15} color={colors.textSecondary} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textPrimary }}>{String(r?.title ?? '')}</Text>
                    <MiniBtn label={t('s.hhPlanToShop')} onPress={() => addRecipeToPlan(r, true)} />
                    <Pressable onPress={() => addRecipeToPlan(r, false)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                      <Plus size={16} color={colors.accent} />
                    </Pressable>
                  </View>
                ))}
                {!pickerItems.length ? <Text style={{ fontSize: 12.5, color: colors.textSecondary, paddingVertical: 10 }}>{t('s.hhPlanEmpty')}</Text> : null}
              </ScrollView>
            </View>
          </View>
      
        </KeyboardAvoidingView></Modal>

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.55), alignItems: 'center', justifyContent: 'center', padding: 18 }}>
            <View style={{ width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: colors.card, padding: 18, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 }}>
                <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('s.hhQr')}</Text>
                <Pressable onPress={() => setQrOpen(false)} hitSlop={8}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              {qrValue ? <QrCodeView value={qrValue} size={260} /> : <ActivityIndicator color={colors.accent} />}
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 10, textAlign: 'center' }}>{t('s.hhQrBody')}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>{t('s.hhQrScanHint')}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accent, marginTop: 10 }}>
                {t('s.hhCode')}: {code ?? '-'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, alignSelf: 'stretch', justifyContent: 'center' }}>
                <Pressable onPress={() => void shareCode()} accessibilityRole="button" accessibilityLabel={t('s.hhShareHh')} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                  <Share2 size={20} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => { setQrOpen(false); setScanOpen(true); }} accessibilityRole="button" accessibilityLabel={t('s.hhScan')} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
                  <Camera size={20} color={colors.accentText} />
                </Pressable>
              </View>
            </View>
          </View>
      
        </KeyboardAvoidingView></Modal>

      <HouseholdQrScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onCode={onScannedCode} />
    </View>
  );
}

const inputStyle = {
  borderRadius: 12,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.cardBorder,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 14,
  color: colors.textPrimary,
  marginBottom: 10,
} as const;

function MiniBtn({ label, onPress, icon, danger }: { label: string; onPress: () => void; icon?: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 11,
          paddingVertical: 7,
          borderRadius: 11,
          backgroundColor: danger ? rgbaHelper(colors.rose, 0.14) : colors.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon}
      <Text style={{ fontSize: 12, fontWeight: '700', color: danger ? colors.rose : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

export default HouseholdScreen;
