export type SaveBackupResult = 'saved' | 'cancelled' | 'unsupported';

const browser = globalThis as any;

function fileName(): string {
  return `spoonful-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Downloads the JSON backup through the browser. */
export async function saveBackupToFolder(json: string): Promise<SaveBackupResult> {
  const doc = browser.document;
  const blob = new browser.Blob([json], { type: 'application/json' });
  const href = browser.URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = href;
  link.download = fileName();
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => browser.URL.revokeObjectURL(href), 1000);
  return 'saved';
}

/** Opens the browser file chooser and reads a JSON backup. */
export async function readBackupFile(): Promise<string | null> {
  const doc = browser.document;
  return new Promise((resolve, reject) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new browser.FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Could not read this file.'));
      reader.readAsText(file);
    };
    doc.body.appendChild(input);
    input.click();
  });
}
