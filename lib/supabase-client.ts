import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Durante prerender/build (SSR) puede evaluarse el módulo sin env vars.
  // Evitamos romper el build; el cliente real solo se usa en el navegador.
  if (!supabaseUrl || !supabaseKey) {
    if (typeof window === "undefined") return null
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }

  _client = createClient(supabaseUrl, supabaseKey)
  return _client
}

// Proxy para mantener la API `supabase.*` sin crear el cliente en SSR.
export const supabase: SupabaseClient = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient()
      if (!client) {
        throw new Error("Supabase client no disponible en SSR/build.")
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (client as any)[prop]
    },
  }
) as SupabaseClient