"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildBildVerwendungenIndex,
  getBildVerwendungen,
  buildMediathekTitle,
} from "@/lib/bild-verwendung";

const BUCKET = "produktbilder";

export interface DubletteFile {
  path: string;
  size: number | null;
  usageCount: number;
  smartTitle: string;
  createdAt: string | null;
}

export interface DubletteGroup {
  /** SHA-256 des Bildinhalts (hex) */
  hash: string;
  /** Größe in Bytes */
  size: number;
  /** Vorgeschlagener Master (höchste Verwendung, älteste Datei als Tiebreaker) */
  masterPath: string;
  /** Alle Dateien mit identischem Hash, inkl. Master */
  files: DubletteFile[];
  /** Wie viele DB-Referenzen müssten umgebogen werden, wenn wir konsolidieren */
  dbReferencesToRewrite: number;
  /** Wie viele Bytes wir einsparen würden (size × (files.length - 1)) */
  bytesSavable: number;
}

export interface DubletteAnalysisResult {
  scannedFiles: number;
  totalBytes: number;
  duplicateGroups: DubletteGroup[];
  uniqueDuplicateFiles: number;
  bytesSavable: number;
  dbReferencesAffected: number;
  /** Wenn das Hashen abgebrochen wurde (Timeout/Fehler) — sonst leer */
  errors: { path: string; message: string }[];
}

interface FileMeta {
  path: string;
  size: number | null;
  createdAt: string | null;
}

/** Listet alle Dateien in `produktbilder` rekursiv auf (Top-Level + 1 Subfolder-Ebene). */
async function listAllFiles(): Promise<FileMeta[]> {
  const supabase = await createClient();
  const { data: top, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`Storage-Listing: ${error.message}`);

  const files: FileMeta[] = [];
  const subfolders: string[] = [];
  for (const item of top ?? []) {
    if (item.id) {
      files.push({
        path: item.name,
        size: (item.metadata as { size?: number } | null)?.size ?? null,
        createdAt: item.created_at ?? null,
      });
    } else {
      subfolders.push(item.name);
    }
  }

  await Promise.all(
    subfolders.map(async (folder) => {
      const { data: items } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      for (const item of items ?? []) {
        if (item.id) {
          files.push({
            path: `${folder}/${item.name}`,
            size: (item.metadata as { size?: number } | null)?.size ?? null,
            createdAt: item.created_at ?? null,
          });
        }
      }
    }),
  );

  return files;
}

/**
 * Analysiert die Mediathek auf byte-genaue Dubletten via SHA-256.
 *
 * Strategie zur Performance: erst nach Größe gruppieren (Bilder mit
 * unterschiedlicher Größe können keine Dubletten sein), dann nur die
 * Größen-Kollisionen tatsächlich downloaden + hashen.
 */
