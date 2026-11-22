/**
 * AsyncStorage on the web. The app only uses getItem / setItem / removeItem,
 * but the full surface is implemented so no call can silently fail.
 */
const PREFIX = 'spoonful:';

function key(name: string): string {
  return PREFIX + name;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const AsyncStorage = {
  async getItem(name: string): Promise<string | null> {
    return safe(() => window.localStorage.getItem(key(name)), null);
  },
  async setItem(name: string, value: string): Promise<void> {
    safe(() => window.localStorage.setItem(key(name), String(value)), undefined);
  },
  async removeItem(name: string): Promise<void> {
    safe(() => window.localStorage.removeItem(key(name)), undefined);
  },
  async mergeItem(name: string, value: string): Promise<void> {
    const current = await AsyncStorage.getItem(name);
    if (!current) return AsyncStorage.setItem(name, value);
    safe(() => {
      const merged = { ...JSON.parse(current), ...JSON.parse(value) };
      window.localStorage.setItem(key(name), JSON.stringify(merged));
    }, undefined);
  },
  async clear(): Promise<void> {
    safe(() => {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => window.localStorage.removeItem(k));
    }, undefined);
  },
  async getAllKeys(): Promise<string[]> {
    return safe(
      () =>
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith(PREFIX))
          .map((k) => k.slice(PREFIX.length)),
      [],
    );
  },
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return Promise.all(keys.map(async (k) => [k, await AsyncStorage.getItem(k)] as [string, string | null]));
  },
  async multiSet(pairs: [string, string][]): Promise<void> {
    await Promise.all(pairs.map(([k, v]) => AsyncStorage.setItem(k, v)));
  },
  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
  },
  async multiMerge(pairs: [string, string][]): Promise<void> {
    await Promise.all(pairs.map(([k, v]) => AsyncStorage.mergeItem(k, v)));
  },
  flushGetRequests() {},
  useAsyncStorage(name: string) {
    return {
      getItem: () => AsyncStorage.getItem(name),
      setItem: (value: string) => AsyncStorage.setItem(name, value),
      removeItem: () => AsyncStorage.removeItem(name),
      mergeItem: (value: string) => AsyncStorage.mergeItem(name, value),
    };
  },
};

export default AsyncStorage;
export { AsyncStorage };
