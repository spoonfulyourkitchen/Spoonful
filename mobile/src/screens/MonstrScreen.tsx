/**
 * 3.2.0: MONSTR — Monster-Energy-Angebote in der Nähe (Fokus Wetzlar).
 *
 * Wichtig: Diese Seite ignoriert das App-Theme komplett und bleibt **immer
 * schwarz + neon** (das ist der Look der Seite).
 *
 * Die Preise kommen live vom kostenlosen Offer Hopper MCP-Server
 * (siehe lib/offerhopper.ts) — kein KI-Call, keine Kosten.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, RefreshCw, ShoppingCart, UsersRound, Zap } from 'lucide-react-native';

import { useMutation } from '../lib/convex-auth';
import { api } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { shareHouseholdList } from '../lib/household';
import { planShoppingRoute, type RouteOutcome } from '../lib/offerhopper';

/* Neon-Palette — bewusst fest, nicht aus dem Theme. */
const NEON = {
  bg: '#050506',
  card: '#0D0F12',
  cardSoft: '#12151A',
  line: 'rgba(124,255,0,0.28)',
  green: '#7CFF00',
  pink: '#FF2E88',
  cyan: '#00E5FF',
  text: '#F2FFF2',
  dim: '#8A9A8A',
};

/** Die üblichen Monster-Sorten (500 ml) für die Preisabfrage. */
const VARIANTS = [
  'Monster Energy Original 500ml',
  'Monster Energy Ultra White 500ml',
  'Monster Energy Ultra Paradise 500ml',
  'Monster Energy Ultra Watermelon 500ml',
  'Monster Energy Mango Loco 500ml',
  'Monster Energy Pipeline Punch 500ml',
  'Monster Energy Rehab Lemon 500ml',
  'Monster Energy Assault 500ml',
  'Monster Energy Khaos 500ml',
];

const TRANSPORTS = [
  { key: 'car', labelKey: 's.monByCar' },
  { key: 'bike', labelKey: 's.monByBike' },
  { key: 'foot', labelKey: 's.monByFoot' },
] as const;

const PERSONAS = [
  { key: 'saver', labelKey: 's.monSaver' },
  { key: 'smart', labelKey: 's.monSmart' },
  { key: 'fast', labelKey: 's.monFast' },
] as const;

