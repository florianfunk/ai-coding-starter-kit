"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getBildVerwendungen,
  countBildVerwendungenBatch,
  type BildVerwendung,
} from "@/lib/bild-verwendung";

const BUCKET = "produktbilder";
const PAGE_SIZE = 100;

export interface MediathekItem {
  /** Storage-Pfad (z.B. "kategorien/upload-...-foo.jpg") */
  path: string;
  /** Letzter Pfad-Bestandteil (Dateiname für UI) */
  name: string;
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
  /** Volltext-Suche im Pfad/Dateiname */
  search?: string;
  /** Filter: alle / nur verwendete / nur unbenutzte */
  usage?: UsageFilter;
  /** Pfad-Präfix-Filter (erstes Segment, z.B. "kategorien", "produkte"). "all" = ohne Filter */
  prefix?: string;
  /** Datei-Format-Filter (Endung ohne Punkt). "all" = ohne Filter */
  extension?: string;
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

  // 3) Verwendungs-Counts ermitteln (eine Query-Runde für alle Pfade)
  const usageCounts = await countBildVerwendungenBatch(
    supabase,
    allFiles.map((f) => f.fullPath),
  );

  // 4) Filter anwenden
  const search = (input.search ?? "").trim().toLowerCase();
  const usage = input.usage ?? "all";
  const prefix = (input.prefix ?? "all").toLowerCase();
  const extension = (input.extension ?? "all").toLowerCase();

  const items: MediathekItem[] = allFiles
    .map((f) => {
      const lastSlash = f.fullPath.lastIndexOf("/");
      const name = lastSlash >= 0 ? f.fullPath.slice(lastSlash + 1) : f.fullPath;
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
      const firstSlash = f.fullPath.indexOf("/");
      const filePrefix = firstSlash >= 0 ? f.fullPath.slice(0, firstSlash) : "(root)";
      return {
        path: f.fullPath,
        name,
        size: f.size,
        createdAt: f.createdAt,
        usageCount: usageCounts.get(f.fullPath) ?? 0,
        prefix: filePrefix,
        extension: ext,
      };
    })
    .filter((it) => {
      if (search && !it.path.toLowerCase().includes(search)) return false;
      if (usage === "used" && it.usageCount === 0) return false;
      if (usage === "unused" && it.usageCount > 0) return false;
      if (prefix !== "all" && it.prefix !== prefix) return false;
      if (extension !== "all" && it.extension !== extension) return false;
      return true;
    })
    .sort((a, b) => {
      // Neueste zuerst
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return a.path.localeCompare(b.path);
    });

  return items.slice(0, PAGE_SIZE);
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
