"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Membership } from "@/lib/data/types";

function selectOrg(orgId: string) {
  // The active org is read by the (app) layout from this cookie.
  document.cookie = `rg_active_org=${orgId}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: Membership[];
  activeOrgId: string | null;
}) {
  const t = useTranslations("Header");
  const active =
    memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-[220px] gap-2">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{active.orgName}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t("switchOrg")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.orgId}
            onClick={() => selectOrg(m.orgId)}
            className="gap-2"
          >
            <span className="truncate">{m.orgName}</span>
            {m.orgId === active.orgId && (
              <Check className="ml-auto h-4 w-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        {memberships.length <= 1 && (
          <DropdownMenuItem disabled>{t("noOtherOrgs")}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