export function MonstrScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const addMany = useMutation(api.shoppingList.addMany);

  const [zip, setZip] = useState('35576');
  const [transport, setTransport] = useState<'car' | 'bike' | 'foot'>('car');
  const [persona, setPersona] = useState<'saver' | 'smart' | 'fast'>('smart');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteOutcome | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const load = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await planShoppingRoute({ postalCode: zip.trim() || '35576', items: VARIANTS, transport, persona });
      setResult(outcome);
      if (!outcome.ok) flash(t('s.monNoConnection'));
    } finally {
      setBusy(false);
    }
  }, [zip, transport, persona, t]);

  const addToShopping = async () => {
    try {
      await addMany({ items: VARIANTS.map((name) => ({ name, recipeTitle: t('s.monTab') })) });
      flash(t('s.monAddedList'));
    } catch {
      flash(t('common.error'));
    }
  };

  const shareToHousehold = async () => {
    const res = await shareHouseholdList(t('s.monTab'), VARIANTS.map((name) => ({ name, checked: false })));
    flash(res.ok ? t('s.monShared') : /limit/i.test(String(res.error)) ? t('s.shopLimit') : t('s.shopShareFail'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: NEON.bg, paddingTop: insets.top }}>
      {/* Kopf — immer neon */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: NEON.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Zap size={22} color={NEON.green} fill={NEON.green} />
          <Text style={{ fontSize: 30, fontWeight: '900', letterSpacing: 6, color: NEON.green }}>MONSTR</Text>
          <View style={{ flex: 1 }} />
          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: NEON.cyan, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: NEON.cyan }}>{t('s.monLive')}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: NEON.dim, marginTop: 4 }}>{t('s.monSub')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 + insets.bottom }} keyboardShouldPersistTaps="handled">
        {/* PLZ + Fahrt + Persona */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: NEON.line, backgroundColor: NEON.card, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: NEON.green }}>{t('s.monZip')}</Text>
            <TextInput
              value={zip}
              onChangeText={setZip}
              keyboardType="number-pad"
              placeholder="35576"
              placeholderTextColor={NEON.dim}
              style={{ flex: 1, paddingVertical: 11, fontSize: 16, color: NEON.text, letterSpacing: 1 }}
            />
          </View>
          <Pressable
            onPress={() => void load()}
            disabled={busy}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: NEON.green, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
          >
            {busy ? <ActivityIndicator size="small" color="#050506" /> : <RefreshCw size={16} color="#050506" />}
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#050506' }}>{t('s.monLoad')}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {TRANSPORTS.map((tr) => (
            <NeonChip key={tr.key} label={t(tr.labelKey)} active={transport === tr.key} onPress={() => setTransport(tr.key)} />
          ))}
          {PERSONAS.map((p) => (
            <NeonChip key={p.key} label={t(p.labelKey)} active={persona === p.key} onPress={() => setPersona(p.key)} tone="cyan" />
          ))}
        </View>

        {notice ? <Text style={{ marginTop: 12, fontSize: 12.5, fontWeight: '700', color: NEON.pink }}>{notice}</Text> : null}

        {/* Bestes Angebot */}
        <View style={{ marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: NEON.green, backgroundColor: NEON.cardSoft, padding: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 2, color: NEON.pink }}>{t('s.monBest')}</Text>
          {result?.ok ? (
            <>
              <Text style={{ fontSize: 26, fontWeight: '900', color: NEON.green, marginTop: 6 }}>
                {result.total != null ? `${result.total.toFixed(2)} €` : '—'}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: NEON.text, marginTop: 2 }}>
                {result.store ?? t('s.monNearest')}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 13, color: NEON.dim, marginTop: 6 }}>{t('s.monPressLoad')}</Text>
          )}
        </View>

        {/* Sorten */}
        <Text style={{ marginTop: 18, fontSize: 11, fontWeight: '900', letterSpacing: 2, color: NEON.cyan }}>{t('s.monOffers')}</Text>
        <View style={{ marginTop: 8, borderRadius: 18, borderWidth: 1, borderColor: NEON.line, backgroundColor: NEON.card, paddingHorizontal: 12, paddingVertical: 6 }}>
          {VARIANTS.map((name, i) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
              <Zap size={14} color={NEON.green} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: NEON.text }}>{name}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: result?.ok ? NEON.pink : NEON.dim }}>{result?.ok ? '✓' : '—'}</Text>
            </View>
          ))}
        </View>

        {/* Details aus der Antwort */}
        {result?.ok && result.lines?.length ? (
          <View style={{ marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: NEON.line, backgroundColor: NEON.card, padding: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: NEON.green, marginBottom: 6 }}>{t('s.monDetails')}</Text>
            {result.lines.map((l, i) => (
              <Text key={`${l.label}-${i}`} numberOfLines={1} style={{ fontSize: 12, color: NEON.dim, marginTop: 2 }}>
                {l.label} · {l.value}
              </Text>
            ))}
            <Pressable onPress={() => setShowRaw((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: NEON.cyan }}>{t('s.monRaw')}</Text>
              {showRaw ? <ChevronUp size={13} color={NEON.cyan} /> : <ChevronDown size={13} color={NEON.cyan} />}
            </Pressable>
            {showRaw ? (
              <Text style={{ fontSize: 10.5, color: NEON.dim, marginTop: 6 }}>
                {typeof result.raw === 'string' ? result.raw.slice(0, 4000) : JSON.stringify(result.raw, null, 1)?.slice(0, 4000)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {result && !result.ok ? (
          <Text style={{ marginTop: 12, fontSize: 11.5, color: NEON.dim }}>
            {t('s.monError')} · {result.error ?? '—'}
            {result.tools?.length ? `\n${t('s.monTools')}: ${result.tools.join(', ')}` : ''}
          </Text>
        ) : null}

        {/* Aktionen */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => void addToShopping()}
            style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: NEON.green, opacity: pressed ? 0.8 : 1 }]}
          >
            <ShoppingCart size={15} color={NEON.green} />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: NEON.green }}>{t('s.monToList')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void shareToHousehold()}
            style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, paddingVertical: 13, backgroundColor: NEON.pink, opacity: pressed ? 0.85 : 1 }]}
          >
            <UsersRound size={15} color="#050506" />
            <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#050506' }}>{t('s.hhShareHh')}</Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: 14, fontSize: 10.5, color: NEON.dim }}>{t('s.monFooter')}</Text>
      </ScrollView>
    </View>
  );
}

/** Neon-Chip (bleibt immer dunkel). */
function NeonChip({ label, active, onPress, tone = 'green' }: { label: string; active: boolean; onPress: () => void; tone?: 'green' | 'cyan' }) {
  const color = tone === 'cyan' ? NEON.cyan : NEON.green;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? color : 'rgba(255,255,255,0.16)',
          backgroundColor: active ? `${color}22` : 'transparent',
          paddingHorizontal: 12,
          paddingVertical: 7,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? color : NEON.dim }}>{label}</Text>
    </Pressable>
  );
}

export default MonstrScreen;
