import { loadClub, prize, refund, saveClub, stakeCoin, type Club } from './purse'
import { Sfx } from './sfx'
import { bn, esc } from './text'

const LADDERS = new Map<number, number>([
  [4, 14], [9, 31], [21, 42], [28, 84], [36, 44], [51, 67], [71, 91], [80, 100],
])
const SNAKES = new Map<number, number>([
  [17, 7], [54, 34], [62, 19], [64, 60], [87, 24], [93, 73], [95, 75], [98, 78],
])

const SIZE = 640
type Mode = 'cpu' | 'friend'

export class SnakesGame {
  private readonly sfx = new Sfx()
  private club: Club = loadClub()
  private mode: Mode = 'cpu'
  private screen: 'menu' | 'how' | 'play' | 'end' = 'menu'
  private pos = [0, 0]
  private turn = 0
  private dice = 1
  private note = 'ছক্কা ঘোরাও'
  private busy = false
  private winner: number | null = null
  private staked = false
  private loan = ''
  private names = ['তুমি', 'ক্লাব']
  private cpuTask = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
    private readonly layer: HTMLElement,
  ) {
    this.sfx.muted = this.club.muted
    window.addEventListener('pointerdown', () => this.sfx.unlock())
    window.addEventListener('resize', () => this.fit())
    const onUi = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
      if (!button) return
      this.onAct(button.dataset.act ?? '')
    }
    this.hud.addEventListener('click', onUi)
    this.layer.addEventListener('click', onUi)
    this.fit()
    this.paint()
  }

  private onAct(act: string): void {
    if (act === 'mute') {
      this.club.muted = !this.club.muted
      this.sfx.muted = this.club.muted
      saveClub(this.club)
      this.paint()
      return
    }
    if (act === 'how') {
      this.screen = 'how'
      this.paint()
      return
    }
    if (act === 'menu') {
      this.home()
      return
    }
    if (act === 'cpu' || act === 'friend') {
      this.start(act)
      return
    }
    if (act === 'again') this.start(this.mode)
    if (act === 'roll') void this.humanRoll()
  }

  private start(mode: Mode): void {
    window.clearTimeout(this.cpuTask)
    this.mode = mode
    this.names = mode === 'cpu' ? ['তুমি', 'ক্লাব'] : ['লাল', 'নীল']
    this.pos = [0, 0]
    this.turn = 0
    this.dice = 1
    this.note = `${this.names[0]} ছক্কা ঘোরাবে`
    this.busy = false
    this.winner = null
    this.loan = ''
    this.staked = false
    if (mode === 'cpu') {
      const paid = stakeCoin(this.club)
      this.club = paid.club
      this.staked = true
      if (paid.loan) this.loan = 'কয়েন শেষ ছিল, মামা ৬টা ধার দিলেন।'
    }
    this.screen = 'play'
    this.paint()
  }

  private home(): void {
    window.clearTimeout(this.cpuTask)
    if (this.staked && this.winner === null) {
      this.club = refund(this.club)
      this.staked = false
    }
    this.busy = false
    this.screen = 'menu'
    this.paint()
  }

  private isCpu(): boolean {
    return this.mode === 'cpu' && this.turn === 1
  }

  private async humanRoll(): Promise<void> {
    if (this.busy || this.isCpu() || this.winner !== null || this.screen !== 'play') return
    await this.takeTurn()
  }

  private async takeTurn(): Promise<void> {
    this.busy = true
    this.paint()
    const value = await this.spin()
    if (this.screen !== 'play') return
    const from = this.pos[this.turn] ?? 0
    if (from + value > 100) {
      this.note = 'ঠিক ১০০-এ পড়তে হবে'
      this.pass()
      this.busy = false
      this.paint()
      this.pokeCpu()
      return
    }
    for (let square = from + 1; square <= from + value; square += 1) {
      this.pos[this.turn] = square
      this.draw()
      this.sfx.step()
      await this.wait(this.quick() ? 16 : 110)
      if (this.screen !== 'play') return
    }
    const landed = this.pos[this.turn] ?? 0
    const climb = LADDERS.get(landed)
    const drop = SNAKES.get(landed)
    if (climb) {
      this.note = 'মই!'
      this.sfx.ladder()
      await this.slide(climb)
    } else if (drop) {
      this.note = 'সাপ!'
      this.sfx.snake()
      await this.slide(drop)
    }
    if (this.screen !== 'play') return
    if ((this.pos[this.turn] ?? 0) >= 100) {
      this.winner = this.turn
      this.finish()
      return
    }
    this.pass()
    this.busy = false
    this.paint()
    this.pokeCpu()
  }

  private async slide(target: number): Promise<void> {
    this.pos[this.turn] = target
    this.draw()
    this.paint()
    await this.wait(this.quick() ? 20 : 420)
  }

  private pass(): void {
    this.turn = this.turn === 0 ? 1 : 0
    this.note = `এখন ${this.names[this.turn]}`
  }

  private pokeCpu(): void {
    if (!this.isCpu() || this.screen !== 'play' || this.winner !== null) return
    window.clearTimeout(this.cpuTask)
    this.cpuTask = window.setTimeout(() => void this.takeTurn(), 450)
  }

  private async spin(): Promise<number> {
    const value = 1 + Math.floor(Math.random() * 6)
    const frames = this.quick() ? 2 : 6
    for (let frame = 0; frame < frames; frame += 1) {
      this.dice = 1 + Math.floor(Math.random() * 6)
      this.sfx.roll()
      this.paint()
      await this.wait(60)
    }
    this.dice = value
    this.paint()
    return value
  }

  private finish(): void {
    this.busy = false
    this.sfx.win()
    if (this.mode === 'cpu') {
      if (this.winner === 0) this.club = prize(this.club, 'snakes')
      this.staked = false
    }
    this.screen = 'end'
    this.paint()
  }

  private fit(): void {
    const max = Math.min(window.innerWidth - 16, window.innerHeight - 150, 560)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.style.width = `${max}px`
    this.canvas.style.height = `${max}px`
    this.canvas.width = Math.floor(max * dpr)
    this.canvas.height = Math.floor(max * dpr)
    this.draw()
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx || this.screen === 'menu' || this.screen === 'how') return
    const scale = this.canvas.width / SIZE
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawBoard(ctx)
    for (const player of [0, 1]) {
      const square = this.pos[player] ?? 0
      if (square < 1) continue
      const point = spot(square)
      const shift = player === 0 ? -8 : 8
      ctx.beginPath()
      ctx.arc(point.x + shift, point.y, 14, 0, Math.PI * 2)
      ctx.fillStyle = player === 0 ? '#d23b3b' : '#2458c5'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#fffaf2'
      ctx.stroke()
    }
  }

  private paint(): void {
    this.canvas.hidden = this.screen === 'menu' || this.screen === 'how'
    const canRoll = this.screen === 'play' && !this.busy && !this.isCpu() && this.winner === null
    this.hud.innerHTML =
      this.screen === 'play'
        ? `<div class="dock">
            <div><p class="who">${esc(this.names[this.turn] ?? '')} · ${bn(this.pos[this.turn] ?? 0)}</p><p class="note">${esc(this.note)}</p></div>
            <button type="button" class="die" data-act="roll" ${canRoll ? '' : 'disabled'}>${bn(this.dice)}</button>
            <div class="bar-actions">${this.mute()}<button type="button" data-act="menu">হোম</button></div>
          </div>`
        : ''
    this.layer.innerHTML =
      this.screen === 'menu' ? this.menuHtml() : this.screen === 'how' ? this.howHtml() : this.screen === 'end' ? this.endHtml() : ''
    if (this.screen === 'play') this.draw()
  }

  private menuHtml(): string {
    return `<div class="veil"><div class="card">
      <p class="eyebrow">পাড়ার ক্লাব</p>
      <h1>সাপ-মই</h1>
      <p class="sub">Snakes & Ladders</p>
      <p class="lead">ছক্কা ফেলো, মই দিয়ে উঠো, সাপ এড়িয়ে ১০০-এ পৌঁছাও। ক্লাবে ১ কয়েন, জিতলে ২।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="cpu">ক্লাবে খেলো · ১ কয়েন</button>
        <button type="button" class="btn ghost" data-act="friend">বন্ধুর সাথে · ফ্রি</button>
        <button type="button" class="texty" data-act="how">নিয়ম</button>
      </div>
      <p class="fine">কয়েন ${bn(this.club.coins)} · জয় ${bn(this.club.wins.snakes)}</p>
    </div></div>`
  }

  private howHtml(): string {
    return `<div class="veil"><div class="card">
      <p class="eyebrow">নিয়ম</p>
      <h2>বইয়ের ছক</h2>
      <ul>
        <li>১ থেকে ১০০। ঠিক ১০০-এ না পড়লে অপেক্ষা।</li>
        <li>মই-এর নিচে পড়লে উপরে উঠবে।</li>
        <li>সাপের মুখে পড়লে লেজে নেমে যাবে।</li>
      </ul>
      <button type="button" class="btn" data-act="menu">ফিরে যাও</button>
    </div></div>`
  }

  private endHtml(): string {
    const name = this.names[this.winner ?? 0] ?? ''
    const coin =
      this.mode !== 'cpu'
        ? 'বন্ধুদের খেলা, কয়েন লাগেনি।'
        : this.winner === 0
          ? `জিতেছো। কয়েন এখন ${bn(this.club.coins)}।`
          : `ক্লাব জিতেছে। কয়েন এখন ${bn(this.club.coins)}।`
    return `<div class="veil"><div class="card">
      <p class="eyebrow">খেলা শেষ</p>
      <h2>${esc(name)} জিতেছে</h2>
      <p class="lead">${this.loan ? `${esc(this.loan)} ` : ''}${coin}</p>
      <div class="stack">
        <button type="button" class="btn" data-act="again">আরেকটা খেলা</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div></div>`
  }

  private mute(): string {
    return `<button type="button" data-act="mute">${this.club.muted ? 'শব্দ বন্ধ' : 'শব্দ'}</button>`
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  private quick(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
}

function drawBoard(ctx: CanvasRenderingContext2D): void {
  const cell = SIZE / 10
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#f6efe2'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let n = 1; n <= 100; n += 1) {
    const point = spot(n)
    const x = point.x - cell / 2
    const y = point.y - cell / 2
    ctx.fillStyle = (Math.floor((n - 1) / 10) + (n - 1)) % 2 === 0 ? '#fffaf2' : '#e7f3ea'
    if (n === 100) ctx.fillStyle = '#f6d36b'
    if (n === 1) ctx.fillStyle = '#cdead8'
    ctx.fillRect(x, y, cell, cell)
    ctx.fillStyle = '#5c5144'
    ctx.font = '600 16px "Hind Siliguri", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(bn(n), x + 6, y + 18)
  }
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  for (const [from, to] of LADDERS) drawLink(ctx, from, to, '#c88812', false)
  for (const [from, to] of SNAKES) drawLink(ctx, from, to, '#2f6b45', true)
  ctx.strokeStyle = '#6e2430'
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, SIZE - 10, SIZE - 10)
}

function drawLink(ctx: CanvasRenderingContext2D, from: number, to: number, color: string, snake: boolean): void {
  const a = spot(from)
  const b = spot(to)
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const bend = (snake ? 36 : 18) * (from % 2 === 0 ? 1 : -1)
  const cx = mx + (-dy / len) * bend
  const cy = my + (dx / len) * bend
  ctx.strokeStyle = color
  ctx.lineWidth = snake ? 7 : 5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.quadraticCurveTo(cx, cy, b.x, b.y)
  ctx.stroke()
  if (snake) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(a.x, a.y, 11, 0, Math.PI * 2)
    ctx.fill()
  }
}

function spot(n: number): { x: number; y: number } {
  const index = n - 1
  const row = Math.floor(index / 10)
  const col = row % 2 === 0 ? index % 10 : 9 - (index % 10)
  const cell = SIZE / 10
  return { x: col * cell + cell / 2, y: SIZE - (row * cell + cell / 2) }
}
