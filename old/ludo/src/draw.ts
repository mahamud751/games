import { COLORS, HOME, TRACK, YARDS, cellOf } from './board'

const BOX = [
  { col: 0, row: 9, player: 0 },
  { col: 9, row: 9, player: 1 },
  { col: 9, row: 0, player: 2 },
  { col: 0, row: 0, player: 3 },
]

const ARM: [number, number][][] = [
  [[13, 7], [12, 7]],
  [[7, 13], [7, 12]],
  [[1, 7], [2, 7]],
  [[7, 1], [7, 2]],
]

export function drawLudo(
  ctx: CanvasRenderingContext2D,
  size: number,
  tokens: number[][],
  seats: number[],
  pending: number[],
  turn: number,
): void {
  const cell = size / 15
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#0c5a3a'
  ctx.fillRect(0, 0, size, size)
  round(ctx, cell * 0.35, cell * 0.35, size - cell * 0.7, size - cell * 0.7, cell * 0.4)
  ctx.fillStyle = '#f4efe4'
  ctx.fill()

  for (const box of BOX) {
    ctx.fillStyle = COLORS[box.player]!.fill
    round(ctx, (box.col + 0.35) * cell, (box.row + 0.35) * cell, cell * 5.3, cell * 5.3, cell * 0.35)
    ctx.fill()
    ctx.fillStyle = '#fffaf2'
    round(ctx, (box.col + 1.15) * cell, (box.row + 1.15) * cell, cell * 3.7, cell * 3.7, cell * 0.3)
    ctx.fill()
  }

  const paint = (row: number, col: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(col * cell + 1, row * cell + 1, cell - 2, cell - 2)
  }
  for (const [row, col] of TRACK) paint(row, col, '#fffaf2')
  for (let player = 0; player < 4; player += 1) {
    for (const [row, col] of HOME[player] ?? []) paint(row, col, COLORS[player]!.fill)
    for (const [row, col] of ARM[player] ?? []) paint(row, col, COLORS[player]!.fill)
    const start = TRACK[player === 0 ? 0 : player === 1 ? 13 : player === 2 ? 26 : 39]!
    paint(start[0], start[1], COLORS[player]!.fill)
  }

  ctx.beginPath()
  ctx.moveTo(6 * cell, 9 * cell)
  ctx.lineTo(9 * cell, 9 * cell)
  ctx.lineTo(7.5 * cell, 7.5 * cell)
  ctx.closePath()
  ctx.fillStyle = COLORS[0]!.fill
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(9 * cell, 6 * cell)
  ctx.lineTo(9 * cell, 9 * cell)
  ctx.lineTo(7.5 * cell, 7.5 * cell)
  ctx.closePath()
  ctx.fillStyle = COLORS[1]!.fill
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(6 * cell, 6 * cell)
  ctx.lineTo(9 * cell, 6 * cell)
  ctx.lineTo(7.5 * cell, 7.5 * cell)
  ctx.closePath()
  ctx.fillStyle = COLORS[2]!.fill
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(6 * cell, 6 * cell)
  ctx.lineTo(6 * cell, 9 * cell)
  ctx.lineTo(7.5 * cell, 7.5 * cell)
  ctx.closePath()
  ctx.fillStyle = COLORS[3]!.fill
  ctx.fill()

  const groups = new Map<string, number>()
  for (const player of seats) {
    for (let token = 0; token < 4; token += 1) {
      const pos = tokens[player]?.[token] ?? -1
      const spot = pos < 0 ? YARDS[player]![token]! : cellOf(player, pos)
      const id = `${spot[0]},${spot[1]}`
      const slot = groups.get(id) ?? 0
      groups.set(id, slot + 1)
      const spread = pos < 0 ? 0 : slot
      const point = center(spot, cell, spread)
      const chosen = player === turn && pending.includes(token)
      ctx.beginPath()
      ctx.arc(point.x, point.y, cell * (chosen ? 0.36 : 0.3), 0, Math.PI * 2)
      ctx.fillStyle = '#fffaf2'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(point.x, point.y, cell * (chosen ? 0.26 : 0.22), 0, Math.PI * 2)
      ctx.fillStyle = COLORS[player]!.fill
      ctx.fill()
      ctx.lineWidth = chosen ? 3 : 1.5
      ctx.strokeStyle = chosen ? '#3a2a08' : 'rgba(0,0,0,0.35)'
      ctx.stroke()
    }
  }
}

export function tokenPoint(player: number, token: number, pos: number, size: number): { x: number; y: number } {
  const cell = size / 15
  const spot = pos < 0 ? YARDS[player]![token]! : cellOf(player, pos)
  return center(spot, cell, 0)
}

function center(spot: [number, number], cell: number, slot: number): { x: number; y: number } {
  const nudge = slot === 0 ? [0, 0] : slot === 1 ? [0.16, 0] : slot === 2 ? [-0.12, 0.12] : [0.12, 0.12]
  return {
    x: spot[1] * cell + cell / 2 + (nudge[0] ?? 0) * cell,
    y: spot[0] * cell + cell / 2 + (nudge[1] ?? 0) * cell,
  }
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
