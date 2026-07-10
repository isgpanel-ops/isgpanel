const NS = "isgpanel";

export function storageKey(email, key) {
  const safe = (email || "guest").toLowerCase().trim();
  return `${NS}:${safe}:${key}`;
}

export function lsGet(email, key, fallback = null) {
  try {
    const v = localStorage.getItem(storageKey(email, key));
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(email, key, value) {
  try {
    localStorage.setItem(storageKey(email, key), JSON.stringify(value));
  } catch {}
}

export function lsRemove(email, key) {
  localStorage.removeItem(storageKey(email, key));
}
