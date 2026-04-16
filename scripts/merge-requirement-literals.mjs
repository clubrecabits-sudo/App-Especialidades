import fs from "fs"

const targetPath = "lib/class-requirement-sections.ts"
const input = fs.readFileSync(targetPath, "utf8")
const lines = input.split(/\r?\n/)

let inItems = false
let bracketDepth = 0
let lastStringLine = -1

function isItemsStart(line) {
  return line.includes("items: [")
}

function parseStringLiteral(line) {
  const first = line.indexOf('"')
  if (first < 0) return null
  const last = line.lastIndexOf('"')
  if (last <= first) return null

  const indent = line.slice(0, first)
  const content = line.slice(first + 1, last)
  const hasComma = /",\s*$/.test(line)
  return { indent, content, hasComma }
}

function makeLine(indent, content, withComma) {
  // We only escape quotes; backslashes etc are left as-is because the source file
  // is plain text requirements and doesn't contain complex escapes.
  const escaped = content.replace(/"/g, '\\"')
  return `${indent}"${escaped}"${withComma ? "," : ""}`
}

const out = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  if (!inItems && isItemsStart(line)) {
    inItems = true
    bracketDepth = 0
    lastStringLine = -1
  }

  if (inItems) {
    // Update bracket depth for the current line
    for (const ch of line) {
      if (ch === "[") bracketDepth++
      else if (ch === "]") bracketDepth--
    }

    const trimmed = line.trimStart()
    const isLiteralOption = /^"[a-e]\)\s*/.test(trimmed)

    if (isLiteralOption && lastStringLine >= 0) {
      const cur = parseStringLiteral(line)
      const prev = parseStringLiteral(out[lastStringLine])
      if (cur && prev) {
        const merged = (prev.content + " " + cur.content).replace(/\s+/g, " ").trim()
        out[lastStringLine] = makeLine(prev.indent, merged, prev.hasComma || cur.hasComma)
        continue // skip current line
      }
    }

    const parsed = parseStringLiteral(line)
    if (parsed) lastStringLine = out.length

    out.push(line)

    if (bracketDepth <= 0 && line.includes("]")) {
      inItems = false
      lastStringLine = -1
    }
  } else {
    out.push(line)
  }
}

fs.writeFileSync(targetPath, out.join("\n"), "utf8")
console.log(`Updated ${targetPath}`)

