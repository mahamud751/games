import { COLORS, FINISH, captured, legalMoves, type Move } from './board'
import { drawLudo, tokenPoint } from './draw'
import { loadClub, prize, refund, saveClub, stakeCoin, type Club } from './purse'
import { Sfx } from './sfx'
import { bn, esc } from './text'

type Mode = 'cpu' | 'two' | 'four'
type Screen = 'menu' | 'how' | 'play' | 'end'

const BOARD = 630

export class LudoGame {
  private readonly sfx = new Sfx()
  private club: Club = loadClub()
  private mode: Mode = 'cpu'
  private screen: Screen = 'menu'
  private seats: number[] = [0, 2]
  private turnIndex = 0
  private tokens: number[][] = Array.from({ length: 4 }, () => [-1, -1, -1, -1])
  private dice = 1
  private sixes = 0
  private note = 'ছক্কা ঘোরাও'
  private pending: Move[] = []
  private busy = false
  private winner: number | null = null
  private staked = false
  private loan = ''
  private size = BOARD
  private cpuTask = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
    private readonly layer: HTMLElement,
  ) {
    this.sfx.muted = this.club.muted
    this.canvas.addEventListener('pointerdown', (event) => this.onBoard(event))
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

  private get turn(): number {
    return this.seats[this.turnIndex] ?? 0
  }

  private isCpu(): boolean {
    return this.mode === 'cpu' && this.turn === 2
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
    if (act === 'cpu' || act === 'two' || act === 'four') {
      this.start(act)
      return
    }
    if (act === 'again') this.start(this.mode)
    if (act === 'roll') void this.humanRoll()
  }

  private start(mode: Mode): void {
    window.clearTimeout(this.cpuTask)
    this.mode = mode
    this.seats = mode === 'four' ? [0, 1, 2, 3] : [0, 2]
    this.turnIndex = 0
    this.tokens = Array.from({ length: 4 }, () => [-1, -1, -1, -1])
    this.dice = 1
    this.sixes = 0
    this.pending = []
    this.busy = false
    this.winner = null
    this.loan = ''
    this.staked = false
    this.note = 'লাল ছক্কা ঘোরাবে'
    if (mode === 'cpu') {
      const paid = stakeCoin(this.club)
      this.club = paid.club
      this.staked = true
      if (paid.loan) this.loan = 'কয়েন শেষ ছিল, মামা ৬টা ধার দিলেন।'
    }
    this.screen = 'play'
    this.paint()
    this.draw()
  }

  private home(): void {
    window.clearTimeout(this.cpuTask)
    if (this.staked && this.winner === null) {
      this.club = refund(this.club)
      this.staked = false
    }
    this.screen = 'menu'
    this.busy = false
    this.paint()
  }

  private async humanRoll(): Promise<void> {
    if (this.busy || this.pending.length || this.winner !== null || this.isCpu() || this.screen !== 'play') return
    await this.takeTurn()
  }

  private async takeTurn(): Promise<void> {
    this.busy = true
    this.pending = []
    this.paint()
    const value = await this.spin()
    if (this.screen !== 'play') return
    if (value === 6) this.sixes += 1
    else this.sixes = 0
    if (value === 6 && this.sixes >= 3) {
      this.note = 'তিন ছক্কা! ঢালা বাতিল।'
      this.sixes = 0
      this.pass()
      this.busy = false
      this.paint()
      this.pokeCpu()
      return
    }
    const moves = legalMoves(this.tokens, this.turn, value)
    if (!moves.length) {
      this.note = 'চাল নেই'
      this.pass()
      this.busy = false
      this.paint()
      this.pokeCpu()
      return
    }
    const auto = this.isCpu() || moves.length === 1
    const move = auto ? (this.isCpu() ? this.pickCpu(moves) : moves[0]!) : null
    if (!move) {
      this.pending = moves
      this.note = 'ঘুঁটিতে টোকা দাও'
      this.busy = false
      this.paint()
      this.draw()
      return
    }
    await this.playMove(move)
    this.afterMove(value)
  }

  private afterMove(value: number): void {
    if (this.screen !== 'play') return
    if (this.winner !== null) {
      this.finishMatch()
      return
    }
    if (value === 6 && this.sixes < 3) {
      this.note = `${COLORS[this.turn]!.name} আবার ছক্কা`
      this.busy = false
      this.paint()
      this.pokeCpu()
      return
    }
    this.pass()
    this.busy = false
    this.paint()
    this.pokeCpu()
  }

  private pass(): void {
    this.turnIndex = (this.turnIndex + 1) % this.seats.length
    this.sixes = 0
    this.note = `এখন ${COLORS[this.turn]!.name}`
  }

  private pokeCpu(): void {
    if (!this.isCpu() || this.winner !== null || this.screen !== 'play') return
    window.clearTimeout(this.cpuTask)
    this.cpuTask = window.setTimeout(() => void this.takeTurn(), 480)
  }

  private pickCpu(moves: Move[]): Move {
    return [...moves].sort((a, b) => this.score(b) - this.score(a))[0]!
  }

  private score(move: Move): number {
    let score = move.to
    if (move.to === FINISH) score += 60
    if (move.from < 0) score += 18
    if (captured(this.tokens, this.turn, move.to).length) score += 45
    return score
  }

  private async playMove(move: Move): Promise<void> {
    const steps: number[] = []
    if (move.from < 0) steps.push(0)
    else for (let pos = move.from + 1; pos <= move.to; pos += 1) steps.push(pos)
    for (const pos of steps) {
      this.tokens[this.turn]![move.token] = pos
      this.draw()
      this.sfx.step()
      await this.wait(this.quick() ? 16 : 120)
      if (this.screen !== 'play') return
    }
    const hits = captured(this.tokens, this.turn, move.to)
    if (hits.length) {
      this.sfx.hit()
      for (const hit of hits) this.tokens[hit.player]![hit.token] = -1
      this.note = 'কেটে দিল!'
      this.draw()
    }
    if ((this.tokens[this.turn] ?? []).every((pos) => pos === FINISH)) this.winner = this.turn
  }

  private async spin(): Promise<number> {
    const value = 1 + Math.floor(Math.random() * 6)
    const frames = this.quick() ? 2 : 7
    for (let frame = 0; frame < frames; frame += 1) {
      this.dice = 1 + Math.floor(Math.random() * 6)
      this.sfx.roll()
      this.paint()
      await this.wait(70)
    }
    this.dice = value
    if (value === 6) this.sfx.six()
    this.paint()
    return value
  }

  private onBoard(event: PointerEvent): void {
    if (!this.pending.length || this.busy || this.screen !== 'play') return
    const rect = this.canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * this.size
    const y = ((event.clientY - rect.top) / rect.height) * this.size
    let best: Move | null = null
    let bestDist = 36
    for (const move of this.pending) {
      const point = tokenPoint(this.turn, move.token, move.from, this.size)
      const dist = Math.hypot(point.x - x, point.y - y)
      if (dist < bestDist) {
        best = move
        bestDist = dist
      }
    }
    if (!best) return
    const value = this.dice
    this.pending = []
    this.busy = true
    void this.playMove(best).then(() => this.afterMove(value))
  }

  private finishMatch(): void {
    this.busy = false
    this.pending = []
    this.sfx.win()
    if (this.mode === 'cpu') {
      if (this.winner === 0) this.club = prize(this.club, 'ludo')
      this.staked = false
    }
    this.screen = 'end'
    this.paint()
  }

  private fit(): void {
    const dock = 150
    const max = Math.min(window.innerWidth - 16, window.innerHeight - dock, 640)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.size = BOARD
    this.canvas.style.width = `${max}px`
    this.canvas.style.height = `${max}px`
    this.canvas.width = Math.floor(max * dpr)
    this.canvas.height = Math.floor(max * dpr)
    this.draw()
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx || this.screen === 'menu' || this.screen === 'how') return
    const scale = this.canvas.width / this.size
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const pendingTokens = this.pending.map((move) => move.token)
    drawLudo(ctx, this.size, this.tokens, this.seats, pendingTokens, this.turn)
  }

  private paint(): void {
    this.canvas.hidden = this.screen === 'menu' || this.screen === 'how'
    this.hud.innerHTML = this.screen === 'play' ? this.playHud() : ''
    this.layer.innerHTML =
      this.screen === 'menu' ? this.menuHtml() : this.screen === 'how' ? this.howHtml() : this.screen === 'end' ? this.endHtml() : ''
    if (this.screen === 'play') this.draw()
  }

  private playHud(): string {
    const canRoll = !this.busy && !this.pending.length && !this.isCpu() && this.winner === null
    return `<div class="dock">
      <div>
        <p class="who">পালা · ${COLORS[this.turn]!.name}</p>
        <p class="note">${esc(this.note)}</p>
      </div>
      <button type="button" class="die" data-act="roll" ${canRoll ? '' : 'disabled'}>${bn(this.dice)}</button>
      <div class="bar-actions">${this.mute()}<button type="button" data-act="menu">হোম</button></div>
    </div>`
  }

  private menuHtml(): string {
    return `<div class="veil"><div class="card">
      <p class="eyebrow">পাড়ার ক্লাব</p>
      <h1>লুডু</h1>
      <p class="sub">Ludo</p>
      <p class="lead">ছক্কায় বেরো, কাটো, ঘরে ঢোকো। ক্লাবে কম্পিউটারের সঙ্গে ১ কয়েন, জিতলে ২। বন্ধুদের সাথে ফ্রি।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="cpu">ক্লাবে খেলো · ১ কয়েন</button>
        <button type="button" class="btn ghost" data-act="two">দুই বন্ধু</button>
        <button type="button" class="btn ghost" data-act="four">চার বন্ধু</button>
        <button type="button" class="texty" data-act="how">নিয়ম</button>
      </div>
      <p class="fine">কয়েন ${bn(this.club.coins)} · জয় ${bn(this.club.wins.ludo)}</p>
    </div></div>`
  }

  private howHtml(): string {
    return `<div class="veil"><div class="card">
      <p class="eyebrow">নিয়ম</p>
      <h2>বাজারের লুডু</h2>
      <ul>
        <li>৬-এ ঘুঁটি বেরোয়, আর আরেকবার ছক্কা।</li>
        <li>একসাথে তিন ছক্কা বাতিল।</li>
        <li>তারা আর শুরুর ঘর সেফ। দুই ঘুঁটি এক ঘরে দাঁড়ালে ব্লক।</li>
        <li>ঘরে ঢুকতে ঠিক সংখ্যা লাগে। চার ঘুঁটি ঘরে ঢুকলে জয়।</li>
      </ul>
      <button type="button" class="btn" data-act="menu">ফিরে যাও</button>
    </div></div>`
  }

  private endHtml(): string {
    const name = COLORS[this.winner ?? 0]!.name
    const coin =
      this.mode !== 'cpu'
        ? 'বন্ধুদের খেলা, কয়েন লাগেনি।'
        : this.winner === 0
          ? `জিতেছো। কয়েন এখন ${bn(this.club.coins)}।`
          : `ক্লাব জিতেছে। কয়েন এখন ${bn(this.club.coins)}।`
    return `<div class="veil"><div class="card">
      <p class="eyebrow">খেলা শেষ</p>
      <h2>${name} জিতেছে</h2>
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
