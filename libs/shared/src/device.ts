const DEVICE_KEY = 'ht_timeline_device_v1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 v4. `crypto.randomUUID` only exists in secure contexts, and LAN testing is plain http. */
export function newDeviceId(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const b = random(new Uint8Array(new ArrayBuffer(16)));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Anonymous per-device id that owns this device's bookmarks on the server until accounts exist (ADR-007).
 * If storage is unavailable, a fresh id per session is still better than the shared 'local'.
 */
export function getDeviceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage(),
  /** React Native has no crypto.getRandomValues; the Expo app passes expo-crypto's. */
  random?: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array,
): string {
  try {
    const existing = storage?.getItem(DEVICE_KEY);
    if (existing && UUID.test(existing)) return existing;
  } catch {
    // fall through to a new id
  }
  const id = newDeviceId(random);
  try {
    storage?.setItem(DEVICE_KEY, id);
  } catch {
    // non-fatal
  }
  return id;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
