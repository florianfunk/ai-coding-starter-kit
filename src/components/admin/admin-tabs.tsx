"use client";

// PROJ-13: Adminbereich — 4 Tabs (KI, Benutzer, System, Daten).
// shadcn/ui Tabs als Container; Inhalte in eigenen Panels.

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  BenutzerInfo,
  KiStatus,
} from "@/app/(app)/einstellungen/admin/page";
import { KiPanel } from "./ki-panel";
import { BenutzerPanel } from "./benutzer-panel";
import { SystemPanel } from "./system-panel";
import { DatenPanel } from "./daten-panel";

export function AdminTabs({
  initialKi,
  benutzer,
}: {
  initialKi: KiStatus;
  benutzer: BenutzerInfo;
}) {
  return (
    <Tabs defaultValue="ki" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="ki">KI</TabsTrigger>
        <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
        <TabsTrigger value="daten">Daten</TabsTrigger>
      </TabsList>

      <TabsContent value="ki" className="mt-6">
        <KiPanel initialKi={initialKi} />
      </TabsContent>
      <TabsContent value="benutzer" className="mt-6">
        <BenutzerPanel benutzer={benutzer} />
      </TabsContent>
      <TabsContent value="system" className="mt-6">
        <SystemPanel />
      </TabsContent>
      <TabsContent value="daten" className="mt-6">
        <DatenPanel />
      </TabsContent>
    </Tabs>
  );
}
