"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { Check } from "lucide-react"
import { PillProgressBar } from "@/components/pill-progress-bar"
import { SectionPageTitle } from "@/components/section-page-title"
import { SpecialtyCardButton } from "@/components/specialty-card-button"
import { SpecialtyImageWithFallback } from "@/components/specialty-image-with-fallback"
import { getAreaImageUrl, getSpecialtyImageUrl, SPECIALTY_AREAS } from "@/lib/conquistadores-data"

interface SpecialtiesTabProps {
  unlockedSpecialties: Record<string, boolean>
  onToggleSpecialty: (specialtyId: string) => void
}

function getAreaPercent(total: number, unlocked: number) {
  if (!total) return 0
  return Math.round((unlocked / total) * 100)
}

function getInitialText(text: string) {
  const t = text.trim()
  if (!t) return "?"
  return t.slice(0, 2).toUpperCase()
}

/** Relleno y borde (trazo) del nombre bajo cada especialidad cuando está desbloqueada */
const UNLOCKED_SPECIALTY_LABEL_BY_AREA: Record<string, { fill: string; stroke: string }> = {
  "actividades-misioneras": { fill: "#7546cb", stroke: "#ffffff" },
  naturaleza: { fill: "#ffffff", stroke: "#000000" },
  "arte-habilidades-manuales": { fill: "#238d87", stroke: "#ffffff" },
  recreacionales: { fill: "#28961b", stroke: "#ffffff" },
  "salud-ciencia": { fill: "#4a1b96", stroke: "#ffffff" },
  agricolas: { fill: "#bd6f36", stroke: "#ffffff" },
  profesionales: { fill: "#4a1b96", stroke: "#ffffff" },
  domesticas: { fill: "#ff6f07", stroke: "#ffffff" },
  adra: { fill: "#4a1b96", stroke: "#ffffff" },
}

function getSpecialtyNameLabelStyle(areaId: string, unlocked: boolean): CSSProperties {
  if (!unlocked) {
    return {
      color: "#ffffff",
      WebkitTextStroke: "1px #000000",
      textShadow: "none",
      paintOrder: "stroke fill",
    }
  }
  const spec = UNLOCKED_SPECIALTY_LABEL_BY_AREA[areaId] ?? {
    fill: "#7546cb",
    stroke: "#ffffff",
  }
  return {
    color: spec.fill,
    WebkitTextStroke: `2.5px ${spec.stroke}`,
    textShadow: "none",
    paintOrder: "stroke fill",
  }
}

function getHueFromText(text: string) { // [MODIFICADO]
  let hash = 0 // [MODIFICADO]
  for (let i = 0; i < text.length; i += 1) { // [MODIFICADO]
    hash = (hash * 31 + text.charCodeAt(i)) % 360 // [MODIFICADO]
  } // [MODIFICADO]
  return Math.abs(hash) % 360 // [MODIFICADO]
} // [MODIFICADO]

