"use client";

import { useState } from "react";
import { toggleUserBan, resetUserPassword, type UserRow } from "./actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, KeyRound, Ban, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserActionsCellProps {
  user: UserRow;
  currentUserId: string;
}

export function UserActionsCell({ user, currentUserId }: UserActionsCellProps) {
  const [loading, setLoading] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const isSelf = user.id === currentUserId;

  async function handleResetPassword() {
    setLoading(true);
    try {
      const result = await resetUserPassword(user.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Passwort-Reset-Link wurde generiert.");
      }
    } catch {
      toast.error("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleBan() {
    setLoading(true);
    try {
      const result = await toggleUserBan(user.id, !user.banned);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          user.banned
            ? "Benutzer wurde aktiviert."
            : "Benutzer wurde deaktiviert.",
        );
      }
    } catch {
      toast.error("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
      setConfirmBan(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
            <span className="sr-only">Aktionen</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleResetPassword}>
            <KeyRound className="mr-2 h-4 w-4" />
            Passwort zuruecksetzen
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmBan(true)}
                className={user.banned ? "" : "text-destructive focus:text-destructive"}
              >
                {user.banned ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aktivieren
                  </>
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" />
                    Deaktivieren
                  </>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmBan} onOpenChange={setConfirmBan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Benutzer {user.banned ? "aktivieren" : "deaktivieren"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user.banned
                ? `${user.email} kann sich nach der Aktivierung wieder anmelden.`
                : `${user.email} kann sich nach der Deaktivierung nicht mehr anmelden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleBan} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user.banned ? "Aktivieren" : "Deaktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
