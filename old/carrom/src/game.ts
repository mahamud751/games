import { Bodies, Body, Composite, Engine, Events, Sleeping, type Body as MatterBody } from 'matter-js'
import { drawBoard } from './draw'
import { loadClub, prize, refund, saveClub, stakeCoin, type Club } from './purse'
import { freshTable, settle, type Kind, type Seat, type Table } from './rules'
import { Sfx } from './sfx'
import { BASE_X0, BASE_X1, PIECE_R, SIZE, STRIKER_R, baselineY, inPocket, rack } from './table'
import { bn, esc } from './text'

type Mode = 'friend' | 'cpu'
type Phase = 'place' | 'fly'

interface Coin {
  body: MatterBody
  kind: Kind
}

const SPEED = 24

export class CarromGame {
  private readonly sfx = new Sfx()
  private club: Club = loadClub()
  private engine = Engine.create()
  private coins: Coin[] = []
  private striker: MatterBody | null = null
  private table: Table = freshTable()
  private mode: Mode = 'friend'
  private phase: Phase = 'place'
  private screen: 'menu' | 'how' | 'play' | 'end' = 'menu'
  private aim: { x: number; y: number } | null = null
  private drag: 'slide' | 'aim' | null = null
  private fallen: Kind[] = []
  private still = 0
  private shotAt = 0
  private note = 'সাদা আগে মারবে।'
  private banner = ''
  private winner: Seat | null = null
  private staked = false
  private loan = ''
  private hinted = false
  private raf = 0
  private last = 0
  private view: Seat = 0
  private scale = 1
  private offsetX = 0
  private offsetY = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
    private readonly layer: HTMLElement,
  ) {
    this.sfx.muted = this.club.muted
    this.engine.gravity.y = 0
    this.engine.gravity.x = 0
    this.canvas.addEventListener('pointerdown', (event) => this.onDown(event))
    this.canvas.addEventListener('pointermove', (event) => this.onMove(event))
    this.canvas.addEventListener('pointerup', (event) => this.onUp(event))
    this.canvas.addEventListener('pointercancel', () => this.onUp())
    window.addEventListener('pointerdown', () => this.sfx.unlock())
    window.addEventListener('resize', () => this.fit())
    this.layer.addEventListener('click', (event) => this.onUi(event))
    this.hud.addEventListener('click', (event) => this.onUi(event))
    this.fit()
    this.paint()
  }

  private onUi(event: Event): void {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!button) return
    this.onAct(button.dataset.act ?? '')
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
      this.leave()
      return
    }
    if (act === 'friend' || act === 'cpu') {
      this.start(act)
      return
    }
    if (act === 'again') {
      this.start(this.mode)
    }
  }

  private start(mode: Mode): void {
    this.leaveEngine()
    this.mode = mode
    this.table = freshTable()
    this.note = 'সাদা আগে মারবে। লাইন বরাবর সরাও, তারপর বোর্ডের দিকে টানো।'
    this.banner = ''
    this.winner = null
    this.loan = ''
    this.hinted = false
    this.view = 0
    this.staked = false
    if (mode === 'cpu') {
      const paid = stakeCoin(this.club)
      this.club = paid.club
      this.staked = true
      if (paid.loan) this.loan = 'কয়েন শেষ ছিল, মামা ৬টা ধার দিলেন।'
    }
    this.buildTable()
    this.screen = 'play'
    this.phase = 'place'
    this.paint()
    this.last = performance.now()
    this.loop(this.last)
  }

  private leave(): void {
    if (this.staked && this.winner === null) {
      this.club = refund(this.club)
      this.staked = false
    }
    this.screen = 'menu'
    cancelAnimationFrame(this.raf)
    this.paint()
  }

  private leaveEngine(): void {
    cancelAnimationFrame(this.raf)
    Composite.clear(this.engine.world, false)
    this.coins = []
    this.striker = null
  }

  private buildTable(): void {
    this.engine = Engine.create()
    this.engine.gravity.y = 0
    this.engine.gravity.x = 0
    const t = 50
    const walls = [
      Bodies.rectangle(SIZE / 2, IN_WALL, SIZE, t, wall),
      Bodies.rectangle(SIZE / 2, SIZE - IN_WALL, SIZE, t, wall),
      Bodies.rectangle(IN_WALL, SIZE / 2, t, SIZE, wall),
      Bodies.rectangle(SIZE - IN_WALL, SIZE / 2, t, SIZE, wall),
    ]
    Composite.add(this.engine.world, walls)
    for (const spot of rack()) this.addCoin(spot.kind, spot.x, spot.y)
    this.park(0)
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const speed = Math.hypot(pair.bodyA.velocity.x - pair.bodyB.velocity.x, pair.bodyA.velocity.y - pair.bodyB.velocity.y)
        if (speed > 0.8) this.sfx.clack(speed / 12)
      }
    })
  }

  private addCoin(kind: Kind, x: number, y: number): void {
    const radius = kind === 's' ? STRIKER_R : PIECE_R
    const body = Bodies.circle(x, y, radius, {
      restitution: kind === 's' ? 0.55 : 0.82,
      friction: 0.03,
      frictionAir: kind === 's' ? 0.02 : 0.026,
      density: kind === 's' ? 0.0048 : 0.0024,
      label: kind,
    })
    Composite.add(this.engine.world, body)
    if (kind === 's') this.striker = body
    else this.coins.push({ body, kind })
  }

  private park(seat: Seat): void {
    const x = SIZE / 2
    const y = baselineY(seat)
    if (!this.striker) this.addCoin('s', x, y)
    const striker = this.striker
    if (!striker) return
    Body.setStatic(striker, true)
    Body.setPosition(striker, { x, y })
    Body.setVelocity(striker, { x: 0, y: 0 })
    Body.setAngularVelocity(striker, 0)
    Body.setAngle(striker, 0)
    this.view = this.mode === 'friend' ? seat : 0
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop)
    if (this.screen !== 'play') return
    const dt = Math.min(32, now - this.last)
    this.last = now
    if (this.phase === 'fly') {
      Engine.update(this.engine, dt)
      this.capSpeed()
      this.sweep()
      this.watchSettle(now)
    }
    this.draw()
  }

  private capSpeed(): void {
    const bodies = [...this.coins.map((coin) => coin.body), ...(this.striker ? [this.striker] : [])]
    for (const body of bodies) {
      const speed = Math.hypot(body.velocity.x, body.velocity.y)
      if (speed > SPEED) Body.setVelocity(body, { x: (body.velocity.x / speed) * SPEED, y: (body.velocity.y / speed) * SPEED })
    }
  }

  private sweep(): void {
    for (const coin of [...this.coins]) {
      if (!inPocket(coin.body.position.x, coin.body.position.y)) continue
      this.fallen.push(coin.kind)
      Composite.remove(this.engine.world, coin.body)
      this.coins = this.coins.filter((item) => item !== coin)
      this.sfx.pocket()
    }
    if (this.striker && inPocket(this.striker.position.x, this.striker.position.y)) {
      this.fallen.push('s')
      Composite.remove(this.engine.world, this.striker)
      this.striker = null
      this.sfx.pocket()
    }
  }

  private watchSettle(now: number): void {
    if (now - this.shotAt < 280) return
    const moving = [...this.coins.map((coin) => coin.body), ...(this.striker ? [this.striker] : [])].some((body) => {
      if (body.isSleeping) return false
      return Math.hypot(body.velocity.x, body.velocity.y) > 0.22
    })
    this.still = moving ? 0 : this.still + 1
    if (this.still < 14 && now - this.shotAt < 5200) return
    this.finishShot()
  }

  private finishShot(): void {
    const previous = this.table.turn
    const outcome = settle(this.table, this.fallen)
    this.fallen = []
    this.table = outcome.table
    this.note = outcome.note
    if (outcome.foul) this.sfx.foul()
    for (const kind of outcome.back) {
      if (kind === 's') continue
      const spot = this.freeSpot()
      this.addCoin(kind, spot.x, spot.y)
    }
    if (outcome.winner !== null) {
      this.winner = outcome.winner
      this.phase = 'place'
      this.sfx.win()
      const humanWon = this.mode === 'cpu' ? outcome.winner === 0 : true
      if (this.mode === 'cpu') {
        if (humanWon) this.club = prize(this.club, 'carrom')
        this.staked = false
      }
      this.screen = 'end'
      this.paint()
      this.draw()
      return
    }
    this.phase = 'place'
    this.park(outcome.table.turn)
    this.banner = this.mode === 'friend' && outcome.table.turn !== previous ? (outcome.table.turn === 0 ? 'এখন সাদা' : 'ফোন ঘুরিয়ে — এখন কালো') : ''
    this.paint()
    if (this.mode === 'cpu' && outcome.table.turn === 1) {
      window.setTimeout(() => this.cpuShot(), 700)
    }
  }

  private cpuShot(): void {
    if (this.screen !== 'play' || this.table.turn !== 1 || this.phase !== 'place' || !this.striker) return
    const target = this.cpuTarget()
    const jitter = (Math.random() - 0.5) * 70
    const x = clamp(target.x + jitter, BASE_X0 + 10, BASE_X1 - 10)
    Body.setPosition(this.striker, { x, y: baselineY(1) })
    const angle = Math.atan2(target.y - baselineY(1), target.x - x) + (Math.random() - 0.5) * 0.16
    const power = 0.72 + Math.random() * 0.25
    this.fire(angle, power)
  }

  private cpuTarget(): { x: number; y: number } {
    const wantQueen = this.table.queen === 'board' && this.table.pocket.b >= 3 && Math.random() < 0.4
    const kinds: Kind[] = this.table.queen === 'p1' || !wantQueen ? ['b'] : ['b', 'q']
    const list = this.coins.filter((coin) => kinds.includes(coin.kind))
    if (!list.length) return { x: SIZE / 2, y: SIZE / 2 }
    return list
      .map((coin) => ({ x: coin.body.position.x, y: coin.body.position.y }))
      .sort((a, b) => this.pocketDist(a) - this.pocketDist(b))[0]!
  }

  private pocketDist(point: { x: number; y: number }): number {
    return Math.min(...[0, 1, 2, 3].map((index) => Math.hypot(point.x - (index % 2 === 0 ? 86 : SIZE - 86), point.y - (index < 2 ? 86 : SIZE - 86))))
  }

  private onDown(event: PointerEvent): void {
    if (this.screen !== 'play' || this.phase !== 'place' || !this.striker) return
    if (this.mode === 'cpu' && this.table.turn === 1) return
    const point = this.world(event)
    if (Math.hypot(point.x - this.striker.position.x, point.y - this.striker.position.y) > 64) return
    this.drag = 'slide'
    this.aim = null
    try {
      this.canvas.setPointerCapture(event.pointerId)
    } catch {
      /* pointer already gone */
    }
  }

  private onMove(event: PointerEvent): void {
    if (!this.drag || !this.striker || this.phase !== 'place') return
    const point = this.world(event)
    const into = this.table.turn === 0 ? baselineY(0) - point.y : point.y - baselineY(1)
    if (this.drag === 'slide' && into > 26) this.drag = 'aim'
    if (this.drag === 'slide') {
      Body.setPosition(this.striker, { x: clamp(point.x, BASE_X0 + 8, BASE_X1 - 8), y: baselineY(this.table.turn) })
      return
    }
    this.aim = point
  }

  private onUp(event?: PointerEvent): void {
    if (!this.drag || !this.striker) return
    const point = event ? this.world(event) : this.aim
    const aiming = this.drag === 'aim' && point
    this.drag = null
    if (!aiming || !point) {
      this.aim = null
      return
    }
    const from = this.striker.position
    const dist = Math.hypot(point.x - from.x, point.y - from.y)
    if (dist < 28) {
      this.aim = null
      return
    }
    const angle = Math.atan2(point.y - from.y, point.x - from.x)
    this.fire(angle, Math.min(1, dist / 210))
  }

  private fire(angle: number, power: number): void {
    if (!this.striker) return
    this.hinted = true
    this.aim = null
    this.phase = 'fly'
    this.fallen = []
    this.still = 0
    this.shotAt = performance.now()
    this.banner = ''
    for (const coin of this.coins) Sleeping.set(coin.body, false)
    Body.setStatic(this.striker, false)
    Sleeping.set(this.striker, false)
    const speed = 9 + power * 15
    Body.setVelocity(this.striker, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
    this.sfx.flick(power)
    this.paint()
  }

  private freeSpot(): { x: number; y: number } {
    const taken = this.coins.map((coin) => ({ x: coin.body.position.x, y: coin.body.position.y }))
    for (let ring = 0; ring < 7; ring += 1) {
      const dist = 46 + ring * 32
      const steps = 8 + ring * 2
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2
        const x = SIZE / 2 + Math.cos(angle) * dist
        const y = SIZE / 2 + Math.sin(angle) * dist
        if (taken.every((spot) => Math.hypot(spot.x - x, spot.y - y) > PIECE_R * 2 + 4)) return { x, y }
      }
    }
    return { x: SIZE / 2, y: SIZE / 2 + 120 }
  }

  private world(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    let x = ((event.clientX - rect.left) / rect.width) * SIZE
    let y = ((event.clientY - rect.top) / rect.height) * SIZE
    if (this.view === 1) {
      x = SIZE - x
      y = SIZE - y
    }
    return { x, y }
  }

  private fit(): void {
    const pad = 8
    const max = Math.min(window.innerWidth - pad, window.innerHeight - pad, 860)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.style.width = `${max}px`
    this.canvas.style.height = `${max}px`
    this.canvas.width = Math.floor(max * dpr)
    this.canvas.height = Math.floor(max * dpr)
    this.scale = (max * dpr) / SIZE
    this.offsetX = (window.innerWidth - max) / 2
    this.offsetY = (window.innerHeight - max) / 2
    this.canvas.style.left = `${this.offsetX}px`
    this.canvas.style.top = `${this.offsetY}px`
    this.draw()
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx || this.screen === 'menu' || this.screen === 'how') return
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.save()
    if (this.view === 1) {
      ctx.translate(SIZE / 2, SIZE / 2)
      ctx.rotate(Math.PI)
      ctx.translate(-SIZE / 2, -SIZE / 2)
    }
    drawBoard(ctx, this.coins, this.striker, this.phase === 'place' ? this.aim : null)
    ctx.restore()
    if (!this.hinted && this.phase === 'place' && this.screen === 'play') {
      ctx.fillStyle = 'rgba(60, 36, 16, 0.82)'
      ctx.font = '700 26px "Hind Siliguri", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('স্ট্রাইকার সরাও, বোর্ডের দিকে টানো', SIZE / 2, SIZE * 0.46)
    }
  }

  private paint(): void {
    const queen =
      this.table.queen === 'board'
        ? 'রাণী বোর্ডে'
        : this.table.queen === 'p0'
          ? 'রাণী ঢাকতে হবে · সাদা'
          : this.table.queen === 'p1'
            ? 'রাণী ঢাকতে হবে · কালো'
            : this.table.queen === 'c0'
              ? 'রাণী সাদার'
              : 'রাণী কালোর'
    this.hud.innerHTML =
      this.screen === 'play' || this.screen === 'end'
        ? `<div class="bar">
            <div><b>সাদা ${bn(this.table.pocket.w)}/৯</b><span>কালো ${bn(this.table.pocket.b)}/৯</span></div>
            <div class="queen">${queen}</div>
            <div class="bar-actions">${this.mute()}<button type="button" data-act="menu">হোম</button></div>
          </div>
          <p class="note">${esc(this.note)}</p>
          ${this.banner ? `<p class="banner">${esc(this.banner)}</p>` : ''}`
        : ''
    this.layer.innerHTML = this.screen === 'menu' ? this.menuHtml() : this.screen === 'how' ? this.howHtml() : this.screen === 'end' ? this.endHtml() : ''
    this.canvas.hidden = this.screen === 'menu' || this.screen === 'how'
  }

  private menuHtml(): string {
    return `<div class="veil"><div class="card">
      <p class="eyebrow">পাড়ার ক্লাব</p>
      <h1>ক্যারাম</h1>
      <p class="sub">Carrom</p>
      <p class="lead">স্ট্রাইকার টেনে গুটি ফেলো। নিজের রং, আর লাল রাণী ঢেকে জিততে হয়। ক্লাবে খেলতে ১ কয়েন, জিতলে ২।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="cpu">ক্লাবে খেলো · ১ কয়েন</button>
        <button type="button" class="btn ghost" data-act="friend">বন্ধুর সাথে · ফ্রি</button>
        <button type="button" class="texty" data-act="how">নিয়ম</button>
      </div>
      <p class="fine">কয়েন ${bn(this.club.coins)} · জয় ${bn(this.club.wins.carrom)}</p>
    </div></div>`
  }

  private howHtml(): string {
    return `<div class="veil"><div class="card">
      <p class="eyebrow">নিয়ম</p>
      <h2>যেভাবে ক্লাবে খেলে</h2>
      <ul>
        <li>নিজের গুটি পড়লে আবার মার।</li>
        <li>লাল রাণী পড়লে পরের শটে নিজের একটা গুটি দিয়ে ঢাকো। না পারলে রাণী ফেরত।</li>
        <li>স্ট্রাইকার পড়লে ফাউল — তোমার একটা গুটি উঠে আসে।</li>
        <li>রাণী ঢাকা ছাড়া শেষ গুটি ফেলা যায় না।</li>
      </ul>
      <button type="button" class="btn" data-act="menu">ফিরে যাও</button>
    </div></div>`
  }

  private endHtml(): string {
    const name = this.winner === 0 ? 'সাদা' : 'কালো'
    const coin =
      this.mode === 'cpu'
        ? this.winner === 0
          ? `জিতেছো। কয়েন এখন ${bn(this.club.coins)}।`
          : `ক্লাব জিতেছে। কয়েন এখন ${bn(this.club.coins)}।`
        : 'বন্ধুদের খেলা, কয়েন লাগেনি।'
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
}

const IN_WALL = 58
const wall = { isStatic: true, restitution: 0.42, friction: 0.08 }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
