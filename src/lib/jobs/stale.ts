export const JOB_STALE_NACH_MS = 15 * 60 * 1000;

export interface LaufenderJob {
  id: string;
  created_at: string;
}

export type LaufenderJobBewertung =
  | { status: "frei" }
  | { status: "aktiv"; job_id: string }
  | { status: "veraltet"; job_id: string };

/**
 * Vercel beendet synchrone Jobs spätestens am Function-Limit. Ein danach noch
 * als `laeuft` markierter Datensatz ist verwaist und darf keinen Folgelauf
 * dauerhaft blockieren.
 */
export function beurteileLaufendenJob(
  job: LaufenderJob | null,
  jetzt = new Date(),
  staleNachMs = JOB_STALE_NACH_MS,
): LaufenderJobBewertung {
  if (!job) return { status: "frei" };
  const gestartet = Date.parse(job.created_at);
  if (!Number.isFinite(gestartet) || jetzt.getTime() - gestartet >= staleNachMs) {
    return { status: "veraltet", job_id: job.id };
  }
  return { status: "aktiv", job_id: job.id };
}