export async function analyzeDubletten(): Promise<DubletteAnalysisResult> {
  const supabase = await createClient();

  // 1) Alle Dateien listen
  const allFiles = await listAllFiles();
  const totalBytes = allFiles.reduce((sum, f) => sum + (f.size ?? 0), 0);

  // 2) Gruppen nach Size (Quick-Filter — Größen-Unikate können keine Dubletten sein)
  const bySize = new Map<number, FileMeta[]>();
  for (const f of allFiles) {
    if (f.size == null) continue;
    const arr = bySize.get(f.size) ?? [];
    arr.push(f);
    bySize.set(f.size, arr);
  }

  // 3) Verwendungs-Index für Dedup-Entscheidung + Smart-Titles
  const verwendungenIndex = await buildBildVerwendungenIndex(supabase);

  // 4) Nur Größen-Kollisionen tatsächlich hashen
  const errors: { path: string; message: string }[] = [];
  const byHash = new Map<
    string,
    { size: number; files: FileMeta[] }
  >();

  for (const [size, group] of bySize) {
    if (group.length < 2) continue;

    // Parallel-Download der Kollisionsgruppe
    const hashed = await Promise.all(
      group.map(async (f) => {
        try {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .download(f.path);
          if (error || !data) {
            errors.push({ path: f.path, message: error?.message ?? "Download fehlgeschlagen" });
            return null;
          }
          const buf = Buffer.from(await data.arrayBuffer());
          const hash = crypto.createHash("sha256").update(buf).digest("hex");
          return { file: f, hash };
        } catch (e) {
          errors.push({
            path: f.path,
            message: e instanceof Error ? e.message : String(e),
          });
          return null;
        }
      }),
    );

    for (const h of hashed) {
      if (!h) continue;
      const entry = byHash.get(h.hash) ?? { size, files: [] };
      entry.files.push(h.file);
      byHash.set(h.hash, entry);
    }
  }

  // 5) Ergebnis bauen — nur Gruppen mit ≥2 Dateien sind Dubletten
  const duplicateGroups: DubletteGroup[] = [];
  let uniqueDuplicateFiles = 0;
  let bytesSavable = 0;
  let dbReferencesAffected = 0;

  for (const [hash, { size, files }] of byHash) {
    if (files.length < 2) continue;

    const enriched: DubletteFile[] = files.map((f) => {
      const verwendungen = verwendungenIndex.get(f.path) ?? [];
      return {
        path: f.path,
        size: f.size,
        createdAt: f.createdAt,
        usageCount: verwendungen.length,
        smartTitle: buildMediathekTitle(verwendungen),
      };
    });

    // Master-Wahl: meiste Verwendungen → älteste Datei → alphabetisch
    enriched.sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      const ac = a.createdAt ?? "";
      const bc = b.createdAt ?? "";
      if (ac && bc && ac !== bc) return ac.localeCompare(bc);
      return a.path.localeCompare(b.path);
    });

    const masterPath = enriched[0].path;
    const dupesInGroup = enriched.length - 1;
    const refsToRewrite = enriched
      .slice(1)
      .reduce((sum, f) => sum + f.usageCount, 0);

    duplicateGroups.push({
      hash,
      size,
      masterPath,
      files: enriched,
      dbReferencesToRewrite: refsToRewrite,
      bytesSavable: size * dupesInGroup,
    });

    uniqueDuplicateFiles += dupesInGroup;
    bytesSavable += size * dupesInGroup;
    dbReferencesAffected += refsToRewrite;
  }

  // Größte Einsparung zuerst
  duplicateGroups.sort((a, b) => b.bytesSavable - a.bytesSavable);

  return {
    scannedFiles: allFiles.length,
    totalBytes,
    duplicateGroups,
    uniqueDuplicateFiles,
    bytesSavable,
    dbReferencesAffected,
    errors,
  };
}

/**
 * Eine zu konsolidierende Gruppe: Master bleibt, alle anderen Pfade werden in
 * der DB auf den Master umgebogen. Die Liste kommt vom UI (User wählt aus).
 */
export interface ConsolidationGroup {
  masterPath: string;
  duplicatePaths: string[];
}

export interface ConsolidationResult {
  ok: boolean;
  rewrittenReferences: number;
  groupsProcessed: number;
  /** Pfade, die jetzt verwaist sind (=safe to delete) */
  orphanedPaths: string[];
  errors: { path: string; message: string }[];
}

/**
 * Biegt alle DB-Referenzen von `duplicatePaths` auf `masterPath` um.
 *
 * Schreibt Tabelle für Tabelle, Spalte für Spalte — keine Transaktion über
 * mehrere Statements (Supabase RPC-Light), aber jede Spalten-Update-Query
 * ist atomar. Ein Fehler stoppt die Verarbeitung, das Ergebnis listet auf,
 * was bereits passiert ist.
 *
 * Schreibt NICHTS am Storage — Storage-Cleanup ist Schritt 2.
 */
