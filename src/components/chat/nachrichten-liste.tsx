"use client";

// PROJ-17 — Nachrichten-Liste.
//
// Rendert User- und Assistant-Bubbles + optionalen Aktions-Vorschlag.
// Markdown-Rendering via react-markdown + remark-gfm fuer Tabellen/Listen.
// Tool-Badges unter Assistant-Bubbles, klickbar -> Popover mit Details.

import { useState } from "react";
import { Check, ChevronDown, Copy, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/chat/datum";
import type { ChatAktion, ChatNachricht, ToolBadge } from "@/lib/chat/typen";
import { AktionsKarte } from "./aktions-karte";

interface Props {
  nachrichten: ChatNachricht[];
  konversationId: string;
  streamendeId: string | null;
  onAktionStatusChange: (
    nachrichtId: string,
    nextAktion: ChatAktion,
  ) => void;
  onNeuerVorschlag?: (nachrichtId: string, alteAktionId: string) => void;
}

export function NachrichtenListe({
  nachrichten,
  konversationId,
  streamendeId,
  onAktionStatusChange,
  onNeuerVorschlag,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-6 sm:px-4">
      {nachrichten.map((n) => (
        <div key={n.id} className="space-y-3">
          {n.rolle === "user" ? (
            <UserBubble nachricht={n} />
          ) : (
            <AssistantBubble
              nachricht={n}
              streamt={n.id === streamendeId}
            />
          )}
          {n.aktionen.map((a) => (
            <AktionsKarte
              key={a.id}
              aktion={a}
              konversationId={konversationId}
              onStatusChange={(next) => onAktionStatusChange(n.id, next)}
              onNeuerVorschlag={
                onNeuerVorschlag
                  ? () => onNeuerVorschlag(n.id, a.id)
                  : undefined
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function UserBubble({ nachricht }: { nachricht: ChatNachricht }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground shadow-sm">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {nachricht.inhalt}
        </p>
      </div>
    </div>
  );
}

function AssistantBubble({
  nachricht,
  streamt,
}: {
  nachricht: ChatNachricht;
  streamt: boolean;
}) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(nachricht.inhalt);
      setKopiert(true);
      toast.success("In die Zwischenablage kopiert.");
      setTimeout(() => setKopiert(false), 1500);
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-2">
        <div
          className={cn(
            "group relative rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-2.5 shadow-sm",
          )}
        >
          <MarkdownInhalt
            inhalt={nachricht.inhalt}
            streamt={streamt}
          />
          {!streamt && nachricht.inhalt.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={kopieren}
              aria-label="Antwort in die Zwischenablage kopieren"
              className="absolute -bottom-3 -right-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              {kopiert ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </div>

        {nachricht.tools.length > 0 ? (
          <ToolBadgeReihe tools={nachricht.tools} />
        ) : null}

        <p className="px-1 text-[11px] text-muted-foreground">
          {formatTimestamp(nachricht.erstellt_am)}
        </p>
      </div>
    </div>
  );
}

function MarkdownInhalt({
  inhalt,
  streamt,
}: {
  inhalt: string;
  streamt: boolean;
}) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tabellen mit Overflow-Container, damit lange Spalten nicht
          // die Bubble sprengen.
          table: ({ children, ...props }) => (
            <div className="my-2 overflow-x-auto rounded-md border">
              <table
                {...props}
                className="w-full text-xs"
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="bg-muted/60 px-2 py-1.5 text-left font-medium"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td {...props} className="border-t px-2 py-1.5 align-top">
              {children}
            </td>
          ),
          code: ({
            inline,
            children,
            ...props
          }: React.HTMLAttributes<HTMLElement> & {
            inline?: boolean;
            children?: React.ReactNode;
          }) =>
            inline ? (
              <code
                {...props}
                className="rounded bg-muted px-1 py-0.5 text-[0.85em]"
              >
                {children}
              </code>
            ) : (
              <code
                {...props}
                className="block overflow-x-auto rounded-md bg-muted p-2 text-[0.85em]"
              >
                {children}
              </code>
            ),
          a: ({ children, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {inhalt}
      </ReactMarkdown>
      {streamt ? (
        <span
          aria-label="Antwort wird generiert"
          className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-foreground/70"
        />
      ) : null}
    </div>
  );
}

function ToolBadgeReihe({ tools }: { tools: ToolBadge[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Genutzt:
      </span>
      {tools.map((t, i) => (
        <ToolBadgePill key={`${t.name}-${i}`} tool={t} />
      ))}
    </div>
  );
}

function ToolBadgePill({ tool }: { tool: ToolBadge }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          aria-label={`Tool-Details ${tool.name}`}
        >
          <Wrench className="h-3 w-3" />
          <span className="font-mono">{tool.name}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-3">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{tool.name}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              Tool-Call
            </Badge>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Parameter
            </p>
            <pre className="max-h-[160px] overflow-auto rounded bg-muted/60 p-2 text-[11px] leading-relaxed">
              {JSON.stringify(tool.parameter, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ergebnis
            </p>
            <p className="rounded bg-muted/60 p-2 text-[11px] leading-relaxed">
              {tool.ergebnis_zusammenfassung}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
