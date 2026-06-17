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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const magicSchema = z.object({ email: z.string().email() });

export function LoginForm() {
  const t = useTranslations("Login");
  const tc = useTranslations("Common");
  const ta = useTranslations("Auth");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [magicSentTo, setMagicSentTo] = useState<string | null>(null);

  const pwForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });
  const magicForm = useForm<z.infer<typeof magicSchema>>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: "" },
  });

  async function onPassword(values: z.infer<typeof passwordSchema>) {
    setLoading(true);
    try {
      if (!hasSupabaseEnv) {
        toast.info(`${tc("appName")} – Preview`);
        window.location.href = `/${locale}/dashboard`;
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword(values);
      if (error || !data.session) {
        toast.error(t("invalidCredentials"));
        return;
      }
      window.location.href = `/${locale}/dashboard`;
    } catch {
      toast.error(t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  async function onMagicLink(values: z.infer<typeof magicSchema>) {
    setLoading(true);
    try {
      if (!hasSupabaseEnv) {
        setMagicSentTo(values.email);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
        },
      });
      if (error) {
        toast.error(t("genericError"));
        return;
      }
      setMagicSentTo(values.email);
    } catch {
      toast.error(t("genericError"));
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
        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">{t("tabPassword")}</TabsTrigger>
            <TabsTrigger value="magic">{t("tabMagicLink")}</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="pt-4">
            <Form {...pwForm}>
              <form
                onSubmit={pwForm.handleSubmit(onPassword)}
                className="space-y-4"
                noValidate
              >
                <FormField
                  control={pwForm.control}
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
                <FormField
                  control={pwForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{tc("password")}</FormLabel>
                        <Link
                          href="/reset-password"
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {t("forgotPassword")}
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder={ta("passwordPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("signIn")}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="magic" className="pt-4">
            {magicSentTo ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <MailCheck className="h-10 w-10 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("magicLinkSent", { email: magicSentTo })}
                </p>
              </div>
            ) : (
              <Form {...magicForm}>
                <form
                  onSubmit={magicForm.handleSubmit(onMagicLink)}
                  className="space-y-4"
                  noValidate
                >
                  <FormField
                    control={magicForm.control}
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
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("sendMagicLink")}
                  </Button>
                </form>
              </Form>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
