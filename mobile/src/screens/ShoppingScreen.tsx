import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Share, Text, TextInput, View } from 'react-native';
import { BookmarkCheck, Check, ChefHat, ChevronDown, Pencil, Plus, Search, Share2, ShoppingCart, X } from 'lucide-react-native';
import { useMutation, useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, readableText } from '../theme';
import { Page } from '../navigation/Shell';
import { AppButton, Chip, EmptyState, GlassCard, PageHeader } from '../components/ui';
import { TutorialTarget } from '../components/TutorialTarget';
import { Popup } from '../components/Popup';
import { tutorialAction, useTutorialTarget } from '../lib/tutorial';
import { useCachedList, OfflineBadge, addPendingOp } from '../lib/offline';
import { useTranslation } from '../lib/i18n';
import { SHOP_L10N, pick } from '../lib/l10n';

const QUICK_ADD = ['Eggs', 'Milk', 'Butter', 'Bread', 'Chicken', 'Rice', 'Tomatoes', 'Onions', 'Garlic', 'Salt', 'Olive oil', 'Cheese'];

/** Recipe ingredient line -> shopping item name (drops amount prefixes). */
function cleanIngredient(line: string): string {
  const t = line.trim();
  const m = t.match(/^(?:[\d\s./,-]+)?(?:(?:cup|tbsp|tsp|g|kg|ml|cl|oz|lb|pinch|clove|cloves|handful|bunch|can|jar)\s+)?(.+)$/i);
  const name = (m ? m[1].trim() : t).toLowerCase();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : line;
}

