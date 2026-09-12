import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Download, Rocket, X } from 'lucide-react-native';
import { useQuery } from '../lib/convex-auth';
import { api } from '../lib/api';
import { APP_VERSION } from '../config';
import { colors, fonts } from '../theme';
import { useTranslation } from '../lib/i18n';

/**
 * "New update" popup (2.1.4).
 *
 * Deliberately persistent: every time the app is OPENED, a user on an older
 * release sees this popup again until they actually update. Users who already
 * run the new version get nothing at all — the server only returns the notice
 * when the posted version is newer than the version the app reports
 * (`latest_update_notice(p_client_version)`), so the nagging stops by itself
 * after updating.
 *
 * Only the admin panel can publish a notice; the release link is opened in the
 * browser so the APK can be downloaded from GitHub.
 */
export function UpdateGate() {
  const { t, rtl } = useTranslation();
  const notice = useQuery(api.updates.latest, { version: APP_VERSION }) as any;
  const [visible, setVisible] = useState(false);
  /** Only for this session: closing it hides the popup until the next start. */
  const closedForSession = useRef(false);

  useEffect(() => {
    if (closedForSession.current) return;
    if (!notice?.url) return;
    // every app start: show it again while the version is older
    setVisible(true);
  }, [notice?._id, notice?.url]);

  if (!notice?.url) return null;

  const later = () => {
    closedForSession.current = true;
    setVisible(false);
  };

  const open = async () => {
    try {
      await Linking.openURL(String(notice.url));
    } catch {
      /* no browser available */
    }
  };

  const row = { flexDirection: (rtl ? 'row-reverse' : 'row') as 'row' | 'row-reverse' };
  const align = { textAlign: (rtl ? 'right' : 'left') as 'right' | 'left' };
  const card = {
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  };
  const badge = {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: colors.accentSoft,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={later}>
      <View style={{ flex: 1, backgroundColor: colors.overlayStrong, justifyContent: 'center', paddingHorizontal: 22 }}>
        <View style={card}>
          <View style={[{ alignItems: 'center', gap: 10 }, row]}>
            <View style={badge}>
              <Rocket size={18} color={colors.accent} />
            </View>
            <Text style={[{ flex: 1, fontFamily: fonts.display, fontSize: 19, fontWeight: '800', color: colors.textPrimary }, align]}>
              {notice.title || t('s.upBox')}
            </Text>
            <Pressable onPress={later} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('s.upLater')}>
              <X size={19} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[{ marginTop: 10, borderRadius: 12, backgroundColor: colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignSelf: 'stretch' }, row]}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.textSecondary }}>{t('s.upVersion')}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.accent }}>{String(notice.version ?? '')}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{`${t('s.upCurrent')}: ${APP_VERSION}`}</Text>
          </View>

          {notice.body ? (
            <ScrollView style={{ maxHeight: 260, marginTop: 12 }} showsVerticalScrollIndicator={false}>
              <Text style={[{ fontSize: 14, lineHeight: 21, color: colors.textSecondary }, align]}>{String(notice.body)}</Text>
            </ScrollView>
          ) : null}

          <Pressable
            onPress={() => void open()}
            accessibilityRole="button"
            accessibilityLabel={t('s.upOpen')}
            style={({ pressed }) => [
              { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: colors.darkButton, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Download size={17} color={colors.darkButtonText} />
            <Text style={{ color: colors.darkButtonText, fontWeight: '800', fontSize: 15 }}>{t('s.upOpen')}</Text>
          </Pressable>

          <Pressable onPress={later} accessibilityRole="button" accessibilityLabel={t('s.upLater')} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>{t('s.upLater')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* 2.1.4 theme fix: the styles are built inline on every render (see above). */
export default UpdateGate;
