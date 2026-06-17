import { redirect } from "@/i18n/navigation";

// Landing on the locale root sends the user to the dashboard. Middleware handles
// the auth gate (redirecting to /login when there is no session).
export default async function IndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/dashboard", locale });
}
