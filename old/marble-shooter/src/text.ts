const DIGITS = '০১২৩৪৫৬৭৮৯'

export function bn(n: number): string {
  return String(Math.max(0, Math.floor(n))).replace(/\d/g, (d) => DIGITS[Number(d)] ?? d)
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&amp;'
    if (c === '<') return '&lt;'
    if (c === '>') return '&gt;'
    if (c === '"') return '&quot;'
    return '&#39;'
  })
}
