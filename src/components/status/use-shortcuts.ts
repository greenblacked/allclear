import { useEffect, useRef } from "react";
import { type ShortcutAction, shortcutFor } from "@/lib/status/shortcuts";

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}

/**
 * The board's single-key shortcuts. One window listener; `onAction` always
 * sees the latest render's state. An open dialog keeps its keys, and so does
 * a text field, apart from Escape.
 */
export function useShortcuts(onAction: (action: ShortcutAction) => void): void {
  const latest = useRef(onAction);
  useEffect(() => {
    latest.current = onAction;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
      const action = shortcutFor({
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        editable: isEditable(event.target),
      });
      if (!action) return;
      // "/" would otherwise open Firefox's quick find.
      event.preventDefault();
      latest.current(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
