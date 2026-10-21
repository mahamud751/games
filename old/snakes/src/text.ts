const DIGITS = '০১২৩৪৫৬৭৮৯'

export function bn(n: number): string {
  return String(Math.max(0, Math.floor(Math.abs(n)))).replace(/\d/g, (digit) => DIGITS[Number(digit)] ?? digit)
}

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}
