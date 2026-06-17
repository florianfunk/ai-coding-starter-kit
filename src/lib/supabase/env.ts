// True once a real Supabase project is configured (env vars present).
// Until then the app runs in "preview mode": the full UI renders with mock data
// so it can be reviewed before /backend wires the database + RLS.
export const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
