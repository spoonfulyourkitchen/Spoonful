import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, ShoppingCart, Trash2, UsersRound } from 'lucide-react-native';

import { colors, rgbaHelper } from '../theme';
import { Page } from '../navigation/Shell';
import { EmptyState, PageHeader } from '../components/ui';
import { useTranslation } from '../lib/i18n';
import { clearDraft, loadDraft, saveDraft } from '../lib/draft';
import { clearQueryCacheAndRefresh, useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import {
  getShoppingLocal,
  hydrateShoppingLocal,
  resetShoppingLocal,
  type LocalShoppingItem,
} from '../lib/shopping-local';
import { showNotice } from '../components/AppNotice';
import {
  addPendingOp,
  pendingOpsCount,
  pendingSettleDelay,
  subscribePendingOps,
} from '../lib/offline';

const INPUT_DRAFT = 'shopping-input';

type Item = LocalShoppingItem & { shared?: boolean };

export function ShoppingScreen() {
  const { t, tn } = useTranslation();
  const rows = useQuery(api.shoppingList.list) as any[] | undefined;
  const addItem = useMutation(api.shoppingList.add);
  const addMany = useMutation(api.shoppingList.addMany);
  const toggleItem = useMutation(api.shoppingList.toggle);
  const removeItem = useMutation(api.shoppingList.remove);
  const clearChecked = useMutation(api.shoppingList.clearChecked);

  const [items, setItems] = useState<Item[]>([]);
  const [synced, setSynced] = useState(false);
  const [name, setName] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const draftReady = useRef(false);
  const migrated = useRef(false);

  const mapRows = useCallback(
    (list: any[]): Item[] => list.map((r) => ({
      id: String(r?._id ?? r?.id ?? ''),
      name: String(r?.name ?? ''),
      checked: !!r?.checked,
      recipeTitle: r?.recipeTitle ? String(r.recipeTitle) : null,
      at: Number(r?.createdAt) || 0,
      shared: !!r?.householdId,
    })),
    [],
  );

  useEffect(() => {
    let alive = true;
    hydrateShoppingLocal().then(() => {
      if (!alive) return;
      if (!synced) {
        const local = getShoppingLocal();
        if (local.length) setItems(local.map((i) => ({ ...i })));
      }
    });
    loadDraft<string>(INPUT_DRAFT).then((value) => {
      if (alive && typeof value === 'string' && value.trim()) setName(value);
      draftReady.current = true;
    });
    return () => {
      alive = false;
    };
  }, [synced]);

  const pending = useSyncExternalStore(subscribePendingOps, pendingOpsCount, pendingOpsCount);

  useEffect(() => {
    if (!rows) return;
    setSynced(true);
    // A queued change is ahead of this answer: never overwrite what the user did.
    if (pending > 0) return;
    const delay = pendingSettleDelay();
    if (!delay) {
      setItems(mapRows(rows));
      return;
    }
    const timer = setTimeout(() => setItems(mapRows(rows)), delay);
    return () => clearTimeout(timer);
  }, [rows, mapRows, pending]);

  useEffect(() => {
    if (!rows || migrated.current || rows.length) return;
    migrated.current = true;
    const local = getShoppingLocal();
    if (!local.length) return;
    void addMany({ items: local.map((i) => ({ name: i.name, recipeTitle: i.recipeTitle ?? null })) })
      .then(() => {
        resetShoppingLocal();
        clearQueryCacheAndRefresh();
      })
      .catch(() => undefined);
  }, [rows, addMany]);

  useEffect(() => {
    if (!draftReady.current) return;
    const timer = setTimeout(() => {
      if (name.trim()) void saveDraft(INPUT_DRAFT, name);
      else void clearDraft(INPUT_DRAFT);
    }, 400);
    return () => clearTimeout(timer);
  }, [name]);

  const openItems = useMemo(() => items.filter((i) => !i.checked), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.checked), [items]);
  const sharedCount = useMemo(() => items.filter((i) => i.shared).length, [items]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of openItems) {
      const key = String(item.recipeTitle ?? '').trim();
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return Array.from(map.entries()).map(([title, list]) => ({ title, items: list }));
  }, [openItems]);

  const total = items.length;
  const pct = total ? Math.round((doneItems.length / total) * 100) : 0;

  const onAdd = () => {
    const value = name.trim();
    if (!value) return;
    const temp: Item = { id: `tmp-${Date.now()}`, name: value, checked: false, at: Date.now() };
    setItems((all) => [...all, temp]);
    setName('');
    void clearDraft(INPUT_DRAFT);
    void addItem({ name: value })
      .then(() => clearQueryCacheAndRefresh())
      .catch((e) => {
        setItems((all) => all.filter((i) => i.id !== temp.id));
        showNotice({ title: e instanceof Error ? e.message : t('s.hhError'), tone: 'error' });
      });
  };

  const onToggle = (item: Item) => {
    const next = !item.checked;
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, checked: next } : i)));
    void toggleItem({ id: item.id })
      .then(() => clearQueryCacheAndRefresh())
      .catch(() => {
        // The server gets more time in the queue; the checkbox stays as tapped.
        void addPendingOp('shopping.toggle', { id: item.id });
      });
  };

  const onRemove = (item: Item) => {
    setItems((all) => all.filter((i) => i.id !== item.id));
    showNotice({
      title: t('s.shopRemoved', { name: item.name }),
      tone: 'info',
      actions: [{ label: t('s.undo'), onPress: () => undoRemove(item) }],
    });
    void removeItem({ id: item.id })
      .then(() => clearQueryCacheAndRefresh())
      .catch(() => {
        void addPendingOp('shopping.remove', { id: item.id });
      });
  };

  const undoRemove = (back: Item) => {
    setItems((all) => (all.some((i) => i.id === back.id) ? all : [...all, back]));
    void addItem({ name: back.name, recipeTitle: back.recipeTitle ?? null })
      .then(() => clearQueryCacheAndRefresh())
      .catch(() => undefined);
  };

  const clearDone = () => {
    setItems((all) => all.filter((i) => !i.checked));
    void clearChecked({})
      .then(() => clearQueryCacheAndRefresh())
      .catch(() => {
        void addPendingOp('shopping.clearChecked', {});
      });
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 0, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
        <PageHeader eyebrow={t('shopping.whatYouNeed')} title={t('shopping.title')} subtitle={`${openItems.length} ${tn('s.shopOpen', openItems.length)}`} />

        {!synced ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accentInk} />
          </View>
        ) : null}

        {total ? (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>
                {doneItems.length} / {total} {t('common.done')}
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accentInk }}>{pct}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: colors.accent }} />
            </View>
          </View>
        ) : null}

        {sharedCount ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, borderRadius: 12, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 9 }}>
            <UsersRound size={14} color={colors.accentInk} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.accentInk }}>{t('s.shopSharedToHh')}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('shopping.addItemPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={onAdd}
            returnKeyType="done"
            style={{
              flex: 1,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: colors.card,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 16,
              color: colors.textPrimary,
            }}
          />
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t('common.add')}
            style={({ pressed }) => [{
              width: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              opacity: pressed ? 0.8 : name.trim() ? 1 : 0.55,
            }]}
          >
            <Plus size={22} color={colors.accentText} strokeWidth={2.6} />
          </Pressable>
        </View>

        {synced && !items.length ? (
          <EmptyState icon={<ShoppingCart size={22} color={colors.accentInk} />} title={t('shopping.emptyList')} body={t('s.shopEmptyBody')} />
        ) : null}

        {groups.map((group) => (
          <View
            key={group.title || 'own'}
            style={{ marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            {group.title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 2 }}>
                <ShoppingCart size={12} color={colors.accentInk} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textSecondary }}>
                  {group.title}
                </Text>
              </View>
            ) : null}
            {group.items.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={onToggle} onRemove={onRemove} />
            ))}
          </View>
        ))}

        {doneItems.length ? (
          <View style={{ marginTop: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, overflow: 'hidden' }}>
            <Pressable onPress={() => setDoneOpen((v) => !v)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, opacity: pressed ? 0.8 : 1 }]}>
              <Check size={15} color={colors.success} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                {t('common.done')} · {doneItems.length}
              </Text>
              {doneOpen ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
            </Pressable>
            {doneOpen ? (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                {doneItems.map((item) => (
                  <ItemRow key={item.id} item={item} onToggle={onToggle} onRemove={onRemove} />
                ))}
                <Pressable
                  onPress={clearDone}
                  style={({ pressed }) => [{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 }]}
                >
                  <Trash2 size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.shopClearDone')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Page>
  );
}

const ItemRow = React.memo(function ItemRow({ item, onToggle, onRemove }: { item: Item; onToggle: (item: Item) => void; onRemove: (item: Item) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => onToggle(item)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!item.checked }}
        style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, opacity: pressed ? 0.7 : 1 }]}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: item.checked ? colors.success : colors.cardBorder,
            backgroundColor: item.checked ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.checked ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
        </View>
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            fontSize: 15.5,
            color: item.checked ? colors.textSecondary : colors.textPrimary,
            textDecorationLine: item.checked ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </Text>
      </Pressable>
      <Pressable onPress={() => onRemove(item)} hitSlop={12} accessibilityLabel={item.name} style={{ padding: 6 }}>
        <Trash2 size={16} color={rgbaHelper(colors.rose, 0.8)} />
      </Pressable>
    </View>
  );
});

export default ShoppingScreen;
