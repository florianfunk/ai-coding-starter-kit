"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { duplicateTemplate } from "./actions";

export function DuplicateButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost" size="sm" className="h-8"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await duplicateTemplate(id);
        if (r.error) toast.error(r.error);
        else if (r.id) { toast.success("Dupliziert"); router.push(`/datenblatt-vorlagen/${r.id}`); }
      })}
    >
      <Copy className="h-3.5 w-3.5 mr-1" /> Kopie
    </Button>
  );
}
