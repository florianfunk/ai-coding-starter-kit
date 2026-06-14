// PROJ-20: Zod-Schema für den Merkliste-Toggle.

import { z } from "zod";

/** Body für POST /api/buchungen/[id]/merkliste. */
export const merklisteToggleSchema = z.object({
  action: z.enum(["add", "remove"]),
});

export type MerklisteToggleInput = z.infer<typeof merklisteToggleSchema>;
