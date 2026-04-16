"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { BottomTabs } from "@/components/bottom-tabs"
import { SpecialtiesTab } from "@/components/specialties-tab"
import { ClassesTab } from "@/components/classes-tab"
import { BibleStudyTab } from "@/components/bible-study-tab"
import { MasteriesTab } from "@/components/masteries-tab"
import { AuthCard } from "@/components/auth-card"
import { supabase } from "@/lib/supabase-client"
import { fetchUserProgress, upsertUserProgress } from "@/lib/user-progress-repository"
import {
  CLASSES,
  getClassRequirementLabels,
  normalizeClassRequirementChecks,
  type TabId,
} from "@/lib/conquistadores-data"
import { getSectionBackgroundImage } from "@/lib/section-backgrounds"

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("specialties")
  const [unlockedSpecialties, setUnlockedSpecialties] = useState<Record<string, boolean>>({})
  const [classRequirements, setClassRequirements] = useState<Record<string, boolean[]>>({})
  const [completedBibleChallenges, setCompletedBibleChallenges] = useState<Record<string, boolean>>({})
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const saveTimer = useRef<number | null>(null)

  const defaultRequirements = useMemo(
    () =>
      Object.fromEntries(
        CLASSES.map((item) => {
          const n = getClassRequirementLabels(item.id).length
          return [item.id, Array(n > 0 ? n : 1).fill(false)]
        })
      ) as Record<string, boolean[]>,
    []
  )

  useEffect(() => {
    // Inicialización: primero carga localStorage (offline), luego si hay sesión se reemplaza por BD.
    const savedSpecialties = localStorage.getItem("conquistadores-specialties")
    const savedClasses = localStorage.getItem("conquistadores-classes")
    const savedBible = localStorage.getItem("conquistadores-bible")

    if (savedSpecialties) setUnlockedSpecialties(JSON.parse(savedSpecialties))

    if (savedClasses) {
      try {
        const parsed = JSON.parse(savedClasses) as Record<string, boolean[]>
        setClassRequirements(
          Object.fromEntries(
            CLASSES.map((c) => [c.id, normalizeClassRequirementChecks(c.id, parsed[c.id])])
          ) as Record<string, boolean[]>
        )
      } catch {
        setClassRequirements(defaultRequirements)
      }
    } else setClassRequirements(defaultRequirements)

    if (savedBible) setCompletedBibleChallenges(JSON.parse(savedBible))
  }, [defaultRequirements])

  useEffect(() => {
    localStorage.setItem("conquistadores-specialties", JSON.stringify(unlockedSpecialties))
  }, [unlockedSpecialties])

  useEffect(() => {
    if (Object.keys(classRequirements).length > 0) {
      localStorage.setItem("conquistadores-classes", JSON.stringify(classRequirements))
    }
  }, [classRequirements])

  useEffect(() => {
    localStorage.setItem("conquistadores-bible", JSON.stringify(completedBibleChallenges))
  }, [completedBibleChallenges])

  useEffect(() => {
    let mounted = true
    async function initAuth() {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!mounted) return
      setAuthUserId(session?.user?.id ?? null)
      setAuthEmail(session?.user?.email ?? null)
      setAuthLoading(false)
    }

    initAuth()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null)
      setAuthEmail(session?.user?.email ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Cuando hay usuario, carga progreso desde BD (si existe) y lo aplica.
    if (!authUserId) return
    let cancelled = false
    ;(async () => {
      try {
        const progress = await fetchUserProgress(authUserId)
        if (!progress || cancelled) return
        setUnlockedSpecialties(progress.unlockedSpecialties)
        setClassRequirements(
          Object.fromEntries(
            CLASSES.map((c) => [
              c.id,
              normalizeClassRequirementChecks(c.id, progress.classRequirements[c.id]),
            ])
          ) as Record<string, boolean[]>
        )
        setCompletedBibleChallenges(progress.completedBibleChallenges)
      } catch (e) {
        // Si falla, nos quedamos con localStorage.
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId, defaultRequirements])

  useEffect(() => {
    // Auto-guardado en BD (debounce) cuando hay sesión.
    if (!authUserId) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      upsertUserProgress(authUserId, {
        unlockedSpecialties,
        classRequirements,
        completedBibleChallenges,
        contentUnlocks: {},
      }).catch((e) => console.error(e))
    }, 600)
  }, [authUserId, unlockedSpecialties, classRequirements, completedBibleChallenges])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" }) // [MODIFICADO]
  }, [activeTab]) // [MODIFICADO]

  function handleToggleSpecialty(specialtyId: string) {
    setUnlockedSpecialties((prev) => ({
      ...prev,
      [specialtyId]: !prev[specialtyId],
    }))
  }

  function handleToggleRequirement(classId: string, requirementIndex: number) {
    setClassRequirements((prev) => {
      const current = normalizeClassRequirementChecks(classId, prev[classId])
      const updated = [...current]
      if (requirementIndex >= 0 && requirementIndex < updated.length) {
        updated[requirementIndex] = !updated[requirementIndex]
      }
      return { ...prev, [classId]: updated }
    })
  }

  function handleToggleBibleChallenge(challengeId: string) {
    setCompletedBibleChallenges((prev) => ({
      ...prev,
      [challengeId]: !prev[challengeId],
    }))
  }

  const sectionBg = getSectionBackgroundImage(activeTab)

  /** Imagen completa: ancho = pantalla, alto proporcional; se repite en Y si hace falta (patrón vertical). Sin `cover` para no recortar. */
  const sectionBackdropStyle: CSSProperties = {
    backgroundColor: "#F2E8CF",
    backgroundImage: `url('${sectionBg}')`,
    backgroundSize: "100% auto",
    backgroundRepeat: "repeat-y",
    backgroundPosition: "center top",
    backgroundAttachment: "scroll",
  }

  // Pantalla inicial: solo login/registro.
  if (!authEmail) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 min-h-dvh"
          style={sectionBackdropStyle}
        />
        <div className="relative z-10 flex min-h-dvh flex-col bg-transparent">
          <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10">
            <div className="w-full">
              <AuthCard />
              <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
                {authLoading ? "Comprobando sesión..." : "Inicia sesión para sincronizar tu progreso."}
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 min-h-dvh"
        style={sectionBackdropStyle}
      />
      <div className="relative z-10 flex min-h-dvh flex-col bg-transparent">
        <div className="mx-auto w-full max-w-lg px-4 pt-4">
          <div className="flex items-center justify-between rounded-xl border bg-card/80 px-4 py-3 backdrop-blur">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-foreground">Progreso</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">
                {authEmail ? `Guardando en la nube: ${authEmail}` : "Sin sesión"}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-extrabold text-primary underline-offset-4 hover:underline"
              onClick={() => supabase.auth.signOut()}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-6">
          {activeTab === "specialties" && (
            <SpecialtiesTab
              unlockedSpecialties={unlockedSpecialties}
              onToggleSpecialty={handleToggleSpecialty}
            />
          )}
          {activeTab === "classes" && (
            <ClassesTab
              classRequirements={classRequirements}
              onToggleRequirement={handleToggleRequirement}
            />
          )}
          {activeTab === "bible" && (
            <BibleStudyTab
              completedBibleChallenges={completedBibleChallenges}
              onToggleBibleChallenge={handleToggleBibleChallenge}
            />
          )}
          {activeTab === "masteries" && <MasteriesTab unlockedSpecialties={unlockedSpecialties} />}
        </main>
        <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  )
}
