"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, CircleDashed, CircleCheck } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AiUebersetzenButton, type GetItContext } from "@/components/ai-uebersetzen-button";
import { TRANSLATABLE_FIELDS } from "@/lib/i18n/translatable-fields";

type ItValues = Record<string, string>;

interface Props {
  produktId: string | null;
  /** DE-Werte aus dem Form-State (live). */
  getDeValues: () => Record<string, string>;
  /** Initiale IT-Werte aus der DB. */
  defaultItValues: Record<string, string | null | undefined>;
}

/** Eigene Section "🇮🇹 Italienisch" für das Produkt-Formular.
 *  Hält den IT-State lokal, schreibt ihn als hidden Inputs ins Form (mit
 *  feldnamen `name_it`, `datenblatt_titel_it`, …) — so landet er beim
 *  regulären "Speichern" automatisch in der bestehenden Server-Action. */
export function ItalienischSection({ produktId, getDeValues, defaultItValues }: Props) {
  const initial = useMemo<ItValues>(() => {
    const out: ItValues = {};
    for (const f of TRANSLATABLE_FIELDS) {
      const v = defaultItValues[f.it];
      out[f.de] = typeof v === "string" ? v : "";
    }
    return out;
  }, [defaultItValues]);

  const [values, setValues] = useState<ItValues>(initial);

  const setOne = useCallback((deKey: string, value: string) => {
    setValues((prev) => (prev[deKey] === value ? prev : { ...prev, [deKey]: value }));
  }, []);

  const filledCount = useMemo(
    () => TRANSLATABLE_FIELDS.filter((f) => (values[f.de] ?? "").trim() !== "").length,
    [values],
  );
  const totalCount = TRANSLATABLE_FIELDS.length;

  const getContext = useCallback<GetItContext>(() => {
    return {
      produktId,
      quelltexte: getDeValues(),
      itAktuell: { ...values },
    };
  }, [produktId, getDeValues, values]);

  return (
    <div className="glass-card overflow-hidden border-0">
      <div className="card-head pr-3">
        <div className="card-head-icon">
          <span className="text-base leading-none" aria-hidden>
            🇮🇹
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="card-head-title">Italienisch</span>
            {filledCount === 0 ? (
              <span className="pill pill-warn">Leer</span>
            ) : filledCount < totalCount ? (
              <span className="pill">teilweise</span>
            ) : (
              <span className="pill pill-ok">vollständig</span>
            )}
          </div>
          <div className="card-head-sub font-mono">
            {filledCount} / {totalCount} Felder übersetzt
          </div>
        </div>
        <AiUebersetzenButton
          getContext={getContext}
          onAccept={setOne}
          triggerVariant="default"
          triggerSize="sm"
          triggerLabel="Alle Felder übersetzen"
        />
      </div>

      <div className="space-y-4 p-5">
        {TRANSLATABLE_FIELDS.map((f) => {
          const itValue = values[f.de] ?? "";
          const filled = itValue.trim() !== "";
          return (
            <div key={f.de} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`it-${f.de}`} className="inline-flex items-center gap-1.5">
                  {filled ? (
                    <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{f.label} (IT)</span>
                  {f.hint && (
                    <span className="text-xs font-normal text-muted-foreground">
                      · {f.hint}
                    </span>
                  )}
                </Label>
                <AiUebersetzenButton
                  fieldKeys={[f.de]}
                  getContext={getContext}
                  onAccept={setOne}
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerLabel="✨ übersetzen"
                />
              </div>

              <DeOriginalPreview deKey={f.de} getDeValues={getDeValues} />

              {f.type === "input" && (
                <>
                  <Input
                    id={`it-${f.de}`}
                    value={itValue}
                    maxLength={f.maxLen}
                    onChange={(e) => setOne(f.de, e.target.value)}
                  />
                  <input type="hidden" name={f.it} value={itValue} />
                </>
              )}

              {f.type === "textarea" && (
                <>
                  <Textarea
                    id={`it-${f.de}`}
                    value={itValue}
                    maxLength={f.maxLen}
                    rows={3}
                    onChange={(e) => setOne(f.de, e.target.value)}
                    className="text-sm"
                  />
                  <input type="hidden" name={f.it} value={itValue} />
                </>
              )}

              {f.type === "richtext" && (
                <RichTextItField
                  fieldKey={f.de}
                  itName={f.it}
                  value={itValue}
                  onChange={(v) => setOne(f.de, v)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeOriginalPreview({
  deKey,
  getDeValues,
}: {
  deKey: string;
  getDeValues: () => Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const de = (getDeValues()[deKey] ?? "").trim();
  if (!de) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        Original (DE): — leer —
      </p>
    );
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
          />
          Original (DE) {open ? "verbergen" : "anzeigen"}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-border/40 bg-muted/30 p-2 text-xs text-muted-foreground">
          {de}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Wrapper, der den RichTextEditor wie ein controlled-Input bedient.
 *  Bei „Übersetzung übernehmen" muss der Editor neuen Inhalt anzeigen — wir
 *  lösen das über einen `key`, der bei externen Updates wechselt. Wir
 *  rendern auch einen eigenen `<input type="hidden">`, damit der vom Form
 *  abgeschickte Wert immer mit dem Parent-State übereinstimmt. */
function RichTextItField({
  fieldKey,
  itName,
  value,
  onChange,
}: {
  fieldKey: string;
  itName: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Editor neu mounten, wenn der Wert von außen ersetzt wird (z.B. nach
  // KI-Übersetzung). Tipper-Updates aus dem Editor selbst dürfen kein
  // Re-Mount auslösen (würde Cursor-Focus zerstören).
  //
  // Wir tracken den letzten von außen gesehenen Wert in einer Ref. Beim
  // Mount-Effekt wird die Ref auf den initialen Wert gesetzt (idempotent).
  // Bei Prop-Updates vergleichen wir gegen die Ref: stimmt sie mit dem
  // neuen `value` überein → kein Re-Mount; differs → Counter bumpen.
  const lastExternalRef = useRef(value);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (value === lastExternalRef.current) return;
    lastExternalRef.current = value;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mount-Counter-Bump nur bei externer Wert-Änderung; idempotent + maximal 1 Re-Render pro Override
    setMountKey((k) => k + 1);
  }, [value]);

  return (
    <>
      <RichTextEditor
        key={`${fieldKey}-${mountKey}`}
        defaultValue={value}
        onChange={(html) => {
          // Tipper-Update aus dem Editor — Ref mitziehen, damit der nächste
          // externe Update-Compare wieder korrekt triggert.
          lastExternalRef.current = html;
          onChange(html);
        }}
        minHeight={140}
      />
      <input type="hidden" name={itName} value={value} />
    </>
  );
}