export async function consolidateDubletten(
  groups: ConsolidationGroup[],
): Promise<ConsolidationResult> {
  const supabase = await createClient();
  const errors: { path: string; message: string }[] = [];
  const orphanedPaths: string[] = [];
  let rewrittenReferences = 0;
  let groupsProcessed = 0;

  // Spalten-Karte (muss synchron mit src/lib/bild-verwendung.ts sein)
  const KATEGORIE_COLS = ["bild1_path", "bild2_path", "bild3_path", "bild4_path"];
  const PRODUKT_COLS = [
    "hauptbild_path",
    "bild_detail_1_path",
    "bild_detail_2_path",
    "bild_zeichnung_1_path",
    "bild_zeichnung_2_path",
    "bild_zeichnung_3_path",
    "bild_energielabel_path",
  ];
  const KATALOG_COLS = [
    "cover_vorne_path",
    "cover_hinten_path",
    "logo_lichtengros_dunkel",
    "logo_lichtengros_hell",
    "logo_eisenkeil_dunkel",
    "logo_eisenkeil_hell",
    "logo_lichtstudio",
  ];

  for (const group of groups) {
    if (group.duplicatePaths.length === 0) continue;
    if (group.duplicatePaths.includes(group.masterPath)) {
      errors.push({
        path: group.masterPath,
        message: "Master darf nicht in der Dublettenliste stehen",
      });
      continue;
    }

    let groupHadError = false;

    for (const dupePath of group.duplicatePaths) {
      try {
        // bereiche.bild_path
        const r1 = await supabase
          .from("bereiche")
          .update({ bild_path: group.masterPath })
          .eq("bild_path", dupePath)
          .select("id");
        if (r1.error) throw new Error(`bereiche: ${r1.error.message}`);
        rewrittenReferences += r1.data?.length ?? 0;

        // kategorien.bildN_path — pro Spalte separat
        for (const col of KATEGORIE_COLS) {
          const r = await supabase
            .from("kategorien")
            .update({ [col]: group.masterPath })
            .eq(col, dupePath)
            .select("id");
          if (r.error) throw new Error(`kategorien.${col}: ${r.error.message}`);
          rewrittenReferences += r.data?.length ?? 0;
        }

        // produkte.* — pro Spalte separat
        for (const col of PRODUKT_COLS) {
          const r = await supabase
            .from("produkte")
            .update({ [col]: group.masterPath })
            .eq(col, dupePath)
            .select("id");
          if (r.error) throw new Error(`produkte.${col}: ${r.error.message}`);
          rewrittenReferences += r.data?.length ?? 0;
        }

        // katalog_einstellungen.* — pro Spalte separat
        for (const col of KATALOG_COLS) {
          const r = await supabase
            .from("katalog_einstellungen")
            .update({ [col]: group.masterPath })
            .eq(col, dupePath)
            .select("id");
          if (r.error) throw new Error(`katalog_einstellungen.${col}: ${r.error.message}`);
          rewrittenReferences += r.data?.length ?? 0;
        }

        // Verifikation: keine Referenz mehr auf dupePath?
        const remaining = await getBildVerwendungen(supabase, dupePath);
        if (remaining.length === 0) {
          orphanedPaths.push(dupePath);
        } else {
          errors.push({
            path: dupePath,
            message: `Nach Update noch ${remaining.length} Referenz(en) übrig`,
          });
          groupHadError = true;
        }
      } catch (e) {
        errors.push({
          path: dupePath,
          message: e instanceof Error ? e.message : String(e),
        });
        groupHadError = true;
      }
    }

    if (!groupHadError) groupsProcessed++;
  }

  // Caches der betroffenen Seiten verwerfen
  revalidatePath("/mediathek");
  revalidatePath("/mediathek/dubletten");
  revalidatePath("/kategorien");
  revalidatePath("/produkte");

  return {
    ok: errors.length === 0,
    rewrittenReferences,
    groupsProcessed,
    orphanedPaths,
    errors,
  };
}

export interface DeleteOrphansResult {
  ok: boolean;
  deletedCount: number;
  /** Pfade, die NICHT gelöscht wurden, weil noch Referenzen existieren */
  skippedPaths: { path: string; reason: string }[];
  errors: { path: string; message: string }[];
}

/**
 * Löscht Storage-Dateien, NACHDEM verifiziert wurde, dass sie nirgendwo
 * mehr in der DB referenziert werden. Schutzschalter — falls in der Zwischen-
 * zeit doch wieder eine Referenz angelegt wurde, wird die Datei übersprungen.
 */
export async function deleteOrphanedDubletten(
  paths: string[],
): Promise<DeleteOrphansResult> {
  const supabase = await createClient();
  const errors: { path: string; message: string }[] = [];
  const skippedPaths: { path: string; reason: string }[] = [];
  const safeToDelete: string[] = [];

  for (const path of paths) {
    try {
      const usages = await getBildVerwendungen(supabase, path);
      if (usages.length > 0) {
        skippedPaths.push({
          path,
          reason: `${usages.length} Referenz(en) vorhanden — nicht gelöscht`,
        });
      } else {
        safeToDelete.push(path);
      }
    } catch (e) {
      errors.push({
        path,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Storage.remove() nimmt bis 1000 Pfade auf einmal
  let deletedCount = 0;
  if (safeToDelete.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(safeToDelete);
    if (error) {
      errors.push({ path: "(batch)", message: error.message });
    } else {
      deletedCount = safeToDelete.length;
    }
  }

  revalidatePath("/mediathek");
  revalidatePath("/mediathek/dubletten");

  return {
    ok: errors.length === 0,
    deletedCount,
    skippedPaths,
    errors,
  };
}