export function ShoppingScreen() {
  const itemsLive = useQuery(api.shoppingList.list);
  const myRecipes = useQuery(api.recipes.list);
  const { data: items, offline, apply } = useCachedList('shopping', itemsLive);
  const addItem = useMutation(api.shoppingList.add);
  const addMany = useMutation(api.shoppingList.addMany);
  const toggleItem = useMutation(api.shoppingList.toggle);
  const updateItem = useMutation(api.shoppingList.update);
  const setMany = useMutation(api.shoppingList.setCheckedMany);
  const removeItem = useMutation(api.shoppingList.remove);
  const clearChecked = useMutation(api.shoppingList.clearChecked);
  const clearAll = useMutation(api.shoppingList.clearAll);
  const household = useQuery(api.household.mine) as any;
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done' | 'have' | 'need'>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  // 2.0.0: aisle vs course grouping, multi check-off, price/have editing
  const [groupBy, setGroupBy] = useState<'aisle' | 'course'>('aisle');
  const [selectMode, setSelectMode] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  /* Tutorial targets: the add-item row and the collapsible extras line. */
  const extrasTarget = useTutorialTarget('tut-shopping-extras', { onPress: () => setExtrasOpen(true) });
  const [selected, setSelected] = useState<string[]>([]);
  const [editItem, setEditItem] = useState<any>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const { t, lang } = useTranslation();

  const list: any[] = items ?? [];
  const recipes: any[] = myRecipes ?? [];
  const total = list.length;
  const checked = list.filter((i) => i.checked).length;
  const progress = total ? Math.round((checked / total) * 100) : 0;
  /** Sum of the prices the user typed in (own basket estimate). */
  const priceSum = list.reduce((sum, i) => sum + (typeof i.price === 'number' && isFinite(i.price) ? i.price : 0), 0);
  const haveCount = list.filter((i) => i.have).length;

  const flash = (msg: string) => {
    setAddedMsg(msg);
    setTimeout(() => setAddedMsg(null), 2600);
  };

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    // simple aisle grouping so the list reads like a shopping route
    const aisleOf = (name: string): number => {
      const n = (name ?? '').toLowerCase();
      if (/(apple|banana|tomato|onion|potato|carrot|salad|lettuce|cucumber|pepper|fruit|vegetable|obst|gemüse|طماطم|بصل|بطاطس|جزر|خيار|تفاح|موز)/.test(n)) return 0;
      if (/(milk|cheese|butter|yogurt|cream|egg|milch|käse|butter|joghurt|حليب|جبن|بيض|زبادي|زبدة)/.test(n)) return 1;
      if (/(chicken|beef|lamb|pork|fish|meat|hähnchen|rind|fleisch|fisch|دجاج|لحم|سمك|روبيان)/.test(n)) return 2;
      if (/(bread|flour|rice|pasta|noodle|brot|mehl|reis|nudel|خبز|أرز|طحين|معكرونة|شعرية)/.test(n)) return 3;
      if (/(oil|vinegar|sauce|spice|salt|sugar|honey|öl|essig|salz|zucker|honig|زيت|خل|صلصة|ملح|سكر|عسل)/.test(n)) return 4;
      if (/(water|juice|wine|beer|drink|cola|wasser|saft|wein|bier|ماء|عصير|شراب)/.test(n)) return 5;
      return 6;
    };
    return [...list]
      .filter((i: any) => {
        if (filter === 'open' && (i.checked || i.have)) return false;
        if (filter === 'done' && !i.checked) return false;
        if (filter === 'have' && !i.have) return false;
        if (filter === 'need' && (i.have || i.checked)) return false;
        if (!q) return true;
        return `${i.name} ${i.recipeTitle ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        if (groupBy === 'course') {
          const order = ['starter', 'main', 'side', 'dessert', 'drink', ''];
          const ca = order.indexOf(String(a.course ?? ''));
          const cb = order.indexOf(String(b.course ?? ''));
          const byCourse = (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
          if (byCourse !== 0) return byCourse;
        }
        const diff = aisleOf(a.name) - aisleOf(b.name);
        if (diff !== 0) return diff;
        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      });
  }, [list, query, filter, groupBy]);

  const onAdd = async () => {
    const v = name.trim();
    if (!v) return;
    setName('');
    if (offline) {
      apply((prev) => [...prev, { _id: `tmp-${Date.now()}`, name: v, checked: false, createdAt: Date.now() }]);
      void addPendingOp('shopping.add', { name: v });
      flash('Saved offline - will sync');
      return;
    }
    try { await addItem({ name: v }); } catch { /* reactive */ }
  };

  const quickAdd = (v: string) => {
    if (offline) {
      apply((prev) => [...prev, { _id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: v, checked: false, createdAt: Date.now() }]);
      void addPendingOp('shopping.add', { name: v });
      return;
    }
    try { void addItem({ name: v }); } catch { /* reactive */ }
  };

  const queueShopOp = (kind: string, optimistic: (prev: any[]) => any[], payload?: any) => {
    apply(optimistic);
    void addPendingOp(kind, payload ?? {});
  };

  const call = async (kind: string, fn: any, arg?: any) => {
    if (offline) {
      if (kind === 'shopping.toggle') queueShopOp(kind, (p) => p.map((i) => (i._id === arg.id ? { ...i, checked: !i.checked } : i)), { id: arg.id });
      else if (kind === 'shopping.remove') queueShopOp(kind, (p) => p.filter((i) => i._id !== arg.id), { id: arg.id });
      else if (kind === 'shopping.clearChecked') queueShopOp(kind, (p) => p.filter((i) => !i.checked));
      else if (kind === 'shopping.clearAll') queueShopOp(kind, () => []);
      else if (kind === 'shopping.update') queueShopOp(kind, (p) => p.map((i) => (i._id === arg.id ? { ...i, ...arg } : i)), arg);
      else if (kind === 'shopping.setCheckedMany') queueShopOp(kind, (p) => p.map((i) => (arg.ids.includes(i._id) ? { ...i, checked: arg.checked } : i)), arg);
      return;
    }
    try { await fn(arg); } catch { /* reactive */ }
  };

  /** Multi check-off: works offline too, so the queue stays consistent. */
  const applyBulkChecked = (ids: string[], value: boolean) => {
    void call('shopping.setCheckedMany', setMany, { ids, checked: value });
    setSelected([]);
  };

  const addFromRecipe = async (recipe: any) => {
    setPickerOpen(false);
    const names = (recipe.ingredients ?? []).map((raw: string) => cleanIngredient(raw)).filter(Boolean) as string[];
    if (!names.length) { flash('That recipe has no ingredients'); return; }
    if (offline) {
      for (const n of names) {
        apply((prev: any[]) => prev.some((i: any) => i.name.toLowerCase() === n.toLowerCase())
          ? prev
          : [...prev, { _id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: n, checked: false, createdAt: Date.now() }]);
        void addPendingOp('shopping.add', { name: n });
      }
      flash(`Queued ${names.length} ingredients offline`);
      return;
    }
    try {
      const res = await addMany({ items: names.map((n: string) => ({ name: n, recipeTitle: recipe.title })) });
      flash(`Added ${(res as any)?.added ?? names.length} from "${recipe.title}"`);
    } catch { /* reactive */ }
  };

  /** Share the open items as plain text (whatsapp, notes, family chat). */
  const shareList = async () => {
    const open = list.filter((i: any) => !i.checked);
    if (!open.length) {
      flash(t('shopping.emptyList'));
      return;
    }
    const text = [
      `${t('shopping.title')}${priceSum > 0 ? ` · ${t('shop.total')}: ${priceSum.toFixed(2)} EUR` : ''}`,
      ...open.map(
        (i: any) => `- ${i.name}${typeof i.price === 'number' ? ` (${i.price.toFixed(2)} EUR)` : ''}${i.recipeTitle ? ` · ${i.recipeTitle}` : ''}`,
      ),
    ].join('\n');
    try {
      await Share.share({ title: t('shopping.title'), message: text });
    } catch {
      flash(t('common.error'));
    }
  };

  return (

    <Page>

      <FlatList
        data={sorted}
        contentContainerStyle={{ padding: 18, gap: 6 }}
        keyExtractor={(i) => i._id}
        ListHeaderComponent={<>
      <View style={{ paddingTop: 4, paddingBottom: 2 }}>
        <PageHeader eyebrow={t('shopping.whatYouNeed')} title={t('shopping.title')} />
        {offline ? <OfflineBadge /> : null}
        <Pressable
          onPress={() => void shareList()}
          style={({ pressed }) => [
            {
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: pressed ? colors.surfaceMuted : colors.card,
              paddingHorizontal: 12,
              paddingVertical: 7,
            },
          ]}
        >
          <Share2 size={14} color={colors.accent} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.accent }}>{t('s.shopShare')}</Text>
        </Pressable>
        <TutorialTarget id="tut-shopping-add" style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 12 }}>
            <Plus size={17} color={colors.textSecondary} />
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                tutorialAction('tut-shopping-add');
              }}
              placeholder={t('shopping.addItemPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={onAdd}
              style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary }}
            />
          </View>
          <Pressable onPress={onAdd} style={({ pressed }) => [{ borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>{t('common.add')}</Text>
          </Pressable>
        </TutorialTarget>

        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 }}>{t('s.shopQuickAdd')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_ADD.map((item) => (
            <Pressable key={item} onPress={() => quickAdd(item)} style={({ pressed }) => [{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Chip label={`${t('common.all')} ${total}`} active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={`${t('shop.needIt')} ${total - checked - haveCount}`} active={filter === 'open'} onPress={() => setFilter('open')} />
          <Chip label={`${t('shop.have')} ${haveCount}`} active={filter === 'have'} onPress={() => setFilter('have')} />
          <Chip label={`${t('common.done')} ${checked}`} active={filter === 'done'} onPress={() => setFilter('done')} tone="green" />
          <Chip label={t('shop.course')} active={groupBy === 'course'} onPress={() => setGroupBy((g) => (g === 'course' ? 'aisle' : 'course'))} />
          <Chip
            label={t('shop.multi')}
            active={selectMode}
            onPress={() => {
              setSelectMode((v) => !v);
              setSelected([]);
            }}
          />
          <Pressable onPress={() => setPickerOpen(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 }]}>
            <ChefHat size={14} color={colors.darkButtonText} />
            <Text style={{ color: colors.darkButtonText, fontWeight: '600', fontSize: 13 }}>{t('shopping.addFromRecipe')}</Text>
          </Pressable>
          <Pressable onPress={shareList} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 7, opacity: pressed ? 0.8 : 1 }]}>
            <Share2 size={14} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{t('shop.shareList')}</Text>
          </Pressable>
        </View>

        {selectMode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <MiniBtn label={t('shop.selectAll')} onPress={() => setSelected(sorted.map((i: any) => i._id))} />
            <MiniBtn label={t('feat.done')} onPress={() => applyBulkChecked(selected, true)} />
            <MiniBtn label={t('shop.needIt')} onPress={() => applyBulkChecked(selected, false)} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{selected.length}</Text>
          </View>
        ) : null}


        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 10 }}>
            <Search size={15} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('s.shopSearch')}
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, paddingVertical: 9, fontSize: 14, color: colors.textPrimary }}
            />
            {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><X size={15} color={colors.textSecondary} /></Pressable> : null}
          </View>
        </View>
        {addedMsg ? (
          <View style={{ marginTop: 8, borderRadius: 10, backgroundColor: colors.successBg, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: colors.success, fontWeight: '700', fontSize: 12.5 }}>{addedMsg}</Text>
          </View>
        ) : null}
      </View>
{total > 0 ? (
          <GlassCard pad={14} radius={18} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t('s.shopChecked', { checked, total })}</Text>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>{progress}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, marginTop: 10, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${progress}%`, backgroundColor: colors.accent, borderRadius: 4 }} />
            </View>
            {/* 2.1.1: this opens a popup instead of unfolding further down */}
            <Pressable
              ref={extrasTarget.ref as any}
              collapsable={false}
              onPress={extrasTarget.onPress}
              accessibilityRole="button"
              accessibilityLabel={t('shop.total')}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, opacity: pressed ? 0.7 : 1 }]}
            >
              {priceSum > 0 ? (
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                  {t('shop.total')}: {priceSum.toFixed(2)} €
                </Text>
              ) : null}
              <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder }} />
              <ChevronDown size={15} color={colors.textSecondary} />
            </Pressable>
          </GlassCard>
        ) : null}</>}
        ListEmptyComponent={
          <EmptyState
            icon={<ShoppingCart size={24} color={colors.accent} strokeWidth={2} />}
            title={t('shopping.emptyList')}
            body={t('s.shopEmptyBody')}
          />
        }

        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              selectMode
                ? setSelected((prev) => (prev.includes(item._id) ? prev.filter((x) => x !== item._id) : [...prev, item._id]))
                : call('shopping.toggle', toggleItem, { id: item._id })
            }
            onLongPress={() => {
              setSelectMode(true);
              setSelected((prev) => (prev.includes(item._id) ? prev : [...prev, item._id]));
            }}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 }]}
          >
            <View
              style={{
                width: 24, height: 24, borderRadius: 7, marginRight: 12,
                borderWidth: 2,
                borderColor:
                  selectMode && selected.includes(item._id)
                    ? colors.accent
                    : item.checked
                      ? colors.success
                      : colors.textSecondary,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor:
                  selectMode && selected.includes(item._id)
                    ? colors.accent
                    : item.checked
                      ? colors.success
                      : 'transparent',
              }}
            >
              {item.checked || (selectMode && selected.includes(item._id)) ? (
                <Check size={14} color={readableText(selectMode && selected.includes(item._id) ? colors.accent : colors.success)} strokeWidth={3} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[{ fontSize: 16, color: colors.textPrimary }, item.checked && { textDecorationLine: 'line-through', color: colors.textSecondary }]}>
                {item.name}
              </Text>
              {item.recipeTitle ? (
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{item.recipeTitle}</Text>
              ) : null}
              {item.have || typeof item.price === 'number' || item.course ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  {item.have ? <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.success }}>{t('shop.haveIt')}</Text> : null}
                  {typeof item.price === 'number' ? (
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.accent }}>{item.price.toFixed(2)} €</Text>
                  ) : null}
                  {item.course ? <Text style={{ fontSize: 10.5, color: colors.textSecondary }}>{t(`shop.${item.course}`)}</Text> : null}
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                setEditItem(item);
                setPriceDraft(typeof item.price === 'number' ? String(item.price) : '');
              }}
              hitSlop={10}
              style={{ paddingHorizontal: 6 }}
            >
              <Pencil size={17} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => call('shopping.remove', removeItem, { id: item._id })} hitSlop={10}>
              <X size={18} color={colors.rose} strokeWidth={2} />
            </Pressable>
          </Pressable>
        )}
      />

      {/* 2.0.0: price / "have it" / course for a single item */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                {editItem?.name}
              </Text>
              <Pressable onPress={() => setEditItem(null)} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{t('shop.prices')}</Text>
            <TextInput
              value={priceDraft}
              onChangeText={setPriceDraft}
              keyboardType="decimal-pad"
              placeholder={t('shop.noPrice')}
              placeholderTextColor={colors.textSecondary}
              style={{ marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, paddingHorizontal: 13, paddingVertical: 11, color: colors.textPrimary }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Chip label={t('shop.haveIt')} active={!!editItem?.have} onPress={() => setEditItem((it: any) => ({ ...it, have: true }))} />
              <Chip label={t('shop.needIt')} active={!!editItem && !editItem.have} onPress={() => setEditItem((it: any) => ({ ...it, have: false }))} />
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 14 }}>{t('shop.course')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {['starter', 'main', 'side', 'dessert', 'drink', 'other'].map((c) => (
                <Chip
                  key={c}
                  label={t(`shop.${c}`)}
                  active={editItem?.course === c}
                  onPress={() => setEditItem((it: any) => ({ ...it, course: it?.course === c ? null : c }))}
                />
              ))}
            </View>

            <AppButton
              label={t('common.save')}
              variant="dark"
              style={{ marginTop: 18 }}
              onPress={() => {
                const it = editItem;
                if (!it) return;
                const parsed = priceDraft.trim() === '' ? null : Number(priceDraft.replace(',', '.'));
                void call('shopping.update', updateItem, {
                  id: it._id,
                  price: parsed === null || Number.isNaN(parsed) ? null : parsed,
                  have: !!it.have,
                  course: it.course ?? null,
                });
                setEditItem(null);
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28, maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, fontFamily: 'serif' }}>{t('s.shopFromRecipe')}</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>{t('s.shopFromRecipeBody')}</Text>
            {recipes.length === 0 ? (
              <EmptyState icon={<BookmarkCheck size={22} color={colors.accent} />} title={t('s.shopNoRecipes')} body={t('s.shopNoRecipesBody')} />
            ) : (
              <FlatList
                data={recipes}
                keyExtractor={(r: any) => r._id}
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }: any) => (
                  <Pressable onPress={() => void addFromRecipe(item)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <ChefHat size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{item.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{(item.ingredients ?? []).length} ingredients</Text>
                    </View>
                    <Plus size={18} color={colors.accent} />
                  </Pressable>
                )}
              />
            )}
            <AppButton label={t('s.shopClose')} variant="ghost" style={{ marginTop: 12 }} onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>

      {/* 2.1.1: the list extras open as a popup, not as an inline expansion */}
      <Popup
        visible={extrasOpen}
        onClose={() => setExtrasOpen(false)}
        closeLabel={t('common.close')}
        icon={<ShoppingCart size={20} color={colors.accent} />}
        title={pick(lang, SHOP_L10N.extrasTitle)}
        body={[
          priceSum > 0 ? `${pick(lang, SHOP_L10N.extrasTotal)}: ${priceSum.toFixed(2)} €` : '',
          household ? `${pick(lang, SHOP_L10N.extrasHousehold)}: ${household.name}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={[
          { label: t('shop.done'), onPress: () => { setExtrasOpen(false); call('shopping.clearChecked', clearChecked); } },
          { label: t('shopping.clearAll'), variant: 'danger', onPress: () => { setExtrasOpen(false); call('shopping.clearAll', clearAll); } },
          { label: t('common.close'), variant: 'ghost', onPress: () => setExtrasOpen(false) },
        ]}
      />
    </Page>
  );
}

function MiniBtn({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: danger ? colors.roseBg : colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ color: danger ? colors.rose : colors.textPrimary, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

