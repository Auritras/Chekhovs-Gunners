import { achievement, type Achievement } from "@/lib/view/achievements";

const KEY = "cg-achievements";
/** When each was unlocked (ms since epoch), for the date on its ticket. Older unlocks have none. */
const DATES_KEY = "cg-achievement-dates";

/** Unlocked once ever (saved in the browser); each new unlock is queued for its pop-up. */
let unlocked: Set<string> | null = null;
const queue: Achievement[] = [];
const listeners = new Set<() => void>();

function load(): Set<string> {
  if (unlocked) return unlocked;
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    unlocked = new Set(Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : []);
  } catch {
    unlocked = new Set();
  }
  return unlocked;
}

/** Unlock achievements; any not unlocked before join the pop-up queue. */
export function unlock(...ids: string[]): void {
  const have = load();
  const fresh: Achievement[] = [];
  for (const id of ids) {
    const a = achievement(id);
    if (!a || have.has(id)) continue;
    have.add(id);
    queue.push(a);
    fresh.push(a);
  }
  if (fresh.length === 0) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...have]));
    const dates = unlockDates();
    const now = Date.now();
    for (const a of fresh) dates[a.id] ??= now;
    window.localStorage.setItem(DATES_KEY, JSON.stringify(dates));
  } catch {
    // Storage blocked: the pop-ups still show this visit.
  }
  listeners.forEach((l) => l());
}

/** Every achievement unlocked so far in this browser. */
export function unlockedIds(): Set<string> {
  return new Set(load());
}

/** When each achievement was unlocked, where known. */
export function unlockDates(): Record<string, number> {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(DATES_KEY) ?? "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Take the next achievement waiting for its pop-up. */
export function nextUnlocked(): Achievement | undefined {
  return queue.shift();
}

export function onUnlock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
