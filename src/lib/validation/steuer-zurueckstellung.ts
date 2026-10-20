import { z } from "zod";

export const steuerZurueckstellungSchema = z.discriminatedUnion("aktion", [
  z.object({
    aktion: z.literal("zurueckstellen"),
    grund: z.string().trim().min(1, "Bitte einen Grund angeben.").max(1000),
    erwartet_am: z.iso.datetime({ offset: true }).nullable(),
  }).strict(),
  z.object({
    aktion: z.literal("wiederaufnehmen"),
    erwartet_am: z.iso.datetime({ offset: true }).nullable(),
  }).strict(),
]);
