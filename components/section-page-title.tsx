import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SectionPageTitleProps = {
  children: ReactNode
  className?: string
}

/** Título principal de cada pestaña: grande y llamativo */
export function SectionPageTitle({ children, className }: SectionPageTitleProps) {
  return (
    <h1
      className={cn(
        "border-b-4 border-[rgb(43_76_49)] pb-2 text-3xl font-black tracking-tight text-foreground",
        "md:text-4xl",
        className
      )}
      style={{ WebkitTextStroke: "0.5px rgba(255,255,255,0.95)" }}
    >
      {children}
    </h1>
  )
}
