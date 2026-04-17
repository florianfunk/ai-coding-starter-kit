import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Job-ID fehlt" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("katalog_jobs")
    .select("status, progress, pdf_path, error_text")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: "Job nicht gefunden" },
      { status: 404 },
    );
  }

  // Generate signed URL if job is done and has a pdf_path
  let pdfUrl: string | null = null;
  if (job.status === "done" && job.pdf_path) {
    const { data } = await supabase.storage
      .from("kataloge")
      .createSignedUrl(job.pdf_path, 60 * 60);
    pdfUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress ?? 0,
    pdfUrl,
    errorText: job.error_text,
  });
}
