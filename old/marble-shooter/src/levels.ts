/** Positions are fractions of the ring radius, measured from the center. */

export interface Spot {
  x: number
  y: number
  c: number
}

export interface LevelDef {
  name: string
  shots: number
  par: number
  layout: Spot[]
}

function hex(radius: number): Spot[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius, c: i % 8 }
  })
}

function ring(count: number, radius: number): Spot[] {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius, c: i % 8 }
  })
}

function grid3(): Spot[] {
  const spots: Spot[] = []
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      spots.push({ x: x * 0.22, y: y * 0.22, c: (spots.length * 3) % 8 })
    }
  }
  return spots
}

export function plus13(): Spot[] {
  const rows = [[0], [-1, 0, 1], [-2, -1, 0, 1, 2], [-1, 0, 1], [0]]
  const spots: Spot[] = []
  rows.forEach((xs, row) => {
    const y = (row - 2) * 0.2
    for (const x of xs) spots.push({ x: x * 0.2, y, c: spots.length % 8 })
  })
  return spots
}

export const QUICK: Spot[] = [{ x: 0, y: 0, c: 2 }, ...hex(0.22)]
export const CLASSIC: Spot[] = plus13()

export const LEVELS: LevelDef[] = [
  {
    name: 'তিন গুটি',
    shots: 5,
    par: 2,
    layout: [
      { x: 0, y: -0.12, c: 0 },
      { x: -0.16, y: 0.12, c: 3 },
      { x: 0.16, y: 0.12, c: 4 },
    ],
  },
  {
    name: 'চৌকো',
    shots: 6,
    par: 3,
    layout: [
      { x: 0, y: -0.2, c: 1 },
      { x: -0.2, y: 0, c: 5 },
      { x: 0.2, y: 0, c: 2 },
      { x: 0, y: 0.2, c: 6 },
    ],
  },
  {
    name: 'পাঁচ তারকা',
    shots: 6,
    par: 3,
    layout: [
      { x: 0, y: 0, c: 2 },
      { x: 0, y: -0.3, c: 0 },
      { x: 0, y: 0.3, c: 4 },
      { x: -0.3, y: 0, c: 1 },
      { x: 0.3, y: 0, c: 3 },
    ],
  },
  {
    name: 'ছয় ফুল',
    shots: 7,
    par: 4,
    layout: hex(0.28),
  },
  {
    name: 'জটলা',
    shots: 6,
    par: 3,
    layout: [{ x: 0, y: 0, c: 7 }, ...hex(0.2)],
  },
  {
    name: 'নয়ের ঘর',
    shots: 9,
    par: 5,
    layout: grid3(),
  },
  {
    name: 'আংটি',
    shots: 8,
    par: 5,
    layout: [{ x: 0, y: 0, c: 2 }, ...ring(8, 0.36)],
  },
  {
    name: 'তেরো গুটি',
    shots: 10,
    par: 6,
    layout: plus13(),
  },
]
