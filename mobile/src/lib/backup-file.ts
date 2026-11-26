export type SaveBackupResult = 'saved' | 'cancelled' | 'unsupported';

function nativeModules() {
  const picker = require('@react-native-documents/picker');
  const blob = require('react-native-blob-util');
  return { picker, fs: blob.fs };
}

function isCancel(error: any): boolean {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  return code.includes('CANCELED') || code.includes('CANCELLED') || /cancel/i.test(message);
}

/** Opens Android's "save as" dialog so the user can pick a folder for the JSON backup. */
export async function saveBackupToFolder(json: string): Promise<SaveBackupResult> {
  const { picker, fs } = nativeModules();
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `spoonful-backup-${stamp}.json`;
  const path = `${fs.dirs.CacheDir}/${fileName}`;
  await fs.writeFile(path, json, { encoding: 'utf8' });
  try {
    const [result] = await picker.saveDocuments({
      sourceUris: [encodeURI(`file://${path}`)],
      mimeType: 'application/json',
      fileName,
      copy: false,
    });
    if (result?.error) throw new Error(result.error);
    return 'saved';
  } catch (error) {
    if (isCancel(error)) return 'cancelled';
    throw error;
  } finally {
    await fs.unlink(path).catch(() => {});
  }
}

/** Lets the user pick a .json backup and returns its text. */
export async function readBackupFile(): Promise<string | null> {
  const { picker, fs } = nativeModules();
  try {
    const [file] = await picker.pick({ type: [picker.types.json] });
    const [copy] = await picker.keepLocalCopy({
      files: [{ uri: file.uri, fileName: file.name || 'spoonful-backup.json' }],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') throw new Error(copy.copyError || 'Could not read this file.');
    try {
      return await fs.readFile(copy.localUri, { encoding: 'utf8' });
    } finally {
      await fs.unlink(copy.localUri).catch(() => {});
    }
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
}
