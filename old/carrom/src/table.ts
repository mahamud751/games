export const SIZE = 1000
export const INSET = 86
export const PIECE_R = 18
export const STRIKER_R = 25
export const POCKET_R = 74
export const BASE_X0 = 248
export const BASE_X1 = 752

export const POCKETS = [
  { x: INSET, y: INSET },
  { x: SIZE - INSET, y: INSET },
  { x: SIZE - INSET, y: SIZE - INSET },
  { x: INSET, y: SIZE - INSET },
]

export function baselineY(seat: 0 | 1): number {
  return seat === 0 ? SIZE - 176 : 176
}

export type Spot = { kind: 'w' | 'b' | 'q'; x: number; y: number }

export function rack(): Spot[] {
  const mid = SIZE / 2
  const out: Spot[] = [{ kind: 'q', x: mid, y: mid }]
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (i / 6) * Math.PI * 2
    out.push({
      kind: i % 2 === 0 ? 'w' : 'b',
      x: mid + Math.cos(angle) * 40,
      y: mid + Math.sin(angle) * 40,
    })
  }
  for (let i = 0; i < 12; i += 1) {
    const angle = -Math.PI / 2 + Math.PI / 12 + (i / 12) * Math.PI * 2
    out.push({
      kind: i % 2 === 0 ? 'b' : 'w',
      x: mid + Math.cos(angle) * 80,
      y: mid + Math.sin(angle) * 80,
    })
  }
  return out
}

export function inPocket(x: number, y: number): boolean {
  return POCKETS.some((pocket) => Math.hypot(x - pocket.x, y - pocket.y) < POCKET_R)
}
