export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private last = 0

  unlock(): void {
    if (this.muted) return
    const ctx = this.ac()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  clack(force: number): void {
    const now = performance.now()
    if (now - this.last < 40) return
    this.last = now
    const amount = Math.max(0.15, Math.min(1, force))
    this.tone(140 + amount * 380, 0.09, 0.04 + amount * 0.08, 'sine')
  }

  flick(power: number): void {
    this.tone(180 + power * 140, 0.08, 0.06, 'triangle')
  }

  pocket(): void {
    this.tone(520, 0.07, 0.05)
    this.tone(760, 0.1, 0.04)
  }

  foul(): void {
    this.tone(140, 0.18, 0.07, 'triangle')
  }

  win(): void {
    ;[523, 659, 784].forEach((freq, index) => this.tone(freq, 0.16, 0.06, 'sine', index * 0.08))
  }

  private ac(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(freq: number, dur: number, volume: number, type: OscillatorType = 'sine', delay = 0): void {
    if (this.muted) return
    const ctx = this.ac()
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }
}
