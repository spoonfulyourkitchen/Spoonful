/**
 * 3.1.0: Haushalts-Seite (eigener Tab) — 20 Funktionen.
 *
 *   1 Haushalt gründen          11 Pinnwand (Notizen)
 *   2 Name umbenennen           12 Wochenplan (7 Tage)
 *   3 Einladungscode            13 Plan → Einkaufsliste
 *   4 Mit Code beitreten        14 Vorratskammer
 *   5 Haushalt verlassen        15 Ausgaben + Saldo
 *   6 Mitglieder + Avatare      16 Gemeinsame Einkaufsliste (Kurz)
 *   7 Rollen (Admin/Mitglied)   17 Geteilte Rezepte
 *   8 Aktivitäts-Feed           18 "Was kochen wir?"
 *   9 Kochstand + öffnen        19 Statistik
 *  10 Aufgaben                  20 Erinnerung schicken
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell, ChefHat, ClipboardList, Copy, DoorOpen, Euro, Lightbulb, Package,
  Pencil, Plus, ShoppingCart, Sparkles, Trash2, UsersRound, Utensils, Check,
} from 'lucide-react-native';

import { AppButton, EmptyState, GlassCard, PageHeader, SectionLabel, TextField } from '../components/ui';
import { useTranslation } from '../lib/i18n';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts, rgbaHelper } from '../theme';
import { navigate } from '../navigation/rootRef';
import { showAdminLoginAlert } from '../lib/notifications';
import {
  addExpense, addNamesToShopping, addNote, addPantryItem, addPlanEntry, addTask,
  fetchEvents, fetchExpenses, fetchMembers, fetchNotes, fetchPantry, fetchPlan, fetchSharedRecipes, fetchStats, fetchTasks,
  logEvent, removeExpense, removeNote, removePantryItem, removePlanEntry, removeTask, renameHousehold,
  setHouseholdRole, setTaskDone, shareRecipe, unshareRecipe,
  type HhEvent, type HhExpense, type HhMember, type HhNote, type HhPantryItem, type HhPlanEntry, type HhShared, type HhStats, type HhTask,
} from '../lib/household';

const DAY_KEYS_UNUSED: string[] = [];

export function HouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  /** Kurzer Wochentag in der App-Sprache (kein eigener i18n-Key nötig). */
  const dayLabel = (i: number) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'short' });

  const household = useQuery(api.household.mine) as any;
  const cooking = useQuery(api.householdCooking.state) as any[] | undefined;
  const savedRecipes = useQuery(api.savedRecipes.list) as any[] | undefined;
  const myProfile = useQuery(api.users.currentUser) as any;
  const shopping = useQuery(api.shoppingList.list) as any[] | undefined;

  const createHousehold = useMutation(api.household.create);
  const makeInvite = useMutation(api.household.invite);
  const joinHousehold = useMutation(api.household.join);
  const leaveHousehold = useMutation(api.household.leave);
  const setCheckedMany = useMutation(api.shoppingList.setCheckedMany);
  /** Alle offenen Einkaufsposten abhaken (Funktion 16). */
  const setShoppingDone = (ids: string[]) => setCheckedMany({ ids, checked: true });

  const [members, setMembers] = useState<HhMember[]>([]);
  const [tasks, setTasks] = useState<HhTask[]>([]);
  const [notes, setNotes] = useState<HhNote[]>([]);
  const [plan, setPlan] = useState<HhPlanEntry[]>([]);
  const [pantry, setPantry] = useState<HhPantryItem[]>([]);
  const [expenses, setExpenses] = useState<HhExpense[]>([]);
  const [events, setEvents] = useState<HhEvent[]>([]);
  const [shared, setShared] = useState<HhShared[]>([]);
  const [stats, setStats] = useState<HhStats | null>(null);
  const [ideaSalt, setIdeaSalt] = useState(0);
  const [busy, setBusy] = useState(false);

  // Eingabefelder
  const [nameDraft, setNameDraft] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [planDraft, setPlanDraft] = useState<{ day: number; title: string } | null>(null);
  const [pantryDraft, setPantryDraft] = useState('');
  const [pantryQty, setPantryQty] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const me = String(myProfile?.name || myProfile?.email || t('s.hhYou'));
  const isAdmin = members.some((m) => m.userId === myProfile?.id && m.householdRole === 'admin');

  const refresh = useCallback(async () => {
    const [m, tk, nt, pl, pa, ex, ev, sh, st] = await Promise.all([
      fetchMembers(), fetchTasks(), fetchNotes(), fetchPlan(), fetchPantry(), fetchExpenses(), fetchEvents(), fetchSharedRecipes(), fetchStats(),
    ]);
    setMembers(m);
    setTasks(tk);
    setNotes(nt);
    setPlan(pl);
    setPantry(pa);
    setExpenses(ex);
    setEvents(ev);
    setShared(sh);
    setStats(st);
  }, []);

  useEffect(() => {
    if (!household?.id && !household?.name) return;
    void refresh();
  }, [household?.id, household?.name, refresh]);

  const run = async (fn: () => Promise<any>, after?: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
      if (after) await after();
      void refresh();
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  /* ── Funktionen 1-9: Haushalt, Beitritt, Rollen ─────────────────────────── */
  const doCreate = () =>
    run(() => createHousehold({ name: nameDraft.trim() || `${me} ${t('hh.title')}` }), () => logEvent(me, 'household', t('s.hhFeedCreated')));
  const doRename = () =>
    run(() => renameHousehold(nameDraft.trim() || household?.name || ''), () => {
      setRenameOpen(false);
      return logEvent(me, 'rename', t('s.hhFeedRenamed'));
    });
  const doInvite = async () => {
    setBusy(true);
    try {
      const res: any = await makeInvite({});
      const code = res?.code ?? res?.data?.code ?? null;
      setInvite(code);
      if (code) void Share.share({ message: `${t('hh.shareText')}: ${code}` });
    } catch (e) {
      Alert.alert(t('s.hhError'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  const doJoin = () =>
    run(() => joinHousehold({ code: joinCode.trim() }), () => {
      setJoinCode('');
      return logEvent(me, 'join', t('s.hhFeedJoined'));
    });
  const doLeave = () =>
    Alert.alert(t('hh.leaveConfirm'), undefined, [
      { text: t('s.cropCancel'), style: 'cancel' },
      { text: t('hh.leave'), style: 'destructive', onPress: () => void run(() => leaveHousehold({})) },
    ]);
  const doRole = (m: HhMember) =>
    run(() => setHouseholdRole(m.userId, m.householdRole === 'admin' ? 'member' : 'admin'), () =>
      logEvent(me, 'role', `${m.name}: ${m.householdRole === 'admin' ? t('s.hhRoleMember') : t('s.hhRoleAdmin')}`),
    );

  /* ── Funktion 9: wer kocht gerade ───────────────────────────────────────── */
  const others = (cooking ?? []).filter((c) => c.userId !== myProfile?.id && Date.now() - c.at < 12 * 3600 * 1000);
  const openCooking = (c: any) => navigate('RecipeDetail', { recipeId: c.recipeKey, title: c.title, source: 'mine' });

  /* ── Funktion 10: Aufgaben ─────────────────────────────────────────────── */
  const doAddTask = () =>
    run(
      () => addTask(taskDraft, null, null),
      () => {
        const title = taskDraft.trim();
        setTaskDraft('');
        return logEvent(me, 'task', title);
      },
    );
  const doAssignMe = (tk: HhTask) =>
    run(async () => {
      await removeTask(tk.id);
      await addTask(tk.title, myProfile?.id ?? null, me);
    }, () => logEvent(me, 'task', `${t('s.hhAssignMe')}: ${tk.title}`));
  const toggleTask = (tk: HhTask) =>
    run(() => setTaskDone(tk.id, !tk.done), () => logEvent(me, 'task', `${tk.done ? '↩' : '✔'} ${tk.title}`));

  /* ── Funktion 11: Pinnwand ─────────────────────────────────────────────── */
  const doAddNote = () =>
    run(
      () => addNote(noteDraft, me),
      () => {
        const body = noteDraft.trim().slice(0, 60);
        setNoteDraft('');
        return logEvent(me, 'note', body);
      },
    );

  /* ── Funktionen 12 + 13: Wochenplan → Einkauf ──────────────────────────── */
  const doAddPlan = () => {
    if (!planDraft?.title.trim()) return;
    const { day, title } = planDraft;
    return run(() => addPlanEntry(day, 'dinner', title), () => {
      setPlanDraft(null);
      return logEvent(me, 'plan', title);
    });
  };
  const doPlanToShop = (entry: HhPlanEntry) =>
    run(() => addNamesToShopping([entry.title], entry.title), () => logEvent(me, 'shopping', entry.title));

  /* ── Funktion 14: Vorratskammer ────────────────────────────────────────── */
  const doAddPantry = () =>
    run(
      () => addPantryItem(pantryDraft, pantryQty, null),
      () => {
        const name = pantryDraft.trim();
        setPantryDraft('');
        setPantryQty('');
        return logEvent(me, 'pantry', name);
      },
    );

  /* ── Funktion 15: Ausgaben + Saldo ─────────────────────────────────────── */
  const doAddExpense = () =>
    run(
      () => addExpense(expenseTitle, Number(expenseAmount.replace(',', '.')), me),
      () => {
        const title = expenseTitle.trim();
        const sum = expenseAmount;
        setExpenseTitle('');
        setExpenseAmount('');
        return logEvent(me, 'expense', `${title} ${sum} €`);
      },
    );

  const balance = useMemo(() => {
    const sum = expenses.reduce((s, e) => s + e.amount, 0);
    const mine = expenses.filter((e) => e.userId === myProfile?.id).reduce((s, e) => s + e.amount, 0);
    const perMember = members.length || 1;
    const fair = sum / perMember;
    return { sum, mine, fair, diff: mine - fair };
  }, [expenses, members.length, myProfile?.id]);

  /* ── Funktion 17/18: Rezepte teilen + Idee ─────────────────────────────── */
  const doShareRecipe = (r: any) =>
    run(() => shareRecipe(String(r?.recipeKey ?? r?._id ?? r?.title ?? ''), String(r?.title ?? ''), r?.imageUrl ?? null), () =>
      logEvent(me, 'share', String(r?.title ?? '')),
    );
  const idea = useMemo(() => {
    const pool = [...shared.map((s) => s.title), ...(savedRecipes ?? []).map((r: any) => String(r?.title ?? ''))].filter(Boolean);
    if (!pool.length) return null;
    const seed = new Date().getDate() + pool.length + ideaSalt;
    return pool[seed % pool.length];
  }, [shared, savedRecipes, ideaSalt]);

  /* ── Funktion 16/19/20: Einkauf, Statistik, Erinnerung ─────────────────── */
  const openShopping = (shopping ?? []).filter((i: any) => !i.checked);
  const doClearShopping = () =>
    run(async () => {
      const ids = openShopping.map((i: any) => i.id).filter(Boolean);
      if (!ids.length) return;
      await setShoppingDone(ids);
    }, () => logEvent(me, 'shopping', `${openShopping.length} × ✔`));

  const doRemind = () => {
    const body = t('s.hhRemindBody', { n: tasks.filter((x) => !x.done).length, m: openShopping.length });
    void showAdminLoginAlert(t('s.hhRemindTitle'), body);
    void logEvent(me, 'remind', body);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 46 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow={t('s.hhEyebrow')} title={household?.name || t('hh.title')} subtitle={t('s.hhSubtitle')} />

        {!household ? (
          <GlassCard variant="solid" pad={18}>
            <EmptyState icon={<UsersRound size={22} color={colors.accent} />} title={t('s.hhNoneTitle')} body={t('s.hhNoneBody')} />
            <TextField value={nameDraft} onChangeText={setNameDraft} placeholder={t('s.hhNamePh')} />
            <AppButton label={t('hh.create')} variant="dark" busy={busy} onPress={() => void doCreate()} />
            <View style={{ height: 12 }} />
            <TextField value={joinCode} onChangeText={setJoinCode} placeholder={t('s.hhJoinPh')} autoCapitalize="characters" />
            <AppButton label={t('hh.join')} variant="ghost" disabled={!joinCode.trim() || busy} onPress={() => void doJoin()} />
          </GlassCard>
        ) : (
          <>
            {/* 2 Name · 3 Code · 5 verlassen · 20 erinnern */}
            <GlassCard variant="solid" pad={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>{household.name}</Text>
                <MiniBtn label={t('s.hhRename')} icon={<Pencil size={13} color={colors.textSecondary} />} onPress={() => { setNameDraft(String(household.name ?? '')); setRenameOpen((v) => !v); }} />
              </View>
              {renameOpen ? (
                <View style={{ marginTop: 12 }}>
                  <TextField value={nameDraft} onChangeText={setNameDraft} placeholder={t('s.hhNamePh')} />
                  <AppButton label={t('s.hhSave')} variant="dark" busy={busy} onPress={() => void doRename()} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <MiniBtn label={t('s.hhInviteMake')} icon={<Copy size={13} color={colors.accent} />} onPress={() => void doInvite()} />
                <MiniBtn label={t('s.hhRemind')} icon={<Bell size={13} color={colors.textSecondary} />} onPress={doRemind} />
                <MiniBtn label={t('hh.leave')} danger icon={<DoorOpen size={13} color={colors.rose} />} onPress={doLeave} />
              </View>
              {invite ? (
                <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '800', color: colors.accent }}>{t('s.hhInvite')}: {invite}</Text>
              ) : null}
            </GlassCard>

            {/* 6 Mitglieder · 7 Rollen */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhMembers')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              {members.map((m) => (
                <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>{(m.name || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {m.name}{m.userId === myProfile?.id ? ` · ${t('s.hhYou')}` : ''}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                      {m.householdRole === 'admin' ? t('s.hhRoleAdmin') : t('s.hhRoleMember')}{m.lastSeen ? ` · ${t('s.hhActive')}` : ''}
                    </Text>
                  </View>
                  {isAdmin && m.userId !== myProfile?.id ? (
                    <MiniBtn label={m.householdRole === 'admin' ? t('s.hhMakeMember') : t('s.hhMakeAdmin')} onPress={() => void doRole(m)} />
                  ) : null}
                </View>
              ))}
            </GlassCard>

            {/* 9 wer kocht gerade */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhCookingNow')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              {others.length ? (
                others.map((c) => (
                  <View key={c.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 }}>
                    <ChefHat size={15} color={colors.accent} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textPrimary }}>
                      {t('s.cookHouseholdAt', { name: c.name || '—', n: c.step + 1, total: c.total })}{c.title ? ` · ${c.title}` : ''}
                    </Text>
                    <MiniBtn label={t('s.hhOpen')} onPress={() => openCooking(c)} />
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{t('s.hhCookingNone')}</Text>
              )}
            </GlassCard>

            {/* 10 Aufgaben */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhTasks')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <TextField value={taskDraft} onChangeText={setTaskDraft} placeholder={t('s.hhTaskPh')} />
                </View>
                <MiniBtn label={t('s.hhAdd')} icon={<Plus size={13} color={colors.accent} />} onPress={() => void doAddTask()} />
              </View>
              {tasks.map((tk) => (
                <View key={tk.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                  <Pressable onPress={() => void toggleTask(tk)} style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: tk.done ? colors.success : colors.textSecondary, backgroundColor: tk.done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {tk.done ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, color: tk.done ? colors.textSecondary : colors.textPrimary, textDecorationLine: tk.done ? 'line-through' : 'none' }} numberOfLines={2}>{tk.title}</Text>
                    {tk.assignedName ? <Text style={{ fontSize: 11, color: colors.textSecondary }}>{tk.assignedName}</Text> : null}
                  </View>
                  <MiniBtn label={t('s.hhAssignMe')} onPress={() => void doAssignMe(tk)} />
                  <Pressable onPress={() => void run(() => removeTask(tk.id))} hitSlop={6}>
                    <Trash2 size={15} color={colors.rose} />
                  </Pressable>
                </View>
              ))}
            </GlassCard>

            {/* 11 Pinnwand */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhNotes')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <TextField value={noteDraft} onChangeText={setNoteDraft} placeholder={t('s.hhNotePh')} multiline style={{ marginBottom: 8 }} />
              <MiniBtn label={t('s.hhAdd')} icon={<Plus size={13} color={colors.accent} />} onPress={() => void doAddNote()} />
              {notes.map((n) => (
                <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.cardBorder, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: colors.textPrimary }}>{n.body}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{n.authorName}</Text>
                  </View>
                  <Pressable onPress={() => void run(() => removeNote(n.id))} hitSlop={6}>
                    <Trash2 size={14} color={colors.rose} />
                  </Pressable>
                </View>
              ))}
            </GlassCard>

            {/* 12 + 13 Wochenplan */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhPlan')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const entries = plan.filter((p) => p.day === day);
                const drafting = planDraft?.day === day;
                return (
                  <View key={day} style={{ paddingVertical: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ width: 34, fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{dayLabel(day - 1)}</Text>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: entries.length ? colors.textPrimary : colors.textSecondary }}>
                        {entries.length ? entries.map((e) => e.title).join(' · ') : '—'}
                      </Text>
                      <MiniBtn label={t('s.hhPlanAdd')} onPress={() => setPlanDraft(drafting ? null : { day, title: '' })} />
                    </View>
                    {drafting ? (
                      <View style={{ marginTop: 8 }}>
                        <TextField value={planDraft?.title ?? ''} onChangeText={(v: string) => setPlanDraft({ day, title: v })} placeholder={t('s.hhPlanAdd')} />
                        <MiniBtn label={t('s.hhSave')} onPress={() => void doAddPlan()} />
                      </View>
                    ) : null}
                    {entries.map((e) => (
                      <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 34, marginTop: 4 }}>
                        <Utensils size={13} color={colors.textSecondary} />
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>{e.title}</Text>
                        <MiniBtn label={t('s.hhPlanToShop')} icon={<ShoppingCart size={12} color={colors.accent} />} onPress={() => void doPlanToShop(e)} />
                        <Pressable onPress={() => void run(() => removePlanEntry(e.id))} hitSlop={6}>
                          <Trash2 size={13} color={colors.rose} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                );
              })}
            </GlassCard>

            {/* 14 Vorratskammer */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhPantry')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <TextField value={pantryDraft} onChangeText={setPantryDraft} placeholder={t('s.hhPantryPh')} />
                </View>
                <View style={{ width: 90 }}>
                  <TextField value={pantryQty} onChangeText={setPantryQty} placeholder={t('s.hhQtyPh')} />
                </View>
                <MiniBtn label={t('s.hhAdd')} icon={<Package size={13} color={colors.accent} />} onPress={() => void doAddPantry()} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {pantry.map((p) => (
                  <Pressable
                    key={p.id}
                    onLongPress={() => void run(() => removePantryItem(p.id))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.accentSoft }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{p.name}{p.qty ? ` · ${p.qty}` : ''}</Text>
                  </Pressable>
                ))}
                {!pantry.length ? <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{t('s.hhPantryPh')}</Text> : null}
              </View>
            </GlassCard>

            {/* 15 Ausgaben + Saldo */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhExpenses')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <TextField value={expenseTitle} onChangeText={setExpenseTitle} placeholder={t('s.hhExpensePh')} />
                </View>
                <View style={{ width: 90 }}>
                  <TextField value={expenseAmount} onChangeText={setExpenseAmount} placeholder="€" keyboardType="decimal-pad" />
                </View>
                <MiniBtn label={t('s.hhAdd')} icon={<Euro size={13} color={colors.accent} />} onPress={() => void doAddExpense()} />
              </View>
              {expenses.slice(0, 12).map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{e.title}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{e.payerName}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>{e.amount.toFixed(2)} €</Text>
                  <Pressable onPress={() => void run(() => removeExpense(e.id))} hitSlop={6}>
                    <Trash2 size={13} color={colors.rose} />
                  </Pressable>
                </View>
              ))}
              <Text style={{ marginTop: 8, fontSize: 12.5, color: colors.textSecondary }}>
                {t('s.hhSum')}: {balance.sum.toFixed(2)} € · {t('s.hhSaldo')}: {balance.diff >= 0 ? '+' : ''}{balance.diff.toFixed(2)} €
              </Text>
            </GlassCard>

            {/* 17 Rezepte teilen */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhShared')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              {shared.slice(0, 8).map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                  <Utensils size={13} color={colors.accent} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{s.title}</Text>
                  <Pressable onPress={() => void run(() => unshareRecipe(s.id))} hitSlop={6}>
                    <Trash2 size={13} color={colors.rose} />
                  </Pressable>
                </View>
              ))}
              <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 6 }}>{t('s.hhSharePick')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {(savedRecipes ?? []).slice(0, 8).map((r: any, i: number) => (
                  <Pressable
                    key={String(r?.recipeKey ?? r?._id ?? i)}
                    onPress={() => void doShareRecipe(r)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Plus size={12} color={colors.accent} />
                    <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.textPrimary, maxWidth: 140 }}>{String(r?.title ?? '')}</Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>

            {/* 18 Was kochen wir? */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhIdea')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={16} color={colors.accent} />
                <Text numberOfLines={2} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{idea ?? '—'}</Text>
                <MiniBtn label={t('s.hhIdeaNew')} icon={<Sparkles size={12} color={colors.accent} />} onPress={() => setIdeaSalt((v) => v + 1)} />
              </View>
            </GlassCard>

            {/* 16 Einkaufsliste (Kurz) */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhShopping')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={15} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{openShopping.length} {t('s.hhShoppingOpen')}</Text>
                <MiniBtn label={t('s.hhShoppingClear')} icon={<Check size={12} color={colors.accent} />} onPress={() => void doClearShopping()} />
              </View>
            </GlassCard>

            {/* 19 Statistik */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhStats')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <StatBox label={t('s.hhStatCooks')} value={String(stats?.cookingSessions ?? others.length)} />
                <StatBox label={t('s.hhStatTasks')} value={`${stats?.tasksDone ?? tasks.filter((x) => x.done).length}/${tasks.length}`} />
                <StatBox label={t('s.hhStatSpend')} value={`${balance.sum.toFixed(0)} €`} />
                <StatBox label={t('s.hhPantry')} value={String(stats?.pantryItems ?? pantry.length)} />
              </View>
            </GlassCard>

            {/* 8 Aktivitäts-Feed */}
            <SectionLabel style={{ marginTop: 18 }}>{t('s.hhFeed')}</SectionLabel>
            <GlassCard variant="solid" pad={14}>
              {events.slice(0, 12).map((ev) => (
                <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 }}>
                  <UsersRound size={13} color={colors.textSecondary} />
                  <Text style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>
                    <Text style={{ fontWeight: '800' }}>{ev.actorName} </Text>
                    {ev.text}
                  </Text>
                </View>
              ))}
              {!events.length ? <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{t('s.hhFeedEmpty')}</Text> : null}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 100, flexGrow: 1, borderRadius: 14, backgroundColor: colors.surfaceMuted, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 10.5, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

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
