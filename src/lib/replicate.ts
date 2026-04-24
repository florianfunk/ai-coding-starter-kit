import "server-only";
import { createClient } from "@/lib/supabase/server";

const API_BASE = "https://api.replicate.com/v1";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 180_000;
const MAX_RETRY = 3;

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: string | null;
  urls: { get: string };
};

async function getToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_einstellungen")
    .select("replicate_token")
    .eq("id", 1)
    .single();
  return data?.replicate_token ?? null;
}

async function replicateFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status !== 429) return res;
    const retryAfterSec = Number(res.headers.get("retry-after") ?? "2");
    if (attempt === MAX_RETRY - 1) return res;
    await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
  }
  throw new Error("Replicate: maximale Wiederholungen erreicht");
}

async function getLatestVersion(token: string, owner: string, name: string): Promise<string> {
  const res = await replicateFetch(token, `/models/${owner}/${name}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate-Modell ${owner}/${name} nicht erreichbar: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { latest_version?: { id: string } };
  if (!data.latest_version?.id) throw new Error(`Kein latest_version für ${owner}/${name}`);
  return data.latest_version.id;
}

async function createPrediction(
  token: string,
  versionId: string,
  input: Record<string, unknown>,
): Promise<Prediction> {
  const res = await replicateFetch(token, "/predictions", {
    method: "POST",
    headers: { "Prefer": "wait=60" },
    body: JSON.stringify({ version: versionId, input }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate create failed: ${res.status} ${text}`);
  }
  return (await res.json()) as Prediction;
}

async function waitForPrediction(token: string, prediction: Prediction): Promise<Prediction> {
  if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") {
    return prediction;
  }
  const deadline = Date.now() + MAX_POLL_MS;
  let current = prediction;
  while (Date.now() < deadline) {
    if (current.status === "succeeded") return current;
    if (current.status === "failed" || current.status === "canceled") return current;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(current.urls.get, {
      headers: { "Authorization": `Token ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Replicate poll failed: ${res.status} ${text}`);
    }
    current = (await res.json()) as Prediction;
  }
  throw new Error("Replicate: Timeout beim Warten auf Ergebnis (180s)");
}

function extractOutputUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  throw new Error("Replicate: Unerwartetes Output-Format");
}

async function runModel(
  ownerName: string,
  input: Record<string, unknown>,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("Kein Replicate-Token in den Einstellungen hinterlegt.");

  const [owner, name] = ownerName.split("/");
  if (!owner || !name) throw new Error(`Ungültiger Modell-Slug: ${ownerName}`);

  const versionId = await getLatestVersion(token, owner, name);
  const created = await createPrediction(token, versionId, input);
  const final = await waitForPrediction(token, created);

  if (final.status !== "succeeded") {
    throw new Error(final.error ?? `Replicate-Prediction ${final.status}`);
  }
  return extractOutputUrl(final.output);
}

export async function upscaleImage(sourceUrl: string): Promise<string> {
  return runModel("philz1337x/clarity-upscaler", {
    image: sourceUrl,
    scale_factor: 2,
    creativity: 0.25,
    resemblance: 1.5,
    dynamic: 6,
    num_inference_steps: 18,
    scheduler: "DPM++ 3M SDE Karras",
  });
}

export async function removeBackground(sourceUrl: string): Promise<string> {
  return runModel("bria/remove-background", {
    image: sourceUrl,
  });
}

export async function downloadReplicateOutput(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download des Ergebnisses fehlgeschlagen: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}
