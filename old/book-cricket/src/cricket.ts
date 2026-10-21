export type Shot = 'careful' | 'normal' | 'attack'
export type Style = 'careful' | 'steady' | 'attack'
export type Ball = 'W' | number
export type BookId = 'bangla' | 'math' | 'story'

export interface Player {
  name: string
  style: Style
}

export interface BookDef {
  id: BookId
  name: string
  blurb: string
  pages: number
  /** Weight of last digits 0 through 9. */
  weights: number[]
}

export interface Batter extends Player {
  runs: number
  balls: number
  fours: number
  sixes: number
  status: 'yet' | 'batting' | 'out' | 'notout'
}

export interface Innings {
  runs: number
  wickets: number
  balls: number
  batters: Batter[]
  striker: number
  nonStriker: number
  nextIn: number
  thisOver: Ball[]
  overs: Ball[][]
  fow: number[]
  partnership: number
  closed: boolean
}

export interface Limits {
  maxBalls: number
  maxWickets: number
}

export interface Flip {
  page: number
  digit: number
  ball: Ball
  label: string
  stamp: 'out' | 'dot' | 'run' | 'four' | 'six'
}

export const OURS: Player[] = [
  { name: 'রাফি', style: 'careful' },
  { name: 'নীলা', style: 'careful' },
  { name: 'সামি', style: 'steady' },
  { name: 'মিতু', style: 'attack' },
  { name: 'জয়', style: 'attack' },
  { name: 'তুবা', style: 'steady' },
  { name: 'আরিফ', style: 'attack' },
  { name: 'রুমা', style: 'steady' },
  { name: 'শুভ', style: 'attack' },
  { name: 'দীপা', style: 'careful' },
  { name: 'অনিক', style: 'attack' },
]

export const THEIRS: Player[] = [
  { name: 'পলক', style: 'careful' },
  { name: 'রিকা', style: 'careful' },
  { name: 'নাবিল', style: 'steady' },
  { name: 'মৌ', style: 'attack' },
  { name: 'তানভীর', style: 'attack' },
  { name: 'শ্রেয়', style: 'steady' },
  { name: 'ইমরান', style: 'attack' },
  { name: 'লামিয়া', style: 'steady' },
  { name: 'ফারহান', style: 'attack' },
  { name: 'নুসরাত', style: 'careful' },
  { name: 'বিলাল', style: 'attack' },
]

export const BOOKS: Record<BookId, BookDef> = {
  bangla: {
    id: 'bangla',
    name: 'বাংলা দ্রুত পাঠ',
    blurb: 'মাঝামাঝি। চারও আসে, আউটও।',
    pages: 128,
    weights: [8, 11, 12, 10, 11, 9, 9, 9, 8, 9],
  },
  math: {
    id: 'math',
    name: 'অঙ্কের বই',
    blurb: 'কঠিন। ডট আর আউট বেশি।',
    pages: 180,
    weights: [14, 12, 13, 9, 6, 13, 4, 11, 13, 11],
  },
  story: {
    id: 'story',
    name: 'গল্পের বই',
    blurb: 'ঝুঁকি। ছক্কাও আসে, আউটও।',
    pages: 240,
    weights: [12, 6, 7, 6, 15, 6, 16, 6, 13, 6],
  },
}

const SHOT_MUL: Record<Shot, number[]> = {
  careful: [0.42, 1.45, 1.5, 1.15, 0.72, 1.25, 0.42, 1.15, 0.42, 1.2],
  normal: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  attack: [1.65, 0.62, 0.68, 0.85, 1.55, 0.58, 1.85, 0.55, 1.55, 0.55],
}

export function styleName(style: Style): string {
  if (style === 'careful') return 'সাবধানি'
  if (style === 'attack') return 'মারের খেলোয়াড়'
  return 'সমান খেলোয়াড়'
}

export function freshInnings(players: Player[]): Innings {
  return {
    runs: 0,
    wickets: 0,
    balls: 0,
    batters: players.map((player, index) => ({
      ...player,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      status: index < 2 ? 'batting' : 'yet',
    })),
    striker: 0,
    nonStriker: 1,
    nextIn: 2,
    thisOver: [],
    overs: [],
    fow: [],
    partnership: 0,
    closed: false,
  }
}

export function inningsDone(inn: Innings, limits: Limits, target: number | null): boolean {
  if (inn.closed) return true
  if (target !== null && inn.runs >= target) return true
  if (inn.wickets >= limits.maxWickets) return true
  return inn.balls >= limits.maxBalls
}

