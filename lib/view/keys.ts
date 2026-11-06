/**
 * Single-key shortcuts (J, K, F, X, ?) stand aside while the writer types in a field, holds
 * a modifier, or has a dialog open.
 */
export function isTypingOrBusy(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return true;
  return document.querySelector("dialog[open]") !== null;
}
