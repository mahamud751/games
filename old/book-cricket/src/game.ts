import {
  BOOKS,
  OURS,
  THEIRS,
  applyBall,
  closeInnings,
  cpuShot,
  flipPage,
  freshInnings,
  inningsDone,
  styleName,
  type Ball,
  type BookId,
  type Innings,
  type Limits,
  type Shot,
} from './cricket'
import { Sfx } from './sfx'

const SAVE_KEY = 'book-cricket-save-v1'
const DIGITS = '০১২৩৪৫৬৭৮৯'

type Mode = 'chase' | 'friend' | 'solo'
type Screen = 'menu' | 'how' | 'setup' | 'play' | 'break' | 'result'

interface Save {
  best: number
  wins: number
  muted?: boolean
}

function bn(n: number): string {
  return String(Math.max(0, Math.floor(Math.abs(n)))).replace(/\d/g, (digit) => DIGITS[Number(digit)] ?? digit)
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}

export class BookGame {
  private readonly sfx = new Sfx()
  private screen: Screen = 'menu'
  private mode: Mode = 'chase'
  private bookId: BookId = 'bangla'
  private overs = 5
  private names: [string, string] = ['খেলোয়াড় ১', 'খেলোয়াড় ২']
  private limits: Limits = { maxBalls: 30, maxWickets: 10 }
  private innings: Innings = freshInnings(OURS)
  private first: Innings | null = null
  private target: number | null = null
  private half = 1
  private battingName = 'আমাদের স্কুল'
  private bowlingName = 'প্যারা স্কুল'
  private humanBatting = true
  private shot: Shot | null = null
  private page = 0
  private opened = false
  private stamp: { text: string; cls: string } | null = null
  private call = 'শট বাছো, তারপর বই খোলো।'
  private busy = false
  private skip = false
  private wake: (() => void) | null = null
  private best = 0
  private wins = 0
  private muted = false
  private resultTitle = ''
  private resultBody = ''

