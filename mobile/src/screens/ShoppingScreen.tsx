/**
 * 3.2.0: Einkaufsliste — komplett neu und bewusst einfach.
 *
 *   * oben eingeben (oder über "Add to shopping list" bei einem Rezept füllen)
 *   * Liste nach Rezept gruppiert; neben jeder Gruppe steht "Zum Haushalt"
 *   * pro Haushalt höchstens ZWEI Listen; danach kommt ein Hinweis
 *   * keine Filter-Chips, keine Extras, kein Rezept-Import-Knopf
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, ShoppingCart, Trash2, UsersRound } from 'lucide-react-native';

import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, rgbaHelper } from '../theme';
import { Page } from '../navigation/Shell';
import { EmptyState, PageHeader } from '../components/ui';
import { useCachedList, OfflineBadge } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { shareHouseholdList, type HhShoppingItem } from '../lib/household';

type Item = { _id: string; name: string; checked: boolean; recipeTitle?: string | null };

export function ShoppingScreen() {
  const { t } = useTranslation();
  const itemsLive = useQuery(api.shoppingList.list);
  const { data: items, offline } = useCachedList('shopping', itemsLive);
  const household = useQuery(api.household.mine) as any;

  const addItem = useMutation(api.shoppingList.add);
  const toggleItem = useMutation(api.shoppingList.toggle);
  const removeItem = useMutation(api.shoppingList.remove);
  const clearChecked = useMutation(api.shoppingList.clearChecked);

  const [name, setName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const list = useMemo(() => ((items ?? []) as Item[]).filter((i) => !!i && !!i._id), [items]);
  const openItems = useMemo(() => list.filter((i) => !i.checked), [list]);
  const doneItems = useMemo(() => list.filter((i) => i.checked), [list]);

  /** Nach Rezept gruppiert - genau so, wie "Add to shopping list" befüllt. */
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of openItems) {
      const key = String(it.recipeTitle ?? '').trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).map(([title, groupItems]) => ({ title, items: groupItems }));
  }, [openItems]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };

  const onAdd = () => {
    const value = name.trim();
    if (!value) return;
    setName('');
    try {
      void addItem({ name: value });
    } catch {
      flash(t('common.error'));
    }
  };

  const toggle = (item: Item) => {
    try {
      void toggleItem({ id: item._id });
    } catch {
      flash(t('common.error'));
    }
  };

  const remove = (item: Item) => {
    try {
      void removeItem({ id: item._id });
    } catch {
      flash(t('common.error'));
    }
  };

  /** "Zum Haushalt": Posten in eine Haushalts-Liste schieben (max. 2). */
  const shareGroup = async (title: string, groupItems: Item[]) => {
    if (!household) {
      flash(t('s.shopNeedHousehold'));
      return;
    }
    const label = title || t('s.shopOwn');
    setBusyKey(label);
    try {
      const payload: HhShoppingItem[] = groupItems.map((i) => ({ name: i.name, checked: false }));
      const res = await shareHouseholdList(label, payload);
      if (!res.ok) {
        flash(/limit/i.test(String(res.error)) ? t('s.shopLimit') : t('s.shopShareFail'));
        return;
      }
      for (const item of groupItems) {
        try {
          await removeItem({ id: item._id });
        } catch {
          /* egal, im Haushalt sind sie schon */
        }
      }
      flash(t('s.shopSharedToHh'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PageHeader
              eyebrow={t('shopping.whatYouNeed')}
              title={t('shopping.title')}
              subtitle={`${openItems.length} ${t('s.shopOpen')} · ${doneItems.length} ${t('common.done')}`}
            />
          </View>
          {offline ? <OfflineBadge /> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 12 }}>
            <Plus size={17} color={colors.textSecondary} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('shopping.addItemPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={onAdd}
              style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary }}
            />
          </View>
          <Pressable onPress={onAdd} style={({ pressed }) => [{ borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>{t('common.add')}</Text>
          </Pressable>
        </View>

        {notice ? (
          <View style={{ marginBottom: 12, borderRadius: 12, backgroundColor: colors.accentSoft, paddingHorizontal: 12, paddingVertical: 9 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.accent }}>{notice}</Text>
          </View>
        ) : null}

        {!list.length ? (
          <EmptyState icon={<ShoppingCart size={22} color={colors.accent} />} title={t('shopping.empty')} body={t('s.shopEmptyBody')} />
        ) : null}

        {groups.map((group) => (
          <View key={group.title || 'own'} style={{ marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={15} color={colors.accent} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
                {group.title || t('s.shopOwn')}
              </Text>
              <Pressable
                onPress={() => void shareGroup(group.title, group.items)}
                disabled={busyKey === (group.title || t('s.shopOwn'))}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.accentSoft, opacity: pressed ? 0.75 : 1 }]}
              >
                <UsersRound size={12} color={colors.accent} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.accent }}>{t('s.shopToHousehold')}</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 6 }}>
              {group.items.map((item) => (
                <Row key={item._id} item={item} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
              ))}
            </View>
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
                  <Row key={item._id} item={item} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
                ))}
                <Pressable
                  onPress={() => void clearChecked({})}
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

/** Eine Zeile: tippen = abhaken, lange drücken = löschen. */
function Row({ item, onToggle, onRemove }: { item: Item; onToggle: () => void; onRemove: () => void }) {
  return (
    <Pressable onPress={onToggle} onLongPress={onRemove} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, opacity: pressed ? 0.7 : 1 }]}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: item.checked ? colors.success : colors.textSecondary,
          backgroundColor: item.checked ? colors.success : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.checked ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
      </View>
      <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, color: item.checked ? colors.textSecondary : colors.textPrimary, textDecorationLine: item.checked ? 'line-through' : 'none' }}>
        {item.name}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8} style={{ padding: 2 }}>
        <Trash2 size={15} color={rgbaHelper(colors.rose, 0.85)} />
      </Pressable>
    </Pressable>
  );
}

export default ShoppingScreen;
