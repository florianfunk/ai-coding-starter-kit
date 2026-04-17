-- Artikelnummern müssen nicht unique sein — in FileMaker gibt es Duplikate.
-- Den UNIQUE-Index durch einen normalen Index ersetzen.
alter table public.produkte drop constraint if exists produkte_artikelnummer_key;
drop index if exists produkte_artikelnummer_key;
create index if not exists produkte_artikelnummer_idx on public.produkte (artikelnummer);
