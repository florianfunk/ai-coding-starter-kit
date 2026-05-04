"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Languages, Save, Sparkles } from "lucide-react";
import {
  updateAiEinstellungen,
  updateTeaserEinstellungen,
  updateUebersetzungEinstellungen,
  type AiFormState,
} from "./ai-actions";
import {
  AI_MODELS,
  DEFAULT_MODEL,
  type AiProvider,
} from "@/lib/ai/models";

const initial: AiFormState = { error: null };

type AiSettings = {
  replicate_token: string | null;
  openai_api_key: string | null;
  anthropic_api_key: string | null;
  ai_provider: AiProvider | null;
  ai_model: string | null;
  auto_translate_it: boolean | null;
};

export function AiTab({ settings }: { settings: AiSettings | null }) {
  return (
    <div className="space-y-6">
      <TeaserCard settings={settings} />
      <UebersetzungCard settings={settings} />
      <ReplicateCard settings={settings} />
    </div>
  );
}

function TeaserCard({ settings }: { settings: AiSettings | null }) {
  const [state, formAction, pending] = useActionState(
    async (prev: AiFormState, fd: FormData) => {
      const r = await updateTeaserEinstellungen(prev, fd);
      if (!r.error) toast.success("Gespeichert");
      return r;
    },
    initial,
  );

  const initialProvider: AiProvider = (settings?.ai_provider as AiProvider) ?? "openai";
  const initialModel = settings?.ai_model ?? DEFAULT_MODEL[initialProvider];

  const [provider, setProvider] = useState<AiProvider>(initialProvider);
  const [model, setModel] = useState<string>(initialModel);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const hasOpenAi = !!settings?.openai_api_key;
  const hasAnthropic = !!settings?.anthropic_api_key;

  function handleProviderChange(p: AiProvider) {
    setProvider(p);
    setModel(DEFAULT_MODEL[p]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> KI-Marketing-Teaser
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Wird beim Bearbeiten von Bereichen, Kategorien und Produkten zur Generierung
            von Beschreibungs-Teasern verwendet. Der API-Key bleibt in der Datenbank und
            wird nicht im Browser ausgegeben.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ai_provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => handleProviderChange(v as AiProvider)}
              >
                <SelectTrigger id="ai_provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="ai_provider" value={provider} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai_model">Modell</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="ai_model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS[provider].map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="ai_model" value={model} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openai_api_key">OpenAI API-Key</Label>
            <div className="flex gap-2">
              <Input
                id="openai_api_key"
                name="openai_api_key"
                type={showOpenAi ? "text" : "password"}
                defaultValue=""
                placeholder={hasOpenAi ? "•••••••••••••••• (gespeichert)" : "sk-..."}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowOpenAi((s) => !s)}
                aria-label={showOpenAi ? "Key verstecken" : "Key anzeigen"}
              >
                {showOpenAi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Erstellen unter{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.openai.com/api-keys
              </a>
              . Leer lassen ändert den gespeicherten Key nicht.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anthropic_api_key">Anthropic API-Key</Label>
            <div className="flex gap-2">
              <Input
                id="anthropic_api_key"
                name="anthropic_api_key"
                type={showAnthropic ? "text" : "password"}
                defaultValue=""
                placeholder={hasAnthropic ? "•••••••••••••••• (gespeichert)" : "sk-ant-..."}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowAnthropic((s) => !s)}
                aria-label={showAnthropic ? "Key verstecken" : "Key anzeigen"}
              >
                {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Erstellen unter{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                console.anthropic.com/settings/keys
              </a>
              . Leer lassen ändert den gespeicherten Key nicht.
            </p>
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="gap-2">
            <Save className="h-4 w-4" />
            {pending ? "Speichere…" : "Speichern"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UebersetzungCard({ settings }: { settings: AiSettings | null }) {
  const [autoTranslate, setAutoTranslate] = useState<boolean>(
    settings?.auto_translate_it ?? true,
  );
  const [state, formAction, pending] = useActionState(
    async (prev: AiFormState, fd: FormData) => {
      const r = await updateUebersetzungEinstellungen(prev, fd);
      if (!r.error) toast.success("Gespeichert");
      return r;
    },
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-4 w-4" /> Italienische Übersetzung
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5 max-w-xl">
          <p className="text-sm text-muted-foreground">
            PROJ-46 — automatische italienische Übersetzung der Datenblatt-Felder.
            Provider, Modell und API-Key kommen aus der KI-Marketing-Teaser-Sektion oben.
          </p>

          <div className="flex items-start gap-3">
            <Switch
              id="auto_translate_it"
              checked={autoTranslate}
              onCheckedChange={setAutoTranslate}
            />
            <div className="flex-1">
              <Label
                htmlFor="auto_translate_it"
                className="cursor-pointer text-sm font-medium"
              >
                Auto-Übersetzung beim Speichern
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Wenn aktiv, wird die italienische Version automatisch neu generiert,
                sobald ein deutsches Feld geändert wird. Bestehende italienische Texte
                werden dabei <strong>überschrieben</strong>. Wer manuelle Korrekturen
                schützen möchte, schaltet diese Option aus und nutzt den
                „🇮🇹 Übersetzen“-Button im Produkt-Formular.
              </p>
            </div>
          </div>
          <input
            type="hidden"
            name="auto_translate_it"
            value={autoTranslate ? "1" : "0"}
          />

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="gap-2">
            <Save className="h-4 w-4" />
            {pending ? "Speichere…" : "Speichern"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ReplicateCard({ settings }: { settings: AiSettings | null }) {
  const [state, formAction, pending] = useActionState(
    async (prev: AiFormState, fd: FormData) => {
      const r = await updateAiEinstellungen(prev, fd);
      if (!r.error) toast.success("Gespeichert");
      return r;
    },
    initial,
  );
  const [show, setShow] = useState(false);
  const hasToken = !!settings?.replicate_token;

  return (
    <Card>
      <CardHeader>
        <CardTitle>KI / Bildbearbeitung (Replicate)</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="replicate_token">Replicate API-Token</Label>
            <div className="flex gap-2">
              <Input
                id="replicate_token"
                name="replicate_token"
                type={show ? "text" : "password"}
                defaultValue={settings?.replicate_token ?? ""}
                placeholder={hasToken ? "••••••••••••••••" : "r8_..."}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Token verstecken" : "Token anzeigen"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token erstellen unter{" "}
              <a
                href="https://replicate.com/account/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                replicate.com/account/api-tokens
              </a>
              . Guthaben von mindestens $5 aufladen, sonst gilt ein Limit von 6 Anfragen pro Minute.
              Der Token wird für Bild-Upscaling (~$0.012/Bild) und Hintergrund-Entfernung (~$0.04/Bild) verwendet.
            </p>
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="gap-2">
            <Save className="h-4 w-4" />
            {pending ? "Speichere…" : "Speichern"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
