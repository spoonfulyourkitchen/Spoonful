import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Megaphone } from 'lucide-react-native';
import { useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { colors, fonts } from '../theme';
import { AppButton } from './ui';
import { useTranslation } from '../lib/i18n';

/**
 * One-time popup message from the team (2.0.0).
 *
 * The admin panel publishes a message; every signed-in user sees it exactly
 * once - the id of the last seen message is remembered locally, so it never
 * pops up twice on the same device.
 */
const SEEN_KEY = 'spoonful:announcement-seen';

export function AnnouncementGate() {
  const { t } = useTranslation();
  const latest = useQuery(api.announcement.latest) as any;
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (!alive) return;
        setReady(true);
        if (!latest?.id) return;
        if (seen === String(latest.id)) return;
        setVisible(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [latest?.id]);

  if (!ready || !latest?.id) return null;

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(SEEN_KEY, String(latest.id));
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => void dismiss()}>
      <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', paddingHorizontal: 22 }}>
        <View style={{ borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Megaphone size={18} color={colors.accent} />
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
              {latest.title}
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 320, marginTop: 10 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{String(latest.body ?? '')}</Text>
          </ScrollView>
          <AppButton label={t('common.close')} variant="dark" style={{ marginTop: 16 }} onPress={() => void dismiss()} />
          <Pressable onPress={() => void dismiss()} style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>Spoonful</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default AnnouncementGate;
