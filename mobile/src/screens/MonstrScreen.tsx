/**
 * 3.2.1: MONSTR — Monster-Energy-Preise aus drei Quellen.
 *
 * Wichtig: Diese Seite ignoriert das App-Theme absichtlich und bleibt **immer
 * schwarz + neon** (das ist der Look der Seite).
 *
 * Die Preise kommen aus `lib/deals.ts` (Preisrunter · Marktguru · ALDI Süd).
 * Die Seite lädt nur, wenn der Nutzer auf „Preise holen“ tippt, hält das letzte
 * Ergebnis im Zwischenspeicher und zeichnet die Trefferliste mit einer
 * memoisierten FlatList — dadurch bleibt sie auch mit vielen Treffern flüssig.
 *
 * Kein fester Text im Code: jede Beschriftung ist ein i18n-Schlüssel (`s.mon…`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, RefreshCw, ShoppingCart, UsersRound, Zap } from 'lucide-react-native';

import { useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { shareHouseholdList } from '../lib/household';
import { useTutorialTarget } from '../lib/tutorial';
import {
  formatSize,
  formatUnitPrice,
  formatValidity,
  loadDealsResult,
  searchDeals,
  type Deal,
  type DealSource,
  type DealsResult,
} from '../lib/deals';

/* Neon-Palette — bewusst fest, nicht aus dem Theme. */
const NEON = {
  bg: '#050506',
  card: '#0D0F12',
  cardSoft: '#12151A',
  line: 'rgba(124,255,0,0.28)',
  hairline: 'rgba(255,255,255,0.06)',
  green: '#7CFF00',
  pink: '#FF2E88',
  cyan: '#00E5FF',
  text: '#F2FFF2',
  dim: '#8A9A8A',
};

const SOURCE_LABEL: Record<DealSource, string> = {
  preisrunter: 's.monSrcPreis',
  marktguru: 's.monSrcMarktguru',
  aldi: 's.monSrcAldi',
};

const priceText = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;

/** Eine Trefferzeile. Memoisiert: Scrollen zeichnet nur neue Zeilen. */
function DealRowBase({ deal, onOpen }: { deal: Deal; onOpen: (deal: Deal) => void }) {
  const unit = formatUnitPrice(deal);
  const size = formatSize(deal);
  const canOpen = !!deal.url;
  return (
    <Pressable
      onPress={() => (canOpen ? onOpen(deal) : undefined)}
      accessibilityRole={canOpen ? 'link' : undefined}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 11,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: unit ? NEON.line : NEON.hairline,
          backgroundColor: NEON.card,
          opacity: pressed && canOpen ? 0.8 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: '700', color: NEON.text }}>
          {deal.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11.5, color: NEON.dim, marginTop: 2 }}>
          {[deal.market, size, formatValidity(deal)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 15, fontWeight: '900', color: NEON.green }}>{priceText(deal.price)}</Text>
        {unit ? <Text style={{ fontSize: 11, fontWeight: '700', color: NEON.cyan }}>{unit}</Text> : null}
      </View>
      {canOpen ? <ExternalLink size={14} color={NEON.dim} /> : null}
    </Pressable>
  );
}

/** Memoisiert: beim Scrollen werden nur neue Zeilen gezeichnet. */
const DealRow = React.memo(DealRowBase);

/** Kleiner Neon-Chip (bleibt immer dunkel). */
function NeonChip({ label, tone = 'green' }: { label: string; tone?: 'green' | 'cyan' | 'off' }) {
  const color = tone === 'cyan' ? NEON.cyan : tone === 'off' ? NEON.dim : NEON.green;
  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tone === 'off' ? NEON.hairline : color,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 10.5, fontWeight: '800', color }}>{label}</Text>
    </View>
  );
}

