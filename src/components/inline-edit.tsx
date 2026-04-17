"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface InlineEditProps {
  value: string | number;
  onSave: (newValue: string) => Promise<void>;
  type?: "text" | "number";
  className?: string;
}

export function InlineEdit({
  value,
  onSave,
  type = "text",
  className = "",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (!editing) {
      setCurrent(String(value));
    }
  }, [value, editing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    if (saving) return;
    setEditing(true);
    setCurrent(String(value));
  }, [saving, value]);

  const cancel = useCallback(() => {
    setEditing(false);
    setCurrent(String(value));
  }, [value]);

  const save = useCallback(async () => {
    const trimmed = current.trim();
    // No change — just close
    if (trimmed === String(value)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      // Rollback on error
      setCurrent(String(value));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [current, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={`h-7 px-1.5 py-0 text-sm min-w-0 ${type === "number" ? "w-20 text-right" : "w-full"} ${className}`}
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
      </div>
    );
  }

  return (
    <span
      onDoubleClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEditing();
        }
      }}
      tabIndex={0}
      role="button"
      className={`cursor-pointer rounded px-1 -mx-1 hover:bg-muted hover:shadow-sm border border-transparent hover:border-primary/20 transition-all duration-150 select-none ${className}`}
      title="Doppelklick zum Bearbeiten"
    >
      {String(value) || "\u2014"}
    </span>
  );
}
