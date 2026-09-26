import { CATEGORIES } from "./catalog.ts";
import type { CategoryId } from "./types.ts";

export type ShortcutAction =
  | { type: "focus-search" }
  | { type: "leave-search" }
  | { type: "refresh" }
  | { type: "category"; category: "all" | CategoryId }
  | { type: "toggle-issues" }
  | { type: "toggle-starred" }
  | { type: "reset" }
  | { type: "help" };

/** The parts of a KeyboardEvent a shortcut depends on. */
export type KeyInput = {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  /** Focus is in a text field, where keys belong to the field. */
  editable: boolean;
};

/** 1 is All, then the categories in the order the filter row shows them. */
const NUMBERED: Array<"all" | CategoryId> = ["all", ...CATEGORIES.map((category) => category.id)];

// A letter matches by the character it types. On a Cyrillic or other
// non-Latin layout, where no key types it, the physical key stands in.
function letter(input: KeyInput, char: string): boolean {
  if (/^[a-z]$/i.test(input.key)) return input.key.toLowerCase() === char;
  return input.code === `Key${char.toUpperCase()}`;
}

function digit(input: KeyInput): number | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(input.code) ?? /^([0-9])$/.exec(input.key);
  return match ? Number(match[1]) : null;
}

export function shortcutFor(input: KeyInput): ShortcutAction | null {
  // Browser and system shortcuts (Ctrl+R, Cmd+1) stay theirs.
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.editable) return input.key === "Escape" ? { type: "leave-search" } : null;
  if (input.repeat) return null;

  // The slash key types "." on a Ukrainian layout but a letter on Dvorak,
  // where the letter's own shortcut, if any, wins.
  const slashKey = input.code === "Slash" && !/^[a-z]$/i.test(input.key);
  if (input.key === "?" || (slashKey && input.shiftKey)) return { type: "help" };
  if (input.key === "/" || slashKey) return { type: "focus-search" };
  if (input.key === "Escape") return { type: "reset" };
  if (input.shiftKey) return null;
  if (letter(input, "r")) return { type: "refresh" };
  if (letter(input, "i")) return { type: "toggle-issues" };
  if (letter(input, "s")) return { type: "toggle-starred" };

  const number = digit(input);
  const category = number === null ? undefined : NUMBERED[number - 1];
  return category ? { type: "category", category } : null;
}

/** What the help dialog lists, in the order it lists them. */
export const SHORTCUT_HELP: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "Search services" },
  { keys: [`1–${NUMBERED.length}`], label: `All, ${CATEGORIES.map((category) => category.label).join(", ")}` },
  { keys: ["I"], label: "Issues only" },
  { keys: ["S"], label: "Starred only" },
  { keys: ["R"], label: "Refresh now" },
  { keys: ["Esc"], label: "Clear search and filters" },
  { keys: ["?"], label: "Show these shortcuts" },
];