export function MonstrScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const addMany = useMutation(api.shoppingList.addMany);

  const [query, setQuery] = useState('Monster Energy');
  const [zip, setZip] = useState('35576');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DealsResult | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* Aufräumen: kein Timer läuft nach dem Verlassen weiter. */
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  /* Zuletzt gespeichertes Ergebnis sofort zeigen — beim Öffnen ruckelt nichts. */
  useEffect(() => {
    let alive = true;
    void loadDealsResult().then((cached) => {
      if (!alive || !cached) return;
      setResult((current) => current ?? cached);
      setFromCache(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const next = await searchDeals({ query, zip });
      setResult(next);
      setFromCache(false);
      if (!next.ok) flash(t('s.monNone'));
    } catch {
      flash(t('s.monError'));
    } finally {
      setBusy(false);
    }
  }, [query, zip, flash, t]);

  const tLoad = useTutorialTarget('tut-mon-load', { onPress: () => void load() });

  const deals = useMemo(() => result?.deals ?? [], [result]);
  const best = deals[0];
  const cheapest = useMemo(
    () => deals.reduce<Deal | undefined>((min, deal) => (!min || deal.price < min.price ? deal : min), undefined),
    [deals],
  );
  const names = useMemo(
    () => (deals.length ? deals.slice(0, 10).map((d) => d.name) : [query.trim() || 'Monster Energy']),
    [deals, query],
  );

  const addToShopping = useCallback(async () => {
    try {
      await addMany({ items: names.map((name) => ({ name, recipeTitle: t('s.monTab') })) });
      flash(t('s.monAddedList'));
    } catch {
      flash(t('s.monError'));
    }
  }, [addMany, names, flash, t]);

  const shareToHousehold = useCallback(async () => {
    const res = await shareHouseholdList(t('s.monTab'), names.map((name) => ({ name, checked: false })));
    flash(res.ok ? t('s.monShared') : /limit/i.test(String(res.error)) ? t('s.shopLimit') : t('s.shopShareFail'));
  }, [names, flash, t]);

  const openDeal = useCallback((deal: Deal) => {
    if (!deal.url) return;
    void Linking.openURL(deal.url).catch(() => undefined);
  }, []);

  const sourceChips = useMemo(
    () =>
      (result?.sources ?? []).map((report) => ({
        key: report.source,
        label: `${t(SOURCE_LABEL[report.source])} · ${report.ok ? report.count : t('s.monSrcOff')}`,
        tone: (report.ok ? 'cyan' : 'off') as 'cyan' | 'off',
      })),
    [result?.sources, t],
  );

  return (
    <View style={{ flex: 1, backgroundColor: NEON.bg, paddingTop: insets.top }}>
      {/* Kopf — immer neon */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: NEON.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Zap size={22} color={NEON.green} fill={NEON.green} />
          <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: 6, color: NEON.green }}>MONSTR</Text>
          <View style={{ flex: 1 }} />
          <NeonChip label={t('s.monLive')} tone="cyan" />
        </View>
        <Text style={{ fontSize: 12, color: NEON.dim, marginTop: 4 }}>{t('s.monSub')}</Text>
      </View>

      {/* Steuerung: Suche, PLZ, Preise holen */}
      <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 8 }}>
        <View style={FIELD}>
          <Text style={LABEL}>{t('s.monSearch')}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('s.monSearchPh')}
            placeholderTextColor={NEON.dim}
            returnKeyType="search"
            onSubmitEditing={() => void load()}
            style={[INPUT, { flex: 1 }]}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={FIELD}>
            <Text style={LABEL}>{t('s.monZip')}</Text>
            <TextInput
              value={zip}
              onChangeText={setZip}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="35576"
              placeholderTextColor={NEON.dim}
              style={[INPUT, { width: 70 }]}
            />
          </View>
          <Pressable
            ref={tLoad.ref as any}
            collapsable={false}
            onPress={tLoad.onPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('s.monLoad')}
            style={({ pressed }) => [
              {
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                borderRadius: 14,
                paddingVertical: 13,
                backgroundColor: NEON.green,
                opacity: busy ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {busy ? <ActivityIndicator size="small" color="#050506" /> : <RefreshCw size={16} color="#050506" />}
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#050506' }}>{t('s.monLoad')}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {sourceChips.map((chip) => (
            <NeonChip key={chip.key} label={chip.label} tone={chip.tone} />
          ))}
        </View>

        {notice ? <Text style={{ fontSize: 12.5, fontWeight: '700', color: NEON.pink }}>{notice}</Text> : null}
      </View>

      <FlatList
        data={deals}
        keyExtractor={(deal) => deal.id}
        renderItem={({ item }) => <DealRow deal={item} onOpen={openDeal} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 18, paddingBottom: 60 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: deals.length ? 14 : 0 }}>
            {/* Bestes Angebot */}
            <View style={{ borderRadius: 20, borderWidth: 1, borderColor: NEON.green, backgroundColor: NEON.cardSoft, padding: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 2, color: NEON.pink }}>{t('s.monBest')}</Text>
              {best ? (
                <>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: NEON.green, marginTop: 6 }}>{priceText(best.price)}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: NEON.text, marginTop: 2 }}>
                    {best.name}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: NEON.dim, marginTop: 2 }}>
                    {[best.market, formatSize(best), formatUnitPrice(best)].filter(Boolean).join(' · ')}
                  </Text>
                  {cheapest && cheapest.id !== best.id ? (
                    <Text numberOfLines={1} style={{ fontSize: 12, color: NEON.cyan, marginTop: 8 }}>
                      {`${t('s.monCheapest')}: ${priceText(cheapest.price)} · ${cheapest.name}`}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={{ fontSize: 13, color: NEON.dim, marginTop: 6 }}>
                  {busy ? t('s.monLoad') : result ? t('s.monNone') : t('s.monPressLoad')}
                </Text>
              )}
            </View>

            {result ? (
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: NEON.cyan }}>
                {`${deals.length} ${t('s.monResults')}`}
              </Text>
            ) : null}
            {fromCache && result ? (
              <Text style={{ fontSize: 10.5, color: NEON.dim }}>
                {`${t('s.monCached')} · ${new Date(result.fetchedAt).toLocaleString()}`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: NEON.hairline, backgroundColor: NEON.card, padding: 16 }}>
            <Text style={{ fontSize: 12.5, color: NEON.dim }}>{result ? t('s.monNone') : t('s.monLoadHint')}</Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 18 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => void addToShopping()}
                accessibilityRole="button"
                accessibilityLabel={t('s.monToList')}
                style={({ pressed }) => [
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: NEON.green, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ShoppingCart size={15} color={NEON.green} />
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: NEON.green }}>{t('s.monToList')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void shareToHousehold()}
                accessibilityRole="button"
                accessibilityLabel={t('s.hhShareHh')}
                style={({ pressed }) => [
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 13, backgroundColor: NEON.pink, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <UsersRound size={15} color="#050506" />
                <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#050506' }}>{t('s.hhShareHh')}</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 10.5, color: NEON.dim }}>{t('s.monHint')}</Text>
            <Text style={{ fontSize: 10.5, color: NEON.dim }}>{t('s.monFooter')}</Text>
          </View>
        }
      />
    </View>
  );
}

/* Gemeinsamer Rahmen der Eingabefelder — einmal definiert, weniger Arbeit je Bild. */
const FIELD = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: NEON.line,
  backgroundColor: NEON.card,
  paddingHorizontal: 12,
};

const LABEL = { fontSize: 11, fontWeight: '900' as const, color: NEON.green, letterSpacing: 1 };

const INPUT = { paddingVertical: 10, fontSize: 15, color: NEON.text };

export default MonstrScreen;


