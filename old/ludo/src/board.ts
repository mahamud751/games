export const TRACK: [number, number][] = [
  [13, 6], [14, 6], [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8],
  [0, 8], [0, 7], [0, 6],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6],
]

export const START = [0, 13, 26, 39]
export const SAFE = new Set([0, 13, 26, 39, 5, 18, 31, 44])
export const FINISH = 55

export const HOME: [number, number][][] = [
  [[11, 7], [10, 7], [9, 7], [8, 7], [7, 7]],
  [[7, 11], [7, 10], [7, 9], [7, 8], [7, 7]],
  [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]],
  [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]],
]

export const YARDS: [number, number][][] = [
  [[11, 2], [11, 4], [13, 2], [13, 4]],
  [[11, 10], [11, 12], [13, 10], [13, 12]],
  [[1, 10], [1, 12], [3, 10], [3, 12]],
  [[1, 2], [1, 4], [3, 2], [3, 4]],
]

export const COLORS = [
  { name: 'লাল', fill: '#d23b3b', ink: '#fffaf2' },
  { name: 'নীল', fill: '#2458c5', ink: '#fffaf2' },
  { name: 'হলুদ', fill: '#e2a412', ink: '#3a2a08' },
  { name: 'সবুজ', fill: '#1f8a45', ink: '#fffaf2' },
]

const seen = new Set(TRACK.map(([row, col]) => `${row},${col}`))
if (TRACK.length !== 52 || seen.size !== 52) throw new Error('Ludo track is not 52 unique squares')

export interface Move {
  token: number
  from: number
  to: number
}

export function cellOf(player: number, pos: number): [number, number] {
  if (pos <= 50) {
    const start = START[player] ?? 0
    return TRACK[(start + pos) % 52] ?? [7, 7]
  }
  return HOME[player]?.[pos - 51] ?? [7, 7]
}

export function legalMoves(tokens: number[][], player: number, dice: number): Move[] {
  const mine = tokens[player] ?? []
  const moves: Move[] = []
  for (let token = 0; token < 4; token += 1) {
    const from = mine[token] ?? -1
    if (from >= FINISH) continue
    if (from < 0) {
      if (dice === 6 && !blocked(tokens, player, 0)) moves.push({ token, from, to: 0 })
      continue
    }
    const to = from + dice
    if (to > FINISH) continue
    if (to <= 50 && blocked(tokens, player, to)) continue
    moves.push({ token, from, to })
  }
  return moves
}

export function blocked(tokens: number[][], player: number, pos: number): boolean {
  if (pos > 50) return false
  const here = key(player, pos)
  for (let other = 0; other < 4; other += 1) {
    if (other === player) continue
    let count = 0
    for (const pos2 of tokens[other] ?? []) {
      if (pos2 >= 0 && pos2 <= 50 && key(other, pos2) === here) count += 1
    }
    if (count >= 2) return true
  }
  return false
}

export function captured(tokens: number[][], player: number, pos: number): { player: number; token: number }[] {
  if (pos < 0 || pos > 50) return []
  const here = key(player, pos)
  if (SAFE.has((START[player]! + pos) % 52)) return []
  const hits: { player: number; token: number }[] = []
  for (let other = 0; other < 4; other += 1) {
    if (other === player) continue
    const mine: { token: number }[] = []
    ;(tokens[other] ?? []).forEach((pos2, token) => {
      if (pos2 >= 0 && pos2 <= 50 && key(other, pos2) === here) mine.push({ token })
    })
    if (mine.length >= 2) continue
    for (const hit of mine) hits.push({ player: other, token: hit.token })
  }
  return hits
}

function key(player: number, pos: number): string {
  const cell = cellOf(player, pos)
  return `${cell[0]},${cell[1]}`
}
