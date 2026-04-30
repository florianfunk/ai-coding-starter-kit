"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getBildVerwendungen,
  buildBildVerwendungenIndex,
  buildMediathekTitle,
  type BildVerwendung,
} from "@/lib/bild-verwendung";
import { readDimensions, type ImageDimensions } from "@/lib/image-dimensions";

const BUCKET = "produktbilder";
const PAGE_SIZE = 100;

export interface MediathekItem {
  /** Storage-Pfad (z.B. "kategorien/upload-...-foo.jpg") */
  path: string;
  /** Letzter Pfad-Bestandteil (Dateiname für UI) */
  name: string;
  /** Sprechender Titel basierend auf Verwendung (Bereich/Kategorie/Produkt + Slot) */
  smartTitle: string;
  /** Größe in Bytes (von Storage geliefert) */
  size: number | null;
  /** ISO-Datumsstring */
  createdAt: string | null;
  /** Anzahl Verwendungen quer durch alle Entitäten */
  usageCount: number;
  /** "kategorien", "produkte", "ai-wide", … — erstes Pfad-Segment für Filter */
  prefix: string;
  /** Datei-Endung in Lowercase */
  extension: string;
}

export type UsageFilter = "all" | "used" | "unused";

export interface ListMediathekInput {
  /** Volltext-Suche im Pfad/Dateiname/Smart-Title */
  search?: string;
  /** Filter: alle / nur verwendete / nur unbenutzte */
  usage?: UsageFilter;
  /** Pfad-Präfix-Filter (erstes Segment, z.B. "kategorien", "produkte"). "all" = ohne Filter */
  prefix?: string;
  /** Datei-Format-Filter (Endung ohne Punkt). "all" = ohne Filter */
  extension?: string;
  /** Filter: nur Bilder, die in einem bestimmten Bereich verwendet werden. "all" = ohne Filter */
  bereichId?: string;
  /** Filter: nur Bilder, die in einer bestimmten Kategorie verwendet werden. "all" = ohne Filter */
  kategorieId?: string;
}

/** Filter-Optionen, die das UI dem User anbietet (basierend auf den Verwendungen) */
export interface MediathekFilterOptions {
  bereiche: { id: string; name: string }[];
  kategorien: { id: string; name: string; bereichId: string | null }[];
  prefixes: string[];
  extensions: string[];
}

/** Liefert die Filter-Optionen aus DB (für Bereich/Kategorie-Selects im Picker). */
export async function getMediathekFilterOptions(): Promise<MediathekFilterOptions> {
  const supabase = await createClient();
  const [b, k] = await Promise.all([
    supabase.from("bereiche").select("id, name").order("sortierung"),
    supabase.from("kategorien").select("id, name, bereich_id").order("name"),
  ]);
  return {
    bereiche: (b.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    kategorien: (k.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      bereichId: r.bereich_id ?? null,
    })),
    prefixes: [],
    extensions: [],
  };
}

/**
 * Listet Bilder aus dem `produktbilder`-Bucket. Verwendungs-Counts werden
 * batch-mäßig in einer einzigen Query-Runde ermittelt — für ~1000 Bilder
 * unproblematisch performant.
 *
 * Storage.list() ist limitiert auf 1000 Items pro Aufruf und unterstützt
 * keine Subfolder-rekursion direkt. Wir machen einen Top-Level-list und
 * dann pro Subfolder einen weiteren list-Call.
 */
