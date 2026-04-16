"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"

type Mode = "login" | "register"

export function AuthCard() {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const emailTrim = useMemo(() => email.trim().toLowerCase(), [email])

  async function handleSubmit() {
    setError(null)
    setNotice(null)
    const pass = password.trim()
    if (!emailTrim || !pass) {
      setError("Ingresa tu email y contraseña.")
      return
    }
    if (mode === "register" && pass.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }

    setLoading(true)
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: pass,
        })
        if (authError) setError(authError.message)
      } else {
        const emailRedirectTo =
          typeof window !== "undefined" ? `${window.location.origin}/` : undefined
        const { data, error: authError } = await supabase.auth.signUp({
          email: emailTrim,
          password: pass,
          options: { emailRedirectTo },
        })
        if (authError) setError(authError.message)
        else {
          // Si en Supabase está activada la confirmación por email, no habrá sesión inmediata.
          if (!data.session) {
            setNotice("Cuenta creada. Revisa tu correo para confirmar e iniciar sesión.")
          } else {
            setNotice("Cuenta creada. Ya puedes continuar.")
          }
          setMode("login")
        }
      }
    } catch (e) {
      // En navegador, CORS suele aparecer como TypeError: Failed to fetch
      const msg =
        e instanceof TypeError
          ? "No se pudo conectar (posible CORS). Abre la app en http://localhost:3000 o agrega tu URL (ej. http://192.168.0.102:3000) a CORS/Redirect URLs en Supabase."
          : "No se pudo conectar. Intenta de nuevo."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para guardar tu progreso en la nube (vinculado a tu correo).
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              inputMode="email"
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">Contraseña</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm font-semibold text-foreground">{notice}</p> : null}

          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading
              ? "..."
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
            disabled={loading}
          >
            {mode === "login"
              ? "No tengo cuenta (registrarme)"
              : "Ya tengo cuenta (iniciar sesión)"}
          </Button>
        </div>
      </div>
    </section>
  )
}

