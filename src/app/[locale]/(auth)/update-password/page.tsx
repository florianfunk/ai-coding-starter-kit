import { setRequestLocale } from "next-intl/server";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default async function UpdatePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UpdatePasswordForm />;
}
