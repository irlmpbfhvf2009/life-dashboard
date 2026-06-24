// Minimal client-side CSV parsing + profiling for the Data Lab. Handles quoted
// fields with embedded commas and escaped quotes. Good enough for typical CSVs;
// the raw file never leaves the browser — only a compact text profile is sent.

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); records.push(row); field = ''; row = []
    } else field += c
  }
  if (field.length || row.length) { row.push(field); records.push(row) }

  const headers = records.shift() ?? []
  return { headers: headers.map((h) => h.trim()), rows: records.filter((r) => r.some((c) => c.trim() !== '')) }
}

export interface ColumnStat {
  name: string
  type: 'number' | 'text'
  missing: number
  // numeric only
  min?: number
  max?: number
  mean?: number
  // text only
  unique?: number
}

export function profileColumns(headers: string[], rows: string[][]): ColumnStat[] {
  return headers.map((name, col) => {
    const values = rows.map((r) => (r[col] ?? '').trim())
    const nonEmpty = values.filter((v) => v !== '')
    const missing = values.length - nonEmpty.length
    const nums = nonEmpty.map(Number).filter((n) => Number.isFinite(n))
    const isNumeric = nonEmpty.length > 0 && nums.length >= nonEmpty.length * 0.8

    if (isNumeric && nums.length) {
      const min = Math.min(...nums)
      const max = Math.max(...nums)
      const mean = nums.reduce((s, n) => s + n, 0) / nums.length
      return { name, type: 'number', missing, min, max, mean }
    }
    return { name, type: 'text', missing, unique: new Set(nonEmpty).size }
  })
}

/** Build the compact text profile sent to the AI (never the raw file). */
export function buildProfile(headers: string[], rows: string[][], stats: ColumnStat[]): string {
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  const cols = stats.map((s) =>
    s.type === 'number'
      ? `- ${s.name} (number): min=${round(s.min!)}, max=${round(s.max!)}, mean=${round(s.mean!)}, missing=${s.missing}`
      : `- ${s.name} (text): unique=${s.unique}, missing=${s.missing}`,
  ).join('\n')

  const sample = [headers, ...rows.slice(0, 5)].map((r) => r.join(', ')).join('\n')

  return [
    `Dataset: ${rows.length} rows × ${headers.length} columns.`,
    `Columns:\n${cols}`,
    `Sample rows (header + first 5):\n${sample}`,
  ].join('\n\n')
}
