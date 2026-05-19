"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/*
 * Login im „Editorial Ledger / Cobalt"-Stil:
 *  - Zentrierte Karte 380 px auf cobalt-getöntem Off-White
 *  - Serif-Italic Marke + Eyebrow
 *  - Primärer Cobalt-Button
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError("Login fehlgeschlagen. E-Mail oder Passwort prüfen.");
        return;
      }
      if (data.session) {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Unerwarteter Fehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="grid min-h-screen place-items-center p-10"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-[380px] max-w-full rounded-[10px] border p-8"
        style={{
          background: "var(--surface)",
          borderColor: "var(--line)",
          boxShadow: "var(--shadow-2)",
        }}
      >
        <div className="mb-7 flex items-center gap-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-md font-display text-[22px] italic font-semibold leading-none tracking-[-0.02em]"
            style={{
              background: "var(--accent-color)",
              color: "var(--accent-fg)",
              boxShadow: "0 2px 10px var(--accent-ring)",
            }}
          >
            S
          </div>
          <div>
            <div
              className="text-[9.5px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-subtle)" }}
            >
              Anmeldung
            </div>
            <div className="font-display text-[20px] leading-tight tracking-[-0.01em]">
              Steueragent
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[11.5px] font-medium uppercase tracking-[0.04em]">
              E-Mail
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[11.5px] font-medium uppercase tracking-[0.04em]">
              Passwort
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Anmelden…" : "Anmelden"}
          </Button>
          <p
            className="pt-1 text-center text-[11.5px]"
            style={{ color: "var(--text-subtle)" }}
          >
            Zugang nur für den Firmeninhaber.
          </p>
        </form>
      </div>
    </main>
  );
}
