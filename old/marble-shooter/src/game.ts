import { Bodies, Body, Composite, Engine, Events, Sleeping, type Body as MatterBody } from 'matter-js'
import {
  CLASSIC,
  LEVELS,
  QUICK,
  type Spot,
} from './levels'
import { SHOOTERS, drawAim, drawCourt, drawMarble, makeNoise, swatch, type Swatch } from './draw'
import { iconPause, iconSound } from './icons'
import { Sfx } from './sfx'
import { bn, esc } from './text'
import {
  MAX_PULL,
  MAX_SPEED,
  MIN_PULL,
  P1,
  P2,
  RING,
  SHOOTER_R,
  TARGET_R,
  WORLD_H,
  WORLD_W,
} from './world'

const SAVE_KEY = 'marble-shooter-save-v1'

type Mode = 'solo' | 'duel'
type Phase = 'aim' | 'rolling'
type Screen =
  | 'menu'
  | 'how'
  | 'levels'
  | 'duelsetup'
  | 'play'
  | 'pause'
  | 'soloClear'
  | 'soloFail'
  | 'matchEnd'

interface Marble {
  body: MatterBody
  kind: 'target' | 'shooter'
  colorIndex: number
  owner: 0 | 1
  radius: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  r: number
  color: string
}

interface Floater {
  x: number
  y: number
  text: string
  life: number
}

interface SaveData {
  stars?: number[]
  muted?: boolean
}

export class MarbleGame {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hudEl: HTMLElement
  private readonly coachEl: HTMLElement
  private readonly powerEl: HTMLElement
  private readonly powerCover: HTMLElement
  private readonly toastEl: HTMLElement
  private readonly overlayEl: HTMLElement
  private readonly sfx = new Sfx()
  private readonly engine: ReturnType<typeof Engine.create>

  private dpr = 1
  private viewScale = 1
  private viewX = 0
  private viewY = 0
  private viewW = 0
  private viewH = 0
  private noise: CanvasPattern | null = null

  private screen: Screen = 'menu'
  private howBack: 'menu' | 'pause' = 'menu'
  private mode: Mode = 'solo'
  private phase: Phase = 'aim'
  private levelIndex = 0
  private shotsLeft = 0
  private score = 0
  private stars: number[] = []
  private turn: 0 | 1 = 0
  private names: [string, string] = ['খেলোয়াড় ১', 'খেলোয়াড় ২']
  private scores: [number, number] = [0, 0]
  private duelQuick = true
  private sudden = false
  private lastEarned = 0
  private lastUsed = 0
  private muted = false

  private marbles: Marble[] = []
  private particles: Particle[] = []
  private floaters: Floater[] = []

  private dragging = false
  private pointerId = -1
  private pullX = 0
  private pullY = 0
  private pullDist = 0
  private hasShotOnce = false

  private flip = 0
  private shake = 0
  private stillFrames = 0
  private shotMs = 0
  private menuT = 0
  private last = 0
  private acc = 0
  private toastTimer = 0

  constructor(app: HTMLElement) {
    const canvas = app.querySelector<HTMLCanvasElement>('#board')
    const hud = app.querySelector<HTMLElement>('#hud')
    const coach = app.querySelector<HTMLElement>('#coach')
    const power = app.querySelector<HTMLElement>('#power')
    const cover = app.querySelector<HTMLElement>('#power .meter i')
    const toast = app.querySelector<HTMLElement>('#toast')
    const overlay = app.querySelector<HTMLElement>('#overlay')
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !hud || !coach || !power || !cover || !toast || !overlay) {
      throw new Error('Marble Shooter markup is incomplete')
    }

    this.canvas = canvas
    this.ctx = ctx
    this.hudEl = hud
    this.coachEl = coach
    this.powerEl = power
    this.powerCover = cover
    this.toastEl = toast
    this.overlayEl = overlay

