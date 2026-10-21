export class Sfx {
  muted = false
  private ctx: AudioContext | null = null

  unlock(): void {
    if (this.muted) return
    const ctx = this.ac()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  roll(): void { this.tone(480, 0.05, 0.04) }
  step(): void { this.tone(340, 0.04, 0.03) }
  ladder(): void { this.tone(620, 0.12, 0.06) }
  snake(): void { this.tone(160, 0.2, 0.07, 'triangle') }
  win(): void { ;[523, 659, 784].forEach((freq, index) => this.tone(freq, 0.14, 0.05, 'sine', index * 0.08)) }

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
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }
}
