import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SHORTCUT_HELP } from "@/lib/status/shortcuts";

/**
 * The list of keyboard shortcuts, in a native modal <dialog>: it traps focus,
 * closes on Escape and returns focus to where it was, without a library.
 */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, not its content.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="shortcuts-heading"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] bg-transparent p-0 text-fg backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
    >
      <div className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="shortcuts-heading" className="font-display text-xl font-medium tracking-[-0.03em]">
            Keyboard shortcuts
          </h2>
          <Button variant="ghost" size="icon" className="-my-2 -mr-2" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <dl className="mt-4 flex flex-col gap-2">
          {SHORTCUT_HELP.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted">{item.label}</dt>
              <dd className="flex shrink-0 gap-1">
                {item.keys.map((key) => (
                  <kbd key={key} className="min-w-7 rounded-lg glass-inset px-2 py-0.5 text-center font-mono text-xs text-fg">
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
