export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private lastClack = 0

  unlock(): void {
    if (this.muted) return
    const ctx = this.ac()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  clack(force: number): void {
    if (this.muted) return
    const now = performance.now()
    if (now - this.lastClack < 42) return
    this.lastClack = now
    const ctx = this.ac()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const amount = Math.max(0.08, Math.min(1, force))
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160 + amount * 520, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.09)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.05 + amount * 0.16, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.13)
  }

  shoot(power: number): void {
    if (this.muted) return
    this.noise(0.09, 0.12 + power * 0.12, 900)
    this.tone(220 + power * 180, 0, 0.1, 0.08, 'triangle')
  }

  pocket(): void {
    if (this.muted) return
    this.tone(620, 0, 0.09, 0.1)
    this.tone(880, 0.07, 0.12, 0.08)
  }

  tap(): void {
    if (this.muted) return
    this.tone(740, 0, 0.04, 0.04)
  }

  win(): void {
    if (this.muted) return
    ;[523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, i * 0.09, 0.18, 0.07))
  }

  fail(): void {
    if (this.muted) return
    this.tone(196, 0, 0.22, 0.08, 'triangle')
    this.tone(146, 0.12, 0.26, 0.07, 'triangle')
  }

  private ac(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(
    freq: number,
    delay: number,
    dur: number,
    volume: number,
    type: OscillatorType = 'sine',
  ): void {
    const ctx = this.ac()
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, volume: number, freq: number): void {
    const ctx = this.ac()
    const length = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length
      data[i] = (Math.random() * 2 - 1) * fade * fade
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
  }
}
