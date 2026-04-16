import { supabase } from "@/lib/supabase-client"

export type UserProgress = {
  unlockedSpecialties: Record<string, boolean>
  classRequirements: Record<string, boolean[]>
  completedBibleChallenges: Record<string, boolean>
  contentUnlocks: Record<string, unknown>
}

type UserProgressRow = {
  unlocked_specialties: unknown
  class_requirements: unknown
  bible_reading_completed: unknown
  content_unlocks: unknown
}

function asRecordBoolean(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== "object") return {}
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, Boolean(val)])
  )
}

function asRecordBooleanArray(v: unknown): Record<string, boolean[]> {
  if (!v || typeof v !== "object") return {}
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, val]) => [
      k,
      Array.isArray(val) ? val.map(Boolean) : [],
    ])
  )
}

function asRecordUnknown(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {}
  return v as Record<string, unknown>
}

export async function fetchUserProgress(userId: string): Promise<UserProgress | null> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("unlocked_specialties,class_requirements,bible_reading_completed,content_unlocks")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as unknown as UserProgressRow
  return {
    unlockedSpecialties: asRecordBoolean(row.unlocked_specialties),
    classRequirements: asRecordBooleanArray(row.class_requirements),
    completedBibleChallenges: asRecordBoolean(row.bible_reading_completed),
    contentUnlocks: asRecordUnknown(row.content_unlocks),
  }
}

export async function upsertUserProgress(userId: string, progress: UserProgress) {
  const { error } = await supabase.from("user_progress").upsert(
    {
      user_id: userId,
      unlocked_specialties: progress.unlockedSpecialties,
      class_requirements: progress.classRequirements,
      bible_reading_completed: progress.completedBibleChallenges,
      content_unlocks: progress.contentUnlocks ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (error) throw new Error(error.message)
}

