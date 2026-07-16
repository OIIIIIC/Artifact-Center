/** UI-only shortcut label (⌘K / Ctrl+K). No keybinding implementation. */
export function useModKeyLabel(key = 'K'): string {
  const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return isApple ? `⌘${key}` : `Ctrl+${key}`
}
