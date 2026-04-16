/**
 * Genera supabase/full_schema_conquistadores.sql desde lib/conquistadores-data.ts
 * Ejecutar: node scripts/build-conquistadores-sql.mjs
 */
import fs from "fs"
import path from "path"

const root = path.resolve(import.meta.dirname, "..")
const dataPath = path.join(root, "lib/conquistadores-data.ts")
const outPath = path.join(root, "supabase/full_schema_conquistadores.sql")

function sqlStr(s) {
  if (s === null || s === undefined) return "NULL"
  return "'" + String(s).replace(/'/g, "''") + "'"
}

function toId(input) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function makeSpecialties(areaId, entries) {
  return entries.map((entry) => {
    if (typeof entry === "string") {
      return { id: toId(entry), name: entry, areaId }
    }
    const { name, image } = entry
    return {
      id: toId(name),
      name,
      areaId,
      ...(image ? { image } : {}),
    }
  })
}

function extractSpecialtyAreas() {
  const fileContent = fs.readFileSync(dataPath, "utf8")
  const marker = "export const SPECIALTY_AREAS: SpecialtyArea[] = "
  const start = fileContent.indexOf(marker)
  if (start < 0) throw new Error("SPECIALTY_AREAS not found in conquistadores-data.ts")
  const bracketStart = fileContent.indexOf("[", start + marker.length)
  let depth = 0
  for (let i = bracketStart; i < fileContent.length; i++) {
    const c = fileContent[i]
    if (c === "[") depth++
    else if (c === "]") {
      depth--
      if (depth === 0) {
        const arrLiteral = fileContent.slice(bracketStart, i + 1)
        return Function("makeSpecialties", `return ${arrLiteral}`)(makeSpecialties)
      }
    }
  }
  throw new Error("unbalanced array for SPECIALTY_AREAS")
}

function extractBibleReading() {
  const s = fs.readFileSync(dataPath, "utf8")
  const start = s.indexOf("const BIBLE_READING_BY_CLASS")
  const sub = s.slice(start)
  const open = sub.indexOf("{")
  let depth = 0
  let i = open
  for (; i < sub.length; i++) {
    if (sub[i] === "{") depth++
    else if (sub[i] === "}") {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  const objStr = sub.slice(open, i)
  return Function(`"use strict"; return (${objStr})`)()
}

const BIBLE_READING_BY_CLASS = extractBibleReading()
const CLASS_ORDER = ["amigo", "companero", "explorador", "pionero", "excursionista", "guia"]
const bibleRows = []
for (const classId of CLASS_ORDER) {
  const arr = BIBLE_READING_BY_CLASS[classId] ?? []
  arr.forEach((title, index) => {
    bibleRows.push({
      id: `${classId}-dia-${index + 1}`,
      class_id: classId,
      day: index + 1,
      title,
    })
  })
}

const bibleValues = bibleRows
  .map(
    (r) =>
      `(${sqlStr(r.id)}, ${sqlStr(r.class_id)}, ${r.day}, ${sqlStr(r.title)})`
  )
  .join(",\n  ")

const SPECIALTY_AREAS = extractSpecialtyAreas()
const areaSqlRows = SPECIALTY_AREAS.map((a, idx) => {
  const image = a.image != null ? sqlStr(a.image) : "NULL"
  const border = a.borderClass != null ? sqlStr(a.borderClass) : "NULL"
  const theme = a.themeColor != null ? sqlStr(a.themeColor) : "NULL"
  return `(${sqlStr(a.id)}, ${sqlStr(a.name)}, ${image}, ${border}, ${theme}, ${idx + 1})`
})
const areaValues = areaSqlRows.join(",\n  ")

const specSqlRows = []
SPECIALTY_AREAS.forEach((a) => {
  a.specialties.forEach((s, sidx) => {
    const img = s.image != null ? sqlStr(s.image) : "NULL"
    specSqlRows.push(
      `(${sqlStr(s.id)}, ${sqlStr(a.id)}, ${sqlStr(s.name)}, ${img}, ${sidx + 1})`
    )
  })
})
const specValues = specSqlRows.join(",\n  ")

const header = `-- =============================================================================
-- Conquistadores — especialidades, clases, lectura biblica (app actual)
-- Generado por: node scripts/build-conquistadores-sql.mjs
-- Pegar en Supabase → SQL Editor → Run
-- ADVERTENCIA: elimina tablas anteriores del mismo proyecto si existian.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS public.bible_reading_items CASCADE;
DROP TABLE IF EXISTS public.conquistador_classes CASCADE;
DROP TABLE IF EXISTS public.specialties CASCADE;
DROP TABLE IF EXISTS public.specialty_areas CASCADE;
DROP TABLE IF EXISTS public.user_progress CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS public.user_challenges CASCADE;
DROP TABLE IF EXISTS public.user_board_progress CASCADE;
DROP TABLE IF EXISTS public.user_cards CASCADE;
DROP TABLE IF EXISTS public.board_cards CASCADE;
DROP TABLE IF EXISTS public.challenges CASCADE;
DROP TABLE IF EXISTS public.boards CASCADE;
DROP TABLE IF EXISTS public.cards CASCADE;
DROP TABLE IF EXISTS public.intercambios_internet CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- Perfil
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Progreso (equivalente a localStorage en app/page.tsx)
-- unlocked_specialties: objeto { [specialtyId]: boolean } — pestaña Especialidades
-- class_requirements: objeto { [classId]: boolean[] } — requisitos por clase (orden = class-requirement-sections)
-- bible_reading_completed: objeto { [challengeId]: boolean } — ids como amigo-dia-1 (pestaña Biblia)
-- content_unlocks: desbloqueos futuros / actualizaciones (servidor o reglas)
CREATE TABLE public.user_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  unlocked_specialties jsonb NOT NULL DEFAULT '{}'::jsonb,
  class_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  bible_reading_completed jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_unlocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catalogo de clases (CLASSES en conquistadores-data.ts)
CREATE TABLE public.conquistador_classes (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order smallint NOT NULL
);

-- Catalogo de lectura biblica (BIBLE_CHALLENGES: id = classId + '-dia-' + dia)
CREATE TABLE public.bible_reading_items (
  id text PRIMARY KEY,
  class_id text NOT NULL REFERENCES public.conquistador_classes (id) ON DELETE CASCADE,
  day smallint NOT NULL,
  title text NOT NULL,
  UNIQUE (class_id, day)
);

-- Catalogo de especialidades (opcional: la app sigue usando TS como fuente; aqui para CMS / informes)
CREATE TABLE public.specialty_areas (
  id text PRIMARY KEY,
  name text NOT NULL,
  image text,
  border_class text,
  theme_color text,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE public.specialties (
  id text PRIMARY KEY,
  area_id text NOT NULL REFERENCES public.specialty_areas (id) ON DELETE CASCADE,
  name text NOT NULL,
  image text,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE INDEX bible_reading_items_class_idx ON public.bible_reading_items (class_id, day);
CREATE INDEX specialties_area_idx ON public.specialties (area_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conquistador_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_reading_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialty_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY user_progress_select_own ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_progress_insert_own ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_progress_update_own ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY classes_read_all ON public.conquistador_classes FOR SELECT USING (true);
CREATE POLICY bible_read_all ON public.bible_reading_items FOR SELECT USING (true);
CREATE POLICY specialty_areas_read_all ON public.specialty_areas FOR SELECT USING (true);
CREATE POLICY specialties_read_all ON public.specialties FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  INSERT INTO public.user_progress (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.conquistador_classes (id, name, sort_order) VALUES
  ('amigo', 'Amigo', 1),
  ('companero', 'Companero', 2),
  ('explorador', 'Explorador', 3),
  ('pionero', 'Pionero', 4),
  ('excursionista', 'Excursionista', 5),
  ('guia', 'Guia', 6);

INSERT INTO public.specialty_areas (id, name, image, border_class, theme_color, sort_order) VALUES
  ${areaValues};

INSERT INTO public.specialties (id, area_id, name, image, sort_order) VALUES
  ${specValues};

INSERT INTO public.bible_reading_items (id, class_id, day, title) VALUES
  ${bibleValues};

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.conquistador_classes, public.bible_reading_items, public.specialty_areas, public.specialties TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
`

fs.writeFileSync(outPath, header, "utf8")
console.log(
  "Wrote",
  outPath,
  "| areas:",
  SPECIALTY_AREAS.length,
  "| specialties:",
  specSqlRows.length,
  "| bible:",
  bibleRows.length
)
