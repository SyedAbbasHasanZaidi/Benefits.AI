import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client — use in Client Components.
 * Reads credentials from NEXT_PUBLIC_* env vars (safe to expose to the browser).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