  constructor(private readonly app: HTMLElement) {
    this.load()
    this.app.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
      if (!button || button.hasAttribute('disabled')) return
      this.onAct(button.dataset.act ?? '', button)
    })
    this.app.addEventListener('pointerdown', () => this.sfx.unlock())
    window.addEventListener('keydown', (event) => this.onKey(event))
    this.paint()
  }

  private onKey(event: KeyboardEvent): void {
    if (this.screen !== 'play' || !this.humanBatting || this.busy) return
    if (event.key === '1') this.chooseShot('careful')
    if (event.key === '2') this.chooseShot('normal')
    if (event.key === '3') this.chooseShot('attack')
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      void this.humanFlip()
    }
  }

  private onAct(act: string, button: HTMLElement): void {
    if (act !== 'mute') this.sfx.tap()
    switch (act) {
      case 'chase':
      case 'friend':
      case 'solo':
        this.mode = act
        this.screen = 'setup'
        this.paint()
        break
      case 'how':
        this.screen = 'how'
        this.paint()
        break
      case 'menu':
        this.busy = false
        this.skip = true
        this.wake?.()
        this.screen = 'menu'
        this.paint()
        break
      case 'book':
        this.bookId = (button.dataset.id as BookId) || 'bangla'
        this.markChoices()
        break
      case 'overs':
        this.overs = Number(button.dataset.n) === 2 ? 2 : 5
        this.markChoices()
        break
      case 'start':
        this.readNames()
        this.beginMatch()
        break
      case 'shot':
        this.chooseShot((button.dataset.shot as Shot) || 'normal')
        break
      case 'flip':
        void this.humanFlip()
        break
      case 'skip':
        this.skip = true
        this.wake?.()
        break
      case 'chase-start':
        this.startChase()
        break
      case 'mute':
        this.muted = !this.muted
        this.sfx.muted = this.muted
        this.save()
        if (!this.muted) this.sfx.tap()
        this.paint()
        break
      default:
        break
    }
  }

  private chooseShot(shot: Shot): void {
    if (!this.humanBatting || this.busy) return
    this.shot = shot
    const striker = this.innings.batters[this.innings.striker]
    const hint =
      shot === 'careful' ? 'কম আউট, ছোট রান।' : shot === 'attack' ? 'চার-ছক্কা, আউটের ঝুঁকি।' : 'বই যেমন খুলবে।'
    this.call = striker ? `${striker.name} · ${styleName(striker.style)} · ${hint}` : hint
    this.paint()
  }

  private beginMatch(): void {
    this.skip = false
    this.opened = false
    this.stamp = null
    this.page = 0
    this.shot = null
    this.first = null
    this.target = null
    this.half = 1
    if (this.mode === 'solo') {
      this.limits = { maxBalls: 12, maxWickets: 3 }
      this.target = null
      this.battingName = 'তুমি'
      this.bowlingName = 'বই'
      this.innings = freshInnings(OURS)
      this.humanBatting = true
      this.call = '২ ওভার, ৩ উইকেট। শট বাছো।'
      this.screen = 'play'
      this.paint()
      return
    }
    const balls = this.overs * 6
    this.limits = { maxBalls: balls, maxWickets: this.overs === 2 ? 5 : 10 }
    if (this.mode === 'chase') {
      this.battingName = 'প্যারা স্কুল'
      this.bowlingName = 'আমাদের স্কুল'
      this.innings = freshInnings(THEIRS)
      this.humanBatting = false
      this.target = null
      this.call = 'প্যারা স্কুল ব্যাট করছে।'
      this.screen = 'play'
      this.paint()
      void this.runCpu()
      return
    }
    const firstFriend = Math.random() < 0.5 ? 0 : 1
    this.battingName = this.names[firstFriend] ?? 'খেলোয়াড় ১'
    this.bowlingName = this.names[firstFriend === 0 ? 1 : 0] ?? 'খেলোয়াড় ২'
    this.innings = freshInnings(firstFriend === 0 ? OURS : THEIRS)
    this.humanBatting = true
    this.call = `টস: ${this.battingName} আগে ব্যাট করবে।`
    this.screen = 'play'
    this.paint()
  }

  private startChase(): void {
    if (!this.first) return
    this.half = 2
    this.target = this.first.runs + 1
    this.opened = false
    this.stamp = null
    this.shot = null
    this.skip = false
    const settingSide = this.battingName
    this.battingName = this.bowlingName
    this.bowlingName = settingSide
    const secondSquad = this.mode === 'friend' && this.battingName === this.names[1] ? THEIRS : OURS
    this.innings = freshInnings(secondSquad)
    this.humanBatting = true
    this.call = `জিততে ${bn(this.target)} রান।`
    this.screen = 'play'
    this.paint()
    if (!this.humanBatting) void this.runCpu()
  }

  private async runCpu(): Promise<void> {
    this.humanBatting = false
    while (!inningsDone(this.innings, this.limits, this.target) && !this.skip && this.screen === 'play') {
      this.shot = cpuShot(this.innings, this.limits, this.target)
      this.paint()
      const done = await this.playBall(this.shot)
      if (done) break
    }
    if (this.screen !== 'play') return
    if (this.skip && !inningsDone(this.innings, this.limits, this.target)) {
      while (!inningsDone(this.innings, this.limits, this.target)) {
        const shot = cpuShot(this.innings, this.limits, this.target)
        const flip = flipPage(BOOKS[this.bookId], shot, this.innings.batters[this.innings.striker]?.style ?? 'steady')
        applyBall(this.innings, flip.ball, this.limits, this.target)
      }
    }
    this.finishHalf()
  }

  private async humanFlip(): Promise<void> {
    if (this.screen !== 'play' || !this.humanBatting || this.busy) return
    if (!this.shot) {
      this.call = 'আগে শট বাছো — আস্তে, সাধারণ, না মার।'
      this.paint()
      return
    }
    const done = await this.playBall(this.shot)
    if (done) this.finishHalf()
  }

  private async playBall(shot: Shot): Promise<boolean> {
    if (this.busy || inningsDone(this.innings, this.limits, this.target)) return false
    this.busy = true
    const style = this.innings.batters[this.innings.striker]?.style ?? 'steady'
    const flip = flipPage(BOOKS[this.bookId], shot, style)
    this.opened = true
    this.stamp = null
    this.page = 12
    this.paint()
    this.sfx.flip()
    const ticks = this.quickMotion() || !this.humanBatting ? 6 : 9
    for (let tick = 0; tick < ticks; tick += 1) {
      if (this.skip || this.screen !== 'play') break
      this.page = 12 + Math.floor(Math.random() * 90)
      this.paintPage()
      await this.wait(this.quickMotion() ? 16 : 40 + tick * 12)
    }
    if (this.screen !== 'play') {
      this.busy = false
      return false
    }
    this.page = flip.page
    this.stamp = { text: flip.label, cls: flip.stamp }
    applyBall(this.innings, flip.ball, this.limits, this.target)
    this.call = this.speak(flip.label)
    this.soundFor(flip.ball)
    const done = inningsDone(this.innings, this.limits, this.target)
    this.busy = false
    this.paint()
    this.busy = true
    if (!this.skip && this.screen === 'play') {
      const pause = this.quickMotion() ? 40 : done ? 720 : this.humanBatting ? 260 : 480
      await this.wait(pause)
    }
    if (this.screen !== 'play') {
      this.busy = false
      return false
    }
    this.busy = false
    return done
  }

  private finishHalf(): void {
    if (this.screen !== 'play') return
    closeInnings(this.innings)
    this.busy = false
    this.shot = null
    if (this.mode === 'solo' || this.half === 2) {
      this.screen = 'result'
      this.writeResult()
      if (this.resultTitle.includes('জিতেছে') || this.resultTitle.includes('রেকর্ড')) this.sfx.win()
      this.paint()
      return
    }
    this.first = this.innings
    this.screen = 'break'
    this.call = `${this.battingName} ${bn(this.innings.runs)}/${bn(this.innings.wickets)}`
    this.paint()
  }

  private writeResult(): void {
    if (this.mode === 'solo') {
      const record = this.innings.runs > this.best
      if (record) this.best = this.innings.runs
      this.save()
      this.resultTitle = record ? 'নতুন রেকর্ড!' : 'ইনিংস শেষ'
      this.resultBody = `${bn(this.innings.runs)}/${bn(this.innings.wickets)} (${this.oversText(this.innings.balls)} ওভার)`
      return
    }
    const chase = this.innings
    const set = this.first
    if (!set || this.target === null) {
      this.resultTitle = 'খেলা শেষ'
      this.resultBody = ''
      return
    }
    const opponent = this.target - 1
    if (chase.runs >= this.target) {
      const left = this.limits.maxWickets - chase.wickets
      this.resultTitle = `${this.battingName} জিতেছে`
      this.resultBody = `${bn(left)} উইকেটে জয়`
      if (this.mode === 'chase') this.wins += 1
    } else if (chase.runs === opponent) {
      this.resultTitle = 'টাই'
      this.resultBody = `দুই দলই ${bn(opponent)}`
    } else {
      this.resultTitle = `${this.bowlingName} জিতেছে`
      this.resultBody = `${bn(opponent - chase.runs)} রানে জয়`
    }
    this.save()
  }

  private speak(label: string): string {
    const need = this.needLine()
    return need ? `${label} · ${need}` : label
  }

  private needLine(): string {
    if (this.target === null) return ''
    const need = this.target - this.innings.runs
    const balls = this.limits.maxBalls - this.innings.balls
    if (need <= 0) return 'তাড়া শেষ!'
    return `আর ${bn(need)} রান, ${bn(balls)} বলে`
  }

  private soundFor(ball: Ball): void {
    if (ball === 'W') {
      this.sfx.out()
      this.shake()
      return
    }
    if (ball === 6) {
      this.sfx.six()
      this.shake()
      return
    }
    if (ball === 4) this.sfx.four()
    else if (ball === 0) this.sfx.dot()
    else this.sfx.tap()
  }

  private shake(): void {
    document.body.classList.remove('shake')
    void document.body.offsetWidth
    document.body.classList.add('shake')
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.wake = null
        resolve()
      }, ms)
      this.wake = () => {
        window.clearTimeout(timer)
        this.wake = null
        resolve()
      }
    })
  }

  private quickMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private readNames(): void {
    const first = this.app.querySelector<HTMLInputElement>('#n1')?.value.trim()
    const second = this.app.querySelector<HTMLInputElement>('#n2')?.value.trim()
    if (first) this.names[0] = first
    if (second) this.names[1] = second
  }

  private markChoices(): void {
    this.app.querySelectorAll<HTMLElement>('[data-act="book"]').forEach((button) => {
      button.classList.toggle('on', button.dataset.id === this.bookId)
    })
    this.app.querySelectorAll<HTMLElement>('[data-act="overs"]').forEach((button) => {
      button.classList.toggle('on', Number(button.dataset.n) === this.overs)
    })
  }

  private paintPage(): void {
    const node = this.app.querySelector('#page-num')
    if (node) node.textContent = bn(this.page)
  }

  private paint(): void {
    this.app.innerHTML = this.html()
  }

  private html(): string {
    if (this.screen === 'menu') return this.menuHtml()
    if (this.screen === 'how') return this.howHtml()
    if (this.screen === 'setup') return this.setupHtml()
    if (this.screen === 'break') return this.breakHtml()
    if (this.screen === 'result') return this.resultHtml()
    return this.playHtml()
  }

  private menuHtml(): string {
    return `<div class="desk menu-desk">
      <div class="panel">
        <div class="panel-top">
          <div>
            <p class="eyebrow">স্কুলের বই</p>
            <h1>বই ক্রিকেট</h1>
            <p class="sub">Book Cricket</p>
          </div>
          ${this.muteButton()}
        </div>
        <p class="lead">চোখ বুজে পাতা খোলা নয়। শট বাছো — আস্তে, সাধারণ, না মার — তারপর বই খোলো। শেষ অঙ্কে রান বা আউট।</p>
        <div class="stack">
          <button type="button" class="btn" data-act="chase">স্কুলে তাড়া</button>
          <button type="button" class="btn ghost" data-act="friend">বন্ধুর সাথে</button>
          <button type="button" class="btn ghost" data-act="solo">একক চ্যালেঞ্জ</button>
          <button type="button" class="texty" data-act="how">নিয়ম</button>
        </div>
        <p class="fine">সেরা ${bn(this.best)} · জয় ${bn(this.wins)}</p>
      </div>
    </div>`
  }

  private howHtml(): string {
    return `<div class="desk menu-desk"><div class="panel">
      <p class="eyebrow">নিয়ম</p>
      <h2>পাতার শেষ অঙ্ক</h2>
      <ul class="rules">
        <li><b>০ আর ৮</b> আউট</li>
        <li><b>৪</b> চার · <b>৬</b> ছক্কা</li>
        <li><b>১, ২, ৩</b> সেই রান</li>
        <li><b>৫, ৭, ৯</b> ডট বল</li>
      </ul>
      <p class="lead"><b>আস্তে</b> আউট কমায়, বাউন্ডারিও কমে। <b>মার</b> চার-ছক্কা বাড়ায়, আউটের ঝুঁকিও। স্ট্রাইকে যে আছে, তার ধরন শটের সঙ্গে মিললে ভালো।</p>
      <p class="lead">বেজি রানে স্ট্রাইক বদলায়। ওভার শেষেও। তাড়ায় প্রতিপক্ষের চেয়ে ১ রান বেশি লাগে।</p>
      <div class="stack"><button type="button" class="btn" data-act="menu">ফিরে যাও</button></div>
    </div></div>`
  }

  private setupHtml(): string {
    const title = this.mode === 'friend' ? 'বন্ধুর সাথে' : this.mode === 'solo' ? 'একক চ্যালেঞ্জ' : 'স্কুলে তাড়া'
    const books = (Object.values(BOOKS) as (typeof BOOKS)[BookId][])
      .map(
        (book) =>
          `<button type="button" class="choice ${book.id === this.bookId ? 'on' : ''}" data-act="book" data-id="${book.id}"><b>${book.name}</b><small>${book.blurb}</small></button>`,
      )
      .join('')
    const names =
      this.mode === 'friend'
        ? `<label class="field">প্রথম খেলোয়াড়<input id="n1" maxlength="16" value="${esc(this.names[0])}" /></label>
           <label class="field">দ্বিতীয় খেলোয়াড়<input id="n2" maxlength="16" value="${esc(this.names[1])}" /></label>`
        : ''
    const overs =
      this.mode === 'solo'
        ? '<p class="lead">২ ওভার, ৩ উইকেট। যত রান, তত ভালো।</p>'
        : `<div class="chips">
            <button type="button" class="chip ${this.overs === 2 ? 'on' : ''}" data-act="overs" data-n="2">২ ওভার</button>
            <button type="button" class="chip ${this.overs === 5 ? 'on' : ''}" data-act="overs" data-n="5">৫ ওভার</button>
          </div>`
    return `<div class="desk menu-desk"><div class="panel">
      <p class="eyebrow">ম্যাচ</p>
      <h2>${title}</h2>
      ${names}
      <p class="label">কোন বই?</p>
      <div class="books">${books}</div>
      ${overs}
      <div class="stack">
        <button type="button" class="btn" data-act="start">খেলা শুরু</button>
        <button type="button" class="texty" data-act="menu">ফিরে যাও</button>
      </div>
    </div></div>`
  }

  private breakHtml(): string {
    const score = this.first
    const chaseName = this.mode === 'chase' ? 'আমাদের স্কুল' : this.bowlingName
    return `<div class="desk menu-desk"><div class="panel">
      <p class="eyebrow">ইনিংস বিরতি</p>
      <h2>${esc(this.battingName)}</h2>
      <p class="huge">${score ? `${bn(score.runs)}/${bn(score.wickets)}` : ''}</p>
      <p class="lead">${chaseName}-কে জিততে ${bn((score?.runs ?? 0) + 1)} রান লাগবে।</p>
      <div class="stack">
        <button type="button" class="btn" data-act="chase-start">${this.mode === 'friend' ? 'ফোন ঘুরিয়ে তাড়া' : 'তাড়া শুরু'}</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div></div>`
  }

  private resultHtml(): string {
    const yours = this.mode === 'solo' || this.half === 2 ? this.card(this.innings, this.battingName) : ''
    const theirs = this.first ? this.card(this.first, this.bowlingName) : ''
    return `<div class="desk menu-desk"><div class="panel result-panel">
      <p class="eyebrow">ফলাফল</p>
      <h2>${esc(this.resultTitle)}</h2>
      <p class="lead">${esc(this.resultBody)}</p>
      ${theirs}
      ${yours}
      <div class="stack">
        <button type="button" class="btn" data-act="start">আবার খেলো</button>
        <button type="button" class="texty" data-act="menu">হোম</button>
      </div>
    </div></div>`
  }

  private playHtml(): string {
    const inn = this.innings
    const striker = inn.batters[inn.striker]
    const non = inn.batters[inn.nonStriker]
    const rate = inn.balls > 0 ? ((inn.runs * 6) / inn.balls).toFixed(1) : '0.0'
    const need = this.needLine()
    const canFlip = this.humanBatting && !this.busy && !inningsDone(inn, this.limits, this.target)
    return `<div class="desk play-desk">
      <header class="top">
        <div>
          <p class="eyebrow">${esc(this.battingName)}</p>
          <p class="huge">${bn(inn.runs)}/${bn(inn.wickets)}</p>
          <p class="meta">${this.oversText(inn.balls)} ওভার · রান রেট ${rate}</p>
        </div>
        <div class="top-side">
          ${need ? `<p class="need ${this.hotChase() ? 'hot' : ''}">${need}</p>` : `<p class="need">${esc(this.bowlingName)}</p>`}
          <div class="top-actions">${this.muteButton()}<button type="button" class="texty inline" data-act="menu">হোম</button></div>
        </div>
      </header>
      <div class="stage">
        <div class="left">
          <p class="call">${esc(this.call)}</p>
          ${this.bookHtml(canFlip)}
          <div class="over-row" aria-label="এই ওভার">${this.pills(inn.thisOver)}</div>
          ${this.humanBatting ? this.shotHtml() : `<button type="button" class="btn skip" data-act="skip">ইনিংস এগিয়ে দাও</button>`}
          <p class="crease">
            <span class="on">${striker ? `${esc(striker.name)} ${bn(striker.runs)} (${bn(striker.balls)})` : ''}${this.humanBatting ? ' · স্ট্রাইক' : ''}</span>
            <span>${non && non.status === 'batting' ? `${esc(non.name)} ${bn(non.runs)} (${bn(non.balls)})` : ''}</span>
          </p>
        </div>
        <aside class="scorecard">
          <h3>স্কোরকার্ড</h3>
          ${this.batterRows(inn, true)}
          <p class="fow">জুটি ${bn(inn.partnership)}${inn.fow.length ? ` · উইকেট ${inn.fow.map((score) => bn(score)).join(', ')}` : ''}</p>
          <div class="past">${inn.overs.map((over, index) => `<p><b>${bn(index + 1)}</b> ${over.map((ball) => this.mini(ball)).join(' ')}</p>`).join('')}</div>
        </aside>
      </div>
    </div>`
  }

  private bookHtml(canFlip: boolean): string {
    const book = BOOKS[this.bookId]
    if (!this.opened) {
      return `<button type="button" class="book cloth" data-act="flip" ${canFlip ? '' : 'disabled'}>
        <span><em>${book.name}</em><strong>পাতা খোলো</strong></span>
      </button>`
    }
    return `<button type="button" class="book paper ${this.busy ? 'flipping' : ''}" data-act="flip" ${canFlip ? '' : 'disabled'}>
      <span class="spine"></span>
      <span class="sheet">
        <span class="book-name">${book.name}</span>
        <span class="page-num" id="page-num">${this.page ? bn(this.page) : '—'}</span>
        <span class="legend">০·৮ আউট · ৪ চার · ৬ ছক্কা · ৫·৭·৯ ডট</span>
        ${this.stamp ? `<span class="stamp ${this.stamp.cls}">${esc(this.stamp.text)}</span>` : ''}
      </span>
    </button>`
  }

  private shotHtml(): string {
    const shots: [Shot, string][] = [
      ['careful', 'আস্তে'],
      ['normal', 'সাধারণ'],
      ['attack', 'মার'],
    ]
    return `<div class="shots">${shots
      .map(
        ([id, label]) =>
          `<button type="button" class="shot ${id} ${this.shot === id ? 'on' : ''}" data-act="shot" data-shot="${id}" ${this.busy ? 'disabled' : ''}>${label}</button>`,
      )
      .join('')}</div>`
  }

  private card(inn: Innings, title: string): string {
    return `<section class="mini-card"><h3>${esc(title)} ${bn(inn.runs)}/${bn(inn.wickets)}</h3>${this.batterRows(inn, false)}</section>`
  }

  private batterRows(inn: Innings, live: boolean): string {
    const rows = inn.batters
      .filter((batter) => batter.status !== 'yet')
      .map((batter) => {
        const star = !live && batter.status === 'notout' ? '*' : live && batter === inn.batters[inn.striker] && batter.status === 'batting' ? '*' : ''
        return `<tr class="${batter.status}"><td>${esc(batter.name)}${star}</td><td>${bn(batter.runs)}</td><td>${bn(batter.balls)}</td><td>${bn(batter.fours)}</td><td>${bn(batter.sixes)}</td></tr>`
      })
      .join('')
    return `<table><thead><tr><th>ব্যাটার</th><th>রান</th><th>বল</th><th>৪</th><th>৬</th></tr></thead><tbody>${rows}</tbody></table>`
  }

  private pills(balls: Ball[]): string {
    const filled = balls.map((ball) => `<i class="pill ${this.pillClass(ball)}">${ball === 'W' ? 'আ' : bn(ball)}</i>`).join('')
    const empty = Array.from({ length: Math.max(0, 6 - balls.length) }, () => '<i class="pill empty"></i>').join('')
    return filled + empty
  }

  private mini(ball: Ball): string {
    return `<i class="pill sm ${this.pillClass(ball)}">${ball === 'W' ? 'আ' : bn(ball)}</i>`
  }

  private pillClass(ball: Ball): string {
    if (ball === 'W') return 'w'
    if (ball === 4) return 'four'
    if (ball === 6) return 'six'
    if (ball === 0) return 'dot'
    return 'run'
  }

  private oversText(balls: number): string {
    const over = Math.floor(balls / 6)
    const ball = balls % 6
    return ball === 0 ? bn(over) : `${bn(over)}.${bn(ball)}`
  }

  private hotChase(): boolean {
    if (this.target === null) return false
    const balls = this.limits.maxBalls - this.innings.balls
    if (balls <= 0) return false
    return (this.target - this.innings.runs) / balls >= 2
  }

  private muteButton(): string {
    return `<button type="button" class="icon" data-act="mute" aria-label="শব্দ" aria-pressed="${this.muted}">${this.muted ? 'শব্দ বন্ধ' : 'শব্দ'}</button>`
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Save
      this.best = Number(data.best) || 0
      this.wins = Number(data.wins) || 0
      this.muted = Boolean(data.muted)
      this.sfx.muted = this.muted
    } catch {
      /* ignore broken saves */
    }
  }

  private save(): void {
    const data: Save = { best: this.best, wins: this.wins, muted: this.muted }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    } catch {
      /* ignore private mode */
    }
  }
}
