"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import type { KatalogParams } from "@/lib/pdf/katalog-document";

export type StartKatalogResult = { jobId?: string; error: string | null };

export async function startKatalogJob(params: KatalogParams): Promise<StartKatalogResult> {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("katalog_jobs")
    .insert({ status: "queued", parameter: params as any })
    .select("id")
    .single();
  if (error || !job) return { error: error?.message ?? "Job-Anlage fehlgeschlagen" };

  revalidatePath("/export/katalog");
  return { jobId: job.id, error: null };
}

export async function deleteKatalogJob(jobId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // PDF aus Storage entfernen, falls vorhanden
  const { data: job } = await supabase.from("katalog_jobs").select("pdf_path").eq("id", jobId).single();
  if (job?.pdf_path) {
    await supabase.storage.from("kataloge").remove([job.pdf_path]);
  }

  const { error } = await supabase.from("katalog_jobs").delete().eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath("/export/katalog");
  return { error: null };
}

export async function deleteFinishedJobs(): Promise<{ error: string | null; count: number }> {
  const supabase = await createClient();

  const { data: done } = await supabase
    .from("katalog_jobs")
    .select("id, pdf_path")
    .in("status", ["done", "error"]);

  if (done?.length) {
    const paths = done.map((j) => j.pdf_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("kataloge").remove(paths);
    const ids = done.map((j) => j.id);
    const { error } = await supabase.from("katalog_jobs").delete().in("id", ids);
    if (error) return { error: error.message, count: 0 };
  }

  revalidatePath("/export/katalog");
  return { error: null, count: done?.length ?? 0 };
}

export async function getKatalogJob(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("katalog_jobs").select("*").eq("id", jobId).single();
  let pdfUrl: string | null = null;
  if (data?.pdf_path) {
    pdfUrl = await getSignedUrl("kataloge", data.pdf_path);
  }
  return { job: data, pdfUrl };
}
