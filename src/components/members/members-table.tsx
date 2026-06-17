"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import {
  changeMemberRoleAction,
  removeMemberAction,
  setMemberStatusAction,
} from "@/lib/actions/members";
import { revokeInvitationAction } from "@/lib/actions/invitations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, type Invitation, type Member, type Role } from "@/lib/data/types";

const roleVariant: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  analyst: "secondary",
  viewer: "outline",
};

export function MembersTable({
  members,
  invites,
  orgId,
}: {
  members: Member[];
  invites: Invitation[];
  orgId: string;
}) {
  const t = useTranslations("Members");
  const tr = useTranslations("Roles");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    if (!hasSupabaseEnv) {
      toast.success(t("updated"));
      return;
    }
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(t("updated"));
        router.refresh();
      } else {
        toast.error(
          res.error === "last_admin" ? t("errorLastAdmin") : t("actionError"),
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <Card>
        {members.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="w-[1%] text-right">
                  <span className="sr-only">{tc("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">
                      {m.name ?? "—"}
                      {m.isSelf && (
                        <span className="ml-1 text-muted-foreground">
                          ({t("you")})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {m.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleVariant[m.role]}>{tr(m.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    {m.status === "active" ? (
                      <Badge variant="secondary">{t("statusActive")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {t("statusDeactivated")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          aria-label={tc("actions")}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {t("changeRole")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r}
                                disabled={r === m.role}
                                onClick={() =>
                                  run(() =>
                                    changeMemberRoleAction(orgId, m.id, r),
                                  )
                                }
                              >
                                {tr(r)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem
                          onClick={() =>
                            run(() =>
                              setMemberStatusAction(
                                orgId,
                                m.id,
                                m.status === "active" ? "deactivated" : "active",
                              ),
                            )
                          }
                        >
                          {m.status === "active"
                            ? t("deactivate")
                            : t("reactivate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={m.isSelf}
                          onClick={() =>
                            run(() => removeMemberAction(orgId, m.id))
                          }
                        >
                          {t("remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("pendingInvites")}
          </h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="w-[1%] text-right">
                    <span className="sr-only">{tc("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleVariant[inv.role]}>
                        {tr(inv.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t("statusPending")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => revokeInvitationAction(inv.id, orgId))
                        }
                      >
                        {t("revokeInvite")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
