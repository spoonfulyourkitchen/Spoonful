import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { AppButton } from './ui';
import { api } from '../lib/api';
import { useMutation } from '../lib/convex-auth';
import { useTranslation } from '../lib/i18n';
import { colors, fonts } from '../theme';

export function CollectionModal({
  visible,
  collections,
  mode,
  onChoose,
  onClose,
}: {
  visible: boolean;
  collections: any[];
  mode: 'pick' | 'manage';
  onChoose?: (collectionId: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createCollection = useMutation(api.collections.create);
  const updateCollection = useMutation(api.collections.update);
  const removeCollection = useMutation(api.collections.remove);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = () => {
    setCreating(false);
    setName('');
    setError('');
    setEditing(null);
    setEditName('');
    setConfirmDelete(false);
    onClose();
  };
  
  const tapOutside = () => (mode === 'pick' ? choose(null) : close());
  const choose = (id: string | null) => {
    if (mode === 'pick') onChoose?.(id);
    close();
  };
  const saveCollection = async () => {
    const value = name.trim();
    if (value.length < 2) {
      setError(t('s.collectionNameError'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result: any = await createCollection({ name: value });
      setName('');
      setCreating(false);
      if (mode === 'manage') close();
      else {
        const id = result?._id ?? result?.id;
        if (!id) throw new Error(t('common.tryAgain'));
        choose(String(id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  };
  const saveRename = async () => {
    if (!editing) return;
    const value = editName.trim();
    if (value.length < 2) {
      setError(t('s.collectionNameError'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateCollection({ id: editing.id, name: value });
      setEditing(null);
      setEditName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  };
  const deleteCollection = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await removeCollection({ id: editing.id });
      setEditing(null);
      setEditName('');
      setConfirmDelete(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  const title = confirmDelete
    ? t('s.collectionDelete')
    : editing
      ? t('s.collectionRename')
      : creating
        ? t('s.collectionNew')
        : mode === 'pick'
          ? t('s.collectionChoose')
          : t('saved.collections');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={tapOutside}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.overlayStrong }}>
        <Pressable
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          onPress={tapOutside}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
              {title}
            </Text>
            <Pressable onPress={tapOutside} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {confirmDelete && editing ? (
            <>
              <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>{t('s.collectionDeleteBody')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <AppButton label={t('s.collectionDelete')} variant="danger" busy={busy} onPress={() => void deleteCollection()} style={{ flex: 1 }} />
                <AppButton label={t('common.cancel')} variant="ghost" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
              </View>
            </>
          ) : editing ? (
            <>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={t('s.collectionNamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                maxLength={60}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void saveRename()}
                style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, backgroundColor: colors.bg, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 }}
              />
              {error ? <Text style={{ color: colors.rose, fontSize: 12, marginTop: 7 }}>{error}</Text> : null}
              <AppButton label={t('common.save')} variant="accent" busy={busy} disabled={editName.trim().length < 2} onPress={() => void saveRename()} style={{ marginTop: 12 }} />
              <Pressable
                onPress={() => { setConfirmDelete(true); setError(''); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8, paddingVertical: 11 }}
              >
                <Trash2 size={16} color={colors.rose} />
                <Text style={{ color: colors.rose, fontWeight: '700' }}>{t('s.collectionDelete')}</Text>
              </Pressable>
              <Pressable onPress={() => { setEditing(null); setEditName(''); setError(''); }} style={{ paddingVertical: 9, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.back')}</Text>
              </Pressable>
            </>
          ) : creating ? (
            <>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('s.collectionNamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                maxLength={60}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void saveCollection()}
                style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, backgroundColor: colors.bg, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 }}
              />
              {error ? <Text style={{ color: colors.rose, fontSize: 12, marginTop: 7 }}>{error}</Text> : null}
              <AppButton label={t('s.collectionCreate')} variant="accent" busy={busy} disabled={name.trim().length < 2} onPress={() => void saveCollection()} style={{ marginTop: 12 }} />
              <Pressable onPress={() => { setCreating(false); setError(''); }} style={{ paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.back')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                {collections.map((item) => (
                  <Pressable
                    key={String(item._id)}
                    onPress={() => choose(String(item._id))}
                    onLongPress={() => { setEditing({ id: String(item._id), name: String(item.name ?? '') }); setEditName(String(item.name ?? '')); setError(''); }}
                    delayLongPress={320}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <FolderPlus size={17} color={colors.accentInk} />
                    </View>
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{item.name}</Text>
                    <Pencil size={14} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </ScrollView>
              {mode === 'manage' && collections.length ? (
                <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 8 }}>{t('s.collectionManageHint')}</Text>
              ) : null}
              <Pressable onPress={() => setCreating(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} color={colors.accentInk} />
                </View>
                <Text style={{ color: colors.accentInk, fontSize: 14, fontWeight: '800' }}>{t('s.collectionNew')}</Text>
              </Pressable>
              {mode === 'manage' ? <AppButton label={t('common.close')} variant="dark" onPress={close} style={{ marginTop: 6 }} /> : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default CollectionModal;
