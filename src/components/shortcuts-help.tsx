"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KBD_CLASSES =
  "inline-flex items-center justify-center rounded border bg-muted px-1.5 font-mono text-xs min-w-[1.5rem] h-6";

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={KBD_CLASSES}>{children}</kbd>;
}

const shortcuts = [
  {
    keys: [{ mod: true, key: "K" }],
    description: "Suche öffnen",
  },
  {
    keys: [{ mod: true, key: "S" }],
    description: "Formular speichern",
  },
  {
    keys: [{ mod: false, key: "N" }],
    description: "Neues Element erstellen",
  },
  {
    keys: [{ mod: false, key: "?" }],
    description: "Diese Hilfe anzeigen",
  },
  {
    keys: [{ mod: false, key: "Esc" }],
    description: "Dialog schließen",
  },
];

function isMac() {
  if (typeof navigator === "undefined") return true;
  return navigator.platform?.toLowerCase().includes("mac") ?? true;
}

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  const modKey = isMac() ? "\u2318" : "Ctrl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tastenkürzel</DialogTitle>
          <DialogDescription>
            Verfügbare Keyboard-Shortcuts in der Anwendung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-2 px-1"
            >
              <span className="text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                {shortcut.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {k.mod && (
                      <>
                        <Kbd>{modKey}</Kbd>
                        <span className="text-muted-foreground text-xs">+</span>
                      </>
                    )}
                    <Kbd>{k.key}</Kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground pt-2 border-t">
          Shortcuts sind deaktiviert, wenn ein Eingabefeld fokussiert ist
          (außer {modKey}+S und Esc).
        </p>
      </DialogContent>
    </Dialog>
  );
}
