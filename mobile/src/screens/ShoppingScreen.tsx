import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';

import { colors, rgbaHelper } from '../theme';
import { Page } from '../navigation/Shell';
import { EmptyState, PageHeader } from '../components/ui';
import { useTranslation } from '../lib/i18n';
import { clearDraft, loadDraft, saveDraft } from '../lib/draft';
import { useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { shareHouseholdList } from '../lib/household';
import {
  addLocalItem,
  clearLocalChecked,
  getShoppingLocal,
  hydrateShoppingLocal,
  removeLocalItem,
  restoreLocalItem,
  subscribeShoppingLocal,
  toggleLocalItem,
  type LocalShoppingItem,
} from '../lib/shopping-local';

const INPUT_DRAFT = 'shopping-input';
const UNDO_MS = 5000;

export function ShoppingScreen() {
  const { t } = useTranslation();
  const list = useSyncExternalStore(subscribeShoppingLocal, getShoppingLocal, getShoppingLocal);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [removed, setRemoved] = useState<LocalShoppingItem | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const household = useQuery(api.household.mine) as any;
  const [sharedOk, setSharedOk] = useState(false);
  const undoTimer = useRef<any>(null);
  const draftReady = useRef(false);

  useEffect(() => {
    let alive = true;
    hydrateShoppingLocal().then(() => {
      if (alive) setReady(true);
    });
    loadDraft<string>(INPUT_DRAFT).then((value) => {
      if (alive && typeof value === 'string' && value.trim()) {
        setName(value);
      }
      draftReady.current = true;
    });
    return () => {
      alive = false;
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    const timer = setTimeout(() => {
      if (name.trim()) void saveDraft(INPUT_DRAFT, name);
      else void clearDraft(INPUT_DRAFT);
    }, 400);
    return () => clearTimeout(timer);
  }, [name]);

  const openItems = useMemo(() => list.filter((i) => !i.checked), [list]);
  const doneItems = useMemo(() => list.filter((i) => i.checked), [list]);

  const groups = useMemo(() => {
    const map = new Map<string, LocalShoppingItem[]>();
    for (const item of openItems) {
      const key = String(item.recipeTitle ?? '').trim();
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
  }, [openItems]);

  const total = list.length;
  const done = doneItems.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const onAdd = () => {
    const value = name.trim();
    if (!value) return;
    addLocalItem(value);
    setName('');
    void clearDraft(INPUT_DRAFT);
  };

  const shareToHousehold = () => {
    if (!household || !openItems.length) return;
    setSharedOk(true);
    const snapshot = openItems.map((i) => ({ name: i.name, checked: i.checked }));
    void shareHouseholdList(t('shopping.title'), snapshot).then((res) => {
      if (!res.ok) setSharedOk(false);
    });
  };

  const onRemove = useCallback((item: LocalShoppingItem) => {
    removeLocalItem(item.id);
    setRemoved(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS);
  }, []);

  const undoRemove = () => {
    if (!removed) return;
    restoreLocalItem(removed);
    setRemoved(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  const toggle = useCallback((id: string) => {
    toggleLocalItem(id);
  }, []);

  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
        <PageHeader eyebrow={t('shopping.whatYouNeed')} title={t('shopping.title')} subtitle={`${openItems.length} ${t('s.shopOpen')}`} />

        {total ? (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>
                {done} / {total} {t('common.done')}
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{pct}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 3, backgroundColor: colors.accent }} />
            </View>
          </View>
        ) : null}

        {household && openItems.length ? (
          <Pressable
            onPress={shareToHousehold}
            accessibilityRole="button"
            accessibilityLabel={t('s.shopToHousehold')}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, borderRadius: 14, paddingVertical: 11, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 }]}
          >
            <Check size={15} color={colors.accent} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
              {sharedOk ? t('s.shopSharedToHh') : t('s.shopToHousehold')}
            </Text>
          </Pressable>
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
            style={({ pressed }) => [
              {
                width: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.accent,
                opacity: pressed ? 0.8 : name.trim() ? 1 : 0.55,
              },
            ]}
          >
            <Plus size={22} color={colors.accentText} strokeWidth={2.6} />
          </Pressable>
        </View>

        {removed ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          >
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
              {t('s.shopRemoved', { name: removed.name })}
            </Text>
            <Pressable onPress={undoRemove} hitSlop={8}>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{t('s.undo')}</Text>
            </Pressable>
          </View>
        ) : null}

        {ready && !list.length ? (
          <EmptyState icon={<ShoppingCart size={22} color={colors.accent} />} title={t('shopping.emptyList')} body={t('s.shopEmptyBody')} />
        ) : null}

        {groups.map((group) => (
          <View
            key={group.title || 'own'}
            style={{
              marginBottom: 10,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: colors.card,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            {group.title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 2 }}>
                <ShoppingCart size={12} color={colors.accent} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textSecondary }}>
                  {group.title}
                </Text>
              </View>
            ) : null}
            {group.items.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={toggle} onRemove={onRemove} />
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
                  <ItemRow key={item.id} item={item} onToggle={toggle} onRemove={onRemove} />
                ))}
                <Pressable
                  onPress={clearLocalChecked}
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

const ItemRow = React.memo(function ItemRow({ item, onToggle, onRemove }: { item: LocalShoppingItem; onToggle: (id: string) => void; onRemove: (item: LocalShoppingItem) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => onToggle(item.id)}
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
