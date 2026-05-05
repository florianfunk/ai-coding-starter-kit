import { redirect } from "next/navigation";

export default async function KundeDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/kunden/${id}/stammdaten`);
}
