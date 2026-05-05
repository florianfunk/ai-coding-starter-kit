import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { DruckhistorieTable } from "../../druckhistorie-table";

export default async function KundeDruckhistorieTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("katalog_jobs")
    .select("id, status, typ, kunde_id, produkt_id, parameter, pdf_path, error_text, created_at")
    .eq("kunde_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Card>
      <CardContent className="py-4">
        <DruckhistorieTable jobs={(jobs ?? []) as never} />
      </CardContent>
    </Card>
  );
}
