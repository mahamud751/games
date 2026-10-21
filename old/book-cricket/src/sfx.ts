export class Sfx {
  muted = false
  private ctx: AudioContext | null = null

  unlock(): void {
    if (this.muted) return
    const ctx = this.ac()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  flip(): void {
    this.noise(0.12, 0.08, 700)
  }

  four(): void {
    this.tone(523, 0, 0.12, 0.08)
    this.tone(659, 0.08, 0.14, 0.07)
  }

  six(): void {
    ;[523, 659, 784, 1046].forEach((freq, index) => this.tone(freq, index * 0.07, 0.16, 0.07))
  }

  out(): void {
    this.tone(196, 0, 0.22, 0.08, 'triangle')
    this.tone(146, 0.1, 0.28, 0.07, 'triangle')
  }

  dot(): void {
    this.tone(330, 0, 0.05, 0.03)
  }

  tap(): void {
    this.tone(720, 0, 0.04, 0.035)
  }

  win(): void {
    ;[523, 659, 784, 1046].forEach((freq, index) => this.tone(freq, index * 0.1, 0.2, 0.07))
  }

  private ac(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(freq: number, delay: number, dur: number, volume: number, type: OscillatorType = 'sine'): void {
    if (this.muted) return
    const ctx = this.ac()
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, volume: number, freq: number): void {
    if (this.muted) return
    const ctx = this.ac()
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
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
