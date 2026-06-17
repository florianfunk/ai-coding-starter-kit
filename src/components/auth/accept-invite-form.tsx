"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { acceptInvitationAction } from "@/lib/actions/accept";
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

export function AcceptInviteForm({ token }: { token: string | null }) {
  const t = useTranslations("AcceptInvite");
  const tc = useTranslations("Common");
  const ta = useTranslations("Auth");
  const tl = useTranslations("Login");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "needLogin" | "linkSent">("idle");

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().email() })),
    defaultValues: { email: "" },
  });

  if (!token) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("invalidToken")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{t("requestNew")}</p>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">{tl("title")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  async function accept() {
    setLoading(true);
    try {
      if (!hasSupabaseEnv) {
        toast.success(t("accepted"));
        window.location.href = `/${locale}/dashboard`;
        return;
      }
      const res = await acceptInvitationAction(token!);
      if (res.ok) {
        toast.success(t("accepted"));
        window.location.href = `/${locale}/dashboard`;
        return;
      }
      if (res.error === "not_authenticated") {
        setPhase("needLogin");
        return;
      }
      toast.error(t("invalidToken"));
    } finally {
      setLoading(false);
    }
  }

  async function sendLink(values: { email: string }) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/${locale}/accept-invite?token=${token}`,
        },
      });
      if (error) {
        toast.error(tl("genericError"));
        return;
      }
      setPhase("linkSent");
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
        {phase === "idle" && (
          <Button className="w-full" onClick={accept} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("accept")}
          </Button>
        )}

        {phase === "needLogin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("needLogin")}</p>
            <Form {...emailForm}>
              <form
                onSubmit={emailForm.handleSubmit(sendLink)}
                className="space-y-4"
                noValidate
              >
                <FormField
                  control={emailForm.control}
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
                  {t("sendLoginLink")}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {phase === "linkSent" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <MailCheck className="h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("loginLinkSent", { email: emailForm.getValues("email") })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
