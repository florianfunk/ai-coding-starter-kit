"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({ email: z.string().email() });

export function ResetPasswordForm() {
  const t = useTranslations("ResetPassword");
  const tc = useTranslations("Common");
  const ta = useTranslations("Auth");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setLoading(true);
    try {
      if (hasSupabaseEnv) {
        const supabase = createClient();
        await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/${locale}/update-password`,
        });
      }
      // Always show the same confirmation (do not reveal whether an account exists).
      setSentTo(values.email);
    } catch {
      setSentTo(values.email);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <MailCheck className="h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("linkSent", { email: sentTo })}
            </p>
            <Button variant="outline" asChild>
              <Link href="/login">{t("backToLogin")}</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tc("email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder={ta("emailPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("sendLink")}
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/login">{t("backToLogin")}</Link>
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
