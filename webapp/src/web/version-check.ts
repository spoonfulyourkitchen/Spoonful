declare const __SPOONFUL_BUILD__: string;

const CHECK_INTERVAL_MS = 60_000;
const RELOAD_KEY = 'spoonful:reload-for-build';

function versionUrl(): string {
  return new URL(`version.json?t=${Date.now()}`, document.baseURI).toString();
}

async function checkForNewBuild(): Promise<void> {
  try {
    const response = await fetch(versionUrl(), { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { build?: string };
    const remote = String(data?.build ?? '');
    if (!remote || remote === __SPOONFUL_BUILD__) return;
    if (sessionStorage.getItem(RELOAD_KEY) === remote) return;
    sessionStorage.setItem(RELOAD_KEY, remote);
    window.location.reload();
  } catch {}
}

export function installVersionCheck(): void {
  if (typeof window === 'undefined') return;
  void checkForNewBuild();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForNewBuild();
  }, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForNewBuild();
  });
}
