-- ============================================================================
-- produkt_icons: Wert pro Icon-Zuordnung (FileMaker "Icon_Wert_1..10")
-- ============================================================================
-- FileMaker pflegt zu jedem Icon am Artikel einen Freitext-Wert
-- (z.B. Watt=4,8 / Volt=24VDC / Lumen/mt=430). Der Wert gehört zur
-- Produkt↔Icon-Zuordnung — nicht zum Icon selbst, da er pro Artikel variiert.
-- Typ text, weil Werte sowohl Zahlen als auch Einheiten enthalten ("24VDC").
alter table public.produkt_icons
  add column if not exists wert text;
