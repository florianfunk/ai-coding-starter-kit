import { createClient } from "@/lib/supabase/server";

/** Returns a 1-hour signed URL for the given storage path, or null. */
export async function getSignedUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
