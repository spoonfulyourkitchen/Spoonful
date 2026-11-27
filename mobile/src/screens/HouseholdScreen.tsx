import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChefHat,
  ClipboardList,
  Pencil,
  Plus,
  QrCode,
  Search,
  Share2,
  ShoppingCart,
  Sparkles,
  Trash2,
  UsersRound,
  Utensils,
  Wallet,
  X,
} from 'lucide-react-native';

import { AppButton, EmptyState, GlassCard, MenuOrb, SectionLabel } from '../components/ui';
import { QrCodeView } from '../components/QrCodeView';
import { Collapsible } from '../components/Collapsible';
import { HouseholdQrScannerModal } from '../components/HouseholdQrScannerModal';
import { useTranslation } from '../lib/i18n';
import { clearQueryCacheAndRefresh, useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts, rgbaHelper, mutedOn } from '../theme';
import { navigate } from '../navigation/rootRef';
import { showAdminLoginAlert } from '../lib/notifications';
import { recipeLines } from '../lib/recipe';
import {
  addExpense, addNamesToShopping, addNote, addPantryItem, addPlanEntry, addTask,
  fetchEvents, fetchExpenses, fetchHouseholdLists, fetchMembers, fetchNotes, fetchPantry, fetchPlan, fetchStats, fetchTasks,
  removeExpense, removeHouseholdList, removeNote, removePantryItem, removePlanEntry, removeTask,
  renameHousehold, setHouseholdRole, setTaskAssignee, setTaskDone, updateHouseholdList,
  logEvent, type HhEvent, type HhExpense, type HhList, type HhMember, type HhNote,
  type HhPantryItem, type HhPlanEntry, type HhStats, type HhTask,
} from '../lib/household';

type HouseholdTab = 'today' | 'tasks' | 'shop' | 'plan' | 'more';

type ShopItem = { id: string; name: string; checked: boolean; recipeTitle?: string | null; shared?: boolean };

