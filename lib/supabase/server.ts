import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createServerClient as makeServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createServerClient() {
  const cookieStore = cookies();
  return makeServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (err) {
            console.error(err);
          }
        },
      },
    }
  );
}

export function createClient() {
  const cookieStore = cookies();

  return createServerComponentClient(
    {
      cookies: () => cookieStore,
    },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  );
}
