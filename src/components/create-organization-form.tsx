"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createOrganizationAction } from "@/lib/actions/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function CreateOrganizationForm() {
  const t = useTranslations("NoOrg");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const schema = z.object({ name: z.string().trim().min(1).max(120) });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setLoading(true);
    try {
      if (!hasSupabaseEnv) {
        window.location.href = `/${locale}/dashboard`;
        return;
      }
      const res = await createOrganizationAction(values.name);
      if (res.ok) {
        window.location.href = `/${locale}/dashboard`;
        return;
      }
      toast.error(t("createError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3 text-left"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("orgNameLabel")}</FormLabel>
              <FormControl>
                <Input placeholder={t("orgNamePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("create")}
        </Button>
      </form>
    </Form>
  );
}
