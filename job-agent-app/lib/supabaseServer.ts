import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side client that reads the signed-in user's session from cookies.
// Use this in API routes and server components — every query it makes is
// automatically scoped to whoever is actually logged in.
export function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component without write access — safe to ignore,
            // middleware handles the actual session refresh.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // See note above.
          }
        }
      }
    }
  );
}

// Admin client using the service role key — bypasses RLS entirely. Only use
// this for trusted, server-only operations like the shared job scanner,
// which writes to the shared `jobs` table on behalf of everyone, not a
// single user.
import { createClient } from '@supabase/supabase-js';
export function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}
