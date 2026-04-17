-- Farbfelder.code darf nicht unique sein — in FileMaker gibt es doppelte Codes.
-- Wir ersetzen den unique-Index durch einen normalen.
drop index if exists public.farbfelder_code_idx;
create index if not exists farbfelder_code_idx on public.farbfelder (code);