export function flipPage(book: BookDef, shot: Shot, style: Style): Flip {
  const weights = SHOT_MUL[shot].map((mul, digit) => book.weights[digit]! * mul * styleMul(shot, style, digit))
  const digit = pick(weights)
  const page = pageWithDigit(digit, book.pages)
  return { page, digit, ...readDigit(digit) }
}

function styleMul(shot: Shot, style: Style, digit: number): number {
  const out = digit === 0 || digit === 8
  const six = digit === 6
  const single = digit === 1 || digit === 2
  if (style === 'careful' && shot === 'careful' && out) return 0.7
  if (style === 'careful' && shot === 'careful' && single) return 1.15
  if (style === 'careful' && shot === 'attack' && out) return 1.35
  if (style === 'careful' && shot === 'attack' && six) return 0.75
  if (style === 'attack' && shot === 'attack' && six) return 1.3
  if (style === 'attack' && shot === 'attack' && digit === 4) return 1.15
  if (style === 'attack' && shot === 'careful' && out) return 1.2
  return 1
}

function readDigit(digit: number): Pick<Flip, 'ball' | 'label' | 'stamp'> {
  if (digit === 0 || digit === 8) return { ball: 'W', label: 'আউট!', stamp: 'out' }
  if (digit === 4) return { ball: 4, label: 'চার!', stamp: 'four' }
  if (digit === 6) return { ball: 6, label: 'ছক্কা!', stamp: 'six' }
  if (digit === 5 || digit === 7 || digit === 9) return { ball: 0, label: 'ডট বল', stamp: 'dot' }
  const words = ['', '১ রান', '২ রান', '৩ রান']
  return { ball: digit, label: words[digit] ?? 'রান', stamp: 'run' }
}

export function applyBall(inn: Innings, ball: Ball, limits: Limits, target: number | null): void {
  if (inningsDone(inn, limits, target)) return
  const striker = inn.batters[inn.striker]
  if (!striker) return
  striker.balls += 1
  inn.balls += 1
  if (ball === 'W') {
    striker.status = 'out'
    inn.wickets += 1
    inn.fow.push(inn.runs)
    inn.partnership = 0
    inn.thisOver.push('W')
    if (inn.wickets < limits.maxWickets && inn.nextIn < inn.batters.length) {
      inn.striker = inn.nextIn
      inn.nextIn += 1
      const next = inn.batters[inn.striker]
      if (next) next.status = 'batting'
    }
  } else {
    striker.runs += ball
    inn.runs += ball
    inn.partnership += ball
    if (ball === 4) striker.fours += 1
    if (ball === 6) striker.sixes += 1
    inn.thisOver.push(ball)
    if (ball % 2 === 1) swapStrike(inn)
  }
  const finished = inningsDone(inn, limits, target)
  if (inn.balls % 6 === 0) {
    inn.overs.push(inn.thisOver)
    inn.thisOver = []
    if (!finished) swapStrike(inn)
  }
  if (finished) closeInnings(inn)
}

export function closeInnings(inn: Innings): void {
  if (inn.closed) return
  inn.closed = true
  for (const batter of inn.batters) {
    if (batter.status === 'batting') batter.status = 'notout'
  }
  if (inn.thisOver.length > 0) {
    inn.overs.push(inn.thisOver)
    inn.thisOver = []
  }
}

export function cpuShot(inn: Innings, limits: Limits, target: number | null): Shot {
  const ballsLeft = Math.max(1, limits.maxBalls - inn.balls)
  const wicketsLeft = limits.maxWickets - inn.wickets
  if (target !== null) {
    const need = target - inn.runs
    const perBall = need / ballsLeft
    if (wicketsLeft <= 2 && perBall < 1.1) return 'careful'
    if (perBall >= 2) return 'attack'
    if (perBall >= 1.25) return 'normal'
    return wicketsLeft <= 3 ? 'careful' : 'normal'
  }
  if (wicketsLeft <= 2) return 'careful'
  if (ballsLeft <= 12 && wicketsLeft >= 4) return Math.random() < 0.7 ? 'attack' : 'normal'
  return Math.random() < 0.22 ? 'attack' : 'normal'
}

function swapStrike(inn: Innings): void {
  const striker = inn.striker
  inn.striker = inn.nonStriker
  inn.nonStriker = striker
}

function pick(weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = Math.random() * total
  for (let digit = 0; digit < weights.length; digit += 1) {
    roll -= weights[digit] ?? 0
    if (roll <= 0) return digit
  }
  return 0
}

function pageWithDigit(digit: number, pages: number): number {
  const choices: number[] = []
  for (let page = 12; page <= pages; page += 1) {
    if (page % 10 === digit) choices.push(page)
  }
  return choices[Math.floor(Math.random() * choices.length)] ?? 10 + digit
}
