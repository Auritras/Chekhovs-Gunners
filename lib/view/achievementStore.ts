import { achievement, type Achievement } from "@/lib/view/achievements";

const KEY = "cg-achievements";

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
  let added = false;
  for (const id of ids) {
    const a = achievement(id);
    if (!a || have.has(id)) continue;
    have.add(id);
    queue.push(a);
    added = true;
  }
  if (!added) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...have]));
  } catch {
    // Storage blocked: the pop-ups still show this visit.
  }
  listeners.forEach((l) => l());
}

/** Take the next achievement waiting for its pop-up. */
export function nextUnlocked(): Achievement | undefined {
  return queue.shift();
}

export function onUnlock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