    this.engine = Engine.create({ enableSleeping: true, gravity: { x: 0, y: 0, scale: 0 } })
    this.engine.positionIterations = 10
    this.buildWalls()
    this.bindCollision()
    this.load()
    this.bindInput(app)
    this.layout()
    new ResizeObserver(() => this.layout()).observe(app)
    this.go('menu')
    requestAnimationFrame(this.frame)
  }

  private frame = (now: number) => {
    if (this.last === 0) this.last = now
    const dt = Math.min(34, now - this.last)
    this.last = now
    this.menuT += dt / 1000
    this.shake *= Math.exp(-dt / 140)
    if (this.shake < 0.04) this.shake = 0

    if (this.screen === 'play' && this.phase === 'rolling') {
      this.acc += dt
      let steps = 0
      while (this.acc >= 16.666 && steps < 4) {
        Engine.update(this.engine, 16.666)
        this.acc -= 16.666
        steps += 1
      }
      this.trackSettle(dt)
    } else {
      this.acc = 0
    }

    if (this.screen !== 'pause') this.fadeFx(dt)

    const goal = this.flipGoal()
    this.flip += (goal - this.flip) * (1 - Math.exp(-dt / 160))
    if (Math.abs(this.flip - goal) < 0.001) this.flip = goal

    this.draw()
    this.placeCoach()
    requestAnimationFrame(this.frame)
  }

  private flipGoal(): number {
    const live =
      this.screen === 'play' ||
      this.screen === 'pause' ||
      this.screen === 'matchEnd' ||
      (this.screen === 'how' && this.howBack === 'pause')
    return live && this.mode === 'duel' ? this.turn : 0
  }

  private bindInput(app: HTMLElement): void {
    app.addEventListener('pointerdown', () => this.sfx.unlock())
    app.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
      if (!btn || btn.hasAttribute('disabled')) return
      this.onAct(btn.dataset.act ?? '', btn)
    })
    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event))
    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event))
    this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event))
    this.canvas.addEventListener('pointercancel', () => this.cancelDrag())
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      if (this.screen === 'play') this.go('pause')
      else if (this.screen === 'pause') this.go('play')
    })
    window.addEventListener('resize', () => this.layout())
  }

  private onAct(act: string, btn: HTMLElement): void {
    if (act !== 'mute') this.sfx.tap()
    switch (act) {
      case 'levels':
        this.go('levels')
        break
      case 'duel':
        this.go('duelsetup')
        break
      case 'how':
        this.howBack = this.screen === 'pause' ? 'pause' : 'menu'
        this.go('how')
        break
      case 'back':
        this.go(this.howBack)
        break
      case 'menu':
        this.go('menu')
        break
      case 'level':
        this.startSolo(Number(btn.dataset.i ?? 0))
        break
      case 'format':
        this.duelQuick = btn.dataset.quick === '1'
        this.overlayEl.querySelectorAll<HTMLElement>('[data-act="format"]').forEach((el) => {
          el.classList.toggle('on', el === btn)
        })
        break
      case 'start-duel':
        this.readNames()
        this.startDuel()
        break
      case 'pause':
        if (this.screen === 'play') this.go('pause')
        break
      case 'resume':
        this.go('play')
        break
      case 'restart':
        if (this.mode === 'solo') this.startSolo(this.levelIndex)
        else this.startDuel()
        break
      case 'next':
        if (this.levelIndex < LEVELS.length - 1) this.startSolo(this.levelIndex + 1)
        else this.go('levels')
        break
      case 'mute':
        this.muted = !this.muted
        this.sfx.muted = this.muted
        this.save()
        if (!this.muted) this.sfx.tap()
        this.paintHud()
        this.paintOverlay()
        break
      default:
        break
    }
  }

  private startSolo(index: number): void {
    const level = LEVELS[index]
    if (!level || !this.unlocked(index)) return
    this.mode = 'solo'
    this.levelIndex = index
    this.score = 0
    this.shotsLeft = level.shots
    this.sudden = false
    this.turn = 0
    this.phase = 'aim'
    this.loadLayout(level.layout)
    this.spawnShooter(0)
    this.go('play')
    this.toast(`${level.name} · ৩ তারকা ${bn(level.par)} শটে`)
  }

  private startDuel(): void {
    this.mode = 'duel'
    this.scores = [0, 0]
    this.turn = 0
    this.sudden = false
    this.phase = 'aim'
    this.loadLayout(this.duelQuick ? QUICK : CLASSIC)
    this.spawnShooter(0)
    this.go('play')
    this.toast(`পালা: ${this.names[0]}`, 'center')
  }

  private readNames(): void {
    const first = this.overlayEl.querySelector<HTMLInputElement>('#n1')?.value.trim()
    const second = this.overlayEl.querySelector<HTMLInputElement>('#n2')?.value.trim()
    this.names = [first || 'খেলোয়াড় ১', second || 'খেলোয়াড় ২']
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.screen !== 'play' || this.phase !== 'aim' || !this.flipSettled()) return
    const shooter = this.shooter()
    if (!shooter) return
    const world = this.toWorld(event.clientX, event.clientY)
    const reach = Math.max(shooter.radius + 36, 64 / this.viewScale)
    const dx = world.x - shooter.body.position.x
    const dy = world.y - shooter.body.position.y
    if (dx * dx + dy * dy > reach * reach) return
    this.dragging = true
    this.pointerId = event.pointerId
    this.canvas.classList.add('aiming')
    this.canvas.setPointerCapture(event.pointerId)
    this.updatePull(world, shooter)
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.pointerId) return
    const shooter = this.shooter()
    if (!shooter) return
    this.updatePull(this.toWorld(event.clientX, event.clientY), shooter)
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.pointerId) return
    this.shoot()
  }

  private cancelDrag(): void {
    this.dragging = false
    this.pointerId = -1
    this.pullDist = 0
    this.canvas.classList.remove('aiming')
    this.powerEl.hidden = true
  }

  private updatePull(world: { x: number; y: number }, shooter: Marble): void {
    this.pullX = world.x - shooter.body.position.x
    this.pullY = world.y - shooter.body.position.y
    this.pullDist = Math.hypot(this.pullX, this.pullY)
    const shown = Math.min(1, this.pullDist / MAX_PULL)
    this.powerEl.hidden = false
    this.powerCover.style.width = `${(1 - shown) * 100}%`
  }

  private shoot(): void {
    const shooter = this.shooter()
    const dist = this.pullDist
    this.cancelDrag()
    if (!shooter || dist < MIN_PULL || this.phase !== 'aim') return
    const shown = Math.min(dist, MAX_PULL)
    const speed = (shown / MAX_PULL) * MAX_SPEED
    const ux = this.pullX / dist
    const uy = this.pullY / dist
    Body.setStatic(shooter.body, false)
    for (const marble of this.marbles) Sleeping.set(marble.body, false)
    Body.setVelocity(shooter.body, { x: -ux * speed, y: -uy * speed })
    Body.setAngularVelocity(shooter.body, (Math.random() - 0.5) * 0.15)
    this.phase = 'rolling'
    this.stillFrames = 0
    this.shotMs = 0
    this.hasShotOnce = true
    this.sfx.shoot(shown / MAX_PULL)
    this.shake = 1.6
  }

  private trackSettle(dt: number): void {
    this.shotMs += dt
    if (this.shotMs > 900) {
      for (const marble of this.marbles) {
        const speed = Math.hypot(marble.body.velocity.x, marble.body.velocity.y)
        if (speed > 0 && speed < 1.15) {
          Body.setVelocity(marble.body, {
            x: marble.body.velocity.x * 0.86,
            y: marble.body.velocity.y * 0.86,
          })
        }
      }
    }
    if (this.shotMs < 260) return
    const moving = this.marbles.some(
      (marble) => Math.hypot(marble.body.velocity.x, marble.body.velocity.y) > 0.28,
    )
    this.stillFrames = moving ? 0 : this.stillFrames + 1
    if (this.stillFrames > 16 || this.shotMs > 6200) this.resolve()
  }

  private resolve(): void {
    if (this.phase !== 'rolling') return
    this.phase = 'aim'
    const shooter = this.shooter()
    if (!shooter) return

    const shooterOut = this.isOutside(shooter)
    const outgoing = this.marbles.filter((marble) => marble.kind === 'target' && this.isOutside(marble))
    const got = outgoing.length

    for (const marble of outgoing) {
      const look = swatch(marble.colorIndex)
      this.burst(marble.body.position.x, marble.body.position.y, look.body, 14)
      this.floaters.push({
        x: marble.body.position.x,
        y: marble.body.position.y,
        text: '+১',
        life: 1,
      })
      this.removeMarble(marble)
    }
    if (got > 0) {
      this.shake = Math.min(12, 3 + got * 2.4)
      this.sfx.pocket()
    }

    if (this.mode === 'solo') {
      this.resolveSolo(got, shooterOut)
      return
    }
    this.resolveDuel(got, shooterOut)
  }

  private resolveSolo(got: number, shooterOut: boolean): void {
    const clean = got > 0 && shooterOut
    this.score += got * 100 + Math.max(0, got - 1) * 80 + (clean ? 40 : 0)
    this.shotsLeft -= 1
    const left = this.targetsLeft()
    if (left === 0) {
      this.onSoloClear()
      return
    }
    if (this.shotsLeft <= 0) {
      this.onSoloFail()
      return
    }
    if (got === 0) this.toast('মিস!')
    else if (got === 1) this.toast(clean ? 'নিখুঁত শট!' : 'গুটি বাইরে!')
    else this.toast(`${bn(got)}টা একসাথে!`)
    this.spawnShooter(0)
    this.paintHud()
  }

  private resolveDuel(got: number, shooterOut: boolean): void {
    this.scores[this.turn] += got
    const left = this.targetsLeft()
    if (left === 0) {
      if (this.scores[0] === this.scores[1] && !this.sudden) {
        this.turn = this.turn === 0 ? 1 : 0
        this.beginSudden()
        return
      }
      this.finishMatch()
      return
    }

    const again = got > 0 && shooterOut
    if (again) {
      this.toast(got > 1 ? `${bn(got)}টা! আবার শট` : 'আবার শট!')
    } else {
      this.turn = this.turn === 0 ? 1 : 0
      const prefix = got > 0 && !shooterOut ? 'শুটার আটকেছে · ' : got === 0 ? 'মিস · ' : ''
      this.toast(`${prefix}পালা: ${this.names[this.turn]}`, 'center')
    }
    this.spawnShooter(this.turn)
    this.paintHud()
  }

  private beginSudden(): void {
    this.sudden = true
    this.spawnShooter(this.turn)
    this.makeMarble(RING.x, RING.y, 'target', 2)
    this.phase = 'aim'
    this.toast('সমান সমান! শেষ গুটি', 'center')
    this.paintHud()
  }

  private onSoloClear(): void {
    const level = LEVELS[this.levelIndex]
    if (!level) return
    const used = level.shots - this.shotsLeft
    const earned = used <= level.par ? 3 : used <= level.par + 2 ? 2 : 1
    this.lastEarned = earned
    this.lastUsed = used
    this.stars[this.levelIndex] = Math.max(this.stars[this.levelIndex] ?? 0, earned)
    this.save()
    this.sfx.win()
    if (earned === 3) this.burst(RING.x, RING.y, '#e3a31a', 28)
    this.go('soloClear')
  }

  private onSoloFail(): void {
    this.sfx.fail()
    this.go('soloFail')
  }

  private finishMatch(): void {
    this.sfx.win()
    this.burst(RING.x, RING.y, '#fff6e8', 30)
    this.go('matchEnd')
  }

  private loadLayout(layout: Spot[]): void {
    this.clearDynamic()
    for (const spot of layout) {
      this.makeMarble(RING.x + spot.x * RING.r, RING.y + spot.y * RING.r, 'target', spot.c)
    }
  }

  private makeMarble(x: number, y: number, kind: Marble['kind'], colorIndex: number, owner: 0 | 1 = 0): Marble {
    const radius = kind === 'shooter' ? SHOOTER_R : TARGET_R
    const body = Bodies.circle(x, y, radius, {
      restitution: kind === 'shooter' ? 0.52 : 0.82,
      friction: 0.02,
      frictionAir: 0.016,
      density: kind === 'shooter' ? 0.008 : 0.004,
      slop: 0.01,
      sleepThreshold: 28,
    })
    Body.setAngle(body, Math.random() * Math.PI * 2)
    Composite.add(this.engine.world, body)
    const marble: Marble = { body, kind, colorIndex, owner, radius }
    this.marbles.push(marble)
    return marble
  }

  private spawnShooter(player: 0 | 1): void {
    const existing = this.shooter()
    if (existing) this.removeMarble(existing)
    const home = player === 0 ? P1 : P2
    const marble = this.makeMarble(home.x, home.y, 'shooter', player, player)
    Body.setStatic(marble.body, true)
  }

  private removeMarble(marble: Marble): void {
    Composite.remove(this.engine.world, marble.body)
    this.marbles = this.marbles.filter((item) => item !== marble)
  }

  private clearDynamic(): void {
    for (const marble of this.marbles) Composite.remove(this.engine.world, marble.body)
    this.marbles = []
    this.particles = []
    this.floaters = []
  }

  private buildWalls(): void {
    const t = 140
    const opt = { isStatic: true, restitution: 0.35, friction: 0.04 }
    Composite.add(this.engine.world, [
      Bodies.rectangle(WORLD_W / 2, -t / 2, WORLD_W + t * 2, t, opt),
      Bodies.rectangle(WORLD_W / 2, WORLD_H + t / 2, WORLD_W + t * 2, t, opt),
      Bodies.rectangle(-t / 2, WORLD_H / 2, t, WORLD_H + t * 2, opt),
      Bodies.rectangle(WORLD_W + t / 2, WORLD_H / 2, t, WORLD_H + t * 2, opt),
    ])
  }

  private bindCollision(): void {
    Events.on(this.engine, 'collisionStart', (event) => {
      if (this.screen !== 'play' || this.phase !== 'rolling') return
      for (const pair of event.pairs) {
        const rel = Math.hypot(
          pair.bodyA.velocity.x - pair.bodyB.velocity.x,
          pair.bodyA.velocity.y - pair.bodyB.velocity.y,
        )
        if (rel < 2.2) continue
        this.sfx.clack(Math.min(1, rel / 16))
        if (rel < 7) continue
        const hit = pair.collision.supports[0]
        const x = hit?.x ?? (pair.bodyA.position.x + pair.bodyB.position.x) / 2
        const y = hit?.y ?? (pair.bodyA.position.y + pair.bodyB.position.y) / 2
        this.burst(x, y, '#fff4e4', 5)
      }
    })
  }

  private shooter(): Marble | undefined {
    return this.marbles.find((marble) => marble.kind === 'shooter')
  }

  private targetsLeft(): number {
    return this.marbles.filter((marble) => marble.kind === 'target').length
  }

  private isOutside(marble: Marble): boolean {
    const dx = marble.body.position.x - RING.x
    const dy = marble.body.position.y - RING.y
    return Math.hypot(dx, dy) > RING.r
  }

  private unlocked(index: number): boolean {
    return index === 0 || (this.stars[index - 1] ?? 0) > 0
  }

  private flipSettled(): boolean {
    return Math.abs(this.flip - this.flipGoal()) < 0.02
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 50 + Math.random() * 180
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        r: 1.6 + Math.random() * 2.4,
        color,
      })
    }
    if (this.particles.length > 120) this.particles.splice(0, this.particles.length - 120)
  }

  private fadeFx(dt: number): void {
    this.particles = this.particles.filter((particle) => {
      particle.x += (particle.vx * dt) / 1000
      particle.y += (particle.vy * dt) / 1000
      particle.life -= dt / 480
      return particle.life > 0
    })
    this.floaters = this.floaters.filter((floater) => {
      floater.life -= dt / 700
      return floater.life > 0
    })
  }

  private go(screen: Screen): void {
    this.screen = screen
    this.cancelDrag()
    if (screen === 'menu') {
      this.flip = 0
      this.clearDynamic()
    }
    this.paintOverlay()
    this.paintHud()
  }

  private paintHud(): void {
    const show =
      this.screen === 'play' ||
      this.screen === 'pause' ||
      this.screen === 'soloClear' ||
      this.screen === 'soloFail' ||
      this.screen === 'matchEnd'
    if (!show) {
      this.hudEl.innerHTML = ''
      return
    }
    const sound = `<button type="button" class="icon" data-act="mute" aria-label="শব্দ" aria-pressed="${this.muted}">${iconSound(!this.muted)}</button>`
    const pause =
      this.screen === 'play'
        ? `<button type="button" class="icon" data-act="pause" aria-label="থামো">${iconPause()}</button>`
        : ''
    const main =
      this.mode === 'solo'
        ? `<div class="hud-stats">
            <div><small>ধাপ</small><b>${bn(this.levelIndex + 1)}/${bn(LEVELS.length)}</b></div>
            <div><small>শট</small><b>${bn(this.shotsLeft)}</b></div>
            <div><small>গুটি</small><b>${bn(this.targetsLeft())}</b></div>
            <div><small>স্কোর</small><b>${bn(this.score)}</b></div>
          </div>`
        : `<div class="vs">
            <div class="who ${this.turn === 0 ? 'on' : ''}"><small>${esc(this.names[0])}</small><b>${bn(this.scores[0])}</b></div>
            <div class="who ${this.turn === 1 ? 'on' : ''}"><small>${esc(this.names[1])}</small><b>${bn(this.scores[1])}</b></div>
          </div>`
    this.hudEl.innerHTML = `<div class="hud-bar">${main}<div class="hud-actions">${sound}${pause}</div></div>`
  }

  private paintOverlay(): void {
    if (this.screen === 'play') {
      this.overlayEl.classList.add('is-hidden')
      this.overlayEl.innerHTML = ''
      return
    }
    this.overlayEl.classList.remove('is-hidden')
    this.overlayEl.innerHTML = this.overlayHtml()
  }

  private overlayHtml(): string {
    switch (this.screen) {
      case 'menu':
        return this.menuHtml()
      case 'how':
        return this.howHtml()
      case 'levels':
        return this.levelsHtml()
      case 'duelsetup':
        return this.duelHtml()
      case 'pause':
        return this.pauseHtml()
      case 'soloClear':
        return this.clearHtml()
      case 'soloFail':
        return this.failHtml()
      case 'matchEnd':
        return this.matchHtml()
      default:
        return ''
    }
  }

  private menuHtml(): string {
    const total = this.stars.reduce((sum, value) => sum + (value || 0), 0)
    return `<div class="card">
      <div class="card-top">
        <div>
          <p class="eyebrow">উঠোনের খেলা</p>
          <h1>মার্বেল</h1>
          <p class="sub">Marble Shooter</p>
        </div>
        <button type="button" class="icon" data-act="mute" aria-label="শব্দ" aria-pressed="${this.muted}">${iconSound(!this.muted)}</button>
      </div>
      <p class="lead">খড়ির গোলের ভিতর থেকে কাচের গুটি বের করো। একা ধাপ ধাপ, অথবা একই ফোনে বন্ধুর সঙ্গে।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="levels">একা খেলো</button>
        <button type="button" class="btn ghost" data-act="duel">দুইজনে খেলো</button>
        <button type="button" class="texty" data-act="how">কীভাবে খেলবে</button>
      </div>
      <p class="fine">তারা ${bn(total)} / ${bn(LEVELS.length * 3)}</p>
    </div>`
  }

  private howHtml(): string {
    return `<div class="card">
      <p class="eyebrow">নিয়ম</p>
      <h2>কীভাবে খেলবে</h2>
      <div class="demo" aria-hidden="true">
        <i class="ring"></i>
        <i class="guti a"></i>
        <i class="guti b"></i>
        <i class="arrow"></i>
        <i class="shooter"></i>
        <i class="finger"></i>
      </div>
      <p class="caption">নিচের দিকে টানো — সোনালি তীরের দিকে যাবে</p>
      <ol class="steps">
        <li><span>১</span><div><b>শুটার ধরো</b><p>নিচের বড় মার্বেলটা পেছনের দিকে টানো।</p></div></li>
        <li><span>২</span><div><b>ছেড়ে দাও</b><p>যত লম্বা টান, তত জোর। তীর দেখে বোঝা যাবে কোন দিকে যাবে।</p></div></li>
        <li><span>৩</span><div><b>গুটি বের করো</b><p>খড়ির দাগ পেরোলে গুটি ধরা পড়ে। মাঝখান বাইরে হলেই বাইরে।</p></div></li>
        <li><span>৪</span><div><b>দুইজনে</b><p>গুটি বেরিয়ে শুটারও বাইরে থাকলে আরেকবার। শুটার গোলের ভিতরে আটকালে পালা শেষ। ফোনটা বন্ধুকে ঘুরিয়ে দাও।</p></div></li>
      </ol>
      <p class="note">একা খেলায় শট সীমিত। কম শটে সব গুটি বের করলে বেশি তারা।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="back">ফিরে যাও</button>
      </div>
    </div>`
  }

  private levelsHtml(): string {
    const cards = LEVELS.map((level, index) => {
      const open = this.unlocked(index)
      return `<button type="button" class="lvl ${open ? '' : 'locked'}" data-act="level" data-i="${index}" ${open ? '' : 'disabled'}>
        <b>${bn(index + 1)}</b>
        <small>${level.name}</small>
        <span class="mini">${this.starRow(this.stars[index] ?? 0)}</span>
      </button>`
    }).join('')
    return `<div class="card">
      <p class="eyebrow">একা খেলা</p>
      <h2>কোন ধাপ?</h2>
      <p class="lead">আগের ধাপ শেষ করলে পরেরটা খুলবে।</p>
      <div class="grid">${cards}</div>
      <button type="button" class="texty" data-act="menu">হোম</button>
    </div>`
  }

  private duelHtml(): string {
    return `<div class="card">
      <p class="eyebrow">একই ফোন</p>
      <h2>দুইজনে</h2>
      <p class="lead">পালা বদলালে ফোনটা উল্টে বন্ধুকে দাও। শুটার সবসময় নিচে থাকবে।</p>
      <label class="field">প্রথম খেলোয়াড়
        <input id="n1" maxlength="14" value="${esc(this.names[0])}" autocomplete="off" />
      </label>
      <label class="field">দ্বিতীয় খেলোয়াড়
        <input id="n2" maxlength="14" value="${esc(this.names[1])}" autocomplete="off" />
      </label>
      <div class="chips">
        <button type="button" data-act="format" data-quick="1" class="chip ${this.duelQuick ? 'on' : ''}">দ্রুত · ৭ গুটি</button>
        <button type="button" data-act="format" data-quick="0" class="chip ${this.duelQuick ? '' : 'on'}">ক্লাসিক · ১৩ গুটি</button>
      </div>
      <div class="stack">
        <button type="button" class="btn" data-act="start-duel">খেলা শুরু</button>
        <button type="button" class="texty" data-act="menu">ফিরে যাও</button>
      </div>
    </div>`
  }

  private pauseHtml(): string {
    return `<div class="card">
      <p class="eyebrow">বিরতি</p>
      <h2>থামানো আছে</h2>
      <div class="stack">
        <button type="button" class="btn" data-act="resume">চালিয়ে যাও</button>
        <button type="button" class="btn ghost" data-act="restart">আবার শুরু</button>
        <button type="button" class="btn ghost" data-act="how">নিয়ম</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div>`
  }

  private clearHtml(): string {
    const level = LEVELS[this.levelIndex]
    const praise = this.lastEarned === 3 ? 'দারুণ!' : this.lastEarned === 2 ? 'ভালো খেলেছ' : 'ধাপ শেষ'
    const next =
      this.levelIndex < LEVELS.length - 1
        ? '<button type="button" class="btn" data-act="next">পরের ধাপ</button>'
        : '<button type="button" class="btn" data-act="levels">সব ধাপ</button>'
    return `<div class="card">
      <p class="eyebrow">${praise}</p>
      <h2>${level?.name ?? 'শেষ'}</h2>
      <div class="bigstars">${this.starRow(this.lastEarned)}</div>
      <p class="stat">স্কোর ${bn(this.score)} · শট ${bn(this.lastUsed)}</p>
      <div class="row">
        ${next}
        <button type="button" class="btn ghost" data-act="restart">আবার</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div>`
  }

  private failHtml(): string {
    return `<div class="card">
      <p class="eyebrow">আরেকবার</p>
      <h2>শট শেষ</h2>
      <p class="lead">গোলের ভিতরে এখনও গুটি আছে। আরেকটু কাছ থেকে মারো।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="restart">আবার চেষ্টা</button>
        <button type="button" class="btn ghost" data-act="levels">ধাপের তালিকা</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div>`
  }

  private matchHtml(): string {
    const winner = this.scores[0] === this.scores[1] ? -1 : this.scores[0] > this.scores[1] ? 0 : 1
    const title = winner === -1 ? 'সমান সমান' : `${this.names[winner]} জিতেছে`
    return `<div class="card">
      <p class="eyebrow">${this.sudden ? 'শেষ গুটির পর' : 'ম্যাচ শেষ'}</p>
      <h2>${esc(title)}</h2>
      <div class="scoreline">
        <div><b>${bn(this.scores[0])}</b><small>${esc(this.names[0])}</small></div>
        <div><b>${bn(this.scores[1])}</b><small>${esc(this.names[1])}</small></div>
      </div>
      <div class="stack">
        <button type="button" class="btn" data-act="restart">আবার খেলো</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div>`
  }

  private starRow(count: number): string {
    return [1, 2, 3].map((star) => `<em class="${star <= count ? 'on' : ''}">★</em>`).join('')
  }

  private toast(text: string, where: 'bottom' | 'center' = 'bottom'): void {
    const el = this.toastEl
    el.textContent = text
    el.dataset.where = where
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 1500)
  }

  private layout(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.viewW = rect.width
    this.viewH = rect.height
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr))
    this.viewScale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H)
    this.viewX = (rect.width - WORLD_W * this.viewScale) / 2
    this.viewY = (rect.height - WORLD_H * this.viewScale) / 2
    const boardWidth = WORLD_W * this.viewScale
    this.hudEl.style.left = `${this.viewX}px`
    this.hudEl.style.width = `${boardWidth}px`
  }

  private draw(): void {
    if (this.viewW < 2 || this.viewH < 2) return
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = '#c48a52'
    ctx.fillRect(0, 0, this.viewW, this.viewH)

    ctx.save()
    ctx.translate(this.viewX, this.viewY)
    ctx.scale(this.viewScale, this.viewScale)
    const jx = Math.sin(this.menuT * 42) * this.shake
    const jy = Math.cos(this.menuT * 37) * this.shake
    ctx.translate(jx, jy)
    ctx.translate(RING.x, RING.y)
    ctx.rotate(this.flip * Math.PI)
    ctx.translate(-RING.x, -RING.y)

    this.ensureNoise()
    drawCourt(ctx, this.noise, this.knuckles())

    if (this.showPhysics()) this.drawLive(ctx)
    else this.drawMenuMarbles(ctx)

    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life)
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.font = '700 26px "Hind Siliguri", "Kohinoor Bangla", sans-serif'
    ctx.textAlign = 'center'
    for (const floater of this.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life)
      ctx.fillStyle = '#fff8ee'
      ctx.fillText(floater.text, floater.x, floater.y - (1 - floater.life) * 34)
    }
    ctx.globalAlpha = 1
    ctx.restore()

    const vignette = ctx.createRadialGradient(
      this.viewW / 2,
      this.viewH / 2,
      Math.min(this.viewW, this.viewH) * 0.35,
      this.viewW / 2,
      this.viewH / 2,
      Math.max(this.viewW, this.viewH) * 0.72,
    )
    vignette.addColorStop(0, 'rgba(70, 32, 12, 0)')
    vignette.addColorStop(1, 'rgba(70, 32, 12, 0.28)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, this.viewW, this.viewH)
  }

  private drawLive(ctx: CanvasRenderingContext2D): void {
    const shooter = this.shooter()
    for (const marble of this.marbles) {
      if (marble.kind === 'shooter') continue
      this.drawOne(ctx, marble, false)
    }
    if (!shooter) return

    const visual = this.shooterVisual(shooter)
    if (this.dragging && this.pullDist > 8) {
      const shown = Math.min(this.pullDist, MAX_PULL)
      const ux = this.pullX / this.pullDist
      const uy = this.pullY / this.pullDist
      ctx.save()
      ctx.strokeStyle = 'rgba(43, 28, 18, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(shooter.body.position.x, shooter.body.position.y)
      ctx.lineTo(visual.x, visual.y)
      ctx.stroke()
      ctx.restore()
      const length = this.aimLength(visual.x, visual.y, -ux, -uy, 70 + (shown / MAX_PULL) * 520)
      drawAim(ctx, visual.x, visual.y, -ux, -uy, length, shown / MAX_PULL)
    } else if (this.phase === 'aim' && this.screen === 'play') {
      const pulse = shooter.radius + 12 + Math.sin(this.menuT * 5) * 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(shooter.body.position.x, shooter.body.position.y, pulse, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 250, 240, 0.75)'
      ctx.lineWidth = 1.6
      ctx.setLineDash([4, 6])
      ctx.stroke()
      ctx.restore()
    }

    const look = SHOOTERS[shooter.owner]
    drawMarble(ctx, visual.x, visual.y, shooter.radius, look, shooter.body.angle, look.ring)
  }

  private drawOne(ctx: CanvasRenderingContext2D, marble: Marble, isShooter: boolean): void {
    const look: Swatch = isShooter ? SHOOTERS[marble.owner] : swatch(marble.colorIndex)
    const { x, y } = marble.body.position
    const speed = Math.hypot(marble.body.velocity.x, marble.body.velocity.y)
    if (speed > 5) {
      ctx.save()
      ctx.globalAlpha = Math.min(0.28, speed / 50)
      ctx.fillStyle = look.body
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath()
        ctx.arc(
          x - marble.body.velocity.x * i * 0.55,
          y - marble.body.velocity.y * i * 0.55,
          marble.radius * (1 - i * 0.12),
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
      ctx.restore()
    }
    if (marble.kind === 'target' && this.phase === 'rolling' && this.isOutside(marble)) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, marble.radius + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(227, 163, 26, 0.95)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }
    drawMarble(ctx, x, y, marble.radius, look, marble.body.angle, isShooter ? SHOOTERS[marble.owner].ring : undefined)
  }

  private drawMenuMarbles(ctx: CanvasRenderingContext2D): void {
    const spin = this.menuT * 0.12
    const c = Math.cos(spin)
    const s = Math.sin(spin)
    CLASSIC.forEach((spot, index) => {
      const x0 = spot.x * RING.r * 0.86
      const y0 = spot.y * RING.r * 0.86
      const x = RING.x + x0 * c - y0 * s
      const y = RING.y + x0 * s + y0 * c + Math.sin(this.menuT * 1.3 + index) * 2
      drawMarble(ctx, x, y, TARGET_R, swatch(spot.c), this.menuT * 0.35 + index)
    })
    const hero = SHOOTERS[0]
    drawMarble(
      ctx,
      P1.x,
      P1.y + Math.sin(this.menuT * 2) * 4,
      SHOOTER_R,
      hero,
      this.menuT * 0.6,
      hero.ring,
    )
  }

  private aimLength(x: number, y: number, ux: number, uy: number, max: number): number {
    let length = max
    for (const marble of this.marbles) {
      if (marble.kind !== 'target') continue
      const dx = marble.body.position.x - x
      const dy = marble.body.position.y - y
      const along = dx * ux + dy * uy
      if (along <= 0) continue
      const nearestX = x + ux * along
      const nearestY = y + uy * along
      const miss = Math.hypot(marble.body.position.x - nearestX, marble.body.position.y - nearestY)
      if (miss <= marble.radius + 6) length = Math.min(length, Math.max(16, along - marble.radius))
    }
    return length
  }

  private shooterVisual(shooter: Marble): { x: number; y: number } {
    if (!this.dragging || this.pullDist < 1) return shooter.body.position
    const shown = Math.min(this.pullDist, MAX_PULL)
    return {
      x: shooter.body.position.x + (this.pullX / this.pullDist) * shown * 0.38,
      y: shooter.body.position.y + (this.pullY / this.pullDist) * shown * 0.38,
    }
  }

  private knuckles() {
    const marks = [{ x: P1.x, y: P1.y, active: this.mode === 'solo' || this.turn === 0, outward: 1 }]
    if (this.mode === 'duel' || !this.showPhysics()) {
      marks.push({ x: P2.x, y: P2.y, active: this.mode === 'duel' && this.turn === 1, outward: -1 })
    }
    return marks
  }

  private showPhysics(): boolean {
    if (this.marbles.length === 0) return false
    if (this.screen === 'how') return this.howBack === 'pause'
    return (
      this.screen === 'play' ||
      this.screen === 'pause' ||
      this.screen === 'soloClear' ||
      this.screen === 'soloFail' ||
      this.screen === 'matchEnd'
    )
  }

  private ensureNoise(): void {
    if (this.noise) return
    this.noise = this.ctx.createPattern(makeNoise(), 'repeat')
  }

  private placeCoach(): void {
    const show =
      this.screen === 'play' &&
      this.mode === 'solo' &&
      this.levelIndex === 0 &&
      !this.hasShotOnce &&
      this.phase === 'aim' &&
      !this.dragging
    this.coachEl.hidden = !show
    if (!show) return
    const shooter = this.shooter()
    if (!shooter) return
    const point = this.toScreen(shooter.body.position.x, shooter.body.position.y)
    this.coachEl.style.left = `${point.x}px`
    this.coachEl.style.top = `${point.y}px`
  }

  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const x = (clientX - rect.left - this.viewX) / this.viewScale
    const y = (clientY - rect.top - this.viewY) / this.viewScale
    return this.rotateAround(x, y, -this.flip * Math.PI)
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    const flipped = this.rotateAround(x, y, this.flip * Math.PI)
    return {
      x: this.viewX + flipped.x * this.viewScale,
      y: this.viewY + flipped.y * this.viewScale,
    }
  }

  private rotateAround(x: number, y: number, angle: number): { x: number; y: number } {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const dx = x - RING.x
    const dy = y - RING.y
    return { x: RING.x + dx * c - dy * s, y: RING.y + dx * s + dy * c }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as SaveData
      if (Array.isArray(data.stars)) this.stars = data.stars.map((value) => Number(value) || 0)
      this.muted = Boolean(data.muted)
      this.sfx.muted = this.muted
    } catch {
      /* ignore broken saves */
    }
  }

  private save(): void {
    const data: SaveData = { stars: this.stars, muted: this.muted }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* ignore private mode */
    }
  }
}
