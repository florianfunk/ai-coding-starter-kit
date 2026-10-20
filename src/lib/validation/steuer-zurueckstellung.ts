import { z } from "zod";

export const steuerZurueckstellungSchema = z.discriminatedUnion("aktion", [
  z.object({
    aktion: z.literal("zurueckstellen"),
    grund: z.string().trim().min(1, "Bitte einen Grund angeben.").max(1000),
    erwartete_version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }).strict(),
  z.object({
    aktion: z.literal("wiederaufnehmen"),
    erwartete_version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }).strict(),
]);
