export type Bereich = {
  id: string;
  external_id: string | null;
  name: string;
  beschreibung: string | null;
  sortierung: number;
  seitenzahl: number | null;
  startseite: number | null;
  bild_path: string | null;
  created_at: string;
  updated_at: string;
};

export type BereichWithStats = Bereich & {
  kategorien_count: number;
  produkte_count: number;
};
