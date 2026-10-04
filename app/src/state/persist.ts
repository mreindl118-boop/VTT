// Ask the browser to keep mistLAB's storage (navigator.storage.persist) and remember the answer for Help.
// Safari may evict the data of a site that is not installed; persistent storage, or installing the app, prevents it.

let asked: Promise<boolean | undefined> | undefined;

/** Ask once per page load (the first commit calls it); resolves to the browser's answer, undefined without the API. */
export function requestPersist(): Promise<boolean | undefined> {
  asked ??= (async () => {
    try {
      const s = navigator.storage;
      if (!s?.persist) return undefined;
      return await s.persist();
    } catch { return undefined; }
  })();
  return asked;
}

/** Whether storage is persistent: the answer to persist() once asked, otherwise what persisted() reports. */
export async function storagePersistent(): Promise<boolean | undefined> {
  if (asked) { const a = await asked; if (a !== undefined) return a; }
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : undefined; } catch { return undefined; }
}

/** Help's storage line: exactly 'Storage: persistent', or a warning with the install hint. */
export function storageText(persistent: boolean | undefined): string {
  if (persistent) return 'Storage: persistent';
  return 'Storage: not persistent. The browser may clear this campaign when the device runs short of space. Install mistLAB as an app (on iPad: Share, then Add to Home Screen; on a computer: Install in the address bar) and export a backup from the Library now and then.';
}

/** For tests: forget the answer. */
export function resetPersistForTests(): void { asked = undefined; }
