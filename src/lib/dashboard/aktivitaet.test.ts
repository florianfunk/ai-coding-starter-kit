import { describe, it, expect } from "vitest";
import { baueAktivitaet, type AuditRow, type JobRow } from "./aktivitaet";

describe("baueAktivitaet — Mapping", () => {
  it("mappt Audit-Aktionen auf Art und deutschen Titel", () => {
    const audit: AuditRow[] = [
      { id: "a1", entitaet: "buchung", aktion: "klassifiziert", created_at: "2026-06-20T10:00:00Z" },
    ];
    const r = baueAktivitaet(audit, []);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: "audit:a1",
      art: "klassifizierung",
      titel: "Buchung klassifiziert",
      zeitpunkt: "2026-06-20T10:00:00Z",
    });
  });

  it("mappt unbekannte Aktionen auf 'sonstiges' mit Fallback-Titel", () => {
    const audit: AuditRow[] = [
      { id: "a2", entitaet: "buchung", aktion: "irgendwas_neues", created_at: "2026-06-20T10:00:00Z" },
    ];
    const r = baueAktivitaet(audit, []);
    expect(r[0].art).toBe("sonstiges");
    expect(r[0].titel).toContain("irgendwas_neues");
  });

  it("mappt job_lauf-Arten/Status auf Import/Sync-Titel", () => {
    const jobs: JobRow[] = [
      { id: "j1", art: "konto_import", status: "fertig", created_at: "2026-06-20T09:00:00Z" },
      { id: "j2", art: "paperless_sync", status: "fehler", created_at: "2026-06-20T08:00:00Z" },
    ];
    const r = baueAktivitaet([], jobs);
    expect(r[0]).toMatchObject({ id: "job:j1", art: "import", titel: "Kontoauszug-Import abgeschlossen" });
    expect(r[1]).toMatchObject({ id: "job:j2", art: "sync", titel: "Paperless-Sync fehlgeschlagen" });
  });
});

describe("baueAktivitaet — Merge & Sortierung", () => {
  it("vereint beide Quellen und sortiert chronologisch DESC", () => {
    const audit: AuditRow[] = [
      { id: "a1", entitaet: "buchung", aktion: "klassifiziert", created_at: "2026-06-20T07:00:00Z" },
      { id: "a2", entitaet: "buchung", aktion: "klassifiziert", created_at: "2026-06-20T12:00:00Z" },
    ];
    const jobs: JobRow[] = [
      { id: "j1", art: "konto_import", status: "fertig", created_at: "2026-06-20T10:00:00Z" },
    ];
    const r = baueAktivitaet(audit, jobs);
    expect(r.map((e) => e.id)).toEqual(["audit:a2", "job:j1", "audit:a1"]);
  });

  it("limitiert auf 20 Einträge", () => {
    const audit: AuditRow[] = Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`,
      entitaet: "buchung",
      aktion: "klassifiziert",
      // absteigende Zeit, damit Sortierung deterministisch ist
      created_at: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const r = baueAktivitaet(audit, []);
    expect(r).toHaveLength(20);
  });

  it("liefert leere Liste bei keinen Daten", () => {
    expect(baueAktivitaet([], [])).toEqual([]);
  });
});
