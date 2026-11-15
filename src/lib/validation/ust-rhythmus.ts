import { z } from "zod";

export const ustRhythmusWechselSchema = z.object({
  rhythmus_gueltig_ab: z.string().regex(
    /^(20\d{2}|2100)-(01|04|07|10)-01$/,
    "Bitte einen Quartalsbeginn wählen: 1. Januar, 1. April, 1. Juli oder 1. Oktober.",
  ),
});