export function HouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();

  const household = useQuery(api.household.mine) as any;
  const cooking = useQuery(api.householdCooking.state) as any[] | undefined;
  const shoppingRows = useQuery(api.shoppingList.list) as any[] | undefined;
  const myProfile = useQuery(api.users.currentUser) as any;
  const myRecipes = useQuery(api.recipes.list) as any[] | undefined;
  const savedRecipes = useQuery(api.savedRecipes.list) as any[] | undefined;

  const createHousehold = useMutation(api.household.create);
  const makeInvite = useMutation(api.household.invite);
  const joinHousehold = useMutation(api.household.join);
  const leaveHousehold = useMutation(api.household.leave);
  const addShopItem = useMutation(api.shoppingList.add);
  const toggleShopItem = useMutation(api.shoppingList.toggle);
  const removeShopItem = useMutation(api.shoppingList.remove);
  const setCheckedMany = useMutation(api.shoppingList.setCheckedMany);
  const addManyShopping = useMutation(api.shoppingList.addMany);

  const [tab, setTab] = useState<HouseholdTab>('today');
  const [members, setMembers] = useState<HhMember[]>([]);
  const [tasks, setTasks] = useState<HhTask[]>([]);
  const [plan, setPlan] = useState<HhPlanEntry[]>([]);
  const [notes, setNotes] = useState<HhNote[]>([]);
  const [expenses, setExpenses] = useState<HhExpense[]>([]);
  const [pantry, setPantry] = useState<HhPantryItem[]>([]);
  const [events, setEvents] = useState<HhEvent[]>([]);
  const [stats, setStats] = useState<HhStats | null>(null);
  const [lists, setLists] = useState<HhList[]>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [setupMode, setSetupMode] = useState<'create' | 'join'>('create');
  const [nameDraft, setNameDraft] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [openList, setOpenList] = useState<string | null>(null);

  const [taskDraft, setTaskDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [pantryName, setPantryName] = useState('');
  const [pantryQty, setPantryQty] = useState('');
  const [shopDraft, setShopDraft] = useState('');

  const [pickDay, setPickDay] = useState<number | null>(null);
  const [pickTab, setPickTab] = useState<'lib' | 'mine' | 'saved'>('lib');
  const [pickQuery, setPickQuery] = useState('');

  const me = String(myProfile?.name || myProfile?.email || t('s.hhYou'));
  const hasHousehold = !!household;
  const myRole = members.find((m) => m.userId === myProfile?.id)?.householdRole;
  const isAdmin = myRole === 'admin';

  const dayLabel = (i: number) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'short' });
  const todayIndex = ((new Date().getDay() + 6) % 7) + 1;

  useEffect(() => {
    if (!shoppingRows) return;
    setShop(
      shoppingRows.map((r) => ({
        id: String(r?._id ?? r?.id ?? ''),
        name: String(r?.name ?? ''),
        checked: !!r?.checked,
        recipeTitle: r?.recipeTitle ? String(r.recipeTitle) : null,
        shared: !!r?.householdId,
      })),
    );
  }, [shoppingRows]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, tk, pl, nt, ex, ev, st, hl, pt] = await Promise.all([
        fetchMembers(), fetchTasks(), fetchPlan(), fetchNotes(), fetchExpenses(), fetchEvents(), fetchStats(), fetchHouseholdLists(), fetchPantry(),
      ]);
      setMembers(m);
      setTasks(tk);
      setPlan(pl);
      setNotes(nt);
      setExpenses(ex);
      setEvents(ev);
      setStats(st);
      setLists(hl);
      setPantry(pt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('s.hhError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!hasHousehold) return;
    void refresh();
  }, [hasHousehold, household?.name, refresh]);

  const run = async (fn: () => Promise<any>, after?: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
      after?.();
      clearQueryCacheAndRefresh();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('s.hhError'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const code = useMemo(() => {
    if (invite) return invite;
    const raw = String(household?.invite_code ?? household?.code ?? household?.inviteCode ?? '');
    return raw || null;
  }, [invite, household]);

  const ensureInvite = async (): Promise<string | null> => {
    if (code) return code;
    const res: any = await makeInvite({});
    const next = res?.code ?? res?.data?.code ?? null;
    setInvite(next);
    return next;
  };

  const openQr = () => {
    setQrOpen(true);
    if (!code) void ensureInvite().catch((e) => setError(e instanceof Error ? e.message : t('s.hhError')));
  };

  const shareCode = async () => {
    setBusy(true);
    try {
      const value = await ensureInvite();
      if (value) await Share.share({ message: `${t('hh.shareText')}: ${value}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('s.hhError'));
    } finally {
      setBusy(false);
    }
  };

  const resetHouseholdView = () => {
    setMembers([]);
    setTasks([]);
    setPlan([]);
    setNotes([]);
    setExpenses([]);
    setPantry([]);
    setEvents([]);
    setStats(null);
    setLists([]);
    setShop([]);
    setOpenList(null);
    setInvite(null);
    setTab('today');
    clearQueryCacheAndRefresh();
  };

  const doCreate = () =>
    run(() => createHousehold({ name: nameDraft.trim() || `${me} ${t('hh.title')}` }), resetHouseholdView);

  const doJoin = () => {
    const value = joinCode.trim().toUpperCase();
    if (!value) return;
    void run(() => joinHousehold({ code: value }), () => {
      setJoinCode('');
      resetHouseholdView();
    });
  };

  const onScannedCode = (raw: string) => {
    const value = String(raw ?? '').trim();
    const codePart = value.includes(':') ? value.split(':').pop() ?? '' : value;
    const clean = codePart.trim().toUpperCase();
    if (!clean) return;
    setJoinCode(clean);
    void run(() => joinHousehold({ code: clean }), () => {
      setJoinCode('');
      resetHouseholdView();
    });
  };

  const doLeave = () =>
    Alert.alert(t('hh.leaveConfirm'), t('s.hhLeaveNote'), [
      { text: t('s.cropCancel'), style: 'cancel' },
      { text: t('hh.leave'), style: 'destructive', onPress: () => void run(() => leaveHousehold({}), resetHouseholdView) },
    ]);

  const doRename = () => {
    const value = renameDraft.trim();
    if (!value) return;
    void run(() => renameHousehold(value), () => {
      setRenameOpen(false);
      void logEvent(me, 'rename', value);
    });
  };

  const others = (cooking ?? []).filter((c) => c.userId !== myProfile?.id && Date.now() - c.at < 12 * 3600 * 1000);

  const openShop = shop.filter((i) => !i.checked);

  const addToShop = () => {
    const value = shopDraft.trim();
    if (!value) return;
    const temp: ShopItem = { id: `tmp-${Date.now()}`, name: value, checked: false };
    setShop((all) => [...all, temp]);
    setShopDraft('');
    void addShopItem({ name: value })
      .then(() => clearQueryCacheAndRefresh())
      .catch((e) => {
        setShop((all) => all.filter((i) => i.id !== temp.id));
        setError(e instanceof Error ? e.message : t('s.hhError'));
      });
  };

  const toggleShop = (item: ShopItem) => {
    const next = !item.checked;
    setShop((all) => all.map((i) => (i.id === item.id ? { ...i, checked: next } : i)));
    void toggleShopItem({ id: item.id })
      .then(() => clearQueryCacheAndRefresh())
      .catch((e) => {
        setShop((all) => all.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)));
        setError(e instanceof Error ? e.message : t('s.hhError'));
      });
  };

  const removeShopLine = (item: ShopItem) => {
    setShop((all) => all.filter((i) => i.id !== item.id));
    void removeShopItem({ id: item.id })
      .then(() => clearQueryCacheAndRefresh())
      .catch((e) => {
        setShop((all) => [...all, item]);
        setError(e instanceof Error ? e.message : t('s.hhError'));
      });
  };

  const shareShopping = async () => {
    const names = openShop.map((i) => i.name).filter(Boolean);
    const body = names.length ? `${t('shopping.title')}: ${names.join(', ')}` : t('s.hhFeedEmpty');
    try {
      await Share.share({ message: body });
      await logEvent(me, 'shopping', `${names.length} × ${t('s.shopSharedOk')}`);
    } catch {}
  };

  const clearShopping = () => {
    const ids = openShop.map((i) => i.id).filter((id) => !id.startsWith('tmp-'));
    if (!ids.length) return;
    setShop((all) => all.map((i) => ({ ...i, checked: true })));
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
    run(() => addTask(taskDraft, null, null), () => setTaskDraft(''));

  const toggleTask = (tk: HhTask) => {
    const next = !tk.done;
    setTasks((all) => all.map((item) => (item.id === tk.id ? { ...item, done: next } : item)));
    void setTaskDone(tk.id, next)
      .then(() => clearQueryCacheAndRefresh())
      .catch((e) => {
        setTasks((all) => all.map((item) => (item.id === tk.id ? { ...item, done: tk.done } : item)));
        setError(e instanceof Error ? e.message : t('s.hhError'));
      });
  };

  const assignToMe = (tk: HhTask) =>
    void run(() => setTaskAssignee(tk.id, myProfile?.id ?? null, me));

  const doAddExpense = () =>
    run(() => addExpense(expenseTitle, Number(expenseAmount.replace(',', '.')), me), () => {
      setExpenseTitle('');
      setExpenseAmount('');
    });

  const doAddNote = () =>
    run(() => addNote(noteDraft, me), () => setNoteDraft(''));

  const doAddPantry = () =>
    run(() => addPantryItem(pantryName, pantryQty || null, null), () => {
      setPantryName('');
      setPantryQty('');
    });

  const balance = useMemo(() => {
    const sum = expenses.reduce((s, e) => s + e.amount, 0);
    const mine = expenses.filter((e) => e.userId === myProfile?.id).reduce((s, e) => s + e.amount, 0);
    const per = members.length || 1;
    return { sum, diff: mine - sum / per };
  }, [expenses, members.length, myProfile?.id]);

  const toggleHhItem = (list: HhList, index: number) => {
    const previous = list.items;
    const next = list.items.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it));
    setLists((all) => all.map((l) => (l.id === list.id ? { ...l, items: next } : l)));
    void updateHouseholdList(list.id, next)
      .then(() => clearQueryCacheAndRefresh())
      .catch((e) => {
        setLists((all) => all.map((l) => (l.id === list.id ? { ...l, items: previous } : l)));
        setError(e instanceof Error ? e.message : t('s.hhError'));
      });
  };

  const takeList = (list: HhList) =>
    run(async () => {
      const names = list.items.map((it) => it.name).filter(Boolean);
      if (names.length) await addManyShopping({ items: names.map((name) => ({ name, recipeTitle: list.title })) });
      await removeHouseholdList(list.id);
    }, () => setOpenList(null));

  const confirmRemoveList = (list: HhList) =>
    Alert.alert(list.title, undefined, [
      { text: t('s.cropCancel'), style: 'cancel' },
      { text: t('s.hhListRemove'), style: 'destructive', onPress: () => void run(() => removeHouseholdList(list.id)) },
    ]);

  const doRemind = () => {
    const body = t('s.hhRemindBody', { n: tasks.filter((x) => !x.done).length, m: openShop.length });
    void showAdminLoginAlert(t('s.hhRemindTitle'), body);
    void logEvent(me, 'remind', body);
  };

  const openTasks = tasks.filter((x) => !x.done);
  const sortedTasks = [...openTasks, ...tasks.filter((x) => x.done)];
  const todayPlan = plan.filter((p) => p.day === todayIndex);

  const avatar = (name: string, size = 30) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: rgbaHelper(colors.accentText, 0.28), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '900', color: colors.accentText }}>{(name || '?').slice(0, 2).toUpperCase()}</Text>
    </View>
  );

  const tabs: { key: HouseholdTab; label: string }[] = [
    { key: 'today', label: t('nav.overview') },
    { key: 'tasks', label: t('s.hhTasksSection') },
    { key: 'shop', label: t('s.hhShopping') },
    { key: 'plan', label: t('s.hhPlanSection') },
    { key: 'more', label: t('nav.more') },
  ];

  const setupView = (
    <>
      <GlassCard variant="solid" pad={18} style={{ marginTop: 16 }}>
        <EmptyState icon={<UsersRound size={22} color={colors.accentInk} />} title={t('s.hhNoneTitle')} body={t('s.hhNoneBody')} />
      </GlassCard>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {([
          { key: 'create', label: t('hh.create') },
          { key: 'join', label: t('hh.join') },
        ] as const).map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setSetupMode(option.key)}
            style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: setupMode === option.key ? colors.darkButton : colors.surfaceMuted, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '800', color: setupMode === option.key ? colors.darkButtonText : colors.textSecondary }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <GlassCard variant="solid" pad={16} style={{ marginTop: 10 }}>
        {setupMode === 'create' ? (
          <>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder={t('s.hhNamePh')}
              placeholderTextColor={colors.textSecondary}
              editable={!busy}
              style={[inputStyle]}/>
            <AppButton label={t('hh.create')} variant="dark" busy={busy} onPress={() => void doCreate()} />
          </>
        ) : (
          <>
            <TextInput
              value={joinCode}
              onChangeText={(v) => setJoinCode(v.toUpperCase())}
              placeholder={t('s.hhJoinPh')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              editable={!busy}
              style={[inputStyle, { letterSpacing: 3, fontWeight: '800', fontSize: 17 }]}/>
            <AppButton label={t('hh.join')} variant="dark" disabled={!joinCode.trim() || busy} onPress={() => void doJoin()} />
            <Pressable
              onPress={() => setScanOpen(true)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10, borderRadius: 14, paddingVertical: 12, backgroundColor: colors.accentSoft, opacity: pressed ? 0.75 : 1 }]}
            >
              <QrCode size={16} color={colors.accentInk} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accentInk }}>{t('s.scanLive')}</Text>
            </Pressable>
          </>
        )}
      </GlassCard>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 }}>{t('hh.joinHint')}</Text>
    </>
  );

  const notesSection = (
    <>
<SectionLabel style={{ marginTop: 18 }}>{t('s.hhNotes')}</SectionLabel>
      <GlassCard variant="solid" pad={14}>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder={t('s.hhNotePh')}
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={!busy}
          style={[inputStyle, { minHeight: 58, textAlignVertical: 'top' }]}/>
        <ActionPill label={t('s.hhAdd')} icon={<Plus size={13} color={colors.accentInk} />} disabled={!noteDraft.trim() || busy} onPress={() => void doAddNote()} />
        {!notes.length ? <EmptyLine text={t('s.hhFeedEmpty')} /> : null}
        {notes.slice(0, 6).map((n) => (
          <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}>{n.body}</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{n.authorName}</Text>
            </View>
            <Pressable onPress={() => void run(() => removeNote(n.id))} hitSlop={6}>
              <Trash2 size={13} color={colors.rose} />
            </Pressable>
          </View>
        ))}
      </GlassCard>
    </>
  );

  const pantrySection = (
    <>
<SectionLabel>{t('s.hhPantry')}</SectionLabel>
      <GlassCard variant="solid" pad={14}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={pantryName}
            onChangeText={setPantryName}
            placeholder={t('s.hhPantryPh')}
            placeholderTextColor={colors.textSecondary}
            editable={!busy}
            style={[inputStyle, { flex: 1, marginBottom: 0 }]}/>
          <TextInput
            value={pantryQty}
            onChangeText={setPantryQty}
            placeholder={t('s.hhQtyPh')}
            placeholderTextColor={colors.textSecondary}
            editable={!busy}
            style={[inputStyle, { width: 74, marginBottom: 0 }]}/>
          <IconButton icon={<Plus size={17} color={colors.accentInk} />} disabled={!pantryName.trim() || busy} onPress={() => void doAddPantry()} />
        </View>
        {!pantry.length ? <EmptyLine text={t('s.hhFeedEmpty')} /> : null}
        {pantry.slice(0, 10).map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{p.name}</Text>
            {p.qty ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{p.qty}</Text> : null}
            <Pressable onPress={() => void run(() => removePantryItem(p.id))} hitSlop={6}>
              <Trash2 size={13} color={colors.rose} />
            </Pressable>
          </View>
        ))}
      </GlassCard>
    </>
  );

  const tasksView = (
    <>
      <GlassCard variant="solid" pad={14}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={taskDraft}
          onChangeText={setTaskDraft}
          placeholder={t('s.hhTaskPh')}
          placeholderTextColor={colors.textSecondary}
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => (taskDraft.trim() ? void doAddTask() : undefined)}
          style={[inputStyle, { flex: 1, marginBottom: 0 }]}/>
        <IconButton icon={<Plus size={17} color={colors.accentInk} />} disabled={!taskDraft.trim() || busy} onPress={() => void doAddTask()} />
      </View>

      {!tasks.length ? <EmptyLine text={t('s.hhPlanEmpty')} /> : null}

      {sortedTasks.map((tk) => (
        <View key={tk.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 }}>
          <Pressable
            onPress={() => toggleTask(tk)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: tk.done }}
            hitSlop={6}
            style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: tk.done ? colors.success : colors.textSecondary, backgroundColor: tk.done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          >
            {tk.done ? <Check size={13} color={colors.card} strokeWidth={3} /> : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 13.5, color: tk.done ? colors.textSecondary : colors.textPrimary, textDecorationLine: tk.done ? 'line-through' : 'none' }}>
              {tk.title}
            </Text>
            {tk.assignedName ? <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{tk.assignedName}</Text> : null}
          </View>
          {!tk.assignedName && !tk.done ? (
            <Pressable onPress={() => void assignToMe(tk)} hitSlop={6} style={({ pressed }) => [{ borderRadius: 9, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 5, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.textSecondary }}>{t('s.hhAssignMe')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void run(() => removeTask(tk.id))} hitSlop={6} accessibilityLabel={t('s.hhListRemove')}>
            <Trash2 size={14} color={colors.rose} />
          </Pressable>
        </View>
      ))}
      </GlassCard>

      {notesSection}
    </>
  );

  const shopView = (
    <>
      <GlassCard variant="solid" pad={14}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={shopDraft}
            onChangeText={setShopDraft}
            placeholder={t('shopping.addItemPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={addToShop}
            style={[inputStyle, { flex: 1, marginBottom: 0 }]}/>
          <IconButton icon={<Plus size={17} color={colors.accentInk} />} disabled={!shopDraft.trim() || busy} onPress={addToShop} />
        </View>

        {!shop.length ? <EmptyLine text={t('s.shopEmptyBody')} /> : null}

        {shop.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 }}>
            <Pressable
              onPress={() => toggleShop(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.checked }}
              hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: item.checked ? colors.success : colors.textSecondary, backgroundColor: item.checked ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              {item.checked ? <Check size={13} color={colors.card} strokeWidth={3} /> : null}
            </Pressable>
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 13.5, color: item.checked ? colors.textSecondary : colors.textPrimary, textDecorationLine: item.checked ? 'line-through' : 'none' }}>
              {item.name}
            </Text>
            <Pressable onPress={() => removeShopLine(item)} hitSlop={6}>
              <Trash2 size={14} color={colors.rose} />
            </Pressable>
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <ActionPill label={t('s.shopShareHh')} icon={<Share2 size={12} color={colors.accentInk} />} onPress={() => void shareShopping()} />
          {openShop.length ? <ActionPill label={t('s.hhShoppingClear')} icon={<Check size={12} color={colors.textSecondary} />} onPress={clearShopping} /> : null}
        </View>
      </GlassCard>

      {lists.length ? (
        <>
          <SectionLabel style={{ marginTop: 18 }}>{t('s.hhLists')}</SectionLabel>
          <GlassCard variant="solid" pad={14}>
            {lists.map((list) => {
              const openCount = list.items.filter((i) => !i.checked).length;
              return (
                <View key={list.id} style={{ paddingVertical: 2 }}>
                  <Collapsible
                    title={list.title}
                    subtitle={`${list.ownerName} · ${list.items.length - openCount}/${list.items.length}`}
                    open={openList === list.id}
                    onToggle={() => setOpenList(openList === list.id ? null : list.id)}
                  >
                    {list.items.map((it, idx) => (
                      <Pressable key={`${it.name}-${idx}`} onPress={() => toggleHhItem(list, idx)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                        <View style={{ width: 21, height: 21, borderRadius: 7, borderWidth: 2, borderColor: it.checked ? colors.success : colors.textSecondary, backgroundColor: it.checked ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {it.checked ? <Check size={12} color={colors.card} strokeWidth={3} /> : null}
                        </View>
                        <Text style={{ flex: 1, fontSize: 14, color: it.checked ? colors.textSecondary : colors.textPrimary, textDecorationLine: it.checked ? 'line-through' : 'none' }}>{it.name}</Text>
                      </Pressable>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <ActionPill label={t('s.hhListTake')} icon={<ShoppingCart size={12} color={colors.accentInk} />} onPress={() => void takeList(list)} />
                      <ActionPill label={t('s.hhListRemove')} danger icon={<Trash2 size={12} color={colors.rose} />} onPress={() => confirmRemoveList(list)} />
                    </View>
                  </Collapsible>
                </View>
              );
            })}
          </GlassCard>
        </>
      ) : null}

      {pantrySection}
    </>
  );

  const planView = (
    <GlassCard variant="solid" pad={14}>
      {!plan.length ? <EmptyLine text={t('s.hhPlanEmpty')} first /> : null}
      {[1, 2, 3, 4, 5, 6, 7].map((day) => {
        const entries = plan.filter((p) => p.day === day);
        const isToday = day === todayIndex;
        return (
          <View key={day} style={{ paddingVertical: 8, borderTopWidth: entries.length ? 1 : 0, borderTopColor: colors.cardBorder, marginTop: entries.length ? 6 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ width: 38, fontSize: 12.5, fontWeight: '900', color: isToday ? colors.accentInk : entries.length ? colors.textPrimary : colors.textMuted }}>{dayLabel(day - 1)}</Text>
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
                <Plus size={15} color={colors.accentInk} />
              </Pressable>
            </View>
            {entries.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 38, marginTop: 6 }}>
                <Utensils size={12} color={colors.textSecondary} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>{e.title}</Text>
                <Pressable onPress={() => void planToShopping(e)} hitSlop={6} accessibilityLabel={t('s.hhPlanToShop')}>
                  <ShoppingCart size={13} color={colors.accentInk} />
                </Pressable>
                <Pressable onPress={() => void run(() => removePlanEntry(e.id))} hitSlop={6}>
                  <Trash2 size={13} color={colors.rose} />
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}
    </GlassCard>
  );

  const todayView = (
    <>
      {!(todayPlan.length || openTasks.length || openShop.length || others.length) ? (
        <GlassCard variant="solid" pad={14}>
          <EmptyLine text={t('s.hhFeedEmpty')} first />
        </GlassCard>
      ) : null}

      {others.length ? (
        <GlassCard variant="solid" pad={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ChefHat size={15} color={colors.accentInk} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{t('s.hhCookingNow')}</Text>
          </View>
          {others.slice(0, 3).map((c) => (
            <Pressable
              key={c.userId}
              onPress={() => navigate('RecipeDetail', { recipeId: c.recipeKey, title: c.title, source: 'mine' })}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>
                {t('s.cookHouseholdAt', { name: c.name || '-', n: c.step + 1, total: c.total })}{c.title ? ` · ${c.title}` : ''}
              </Text>
              <ArrowRight size={14} color={colors.textSecondary} />
            </Pressable>
          ))}
        </GlassCard>
      ) : null}

      {todayPlan.length ? (
        <GlassCard variant="solid" pad={14} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Utensils size={15} color={colors.accentInk} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{dayLabel(todayIndex - 1)}</Text>
          </View>
          {todayPlan.map((entry) => (
            <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{entry.title}</Text>
              <Pressable onPress={() => void planToShopping(entry)} hitSlop={6}>
                <ShoppingCart size={14} color={colors.accentInk} />
              </Pressable>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {openTasks.length ? (
        <GlassCard variant="solid" pad={14} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={15} color={colors.accentInk} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{t('s.hhTasksSection')}</Text>
            <Pressable onPress={() => setTab('tasks')} hitSlop={6}>
              <ArrowRight size={15} color={colors.textSecondary} />
            </Pressable>
          </View>
          {openTasks.slice(0, 4).map((tk) => (
            <View key={tk.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => toggleTask(tk)}
                hitSlop={6}
                style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' }}
              />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{tk.title}</Text>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {openShop.length ? (
        <GlassCard variant="solid" pad={14} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={15} color={colors.accentInk} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{openShop.length} {t('s.hhShoppingOpen')}</Text>
            <Pressable onPress={() => setTab('shop')} hitSlop={6}>
              <ArrowRight size={15} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {openShop.slice(0, 8).map((item) => (
              <View key={item.id} style={{ borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textPrimary }}>{item.name}</Text>
              </View>
            ))}
            {openShop.length > 8 ? <Text style={{ fontSize: 12, color: colors.textSecondary, alignSelf: 'center' }}>+{openShop.length - 8}</Text> : null}
          </View>
        </GlassCard>
      ) : null}
    </>
  );

  const moreView = (
    <>
      <SectionLabel>{t('s.hhMembers')}</SectionLabel>
      <GlassCard variant="solid" pad={14}>
        {members.map((m) => (
          <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
            {avatar(m.name || '?', 32)}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: colors.textPrimary }}>
                {m.name}{m.userId === myProfile?.id ? ` (${t('s.hhYou')})` : ''}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {m.householdRole === 'admin' ? t('s.hhRoleAdmin') : t('s.hhRoleMember')}
              </Text>
            </View>
            {isAdmin && m.userId !== myProfile?.id ? (
              <ActionPill
                label={m.householdRole === 'admin' ? t('s.hhMakeMember') : t('s.hhMakeAdmin')}
                onPress={() => void run(() => setHouseholdRole(m.userId, m.householdRole === 'admin' ? 'member' : 'admin'))}
              />
            ) : null}
          </View>
        ))}
        {!members.length && loading ? <ActivityIndicator color={colors.accentInk} style={{ marginTop: 8 }} /> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <ActionPill label={t('s.hhShareHh')} icon={<Share2 size={13} color={colors.accentInk} />} onPress={() => void shareCode()} />
          <ActionPill label={t('s.hhRemind')} icon={<Bell size={13} color={colors.textSecondary} />} onPress={doRemind} />
        </View>
      </GlassCard>

      <SectionLabel style={{ marginTop: 18 }}>{t('s.hhExpenses')}</SectionLabel>
      <GlassCard variant="solid" pad={14}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={expenseTitle}
            onChangeText={setExpenseTitle}
            placeholder={t('s.hhExpensePh')}
            placeholderTextColor={colors.textSecondary}
            editable={!busy}
            style={[inputStyle, { flex: 1, marginBottom: 0 }]}/>
          <TextInput
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            placeholder="0,00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            editable={!busy}
            style={[inputStyle, { width: 76, marginBottom: 0 }]}/>
          <IconButton icon={<Plus size={17} color={colors.accentInk} />} disabled={!expenseTitle.trim() || !expenseAmount.trim() || busy} onPress={() => void doAddExpense()} />
        </View>
        {!expenses.length ? <EmptyLine text={t('s.hhFeedEmpty')} /> : null}
        {expenses.slice(0, 6).map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 }}>
            <Wallet size={13} color={colors.textSecondary} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>{e.title}</Text>
            <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{e.payerName}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>{e.amount.toFixed(2)}</Text>
            <Pressable onPress={() => void run(() => removeExpense(e.id))} hitSlop={6}>
              <Trash2 size={13} color={colors.rose} />
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 10 }}>
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>{t('s.hhSum')}: {balance.sum.toFixed(2)}</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: balance.diff >= 0 ? colors.success : colors.rose }}>
            {t('s.hhSaldo')}: {balance.diff >= 0 ? '+' : ''}{balance.diff.toFixed(2)}
          </Text>
        </View>
      </GlassCard>

      <SectionLabel style={{ marginTop: 18 }}>{t('s.hhStats')}</SectionLabel>
      <GlassCard variant="solid" pad={14}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>{t('s.hhStatCooks')}: {stats?.cookingSessions ?? others.length}</Text>
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }}>{t('s.hhStatTasks')}: {tasks.filter((x) => x.done).length}/{tasks.length}</Text>
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'right' }}>{t('s.hhStatSpend')}: {balance.sum.toFixed(2)}</Text>
        </View>
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 8 }}>
          {events.slice(0, 4).map((ev) => (
            <Text key={ev.id} numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, paddingVertical: 3 }}>{ev.actorName} {ev.text}</Text>
          ))}
          {!events.length ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('s.hhFeedEmpty')}</Text> : null}
        </View>
      </GlassCard>

      <GlassCard variant="solid" pad={14} style={{ marginTop: 18, borderColor: rgbaHelper(colors.rose, 0.3) }}>
        <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.textPrimary }}>{t('hh.leaveConfirm')}</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>{t('s.hhLeaveNote')}</Text>
        <View style={{ marginTop: 12 }}>
          <ActionPill label={t('hh.leave')} danger icon={<X size={13} color={colors.rose} />} onPress={doLeave} />
        </View>
      </GlassCard>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {loading || busy ? (
        <View style={{ height: 2, backgroundColor: colors.accentSoft }}>
          <View style={{ width: '45%', height: 2, backgroundColor: colors.accent }} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 52 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.accent} />}
      >
        <View style={{ backgroundColor: colors.darkButton, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase', color: mutedOn(colors.darkButton, colors.darkButtonText, 0.85) }}>
              {t('s.hhEyebrow')}
            </Text>
            {hasHousehold ? (
              <Pressable onPress={openQr} accessibilityLabel={t('s.hhQr')} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: rgbaHelper(colors.darkButtonText, 0.12), opacity: pressed ? 0.75 : 1 }]}>
                <QrCode size={14} color={colors.darkButtonText} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.darkButtonText }}>{t('s.hhQr')}</Text>
              </Pressable>
            ) : null}
            <MenuOrb />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 }}>
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontWeight: '900', color: colors.darkButtonText }}>
              {hasHousehold ? String(household?.name ?? t('hh.title')) : t('hh.title')}
            </Text>
            {hasHousehold && isAdmin ? (
              <Pressable
                onPress={() => {
                  setRenameDraft(String(household?.name ?? ''));
                  setRenameOpen(true);
                }}
                hitSlop={8}
                accessibilityLabel={t('s.hhRename')}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: rgbaHelper(colors.darkButtonText, 0.14) }}
              >
                <Pencil size={15} color={colors.darkButtonText} />
              </Pressable>
            ) : null}
          </View>

          {hasHousehold ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <View style={{ flexDirection: 'row' }}>
                  {members.slice(0, 5).map((m, i) => (
                    <View key={m.userId} style={{ marginLeft: i === 0 ? 0 : -9, borderRadius: 20, borderWidth: 2, borderColor: colors.darkButton }}>
                      {avatar(m.name || '?', 30)}
                    </View>
                  ))}
                </View>
                <Text style={{ flex: 1, fontSize: 12.5, color: mutedOn(colors.darkButton, colors.darkButtonText, 0.85) }} numberOfLines={1}>
                  {members.length} {t('s.hhMembers')}
                </Text>
                <Pressable onPress={() => void shareCode()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}>
                  <Sparkles size={13} color={colors.accentText} />
                  <Text style={{ fontSize: 11.5, fontWeight: '900', color: colors.accentText }}>{code ? code : t('s.hhInviteMake')}</Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <HeroStat value={openShop.length} label={t('s.hhShoppingOpen')} />
                <HeroStat value={openTasks.length} label={t('s.hhTasksSection')} />
                <HeroStat value={plan.length} label={t('s.hhPlanSection')} />
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 13, color: mutedOn(colors.darkButton, colors.darkButtonText, 0.85), marginTop: 6 }}>{t('s.hhSubtitle')}</Text>
          )}
        </View>

        {error ? (
          <Pressable
            onPress={() => setError(null)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: rgbaHelper(colors.rose, 0.35), backgroundColor: rgbaHelper(colors.rose, 0.1), paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Text style={{ flex: 1, fontSize: 12.5, color: colors.textPrimary }}>{error}</Text>
            <X size={15} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        {hasHousehold ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingTop: 16 }}>
            {tabs.map((entry) => (
              <Pressable
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={({ pressed }) => [{
                  borderRadius: 999,
                  paddingHorizontal: 15,
                  paddingVertical: 9,
                  backgroundColor: tab === entry.key ? colors.textPrimary : colors.surfaceMuted,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: tab === entry.key ? colors.card : colors.textSecondary }}>{entry.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          {!hasHousehold ? setupView : tab === 'today' ? todayView : tab === 'tasks' ? tasksView : tab === 'shop' ? shopView : tab === 'plan' ? planView : moreView}
        </View>
      </ScrollView>

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: rgbaHelper('#000000', 0.55), alignItems: 'center', justifyContent: 'center', padding: 18 }}>
            <View style={{ width: '100%', maxWidth: 420, borderRadius: 22, backgroundColor: colors.card, padding: 18 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>{t('s.hhRename')}</Text>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder={t('s.hhNamePh')}
                placeholderTextColor={colors.textSecondary}
                style={[inputStyle, { marginTop: 12 }]}/>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <AppButton label={t('s.cropCancel')} variant="ghost" onPress={() => setRenameOpen(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton label={t('s.hhSave')} variant="dark" busy={busy} disabled={!renameDraft.trim()} onPress={doRename} />
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                ] as const).map((entry) => (
                  <Pressable
                    key={entry.key}
                    onPress={() => setPickTab(entry.key)}
                    style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, backgroundColor: pickTab === entry.key ? colors.darkButton : colors.surfaceMuted, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: pickTab === entry.key ? colors.darkButtonText : colors.textSecondary }}>{entry.label}</Text>
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
                    style={[{ flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary }]}/>
                </View>
              ) : null}

              <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {pickerItems.slice(0, 40).map((r, i) => (
                  <View key={String(r?.recipeKey ?? r?._id ?? r?.id ?? i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                    <Utensils size={15} color={colors.textSecondary} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: colors.textPrimary }}>{String(r?.title ?? '')}</Text>
                    <ActionPill label={t('s.hhPlanToShop')} onPress={() => addRecipeToPlan(r, true)} />
                    <IconButton icon={<Plus size={16} color={colors.accentInk} />} onPress={() => addRecipeToPlan(r, false)} />
                  </View>
                ))}
                {!pickerItems.length ? <Text style={{ fontSize: 12.5, color: colors.textSecondary, paddingVertical: 10 }}>{t('s.hhPlanEmpty')}</Text> : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
              {code ? <QrCodeView value={`SPOONFUL-HH:${code}`} size={250} /> : <ActivityIndicator color={colors.accentInk} />}
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 10, textAlign: 'center' }}>{t('s.hhQrBody')}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>{t('s.hhQrScanHint')}</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', letterSpacing: 3, color: colors.accentInk, marginTop: 10 }}>{t('s.hhCode')}: {code ?? '-'}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'center' }}>
                <Pressable onPress={() => void shareCode()} accessibilityRole="button" accessibilityLabel={t('s.hhShareHh')} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                  <Share2 size={20} color={colors.accentInk} />
                </Pressable>
                <Pressable onPress={() => { setQrOpen(false); setScanOpen(true); }} accessibilityRole="button" accessibilityLabel={t('s.hhScan')} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
                  <Camera size={20} color={colors.accentText} />
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <HouseholdQrScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onCode={onScannedCode} />
    </View>
  );
}

const inputStyle = {
  borderRadius: 12,
  get backgroundColor() { return colors.card; },
  borderWidth: 1,
  get borderColor() { return colors.cardBorder; },
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 14,
  get color() { return colors.textPrimary; },
  marginBottom: 10,
} as const;

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 16, backgroundColor: rgbaHelper(colors.darkButtonText, 0.12), paddingHorizontal: 12, paddingVertical: 11 }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: colors.darkButtonText, letterSpacing: -0.4 }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 10.5, color: mutedOn(colors.darkButton, colors.darkButtonText, 0.85), marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function EmptyLine({ text, first }: { text: string; first?: boolean }) {
  return <Text style={{ fontSize: 12.5, color: colors.textMuted, marginTop: first ? 0 : 10 }}>{text}</Text>;
}

function IconButton({ icon, onPress, disabled }: { icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}
    >
      {icon}
    </Pressable>
  );
}

function ActionPill({ label, onPress, icon, danger, disabled }: { label: string; onPress: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 11,
        backgroundColor: danger ? rgbaHelper(colors.rose, 0.14) : colors.surfaceMuted,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      }]}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: danger ? colors.rose : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

export default HouseholdScreen;
