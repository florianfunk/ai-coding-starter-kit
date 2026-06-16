"use client";

// PROJ-22: Globaler Jahreswähler in der Topbar.
// Zeigt „Alle Jahre" + jedes Jahr mit Daten. Auf reinen Einstellungs-/Profil-
// Seiten ausgeblendet (dort ist ein Jahr bedeutungslos).

import { usePathname } from "next/navigation";
import { CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJahr } from "@/components/jahr/jahr-provider";

const ALLE = "alle";

/** Routen, auf denen der Jahreswähler keinen Sinn ergibt. */
const VERSTECKT_PRAEFIXE = ["/einstellungen", "/profil"];

export function JahresWaehler() {
  const pathname = usePathname();
  const { aktivesJahr, verfuegbareJahre, pending, setJahr } = useJahr();

  if (VERSTECKT_PRAEFIXE.some((p) => pathname?.startsWith(p))) {
    return null;
  }

  const wert = aktivesJahr == null ? ALLE : String(aktivesJahr);

  return (
    <Select
      value={wert}
      disabled={pending}
      onValueChange={(v) => setJahr(v === ALLE ? null : Number(v))}
    >
      <SelectTrigger
        className="h-8 w-auto gap-2 border-0 bg-transparent px-2 text-[13px] font-medium shadow-none focus:ring-0 focus:ring-offset-0"
        aria-label="Aktives Buchungsjahr"
      >
        <CalendarRange className="h-4 w-4 opacity-60" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALLE}>Alle Jahre</SelectItem>
        {verfuegbareJahre.map((j) => (
          <SelectItem key={j} value={String(j)}>
            {j}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