export async function listMediathek(
  input: ListMediathekInput = {},
): Promise<MediathekItem[]> {
  const supabase = await createClient();

  // 1) Top-Level-Listing — liefert sowohl Files als auch "Subfolders"
  //    (in Supabase Storage sind Subfolders virtual, identifizierbar daran,
  //     dass id=null und name nicht die Endung trägt).
  const { data: top, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error) throw new Error(`Storage-Listing fehlgeschlagen: ${error.message}`);

  const allFiles: { fullPath: string; size: number | null; createdAt: string | null }[] = [];
  const subfolders: string[] = [];

  for (const item of top ?? []) {
    // Files haben eine id, Folder-Entries haben id=null
    if (item.id) {
      allFiles.push({
        fullPath: item.name,
        size: (item.metadata as { size?: number } | null)?.size ?? null,
        createdAt: item.created_at ?? null,
      });
    } else {
      subfolders.push(item.name);
    }
  }

  // 2) Pro Subfolder einen weiteren Listing-Call
  await Promise.all(
    subfolders.map(async (folder) => {
      const { data: items } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      for (const item of items ?? []) {
        if (item.id) {
          allFiles.push({
            fullPath: `${folder}/${item.name}`,
            size: (item.metadata as { size?: number } | null)?.size ?? null,
            createdAt: item.created_at ?? null,
          });
        }
      }
    }),
  );

  // 3) Zentralen Verwendungs-Index laden — eine Query-Runde, dann lokal Lookup
  const verwendungenIndex = await buildBildVerwendungenIndex(supabase);

  // 4) Filter anwenden
  const search = (input.search ?? "").trim().toLowerCase();
  const usage = input.usage ?? "all";
  const prefix = (input.prefix ?? "all").toLowerCase();
  const extension = (input.extension ?? "all").toLowerCase();
  const bereichFilter = input.bereichId ?? "all";
  const kategorieFilter = input.kategorieId ?? "all";

  const items: MediathekItem[] = allFiles
    .map((f) => {
      const lastSlash = f.fullPath.lastIndexOf("/");
      const name = lastSlash >= 0 ? f.fullPath.slice(lastSlash + 1) : f.fullPath;
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
      const firstSlash = f.fullPath.indexOf("/");
      const filePrefix = firstSlash >= 0 ? f.fullPath.slice(0, firstSlash) : "(root)";
      const verwendungen = verwendungenIndex.get(f.fullPath) ?? [];
      return {
        path: f.fullPath,
        name,
        smartTitle: buildMediathekTitle(verwendungen),
        size: f.size,
        createdAt: f.createdAt,
        usageCount: verwendungen.length,
        prefix: filePrefix,
        extension: ext,
        _verwendungen: verwendungen, // intern für Filter
      } as MediathekItem & { _verwendungen: BildVerwendung[] };
    })
    .filter((it) => {
      const blob = `${it.path} ${it.smartTitle}`.toLowerCase();
      if (search && !blob.includes(search)) return false;
      if (usage === "used" && it.usageCount === 0) return false;
      if (usage === "unused" && it.usageCount > 0) return false;
      if (prefix !== "all" && it.prefix !== prefix) return false;
      if (extension !== "all" && it.extension !== extension) return false;
      if (bereichFilter !== "all") {
        const match = it._verwendungen.some((v) => v.bereichId === bereichFilter);
        if (!match) return false;
      }
      if (kategorieFilter !== "all") {
        const match = it._verwendungen.some((v) => v.kategorieId === kategorieFilter);
        if (!match) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Neueste zuerst
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return a.path.localeCompare(b.path);
    });

  // _verwendungen wieder rauswerfen (intern)
  return items.slice(0, PAGE_SIZE).map((it) => {
    const { ...rest } = it as MediathekItem & { _verwendungen?: BildVerwendung[] };
    delete (rest as { _verwendungen?: BildVerwendung[] })._verwendungen;
    return rest;
  });
}

/** Liefert eine signed URL (1h) für ein Mediathek-Bild — für Vorschau/Download. */
export async function getMediathekSignedUrl(path: string): Promise<{ url: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return { url: data?.signedUrl ?? null };
}

/** Liefert alle Verwendungen eines Bilds. */
export async function getMediathekUsages(path: string): Promise<BildVerwendung[]> {
  const supabase = await createClient();
  return getBildVerwendungen(supabase, path);
}

const deleteSchema = z.object({ path: z.string().min(1) });

/**
 * Löscht ein Bild aus dem Storage. Bricht ab, wenn das Bild noch verwendet
 * wird — der Aufrufer soll erst bestätigen, indem er `force: true` setzt.
 */
export async function deleteMediathekBild(input: {
  path: string;
  force?: boolean;
}): Promise<{ ok: boolean; error?: string; usages?: BildVerwendung[] }> {
  const parsed = deleteSchema.safeParse({ path: input.path });
  if (!parsed.success) return { ok: false, error: "Ungültiger Pfad" };

  const supabase = await createClient();
  const usages = await getBildVerwendungen(supabase, parsed.data.path);

  if (usages.length > 0 && !input.force) {
    return {
      ok: false,
      error: `Bild wird noch von ${usages.length} Eintrag/-trägen verwendet.`,
      usages,
    };
  }

  const { error } = await supabase.storage.from(BUCKET).remove([parsed.data.path]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/mediathek");
  return { ok: true };
}

/**
 * Liest die Bildmaße (px + cm @ DPI) eines Mediathek-Bilds via Sharp.
 * Lazy-Load: nur aufgerufen, wenn der User das Detail-Sheet öffnet.
 */
export async function getMediathekDimensions(
  path: string,
): Promise<{ ok: true; dim: ImageDimensions } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Bild nicht gefunden" };
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const dim = await readDimensions(buffer);
  if (!dim) return { ok: false, error: "Bildmaße konnten nicht gelesen werden" };
  return { ok: true, dim };
}

const renameSchema = z.object({
  oldPath: z.string().min(1),
  /** Neuer Datei-Name OHNE Pfad-Prefix (Slash darf nicht enthalten sein). */
  newName: z
    .string()
    .min(1, "Name fehlt")
    .max(200, "Name zu lang")
    .regex(/^[A-Za-z0-9._\-äöüÄÖÜß ]+$/, "Nur Buchstaben, Zahlen, ._- erlaubt"),
});

/**
 * Benennt ein Mediathek-Bild um: Storage `move` und alle Referenzen in der
 * DB werden aktualisiert (Bereiche, Kategorien, Produkte, Katalog-Settings).
 */
export async function renameMediathekBild(input: {
  oldPath: string;
  newName: string;
}): Promise<{ ok: boolean; error?: string; newPath?: string }> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Eingabe ungültig",
    };
  }
  const { oldPath, newName } = parsed.data;

  // Original-Endung beibehalten (auch wenn der User keine angegeben hat).
  const oldDot = oldPath.lastIndexOf(".");
  const oldExt = oldDot >= 0 ? oldPath.slice(oldDot) : "";
  const newDot = newName.lastIndexOf(".");
  const finalName = newDot >= 0 ? newName : `${newName}${oldExt}`;

  // Zielpfad: gleiches Verzeichnis wie das alte Bild.
  const lastSlash = oldPath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? oldPath.slice(0, lastSlash + 1) : "";
  const newPath = `${dir}${finalName}`;

  if (newPath === oldPath) {
    return { ok: false, error: "Neuer Name ist identisch zum alten." };
  }

  const supabase = await createClient();

  // Existiert das Ziel bereits? (Storage move() überschreibt nicht.)
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(dir.replace(/\/$/, ""), { search: finalName, limit: 1 });
  if (existing && existing.some((f) => f.name === finalName)) {
    return { ok: false, error: `Eine Datei mit Namen „${finalName}" existiert bereits.` };
  }

  // 1) Storage move
  const { error: moveErr } = await supabase.storage.from(BUCKET).move(oldPath, newPath);
  if (moveErr) return { ok: false, error: `Move fehlgeschlagen: ${moveErr.message}` };

  // 2) Alle DB-Referenzen aktualisieren
  const usages = await getBildVerwendungen(supabase, oldPath);
  const updates: PromiseLike<unknown>[] = [];

  for (const u of usages) {
    if (u.entityType === "bereich") {
      updates.push(
        supabase.from("bereiche").update({ bild_path: newPath }).eq("id", u.entityId).then(),
      );
    } else if (u.entityType === "kategorie") {
      updates.push(
        supabase.from("kategorien").update({ [u.slot]: newPath }).eq("id", u.entityId).then(),
      );
    } else if (u.entityType === "produkt") {
      updates.push(
        supabase.from("produkte").update({ [u.slot]: newPath }).eq("id", u.entityId).then(),
      );
    } else if (u.entityType === "katalog-einstellungen") {
      updates.push(
        supabase.from("katalog_einstellungen").update({ [u.slot]: newPath }).eq("id", 1).then(),
      );
    }
  }

  await Promise.all(updates);

  revalidatePath("/mediathek");
  return { ok: true, newPath };
}