/** Imagen de celda con forma ovoide horizontal para cada especialidad */ // [MODIFICADO]
function tileImageDataUri({
  text,
  uniqueKey,
  areaId,
  unlocked,
}: {
  text: string
  uniqueKey: string
  areaId: string
  unlocked: boolean
}) {
  const safeText = getInitialText(text)
  const hue = getHueFromText(uniqueKey) // [MODIFICADO]
  const start = `hsl(${hue} 70% 56%)` // [MODIFICADO]
  const end = `hsl(${(hue + 32) % 360} 72% 46%)` // [MODIFICADO]
  const spec = UNLOCKED_SPECIALTY_LABEL_BY_AREA[areaId] ?? { fill: "#7546cb", stroke: "#ffffff" }
  const fill = unlocked ? spec.fill : "#ffffff"
  const stroke = unlocked ? spec.stroke : "#000000"
  const strokeWidth = unlocked ? "2.35" : "1.1"
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${start}"/>
        <stop offset="100%" stop-color="${end}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="56" ry="52" fill="url(#g)"/> <!-- [MODIFICADO] -->
    <circle cx="20" cy="22" r="14" fill="rgba(255,255,255,0.24)"/> <!-- [MODIFICADO] -->
    <circle cx="106" cy="102" r="18" fill="rgba(255,255,255,0.16)"/> <!-- [MODIFICADO] -->
    <text x="64" y="78" text-anchor="middle" font-size="40" font-family="Arial, Helvetica, sans-serif" fill="${fill}" font-weight="800" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill">${safeText}</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function SpecialtiesTab({ unlockedSpecialties, onToggleSpecialty }: SpecialtiesTabProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)

  const total = SPECIALTY_AREAS.flatMap((area) => area.specialties).length
  const unlockedTotal = Object.values(unlockedSpecialties).filter(Boolean).length
  const globalPercent = getAreaPercent(total, unlockedTotal)

  const selectedArea = useMemo(
    () => SPECIALTY_AREAS.find((a) => a.id === selectedAreaId) ?? null,
    [selectedAreaId]
  )

  const unlockedInSelectedArea = useMemo(() => {
    if (!selectedArea) return []
    return selectedArea.specialties.filter((s) => unlockedSpecialties[s.id])
  }, [selectedArea, unlockedSpecialties])

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        <SectionPageTitle>Especialidades</SectionPageTitle>
        <PillProgressBar
          label="Progreso global"
          percent={globalPercent}
          current={unlockedTotal}
          total={total}
          unitLabel="especialidades"
        />
      </header>

      {selectedArea === null ? (
        <>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SPECIALTY_AREAS.map((area) => {
              const unlockedInArea = area.specialties.filter((s) => unlockedSpecialties[s.id]).length
              const percent = getAreaPercent(area.specialties.length, unlockedInArea)
              return (
                <SpecialtyCardButton
                  key={area.id}
                  title={area.name}
                  color="bg-primary"
                  accentHex={area.themeColor}
                  imageSrc={getAreaImageUrl(area)}
                  imageAlt={area.name}
                  progress={percent}
                  current={unlockedInArea}
                  total={area.specialties.length}
                  onClick={() => setSelectedAreaId(area.id)}
                  aria-label={`Ver especialidades de ${area.name}`}
                />
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setSelectedAreaId(null)}
              >
                Volver
              </button>
              <p className="text-xs font-semibold text-muted-foreground">
                {areaSummary(selectedArea, unlockedSpecialties)}
              </p>
            </div>
            <SectionPageTitle className="text-2xl md:text-3xl">{selectedArea.name}</SectionPageTitle>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Desbloqueadas en esta área</p>
            {unlockedInSelectedArea.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no has desbloqueado ninguna aquí.</p>
            ) : (
              <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {unlockedInSelectedArea.map((s) => (
                  <li
                    key={s.id}
                    className="max-w-full rounded-md bg-pastel-green/50 px-2 py-1 text-[10px] font-medium text-foreground"
                  >
                    <span className="line-clamp-2">{s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {selectedArea.specialties.map((specialty) => {
              const unlocked = !!unlockedSpecialties[specialty.id]
              const isDomesticas = selectedArea.id === "domesticas" // [MODIFICADO]
              const ovalButtonClass = isDomesticas // [MODIFICADO]
                ? "mx-auto w-[88%] aspect-[1.2] rounded-[50%]" // [MODIFICADO]
                : "w-full aspect-[1.35] rounded-[42%]" // [MODIFICADO]
              const ovalRadiusClass = isDomesticas ? "rounded-[50%]" : "rounded-[42%]" // [MODIFICADO]
              const fallbackTile = tileImageDataUri({
                text: specialty.name,
                uniqueKey: specialty.id, // [MODIFICADO]
                areaId: selectedArea.id,
                unlocked,
              })
              const specialtyNameStyle = getSpecialtyNameLabelStyle(selectedArea.id, unlocked)
              return (
                <div key={specialty.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleSpecialty(specialty.id)}
                    className={`relative overflow-hidden border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ovalButtonClass} ${
                      unlocked ? "border-green-500 ring-2 ring-green-500/30" : "border-border"
                    }`} // [MODIFICADO]
                    aria-label={`${unlocked ? "Quitar" : "Desbloquear"} ${specialty.name}`}
                  >
                    <SpecialtyImageWithFallback
                      src={getSpecialtyImageUrl(specialty)}
                      alt={specialty.name}
                      className={`pointer-events-none absolute inset-0 mt-0 min-h-0 shadow-none ring-0 ${ovalRadiusClass}`} // [MODIFICADO]
                      imgClassName={`h-full min-h-0 w-full object-cover transition-[filter] duration-300 ${
                        unlocked ? "grayscale-0 saturate-100" : "grayscale saturate-0"
                      }`}
                      fallback={
                        <div className={`pointer-events-none absolute inset-0 ${ovalRadiusClass}`}> {/* [MODIFICADO] */}
                          <img
                            src={fallbackTile}
                            alt=""
                            className={`h-full w-full object-cover ${ovalRadiusClass} transition-[filter] duration-300 ${
                              unlocked ? "grayscale-0 saturate-100" : "grayscale saturate-0"
                            }`} // [MODIFICADO]
                            draggable={false}
                          />
                        </div>
                      }
                    />
                    {unlocked && (
                      <span className="absolute right-1 top-1 z-10 flex size-5 items-center justify-center rounded bg-green-600 text-white">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      </span>
                    )}
                  </button>
                  <span
                    className="line-clamp-2 text-center text-lg font-black leading-snug tracking-tight md:text-xl"
                    style={specialtyNameStyle}
                  >
                    {specialty.name}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function areaSummary(area: (typeof SPECIALTY_AREAS)[number], unlocked: Record<string, boolean>) {
  const unlockedInArea = area.specialties.filter((s) => unlocked[s.id]).length
  const percent = getAreaPercent(area.specialties.length, unlockedInArea)
  return `${unlockedInArea}/${area.specialties.length} (${percent}%)`
}
