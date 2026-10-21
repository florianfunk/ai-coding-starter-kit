import BuchungenPage from "../page";

export const metadata = {
  title: "Zurückgestellte Buchungen · STEUERAGENT",
};

export default async function ZurueckgestellteBuchungenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return BuchungenPage({
    searchParams: Promise.resolve({
      ...(await searchParams),
      steuerstatus: "zurueckgestellt",
    }),
  });
}
