import Link from "next/link";
import { AlertTriangle, CheckCircle, Euro, Image as ImageIcon, FileText, ChevronRight } from "lucide-react";

type Task = {
  id: string;
  title: string;
  sub: string;
  count: number;
  urgency: "bad" | "warn" | "ok";
  icon: typeof AlertTriangle;
  href: string;
};

export function AufgabenCard({
  ohnePreis,
  ohneBild,
  unbearbeitet,
  needsAttention,
}: {
  ohnePreis: number;
  ohneBild: number;
  unbearbeitet: number;
  needsAttention: number;
}) {
  const tasks: Task[] = [];
  if (ohneBild > 0) {
    tasks.push({
      id: "ohneBild",
      title: `${ohneBild} Produkte ohne Hauptbild`,
      sub: "Fehlendes Hauptbild",
      count: ohneBild,
      urgency: "bad",
      icon: ImageIcon,
      href: "/produkte?status=unbearbeitet",
    });
  }
  if (ohnePreis > 0) {
    tasks.push({
      id: "ohnePreis",
      title: `${ohnePreis} Produkte ohne aktuellen Preis`,
      sub: "Preispflege ausstehend",
      count: ohnePreis,
      urgency: "warn",
      icon: Euro,
      href: "/produkte?status=unbearbeitet",
    });
  }
  if (unbearbeitet > 0) {
    tasks.push({
      id: "unbearbeitet",
      title: `${unbearbeitet} Produkte unbearbeitet`,
      sub: "Grunddaten fehlen",
      count: unbearbeitet,
      urgency: "warn",
      icon: FileText,
      href: "/produkte?status=unbearbeitet",
    });
  }
  if (needsAttention > 0) {
    tasks.push({
      id: "vollstaendigkeit",
      title: `${needsAttention} Produkte < 80 % Vollständigkeit`,
      sub: "Daten lückenhaft",
      count: needsAttention,
      urgency: "ok",
      icon: AlertTriangle,
      href: "/produkte?vollstaendigkeit=unvollstaendig",
    });
  }

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between px-5 pt-[18px]">
        <div>
          <h3 className="display-sm">Deine Aufgaben</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {tasks.length === 0 ? "Alles erledigt." : `${tasks.length} offen`}
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex items-center gap-3 p-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--green)/0.14)] text-[hsl(var(--green))]">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="text-[14px] font-medium">Alle Produkte sind vollständig gepflegt.</div>
        </div>
      ) : (
        <div className="p-2 pb-2">
          {tasks.map((t) => {
            const urgencyClass =
              t.urgency === "bad"
                ? "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]"
                : t.urgency === "warn"
                  ? "bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]"
                  : "bg-primary/10 text-primary";
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={t.href}
                className="list-row rounded-xl"
              >
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${urgencyClass}`}>
                  <Icon className="h-[15px] w-[15px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">{t.title}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{t.sub}</div>
                </div>
                <ChevronRight className="h-[15px] w-[15px] text-muted-foreground/50" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
